<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\CustomerCartItem;
use App\Services\CancellationService;
use App\Services\OrderService;
use App\Services\PaymentService;
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
        private PaymentService $payments,
        private ReturnService $returns,
        private CancellationService $cancellations
    ) {}

    public function checkoutOptions()
    {
        return $this->success([
            'country' => config('hajjmart.country', 'Bangladesh'),
            'currency' => config('hajjmart.currency', 'BDT'),
            'currency_symbol' => config('hajjmart.currency_symbol', '৳'),
            'default_delivery_charge' => config('hajjmart.default_delivery_charge', 80),
            'districts' => config('hajjmart.districts', []),
            'payment_methods' => config('hajjmart.payment_methods', []),
            'checkout_fields' => [
                'name', 'mobile_number', 'email', 'district', 'upazila_thana', 'full_address',
                'payment_method', 'coupon_code', 'customer_note', 'checkout_idempotency_key', 'terms_accepted',
            ],
            'promotion_support' => [
                'public_sales' => true,
                'private_coupons' => true,
                'compound_coupons' => 'Only coupons/promotions marked stackable can combine.',
                'return_exchange_policy' => 'Refund/exchange credit uses net paid amount after prorated coupon allocation.',
            ],
        ], 'Checkout options retrieved.');
    }

    public function quote(Request $request)
    {
        $districts = config('hajjmart.districts', []);
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'district' => ['required', 'string', Rule::in($districts)],
            'coupon_code' => ['nullable', 'string', 'max:100'],
            'payment_method' => ['required', 'string', Rule::in(['cod', 'online', 'COD', 'Online'])],
        ]);
        $data['payment_method'] = strtolower((string) $data['payment_method']);

        try {
            $quote = $this->orders->quoteCheckout($data, auth('sanctum')->user()?->id);
        } catch (RuntimeException $exception) {
            return $this->error($exception->getMessage(), 422);
        }

        return $this->success($quote, 'Checkout quote retrieved.');
    }

    public function checkoutStatus(string $orderNumber)
    {
        $order = Order::query()
            ->where('source_channel', 'website')
            ->where('order_number', $orderNumber)
            ->firstOrFail(['id', 'order_number', 'status', 'payment_status', 'payment_method']);

        $isCod = strtolower((string) $order->payment_method) === 'cod';
        $confirmed = $isCod
            ? $order->status === \App\Enums\OrderStatus::CONFIRMED->value
            : ($order->status === \App\Enums\OrderStatus::CONFIRMED->value
                && $order->payment_status === \App\Enums\PaymentStatus::PAID->value);

        return $this->success([
            'order_number' => $order->order_number,
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'payment_method' => $order->payment_method,
            'confirmed' => $confirmed,
        ], 'Checkout status retrieved.');
    }

    public function trackOrder(Request $request)
    {
        $data = $request->validate([
            'mobile_number' => ['required', 'string', 'regex:/^(?:\+?88)?01[3-9]\d{8}$/'],
        ], [
            'mobile_number.regex' => 'Enter an 11-digit Bangladesh mobile number.',
        ]);

        $mobile = preg_replace('/^(?:\+?88)/', '', preg_replace('/[\s-]+/', '', (string) $data['mobile_number']));
        $mobileVariants = [$mobile, '88'.$mobile, '+88'.$mobile];
        $statusRank = [
            'pending' => 0,
            'confirmed' => 1,
            'processing' => 2,
            'ready_to_ship' => 2,
            'shipped' => 3,
            'out_for_delivery' => 3,
            'delivered' => 4,
            'return_requested' => 4,
            'returned' => 4,
            'refunded' => 4,
        ];

        $orders = Order::query()
            ->select([
                'id', 'order_number', 'status', 'payment_status', 'payment_method',
                'grand_total', 'placed_at', 'created_at', 'confirmed_at', 'shipped_at',
                'delivered_at', 'cancelled_at',
            ])
            ->with(['statusHistory:id,order_id,to_status,created_at'])
            ->withCount('items')
            ->where('source_channel', 'website')
            ->where(function ($query) use ($mobileVariants): void {
                $query->whereIn(DB::raw("REPLACE(REPLACE(checkout_mobile_number, ' ', ''), '-', '')"), $mobileVariants);
            })
            ->where(function ($query): void {
                $query->where('placed_at', '>=', now()->subDays(180))
                    ->orWhere(function ($fallback): void {
                        $fallback->whereNull('placed_at')->where('created_at', '>=', now()->subDays(180));
                    });
            })
            ->orderByDesc(DB::raw('COALESCE(placed_at, created_at)'))
            ->limit(20)
            ->get();

        $payload = $orders->map(function (Order $order) use ($statusRank): array {
            $iso = fn ($value) => $value?->toISOString();
            $historyAt = fn (string $status) => $iso($order->statusHistory->firstWhere('to_status', $status)?->created_at);
            $currentRank = $statusRank[$order->status] ?? -1;
            $cancelled = $order->status === \App\Enums\OrderStatus::CANCELLED->value;
            $steps = [
                ['step' => 'placed', 'at' => $iso($order->placed_at ?? $order->created_at), 'done' => true],
                ['step' => 'confirmed', 'at' => $iso($order->confirmed_at) ?? $historyAt('confirmed'), 'done' => ! $cancelled && $currentRank >= 1],
                ['step' => 'processing', 'at' => $historyAt('processing'), 'done' => ! $cancelled && $currentRank >= 2],
                ['step' => 'shipped', 'at' => $iso($order->shipped_at) ?? $historyAt('shipped'), 'done' => ! $cancelled && $currentRank >= 3],
                ['step' => 'delivered', 'at' => $iso($order->delivered_at) ?? $historyAt('delivered'), 'done' => ! $cancelled && $currentRank >= 4],
            ];

            return [
                'order_number' => $order->order_number,
                'placed_at' => $iso($order->placed_at ?? $order->created_at),
                'status' => $order->status,
                'payment_status' => $order->payment_status,
                'payment_method' => $order->payment_method,
                'grand_total' => (float) $order->grand_total,
                'items_count' => (int) $order->items_count,
                'cancelled_at' => $iso($order->cancelled_at),
                'timeline' => $steps,
            ];
        })->values();

        return $this->success(['orders' => $payload], 'Order progress retrieved.');
    }

    public function storeGuest(Request $request)
    {
        $data = $this->validatedCheckout($request);
        try {
            $order = $this->orders->place($this->customerOrderCommand($data), null);
        } catch (RuntimeException $exception) {
            return $this->error($exception->getMessage(), 422);
        }
        return $this->success($this->checkoutResponse($order), 'Order placed successfully.', 201);
    }

    public function store(Request $request)
    {
        $data = $this->validatedCheckout($request);
        try {
            $order = $this->orders->place($this->customerOrderCommand($data), $request->user()?->id);
        } catch (RuntimeException $exception) {
            return $this->error($exception->getMessage(), 422);
        }
        if ($request->user()) {
            CustomerCartItem::where('user_id', $request->user()->id)->delete();
        }
        return $this->success($this->checkoutResponse($order), 'Order placed successfully.', 201);
    }

    public function index(Request $request)
    {
        $orders = Order::with('items.product', 'payments')
            ->where('customer_id', $request->user()->id)
            ->latest()
            ->paginate((int) $request->get('per_page', 20));

        return $this->success($orders, 'Orders retrieved.');
    }

    public function show(Request $request, string $orderNumber)
    {
        $order = Order::with('items.product', 'payments', 'statusHistory')
            ->where('order_number', $orderNumber)
            ->orWhere('order_id', $orderNumber)
            ->firstOrFail();

        abort_unless($request->user()->role === 'admin' || $order->customer_id === $request->user()->id, 403);
        return $this->success($order, 'Order retrieved.');
    }

    public function cancel(Request $request, string $orderNumber)
    {
        $order = Order::where('order_number', $orderNumber)->orWhere('order_id', $orderNumber)->firstOrFail();
        abort_unless($request->user()->role === 'admin' || $order->customer_id === $request->user()->id, 403);
        return $this->success($this->orders->cancel($order, $request->user()->id, $request->input('reason')), 'Order cancelled.');
    }

    public function returnExchange(Request $request, string $orderNumber)
    {
        $order = Order::where('order_number', $orderNumber)->orWhere('order_id', $orderNumber)->firstOrFail();
        abort_unless($request->user()->role === 'admin' || $order->customer_id === $request->user()->id, 403);
        $data = $request->validate([
            'type' => ['required', 'in:return,exchange'],
            'reason' => ['nullable', 'string'],
            'customer_note' => ['nullable', 'string'],
            'items' => ['required', 'array'],
            'items.*.order_item_id' => ['required', 'integer', 'exists:order_items,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.exchange_product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.exchange_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.reason' => ['nullable', 'string', 'max:1000'],
            'items.*.condition_note' => ['nullable', 'string', 'max:1000'],
        ]);
        return $this->success($this->returns->request($order, $data, $request->user()->id), 'Return/exchange requested.', 201);
    }

    public function adminIndex(Request $request)
    {
        $orders = Order::with('customer', 'items.product', 'payments')
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->district, fn ($q, $district) => $q->where('checkout_district', $district))
            ->when($request->from, fn ($q, $from) => $q->whereDate('created_at', '>=', $from))
            ->when($request->to, fn ($q, $to) => $q->whereDate('created_at', '<=', $to))
            ->latest()
            ->paginate((int) $request->get('per_page', 20));

        return $this->success($orders, 'Admin orders retrieved.');
    }

    public function updateStatus(Request $request, Order $order)
    {
        $data = $request->validate([
            'status' => ['required', 'string'],
            'note' => ['nullable', 'string'],
            'force' => ['nullable', 'boolean'],
        ]);
        try {
            $updated = $data['status'] === 'cancelled'
                ? $this->orders->cancel($order, $request->user()->id, $data['note'] ?? 'Cancelled from admin order workflow')
                : $this->orders->transition($order, $data['status'], $request->user()->id, $data['note'] ?? null, (bool) ($data['force'] ?? false));
        } catch (RuntimeException $exception) {
            return $this->error($exception->getMessage(), 422);
        } catch (Throwable $exception) {
            report($exception);
            return $this->error('Order workflow could not be updated. The operation was rolled back safely.', 500);
        }

        return $this->success($updated, 'Order status updated.');
    }

    private function validatedCheckout(Request $request): array
    {
        $districts = config('hajjmart.districts', []);
        return $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'name' => ['required', 'string', 'max:150'],
            'mobile_number' => ['required', 'string', 'regex:/^(?:\+?88)?01[3-9]\d{8}$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'district' => ['required', 'string', Rule::in($districts)],
            'upazila_thana' => ['nullable', 'string', 'max:150'],
            'full_address' => ['required', 'string', 'max:1000'],
            'payment_method' => ['required', 'string', Rule::in(['cod', 'online', 'COD', 'Online'])],
            'coupon_code' => ['nullable', 'string', 'max:100'],
            'customer_note' => ['nullable', 'string', 'max:2000'],
            'checkout_idempotency_key' => ['required', 'uuid'],
            'terms_accepted' => ['required', 'accepted'],
        ], [
            'mobile_number.regex' => 'Enter an 11-digit Bangladesh mobile number.',
        ]);
    }

    private function customerOrderCommand(array $data): array
    {
        return array_merge($data, [
            'payment_method' => strtolower((string) $data['payment_method']),
            'source_channel' => 'website',
            'price_mode' => 'retail',
            'delivery_method' => 'home_delivery',
            'paid_amount' => 0,
        ]);
    }

    private function checkoutResponse(Order $order): array
    {
        $paymentRequired = strtolower((string) $order->payment_method) !== 'cod';
        $redirectUrl = null;
        if ($paymentRequired) {
            $redirectUrl = $this->payments->initiate($order)['redirect_url'] ?? null;
            if (! $redirectUrl) {
                throw new \RuntimeException('The payment gateway did not return a redirect URL.');
            }
        }

        return [
            'order_number' => $order->order_number,
            'payment_required' => $paymentRequired,
            'redirect_url' => $redirectUrl,
            'mobile_number' => $order->checkout_mobile_number,
        ];
    }

}
