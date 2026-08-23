<?php

namespace App\Console\Commands;

use App\Models\Inventory;
use App\Models\ReservedProduct;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class InventoryReconciliationCheckCommand extends Command
{
    protected $signature = 'inventory:reconcile-check {--shop= : Filter by specific shop ID}';
    protected $description = 'Verify store inventory reservation and non-negative stock invariants (read-only diagnostic report)';

    public function handle(): int
    {
        $shopId = $this->option('shop');
        $this->info('Starting inventory reservation reconciliation assertion check...');

        $query = Inventory::query()->with(['shop', 'product']);
        if ($shopId) {
            $query->where('shop_id', (int) $shopId);
        }

        $inventories = $query->get();
        $discrepancies = [];

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
                $issues[] = "Reserved counter mismatch: inventory.reserved={$inv->reserved} vs active reserved_products sum={$activeReservedSum}";
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
                $discrepancies[] = [
                    'inventory_id' => $inv->id,
                    'shop' => $inv->shop?->name ?: "Shop #{$inv->shop_id}",
                    'product' => $inv->product?->name ?: "Product #{$inv->product_id}",
                    'variant_id' => $inv->variant_id ?: 'Main',
                    'quantity' => $inv->quantity,
                    'reserved' => $inv->reserved,
                    'active_sum' => $activeReservedSum,
                    'issues' => implode(' | ', $issues),
                ];
            }
        }

        if ($discrepancies === []) {
            $this->info("✓ Inventory reservation audit PASSED across {$inventories->count()} inventory records. Zero discrepancies found.");
            return Command::SUCCESS;
        }

        $this->error("✗ Found " . count($discrepancies) . " inventory reservation discrepancies!");
        $this->table(
            ['ID', 'Shop', 'Product', 'Variant', 'Qty', 'Reserved', 'Sum', 'Issues'],
            $discrepancies
        );

        return Command::FAILURE;
    }
}
