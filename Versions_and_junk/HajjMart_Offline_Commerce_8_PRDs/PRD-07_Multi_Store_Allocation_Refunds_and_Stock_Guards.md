# PRD-07 — Multi-Store Allocation, Fulfilment Guards, Refund Processing, and Stock-Mutation Safety

**Sequence:** 7 of 8  
**Depends on:** PRD-01 through PRD-06  
**Unlocks:** PRD-08 operational/recovery rollout

## 1. Objective

Harden every server-side operation that can otherwise violate a store's offline inventory boundary.

This PRD completes the multi-store rules by addressing:

- Website store allocation;
- ordinary online Social Commerce allocation;
- provisional-order fulfilment;
- stock transfers;
- negative manual adjustments/direct destructive stock changes;
- paid-order refund/void work created by reconciliation.

The invariant is simple:

> Each store can sell or reserve only its own stock, and when a store's device may be operating from an offline snapshot, server-side outbound stock actions must not make that snapshot impossible to reconcile.

## 2. Baseline and implementation contract

Use the latest HajjMart codebase plus PRD-01 through PRD-06.

Current important findings:

- Website quote/placement currently tends to use `Shop::defaultStore()` unless a store is passed.
- The existing seed includes an `ONLINE` fulfilment hub and store channel settings.
- `StockTransferController` currently has no offline-store safety policy.
- `InventoryService::adjust()` can reduce stock without checking offline session state.
- `PaymentService` and the existing SSLCOMMERZ gateway layer already contain refund support.

Extend those foundations. Do not create a second e-commerce stock pool, payment ledger, or transfer model.

## 3. Store allocation service

Create:

```php
StoreAllocationService
```

It must choose a single fulfilment store for a Website order.

V1 never splits one order across stores.

### Candidate eligibility

A candidate must:

- be active;
- support the Website channel;
- have every requested product/variant available according to server inventory/reservation state;
- not be in `reconciling` or `recovery_required`;
- pass any current product/store availability rules.

### Preference order

1. `ONLINE_HEALTHY` store explicitly configured as preferred online fulfilment and able to reserve the whole order;
2. another `ONLINE_HEALTHY` Website-enabled store able to reserve the whole order;
3. `OFFLINE_SUSPECTED` or `OFFLINE_CONFIRMED` Website-enabled store able to reserve the whole order on the server, **provisional only**;
4. otherwise current out-of-stock/backorder behavior.

Do not hard-code display name `ONLINE`.

Recommended store setting:

```json
{
  "online_fulfilment_priority": 1
}
```

Lower positive number = higher preference. Seed/configure the current online fulfilment hub accordingly.

## 4. Atomic allocation + reservation

Do not implement:

```text
read stock -> choose store -> later reserve
```

as separate race-prone phases.

Final placement must:

1. choose candidate order deterministically;
2. for a candidate, lock the required inventory rows in deterministic product/variant order;
3. re-read quantity/reserved/availability and connectivity/session state;
4. reserve all lines in one transaction;
5. if candidate fails because another order won, release locks and try the next safe candidate;
6. never partially reserve an order across candidates.

The reservation class comes only from `ReservationPolicyService`.

## 5. Website quote/checkout consistency

`quoteCheckout()` must stop implying that the default store is guaranteed to fulfil the order.

Introduce an opaque allocation token/reference.

The quote response should include an opaque:

```text
allocation_token
```

Server-side token/reference binds at least:

```text
selected candidate shop
normalized item hash
quote totals inputs as required
store inventory revision
expiry
```

At final checkout:

- validate token and item hash;
- never trust a public raw `shop_id` as fulfilment authority;
- revalidate under locks;
- if the original store is no longer valid, try another eligible store;
- if store change affects shipping/totals, return a clear recalculation response rather than silently charging different totals;
- preserve existing checkout idempotency behavior.

## 6. Ordinary online Social Commerce

This section applies to a Social order created online through normal admin/API flow, not a PRD-06 local journal event.

Rules:

- store must be authorized/selected according to existing admin workflow;
- reservation-first PRD-01 behavior applies;
- if store is healthy -> protected reservation;
- if store is offline-risk -> provisional/preemptible reservation;
- if store is reconciling/recovery-required -> reject that store before order creation;
- do not let Social online bypass the centralized reservation policy.

