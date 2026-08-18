<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domains\Accounting\Services\OperationalPostingService;
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
        private OperationalPostingService $accounting,
    ) {}

    public function index(Request $request)
    {
        $orders = Order::query()
            ->with([
                'shop:id,name,code', 'creator:id,name', 'assignee:id,name', 'customer:id,name,email,phone',
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
            ->when($request->source_channel, fn ($q, $source) => $q->where('source_channel', $source))
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->payment_status, fn ($q, $status) => $q->where('payment_status', $status))
            ->when($request->district, fn ($q, $district) => $q->where('checkout_district', $district))
            ->when($request->from, fn ($q, $from) => $q->whereDate(DB::raw('COALESCE(order_date, created_at)'), '>=', $from))
            ->when($request->to, fn ($q, $to) => $q->whereDate(DB::raw('COALESCE(order_date, created_at)'), '<=', $to))
            ->orderByDesc(DB::raw('COALESCE(order_date, created_at)'))
            ->paginate(max(1, min(250, (int) $request->get('per_page', 50))));

        return $this->success($orders, 'Unified orders retrieved.');
    }

    public function show(Order $order)
    {
        return $this->success($order->load([
            'shop', 'creator', 'assignee', 'customer', 'items.product', 'items.variant', 'payments.receiver',
            'statusHistory', 'returnRequests.items.orderItem.product', 'couponApplications',
        ]), 'Order retrieved.');
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
            'payment_method' => ['required', Rule::in(['cash', 'cod', 'card', 'bkash', 'nagad', 'bank', 'online'])],
            'payment_channel' => ['nullable', 'string', 'max:50'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_reference' => ['nullable', 'string', 'max:150'],
            'shipping_total' => ['nullable', 'numeric', 'min:0'],
            'manual_discount' => ['nullable', 'numeric', 'min:0'],
            'coupon_code' => ['nullable', 'string', 'max:100'],
            'coupon_codes' => ['nullable', 'array'],
            'coupon_codes.*' => ['string', 'max:100'],
            'order_date' => ['nullable', 'date'],
            'source_reference' => ['nullable', 'string', 'max:150'],
            'priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'status' => ['nullable', 'string', 'max:50'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'customer_note' => ['nullable', 'string', 'max:2000'],
            'admin_note' => ['nullable', 'string', 'max:2000'],
        ]);

        if ((float) ($data['manual_discount'] ?? 0) > 0 && ! $request->user()->hasPermission('orders.discount')) {
            abort(403, 'You do not have permission to apply manual order discounts.');
        }

        $source = $data['source_channel'] === 'ecommerce' ? 'website' : $data['source_channel'];
        $paymentMethod = in_array($data['payment_method'], ['online', 'card', 'bkash', 'nagad', 'bank'], true) ? 'online' : 'cod';
        $shopId = (int) ($data['shop_id'] ?? $request->user()->shop_id ?? Shop::defaultStore()->id);

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
        ]);

        $order = $this->orders->place($payload, $data['customer_id'] ?? null);
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

                $paid = round(min((float) $locked->grand_total, (float) $locked->paid_amount + $amount), 2);
                $due = round(max(0, (float) $locked->grand_total - $paid), 2);
                $locked->update([
                    'paid_amount' => $paid,
                    'due_amount' => $due,
                    'payment_status' => $due <= 0 ? 'paid' : 'partial',
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

        // The operational payment must not be reported as failed just because an
        // accounting rule needs repair. Paid POS orders are idempotently backfilled
        // by AccountingOperationalBackfillSeeder on the next launcher run.
        if ($order->source_channel === 'pos' && $order->payment_status === 'paid') {
            try {
                $this->accounting->postCompletedPosSale($order);
            } catch (Throwable $exception) {
                report($exception);
            }
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
        ]);
        $return = $this->returns->request($order, $data, $order->customer_id, $request->user()->id);
        $return->update(['shop_id' => $order->shop_id, 'created_by' => $request->user()->id]);
        $this->activities->record('returns', 'created', "Created {$data['type']} request for {$order->order_number}", $return, [], $return->toArray(), request: $request);
        return $this->success($return->fresh(['items.orderItem.product']), 'Return/exchange request created.', 201);
    }
}
