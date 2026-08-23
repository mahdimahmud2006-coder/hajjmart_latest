<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\InventoryConflictException;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Shop;
use App\Services\ActivityLogService;
use App\Services\OrderService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Throwable;

class PosController extends Controller
{
    use ApiResponse;

    public function __construct(
        private OrderService $orders,
        private ActivityLogService $activities,
    ) {}

    public function ping(Request $request)
    {
        return $this->success([
            'server_time' => now()->toIso8601String(),
            'user_id' => $request->user()->id,
        ], 'POS backend reachable.');
    }

    public function bootstrap(Request $request)
    {
        $data = $request->validate([
            'shop_id' => ['required', 'integer', 'exists:shops,id'],
        ]);

        $shopId = (int) $data['shop_id'];
        $products = Product::query()
            ->with([
                'primaryCategory', 'categories', 'productImages',
                'inventory' => fn ($q) => $q->where('shop_id', $shopId),
                'productVariants' => fn ($q) => $q->where('is_active', true),
                'productVariants.inventory' => fn ($q) => $q->where('shop_id', $shopId),
            ])
            ->where('is_active', true)
            ->where(function ($stock) use ($shopId): void {
                $positive = fn ($q) => $q->where('shop_id', $shopId)->whereRaw('quantity - reserved > 0');
                $stock->whereHas('inventory', $positive)
                    ->orWhereHas('productVariants.inventory', $positive);
            })
            ->orderBy('name')
            ->get();

        return $this->success([
            'shop_id' => $shopId,
            'generated_at' => now()->toIso8601String(),
            'products' => $products,
        ], 'POS offline catalogue prepared.');
    }

    public function sync(Request $request)
    {
        $data = $request->validate([
            'terminal_id' => ['required', 'string', 'max:120'],
            'sales' => ['required', 'array', 'min:1', 'max:100'],
            'sales.*.client_transaction_id' => ['required', 'uuid'],
            'sales.*.shop_id' => ['required', 'integer', 'exists:shops,id'],
            'sales.*.price_mode' => ['required', Rule::in(['retail', 'wholesale'])],
            'sales.*.items' => ['required', 'array', 'min:1'],
            'sales.*.items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'sales.*.items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'sales.*.items.*.quantity' => ['required', 'integer', 'min:1'],
            'sales.*.items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'sales.*.customer_name' => ['nullable', 'string', 'max:150'],
            'sales.*.mobile_number' => ['nullable', 'string', 'max:30'],
            'sales.*.payment_method' => ['required', Rule::in(['cash', 'bkash', 'nagad', 'card'])],
            'sales.*.paid_amount' => ['nullable', 'numeric', 'min:0'],
            'sales.*.payment_reference' => ['nullable', 'string', 'max:150'],
            'sales.*.manual_discount' => ['nullable', 'numeric', 'min:0'],
            'sales.*.offline_created_at' => ['required', 'date'],
        ]);

        $results = [];
        foreach ($data['sales'] as $sale) {
            $clientId = $sale['client_transaction_id'];
            $shopId = (int) $sale['shop_id'];

            $existing = Order::query()
                ->where('shop_id', $shopId)
                ->where('terminal_id', $data['terminal_id'])
                ->where('client_transaction_id', $clientId)
                ->first();

            if ($existing) {
                $results[] = $this->syncedResult($clientId, $existing, true);
                continue;
            }


            try {
                $this->assertOfflinePricesStillValid($sale);

                $payload = array_merge($sale, [
                    'source_channel' => 'pos',
                    'terminal_id' => $data['terminal_id'],
                    'client_transaction_id' => $clientId,
                    'created_by' => $request->user()->id,
                    'customer_name' => $sale['customer_name'] ?? 'Walk-in Customer',
                    'checkout_name' => $sale['customer_name'] ?? 'Walk-in Customer',
                    'checkout_mobile_number' => $sale['mobile_number'] ?? null,
                    'checkout_full_address' => 'Store counter sale',
                    'checkout_district' => 'Dhaka',
                    'payment_method' => $sale['payment_method'] === 'cash' ? 'cod' : 'online',
                    'payment_channel' => $sale['payment_method'],
                    'gateway' => $sale['payment_method'] === 'cash' ? null : $sale['payment_method'],
                    'shipping_total' => 0,
                    'terms_accepted' => true,
                    'delivery_method' => 'home_delivery',
                    'status' => 'delivered',
                    'source_reference' => "POS-OFFLINE:{$data['terminal_id']}:{$clientId}",
                    'offline_created_at' => $sale['offline_created_at'],
                    'synced_at' => now(),
                    'order_date' => $sale['offline_created_at'],
                ]);

                $order = $this->orders->place($payload, null);
                $this->activities->record(
                    'orders',
                    'offline_pos_sync',
                    "Synced offline POS order {$order->order_number}",
                    $order,
                    [],
                    ['client_transaction_id' => $clientId, 'terminal_id' => $data['terminal_id']],
                    $request->user()->id,
                    $shopId,
                    $request,
                );
                $results[] = $this->syncedResult($clientId, $order, false);
            } catch (Throwable $exception) {
                // A concurrent retry may have inserted the idempotency key after
                // the initial lookup. Return that order instead of duplicating it.
                $existing = Order::query()
                    ->where('shop_id', $shopId)
                    ->where('terminal_id', $data['terminal_id'])
                    ->where('client_transaction_id', $clientId)
                    ->first();
                if ($existing) {
                    $results[] = $this->syncedResult($clientId, $existing, true);
                    continue;
                }

                $technicalMessage = $exception->getMessage();
                $normalizedMessage = strtolower($technicalMessage);
                $isStockConflict = str_contains($normalizedMessage, 'stock')
                    || str_contains($normalizedMessage, 'available')
                    || str_contains($normalizedMessage, 'inventory');
                $isPriceConflict = str_contains($normalizedMessage, 'price conflict');
                $message = $isStockConflict
                    ? 'Stock changed before this saved sale could synchronize. Open Fix Sale, review the items, then charge again.'
                    : ($isPriceConflict
                        ? 'A product price changed before this saved sale could synchronize. Open Fix Sale and review the current price.'
                        : 'This saved sale could not be synchronized. Review it and try again.');

                report($exception);
                $results[] = [
                    'client_transaction_id' => $clientId,
                    'status' => ($isStockConflict || $isPriceConflict) ? 'conflict' : 'failed',
                    'message' => $message,
                    'reason_code' => $exception instanceof InventoryConflictException ? $exception->reasonCode : null,
                ];
            }
        }

        return $this->success([
            'terminal_id' => $data['terminal_id'],
            'synced_at' => now()->toIso8601String(),
            'results' => $results,
        ], 'POS synchronization processed.');
    }


