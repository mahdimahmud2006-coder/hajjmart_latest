<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Shop;
use App\Services\ActivityLogService;
use App\Services\OrderService;
use App\Services\ReturnService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use RuntimeException;
use Throwable;

class OrderController extends Controller
{
    use ApiResponse;

    public function __construct(
        private OrderService $orders,
        private ReturnService $returns,
        private ActivityLogService $activities,
    ) {}

    public function index(Request $request)
    {
        $orders = Order::query()
            ->with([
                'shop:id,name,code', 'creator:id,name', 'assignee:id,name', 'packer:id,name', 'customer:id,name,email,phone',
                'items.product:id,name,sku,slug,image_src', 'items.variant:id,sku', 'payments', 'returnRequests:id,order_id,rr_number,type,status,refund_total,exchange_due_total',
            ])
            ->when($request->q, function ($q, $search): void {
                $q->where(function ($sub) use ($search): void {
                    $sub->where('order_number', 'like', "%{$search}%")
                        ->orWhere('order_id', 'like', "%{$search}%")
                        ->orWhere('checkout_name', 'like', "%{$search}%")
                        ->orWhere('checkout_mobile_number', 'like', "%{$search}%")
                        ->orWhere('source_reference', 'like', "%{$search}%");
                });
            })
            ->when($request->shop_id, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->when($request->source_channel, function ($q, $source): void {
                if ($source === 'online') {
                    $q->whereIn('source_channel', ['website', 'ecommerce', 'social_commerce']);
                } elseif ($source === 'website') {
                    $q->whereIn('source_channel', ['website', 'ecommerce']);
                } else {
                    $q->where('source_channel', $source);
                }
            })
            ->when($request->status || $request->status_group, function ($q) use ($request): void {
                $st = (string) ($request->status ?: $request->status_group);
                if ($st === 'all' || $st === '') {
                    return;
                }
                if ($st === 'potential_fraud') {
                    $q->where('is_potential_fraud', true);
                    return;
                }
                $groups = [
                    'pending' => ['pending'],
                    'confirmed' => ['confirmed'],
                    'shipped' => ['shipped'],
                    'delivered' => ['delivered'],
                    'returned' => ['returned'],
                ];
                if (isset($groups[$st])) {
                    $q->whereIn(DB::raw("LOWER(COALESCE(NULLIF(status, ''), order_status, ''))"), $groups[$st]);
                } else {
                    $q->where('status', $st);
                }
            })
            ->when($request->boolean('potential_fraud') || $request->get('potential_fraud') === '1' || $request->get('potential_fraud') === 'true', function ($q): void {
                $q->where('is_potential_fraud', true);
            })
            ->when($request->payment_status, fn ($q, $status) => $q->where('payment_status', $status))
            ->when($request->printed_status, function ($q, $printed): void {
                if ($printed === 'printed') {
                    $q->whereNotNull('invoice_printed_at');
                } elseif ($printed === 'not_printed') {
                    $q->whereNull('invoice_printed_at');
                }
            })
            ->when($request->district, fn ($q, $district) => $q->where('checkout_district', $district))
            ->when($request->from, fn ($q, $from) => $q->whereDate(DB::raw('COALESCE(order_date, created_at)'), '>=', $from))
            ->when($request->to, fn ($q, $to) => $q->whereDate(DB::raw('COALESCE(order_date, created_at)'), '<=', $to))
            ->orderByDesc(DB::raw('COALESCE(order_date, created_at)'))
            ->paginate(max(1, min(250, (int) $request->get('per_page', 50))));

        return $this->success($orders, 'Orders retrieved.');
    }

    public function show(Order $order)
    {
        return $this->success($order->load([
            'shop', 'creator', 'assignee', 'packer', 'customer', 'items.product', 'items.variant', 'payments.receiver',
            'statusHistory', 'returnRequests.items.orderItem.product', 'couponApplications',
        ]), 'Order retrieved.');
    }

    public function update(Request $request, Order $order)
    {
        $source = strtolower((string) $order->source_channel);
        if ($source === 'ecommerce') {
            $source = 'website';
        }
        if (! in_array($source, ['website', 'social_commerce'], true)) {
            return $this->error('Only Website and Social Commerce orders can be edited.', 422);
        }
        if ($order->pathao_consignment_id) {
            return $this->error('This order already has a Pathao consignment and can no longer be edited.', 422);
        }
        if (in_array(strtolower((string) $order->status), ['delivered', 'returned', 'cancelled'], true)) {
            return $this->error('Completed, returned, or cancelled orders cannot be edited.', 422);
        }

        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:150'],
            'mobile_number' => ['required', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'full_address' => ['required', 'string', 'max:1000'],
            'district' => ['nullable', 'string', 'max:100'],
            'source_reference' => ['nullable', 'string', 'max:150'],
            'customer_note' => ['nullable', 'string', 'max:2000'],
            'admin_note' => ['nullable', 'string', 'max:2000'],
            'priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer', 'exists:products,id'],
            'items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
        ]);

