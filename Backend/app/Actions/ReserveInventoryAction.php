<?php

namespace App\Actions;

use App\Models\Order;
use App\Models\Product;
use App\Models\ReservedProduct;
use App\Services\InventoryService;
use App\Services\ReservationPolicyService;
use Exception;
use Illuminate\Support\Facades\DB;

class ReserveInventoryAction
{
    public function execute(Order $order): void
    {
        DB::transaction(function () use ($order): void {
            $order->loadMissing('items');
            $reservationClass = app(ReservationPolicyService::class)->classificationForOrder($order);

            if ($order->items->isNotEmpty()) {
                $inventoryService = app(InventoryService::class);
                foreach ($order->items as $item) {
                    if (ReservedProduct::where('order_item_id', $item->id)->exists()) {
                        continue;
                    }

                    $inventory = $inventoryService->inventoryRow(
                        (int) $item->product_id,
                        $item->variant_id ? (int) $item->variant_id : null,
                        (int) $order->shop_id,
                    );
                    $inventoryService->reserve($inventory, (int) $item->quantity, $item, $order->created_by);

                    ReservedProduct::create([
                        'order_id' => $order->id,
                        'order_item_id' => $item->id,
                        'product_id' => $item->product_id,
                        'variant_id' => $item->variant_id,
                        'shop_id' => $order->shop_id,
                        'qty' => $item->quantity,
                        'price' => $item->unit_price,
                        'total' => $item->line_grand_total ?: $item->line_total,
                        'status' => 'active',
                        'reservation_class' => $reservationClass,
                        'source_channel' => $order->source_channel,
                        'reserved_at' => now(),
                    ]);
                }
                if ($reservationClass === 'preemptible' && $order->reconciliation_status === 'normal') {
                    $order->update(['reconciliation_status' => 'provisional']);
                } elseif ($reservationClass === 'protected' && $order->reconciliation_status === 'normal') {
                    $order->update(['reconciliation_status' => 'protected']);
                }
                return;
            }

            // Legacy Sareng reservation path retained for controllers that still
            // write the old ordered_products snapshot instead of order_items.
            // Any historical reservation row makes this action idempotent.
            if ($order->reservedProducts()->exists()) {
                return;
            }

            foreach ($order->ordered_products ?? [] as $item) {
                $product = Product::where('id', $item['id'])->lockForUpdate()->firstOrFail();
                $variationId = $item['variation_id'] ?? null;
                $availableStock = $product->has_variations && $variationId
                    ? \App\Models\Variation::where('id', $variationId)->lockForUpdate()->firstOrFail()->getAvailableStock()
                    : $product->getAvailableStock();

                if ($availableStock < $item['qty']) {
                    throw new Exception("Insufficient stock for product: {$product->name}. Requested: {$item['qty']}, Available: {$availableStock}");
                }

                ReservedProduct::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'variation_id' => $variationId,
                    'qty' => $item['qty'],
                    'price' => $item['price'],
                    'total' => $item['total'],
                    'status' => 'active',
                    'reservation_class' => $reservationClass,
                    'source_channel' => $order->source_channel ?: 'website',
                    'reserved_at' => now(),
                ]);
            }
        });
    }

    public static function run(Order $order): void
    {
        (new self())->execute($order);
    }
}