## 7. Provisional-order fulfilment guard

An order with:

```text
reconciliation_status = provisional
```

must not physically progress while its store is unresolved.

Recommended v1 block point: transition into `processing`.

Also block any direct/force transition to later physical statuses.

Return:

```text
409 order_waiting_for_store_sync
```

and operator copy such as:

> This order is waiting for the store to sync stock. You can fulfil it after reconciliation.

After successful reconciliation preserves the order and promotes reservations to protected, normal fulfilment resumes.

## 8. Central outbound stock guard

Create:

```php
OfflineStockMutationGuard
```

with an explicit API such as:

```php
assertDecreaseAllowed(int $shopId, string $operation): void
```

For a store in:

```text
offline_suspected
offline_confirmed
reconciling
recovery_required
```

block server-side stock-decreasing operational changes that are not part of the authoritative reconciliation or a physical local event.

Stable reason:

```text
store_offline_stock_locked
```

The reconciliation service may use a narrow internal bypass because it owns the store/session lock and is applying the signed journal.

Do not create controller-specific hidden bypasses.

## 9. Stock transfer guards

Inspect current transfer lifecycle carefully and place the guard at the first action that reserves/removes source availability.

### Transfer out

If source store is offline-risk/reconciling/recovery-required:

- block approval/dispatch/immediate transfer action that would reduce source availability;
- no partial stock movement;
- destination does not receive anything.

### Transfer in

A positive transfer into an offline store may be recorded server-side if business operations require it.

But:

- it does not change the active device snapshot;
- the device cannot sell the new units until reconciliation finishes and a fresh snapshot is issued;
- admin UI/reporting should distinguish server on-hand from device snapshot availability where needed.

### Store isolation

Store A being offline must not block Store B -> Store C operations.

## 10. Manual adjustment/direct stock guard

Any negative operation through `InventoryService::adjust()` or equivalent direct batch/inventory correction must call `OfflineStockMutationGuard`.

Examples:

- shrinkage/loss;
- manual `-qty` correction;
- destructive stock count posting;
- transfer-out;
- future admin endpoint that directly lowers store stock.

Positive receipt/adjustment may proceed, but active snapshot remains immutable.

If business absolutely requires a negative correction while a store is offline, the workflow must first put the session into recovery and follow PRD-08. Do not add an undocumented force flag.

## 11. Refund/void worker

PRD-06 creates durable `offline_reconciliation_actions` after its DB commit.

Implement a queued job/service, for example:

```text
ProcessOfflineReconciliationAction
```

### Job requirements

- idempotency by action `idempotency_key`;
- lock/claim one action so two workers do not process it simultaneously;
- use bounded retry for transient gateway/network failures;
- deterministic business failure becomes `failed` or `manual_review`;
- write activity log;
- never re-open victim reservation/stock merely because refund fails.

## 12. Payment-specific behavior

### COD/unpaid victim

No fake refund transaction. Cancellation completes without gateway work.

### Captured payment

Call current `PaymentService::refund()` after reconciliation transaction.

- refund only refundable amount;
- preserve current payment totals/status semantics;
- repeated queue/job delivery must not double-refund;
- gateway's external reference/result stored in action metadata where safe.

### Authorization-only

Use a true void only if current gateway adapter exposes verified void semantics.

If not supported:

```text
manual_review / payment_review
```

Do not mark a payment “voided” merely because the application wanted it to be.

### Offline POS unverified digital payment

Expose as payment verification attention. Do not auto-return stock or delete physical order on verification failure.

## 13. Customer-facing preemption reason

A Website order cancelled by PRD-06 should show a specific non-technical reason.

Suggested copy:

> The item sold at our store before the stock update reached us. We cancelled this order and started any required refund.

Do not expose:

- device UUID;
- session UUID;
- internal reservation class;
- database/reconciliation terminology.

Admin order detail may show a more detailed operational explanation.

## 14. Store connectivity after reconciliation

On successful reconciliation:

- explicit state leaves `reconciling`;
- server creates/returns fresh snapshot;
- device must acknowledge/bootstrap and heartbeat;
- allocator treats the store as healthy only after fresh healthy device contact according to connectivity service.

On `recovery_required`:

- allocator does not choose that store for new online orders;
- provisional fulfilment blocked;
- transfer-out/negative adjustment blocked;
- PRD-08 recovery UI becomes required.

