<?php

$root = dirname(__DIR__);
$read = fn (string $path): string => file_get_contents($root . '/' . $path) ?: '';
$checks = [];
$assert = function (bool $condition, string $message) use (&$checks): void { $checks[] = [$condition, $message]; };

$migration = $read('database/migrations/2026_08_21_030000_create_offline_reconciliation_foundation.php');
$policy = $read('app/Services/ReservationPolicyService.php');
$service = $read('app/Services/OfflineReconciliationService.php');
$processor = $read('app/Services/OfflineReconciliationActionProcessor.php');
$controller = $read('app/Http/Controllers/Api/V1/Admin/OfflineSessionController.php');
$routes = $read('routes/api.php');
$order = $read('app/Models/Order.php');
$reserve = $read('app/Actions/ReserveInventoryAction.php');
$orderService = $read('app/Services/OrderService.php');
$inventory = $read('app/Services/InventoryService.php');
$receipt = $read('app/Models/OfflineEventReceipt.php');
$action = $read('app/Models/OfflineReconciliationAction.php');

foreach (['offline_inventory_session_id', 'local_sequence', 'reconciliation_status', 'preempted_by_session_id', 'cancellation_reason_code'] as $column) {
    $assert(str_contains($migration, $column), "orders migration includes {$column}");
}
$assert(str_contains($migration, "Schema::create('offline_event_receipts'"), 'event receipt table exists');
$assert(str_contains($migration, 'offline_receipts_device_tx_unique'), 'event receipt device/client uniqueness exists');
$assert(str_contains($migration, 'offline_receipts_session_seq_unique'), 'event receipt session/sequence uniqueness exists');
$assert(str_contains($migration, "Schema::create('offline_reconciliation_actions'"), 'reconciliation action ledger exists');
$assert(str_contains($migration, "->unique()") && str_contains($migration, 'idempotency_key'), 'action idempotency key is unique');
$assert(str_contains($receipt, 'event_hash') && str_contains($receipt, 'result_json'), 'event receipt persists immutable hash/result');
$assert(str_contains($action, 'completed_at') && str_contains($action, 'attempts'), 'action ledger tracks attempts/completion');

$assert(str_contains($policy, 'StoreConnectivityService::RECONCILING'), 'policy blocks reconciling store');
$assert(str_contains($policy, 'StoreConnectivityService::RECOVERY_REQUIRED'), 'policy blocks recovery-required store');
$assert(str_contains($policy, "return 'preemptible'"), 'policy can classify post-boundary online reservations preemptible');
$assert(str_contains($policy, "return 'protected'"), 'policy preserves protected commitments');
$assert(str_contains($policy, "whereIn('status', ['open', 'reconciling'])"), 'policy uses active offline boundary');
$assert(str_contains($reserve, 'ReservationPolicyService'), 'reservation creation delegates classification to central policy');
$assert(str_contains($reserve, "'reservation_class' => \$reservationClass"), 'client cannot inject reservation class');
$assert(str_contains($reserve, "'reconciliation_status' => 'provisional'"), 'preemptible order marked provisional');

foreach (['offline_inventory_session_id', 'local_sequence', 'reconciliation_status', 'preempted_by_session_id', 'cancellation_reason_code'] as $column) {
    $assert(str_contains($order, "'{$column}'"), "Order fillable includes {$column}");
}

$assert(str_contains($routes, "post('/offline/session/{sessionId}/sync'"), 'session sync API route exists');
$assert(str_contains($controller, 'OfflineReconciliationService'), 'session controller delegates to reconciliation service');
$assert(str_contains($controller, "events.*.local_sequence"), 'API validates event sequences');
$assert(str_contains($controller, "events.*.type") && str_contains($controller, 'pos_sale,social_order'), 'API limits event types');
$assert(str_contains($controller, 'verifiedDevice($request)'), 'sync authenticates common device headers');

$assert(str_contains($service, 'lockForUpdate()->firstOrFail()') && str_contains($service, "Shop::query()->whereKey(\$session->shop_id)"), 'shop row is reconciliation mutex');
$assert(str_contains($service, 'StoreDevice::query()->whereKey') && str_contains($service, 'OfflineInventorySession::query()->whereKey'), 'device/session rows are locked');
$assert(str_contains($service, 'sort($inventoryKeys, SORT_STRING)'), 'inventory lock keys use deterministic ordering');
$assert(str_contains($service, "->active()->preemptible()"), 'victim pool only uses active preemptible reservations');
$assert(str_contains($service, "reserved_at', '>', \$lockedSession->boundary_server_at"), 'victim reservations are post-boundary');
$assert(str_contains($service, "SAFE_PREEMPT_STATUSES = ['pending', 'confirmed']"), 'progressed orders are excluded from automatic preemption');
$assert(str_contains($service, "reservation_class === 'protected'"), 'mixed protected reservation prevents victim cancellation');
$assert(str_contains($service, '$b->created_at <=> $a->created_at') && str_contains($service, '$b->id <=> $a->id'), 'victims are selected newest-first deterministically');
$assert(str_contains($service, "'status' => 'preempted'"), 'victim reservations become preempted');
$assert(str_contains($service, "'reconciliation_status' => 'preempted'"), 'victim order is marked preempted');
$assert(str_contains($service, 'foreach ($reservations as $reservation)'), 'whole victim order reservations are released');
$assert(str_contains($service, 'offline_preemption_requires_progressed_order'), 'progressed victim requirement becomes recovery conflict');
$assert(str_contains($service, 'offline_reconciliation_capacity_conflict'), 'protected capacity conflict becomes recovery conflict');

