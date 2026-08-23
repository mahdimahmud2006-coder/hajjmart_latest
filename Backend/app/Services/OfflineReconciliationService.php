<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\OfflineReconciliationException;
use App\Exceptions\InventoryConflictException;
use App\Models\Inventory;
use App\Models\OfflineEventReceipt;
use App\Models\OfflineInventorySession;
use App\Models\OfflineInventorySnapshotItem;
use App\Models\OfflineReconciliationAction;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\ReservedProduct;
use App\Models\Shop;
use App\Models\StoreDevice;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class OfflineReconciliationService
{
    private const PREEMPT_REASON = 'offline_store_precedence_stock_conflict';
    private const SAFE_PREEMPT_STATUSES = ['pending', 'confirmed'];

    public function __construct(
        private InventoryService $inventory,
        private OrderService $orders,
        private ActivityLogService $activities,
        private OfflineReconciliationActionProcessor $actionProcessor,
    ) {}

    public function reconcile(StoreDevice $device, OfflineInventorySession $session, array $input, ?int $actorId = null): array
    {
        try {
            $events = $this->normalizeAndValidateJournal($device, $session, $input);
        } catch (OfflineReconciliationException $exception) {
            if ($exception->requiresRecovery && $session->status !== 'closed') $this->markRecovery($device, $session, $exception->reasonCode);
            throw $exception;
        }
        $hashes = collect($events)->mapWithKeys(fn (array $event): array => [$event['client_transaction_id'] => $this->eventHash($event)])->all();

        if ($session->status === 'closed') {
            $result = $this->closedReplay($device, $session, $events, $hashes);
            $this->actionProcessor->process($session, $actorId);
            $result['actions'] = $session->reconciliationActions()->orderBy('id')->get()->toArray();
            return $result;
        }
        if ($session->status === 'recovery_required') {
            throw new OfflineReconciliationException('offline_session_requires_recovery', 'This offline session needs staff recovery before it can synchronize.', 409, true);
        }

        try {
            $result = DB::transaction(function () use ($device, $session, $events, $hashes, $actorId): array {
                // Shop row is the short per-store reconciliation mutex. ReservationPolicyService
                // takes the same row before accepting a new online reservation.
                $shop = Shop::query()->whereKey($session->shop_id)->lockForUpdate()->firstOrFail();
                $lockedDevice = StoreDevice::query()->whereKey($device->id)->lockForUpdate()->firstOrFail();
                $lockedSession = OfflineInventorySession::query()->whereKey($session->id)->lockForUpdate()->firstOrFail();

                $this->assertLockedAuthority($lockedDevice, $lockedSession, $events);
                $existingReceipts = OfflineEventReceipt::query()
                    ->where('offline_inventory_session_id', $lockedSession->id)
                    ->lockForUpdate()
                    ->get();
                $newEvents = $this->validateSequenceAndReceipts($lockedSession, $events, $hashes, $existingReceipts);

                if ($newEvents === [] && $lockedSession->status === 'closed') {
                    return $this->responseFromReceipts($lockedSession, $existingReceipts);
                }

                $lockedDevice->update(['operational_state' => StoreConnectivityService::RECONCILING]);
                $lockedSession->update(['status' => 'reconciling', 'reconciling_at' => now(), 'recovery_reason_code' => null]);

                $demand = $this->journalDemand($events);
                $affectedKeys = array_keys($demand);
                sort($affectedKeys, SORT_STRING);

                // With the shop mutex held, an online checkout cannot finish classification
                // concurrently. We can inspect candidate reservations, then lock the complete
                // inventory key set in deterministic order before any mutation.
                $candidateRows = ReservedProduct::query()
                    ->active()->preemptible()
                    ->where('shop_id', $shop->id)
                    ->where('reserved_at', '>', $lockedSession->boundary_server_at)
                    ->with('order')
                    ->get();
                $candidateOrderIds = $candidateRows
                    ->filter(fn (ReservedProduct $row): bool => isset($demand[$this->reservationKey($row)]))
                    ->pluck('order_id')->filter()->unique()->values();
                $allCandidateReservations = $candidateOrderIds->isEmpty()
                    ? collect()
                    : ReservedProduct::query()->active()->whereIn('order_id', $candidateOrderIds)->get();
                $inventoryKeys = array_values(array_unique(array_merge($affectedKeys, $allCandidateReservations->map(fn ($row) => $this->reservationKey($row))->all())));
                sort($inventoryKeys, SORT_STRING);
                $inventoryRows = $this->lockInventoryRows($shop->id, $inventoryKeys);

                $lockedReservations = $candidateOrderIds->isEmpty()
                    ? collect()
                    : ReservedProduct::query()->active()->whereIn('order_id', $candidateOrderIds)->orderBy('id')->lockForUpdate()->get();
                $lockedOrders = $candidateOrderIds->isEmpty()
                    ? collect()
                    : Order::query()->whereIn('id', $candidateOrderIds)->orderBy('id')->lockForUpdate()->get()->keyBy('id');

                $capacity = [];
                foreach ($affectedKeys as $key) {
                    $row = $inventoryRows[$key] ?? null;
                    if (! $row) throw new OfflineReconciliationException('offline_inventory_missing', 'A snapshot item no longer has a valid store inventory row.', 409, true);
                    $capacity[$key] = (int) $row->quantity - (int) $row->reserved;
                }
                $deficits = $this->deficits($demand, $capacity);
                $victims = [];

                if ($this->hasDeficit($deficits)) {
                    $ordersByNewest = $lockedOrders->sort(function (Order $a, Order $b): int {
                        $time = $b->created_at <=> $a->created_at;
                        return $time !== 0 ? $time : ($b->id <=> $a->id);
                    });
                    $progressedRequired = [];
                    foreach ($ordersByNewest as $candidate) {
                        $reservations = $lockedReservations->where('order_id', $candidate->id);
                        if (! $this->touchesDeficit($reservations, $deficits)) continue;
                        if ($candidate->offline_inventory_session_id || $candidate->reconciliation_status === 'offline_local_synced') continue;
                        if ($reservations->contains(fn (ReservedProduct $row): bool => $row->reservation_class === 'protected')) {
                            $progressedRequired[] = $candidate->order_number;
                            continue;
                        }
                        if (! in_array(strtolower((string) $candidate->status), self::SAFE_PREEMPT_STATUSES, true)) {
                            $progressedRequired[] = $candidate->order_number;
                            continue;
                        }

                        $fromStatus = (string) $candidate->status;
                        foreach ($reservations as $reservation) {
                            $key = $this->reservationKey($reservation);
                            $inventoryRow = $inventoryRows[$key] ?? null;
                            if (! $inventoryRow) throw new OfflineReconciliationException('offline_inventory_missing', 'A victim reservation has no inventory row.', 409, true);
                            $this->inventory->releaseReservation($inventoryRow, (int) $reservation->qty, $reservation, $actorId);
                            $reservation->update([
                                'status' => 'preempted', 'released_at' => now(), 'release_reason' => self::PREEMPT_REASON,
                                'metadata' => array_merge($reservation->metadata ?? [], ['offline_inventory_session_id' => $lockedSession->id]),
                            ]);
                            $capacity[$key] = ($capacity[$key] ?? 0) + (int) $reservation->qty;
                        }
                        $candidate->update([
                            'status' => OrderStatus::RETURNED->value,
                            'order_status' => OrderStatus::RETURNED->value,
                            'cancelled_at' => now(),
                            'reconciliation_status' => 'preempted',
                            'preempted_by_session_id' => $lockedSession->id,
                            'cancellation_reason_code' => self::PREEMPT_REASON,
                        ]);
                        $candidate->items()->update(['item_status' => OrderStatus::RETURNED->value]);
                        OrderStatusHistory::create([
                            'order_id' => $candidate->id, 'from_status' => $fromStatus,
                            'to_status' => OrderStatus::RETURNED->value, 'changed_by' => $actorId,
                            'note' => 'Cancelled by deterministic offline-store precedence reconciliation.', 'created_at' => now(),
                        ]);
                        $this->createPaymentActions($lockedSession, $candidate);
                        OfflineReconciliationAction::firstOrCreate(
                            ['idempotency_key' => "session:{$lockedSession->id}:customer-notification:order:{$candidate->id}"],
                            ['offline_inventory_session_id' => $lockedSession->id, 'action_type' => 'customer_notification',
                             'order_id' => $candidate->id, 'status' => 'pending', 'reason_code' => self::PREEMPT_REASON,
                             'metadata' => ['order_number' => $candidate->order_number, 'channel' => $candidate->source_channel]],
                        );
                        $victims[] = ['order_id' => $candidate->id, 'order_number' => $candidate->order_number];
                        $deficits = $this->deficits($demand, $capacity);
                        if (! $this->hasDeficit($deficits)) break;
                    }

                    if ($this->hasDeficit($deficits)) {
                        $code = $progressedRequired ? 'offline_preemption_requires_progressed_order' : 'offline_reconciliation_capacity_conflict';
                        throw new OfflineReconciliationException($code, $progressedRequired
                            ? 'A later order has already physically progressed and cannot be automatically preempted. Staff recovery is required.'
                            : 'Protected/current commitments leave insufficient capacity for the valid offline journal.', 409, true);
                    }
                }

                $mappings = [];
                foreach ($events as $event) {
                    $prior = $existingReceipts->firstWhere('client_transaction_id', $event['client_transaction_id']);
                    if ($prior) {
                        $mappings[] = $this->receiptMapping($prior);
                        continue;
                    }
                    $order = $event['type'] === 'pos_sale'
                        ? $this->replayPos($lockedSession, $lockedDevice, $event, $actorId)
                        : $this->replaySocial($lockedSession, $lockedDevice, $event, $actorId);
                    $receipt = OfflineEventReceipt::create([
                        'shop_id' => $lockedSession->shop_id,
                        'store_device_id' => $lockedDevice->id,
                        'offline_inventory_session_id' => $lockedSession->id,
                        'client_transaction_id' => $event['client_transaction_id'],
                        'local_sequence' => $event['local_sequence'],
                        'event_type' => $event['type'],
                        'event_hash' => $hashes[$event['client_transaction_id']],
                        'server_order_id' => $order->id,
                        'result_code' => 'synced',
                        'result_json' => ['order_number' => $order->order_number],
                    ]);
                    $mappings[] = $this->receiptMapping($receipt);
                    if ($event['type'] === 'pos_sale' && (($event['payload']['payment_verification_state'] ?? null) === 'unverified_offline')) {
                        OfflineReconciliationAction::firstOrCreate(
                            ['idempotency_key' => "session:{$lockedSession->id}:pos-payment-review:{$order->id}"],
                            ['offline_inventory_session_id' => $lockedSession->id, 'action_type' => 'payment_review', 'order_id' => $order->id,
                             'status' => 'manual_review', 'reason_code' => 'offline_pos_payment_unverified', 'currency' => $order->currency,
                             'metadata' => ['payment_channel' => $order->payment_channel]],
                        );
                    }
                }

                $this->promoteSurvivors($lockedSession);
                $lastSequence = $events ? max(array_column($events, 'local_sequence')) : (int) $lockedSession->last_client_sequence;
                $summary = [
                    'session_id' => $lockedSession->session_id,
                    'snapshot_id' => $lockedSession->snapshot_id,
                    'sequence_from' => $events ? min(array_column($events, 'local_sequence')) : null,
                    'sequence_to' => $lastSequence,
                    'pos_events' => count(array_filter($events, fn ($e) => $e['type'] === 'pos_sale')),
                    'social_events' => count(array_filter($events, fn ($e) => $e['type'] === 'social_order')),
                    'demand' => $demand,
                    'victims' => $victims,
                    'final_inventory_revision' => (int) $shop->fresh()->inventory_revision,
                    'result' => 'success',
                ];
                $lockedSession->update([
                    'last_client_sequence' => $lastSequence, 'status' => 'closed', 'closed_at' => now(),
                    'reconciliation_summary_json' => $summary, 'reconciling_at' => null,
                ]);
                $lockedDevice->update(['operational_state' => 'normal']);
                $this->activities->record(
                    'offline_commerce', 'reconciled',
                    "Reconciled offline session {$lockedSession->session_id} for store {$shop->name}",
                    $lockedSession, [], $summary, $actorId, $shop->id,
                );

                return ['session' => $summary, 'events' => $mappings, 'actions' => $lockedSession->reconciliationActions()->get()->toArray()];
            }, 3);
            $this->actionProcessor->process($session->fresh(), $actorId);
            $result['actions'] = $session->fresh()->reconciliationActions()->orderBy('id')->get()->toArray();
            return $result;
        } catch (OfflineReconciliationException $exception) {
            if ($exception->requiresRecovery) $this->markRecovery($device, $session, $exception->reasonCode);
            throw $exception;
        }
    }

    private function normalizeAndValidateJournal(StoreDevice $device, OfflineInventorySession $session, array $input): array
    {
        if (! config('hajjmart.offline_commerce_v2_enabled', true)) {
            throw new OfflineReconciliationException('offline_feature_disabled', 'Offline commerce v2 feature is currently disabled.', 403, false);
        }
        if ($device->status !== 'active') {
            throw new OfflineReconciliationException('offline_device_inactive', 'This store device is no longer active for offline reconciliation.', 403, true);
        }
        if (($input['snapshot_id'] ?? null) !== $session->snapshot_id) {
            throw new OfflineReconciliationException('offline_snapshot_mismatch', 'The uploaded journal does not match this session snapshot.', 409, true);
        }
        if ((int) $session->store_device_id !== (int) $device->id || (int) $session->binding_version !== (int) $device->binding_version) {
            throw new OfflineReconciliationException('offline_device_binding_mismatch', 'This session belongs to a different device binding.', 409, true);
        }

        $snapshot = $session->snapshotItems()->get()->keyBy(fn ($row) => $this->key((int) $row->product_id, $row->variant_id ? (int) $row->variant_id : null));
        $events = [];
        $demand = [];
        $seenTransactions = [];
        $seenSequences = [];
        foreach ($input['events'] ?? [] as $raw) {
            $clientId = (string) ($raw['client_transaction_id'] ?? '');
            $sequence = (int) ($raw['local_sequence'] ?? 0);
            $type = (string) ($raw['type'] ?? '');
            if (! Str::isUuid($clientId) || $sequence < 1 || ! in_array($type, ['pos_sale', 'social_order'], true)) {
                throw new OfflineReconciliationException('offline_journal_invalid', 'The offline journal contains an invalid transaction identity, sequence, or event type.', 422, true);
            }
            if (isset($seenTransactions[$clientId]) || isset($seenSequences[$sequence])) {
                throw new OfflineReconciliationException('offline_journal_duplicate_identity', 'The uploaded journal contains a duplicate transaction ID or local sequence.', 409, true);
            }
            $seenTransactions[$clientId] = true;
            $seenSequences[$sequence] = true;
            $items = [];
            foreach ($raw['items'] ?? [] as $item) {
                $productId = (int) ($item['product_id'] ?? $item['productId'] ?? 0);
                $variantId = ($item['variant_id'] ?? $item['variantId'] ?? null) ?: null;
                $variantId = $variantId === null ? null : (int) $variantId;
                $quantity = (int) ($item['quantity'] ?? 0);
                if ($productId < 1 || $quantity < 1) throw new OfflineReconciliationException('offline_journal_invalid_quantity', 'Every offline item must have a positive integer quantity.', 422, true);
                $key = $this->key($productId, $variantId);
                $snap = $snapshot->get($key);
                if (! $snap) throw new OfflineReconciliationException('offline_sku_missing_from_snapshot', 'An offline item is not present in the immutable snapshot.', 409, true);
                $items[] = compact('productId', 'variantId', 'quantity');
                $demand[$key] = ($demand[$key] ?? 0) + $quantity;
            }
            if ($items === []) throw new OfflineReconciliationException('offline_journal_empty_event', 'An offline event cannot be empty.', 422, true);
            $payload = is_array($raw['payload'] ?? null) ? $raw['payload'] : [];
            if (isset($payload['shop_id']) && (int) $payload['shop_id'] !== (int) $session->shop_id) throw new OfflineReconciliationException('offline_payload_store_mismatch', 'An event payload references another store.', 409, true);
            if (isset($payload['terminal_id']) && (string) $payload['terminal_id'] !== (string) $device->device_uuid) throw new OfflineReconciliationException('offline_payload_device_mismatch', 'An event payload references another device.', 409, true);
            $events[] = [
                'client_transaction_id' => $clientId, 'local_sequence' => $sequence, 'type' => $type,
                'offline_created_at' => $raw['offline_created_at'] ?? $payload['offline_created_at'] ?? null,
                'items' => $items, 'payload' => $payload,
            ];
        }
        usort($events, fn ($a, $b) => $a['local_sequence'] <=> $b['local_sequence']);
        foreach ($demand as $key => $quantity) {
            $snap = $snapshot->get($key);
            if ($quantity > (int) $snap->opening_available) {
                throw new OfflineReconciliationException('offline_journal_exceeds_snapshot', 'The uploaded journal claims more stock than its signed opening snapshot.', 409, true);
            }
        }
        return $events;
    }

    private function validateSequenceAndReceipts(OfflineInventorySession $session, array $events, array $hashes, $receipts): array
    {
        $byTx = $receipts->keyBy('client_transaction_id');
        $bySeq = $receipts->keyBy('local_sequence');
        $expected = (int) $session->last_client_sequence + 1;
        $new = [];
        foreach ($events as $event) {
            $tx = $byTx->get($event['client_transaction_id']);
            $seq = $bySeq->get($event['local_sequence']);
            if ($tx || $seq) {
                if (! $tx || ! $seq || $tx->id !== $seq->id || ! hash_equals($tx->event_hash, $hashes[$event['client_transaction_id']])) {
                    throw new OfflineReconciliationException('offline_event_payload_mismatch', 'A previously received offline event was replayed with different immutable content.', 409, true);
                }
                continue;
            }
            if ($event['local_sequence'] !== $expected) {
                throw new OfflineReconciliationException('offline_sequence_gap', "Expected local sequence {$expected} before reconciliation could continue.", 409, true);
            }
            $expected++;
            $new[] = $event;
        }
        return $new;
    }

    private function replayPos(OfflineInventorySession $session, StoreDevice $device, array $event, ?int $actorId): Order
    {
        $payload = $event['payload'] ?? [];
        $items = $this->authorizedItems($session, $event, true);
        try {
            return $this->orders->place(array_merge($payload, [
            'source_channel' => 'pos', 'shop_id' => $session->shop_id, 'items' => $items,
            'terminal_id' => $device->device_uuid, 'client_transaction_id' => $event['client_transaction_id'],
            'offline_inventory_session_id' => $session->id, 'local_sequence' => $event['local_sequence'],
            'reconciliation_status' => 'offline_local_synced', 'offline_snapshot_authorized' => true,
            'offline_created_at' => $event['offline_created_at'], 'synced_at' => now(), 'created_by' => $actorId,
            'status' => OrderStatus::DELIVERED->value, 'shipping_total' => 0,
            'customer_name' => $payload['customer_name'] ?? 'Walk-in Customer',
            'checkout_full_address' => $payload['checkout_full_address'] ?? 'Store counter sale',
            'checkout_district' => $payload['checkout_district'] ?? 'Dhaka',
            'payment_method' => (($payload['payment_method'] ?? 'cash') === 'cash' ? 'cod' : 'online'),
            'payment_channel' => $payload['payment_channel'] ?? $payload['payment_method'] ?? 'cash',
            'gateway' => (($payload['payment_method'] ?? 'cash') === 'cash' ? null : ($payload['payment_method'] ?? null)),
        ]), null);
        } catch (InventoryConflictException|RuntimeException $exception) {
            throw new OfflineReconciliationException('offline_fifo_replay_conflict', 'The saved physical sale could not be replayed against valid store inventory/FIFO data. Staff recovery is required.', 409, true);
        }
    }

    private function replaySocial(OfflineInventorySession $session, StoreDevice $device, array $event, ?int $actorId): Order
    {
        $payload = $event['payload'];
        if (trim((string) ($payload['customer_name'] ?? '')) === '' && trim((string) ($payload['mobile_number'] ?? '')) === '') {
            throw new OfflineReconciliationException('offline_social_customer_invalid', 'Offline Social order customer details are incomplete.', 422, true);
        }
        return $this->orders->place(array_merge($payload, [
            'source_channel' => 'social_commerce', 'shop_id' => $session->shop_id,
            'items' => $this->authorizedItems($session, $event, false),
            'terminal_id' => $device->device_uuid, 'client_transaction_id' => $event['client_transaction_id'],
            'offline_inventory_session_id' => $session->id, 'local_sequence' => $event['local_sequence'],
            'reconciliation_status' => 'offline_local_synced', 'offline_snapshot_authorized' => true,
            'offline_created_at' => $event['offline_created_at'], 'synced_at' => now(), 'created_by' => $actorId,
            'status' => OrderStatus::CONFIRMED->value,
            'checkout_full_address' => $payload['full_address'] ?? $payload['checkout_full_address'] ?? 'Social commerce order',
            'checkout_district' => $payload['district'] ?? $payload['checkout_district'] ?? 'Dhaka',
            'payment_method' => $payload['payment_method'] ?? 'cod',
        ]), $payload['customer_id'] ?? null);
    }

    private function authorizedItems(OfflineInventorySession $session, array $event, bool $pos): array
    {
        $snapshot = $session->snapshotItems()->get()->keyBy(fn ($row) => $this->key((int) $row->product_id, $row->variant_id ? (int) $row->variant_id : null));
        $mode = strtolower((string) ($event['payload']['price_mode'] ?? 'retail')) === 'wholesale' ? 'wholesale' : 'retail';
        $payloadItems = collect($event['payload']['items'] ?? []);
        return array_map(function (array $item) use ($snapshot, $mode, $payloadItems, $pos): array {
            $snap = $snapshot->get($this->key($item['productId'], $item['variantId']));
            $price = (float) ($mode === 'wholesale' ? $snap->wholesale_price : $snap->retail_price);
            $claim = $payloadItems->first(fn ($p) => (int) ($p['product_id'] ?? 0) === $item['productId'] && (int) ($p['variant_id'] ?? 0) === (int) ($item['variantId'] ?? 0));
            if ($pos && $claim) {
                $claimedBase = (float) ($claim['snapshot_base_price'] ?? $claim['unit_price'] ?? $price);
                if (abs($claimedBase - $price) > 0.009) throw new OfflineReconciliationException('offline_snapshot_price_mismatch', 'A POS base price does not match the immutable snapshot.', 409, true);
                $charged = (float) ($claim['actual_charged_unit_price'] ?? $claimedBase);
                if ($charged < 0 || $charged > $price + 0.009) throw new OfflineReconciliationException('offline_snapshot_discount_invalid', 'A POS charged price is outside the snapshot-authorized discount boundary.', 409, true);
            }
            return [
                'product_id' => $item['productId'], 'variant_id' => $item['variantId'], 'quantity' => $item['quantity'],
                'authorized_unit_price' => $price,
            ];
        }, $event['items']);
    }

    private function createPaymentActions(OfflineInventorySession $session, Order $order): void
    {
        foreach ($order->payments()->lockForUpdate()->get() as $payment) {
            $refundable = max(0, (float) $payment->amount - (float) ($payment->refunded_amount ?? 0));
            if ($payment->status === PaymentStatus::PAID->value && $refundable > 0) {
                OfflineReconciliationAction::firstOrCreate(
                    ['idempotency_key' => "session:{$session->id}:refund:payment:{$payment->id}"],
                    ['offline_inventory_session_id' => $session->id, 'action_type' => 'refund', 'order_id' => $order->id,
                     'payment_id' => $payment->id, 'status' => 'pending', 'amount' => $refundable, 'currency' => $payment->currency,
                     'reason_code' => self::PREEMPT_REASON, 'metadata' => ['payment_method' => $payment->payment_method, 'gateway' => $payment->gateway]],
                );
            } elseif ($payment->status === PaymentStatus::PENDING->value && $payment->gateway) {
                OfflineReconciliationAction::firstOrCreate(
                    ['idempotency_key' => "session:{$session->id}:payment-review:{$payment->id}"],
                    ['offline_inventory_session_id' => $session->id, 'action_type' => 'payment_review', 'order_id' => $order->id,
                     'payment_id' => $payment->id, 'status' => 'manual_review', 'amount' => $refundable, 'currency' => $payment->currency,
                     'reason_code' => self::PREEMPT_REASON, 'metadata' => ['gateway' => $payment->gateway]],
                );
            }
        }
    }

    private function promoteSurvivors(OfflineInventorySession $session): void
    {
        $rows = ReservedProduct::query()->active()->preemptible()->where('shop_id', $session->shop_id)
            ->where('reserved_at', '>', $session->boundary_server_at)->get();
        foreach ($rows as $row) $row->update(['reservation_class' => 'protected']);
        Order::query()->whereIn('id', $rows->pluck('order_id')->filter()->unique())->where('reconciliation_status', 'provisional')->update(['reconciliation_status' => 'protected']);
    }

    private function closedReplay(StoreDevice $device, OfflineInventorySession $session, array $events, array $hashes): array
    {
        $receipts = $session->eventReceipts()->get();
        $new = $this->validateSequenceAndReceipts($session, $events, $hashes, $receipts);
        if ($new !== []) {
            throw new OfflineReconciliationException('offline_session_closed_new_events', 'This session is already reconciled. Start a fresh snapshot before creating another offline event.', 409, true);
        }
        return $this->responseFromReceipts($session, $receipts);
    }

    private function responseFromReceipts(OfflineInventorySession $session, $receipts): array
    {
        return ['session' => $session->reconciliation_summary_json ?? ['result' => 'success'],
            'events' => $receipts->sortBy('local_sequence')->map(fn ($row) => $this->receiptMapping($row))->values()->all(),
            'actions' => $session->reconciliationActions()->get()->toArray()];
    }

    private function receiptMapping(OfflineEventReceipt $receipt): array
    {
        return ['client_transaction_id' => $receipt->client_transaction_id, 'local_sequence' => (int) $receipt->local_sequence,
            'type' => $receipt->event_type, 'result_code' => $receipt->result_code, 'server_order_id' => $receipt->server_order_id,
            'server_order_number' => $receipt->result_json['order_number'] ?? null];
    }

    private function eventHash(array $event): string { return hash('sha256', json_encode($this->canonical($event), JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)); }
    private function canonical(mixed $value): mixed { if (! is_array($value)) return $value; if (array_is_list($value)) return array_map(fn ($v) => $this->canonical($v), $value); ksort($value); foreach ($value as $k => $v) $value[$k] = $this->canonical($v); return $value; }
    private function key(int $productId, ?int $variantId): string { return $productId . ':' . ($variantId ?: 0); }
    private function reservationKey(ReservedProduct $row): string { return $this->key((int) $row->product_id, $row->variant_id ? (int) $row->variant_id : null); }
    private function journalDemand(array $events): array { $d=[]; foreach($events as $e) foreach($e['items'] as $i){$k=$this->key($i['productId'],$i['variantId']);$d[$k]=($d[$k]??0)+$i['quantity'];} return $d; }
    private function deficits(array $demand, array $capacity): array { $d=[]; foreach($demand as $k=>$q)$d[$k]=max(0,$q-($capacity[$k]??0)); return $d; }
    private function hasDeficit(array $deficits): bool { return (bool) array_filter($deficits, fn ($q) => $q > 0); }
    private function touchesDeficit($reservations, array $deficits): bool { foreach($reservations as $r) if(($deficits[$this->reservationKey($r)]??0)>0)return true; return false; }

    private function lockInventoryRows(int $shopId, array $keys): array
    {
        $rows=[];
        foreach($keys as $key){[$product,$variant]=array_map('intval',explode(':',$key));$query=Inventory::query()->where('shop_id',$shopId)->where('product_id',$product);$variant?$query->where('variant_id',$variant):$query->whereNull('variant_id');$row=$query->lockForUpdate()->first();if($row)$rows[$key]=$row;}
        return $rows;
    }

    private function assertLockedAuthority(StoreDevice $device, OfflineInventorySession $session, array $events): void
    {
        if ($device->status !== 'active' || (int)$session->store_device_id !== (int)$device->id || (int)$session->binding_version !== (int)$device->binding_version || (int)$session->shop_id !== (int)$device->shop_id) {
            throw new OfflineReconciliationException('offline_device_binding_mismatch', 'The registered device binding changed before reconciliation.', 409, true);
        }
        if (! in_array($session->status, ['open','reconciling'], true)) throw new OfflineReconciliationException('offline_session_not_open', 'This offline session is not open for reconciliation.', 409);
    }

    private function markRecovery(StoreDevice $device, OfflineInventorySession $session, string $reason): void
    {
        DB::transaction(function () use ($device,$session,$reason): void {
            StoreDevice::query()->whereKey($device->id)->lockForUpdate()->update(['operational_state'=>StoreConnectivityService::RECOVERY_REQUIRED]);
            OfflineInventorySession::query()->whereKey($session->id)->lockForUpdate()->update(['status'=>'recovery_required','recovery_reason_code'=>$reason,'reconciling_at'=>null]);
        });
    }
}
