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
            $reservedItems = $order->reservedProducts()->with('product')->lockForUpdate()->get();
            if ($reservedItems->isEmpty()) {
                return;
            }

            $inventoryService = app(InventoryService::class);
            foreach ($reservedItems as $item) {
                if ($item->shop_id) {
                    $inventory = $inventoryService->inventoryRow(
                        (int) $item->product_id,
                        $item->variant_id ? (int) $item->variant_id : null,
                        (int) $item->shop_id,
                    );

                    // Older installations can contain reservation rows created before
                    // the store-aware reserved counter was introduced. Reconcile the
                    // counter from the reservation ledger before committing so a valid
                    // pending order does not fail with an HTTP 500 during confirmation.
                    if ((int) $inventory->reserved < (int) $item->qty && (int) $inventory->quantity >= (int) $item->qty) {
                        $reservationQuery = ReservedProduct::query()
                            ->where('product_id', $item->product_id)
                            ->where('shop_id', $item->shop_id);
                        $item->variant_id
                            ? $reservationQuery->where('variant_id', $item->variant_id)
                            : $reservationQuery->whereNull('variant_id');
                        $expectedReserved = min((int) $inventory->quantity, (int) $reservationQuery->sum('qty'));
                        if ($expectedReserved >= (int) $item->qty) {
                            $inventory->forceFill(['reserved' => $expectedReserved, 'updated_at' => now()])->save();
                            $inventory->refresh();
                        }
                    }

                    $inventoryService->commitReserved($inventory, (int) $item->qty, $item, $order->created_by);
                    $item->delete();
                    continue;
                }

                // Legacy reservation rows do not participate in the modern
                // inventory.reserved counter, so keep their original behavior.
                $product = $item->product;
                $result = $product->sellProduct($item->qty, $item->variation_id);
                if (! $result['success']) {
                    throw new Exception("Failed to commit inventory for product: {$product->name}. Error: " . ($result['message'] ?? 'Unknown error'));
                }
                $item->delete();
            }
        });
    }

    public static function run(Order $order): void
    {
        (new self())->execute($order);
    }
}