        $order->loadMissing('items');
        $before = $order->only([
            'checkout_name', 'checkout_mobile_number', 'checkout_email', 'checkout_full_address',
            'checkout_district', 'source_reference', 'customer_note', 'admin_note', 'priority',
            'subtotal', 'net_subtotal', 'item_discount_total', 'discount_total', 'grand_total', 'due_amount', 'payment_status',
        ]);
        $before['items'] = $order->items->map(fn ($item): array => [
            'product_id' => $item->product_id,
            'variant_id' => $item->variant_id,
            'quantity' => $item->quantity,
            'unit_price' => $item->unit_price,
            'line_grand_total' => $item->line_grand_total,
        ])->values()->all();

        $deliverySnapshot = [
            'name' => $data['customer_name'],
            'country' => $order->checkout_country ?: 'Bangladesh',
            'full_address' => $data['full_address'],
            'district' => $data['district'] ?? null,
            'mobile_number' => $data['mobile_number'],
            'email' => $data['email'] ?? null,
        ];

        DB::transaction(function () use ($data, $order, $deliverySnapshot, $request): void {
            if (array_key_exists('items', $data)) {
                $this->orders->replaceEditableItems($order, $data['items'], $request->user()->id);
                $order->refresh();
            }

            $order->update([
                'checkout_name' => $data['customer_name'],
                'checkout_mobile_number' => $data['mobile_number'],
                'checkout_email' => $data['email'] ?? null,
                'checkout_full_address' => $data['full_address'],
                'checkout_district' => $data['district'] ?? null,
                'shipping_full_address' => $data['full_address'],
                'shipping_district' => $data['district'] ?? null,
                'shipping_mobile_number' => $data['mobile_number'],
                'shipping_email' => $data['email'] ?? null,
                'shipping_address_snapshot' => $deliverySnapshot,
                'billing_address_snapshot' => $deliverySnapshot,
                'source_reference' => $data['source_reference'] ?? null,
                'customer_note' => $data['customer_note'] ?? null,
                'admin_note' => $data['admin_note'] ?? null,
                'priority' => $data['priority'] ?? ($order->priority ?: 'normal'),
                // Keep legacy fields in sync for older reports/integrations.
                'customer_details' => array_merge((array) ($order->customer_details ?? []), [
                    'name' => $data['customer_name'],
                    'email' => $data['email'] ?? null,
                    'phone' => $data['mobile_number'],
                ]),
                'address' => array_merge((array) ($order->address ?? []), [
                    'street' => $data['full_address'],
                    'district' => $data['district'] ?? null,
                ]),
            ]);
        });

        $updated = $order->fresh([
            'shop:id,name,code', 'creator:id,name', 'assignee:id,name', 'packer:id,name', 'customer:id,name,email,phone',
            'items.product:id,name,sku,slug,image_src', 'items.variant:id,sku', 'payments', 'returnRequests', 'statusHistory',
        ]);

        \App\Jobs\CheckOrderFraudJob::dispatch($updated->id);

        $this->activities->record(
            'orders',
            'updated',
            "Edited {$updated->order_number}",
            $updated,
            $before,
            array_merge(
                $updated->only(array_values(array_filter(array_keys($before), fn (string $key): bool => $key !== 'items'))),
                ['items' => $updated->items->map(fn ($item): array => [
                    'product_id' => $item->product_id,
                    'variant_id' => $item->variant_id,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'line_grand_total' => $item->line_grand_total,
                ])->values()->all()],
            ),
            $request->user()->id,
            $updated->shop_id,
            $request
        );

