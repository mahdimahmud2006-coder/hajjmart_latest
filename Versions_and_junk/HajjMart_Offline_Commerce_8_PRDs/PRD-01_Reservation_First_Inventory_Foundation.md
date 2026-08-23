# PRD-01 — Reservation-First Inventory Foundation

**Sequence:** 1 of 8  
**Depends on:** current August 20 HajjMart codebase  
**Unlocks:** PRD-02 through PRD-08

## 1. Objective

Normalize inventory semantics before adding offline reconciliation. After this PRD, **POS is a physical sale** and consumes physical stock; **Website and Social Commerce are commitments** and reserve stock first. Non-POS inventory/FIFO is consumed only when fulfilment proves stock has left the store. Cancellation of an unfulfilled order releases a reservation instead of manufacturing stock back into inventory.

## Baseline and implementation contract

This PRD is written against the latest HajjMart implementation package:

- **Package:** `HajjMart_PRD10_Final_Admin_Compliance_Implemented_2026-08-20.zip`
- **SHA-256:** `cbadb81622753f5f8822a3e07726fcff555a9f0b5df28a2a1436a57179bf9df9`
- **Backend:** Laravel API
- **Frontend:** Next.js admin
- **Current foundations to preserve:** one unified `orders` ledger, store-scoped `inventory`, `reserved_products`, FIFO/direct batches, POS IndexedDB queue/idempotency, and the existing Social Commerce fast-order flow.

Before editing, the AI agent must read this PRD, all prior PRDs in this sequence, and the latest handoff. Inspect every named file before changing it. Preserve the unified order/inventory model; do not create a second offline business ledger. Put stock mutations inside DB transactions with row locks where concurrency matters. Treat retries as normal and make network writes idempotent. Expected business conflicts must return stable 4xx reason codes rather than raw exceptions. Add behavioral tests with the implementation, and record migrations, API changes, commands/tests run, changed files, and known limits in the handoff.


## 2. Current-code facts driving the change

The current `backend/app/Services/OrderService.php` only reserves a pending unpaid Website order. Most other orders, including Social Commerce, call `InventoryService::decrement()` during `place()`. `transition(... confirmed ...)` commits reservations through `CommitInventoryAction`. This is incompatible with later offline preemption because a lower-priority online order may already have consumed physical/FIFO stock.

The useful pieces already exist and must be retained:

- `ReserveInventoryAction` increments `inventory.reserved`;
- `CommitInventoryAction` decrements both `reserved` and `quantity` and consumes FIFO via `ProductBatch::consumeForInventory()`;
- `ReleaseInventoryAction` releases `reserved`;
- reservation rows are product/variant/store aware;
- POS already has a distinct physical-sale path.

## 3. Required inventory semantics

| Event | `inventory.quantity` | `inventory.reserved` |
|---|---:|---:|
| Website accepted | unchanged | `+qty` |
| Online Social accepted | unchanged | `+qty` |
| POS sale | `-qty` | unchanged |
| Website/Social payment or confirmation | unchanged | unchanged |
| Website/Social shipped | `-qty` | `-qty` |
| Cancel before physical commit | unchanged | `-qty` |
| Return to sellable stock after actual sale | `+qty` | unchanged |

A Social Commerce order may continue to use business status `confirmed` immediately if that is the current workflow. **Confirmed must no longer mean inventory physically left the store.**

## 4. Non-negotiable invariants

1. `available = quantity - reserved`.
2. `quantity >= 0`, `reserved >= 0`, and `reserved <= quantity`.
3. `inventory.reserved` equals the sum of **active** reservation rows for the same product/variant/store.
4. New Website/Social orders never decrement physical quantity at creation.
5. POS never creates a normal fulfilment reservation.
6. FIFO consumption happens exactly once for each physical unit leaving inventory.
7. Payment confirmation and order confirmation are not physical-stock events.
8. Non-POS reservation commit normally happens at `shipped`; if a force/legacy flow jumps directly to `out_for_delivery` or `delivered`, commit before the transition completes.
9. Historical orders created under old semantics are never blindly re-reserved or re-committed.
10. Repeated cancellation/transition requests cannot release or consume the same stock twice.

## 5. Modernize `reserved_products` into an auditable ledger

Add a migration such as `*_modernize_reserved_products_for_offline_priority.php` with:

```text
order_item_id       nullable FK order_items, indexed
status              active | committed | released | preempted
reservation_class   protected | preemptible
source_channel      nullable, indexed
reserved_at         nullable timestamp
committed_at        nullable timestamp
released_at         nullable timestamp
release_reason      nullable string
metadata            nullable JSON (only if compatible with deployed DB)
```

Backfill every row that currently exists as `status=active`, `reservation_class=protected`, and `reserved_at=COALESCE(created_at, migration_time)`. Old code deletes committed/released rows, so surviving rows represent active reservations. **Do not create new reservation rows for historical confirmed/social orders that do not already have them**; those orders may already have decremented physical stock.

