# PRD-06 — Deterministic Offline Reconciliation and Online-Order Preemption

**Sequence:** 6 of 8  
**Depends on:** PRD-01 through PRD-05  
**Unlocks:** PRD-07 multi-store allocation, fulfilment and stock-operation hardening

## 1. Objective

Implement the central business rule safely and deterministically:

> Commitments that existed before the store's offline boundary remain protected. Valid offline POS sales and offline Social Commerce orders created by the registered store device take precedence over conflicting online Social/e-commerce reservations created after that boundary while the store was at offline risk.

Reconciliation must be store-scoped, transactional, locked, replay-safe, whole-order coherent, FIFO-correct, and capable of surviving lost HTTP responses and duplicate uploads.

## 2. Baseline and implementation contract

Use the latest HajjMart August 20 implementation plus PRD-01 through PRD-05.

Preserve:

- unified `orders` ledger;
- reservation-first non-POS semantics;
- physical POS decrement/FIFO semantics;
- one device per store;
- immutable server snapshot/session;
- one local event sequence across POS + Social;
- current payment/refund services rather than inventing a second payment ledger.

Expected business conflicts must return stable 4xx codes. Do not leak SQL/internal exception text.

## 3. Priority model

### Tier 1 — protected commitments

Never preempt:

- active reservation that existed before the session boundary;
- reservation explicitly classified `protected`;
- surviving reconciled offline Social reservation;
- any order that has already physically progressed beyond the safe preemption point.

### Tier 2 — local offline commitments

- `pos_sale`
- `social_order`

Order them strictly by:

```text
local_sequence ASC
```

Device time is audit metadata only.

### Tier 3 — post-boundary online provisional commitments

- website/e-commerce reservations;
- ordinary online Social Commerce reservations not created from the local event journal.

Online Social and e-commerce have equal v1 priority.

Survival order:

```text
orders.created_at ASC, orders.id ASC
```

Victim order selection therefore removes newest suitable orders first.

## 4. Reservation classification policy

PRD-01 introduced `reservation_class`.

Create a centralized `ReservationPolicyService`.

When Website/ordinary-online-Social creates a reservation:

### Protected

Use `protected` when:

- store connectivity is `online_healthy` and there is no offline-risk boundary requiring provisional treatment; or
- reservation was created at/before the current offline session boundary; or
- reservation was created by a reconciled offline Social event.

### Preemptible

Use `preemptible` when:

- store is `offline_suspected` or `offline_confirmed`; and
- reservation is after the relevant offline boundary; and
- it is an ordinary online Website/Social reservation.

### Reconciling/recovery required

Do not accept a new reservation against a store in:

```text
reconciling
recovery_required
```

PRD-07 will make global allocation route elsewhere, but this service must fail closed even if called directly.

The client must never choose its own reservation class.

## 5. Order reconciliation fields

Add migration fields to `orders`:

```text
offline_inventory_session_id nullable FK
local_sequence nullable
reconciliation_status string default normal
preempted_by_session_id nullable FK
cancellation_reason_code nullable
```

Application states:

```text
normal
provisional
protected
offline_local_pending
offline_local_synced
preempted
recovery_attention
```

Existing rows backfill `normal`.

When a normal online order owns any active `preemptible` reservation, mark it `provisional`.

A reconciled local event stores session + local sequence on its server order.

## 6. Durable offline event receipt mapping

Create `offline_event_receipts` rather than overloading nullable legacy terminal uniqueness.

Recommended schema:

```text
id
shop_id
store_device_id
offline_inventory_session_id
client_transaction_id
local_sequence
event_type
event_hash
server_order_id nullable
result_code
result_json nullable
created_at
updated_at
```

Unique constraints:

```text
UNIQUE(store_device_id, client_transaction_id)
UNIQUE(offline_inventory_session_id, local_sequence)
```

A duplicate `client_transaction_id` with a different immutable hash is a tamper/corruption conflict, not an idempotent retry.

## 7. Reconciliation action ledger

Create `offline_reconciliation_actions`:

