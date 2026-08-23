<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\ReservedProduct;

class InventoryIntegrityService
{
    public function verifyShopIntegrity(int $shopId): array
    {
        $inventories = Inventory::query()->where('shop_id', $shopId)->get();
        $violations = [];

        foreach ($inventories as $inv) {
            $sumQuery = ReservedProduct::query()
                ->active()
                ->where('shop_id', $inv->shop_id)
                ->where('product_id', $inv->product_id);

            if ($inv->variant_id) {
                $sumQuery->where('variant_id', $inv->variant_id);
            } else {
                $sumQuery->whereNull('variant_id');
            }

            $activeReservedSum = (int) $sumQuery->sum('qty');
            $issues = [];

            if ((int) $inv->reserved !== $activeReservedSum) {
                $issues[] = "Reserved counter mismatch: inventory.reserved={$inv->reserved} vs active sum={$activeReservedSum}";
            }

            if ((int) $inv->quantity < 0) {
                $issues[] = "Negative physical quantity: {$inv->quantity}";
            }

            if ((int) $inv->reserved < 0) {
                $issues[] = "Negative reserved quantity: {$inv->reserved}";
            }

            if ((int) $inv->reserved > (int) $inv->quantity) {
                $issues[] = "Reserved exceeds physical quantity: reserved={$inv->reserved} > quantity={$inv->quantity}";
            }

            if ($issues !== []) {
                $violations[] = [
                    'inventory_id' => $inv->id,
                    'product_id' => $inv->product_id,
                    'variant_id' => $inv->variant_id,
                    'issues' => $issues,
                ];
            }
        }

        return [
            'valid' => $violations === [],
            'violations' => $violations,
        ];
    }
}
