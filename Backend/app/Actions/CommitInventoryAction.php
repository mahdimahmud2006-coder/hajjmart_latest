<?php

namespace App\Actions;

use App\Models\Order;
use App\Models\OrderItemBatch;
use App\Services\InventoryService;
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
                $inventory = $inventoryService->inventoryRow(
                    (int) $item->product_id,
                    $item->variant_id ? (int) $item->variant_id : null,
                    (int) $item->shop_id,
                );

                $detailedCost = $inventoryService->commitReservedDetailed($inventory, (int) $item->qty, $item, $order->created_by);
                $cogsTotal = (float) $detailedCost['total_cost'];
                $allocations = $detailedCost['allocations'] ?? [];

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
                    $firstBatchId = ! empty($allocations) ? $allocations[0]['batch_id'] : null;

                    $orderItem->update([
                        'batch_id' => $firstBatchId,
                        'unit_cost' => $unitCost,
                        'cogs_total' => $cogsTotal,
                        'gross_profit' => round($lineGrand - $cogsTotal, 2),
                    ]);

                    foreach ($allocations as $alloc) {
                        OrderItemBatch::create([
                            'order_item_id' => $orderItem->id,
                            'product_batch_id' => $alloc['batch_id'],
                            'quantity' => $alloc['quantity'],
                            'cost_price' => $alloc['cost_price'],
                        ]);
                    }
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
