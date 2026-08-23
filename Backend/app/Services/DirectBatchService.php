<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\Shop;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class DirectBatchService
{
    public function __construct(private InventoryService $inventory) {}

    public function receive(array $data, ?int $actorId = null): array
    {
        return DB::transaction(function () use ($data, $actorId): array {
            $shop = Shop::query()->findOrFail((int) $data['shop_id']);
            $reference = $this->reference();
            $note = $data['note'] ?? null;
            $receivedAt = now();
            $received = [];
            $seen = [];

            foreach ($data['items'] as $line) {
                $product = Product::query()->lockForUpdate()->findOrFail((int) $line['product_id']);
                if (! $product->is_active) {
                    throw new RuntimeException("{$product->name} is inactive and cannot receive stock.");
                }

                $variant = null;
                $variantId = isset($line['variant_id']) && $line['variant_id'] !== null
                    ? (int) $line['variant_id']
                    : null;

                $lineKey = $product->id . ':' . ($variantId ?? 0);
                if (isset($seen[$lineKey])) {
                    throw new RuntimeException("{$product->name} appears more than once in this batch. Combine duplicate lines before confirming.");
                }
                $seen[$lineKey] = true;

                if ($variantId !== null) {
                    $variant = ProductVariant::query()->lockForUpdate()->findOrFail($variantId);
                    if ((int) $variant->product_id !== (int) $product->id || ! $variant->is_active) {
                        throw new RuntimeException("The selected active variation does not belong to {$product->name}.");
                    }
                } elseif ($product->productVariants()->where('is_active', true)->exists()) {
                    throw new RuntimeException("Choose a variation for {$product->name}.");
                }

                $quantity = (int) $line['quantity'];
                $costPrice = round((float) $line['cost_price'], 2);
                $retailPrice = round((float) ($line['retail_price'] ?? $variant?->retail_price ?? $variant?->sale_price ?? $product->retail_price ?? $product->selling_price ?? 0), 2);
                $wholesalePrice = round((float) ($line['wholesale_price'] ?? $variant?->wholesale_price ?? $product->wholesale_price ?? $retailPrice), 2);

                $batch = ProductBatch::query()->create([
                    'product_id' => $product->id,
                    'variant_id' => $variant?->id,
                    'shop_id' => $shop->id,
                    'batch_reference' => $reference,
                    'count' => $quantity,
                    'initial_quantity' => $quantity,
                    'cost_price' => $costPrice,
                    'selling_price' => $retailPrice,
                    'retail_price' => $retailPrice,
                    'wholesale_price' => $wholesalePrice,
                    'created_by' => $actorId,
                    'note' => $note,
                    'received_at' => $receivedAt,
                ]);

                $inventory = $this->inventory->receiveBatch($batch, $actorId);

                $product->update([
                    'cost_price' => $costPrice,
                    'stock_status' => 'in_stock',
                    'purchasable' => true,
                ]);

                if ($variant) {
                    $variant->update([
                        'cost_price' => $costPrice,
                        'in_stock' => true,
                        'purchasable' => true,
                        'available_for_purchase' => true,
                    ]);
                }

                $product->updateTotalCount();

                $received[] = [
                    'batch_id' => $batch->id,
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'sku' => $variant?->sku ?: $product->sku,
                    'variant_id' => $variant?->id,
                    'quantity' => $quantity,
                    'cost_price' => $costPrice,
                    'selling_price' => $retailPrice,
                    'retail_price' => $retailPrice,
                    'wholesale_price' => $wholesalePrice,
                    'inventory_id' => $inventory->id,
                    'physical_stock' => $inventory->quantity,
                    'available_stock' => $inventory->available,
                ];
            }

            return [
                'batch_reference' => $reference,
                'shop' => $shop->only(['id', 'name', 'code']),
                'line_count' => count($received),
                'total_units' => collect($received)->sum('quantity'),
                'total_cost_value' => round((float) collect($received)->sum(fn (array $line) => $line['quantity'] * $line['cost_price']), 2),
                'received_at' => $receivedAt->toIso8601String(),
                'items' => $received,
            ];
        }, 3);
    }

    public function updatePrices(ProductBatch $batch, array $data): ProductBatch
    {
        return DB::transaction(function () use ($batch, $data): ProductBatch {
            $batch = ProductBatch::query()->lockForUpdate()->findOrFail($batch->id);
            $product = Product::query()->lockForUpdate()->findOrFail((int) $batch->product_id);
            $variant = $batch->variant_id
                ? ProductVariant::query()->lockForUpdate()->findOrFail((int) $batch->variant_id)
                : null;

            $costPrice = round((float) $data['cost_price'], 2);

            $updates = [
                'cost_price' => $costPrice,
                'note' => array_key_exists('note', $data) ? $data['note'] : $batch->note,
            ];
            if (isset($data['retail_price'])) {
                $updates['retail_price'] = round((float) $data['retail_price'], 2);
                $updates['selling_price'] = $updates['retail_price'];
            }
            if (isset($data['wholesale_price'])) {
                $updates['wholesale_price'] = round((float) $data['wholesale_price'], 2);
            }

            $batch->update($updates);

            $product->update(['cost_price' => $costPrice]);
            if ($variant) {
                $variant->update(['cost_price' => $costPrice]);
            }

            return $batch->fresh(['product', 'variant', 'shop', 'creator']);
        }, 3);
    }

    private function reference(): string
    {
        return 'BATCH-' . now()->format('Ymd-His') . '-' . Str::upper(Str::random(5));
    }
}