        return $this->success($updated, 'Order updated.');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'source_channel' => ['required', Rule::in(['pos', 'social_commerce', 'website', 'ecommerce'])],
            'price_mode' => ['nullable', Rule::in(['retail', 'wholesale'])],
            'shop_id' => ['nullable', 'integer', 'exists:shops,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'customer_name' => ['nullable', 'string', 'max:150'],
            'mobile_number' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'full_address' => ['nullable', 'string', 'max:1000'],
            'district' => ['nullable', 'string', 'max:100'],
            'payment_method' => ['required', Rule::in(['cash', 'cod', 'card', 'bkash', 'nagad', 'bank', 'online', 'split'])],
            'payment_channel' => ['nullable', 'string', 'max:50'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_reference' => ['nullable', 'string', 'max:150'],
            'split_payments' => ['nullable', 'array'],
            'split_payments.*.method' => ['required_with:split_payments', 'string'],
            'split_payments.*.amount' => ['required_with:split_payments', 'numeric', 'min:0'],
            'split_payments.*.reference' => ['nullable', 'string'],
            'shipping_total' => ['nullable', 'numeric', 'min:0'],
            'manual_discount' => ['nullable', 'numeric', 'min:0'],
            'order_date' => ['nullable', 'date'],
            'source_reference' => ['nullable', 'string', 'max:150'],
            'priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'status' => ['nullable', 'string', 'max:50'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'customer_note' => ['nullable', 'string', 'max:2000'],
            'admin_note' => ['nullable', 'string', 'max:2000'],
            'terminal_id' => ['nullable', 'string', 'max:120'],
            'client_transaction_id' => ['nullable', 'uuid'],
            'offline_created_at' => ['nullable', 'date'],
        ]);


        $source = $data['source_channel'] === 'ecommerce' ? 'website' : $data['source_channel'];
        $paymentMethod = $data['payment_method'] === 'split' ? 'split' : (in_array($data['payment_method'], ['online', 'card', 'bkash', 'nagad', 'bank'], true) ? 'online' : 'cod');
        $shopId = (int) ($data['shop_id'] ?? $request->user()->shop_id ?? Shop::defaultStore()->id);

        if ($source !== 'pos' && isset($data['shipping_total']) && (float) $data['shipping_total'] <= 0) {
            return $this->error('Shipping charge must be greater than zero.', 422);
        }

        if ($source === 'social_commerce' && blank($data['customer_name'] ?? null) && blank($data['mobile_number'] ?? null)) {
            return $this->error('Enter a mobile number or customer name before saving the order.', 422);
        }

        if (! empty($data['client_transaction_id'])) {
            $existing = Order::query()
                ->where('shop_id', $shopId)
                ->where('client_transaction_id', $data['client_transaction_id'])
                ->first();
            if ($existing) {
                return $this->success($existing->load(['items.product', 'items.variant', 'payments']), 'Order already processed.');
            }
        }

        $payload = array_merge($data, [
            'source_channel' => $source,
            'price_mode' => $data['price_mode'] ?? 'retail',
            'shop_id' => $shopId,
            'created_by' => $request->user()->id,
            'customer_name' => $data['customer_name'] ?? ($source === 'pos' ? 'Walk-in Customer' : null),
            'checkout_name' => $data['customer_name'] ?? ($source === 'pos' ? 'Walk-in Customer' : null),
            'checkout_mobile_number' => $data['mobile_number'] ?? null,
            'checkout_email' => $data['email'] ?? null,
            'checkout_full_address' => $data['full_address'] ?? ($source === 'pos' ? 'Store counter sale' : null),
            'checkout_district' => $data['district'] ?? ($source === 'pos' ? 'Dhaka' : null),
            'payment_method' => $paymentMethod,
            'payment_channel' => $data['payment_channel'] ?? $data['payment_method'],
            'shipping_total' => $source === 'pos' ? 0 : ($data['shipping_total'] ?? config('hajjmart.default_delivery_charge', 80)),
            'terms_accepted' => true,
            'delivery_method' => 'home_delivery',
            'terminal_id' => $data['terminal_id'] ?? null,
            'client_transaction_id' => $data['client_transaction_id'] ?? null,
            'offline_created_at' => $data['offline_created_at'] ?? null,
            'synced_at' => ! empty($data['client_transaction_id']) ? now() : null,
        ]);

        try {
            $order = $this->orders->place($payload, $data['customer_id'] ?? null);
        } catch (Throwable $exception) {
            if ($source === 'social_commerce' && ! empty($data['terminal_id']) && ! empty($data['client_transaction_id'])) {
                $existing = Order::query()
                    ->where('source_channel', 'social_commerce')
                    ->where('shop_id', $shopId)
                    ->where('terminal_id', $data['terminal_id'])
                    ->where('client_transaction_id', $data['client_transaction_id'])
                    ->first();
                if ($existing) {
                    return $this->success($existing->load(['items.product', 'items.variant', 'payments']), 'Social order already synchronized.');
                }
            }

            throw $exception;
        }

