<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InventoryConflictException;
use App\Http\Controllers\Controller;
use App\Models\CustomerCartItem;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Shop;
use App\Services\OrderService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CartController extends Controller
{
    use ApiResponse;

    public function __construct(private OrderService $orders) {}

    public function index(Request $request)
    {
        return $this->success(['items' => $this->cartItems($request->user()->id)], 'Cart retrieved.');
    }

    public function sync(Request $request)
    {
        $data = $request->validate([
            'mode' => ['nullable', Rule::in(['replace', 'merge'])],
            'items' => ['present', 'array', 'max:100'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ]);
        $mode = $data['mode'] ?? 'replace';
        $userId = (int) $request->user()->id;

        DB::transaction(function () use ($data, $mode, $userId): void {
            if ($mode === 'replace') {
                CustomerCartItem::where('user_id', $userId)->delete();
            }

            foreach ($data['items'] as $item) {
                $variantId = $item['variant_id'] ?? null;
                if ($variantId) {
                    $belongs = ProductVariant::query()->whereKey($variantId)->where('product_id', $item['product_id'])->exists();
                    if (! $belongs) {
                        throw ValidationException::withMessages(['items' => ['A selected product variation does not belong to its product.']]);
                    }
                }

                $existing = CustomerCartItem::query()
                    ->where('user_id', $userId)
                    ->where('product_id', $item['product_id'])
                    ->where('variant_id', $variantId)
                    ->first();

                $quantity = (int) $item['quantity'];
                if ($existing && $mode === 'merge') {
                    $quantity = min(999, $existing->quantity + $quantity);
                }

                if ($existing) {
                    $existing->update(['quantity' => $quantity]);
                } else {
                    CustomerCartItem::create([
                        'user_id' => $userId,
                        'product_id' => $item['product_id'],
                        'variant_id' => $variantId,
                        'quantity' => $quantity,
                    ]);
                }
            }
        });

        return $this->success(['items' => $this->cartItems($userId)], 'Cart synchronized.');
    }

    public function clear(Request $request)
    {
        CustomerCartItem::where('user_id', $request->user()->id)->delete();
        return $this->success(['items' => []], 'Cart cleared.');
    }

    public function validateCart(Request $request)
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'payment_method' => ['nullable', 'string'],
            'district' => ['nullable', 'string'],
            'email' => ['nullable', 'email'],
            'mobile_number' => ['nullable', 'string'],
        ]);

        try {
            $validated = $this->orders->validateCart($data['items'], $data, $request->user()?->id);
        } catch (InventoryConflictException $exception) {
            return $this->error($exception->getMessage(), 409, [], $exception->reasonCode);
        }

        return $this->success($validated, 'Cart is valid.');
    }

    private function cartItems(int $userId): array
    {
        $shopId = Shop::defaultStore()->id;
        $rows = CustomerCartItem::with([
            'product.productImages',
            'variant',
        ])->where('user_id', $userId)->orderBy('id')->get();

        return $rows->map(function (CustomerCartItem $row) use ($shopId): ?array {
            $product = $row->product;
            if (! $product || ! $product->is_active) return null;
            $variant = $row->variant;
            $inventory = Inventory::query()
                ->where('shop_id', $shopId)
                ->where('product_id', $product->id)
                ->where('variant_id', $variant?->id)
                ->first();
            $available = $inventory ? max(0, (int) $inventory->quantity - (int) $inventory->reserved) : 0;
            $unitPrice = (float) ($variant?->retail_price
                ?? $variant?->sale_price
                ?? $variant?->price
                ?? $product->retail_price
                ?? $product->selling_price
                ?? 0);
            $regularPrice = (float) ($variant?->regular_price ?? $product->regular_price ?? $unitPrice);
            $attributes = $variant?->attribute_values ?? $variant?->attributes_json ?? [];
            $variantLabel = is_array($attributes) ? implode(' / ', array_filter(array_values($attributes))) : null;

            return [
                'key' => $product->id . ':' . ($variant?->id ?: 'base'),
                'productId' => (int) $product->id,
                'variantId' => $variant?->id,
                'slug' => (string) $product->slug,
                'name' => (string) $product->name,
                'image' => $product->primary_image_url,
                'unitPrice' => round($unitPrice, 2),
                'regularPrice' => round($regularPrice, 2),
                'quantity' => max(1, (int) $row->quantity),
                'maxStock' => $available,
                'variantLabel' => $variantLabel ?: ($variant?->sku ?: null),
            ];
        })->filter()->values()->all();
    }
}
