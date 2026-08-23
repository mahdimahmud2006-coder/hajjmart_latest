<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Exceptions\InventoryConflictException;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Shop;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class InventoryService
{
    public function validateItems(array $items, ?int $shopId = null, string $priceMode = 'retail', bool $allowAuthorizedUnitPrice = false): array
    {
        $shopId = $shopId ?: Shop::defaultStore()->id;
        $priceMode = strtolower($priceMode) === 'wholesale' ? 'wholesale' : 'retail';
        $validated = [];
        foreach ($items as $item) {
            $product = Product::with(['productVariants'])->findOrFail($item['product_id']);
            $variantId = $item['variant_id'] ?? null;
            $quantity = max(1, (int) ($item['quantity'] ?? 1));
            $variant = $variantId ? $product->productVariants->firstWhere('id', $variantId) : null;
            if ($variantId && ! $variant) {
                throw new RuntimeException("The selected variant is not available for {$product->name}.");
            }
            $inventory = $this->inventoryRow((int) $product->id, $variantId ? (int) $variantId : null, $shopId);
            if (($inventory->quantity - $inventory->reserved) < $quantity) {
                throw new InventoryConflictException('inventory_insufficient_available', "Insufficient stock for {$product->name} in the selected store.");
            }
            $unitPrice = $allowAuthorizedUnitPrice && array_key_exists('authorized_unit_price', $item)
                ? (float) $item['authorized_unit_price']
                : ($priceMode === 'wholesale'
                    ? (float) ($variant?->wholesale_price
                        ?? $product->wholesale_price
                        ?? $variant?->retail_price
                        ?? $variant?->sale_price
                        ?? $variant?->price
                        ?? $product->retail_price
                        ?? $product->selling_price
                        ?? 0)
                    : (float) ($variant?->retail_price
                        ?? $variant?->sale_price
                        ?? $variant?->price
                        ?? $product->retail_price
                        ?? $product->selling_price
                        ?? 0));
            $validated[] = compact('product', 'variant', 'inventory', 'quantity', 'unitPrice');
        }
        return $validated;
    }

    public function reserve(Inventory $inventory, int $quantity, ?object $reference = null, ?int $actorId = null): void
    {
        DB::transaction(function () use ($inventory, $quantity, $reference, $actorId): void {
            $row = Inventory::whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            if (($row->quantity - $row->reserved) < $quantity) throw new InventoryConflictException('inventory_insufficient_available', 'Insufficient stock in the selected store.');
            $row->increment('reserved', $quantity);
            $this->bumpShopRevision((int) $row->shop_id);
            $this->movement($row, StockMovementType::ADJUSTMENT->value, 0, 'Reserved stock', $reference, $actorId, 'reservation');
        });
    }

    public function releaseReservation(Inventory $inventory, int $quantity, ?object $reference = null, ?int $actorId = null): void
    {
        DB::transaction(function () use ($inventory, $quantity, $reference, $actorId): void {
            $row = Inventory::whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            if ($row->reserved < $quantity) {
                throw new InventoryConflictException('reservation_counter_inconsistent', 'Reserved stock could not be released because inventory is inconsistent.');
            }
            $row->reserved -= $quantity;
            $row->updated_at = now();
            $row->save();
            $this->bumpShopRevision((int) $row->shop_id);
            $this->movement($row, StockMovementType::ADJUSTMENT->value, 0, 'Released reserved stock', $reference, $actorId, 'reservation_release');
        });
    }

    public function commitReserved(Inventory $inventory, int $quantity, ?object $reference = null, ?int $actorId = null): float
    {
        return DB::transaction(function () use ($inventory, $quantity, $reference, $actorId): float {
            $row = Inventory::whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            if ($row->reserved < $quantity || $row->quantity < $quantity) {
                throw new InventoryConflictException('reservation_counter_inconsistent', 'Reserved stock could not be committed because inventory is inconsistent.');
            }

            $row->reserved -= $quantity;
            $row->quantity -= $quantity;
            $row->updated_at = now();
            $row->save();
            $this->bumpShopRevision((int) $row->shop_id);

            $totalCost = ProductBatch::consumeForInventory(
                (int) $row->product_id,
                $row->variant_id ? (int) $row->variant_id : null,
                (int) $row->shop_id,
                $quantity,
            );

            $this->movement($row, StockMovementType::SALE->value, -$quantity, 'Committed reserved stock', $reference, $actorId, 'sale');
            return $totalCost;
        });
    }

    public function decrement(Inventory $inventory, int $quantity, ?object $reference = null, ?int $actorId = null): float
    {
        return DB::transaction(function () use ($inventory, $quantity, $reference, $actorId): float {
            $row = Inventory::whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            if (($row->quantity - $row->reserved) < $quantity) throw new InventoryConflictException('inventory_insufficient_available', 'Insufficient stock in the selected store.');
            $row->quantity -= $quantity;
            $row->updated_at = now();
            $row->save();
            $this->bumpShopRevision((int) $row->shop_id);

            $totalCost = ProductBatch::consumeForInventory(
                (int) $row->product_id,
                $row->variant_id ? (int) $row->variant_id : null,
                (int) $row->shop_id,
                $quantity,
            );

            $this->movement($row, StockMovementType::SALE->value, -$quantity, 'Stock deducted', $reference, $actorId, 'sale');
            return $totalCost;
        });
    }

    public function increment(
        Inventory $inventory,
        int $quantity,
        string $type = 'return',
        ?object $reference = null,
        ?int $actorId = null,
        ?string $reasonCode = null,
        ?float $unitCost = null,
        ?float $retailPrice = null,
        ?float $wholesalePrice = null,
    ): void
    {
        DB::transaction(function () use ($inventory, $quantity, $type, $reference, $actorId, $reasonCode, $unitCost, $retailPrice, $wholesalePrice): void {
            $row = Inventory::whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            $row->quantity += $quantity;
            $row->updated_at = now();
            $row->save();
            $this->bumpShopRevision((int) $row->shop_id);

            // A direct batch already exists before its inventory movement is posted.
            if (! $reference instanceof ProductBatch) {
                ProductBatch::recordIncrease(
                    (int) $row->product_id,
                    $row->variant_id ? (int) $row->variant_id : null,
                    (int) $row->shop_id,
                    $quantity,
                    $actorId,
                    strtoupper($reasonCode ?: $type) . '-' . now()->format('Ymd-His'),
                    'Stock added from ' . str_replace('_', ' ', $reasonCode ?: $type),
                    $unitCost,
                    $retailPrice,
                    $wholesalePrice,
                );
            }

            $this->movement($row, $type, $quantity, 'Stock increased', $reference, $actorId, $reasonCode ?: $type);
        });
    }

    public function receiveBatch(ProductBatch $batch, ?int $actorId = null): Inventory
    {
        $inventory = $this->inventoryRow(
            (int) $batch->product_id,
            $batch->variant_id ? (int) $batch->variant_id : null,
            $batch->shop_id ? (int) $batch->shop_id : null,
        );

        $this->increment($inventory, (int) $batch->count, StockMovementType::BATCH_RECEIVE->value, $batch, $actorId, 'direct_batch');
        return $inventory->fresh(['product', 'variant', 'shop']);
    }

    public function adjust(int $productId, ?int $variantId, int $quantityChange, ?string $note, ?int $actorId, ?int $shopId = null, string $reasonCode = 'manual_adjustment'): Inventory
    {
        if ($quantityChange < 0) {
            $targetShopId = $shopId ?: Shop::defaultStore()->id;
            app(OfflineStockMutationGuard::class)->assertDecreaseAllowed($targetShopId, 'manual_adjustment');
        }

        return DB::transaction(function () use ($productId, $variantId, $quantityChange, $note, $actorId, $shopId, $reasonCode): Inventory {
            $inventory = $this->inventoryRow($productId, $variantId, $shopId);
            $inventory = Inventory::query()->whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            $nextQuantity = $inventory->quantity + $quantityChange;
            if ($nextQuantity < $inventory->reserved) {
                throw new InventoryConflictException('reservation_counter_inconsistent', 'Physical stock cannot be lower than reserved stock.');
            }

            $inventory->quantity = max(0, $nextQuantity);
            $inventory->last_counted_at = now();
            $inventory->updated_at = now();
            $inventory->save();
            if ($quantityChange !== 0) {
                $this->bumpShopRevision((int) $inventory->shop_id);
            }

            if ($quantityChange > 0) {
                ProductBatch::recordIncrease(
                    $productId,
                    $variantId,
                    (int) $inventory->shop_id,
                    $quantityChange,
                    $actorId,
                    'ADJUST-' . now()->format('Ymd-His'),
                    $note ?: 'Positive inventory adjustment',
                );
            } elseif ($quantityChange < 0) {
                ProductBatch::consumeForInventory($productId, $variantId, (int) $inventory->shop_id, abs($quantityChange));
            }

            $this->movement($inventory, StockMovementType::ADJUSTMENT->value, $quantityChange, $note ?: 'Manual adjustment', null, $actorId, $reasonCode);
            return $inventory->fresh(['product', 'variant', 'shop']);
        });
    }

    public function reconcileReservedCounter(Inventory $inventory, int $expectedReserved): Inventory
    {
        return DB::transaction(function () use ($inventory, $expectedReserved): Inventory {
            $row = Inventory::query()->whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            if ($expectedReserved < 0 || $expectedReserved > (int) $row->quantity) {
                throw new InventoryConflictException('reservation_counter_inconsistent', 'Reserved stock cannot exceed physical stock.');
            }
            if ((int) $row->reserved === $expectedReserved) {
                return $row;
            }

            $row->reserved = $expectedReserved;
            $row->updated_at = now();
            $row->save();
            $this->bumpShopRevision((int) $row->shop_id);
            return $row->fresh();
        });
    }

    public function inventoryRow(int $productId, ?int $variantId = null, ?int $shopId = null): Inventory
    {
        $shopId = $shopId ?: Shop::defaultStore()->id;
        return Inventory::firstOrCreate(
            ['product_id' => $productId, 'variant_id' => $variantId, 'shop_id' => $shopId],
            ['quantity' => 0, 'reserved' => 0, 'low_stock_threshold' => 5, 'updated_at' => now()]
        );
    }

    public function purgeBatchStock(ProductBatch $batch, int $quantity, string $reason, int $actorId): Inventory
    {
        if ($quantity <= 0) {
            throw new RuntimeException('Purge quantity must be at least 1.');
        }

        $targetShopId = (int) ($batch->shop_id ?: Shop::defaultStore()->id);
        app(OfflineStockMutationGuard::class)->assertDecreaseAllowed($targetShopId, 'purge_stock');

        return DB::transaction(function () use ($batch, $quantity, $reason, $actorId, $targetShopId): Inventory {
            $lockedBatch = ProductBatch::query()->whereKey($batch->id)->lockForUpdate()->firstOrFail();
            if ($quantity > (int) $lockedBatch->count) {
                throw new InventoryConflictException('insufficient_batch_stock', "Cannot purge {$quantity} units. Only {$lockedBatch->count} units remain in this batch.");
            }

            $inventory = $this->inventoryRow((int) $lockedBatch->product_id, $lockedBatch->variant_id ? (int) $lockedBatch->variant_id : null, $targetShopId);
            $inventory = Inventory::query()->whereKey($inventory->id)->lockForUpdate()->firstOrFail();

            $nextQuantity = (int) $inventory->quantity - $quantity;
            if ($nextQuantity < (int) $inventory->reserved) {
                throw new InventoryConflictException('reservation_counter_inconsistent', 'Purging cannot reduce physical stock below reserved customer order stock.');
            }

            $lockedBatch->count = max(0, (int) $lockedBatch->count - $quantity);
            $lockedBatch->save();

            $inventory->quantity = max(0, $nextQuantity);
            $inventory->last_counted_at = now();
            $inventory->updated_at = now();
            $inventory->save();

            $this->bumpShopRevision($targetShopId);
            Product::query()->find($lockedBatch->product_id)?->updateTotalCount();

            if ($lockedBatch->variant_id) {
                $remainingVariantStock = (int) ProductBatch::query()
                    ->where('variant_id', $lockedBatch->variant_id)
                    ->sum('count');
                ProductVariant::query()->whereKey($lockedBatch->variant_id)->update([
                    'in_stock' => $remainingVariantStock > 0,
                    'purchasable' => $remainingVariantStock > 0,
                    'available_for_purchase' => $remainingVariantStock > 0,
                ]);
            }

            $lossCost = round($quantity * (float) $lockedBatch->cost_price, 2);
            $note = $reason ? "Stock purged: {$reason} (Loss: ৳{$lossCost})" : "Stock purged (Loss: ৳{$lossCost})";
            $this->movement($inventory, StockMovementType::PURGE->value, -$quantity, $note, $lockedBatch, $actorId, 'stock_purge');

            return $inventory->fresh(['product', 'variant', 'shop']);
        });
    }

    public function transfer(int $fromShopId, int $toShopId, int $productId, ?int $variantId, int $quantity, ?int $actorId = null, ?object $reference = null): void
    {
        if ($fromShopId === $toShopId) throw new RuntimeException('Source and destination stores must be different.');
        app(OfflineStockMutationGuard::class)->assertDecreaseAllowed($fromShopId, 'transfer_out');

        DB::transaction(function () use ($fromShopId, $toShopId, $productId, $variantId, $quantity, $actorId, $reference): void {
            $from = $this->inventoryRow($productId, $variantId, $fromShopId);
            $to = $this->inventoryRow($productId, $variantId, $toShopId);
            $totalCost = $this->decrement($from, $quantity, $reference, $actorId);
            $unitCost = $quantity > 0 ? round($totalCost / $quantity, 2) : 0.0;
            $this->increment($to, $quantity, 'transfer_in', $reference, $actorId, 'stock_transfer', $unitCost);
            $this->movement($from->fresh(), 'transfer_out', -$quantity, 'Transferred to another store', $reference, $actorId, 'stock_transfer');
        });
    }

    private function bumpShopRevision(int $shopId): void
    {
        Shop::query()->whereKey($shopId)->increment('inventory_revision');
    }

    private function movement(Inventory $inventory, string $type, int $quantityChange, string $note, ?object $reference, ?int $actorId, ?string $reasonCode = null): void
    {
        StockMovement::create([
            'inventory_id' => $inventory->id,
            'shop_id' => $inventory->shop_id,
            'type' => $type,
            'quantity_change' => $quantityChange,
            'balance_after' => $inventory->quantity,
            'reason_code' => $reasonCode,
            'reference_type' => $reference ? get_class($reference) : null,
            'reference_id' => $reference?->id,
            'note' => $note,
            'created_by' => $actorId,
            'created_at' => now(),
        ]);
    }
}
