<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Shop;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class InventoryService
{
    public function validateItems(array $items, ?int $shopId = null, string $priceMode = 'retail'): array
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
                throw new RuntimeException("Insufficient stock for {$product->name} in the selected store.");
            }
            $unitPrice = $priceMode === 'wholesale'
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
                    ?? 0);
            $validated[] = compact('product', 'variant', 'inventory', 'quantity', 'unitPrice');
        }
        return $validated;
    }

    public function reserve(Inventory $inventory, int $quantity, ?object $reference = null, ?int $actorId = null): void
    {
        DB::transaction(function () use ($inventory, $quantity, $reference, $actorId): void {
            $row = Inventory::whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            if (($row->quantity - $row->reserved) < $quantity) throw new RuntimeException('Insufficient stock.');
            $row->increment('reserved', $quantity);
            $this->movement($row, StockMovementType::ADJUSTMENT->value, 0, 'Reserved stock', $reference, $actorId, 'reservation');
        });
    }

    public function releaseReservation(Inventory $inventory, int $quantity, ?object $reference = null, ?int $actorId = null): void
    {
        DB::transaction(function () use ($inventory, $quantity, $reference, $actorId): void {
            $row = Inventory::whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            if ($row->reserved < $quantity) {
                throw new RuntimeException('Reserved stock is lower than the reservation being released.');
            }
            $row->reserved -= $quantity;
            $row->updated_at = now();
            $row->save();
            $this->movement($row, StockMovementType::ADJUSTMENT->value, 0, 'Released reserved stock', $reference, $actorId, 'reservation_release');
        });
    }

    public function commitReserved(Inventory $inventory, int $quantity, ?object $reference = null, ?int $actorId = null): void
    {
        DB::transaction(function () use ($inventory, $quantity, $reference, $actorId): void {
            $row = Inventory::whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            if ($row->reserved < $quantity || $row->quantity < $quantity) {
                throw new RuntimeException('Reserved stock cannot be committed because inventory is inconsistent.');
            }

            $row->reserved -= $quantity;
            $row->quantity -= $quantity;
            $row->updated_at = now();
            $row->save();

            ProductBatch::consumeForInventory(
                (int) $row->product_id,
                $row->variant_id ? (int) $row->variant_id : null,
                (int) $row->shop_id,
                $quantity,
            );

            $this->movement($row, StockMovementType::SALE->value, -$quantity, 'Committed reserved stock', $reference, $actorId, 'sale');
        });
    }

    public function decrement(Inventory $inventory, int $quantity, ?object $reference = null, ?int $actorId = null): void
    {
        DB::transaction(function () use ($inventory, $quantity, $reference, $actorId): void {
            $row = Inventory::whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            if (($row->quantity - $row->reserved) < $quantity) throw new RuntimeException('Insufficient stock.');
            $row->quantity -= $quantity;
            $row->updated_at = now();
            $row->save();

            ProductBatch::consumeForInventory(
                (int) $row->product_id,
                $row->variant_id ? (int) $row->variant_id : null,
                (int) $row->shop_id,
                $quantity,
            );

            $this->movement($row, StockMovementType::SALE->value, -$quantity, 'Stock deducted', $reference, $actorId, 'sale');
        });
    }

    public function increment(Inventory $inventory, int $quantity, string $type = 'return', ?object $reference = null, ?int $actorId = null, ?string $reasonCode = null): void
    {
        DB::transaction(function () use ($inventory, $quantity, $type, $reference, $actorId, $reasonCode): void {
            $row = Inventory::whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            $row->quantity += $quantity;
            $row->updated_at = now();
            $row->save();

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
        return DB::transaction(function () use ($productId, $variantId, $quantityChange, $note, $actorId, $shopId, $reasonCode): Inventory {
            $inventory = $this->inventoryRow($productId, $variantId, $shopId);
            $nextQuantity = $inventory->quantity + $quantityChange;
            if ($nextQuantity < $inventory->reserved) {
                throw new RuntimeException('Physical stock cannot be lower than reserved stock.');
            }

            $inventory->quantity = max(0, $nextQuantity);
            $inventory->last_counted_at = now();
            $inventory->updated_at = now();
            $inventory->save();

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

    public function inventoryRow(int $productId, ?int $variantId = null, ?int $shopId = null): Inventory
    {
        $shopId = $shopId ?: Shop::defaultStore()->id;
        return Inventory::firstOrCreate(
            ['product_id' => $productId, 'variant_id' => $variantId, 'shop_id' => $shopId],
            ['quantity' => 0, 'reserved' => 0, 'low_stock_threshold' => 5, 'updated_at' => now()]
        );
    }

    public function transfer(int $fromShopId, int $toShopId, int $productId, ?int $variantId, int $quantity, ?int $actorId = null, ?object $reference = null): void
    {
        if ($fromShopId === $toShopId) throw new RuntimeException('Source and destination stores must be different.');
        DB::transaction(function () use ($fromShopId, $toShopId, $productId, $variantId, $quantity, $actorId, $reference): void {
            $from = $this->inventoryRow($productId, $variantId, $fromShopId);
            $to = $this->inventoryRow($productId, $variantId, $toShopId);
            $this->decrement($from, $quantity, $reference, $actorId);
            $this->increment($to, $quantity, 'transfer_in', $reference, $actorId, 'stock_transfer');
            $this->movement($from->fresh(), 'transfer_out', -$quantity, 'Transferred to another store', $reference, $actorId, 'stock_transfer');
        });
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