## 15. Concurrency with reconciliation

Allocator and reconciliation must coordinate on the same store-level mutex/lock policy.

While Store A is reconciling:

- allocator should skip/reroute to another store if one can fulfil;
- otherwise return a retryable/availability business response;
- it must not wait indefinitely or create another provisional reservation inside the locked reconciliation window.

Use short lock timeouts and deterministic error mapping.

## 16. Inventory revision behavior

All successful reservation/stock mutations in this PRD must continue incrementing the PRD-03 store inventory revision inside their transaction.

This includes:

- Website reserve/release;
- ordinary Social reserve/release;
- transfer-out/in;
- manual adjustment;
- refund itself does not change inventory unless a separate return workflow explicitly does.

## 17. Likely files

Backend, likely:

- new `app/Services/StoreAllocationService.php`
- new `app/Services/OfflineStockMutationGuard.php`
- `app/Services/OrderService.php`
- `app/Services/ReservationPolicyService.php`
- `app/Services/InventoryService.php`
- public Website order/checkout controller(s)
- `app/Http/Controllers/Api/V1/Admin/OrderController.php`
- `app/Http/Controllers/Api/V1/Admin/StockTransferController.php`
- inventory adjustment controller(s)
- `app/Services/PaymentService.php`
- `app/Services/Payments/SslCommerzPaymentGateway.php`
- new `app/Jobs/ProcessOfflineReconciliationAction.php`
- `app/Models/Shop.php`
- shop settings/seed data
- routes if needed
- tests

Frontend only where contracts are surfaced:

- Website checkout quote/place client/page for allocation token;
- order tracking cancellation copy;
- admin status-transition conflict handling;
- transfer/inventory error copy.

## 18. Required tests

Automate at least:

1. preferred healthy online hub has all stock -> Website allocates there;
2. preferred hub lacks one line -> another healthy store gets whole order;
3. no healthy store fits but offline-risk store fits -> provisional allocation;
4. all stores insufficient -> no partial reservations anywhere;
5. order never splits across stores;
6. forged public `shop_id` cannot force fulfilment store;
7. allocation token item hash mismatch -> rejected;
8. allocation token expired -> re-quote/revalidate path;
9. final placement revalidates stock under locks;
10. two Website checkouts race for final unit -> exactly one reservation;
11. ordinary online Social at offline-risk store -> provisional;
12. provisional order cannot enter processing;
13. direct forced shipped/delivered transition for provisional order -> blocked;
14. reconciliation preserves/promotes order -> fulfilment becomes allowed;
15. transfer-out from offline store -> blocked;
16. transfer-out from healthy other store -> unaffected;
17. negative adjustment on offline store -> blocked;
18. positive transfer-in to offline store -> server quantity increases but active snapshot unchanged;
19. recovery-required store -> never chosen by allocator;
20. allocator encountering reconciling store -> reroutes/skips safely;
21. paid victim refund job calls existing PaymentService exactly once;
22. duplicate job delivery -> no second refund;
23. transient gateway failure -> retry state retained;
24. deterministic refund failure -> manual attention retained;
25. COD victim -> no fake refund;
26. customer-facing cancellation reason is specific but non-technical;
27. Store A offline state does not affect Store B allocation/transfer;
28. all inventory revisions update correctly.

## 19. Acceptance criteria

- Website checkout no longer blindly depends on default store.
- A single order is allocated atomically to exactly one safe store.
- Offline-risk store is only used provisionally.
- Provisional stock cannot physically leave before reconciliation.
- Transfer-out and negative adjustments cannot invalidate an offline snapshot.
- Positive inbound stock does not magically appear on the old device snapshot.
- Paid victim orders enter a real, idempotent refund/void workflow after reconciliation.
- Reconciliation and allocation cannot race into oversell.
- Multi-store isolation holds under concurrency.

## 20. Handoff gate

Do not begin PRD-08 until the handoff includes:

- Website allocation demonstrations across at least three stores;
- one healthy, one provisional, and one rejected allocation case;
- provisional fulfilment block demonstration;
- transfer-out and negative-adjustment block demonstrations;
- positive transfer-in + unchanged-device-snapshot demonstration;
- paid victim refund success and simulated failure traces;
- concurrency test of Website allocator versus reconciliation mutex.