Backfill `order_item_id` only where the matching order item is unambiguous. New reservations must populate it.

## 6. Model contract

### `App\Models\ReservedProduct`

Add fillable/casts and scopes:

```php
scopeActive()
scopeProtected()
scopePreemptible()
```

Keep `Order::reservedProducts()` as history/all rows and add `Order::activeReservedProducts()` for stock logic.

### `App\Models\Order`

`Order::confirm()` must stop committing inventory. Any legacy caller may still update state, but stock commit belongs to fulfilment.

## 7. Reservation actions

### `ReserveInventoryAction`

For each new `OrderItem`, reserve under lock, then create an active ledger row containing order item, product, variant, shop, quantity, source channel, protected class, and `reserved_at`. Repeated execution must be idempotent at order-item level.

### `CommitInventoryAction`

Query only active rows. For each row, call `InventoryService::commitReserved()`, preserve current COGS/profit allocation, then mark the reservation `committed` and set `committed_at`. **Do not delete the ledger row.** Re-running sees no active row and does nothing.

### `ReleaseInventoryAction`

Query only active rows, call `releaseReservation()`, mark `released`, set `released_at`/reason, and retain history.

## 8. Change `OrderService::place()`

Replace the current narrow “reserve pending unpaid Website” rule with:

```text
source_channel == pos     -> physical decrement
source_channel != pos     -> reservation-first
```

Channel/physical reality decides stock behavior, not whether status says pending/confirmed or whether money is already paid.

The transaction remains all-or-nothing across order, order items, inventory reservation/decrement, payment rows, promotion applications, and status history.

## 9. Commit-on-fulfilment rule

Centralize the rule in `OrderService` or one small service, e.g.:

```php
commitInventoryIfPhysicallyLeaving(Order $order, string $toStatus, ?int $actorId): void
```

For a non-POS order with active reservations:

- `confirmed`, `processing`, `ready_to_ship` -> do not commit;
- `shipped` -> commit;
- `out_for_delivery` or `delivered` -> commit only if still active (covers forced jumps).

Call before the status transition is persisted. Do not scatter this logic among controllers.

## 10. Cancellation compatibility

If active reservations exist, release them and cancel without incrementing physical quantity. If no active reservations exist because an older order already used legacy physical-decrement semantics, preserve the existing legacy stock-restoration path. Do not infer a new reservation for that old order.

## 11. Payment behavior

Inspect `PaymentService.php`. Payment success may still transition an order to `confirmed`; it must no longer trigger FIFO consumption. No other gateway behavior changes in this PRD.

## 12. Stable business errors

Use clear reason codes at API boundaries, for example:

```text
inventory_insufficient_available
reservation_counter_inconsistent
reservation_already_committed
```

Expected conflicts should be 409/422 according to existing API conventions, never a raw 500 with SQL/exception text.

## 13. Likely files

Backend, likely:

- `app/Models/ReservedProduct.php`
- `app/Models/Order.php`
- `app/Actions/ReserveInventoryAction.php`
- `app/Actions/CommitInventoryAction.php`
- `app/Actions/ReleaseInventoryAction.php`
- `app/Services/InventoryService.php`
- `app/Services/OrderService.php`
- `app/Services/PaymentService.php`
- one migration
- PHPUnit feature/unit tests

Avoid frontend changes unless a visible screen incorrectly assumes confirmation means stock deduction.

## 14. Required automated tests

1. Website COD -> quantity unchanged, reserved increases.
2. Website online-payment order -> quantity unchanged, reserved increases.
3. Payment success/confirmation -> reservation stays active.
4. Social confirmed order -> quantity unchanged, reserved increases.
5. POS -> quantity decreases, reserved unchanged.
6. Two concurrent reservations of final unit -> exactly one succeeds.
7. Non-POS `shipped` -> quantity/reserved both decrement once and FIFO consumed once.
8. Forced direct `delivered` -> same one-time commit.
9. Repeated status retry -> no duplicate commit/FIFO use.
10. Cancellation before shipment -> reserved released, quantity unchanged.
11. Legacy no-reservation order cancellation follows old safe restoration and does not double-add.
12. Reservation history remains as committed/released.
13. Active ledger sum equals `inventory.reserved`.
14. Same SKU in two stores remains isolated.
15. Variant/simple products remain isolated.
16. Multi-line order fully rolls back when one line is insufficient.
17. Existing return/exchange/direct-batch tests remain green.

## 15. Acceptance criteria

- All new Website/Social orders reserve first.
- POS still physically decrements stock.
- Confirmation/payment never consumes physical stock.
- Physical fulfilment commits reservation/FIFO once.
- Reservation rows remain auditable history.
- No historical double-consumption/backfill.
- Reservation counter is reconciliable from active rows.
- Backend tests pass.

## 16. Handoff gate

Do not start PRD-02 until the handoff demonstrates: migration on a representative existing DB, new Website/Social behavior, unchanged POS behavior, fulfilment/cancellation lifecycle, reservation counter reconciliation, and a concurrent final-unit test.
