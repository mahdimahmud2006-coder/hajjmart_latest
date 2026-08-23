<?php

namespace App\Services;

use App\Models\Shop;

class StoreConnectivityService
{
    public const ONLINE_HEALTHY = 'online_healthy';
    public const OFFLINE_SUSPECTED = 'offline_suspected';
    public const OFFLINE_CONFIRMED = 'offline_confirmed';
    public const RECONCILING = 'reconciling';
    public const RECOVERY_REQUIRED = 'recovery_required';

    public function stateFor(Shop $shop): string
    {
        $openCase = \App\Models\OfflineRecoveryCase::query()
            ->where('shop_id', $shop->id)
            ->open()
            ->exists();
        if ($openCase) {
            return self::RECOVERY_REQUIRED;
        }

        $device = $shop->relationLoaded('storeDevice') ? $shop->storeDevice : $shop->storeDevice()->first();

        // A store with no offline device cannot have unreported device sales, so
        // it remains safe for the existing online-only operating model.
        if (! $device || $device->status !== 'active') {
            return self::ONLINE_HEALTHY;
        }

        if ($device->operational_state === self::RECONCILING) {
            return self::RECONCILING;
        }
        if ($device->operational_state === self::RECOVERY_REQUIRED) {
            return self::RECOVERY_REQUIRED;
        }

        $lastSeen = $device->last_heartbeat_at ?? $device->registered_at;
        if (! $lastSeen) {
            return self::OFFLINE_CONFIRMED;
        }

        $age = max(0, $lastSeen->diffInSeconds(now()));
        $healthySeconds = (int) config('hajjmart.offline_commerce.healthy_seconds', 60);
        $offlineSeconds = (int) config('hajjmart.offline_commerce.offline_confirmed_seconds', 180);

        if ($age <= $healthySeconds) {
            return self::ONLINE_HEALTHY;
        }
        if ($age <= $offlineSeconds) {
            return self::OFFLINE_SUSPECTED;
        }

        return self::OFFLINE_CONFIRMED;
    }

    public function isHealthy(Shop $shop): bool
    {
        return $this->stateFor($shop) === self::ONLINE_HEALTHY;
    }

    public function isSuspectedOrOffline(Shop $shop): bool
    {
        return in_array($this->stateFor($shop), [
            self::OFFLINE_SUSPECTED,
            self::OFFLINE_CONFIRMED,
            self::RECONCILING,
            self::RECOVERY_REQUIRED,
        ], true);
    }

    public function blocksOutboundStock(Shop $shop): bool
    {
        return $this->isSuspectedOrOffline($shop);
    }

    public function allowsOnlineFulfilment(Shop $shop): bool
    {
        return $this->isHealthy($shop);
    }

    public function assertOrdinaryEmployeeCommerceAllowed(Shop $shop, string $channel): void
    {
        $state = $this->stateFor($shop);
        if ($state === self::RECOVERY_REQUIRED) {
            throw new \App\Exceptions\OfflineReconciliationException(
                'store_offline_recovery_in_progress',
                'This store has unfinished offline sales or recovery work. Use paper records until the store is recovered or the registered offline device syncs.',
                422,
                true
            );
        }
    }
}