```text
id
offline_inventory_session_id
action_type
order_id nullable
payment_id nullable
status
amount nullable
currency nullable
reason_code
idempotency_key UNIQUE
attempts default 0
last_error_code nullable
metadata json nullable
created_at
updated_at
completed_at nullable
```

Allowed action types include:

```text
refund
void_authorization
payment_review
customer_notification
```

Allowed states:

```text
pending
processing
completed
failed
manual_review
```

These rows record side effects that must occur after the inventory transaction. External payment gateway calls must not be made while inventory/order rows are locked.

## 8. Sync API

Implement a channel-neutral endpoint:

```text
POST /api/v1/admin/offline/session/{sessionId}/sync
```

Authenticate and verify:

- employee session;
- device UUID + secret;
- current binding version;
- session/device/shop ownership;
- snapshot identity.

Representative request:

```json
{
  "snapshot_id": "uuid",
  "events": [
    {
      "client_transaction_id": "uuid",
      "local_sequence": 101,
      "type": "pos_sale",
      "offline_created_at": "audit-only-device-time",
      "items": [],
      "payment": {}
    },
    {
      "client_transaction_id": "uuid",
      "local_sequence": 102,
      "type": "social_order",
      "items": [],
      "customer": {}
    }
  ]
}
```

## 9. Pre-mutation validation

Before changing business state, validate the complete uploaded prefix/session batch.

At minimum:

1. session exists and is open/current;
2. snapshot ID matches session;
3. device binding/version matches;
4. every client transaction ID has valid shape;
5. local sequence is positive;
6. new sequences are continuous after `last_client_sequence`;
7. a previously acknowledged sequence maps to the same event hash;
8. all product/variant rows exist in the snapshot;
9. event type is permitted by snapshot channel flags;
10. item quantity is positive integer/allowed decimal according to current product rules;
11. total offline committed quantity per SKU never exceeds snapshot `opening_available`;
12. POS base price matches snapshot authority plus allowed discount policy;
13. Social order/customer fields pass current server validation;
14. store/device/session IDs inside payload, if present, agree with authoritative server context.

If the uploaded journal claims more than signed opening availability, set session/store to `recovery_required`. Do not silently trim the event, reduce quantity, or manufacture negative stock.

## 10. Reconciliation locking

Use a short per-store reconciliation mutex in addition to row locks.

Acceptable implementation:

- MySQL advisory lock with bounded timeout; or
- a dedicated store/device lock row held with `SELECT ... FOR UPDATE` that serializes reconciliation/allocation for that store.

The deployment environment must support the chosen method and tests must exercise it.

Inside the DB transaction:

- set explicit operational state `reconciling`;
- lock affected inventory rows in deterministic product/variant order;
- lock active preemptible reservation rows touching those SKUs;
- lock their parent orders in deterministic order;
- re-read current active reservation state after locks are acquired.

Do not hold locks while calling external APIs.

## 11. Capacity calculation

For each affected SKU/variant:

```text
snapshot opening available
= opening physical quantity - opening protected reserved
```

The valid local event journal already guarantees local demand <= opening available.

At reconciliation time, later preemptible online reservations may have consumed some of that theoretical capacity. Reconciliation must release enough of those provisional commitments so all valid local events fit without harming Tier 1 protected commitments.

The calculation must be explicit in code/audit metadata. Do not depend on whichever reservation happens to be queried first.

## 12. Whole-order victim selection

V1 cancellation unit is the **whole online order**.

Candidate order must satisfy all:

- same store;
- has at least one active preemptible reservation for a currently short SKU;
- reservation/order created after boundary;
- not already preempted/cancelled;
- has not physically progressed past the safe point;
- not an offline-local event order.

Sort candidate victims:

```text
created_at DESC, id DESC
```

Iteratively cancel candidates until **every affected SKU** has enough capacity for the local event journal.

When one victim is chosen:

- cancel the whole order;
- release/mark preempted **all active reservations on that order**, including lines that were not themselves short;
- update the capacity map for every released line;
- create payment/refund obligations as needed.

