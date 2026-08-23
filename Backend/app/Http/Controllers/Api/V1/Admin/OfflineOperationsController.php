<?php

namespace App\Http\Controllers\Api/V1/Admin;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessOfflineReconciliationAction;
use App\Models\OfflineInventorySession;
use App\Models\OfflineReconciliationAction;
use App\Models\OfflineRecoveryCase;
use App\Models\Order;
use App\Models\Shop;
use App\Models\StoreDevice;
use App\Services\OfflineRecoveryService;
use App\Services\StoreConnectivityService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OfflineOperationsController extends Controller
{
    public function __construct(
        private StoreConnectivityService $connectivity,
        private OfflineRecoveryService $recoveryService
    ) {}

    /**
     * Get authoritative operational status across all stores.
     */
    public function status(Request $request): JsonResponse
    {
        $shops = Shop::query()->with(['storeDevice'])->get();
        $storeStatuses = [];

        foreach ($shops as $shop) {
            $state = $this->connectivity->stateFor($shop);
            $device = $shop->storeDevice;

            $lastSession = OfflineInventorySession::query()
                ->where('shop_id', $shop->id)
                ->latest('id')
                ->first();

            $provisionalOrdersCount = Order::query()
                ->where('shop_id', $shop->id)
                ->where('reconciliation_status', 'provisional')
                ->count();

            $reconciliationAttentionCount = OfflineReconciliationAction::query()
                ->whereHas('session', fn ($q) => $q->where('shop_id', $shop->id))
                ->whereIn('status', ['pending', 'failed', 'manual_review'])
                ->count();

            $openRecoveryCase = OfflineRecoveryCase::query()
                ->where('shop_id', $shop->id)
                ->open()
                ->first();

            $snapshotAgeMinutes = $lastSession?->boundary_server_at
                ? (int) now()->diffInMinutes($lastSession->boundary_server_at)
                : null;

            $storeStatuses[] = [
                'shop_id' => $shop->id,
                'shop_name' => $shop->name,
                'shop_code' => $shop->code,
                'connectivity_state' => $state,
                'device_name' => $device?->device_name,
                'device_status' => $device?->status,
                'last_heartbeat_at' => $device?->last_heartbeat_at?->toIso8601String(),
                'last_successful_sync_at' => $device?->last_successful_sync_at?->toIso8601String(),
                'last_snapshot_boundary_at' => $lastSession?->boundary_server_at?->toIso8601String(),
                'snapshot_age_minutes' => $snapshotAgeMinutes,
                'current_session_status' => $lastSession?->status,
                'provisional_orders_count' => $provisionalOrdersCount,
                'reconciliation_attention_count' => $reconciliationAttentionCount,
                'has_open_recovery_case' => (bool) $openRecoveryCase,
                'open_recovery_case_number' => $openRecoveryCase?->case_number,
                'technical_details' => [
                    'device_uuid' => $device?->device_uuid,
                    'binding_version' => $device?->binding_version,
                    'last_session_id' => $lastSession?->session_id,
                    'last_snapshot_id' => $lastSession?->snapshot_id,
                ],
            ];
        }

        $summary = [
            'stores_count' => count($storeStatuses),
            'stores_offline_count' => count(array_filter($storeStatuses, fn ($s) => in_array($s['connectivity_state'], ['offline_suspected', 'offline_confirmed'], true))),
            'stores_recovery_required_count' => count(array_filter($storeStatuses, fn ($s) => $s['connectivity_state'] === 'recovery_required')),
            'total_provisional_orders' => array_sum(array_column($storeStatuses, 'provisional_orders_count')),
            'total_actions_requiring_attention' => array_sum(array_column($storeStatuses, 'reconciliation_attention_count')),
        ];

        return ApiResponse::success([
            'summary' => $summary,
            'stores' => $storeStatuses,
        ]);
    }

    /**
     * Get filterable list of offline inventory sessions.
     */
    public function sessions(Request $request): JsonResponse
    {
        $query = OfflineInventorySession::query()
            ->with(['shop:id,name,code', 'storeDevice:id,device_name']);

        if ($request->filled('shop_id')) {
            $query->where('shop_id', (int) $request->input('shop_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('from_date')) {
            $query->where('opened_at', '>=', $request->input('from_date'));
        }

        if ($request->filled('to_date')) {
            $query->where('opened_at', '<=', $request->input('to_date'));
        }

        $sessions = $query->latest('id')->paginate($request->integer('per_page', 20));

        return ApiResponse::success($sessions);
    }

    /**
     * Get list of reconciliation actions needing attention or history.
     */
    public function actions(Request $request): JsonResponse
    {
        $query = OfflineReconciliationAction::query()
            ->with(['order:id,order_number,status,payment_status', 'session.shop:id,name']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('action_type')) {
            $query->where('action_type', $request->input('action_type'));
        }

        $actions = $query->latest('id')->paginate($request->integer('per_page', 20));

        return ApiResponse::success($actions);
    }

    /**
     * Idempotently retry a reconciliation action.
     */
    public function retryAction(Request $request, int $id): JsonResponse
    {
        $action = OfflineReconciliationAction::query()->findOrFail($id);

        if (! in_array($action->status, ['pending', 'failed', 'manual_review'], true)) {
            return ApiResponse::error('This reconciliation action cannot be retried.', 422, [], 'action_not_retriable');
        }

        ProcessOfflineReconciliationAction::dispatchSync($action->id, $request->user()?->id);

        return ApiResponse::success([
            'action' => $action->fresh(),
        ], 'Reconciliation action processed successfully.');
    }

    /**
     * List open and resolved recovery cases.
     */
    public function recoveryCases(Request $request): JsonResponse
    {
        $query = OfflineRecoveryCase::query()
            ->with(['shop:id,name,code', 'storeDevice:id,device_name', 'openedBy:id,name', 'resolvedBy:id,name']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('shop_id')) {
            $query->where('shop_id', (int) $request->input('shop_id'));
        }

        $cases = $query->latest('id')->paginate($request->integer('per_page', 20));

        return ApiResponse::success($cases);
    }

    /**
     * Initiate lost device recovery protocol.
     */
    public function initiateLostDevice(Request $request): JsonResponse
    {
        $request->validate([
            'shop_id' => 'required|integer|exists:shops,id',
            'notes' => 'nullable|string|max:1000',
        ]);

        $case = $this->recoveryService->initiateLostDeviceProtocol(
            (int) $request->input('shop_id'),
            $request->user()?->id,
            $request->input('notes')
        );

        return ApiResponse::success($case, 'Lost device recovery protocol initiated.');
    }

    public function recordPhysicalCount(Request $request): JsonResponse
    {
        $request->validate([
            'recovery_case_id' => 'required|integer|exists:offline_recovery_cases,id',
            'physical_counts' => 'required|array',
            'physical_counts.*.product_id' => 'required|integer|exists:products,id',
            'physical_counts.*.variant_id' => 'nullable|integer',
            'physical_counts.*.quantity' => 'required|integer|min:0',
        ]);

        $case = $this->recoveryService->recordPhysicalCountEvidence(
            (int) $request->input('recovery_case_id'),
            $request->input('physical_counts'),
            $request->user()->id
        );

        return ApiResponse::success($case, 'Physical count evidence recorded.');
    }

    public function recordManualOrder(Request $request): JsonResponse
    {
        $request->validate([
            'recovery_case_id' => 'required|integer|exists:offline_recovery_cases,id',
            'source_channel' => 'required|string|in:pos,social_commerce',
            'manual_outage_reference' => 'nullable|string|max:100',
            'manual_outage_occurred_at' => 'nullable|date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.variant_id' => 'nullable|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'customer_name' => 'nullable|string|max:255',
            'mobile_number' => 'nullable|string|max:50',
            'payment_method' => 'nullable|string',
            'paid_amount' => 'nullable|numeric|min:0',
        ]);

        $order = $this->recoveryService->recordManualRecoveryOrder(
            (int) $request->input('recovery_case_id'),
            $request->all(),
            $request->user()->id
        );

        return ApiResponse::success($order, 'Manual recovery paper transaction recorded.');
    }

    public function resolveLostDevice(Request $request): JsonResponse
    {
        $request->validate([
            'recovery_case_id' => 'required|integer|exists:offline_recovery_cases,id',
            'inventory_adjustments' => 'nullable|array',
            'inventory_adjustments.*.product_id' => 'required_with:inventory_adjustments|integer|exists:products,id',
            'inventory_adjustments.*.variant_id' => 'nullable|integer',
            'inventory_adjustments.*.actual_quantity' => 'required_with:inventory_adjustments|integer|min:0',
            'resolution_notes' => 'nullable|string|max:1000',
            'replacement_device_name' => 'nullable|string|max:255',
        ]);

        $result = $this->recoveryService->resolveLostDeviceProtocol(
            (int) $request->input('recovery_case_id'),
            $request->user()->id,
            $request->input('inventory_adjustments', []),
            $request->input('resolution_notes'),
            $request->input('replacement_device_name')
        );

        return ApiResponse::success($result, 'Lost device recovery protocol resolved successfully.');
    }
}
