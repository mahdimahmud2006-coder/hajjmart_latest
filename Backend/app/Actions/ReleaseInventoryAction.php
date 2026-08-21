<?php

namespace App\Actions;

use App\Models\Order;
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
