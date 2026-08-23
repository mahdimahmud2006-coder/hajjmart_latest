<?php

namespace App\Services;

use App\Exceptions\StoreDeviceException;
use App\Models\Shop;
use App\Models\StoreDevice;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class StoreDeviceService
{
    public function __construct(
        private ActivityLogService $activities,
        private OfflineSessionService $offlineSessions,
    ) {}

    public function currentForShop(Shop $shop): ?StoreDevice
    {
        return StoreDevice::query()->where('shop_id', $shop->id)->first();
    }

    public function register(Shop $shop, string $deviceUuid, User $actor, ?string $appVersion = null): array
    {
        return DB::transaction(function () use ($shop, $deviceUuid, $actor, $appVersion): array {
            $lockedShop = Shop::query()->whereKey($shop->id)->lockForUpdate()->firstOrFail();
            if (! $lockedShop->is_active) {
                throw new StoreDeviceException('store_inactive', 'This store is inactive and cannot register an offline device.', 422);
            }

            $openRecovery = \App\Models\OfflineRecoveryCase::query()
                ->where('shop_id', $shop->id)
                ->open()
                ->exists();
            if ($openRecovery) {
                throw new StoreDeviceException('store_device_already_bound', 'Finish the current device sync or store recovery before registering a new offline device.', 409);
            }

            $existing = StoreDevice::query()->where('shop_id', $shop->id)->lockForUpdate()->first();

            if ($existing) {
                if ($existing->status === 'active' && hash_equals($existing->device_uuid, $deviceUuid)) {
                    return ['device' => $existing->fresh(), 'device_token' => null];
                }

                if (in_array($existing->status, ['released', 'inactive', 'revoked'], true)) {
                    if (StoreDevice::query()->where('device_uuid', $deviceUuid)->where('id', '!=', $existing->id)->exists()) {
                        throw new StoreDeviceException('store_device_already_bound', 'This device identity is already registered to another store.');
                    }
                    $token = $this->newToken();
                    $existing->update([
                        'device_uuid' => $deviceUuid,
                        'device_token_hash' => $this->hashToken($token),
                        'binding_version' => $existing->binding_version + 1,
                        'status' => 'active',
                        'operational_state' => 'normal',
                        'registered_by' => $actor->id,
                        'registered_at' => now(),
                        'last_heartbeat_at' => null,
                        'last_seen_user_id' => null,
                        'last_app_version' => $appVersion,
                    ]);
                    $fresh = $existing->fresh();
                    $this->activities->record(
                        'offline_devices',
                        'registered',
                        "Registered new commerce device for {$shop->name} after release",
                        $fresh,
                        [],
                        $this->publicData($fresh),
                        userId: $actor->id,
                        shopId: $shop->id,
                    );
                    return ['device' => $fresh, 'device_token' => $token];
                }

                throw new StoreDeviceException(
                    'store_device_already_bound',
                    'This store already has a registered commerce device. Release it before using another device.',
                );
            }

            if (StoreDevice::query()->where('device_uuid', $deviceUuid)->exists()) {
                throw new StoreDeviceException('store_device_already_bound', 'This device identity is already registered to another store.');
            }

            $token = $this->newToken();
            $device = StoreDevice::create([
                'shop_id' => $shop->id,
                'device_uuid' => $deviceUuid,
                'device_token_hash' => $this->hashToken($token),
                'binding_version' => 1,
                'status' => 'active',
                'operational_state' => 'normal',
                'registered_by' => $actor->id,
                'registered_at' => now(),
                'last_app_version' => $appVersion,
            ]);

            $this->activities->record(
                'offline_devices',
                'registered',
                "Registered commerce device for {$shop->name}",
                $device,
                [],
                $this->publicData($device),
                userId: $actor->id,
                shopId: $shop->id,
            );

            return ['device' => $device, 'device_token' => $token];
        });
    }

    public function replace(Shop $shop, string $deviceUuid, User $actor, ?string $appVersion = null): array
    {
        return DB::transaction(function () use ($shop, $deviceUuid, $actor, $appVersion): array {
            $lockedShop = Shop::query()->whereKey($shop->id)->lockForUpdate()->firstOrFail();
            if (! $lockedShop->is_active) {
                throw new StoreDeviceException('store_inactive', 'This store is inactive and cannot replace its offline device.', 422);
            }

            $device = StoreDevice::query()->where('shop_id', $shop->id)->lockForUpdate()->first();

            if (! $device) {
                throw new StoreDeviceException('store_device_not_registered', 'This store does not have a registered commerce device yet.', 404);
            }
            if (hash_equals($device->device_uuid, $deviceUuid)) {
                throw new StoreDeviceException('store_device_uuid_unchanged', 'Generate a new device identity before replacing this store device.', 422);
            }

            $this->offlineSessions->assertDeviceReplacementAllowed($device);

            if (StoreDevice::query()->where('device_uuid', $deviceUuid)->where('shop_id', '!=', $shop->id)->exists()) {
                throw new StoreDeviceException('store_device_already_bound', 'This device identity is already registered to another store.');
            }

            $before = $this->publicData($device);
            $token = $this->newToken();
            $device->update([
                'device_uuid' => $deviceUuid,
                'device_token_hash' => $this->hashToken($token),
                'binding_version' => $device->binding_version + 1,
                'status' => 'active',
                'operational_state' => 'normal',
                'registered_by' => $actor->id,
                'registered_at' => now(),
                'last_heartbeat_at' => null,
                'last_seen_user_id' => null,
                'last_app_version' => $appVersion,
                'replaced_at' => now(),
                'replaced_by' => $actor->id,
            ]);

            $fresh = $device->fresh();
            $this->activities->record(
                'offline_devices',
                'replaced',
                "Replaced commerce device for {$shop->name}",
                $fresh,
                $before,
                $this->publicData($fresh),
                userId: $actor->id,
                shopId: $shop->id,
            );

            return ['device' => $fresh, 'device_token' => $token];
        });
    }

    public function verify(string $deviceUuid, string $deviceToken): StoreDevice
    {
        $device = StoreDevice::query()->with('shop')->where('device_uuid', $deviceUuid)->where('status', 'active')->first();

        if (! $device || ! hash_equals($device->device_token_hash, $this->hashToken($deviceToken))) {
            throw new StoreDeviceException('store_device_invalid', 'This device is not registered for offline commerce.', 401);
        }

        if (! $device->shop?->is_active) {
            throw new StoreDeviceException('store_inactive', 'This store is inactive and cannot use offline commerce.', 422);
        }

        return $device;
    }

    public function heartbeat(StoreDevice $device, User $user, ?string $appVersion = null): StoreDevice
    {
        $device->update([
            'last_heartbeat_at' => now(),
            'last_seen_user_id' => $user->id,
            'last_app_version' => $appVersion ?? $device->last_app_version,
        ]);

        return $device->fresh('shop');
    }

    public function release(Shop $shop, StoreDevice $device, User $actor, array $clientMeta = []): array
    {
        return DB::transaction(function () use ($shop, $device, $actor, $clientMeta): array {
            $lockedShop = Shop::query()->whereKey($shop->id)->lockForUpdate()->firstOrFail();
            $lockedDevice = StoreDevice::query()->whereKey($device->id)->lockForUpdate()->firstOrFail();

            if ($lockedDevice->status === 'released') {
                return ['released' => true, 'device' => $lockedDevice];
            }

            if ($lockedDevice->status !== 'active' || (int) $lockedDevice->shop_id !== (int) $shop->id) {
                throw new StoreDeviceException('store_device_not_registered', 'This device binding is not active for the specified store.', 404);
            }

            $this->offlineSessions->assertDeviceReleaseAllowed($lockedDevice, $clientMeta);

            $openSession = \App\Models\OfflineInventorySession::query()
                ->where('store_device_id', $lockedDevice->id)
                ->where('binding_version', $lockedDevice->binding_version)
                ->where('status', 'open')
                ->latest('id')
                ->first();

            if ($openSession) {
                $openSession->update(['status' => 'closed', 'closed_at' => now()]);
            }

            $before = $this->publicData($lockedDevice);
            $lockedDevice->update([
                'status' => 'released',
                'device_token_hash' => hash('sha256', 'released:' . \Illuminate\Support\Str::uuid()),
                'released_at' => now(),
                'released_by' => $actor->id,
            ]);

            $fresh = $lockedDevice->fresh();
            $this->activities->record(
                'offline_devices',
                'released',
                "Released commerce device for {$shop->name}",
                $fresh,
                $before,
                $this->publicData($fresh),
                userId: $actor->id,
                shopId: $shop->id,
            );

            return ['released' => true, 'device' => $fresh];
        });
    }

    public function publicData(StoreDevice $device): array
    {
        return [
            'shop_id' => (int) $device->shop_id,
            'device_uuid' => $device->device_uuid,
            'binding_version' => (int) $device->binding_version,
            'status' => $device->status,
            'operational_state' => $device->operational_state,
            'registered_at' => $device->registered_at?->toIso8601String(),
            'last_heartbeat_at' => $device->last_heartbeat_at?->toIso8601String(),
            'last_app_version' => $device->last_app_version,
            'replaced_at' => $device->replaced_at?->toIso8601String(),
        ];
    }

    public function registerDevice(Shop $shop, string $deviceName, array $context = []): array
    {
        $deviceUuid = (string) \Illuminate\Support\Str::uuid();
        $token = $this->newToken();
        $registeredBy = $context['registered_by'] ?? null;

        StoreDevice::query()->where('shop_id', $shop->id)->delete();

        $device = StoreDevice::create([
            'shop_id' => $shop->id,
            'device_uuid' => $deviceUuid,
            'device_name' => $deviceName,
            'device_token_hash' => $this->hashToken($token),
            'binding_version' => ($shop->storeDevice?->binding_version ?? 0) + 1,
            'status' => 'active',
            'operational_state' => 'normal',
            'registered_by' => $registeredBy,
            'registered_at' => now(),
        ]);

        return ['device' => $device, 'registration_token' => $token];
    }

    private function newToken(): string
    {
        return bin2hex(random_bytes(32));
    }

    private function hashToken(string $token): string
    {
        return hash_hmac('sha256', $token, (string) config('app.key'));
    }
}
