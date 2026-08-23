<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\StoreDeviceException;
use App\Http\Controllers\Controller;
use App\Models\Shop;
use App\Services\OfflineSessionService;
use App\Services\StoreConnectivityService;
use App\Services\StoreDeviceService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class OfflineDeviceController extends Controller
{
    use ApiResponse;

    public function __construct(
        private StoreDeviceService $devices,
        private StoreConnectivityService $connectivity,
        private OfflineSessionService $offlineSessions,
    ) {}

    public function show(Request $request)
    {
        $data = $request->validate(['shop_id' => ['required', 'integer', 'exists:shops,id']]);
        $shop = Shop::query()->findOrFail($data['shop_id']);
        $device = $this->devices->currentForShop($shop);
        if ($device) $shop->setRelation('storeDevice', $device);

        return $this->success([
            'shop' => $this->shopData($shop),
            'device' => $device ? $this->devices->publicData($device) : null,
            'connectivity_state' => $this->connectivity->stateFor($shop),
            'server_time' => now()->toIso8601String(),
            'heartbeat_interval_seconds' => (int) config('hajjmart.offline_commerce.heartbeat_interval_seconds', 25),
        ], 'Offline device status retrieved.');
    }

    public function register(Request $request)
    {
        $data = $request->validate([
            'shop_id' => ['required', 'integer', 'exists:shops,id'],
            'device_uuid' => ['required', 'uuid'],
            'app_version' => ['nullable', 'string', 'max:100'],
        ]);

        try {
            $shop = Shop::query()->findOrFail($data['shop_id']);
            $result = $this->devices->register($shop, $data['device_uuid'], $request->user(), $data['app_version'] ?? null);
            $shop->setRelation('storeDevice', $result['device']);

            return $this->success([
                'shop' => $this->shopData($shop),
                'device' => $this->devices->publicData($result['device']),
                'device_token' => $result['device_token'],
                'connectivity_state' => $this->connectivity->stateFor($shop),
                'server_time' => now()->toIso8601String(),
                'heartbeat_interval_seconds' => (int) config('hajjmart.offline_commerce.heartbeat_interval_seconds', 25),
            ], $result['device_token'] ? 'Offline device registered.' : 'Offline device already registered.');
        } catch (StoreDeviceException $exception) {
            return $this->error($exception->getMessage(), $exception->status, code: $exception->reasonCode);
        }
    }

    public function heartbeat(Request $request)
    {
        $data = $request->validate([
            'shop_id' => ['nullable', 'integer'],
            'app_version' => ['nullable', 'string', 'max:100'],
        ]);

        try {
            $device = $this->devices->verify(
                (string) $request->header('X-HajjMart-Device-Id'),
                (string) $request->header('X-HajjMart-Device-Token'),
            );

            if (isset($data['shop_id']) && (int) $data['shop_id'] !== (int) $device->shop_id) {
                throw new StoreDeviceException('store_device_store_mismatch', 'This device is registered to a different store.');
            }

            $device = $this->devices->heartbeat($device, $request->user(), $data['app_version'] ?? null);
            $shop = $device->shop->refresh();
            $shop->setRelation('storeDevice', $device);
            $session = $this->offlineSessions->unresolvedForDevice($device);
            $snapshotRevision = $session ? (int) $session->opening_inventory_revision : null;
            $snapshotStale = $session ? $this->offlineSessions->startupState($session)['is_stale'] : false;
            $refreshRecommended = ! $session
                || ($session->status === 'open' && ($snapshotStale || $snapshotRevision !== (int) $shop->inventory_revision));

            return $this->success([
                'shop' => $this->shopData($shop),
                'device' => $this->devices->publicData($device),
                'connectivity_state' => $this->connectivity->stateFor($shop),
                'binding_version' => (int) $device->binding_version,
                'server_inventory_revision' => (int) $shop->inventory_revision,
                'active_session_id' => $session?->session_id,
                'snapshot_inventory_revision' => $snapshotRevision,
                'snapshot_refresh_recommended' => $refreshRecommended,
                'server_time' => now()->toIso8601String(),
                'heartbeat_interval_seconds' => (int) config('hajjmart.offline_commerce.heartbeat_interval_seconds', 25),
            ], 'Device heartbeat received.');
        } catch (StoreDeviceException $exception) {
            return $this->error($exception->getMessage(), $exception->status, code: $exception->reasonCode);
        }
    }

    public function replace(Request $request)
    {
        $data = $request->validate([
            'shop_id' => ['required', 'integer', 'exists:shops,id'],
            'device_uuid' => ['required', 'uuid'],
            'app_version' => ['nullable', 'string', 'max:100'],
        ]);

        try {
            $shop = Shop::query()->findOrFail($data['shop_id']);
            $result = $this->devices->replace($shop, $data['device_uuid'], $request->user(), $data['app_version'] ?? null);
            $shop->setRelation('storeDevice', $result['device']);

            return $this->success([
                'shop' => $this->shopData($shop),
                'device' => $this->devices->publicData($result['device']),
                'device_token' => $result['device_token'],
                'connectivity_state' => $this->connectivity->stateFor($shop),
                'server_time' => now()->toIso8601String(),
                'heartbeat_interval_seconds' => (int) config('hajjmart.offline_commerce.heartbeat_interval_seconds', 25),
            ], 'Offline device replaced.');
        } catch (StoreDeviceException $exception) {
            return $this->error($exception->getMessage(), $exception->status, code: $exception->reasonCode);
        }
    }

    public function release(Request $request)
    {
        $data = $request->validate([
            'shop_id' => ['required', 'integer', 'exists:shops,id'],
            'last_local_sequence' => ['nullable', 'integer'],
            'unsynced_v2_event_count' => ['nullable', 'integer'],
        ]);

        try {
            $device = $this->devices->verify(
                (string) $request->header('X-HajjMart-Device-Id'),
                (string) $request->header('X-HajjMart-Device-Token'),
            );
            $shop = Shop::query()->findOrFail($data['shop_id']);
            $result = $this->devices->release($shop, $device, $request->user(), $data);

            return $this->success([
                'released' => true,
                'shop' => $this->shopData($shop),
                'connectivity_state' => $this->connectivity->stateFor($shop),
                'server_time' => now()->toIso8601String(),
            ], 'Offline device access released.');
        } catch (StoreDeviceException $exception) {
            return $this->error($exception->getMessage(), $exception->status, code: $exception->reasonCode);
        }
    }

    private function shopData(Shop $shop): array
    {
        return ['id' => (int) $shop->id, 'name' => $shop->name, 'code' => $shop->code, 'is_active' => (bool) $shop->is_active];
    }
}
