<?php

namespace App\Actions;

use App\Models\Order;
use App\Services\InventoryService;
use Illuminate\Support\Facades\DB;

class ReleaseInventoryAction
{
    public function execute(Order $order, ?string $reason = null): void
    {
        DB::transaction(function () use ($order, $reason): void {
            $reservedItems = $order->activeReservedProducts()->lockForUpdate()->get();
            if ($reservedItems->isEmpty()) {
                return;
            }

            $inventoryService = app(InventoryService::class);
            foreach ($reservedItems as $item) {
                $inventory = $inventoryService->inventoryRow(
                    (int) $item->product_id,
                    $item->variant_id ? (int) $item->variant_id : null,
                    (int) $item->shop_id,
                );

                $inventoryService->releaseReservation($inventory, (int) $item->qty, $item, $order->created_by);

                $item->update([
                    'status' => 'released',
                    'released_at' => now(),
                    'release_reason' => $reason,
                ]);
            }
        });
    }

    public static function run(Order $order, ?string $reason = null): void
    {
        (new self())->execute($order, $reason);
    }
}