        $this->activities->record('orders', 'created', "Created " . strtoupper(str_replace('_', ' ', $source)) . " order {$order->order_number}", $order, [], $order->toArray(), $request->user()->id, $shopId, $request);
        return $this->success($order, 'Manual order created.', 201);
    }

    public function collectPayment(Request $request, Order $order)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', Rule::in(['cash', 'bkash', 'nagad', 'card', 'bank', 'online', 'cod'])],
            'payment_reference' => ['nullable', 'string', 'max:150'],
            'paid_at' => ['nullable', 'date'],
        ]);

        try {
            $order = DB::transaction(function () use ($data, $order, $request): Order {
                $locked = Order::query()->lockForUpdate()->findOrFail($order->id);
                $remaining = round(max(0, (float) $locked->grand_total - (float) $locked->paid_amount), 2);
                $amount = round(min((float) $data['amount'], $remaining), 2);
                if ($amount <= 0) {
                    throw new RuntimeException('This order has no due amount.');
                }

                Payment::create([
                    'order_id' => $locked->id,
                    'payment_method' => $data['payment_method'],
                    'amount' => $amount,
                    'currency' => $locked->currency ?: 'BDT',
                    'status' => 'paid',
                    'paid_at' => $data['paid_at'] ?? now(),
                    'received_by' => $request->user()->id,
                    'payment_reference' => $data['payment_reference'] ?? null,
                ]);

                $netTotal = round(max(0, (float) $locked->grand_total - (float) $locked->refund_total), 2);
                $paid = round((float) $locked->paid_amount + $amount, 2);
                $due = round(max(0, $netTotal - $paid), 2);
                $locked->update([
                    'paid_amount' => $paid,
                    'due_amount' => $due,
                    'payment_status' => PaymentStatus::forOrder($paid, $netTotal),
                ]);

                return $locked->fresh([
                    'shop:id,name,code', 'creator:id,name', 'assignee:id,name', 'customer:id,name,email,phone',
                    'items.product:id,name,sku,slug,image_src', 'items.variant:id,sku', 'payments.receiver', 'returnRequests',
                ]);
            });
        } catch (RuntimeException $exception) {
            return $this->error($exception->getMessage(), 422);
        } catch (Throwable $exception) {
            report($exception);
            return $this->error('Payment could not be recorded. The payment transaction was rolled back safely.', 500);
        }

        try {
            $this->activities->record('orders', 'payment', "Collected payment for {$order->order_number}", $order, [], $data, request: $request);
        } catch (Throwable $exception) {
            report($exception);
        }

        return $this->success($order, 'Payment collected.');
    }

    public function createReturn(Request $request, Order $order)
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['return', 'exchange'])],
            'reason' => ['nullable', 'string', 'max:1000'],
            'customer_note' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.order_item_id' => ['required', 'integer', 'exists:order_items,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.exchange_product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.exchange_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.reason' => ['nullable', 'string', 'max:1000'],
            'items.*.condition_note' => ['nullable', 'string', 'max:1000'],
            'payment_method' => ['nullable', 'string'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_reference' => ['nullable', 'string', 'max:255'],
        ]);
        $return = $this->returns->request($order, $data, $order->customer_id, $request->user()->id);
        $return->update(['shop_id' => $order->shop_id, 'created_by' => $request->user()->id]);
        $this->activities->record('returns', 'created', "Created {$data['type']} request for {$order->order_number}", $return, [], $return->toArray(), request: $request);
        return $this->success($return->fresh(['items.orderItem.product']), 'Return/exchange request created.', 201);
    }

    public function markPrinted(Request $request)
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1'],
            'order_ids.*' => ['required', 'integer', 'exists:orders,id'],
        ]);

        $now = now();
        Order::query()
            ->whereIn('id', $data['order_ids'])
            ->update(['invoice_printed_at' => $now]);

        return $this->success([
            'updated_ids' => $data['order_ids'],
            'invoice_printed_at' => $now->toIso8601String(),
        ], 'Invoices marked as printed.');
    }

    public function sendToPathao(Request $request, Order $order, \App\Services\PathaoService $pathao)
    {
        try {
            $result = $pathao->sendOrderToPathao($order);
            return $this->success($result, $result['message']);
        } catch (\Throwable $exception) {
            return $this->error($exception->getMessage(), 422);
        }
    }

    public function bulkSendToPathao(Request $request, \App\Services\PathaoService $pathao)
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1'],
            'order_ids.*' => ['required', 'integer', 'exists:orders,id'],
        ]);

        $orders = Order::query()->whereIn('id', $data['order_ids'])->with('shop')->get();
        $results = [];

        foreach ($orders as $index => $order) {
            try {
                $res = $pathao->sendOrderToPathao($order);
                $results[] = [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'success' => true,
                    'consignment_id' => $res['consignment_id'],
                    'message' => $res['message'],
                ];
            } catch (\Throwable $exception) {
                $results[] = [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'success' => false,
                    'error' => $exception->getMessage(),
                ];
            }

            if ($index < count($orders) - 1) {
                usleep(3200000); // 3.2s pacing (19 requests / min)
            }
        }

        return $this->success($results, 'Bulk send to Pathao completed.');
    }
}
