<?php

namespace App\Actions;

use App\Models\Order;
use App\Models\ReservedProduct;
use App\Services\InventoryService;
use Exception;
use Illuminate\Support\Facades\DB;

class CommitInventoryAction
{
    public function execute(Order $order): void
    {
        DB::transaction(function () use ($order): void {
            $reservedItems = $order->activeReservedProducts()->with('product')->lockForUpdate()->get();
            if ($reservedItems->isEmpty()) {
                return;
            }

            $inventoryService = app(InventoryService::class);
            $matchedOrderItemIds = [];
            foreach ($reservedItems as $item) {
                if ($item->shop_id) {
                    $inventory = $inventoryService->inventoryRow(
                        (int) $item->product_id,
                        $item->variant_id ? (int) $item->variant_id : null,
                        (int) $item->shop_id,
                    );

                    // Older installations can contain reservation rows created before
                    // the store-aware reserved counter was introduced. Reconcile the
                    // counter from the active reservation ledger before committing so a
                    // valid historical reservation can still complete fulfilment safely.
                    if ((int) $inventory->reserved < (int) $item->qty && (int) $inventory->quantity >= (int) $item->qty) {
                        $reservationQuery = ReservedProduct::query()
                            ->active()
                            ->where('product_id', $item->product_id)
                            ->where('shop_id', $item->shop_id);
                        $item->variant_id
                            ? $reservationQuery->where('variant_id', $item->variant_id)
                            : $reservationQuery->whereNull('variant_id');
                        $expectedReserved = min((int) $inventory->quantity, (int) $reservationQuery->sum('qty'));
                        if ($expectedReserved >= (int) $item->qty) {
                            $inventory = $inventoryService->reconcileReservedCounter($inventory, $expectedReserved);
                        }
                    }

                    $cogsTotal = $inventoryService->commitReserved($inventory, (int) $item->qty, $item, $order->created_by);
                    $orderItem = $item->order_item_id
                        ? $order->items()->whereKey($item->order_item_id)->first()
                        : $order->items()
                            ->where('product_id', $item->product_id)
                            ->when($item->variant_id, fn ($query) => $query->where('variant_id', $item->variant_id), fn ($query) => $query->whereNull('variant_id'))
                            ->when($matchedOrderItemIds, fn ($query) => $query->whereNotIn('id', $matchedOrderItemIds))
                            ->first();
                    if ($orderItem) {
                        $matchedOrderItemIds[] = $orderItem->id;
                        $unitCost = $item->qty > 0 ? round($cogsTotal / $item->qty, 2) : 0.0;
                        $lineGrand = (float) ($orderItem->line_grand_total ?: $orderItem->line_total);
                        $orderItem->update([
                            'unit_cost' => $unitCost,
                            'cogs_total' => $cogsTotal,
                            'gross_profit' => round($lineGrand - $cogsTotal, 2),
                        ]);
                    }
                    $item->update([
                        'status' => 'committed',
                        'committed_at' => now(),
                    ]);
                    continue;
                }

                // Legacy reservation rows do not participate in the modern
                // inventory.reserved counter, so keep their original behavior.
                $product = $item->product;
                $result = $product->sellProduct($item->qty, $item->variation_id);
                if (! $result['success']) {
                    throw new Exception("Failed to commit inventory for product: {$product->name}. Error: " . ($result['message'] ?? 'Unknown error'));
                }
                $item->update([
                    'status' => 'committed',
                    'committed_at' => now(),
                ]);
            }

            if ($order->items()->exists()) {
                $order->update([
                    'total_cogs' => round((float) $order->items()->sum('cogs_total'), 2),
                    'gross_profit' => round((float) $order->items()->sum('gross_profit'), 2),
                ]);
            }
        });
    }

    public static function run(Order $order): void
    {
        (new self())->execute($order);
    }
}
