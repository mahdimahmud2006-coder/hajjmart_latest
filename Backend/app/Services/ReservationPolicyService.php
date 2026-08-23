<?php

namespace App\Services;

use App\Exceptions\InventoryConflictException;
use App\Models\OfflineInventorySession;
use App\Models\Order;
use App\Models\Shop;

class ReservationPolicyService
{
    public function __construct(private StoreConnectivityService $connectivity) {}

    public function classificationForOrder(Order $order): string
    {
        if ($order->offline_inventory_session_id || $order->offline_recovery_case_id || in_array($order->reconciliation_status, ['offline_local_pending', 'offline_local_synced'], true)) {
            return 'protected';
        }

        $shop = Shop::query()->whereKey($order->shop_id)->lockForUpdate()->firstOrFail();
        $state = $this->connectivity->stateFor($shop);
        if (in_array($state, [StoreConnectivityService::RECONCILING, StoreConnectivityService::RECOVERY_REQUIRED], true)) {
            throw new InventoryConflictException('store_offline_reconciliation_in_progress', 'This store is reconciling offline stock and cannot accept a new reservation yet.');
        }

        if (! in_array($state, [StoreConnectivityService::OFFLINE_SUSPECTED, StoreConnectivityService::OFFLINE_CONFIRMED], true)) {
            return 'protected';
        }

        $session = OfflineInventorySession::query()
            ->where('shop_id', $shop->id)
            ->whereIn('status', ['open', 'reconciling'])
            ->latest('id')
            ->first();

        if ($session && $order->created_at && $order->created_at->lte($session->boundary_server_at)) {
            return 'protected';
        }

        if (in_array($order->source_channel, ['website', 'social_commerce'], true)) {
            return 'preemptible';
        }

        return 'protected';
    }
}