This may release slightly more stock than a line-level cancellation, but it preserves customer/order coherence.

## 13. Never-auto-preempt conditions

If a candidate that would be required to resolve stock is already:

- processing/picked where physical stock has been separated;
- ready-to-ship if current operations treat that as physically committed;
- shipped;
- out for delivery;
- delivered;

then do not rewrite history or steal that unit.

Set session:

```text
recovery_required
```

and return an actionable conflict for staff recovery.

## 14. Reconciliation transaction algorithm

After validation and locks:

1. recompute protected and provisional commitments;
2. compute local offline demand per SKU;
3. determine deficits caused only by post-boundary provisional reservations;
4. select the minimum deterministic whole-order victim set using the policy above;
5. cancel victim orders;
6. mark their active reservation rows `preempted`, with reason/timestamp;
7. decrement aggregate `inventory.reserved` accordingly through the shared inventory service;
8. record victim order reason `offline_store_precedence_stock_conflict`;
9. create durable refund/void/payment-review actions;
10. replay new POS events by local sequence:
    - create one unified order;
    - create items using immutable snapshot-authorized data;
    - physically decrement store inventory;
    - consume FIFO batches exactly once;
    - create payment row;
    - write stock movement/audit;
    - map event receipt to server order;
11. replay new Social events by local sequence:
    - create one unified Social order;
    - create **protected active reservation**;
    - do not consume physical FIFO;
    - map event receipt;
12. promote surviving provisional reservations associated with the reconciled boundary to protected when no longer at risk;
13. update session `last_client_sequence`;
14. write reconciliation summary;
15. close session;
16. commit transaction;
17. process/queue external side effects after commit;
18. issue/return a fresh snapshot for the device when safe.

## 15. POS event behavior

A valid POS event represents physical reality.

Server sync must not reject it merely because:

- current product price changed;
- the product was archived after snapshot;
- the operator's device clock is strange;
- a later provisional online order consumed the server's remaining availability.

Instead:

- validate price/product against immutable snapshot;
- accept physical sale if snapshot/event ledger is valid;
- preempt eligible later provisional orders;
- record audit flags for server-state drift.

If the product/batch model can no longer produce a legitimate FIFO decrement because data was destructively corrupted, enter recovery rather than inventing a batch.

## 16. Social event behavior

A valid offline Social event is a high-priority **commitment**, not a physical sale.

At sync:

- create Social order in unified `orders`;
- create protected reservations;
- keep physical quantity unchanged;
- preserve local sequence/session metadata;
- normal fulfilment later commits FIFO using PRD-01 rules.

## 17. Payment and refund obligations

During the locked reconciliation transaction:

### COD/unpaid victim

- cancel order;
- no external refund action required.

### Paid/captured victim

- cancel order;
- create exactly one idempotent refund action for refundable amount/payment.

### Authorization-only payment

- create void action only if current gateway layer truly supports it;
- otherwise create `payment_review` rather than falsely marking voided.

### Offline POS digital payment

If marked `unverified_offline`, create/retain verification attention as appropriate. Do not undo physical stock automatically.

PRD-07 implements the worker/external calls.

## 18. Idempotency and retry contract

A repeated sync must be normal.

For a duplicate event:

- compare immutable event hash;
- if equal, return prior server mapping/result;
- if different, return stable payload-mismatch conflict and recovery attention.

A repeated **full session upload** after response loss must:

- create zero duplicate orders;
- create zero duplicate stock movements;
- consume zero additional FIFO units;
- cancel zero additional victims;
- create zero duplicate refund obligations;
- return the same event->server-order mapping and reconciliation summary.

## 19. Failure boundaries

### Validation failure before transaction

No mutation.

### Expected stock/preemption conflict

Return stable business code; no raw exception.

### DB failure inside transaction

Rollback orders, reservations, stock, FIFO, event receipts, victim cancellations, and actions together.

### Commit succeeds but HTTP response is lost

Retry resolves through event receipts/idempotency.