    private function assertOfflinePricesStillValid(array $sale): void
    {
        $mode = $sale['price_mode'] === 'wholesale' ? 'wholesale' : 'retail';
        foreach ($sale['items'] as $item) {
            $product = Product::findOrFail((int) $item['product_id']);
            $variant = ! empty($item['variant_id']) ? ProductVariant::findOrFail((int) $item['variant_id']) : null;
            if ($variant && (int) $variant->product_id !== (int) $product->id) {
                throw new \RuntimeException('Price conflict: the selected variant no longer belongs to this product.');
            }

            $authoritative = $mode === 'wholesale'
                ? ($variant?->wholesale_price ?? $product->wholesale_price ?? $variant?->retail_price ?? $variant?->sale_price ?? $variant?->price ?? $variant?->regular_price ?? $product->retail_price ?? $product->selling_price ?? $product->regular_price ?? 0)
                : ($variant?->retail_price ?? $variant?->sale_price ?? $variant?->price ?? $variant?->regular_price ?? $product->retail_price ?? $product->selling_price ?? $product->regular_price ?? 0);

            if (abs((float) $authoritative - (float) $item['unit_price']) > 0.009) {
                throw new \RuntimeException(sprintf(
                    'Price conflict: %s changed from %.2f to %.2f while this terminal was offline.',
                    $product->name,
                    (float) $item['unit_price'],
                    (float) $authoritative,
                ));
            }
        }
    }

    private function syncedResult(string $clientId, Order $order, bool $duplicate): array
    {
        return [
            'client_transaction_id' => $clientId,
            'status' => 'synced',
            'duplicate' => $duplicate,
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'grand_total' => $order->grand_total,
        ];
    }
}
