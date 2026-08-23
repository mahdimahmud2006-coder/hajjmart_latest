<?php

namespace App\Services;

use App\Exceptions\InventoryConflictException;
use App\Models\Shop;

class OfflineStockMutationGuard
{
    private static bool $reconciliationBypassActive = false;

    public function __construct(private StoreConnectivityService $connectivity) {}

    /**
     * Asserts whether a server-side stock-decreasing operation is permitted on the specified store.
     *
     * @param int $shopId
     * @param string $operation Name of operation (e.g. 'manual_adjustment', 'transfer_out')
     * @throws InventoryConflictException
     */
    public function assertDecreaseAllowed(int $shopId, string $operation): void
    {
        if (self::$reconciliationBypassActive) {
            return;
        }

        $shop = Shop::query()->find($shopId);
        if (! $shop) {
            return;
        }

        $state = $this->connectivity->stateFor($shop);
        if (in_array($state, [
            StoreConnectivityService::OFFLINE_SUSPECTED,
            StoreConnectivityService::OFFLINE_CONFIRMED,
            StoreConnectivityService::RECONCILING,
            StoreConnectivityService::RECOVERY_REQUIRED,
        ], true)) {
            throw new InventoryConflictException(
                'store_offline_stock_locked',
                "Store stock is locked because store #{$shopId} is currently offline or reconciling. Operation '{$operation}' is not allowed."
            );
        }
    }

    /**
     * Narrow internal bypass for authoritative reconciliation owned by OfflineReconciliationService.
     */
    public static function bypassForReconciliation(callable $callback): mixed
    {
        $previous = self::$reconciliationBypassActive;
        self::$reconciliationBypassActive = true;
        try {
            return $callback();
        } finally {
            self::$reconciliationBypassActive = $previous;
        }
    }
}