### External refund later fails

Inventory reconciliation stays committed. Refund action moves to failed/manual attention; do not rollback physical/business history.

## 20. Activity/audit

Create a human-readable high-level reconciliation activity record containing:

- store;
- device/binding version;
- session/snapshot;
- server boundary time/revision;
- incoming local sequence range;
- POS/Social event counts;
- per-SKU opening available and offline demand;
- victim order numbers;
- released reservation quantities;
- refund/void actions created;
- final inventory revision;
- success/recovery result.

Do not log device secrets or payment credentials.

## 21. Likely files

Backend, likely:

- new `app/Services/ReservationPolicyService.php`
- new `app/Services/OfflineReconciliationService.php`
- new `app/Models/OfflineEventReceipt.php`
- new `app/Models/OfflineReconciliationAction.php`
- `app/Services/OrderService.php`
- `app/Services/InventoryService.php`
- reservation actions/models from PRD-01
- offline session/device services from PRD-02/03
- `app/Services/ActivityLogService.php`
- offline session controller/routes
- `app/Http/Controllers/Api/V1/Admin/PosController.php` only to separate legacy vs v2 behavior
- `app/Http/Controllers/Api/V1/Admin/OrderController.php`
- migrations
- tests

Frontend:

- `src/lib/offline/commerce-sync.ts`
- shared offline sync/status component
- POS/Social handling of acknowledgement, fresh snapshot, and recovery states.

## 22. Required tests

Automate at least:

1. opening available 5; offline POS sells 5 -> all accepted, no sixth;
2. three reservations exist before boundary -> never preempted;
3. offline POS 3 vs later Website reservation 3 with opening available 3 -> Website victim, POS accepted;
4. offline POS and later Website order use unrelated SKU -> Website survives;
5. offline Social vs later online Social conflict -> offline Social wins;
6. offline demand 3 + later online demand 1 with opening 5 -> both survive;
7. two later online orders and one cancellation is enough -> newest suitable victim cancelled;
8. multi-line victim conflicts on one line -> whole order cancelled/all active reservations released;
9. paid victim -> exactly one refund/void obligation;
10. same POS event synced 10 times -> one order/stock movement;
11. full session uploaded 10 times -> same result/no duplicate victim/refund;
12. reservation one second before boundary -> protected;
13. reservation one second after boundary while offline-risk -> preemptible;
14. device clock moved backward -> local sequence still controls replay;
15. sequence gap -> recovery required/no partial mutation;
16. same transaction ID with changed payload -> recovery conflict;
17. device journal demand above snapshot -> recovery required;
18. current server price changed -> snapshot-valid POS accepted;
19. product archived after snapshot -> snapshot-valid POS accepted with audit drift;
20. concurrent Website checkout races with reconciliation -> no negative available and deterministic outcome;
21. Store B inventory untouched by Store A reconciliation;
22. required provisional victim already physically progressed -> recovery required, not auto-cancelled;
23. DB exception midway through POS replay -> entire reconciliation rolled back;
24. response lost after successful DB commit -> retry returns same mappings.

## 23. Acceptance criteria

- Protected/pre-boundary commitments are never stolen.
- Valid local offline events beat only eligible later provisional online reservations.
- Victim selection is deterministic and whole-order coherent.
- POS physical/FIFO stock moves exactly once.
- Offline Social becomes protected reservation, not physical decrement.
- Full-session retries are idempotent.
- Paid victims create durable refund/void obligations without external gateway calls inside the stock transaction.
- Malformed/tampered journals fail closed and are recoverable/auditable.
- Multi-store isolation is preserved.

## 24. Handoff gate

Do not begin PRD-07 until the handoff includes:

- at least three full reconciliation traces (no conflict, one victim, multi-line victim);
- protected-before-boundary proof;
- exact victim ordering proof;
- 10x event and full-session replay results;
- concurrent checkout-vs-reconcile test result;
- final inventory/reservation/FIFO reconciliation for affected SKUs;
- payment obligation rows for a paid victim.
