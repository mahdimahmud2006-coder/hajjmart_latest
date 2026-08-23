<?php

namespace App\Services;

use App\Exceptions\OfflineSessionException;
use App\Exceptions\StoreDeviceException;
use App\Models\OfflineInventorySession;
use App\Models\StoreDevice;

class OfflineSessionService
{
    private const UNRESOLVED = ['open', 'reconciling', 'recovery_required'];

    public function unresolvedForDevice(StoreDevice $device): ?OfflineInventorySession
    {
        return OfflineInventorySession::query()
            ->where('store_device_id', $device->id)
            ->where('binding_version', $device->binding_version)
            ->whereIn('status', self::UNRESOLVED)
            ->latest('id')
            ->first();
    }

    public function forDevice(StoreDevice $device, string $sessionId): OfflineInventorySession
    {
        $session = OfflineInventorySession::query()
            ->where('session_id', $sessionId)
            ->where('store_device_id', $device->id)
            ->where('binding_version', $device->binding_version)
            ->first();

        if (! $session) {
            throw new OfflineSessionException('offline_session_not_found', 'This offline session is not available for the registered store device.', 404);
        }

        return $session;
    }

    public function assertDeviceReplacementAllowed(StoreDevice $device): void
    {
        if (OfflineInventorySession::query()
            ->where('store_device_id', $device->id)
            ->where('binding_version', $device->binding_version)
            ->whereIn('status', self::UNRESOLVED)
            ->exists()) {
            throw new StoreDeviceException(
                'offline_session_requires_resolution',
                'This store has an offline session that must be resolved before replacing its device.',
            );
        }
    }

    public function assertDeviceReleaseAllowed(StoreDevice $device, array $clientMeta = []): void
    {
        if ($device->operational_state === StoreConnectivityService::RECONCILING) {
            throw new StoreDeviceException('offline_device_release_reconciling', 'Cannot release device while reconciliation is running.', 409);
        }
        if ($device->operational_state === StoreConnectivityService::RECOVERY_REQUIRED) {
            throw new StoreDeviceException('offline_device_release_recovery_required', 'Cannot release device while recovery is required.', 409);
        }

        $session = OfflineInventorySession::query()
            ->where('store_device_id', $device->id)
            ->where('binding_version', $device->binding_version)
            ->whereIn('status', ['open', 'reconciling', 'recovery_required'])
            ->latest('id')
            ->first();

        if ($session) {
            if ($session->status === 'reconciling') {
                throw new StoreDeviceException('offline_device_release_reconciling', 'Cannot release device while session reconciliation is running.', 409);
            }
            if ($session->status === 'recovery_required') {
                throw new StoreDeviceException('offline_device_release_recovery_required', 'Cannot release device while session recovery is required.', 409);
            }

            $lastServerSeq = (int) $session->last_client_sequence;
            $clientLastSeq = (int) ($clientMeta['last_local_sequence'] ?? 0);
            $clientUnsynced = (int) ($clientMeta['unsynced_v2_event_count'] ?? 0);

            if ($clientUnsynced > 0 || ($clientLastSeq > 0 && $clientLastSeq > $lastServerSeq)) {
                throw new StoreDeviceException('offline_device_release_requires_sync', 'Sync this device before moving offline access to another device.', 422);
            }
        }
    }

    public function startupState(OfflineInventorySession $session, bool $continuousSession = false): array
    {
        $maxAgeHours = max(1, (int) config('hajjmart.offline_commerce.offline_snapshot_startup_max_age_hours', 24));
        $ageSeconds = max(0, $session->boundary_server_at->diffInSeconds(now()));
        $stale = $ageSeconds > ($maxAgeHours * 3600);
        $allowed = ! $stale || $continuousSession;

        return [
            'max_age_hours' => $maxAgeHours,
            'age_seconds' => $ageSeconds,
            'is_stale' => $stale,
            'continuous_session' => $continuousSession,
            'startup_allowed' => $allowed,
            'reason_code' => $allowed ? null : 'offline_snapshot_too_old',
        ];
    }

    public function publicData(OfflineInventorySession $session, bool $continuousSession = false): array
    {
        return [
            'session_id' => $session->session_id,
            'snapshot_id' => $session->snapshot_id,
            'shop_id' => (int) $session->shop_id,
            'binding_version' => (int) $session->binding_version,
            'boundary_server_at' => $session->boundary_server_at?->toIso8601String(),
            'opening_inventory_revision' => (int) $session->opening_inventory_revision,
            'status' => $session->status,
            'opened_at' => $session->opened_at?->toIso8601String(),
            'last_client_sequence' => (int) $session->last_client_sequence,
            'reconciling_at' => $session->reconciling_at?->toIso8601String(),
            'closed_at' => $session->closed_at?->toIso8601String(),
            'recovery_reason_code' => $session->recovery_reason_code,
            'startup' => $this->startupState($session, $continuousSession),
        ];
    }
}
