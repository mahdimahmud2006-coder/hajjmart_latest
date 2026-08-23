<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\OfflineSessionException;
use App\Exceptions\OfflineReconciliationException;
use App\Exceptions\StoreDeviceException;
use App\Http\Controllers\Controller;
use App\Services\OfflineSessionService;
use App\Services\OfflineReconciliationService;
use App\Services\OfflineSnapshotService;
use App\Services\StoreDeviceService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class OfflineSessionController extends Controller
{
    use ApiResponse;

    public function __construct(
        private StoreDeviceService $devices,
        private OfflineSnapshotService $snapshots,
        private OfflineSessionService $sessions,
        private OfflineReconciliationService $reconciliation,
    ) {}

    public function bootstrap(Request $request)
    {
        $data = $request->validate([
            'shop_id' => ['nullable', 'integer'],
            'client_app_version' => ['nullable', 'string', 'max:100'],
            'client_schema_version' => ['nullable', 'string', 'max:50'],
            'unsynced_event_count' => ['nullable', 'integer', 'min:0'],
            'last_known_session_id' => ['nullable', 'uuid'],
            'last_local_sequence' => ['nullable', 'integer', 'min:0'],
            'refresh_snapshot' => ['nullable', 'boolean'],
        ]);

        try {
            $device = $this->verifiedDevice($request, $data['shop_id'] ?? null);
            return $this->success($this->snapshots->bootstrap($device, $data), 'Offline stock snapshot ready.');
        } catch (StoreDeviceException|OfflineSessionException $exception) {
            return $this->error($exception->getMessage(), $exception->status, code: $exception->reasonCode);
        }
    }

    public function sync(Request $request, string $sessionId)
    {
        $data = $request->validate([
            'snapshot_id' => ['required', 'uuid'],
            'events' => ['required', 'array'],
            'events.*.client_transaction_id' => ['required', 'uuid'],
            'events.*.local_sequence' => ['required', 'integer', 'min:1'],
            'events.*.type' => ['required', 'in:pos_sale,social_order'],
            'events.*.offline_created_at' => ['nullable', 'date'],
            'events.*.items' => ['required', 'array', 'min:1'],
            'events.*.items.*.product_id' => ['nullable', 'integer', 'min:1'],
            'events.*.items.*.productId' => ['nullable', 'integer', 'min:1'],
            'events.*.items.*.variant_id' => ['nullable', 'integer', 'min:1'],
            'events.*.items.*.variantId' => ['nullable', 'integer', 'min:1'],
            'events.*.items.*.quantity' => ['required', 'integer', 'min:1'],
            'events.*.payload' => ['nullable', 'array'],
        ]);

        try {
            $device = $this->verifiedDevice($request);
            $session = $this->sessions->forDevice($device, $sessionId);
            return $this->success(
                $this->reconciliation->reconcile($device, $session, $data, $request->user()?->id),
                'Offline session reconciled.',
            );
        } catch (StoreDeviceException|OfflineSessionException|OfflineReconciliationException $exception) {
            return $this->error($exception->getMessage(), $exception->status, code: $exception->reasonCode);
        }
    }

    public function status(Request $request, string $sessionId)
    {
        $data = $request->validate([
            'shop_id' => ['nullable', 'integer'],
            'continuous_session' => ['nullable', 'boolean'],
        ]);

        try {
            $device = $this->verifiedDevice($request, $data['shop_id'] ?? null);
            $session = $this->sessions->forDevice($device, $sessionId);

            return $this->success([
                'device' => [
                    'device_uuid' => $device->device_uuid,
                    'binding_version' => (int) $device->binding_version,
                    'shop_id' => (int) $device->shop_id,
                ],
                'session' => $this->sessions->publicData($session, (bool) ($data['continuous_session'] ?? false)),
                'server_inventory_revision' => (int) $device->shop->inventory_revision,
                'server_time' => now()->toIso8601String(),
            ], 'Offline session status retrieved.');
        } catch (StoreDeviceException|OfflineSessionException $exception) {
            return $this->error($exception->getMessage(), $exception->status, code: $exception->reasonCode);
        }
    }

    private function verifiedDevice(Request $request, ?int $assertedShopId = null)
    {
        $device = $this->devices->verify(
            (string) $request->header('X-HajjMart-Device-Id'),
            (string) $request->header('X-HajjMart-Device-Token'),
        );

        if ($assertedShopId !== null && $assertedShopId !== (int) $device->shop_id) {
            throw new StoreDeviceException('store_device_store_mismatch', 'This device is registered to a different store.');
        }

        return $device;
    }
}
