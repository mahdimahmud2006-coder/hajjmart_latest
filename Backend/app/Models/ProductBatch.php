<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class ProductBatch extends Model
{
    protected $fillable = [
        'product_id',
        'variation_id',
        'variant_id',
        'shop_id',
        'batch_reference',
        'count',
        'initial_quantity',
        'cost_price',
        'selling_price',
        'retail_price',
        'wholesale_price',
        'created_by',
        'note',
        'received_at',
    ];

    protected $casts = [
        'count' => 'integer',
        'initial_quantity' => 'integer',
        'cost_price' => 'decimal:4',
        'selling_price' => 'decimal:2',
        'retail_price' => 'decimal:2',
        'wholesale_price' => 'decimal:2',
        'received_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** Legacy variation relationship retained for old order records. */
    public function variation(): BelongsTo
    {
        return $this->belongsTo(Variation::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function addInventory(Product $product, float $costPrice, int $quantity, ?int $variationId = null): void
    {
        $costPrice = round($costPrice, 2);
        $existingBatch = $product->productBatches()
            ->whereNull('shop_id')
            ->where('variation_id', $variationId)
            ->whereRaw('ROUND(cost_price, 2) = ?', [$costPrice])
            ->first();

        if ($existingBatch) {
            $existingBatch->increment('count', $quantity);
            $existingBatch->increment('initial_quantity', $quantity);
        } else {
            $product->productBatches()->create([
                'variation_id' => $variationId,
                'cost_price' => $costPrice,
                'count' => $quantity,
                'initial_quantity' => $quantity,
                'batch_reference' => 'LEGACY-' . now()->format('YmdHis'),
                'received_at' => now(),
            ]);
        }

        $product->updateTotalCount();
    }

    public static function recordIncrease(
        int $productId,
        ?int $variantId,
        int $shopId,
        int $quantity,
        ?int $actorId = null,
        ?string $reference = null,
        ?string $note = null,
        ?float $costPrice = null,
        ?float $retailPrice = null,
        ?float $wholesalePrice = null,
    ): self {
        $product = Product::query()->findOrFail($productId);
        $variant = $variantId ? ProductVariant::query()->find($variantId) : null;
        $costPrice = round($costPrice ?? (float) ($variant?->cost_price ?? $product->cost_price ?? 0), 2);
        $retailPrice = round($retailPrice ?? (float) ($variant?->retail_price ?? $variant?->sale_price ?? $variant?->price ?? $product->retail_price ?? $product->selling_price ?? 0), 2);
        $wholesalePrice = round($wholesalePrice ?? (float) ($variant?->wholesale_price ?? $product->wholesale_price ?? $retailPrice), 2);

        $batch = self::query()->create([
            'product_id' => $productId,
            'variant_id' => $variantId,
            'shop_id' => $shopId,
            'batch_reference' => $reference ?: 'STOCK-' . now()->format('Ymd-His'),
            'count' => $quantity,
            'initial_quantity' => $quantity,
            'cost_price' => $costPrice,
            'selling_price' => $retailPrice,
            'retail_price' => $retailPrice,
            'wholesale_price' => $wholesalePrice,
            'created_by' => $actorId,
            'note' => $note,
            'received_at' => now(),
        ]);

        $product->updateTotalCount();
        if ($variant) {
            $variant->update([
                'in_stock' => true,
                'purchasable' => true,
                'available_for_purchase' => true,
            ]);
        }
        return $batch;
    }

    public static function consumeForInventory(int $productId, ?int $variantId, int $shopId, int $quantity): float
    {
        return DB::transaction(function () use ($productId, $variantId, $shopId, $quantity): float {
            $remaining = $quantity;
            $totalCost = 0.0;

            $batches = self::query()
                ->where('product_id', $productId)
                ->where('shop_id', $shopId)
                ->when($variantId, fn ($q) => $q->where('variant_id', $variantId), fn ($q) => $q->whereNull('variant_id'))
                ->where('count', '>', 0)
                ->orderByRaw('COALESCE(received_at, created_at) asc')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            foreach ($batches as $batch) {
                if ($remaining <= 0) break;
                $take = min($remaining, (int) $batch->count);
                $batch->count -= $take;
                $totalCost += $take * (float) $batch->cost_price;
                $remaining -= $take;
                $batch->count = max(0, (int) $batch->count);
                $batch->save();
            }

            // Existing installations may still contain inventory that predates direct batches.
            // Preserve a valid sale/transfer while using the current master cost only for that legacy remainder.
            if ($remaining > 0) {
                $product = Product::query()->find($productId);
                $variant = $variantId ? ProductVariant::query()->find($variantId) : null;
                $totalCost += $remaining * (float) ($variant?->cost_price ?? $product?->cost_price ?? 0);
            }

            Product::query()->find($productId)?->updateTotalCount();
            if ($variantId) {
                $remainingVariantStock = (int) self::query()
                    ->where('variant_id', $variantId)
                    ->sum('count');
                ProductVariant::query()->whereKey($variantId)->update([
                    'in_stock' => $remainingVariantStock > 0,
                    'purchasable' => $remainingVariantStock > 0,
                    'available_for_purchase' => $remainingVariantStock > 0,
                ]);
            }
            return round($totalCost, 2);
        });
    }

    public static function removeInventory(Product $product, int $productBatchId, int $qty): void
    {
        $batch = self::query()->findOrFail($productBatchId);
        if ((int) $batch->product_id !== (int) $product->id) return;

        $batch->count = max(0, (int) $batch->count - $qty);
        $batch->save();
        $product->updateTotalCount();
    }

    public static function deleteProductBatch(Product $product, $productBatch): void
    {
        if (is_numeric($productBatch)) $productBatch = self::query()->find($productBatch);
        if ($productBatch && (int) $productBatch->product_id === (int) $product->id) {
            $productBatch->count = 0;
            $productBatch->save();
            $product->updateTotalCount();
        }
    }
}
