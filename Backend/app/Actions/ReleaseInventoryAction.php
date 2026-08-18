<?php

namespace App\Actions;

use App\Models\Order;
use App\Models\ReservedProduct;
use App\Services\InventoryService;
use Illuminate\Support\Facades\DB;

class ReleaseInventoryAction
{
    public function execute(Order $order): void
    {
        DB::transaction(function () use ($order): void {
            $reservedItems = $order->reservedProducts()->lockForUpdate()->get();
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
                    if ((int) $inventory->reserved < (int) $item->qty) {
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

                    $inventoryService->releaseReservation($inventory, (int) $item->qty, $item, $order->created_by);
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