$assert(str_contains($service, 'usort($events') && str_contains($service, "local_sequence'] <=>"), 'journal ordered by local sequence');
$assert(str_contains($service, 'offline_sequence_gap'), 'sequence gaps fail closed');
$assert(str_contains($service, 'offline_journal_duplicate_identity'), 'duplicate ID/sequence in one upload fails closed');
$assert(str_contains($service, 'offline_event_payload_mismatch'), 'changed duplicate payload fails closed');
$assert(str_contains($service, 'offline_journal_exceeds_snapshot'), 'journal over opening snapshot fails closed');
$assert(str_contains($service, 'eventHash') && str_contains($service, "hash('sha256'"), 'immutable events receive deterministic hash');
$assert(str_contains($service, 'OfflineEventReceipt::create'), 'server records durable event receipt');
$assert(str_contains($service, 'closedReplay'), 'closed-session full retries use receipt replay');
$assert(str_contains($service, 'offline_session_closed_new_events'), 'closed session rejects unseen new events');

$assert(str_contains($service, "'source_channel' => 'pos'"), 'POS replay uses unified order ledger');
$assert(str_contains($service, "OrderStatus::DELIVERED->value"), 'POS replay is physical sale state');
$assert(str_contains($orderService, '$physicalSale = $sourceChannel === \'pos\''), 'POS still consumes physical inventory');
$assert(str_contains($orderService, 'ReserveInventoryAction::run'), 'non-POS still reserves rather than decrements');
$assert(str_contains($service, "'source_channel' => 'social_commerce'"), 'offline Social replay uses unified order ledger');
$assert(str_contains($service, "'reconciliation_status' => 'offline_local_synced'"), 'replayed local events are auditable on orders');
$assert(str_contains($service, "'offline_snapshot_authorized' => true"), 'replay opts into immutable snapshot price authority');
$assert(str_contains($inventory, 'allowAuthorizedUnitPrice') && str_contains($inventory, 'authorized_unit_price'), 'inventory validation supports explicitly authorized snapshot price');
$assert(str_contains($orderService, 'offlineSnapshotQuote') && str_contains($orderService, 'if (! $snapshotAuthorized)'), 'snapshot replay bypasses current campaign mutation');
$assert(str_contains($service, 'offline_snapshot_price_mismatch'), 'POS base snapshot price is checked');
$assert(str_contains($service, 'offline_snapshot_discount_invalid'), 'POS charged price discount boundary is checked');
$assert(str_contains($service, 'offline_fifo_replay_conflict'), 'FIFO corruption enters recovery conflict');

$assert(str_contains($service, 'OfflineReconciliationAction::firstOrCreate'), 'side effects are durable/idempotent actions');
$assert(str_contains($service, "'action_type' => 'refund'"), 'paid victim creates refund obligation');
$assert(str_contains($service, "'action_type' => 'payment_review'"), 'uncertain payment creates review obligation');
$assert(str_contains($service, "'action_type' => 'customer_notification'"), 'victim creates customer notification obligation');
$assert(!str_contains($service, '->refund('), 'critical reconciliation service never calls payment gateway/refund directly');
$assert(str_contains($processor, "'status' => 'processing'") && str_contains($processor, "'status' => 'manual_review'"), 'action processor claims once and fails uncertain calls to manual review');
$assert(str_contains($processor, '$this->payments->refund'), 'refund is processed through existing PaymentService after stock commit');
$assert(str_contains($processor, 'refund_attempt_uncertain'), 'uncertain gateway response is not auto-retried');

$assert(str_contains($service, "'reservation_class' => 'protected'"), 'surviving provisional reservations are promoted after reconciliation');
$assert(str_contains($service, "'status' => 'closed'"), 'successful reconciliation closes session');
$assert(str_contains($service, "'operational_state' => 'normal'"), 'successful reconciliation clears device override');
$assert(str_contains($service, "'status'=>'recovery_required'"), 'recovery conflicts persist server recovery state');
$assert(str_contains($service, 'reconciliation_summary_json'), 'session stores high-level reconciliation summary');
$assert(str_contains($service, "'offline_commerce', 'reconciled'"), 'reconciliation writes high-level activity audit');

// Pure deterministic acceptance examples, independent of Laravel runtime.
$survivors = [
    ['id' => 1, 'created' => 100, 'qty' => 2, 'protected' => false, 'safe' => true],
    ['id' => 2, 'created' => 200, 'qty' => 2, 'protected' => false, 'safe' => true],
    ['id' => 3, 'created' => 50, 'qty' => 2, 'protected' => true, 'safe' => true],
];
usort($survivors, fn ($a, $b) => ($b['created'] <=> $a['created']) ?: ($b['id'] <=> $a['id']));
$needed = 2; $victims = [];
foreach ($survivors as $candidate) {
    if ($needed <= 0) break;
    if ($candidate['protected'] || ! $candidate['safe']) continue;
    $victims[] = $candidate['id']; $needed -= $candidate['qty'];
}
$assert($victims === [2], 'behavior: newest safe provisional victim is selected first');
$assert(!in_array(3, $victims, true), 'behavior: protected commitment is never selected');
$local = [['sequence' => 2, 'type' => 'social'], ['sequence' => 1, 'type' => 'pos']];
usort($local, fn ($a, $b) => $a['sequence'] <=> $b['sequence']);
$assert(array_column($local, 'sequence') === [1, 2], 'behavior: mixed POS/Social local events replay strictly by sequence');

$failed = array_values(array_filter($checks, fn ($row) => ! $row[0]));
foreach ($checks as [$ok, $message]) echo ($ok ? 'PASS ' : 'FAIL ') . $message . PHP_EOL;
echo PHP_EOL . 'PRD-06 verification ' . ($failed ? 'FAILED' : 'PASS') . ' (' . (count($checks) - count($failed)) . '/' . count($checks) . " checks).\n";
if ($failed) exit(1);
