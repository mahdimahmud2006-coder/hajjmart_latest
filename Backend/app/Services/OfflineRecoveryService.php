<?php

namespace App\Services;

use App\Models\OfflineInventorySession;
use App\Models\OfflineRecoveryCase;
use App\Models\Shop;
use App\Models\StoreDevice;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class OfflineRecoveryService
{
    public function __construct(
        private StoreDeviceService $deviceService,
        private StoreConnectivityService $connectivity,
        private ActivityLogService $activityLog,
        private InventoryService $inventoryService
    ) {}

    /**
     * Initiate lost/destroyed device recovery protocol for a store.
     */
    public function initiateLostDeviceProtocol(int $shopId, ?int $adminId = null, ?string $notes = null): OfflineRecoveryCase
    {
        return DB::transaction(function () use ($shopId, $adminId, $notes): OfflineRecoveryCase {
            $shop = Shop::query()->findOrFail($shopId);
            $device = StoreDevice::query()->where('shop_id', $shopId)->where('status', 'active')->first();

            $lastSession = OfflineInventorySession::query()
                ->where('shop_id', $shopId)
                ->latest('id')
                ->first();

            if ($device) {
                $device->update([
                    'status' => 'revoked',
                    'revoked_at' => now(),
                    'revocation_reason' => 'lost_device_protocol',
                ]);
            }

            $case = OfflineRecoveryCase::create([
                'case_number' => 'REC-' . strtoupper(Str::random(8)),
                'shop_id' => $shopId,
                'store_device_id' => $device?->id,
                'offline_inventory_session_id' => $lastSession?->id,
                'reason_code' => 'lost_device_possible_unsynced_events',
                'status' => 'open',
                'opened_at' => now(),
                'opened_by_user_id' => $adminId,
                'evidence_json' => [
                    'last_heartbeat' => $device?->last_heartbeat_at?->toIso8601String(),
                    'last_sync' => $device?->last_successful_sync_at?->toIso8601String(),
                    'last_session_boundary' => $lastSession?->boundary_server_at?->toIso8601String(),
                    'notes' => $notes,
                ],
            ]);

            $this->activityLog->record(
                'recovery',
                'recovery_case_opened',
                "Initiated lost device recovery protocol case {$case->case_number} for store {$shop->name}.",
                $shop,
                [],
                [
                    'case_id' => $case->id,
                    'case_number' => $case->case_number,
                    'device_id' => $device?->id,
                ],
                $adminId,
                $shop->id
            );

            return $case;
        });
    }

    public function recordPhysicalCountEvidence(int $caseId, array $physicalCounts, int $adminId): OfflineRecoveryCase
    {
        return DB::transaction(function () use ($caseId, $physicalCounts, $adminId): OfflineRecoveryCase {
            $case = OfflineRecoveryCase::query()->findOrFail($caseId);
            if ($case->status === 'resolved') {
                throw new RuntimeException('Recovery case is already resolved.');
            }

            $evidence = $case->evidence_json ?? [];
            $evidence['physical_counts'] = $physicalCounts;
            $evidence['physical_count_recorded_at'] = now()->toIso8601String();
            $evidence['physical_count_recorded_by'] = $adminId;

            $case->update(['evidence_json' => $evidence]);

            $this->activityLog->record(
                'recovery',
                'physical_count_evidence_recorded',
                "Recorded physical stock count evidence for recovery case {$case->case_number}.",
                $case,
                [],
                ['physical_counts_count' => count($physicalCounts)],
                $adminId,
                $case->shop_id
            );

            return $case->fresh();
        });
    }

    public function recordManualRecoveryOrder(int $caseId, array $payload, int $adminId): \App\Models\Order
    {
        return DB::transaction(function () use ($caseId, $payload, $adminId): \App\Models\Order {
            $case = OfflineRecoveryCase::query()->findOrFail($caseId);
            if ($case->status === 'resolved') {
                throw new RuntimeException('Recovery case is already resolved.');
            }

            $reference = $payload['manual_outage_reference'] ?? null;
            if ($reference) {
                $existing = \App\Models\Order::query()
                    ->where('offline_recovery_case_id', $caseId)
                    ->where('manual_outage_reference', $reference)
                    ->first();
                if ($existing) {
                    return $existing;
                }
            }

            $sourceChannel = strtolower((string) ($payload['source_channel'] ?? 'pos'));
            $orderPayload = array_merge([
                'status' => $sourceChannel === 'pos' ? 'delivered' : 'confirmed',
                'payment_method' => $payload['payment_method'] ?? 'cash',
            ], $payload, [
                'source_channel' => $sourceChannel,
                'shop_id' => $case->shop_id,
                'created_by' => $adminId,
                'offline_recovery_case_id' => $caseId,
                'manual_outage_reference' => $reference,
                'manual_outage_occurred_at' => $payload['manual_outage_occurred_at'] ?? now(),
            ]);

            /** @var OrderService $orderService */
            $orderService = app(OrderService::class);
            $order = $orderService->place($orderPayload);

            $evidence = $case->evidence_json ?? [];
            $manualOrders = $evidence['manual_recovery_orders'] ?? [];
            $manualOrders[] = [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'reference' => $reference,
                'source_channel' => $order->source_channel,
                'created_at' => now()->toIso8601String(),
            ];
            $evidence['manual_recovery_orders'] = $manualOrders;
            $case->update(['evidence_json' => $evidence]);

            $this->activityLog->record(
                'recovery',
                'manual_recovery_order_created',
                "Reconstructed paper transaction {$order->order_number} for recovery case {$case->case_number}.",
                $order,
                [],
                ['case_id' => $caseId, 'order_id' => $order->id, 'reference' => $reference],
                $adminId,
                $case->shop_id
            );

            return $order;
        });
    }

    /**
     * Resolve recovery case after physical stock count & bind replacement device.
     */
    public function resolveLostDeviceProtocol(
        int $caseId,
        int $adminId,
        array $inventoryAdjustments = [],
        ?string $resolutionNotes = null,
        ?string $newDeviceName = null
    ): array {
        return DB::transaction(function () use ($caseId, $adminId, $inventoryAdjustments, $resolutionNotes, $newDeviceName): array {
            $case = OfflineRecoveryCase::query()->with(['shop', 'storeDevice'])->findOrFail($caseId);
            if ($case->status === 'resolved') {
                throw new RuntimeException('Recovery case is already resolved.');
            }

            $evidence = $case->evidence_json ?? [];
            if (empty($evidence['physical_counts']) && empty($inventoryAdjustments)) {
                throw new RuntimeException('Physical count evidence is required before resolving a lost-device recovery case.');
            }

            $shop = $case->shop;

            // Apply physical inventory corrections if provided under reconciliation bypass
            \App\Services\OfflineStockMutationGuard::bypassForReconciliation(function () use ($inventoryAdjustments, $shop, $case, $adminId) {
                foreach ($inventoryAdjustments as $adj) {
                    if (isset($adj['product_id'], $adj['actual_quantity'])) {
                        $productId = (int) $adj['product_id'];
                        $variantId = isset($adj['variant_id']) ? (int) $adj['variant_id'] : null;
                        $actualQty = (int) $adj['actual_quantity'];

                        $inventory = $this->inventoryService->inventoryRow($productId, $variantId, $shop->id);
                        $diff = $actualQty - (int) $inventory->quantity;
                        if ($diff !== 0) {
                            $this->inventoryService->adjust(
                                $productId,
                                $variantId,
                                $diff,
                                "Lost device physical stock count adjustment: {$case->case_number}",
                                $adminId,
                                $shop->id
                            );
                        }
                    }
                }
            });

            // Verify inventory integrity before closing
            $integrity = app(InventoryIntegrityService::class)->verifyShopIntegrity($shop->id);
            if (! empty($integrity['violations'])) {
                throw new RuntimeException('Inventory integrity checks failed: ' . json_encode($integrity['violations']));
            }

            // Close any open session for the shop
            OfflineInventorySession::query()
                ->where('shop_id', $shop->id)
                ->whereIn('status', ['open', 'reconciling'])
                ->update([
                    'status' => 'closed',
                    'closed_at' => now(),
                    'recovery_reason_code' => 'lost_device_resolved',
                ]);

            // Retire/revoke old device binding so StoreDeviceService::register can bind Device B
            if ($case->storeDevice) {
                $case->storeDevice->update([
                    'status' => 'revoked',
                    'revoked_at' => now(),
                    'revocation_reason' => 'lost_device_resolved',
                ]);
            }

            $case->update([
                'status' => 'resolved',
                'resolution_action' => 'physical_count_and_device_replacement',
                'resolved_at' => now(),
                'resolved_by_user_id' => $adminId,
                'evidence_json' => array_merge($case->evidence_json ?? [], [
                    'resolution_notes' => $resolutionNotes,
                    'inventory_adjustments_count' => count($inventoryAdjustments),
                ]),
            ]);

            $this->activityLog->record(
                'recovery',
                'recovery_case_resolved',
                "Resolved lost device recovery case {$case->case_number} for store {$shop->name}.",
                $shop,
                [],
                [
                    'case_id' => $case->id,
                ],
                $adminId,
                $shop->id
            );

            $newDeviceResult = null;
            if ($newDeviceName) {
                $actor = User::find($adminId) ?? User::factory()->make();
                $newDeviceResult = $this->deviceService->register($shop, (string) Str::uuid(), $actor);
            }

            return [
                'recovery_case' => $case->fresh(),
                'replacement_device' => $newDeviceResult ? $newDeviceResult['device'] : null,
                'registration_token' => $newDeviceResult ? $newDeviceResult['device_token'] : null,
            ];
        });
    }
}
