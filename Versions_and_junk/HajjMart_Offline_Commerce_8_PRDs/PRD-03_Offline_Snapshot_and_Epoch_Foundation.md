# PRD-03 — Authoritative Offline Snapshot and Inventory Epoch Foundation

**Sequence:** 3 of 8  
**Depends on:** PRD-01 reservation semantics; PRD-02 device binding/connectivity  
**Unlocks:** PRD-04 shared local stock authority

## 1. Objective

Give each registered store device a **server-issued immutable opening stock boundary** that can become authority for a disconnected period. The device never invents opening stock. Snapshot data includes physical quantity, existing reservations, sellable available, channel eligibility, authoritative prices, and a server inventory revision.

## Baseline and implementation contract

This PRD is written against the latest HajjMart implementation package:

- **Package:** `HajjMart_PRD10_Final_Admin_Compliance_Implemented_2026-08-20.zip`
- **SHA-256:** `cbadb81622753f5f8822a3e07726fcff555a9f0b5df28a2a1436a57179bf9df9`
- **Backend:** Laravel API
- **Frontend:** Next.js admin
- **Current foundations to preserve:** one unified `orders` ledger, store-scoped `inventory`, `reserved_products`, FIFO/direct batches, POS IndexedDB queue/idempotency, and the existing Social Commerce fast-order flow.

Before editing, the AI agent must read this PRD, all prior PRDs in this sequence, and the latest handoff. Inspect every named file before changing it. Preserve the unified order/inventory model; do not create a second offline business ledger. Put stock mutations inside DB transactions with row locks where concurrency matters. Treat retries as normal and make network writes idempotent. Expected business conflicts must return stable 4xx reason codes rather than raw exceptions. Add behavioral tests with the implementation, and record migrations, API changes, commands/tests run, changed files, and known limits in the handoff.


## 2. Fixed architecture

1. An offline inventory session is the header for one immutable opening snapshot.
2. Each session has UUID `session_id` and UUID `snapshot_id`.
3. Explicit snapshot item rows are stored for auditability.
4. Boundary time is server time.
5. Each shop has a monotonic inventory revision.
6. `opening_available = opening_quantity - opening_reserved`.
7. Existing reservations are protected because they are excluded from opening available.
8. Device time is display/audit only.
9. New snapshot cannot replace a session that has unresolved local v2 events.
10. Startup stale-age default is 24 h; a continuously durable offline session may continue beyond that while local stock remains.

## 3. Store inventory revision

Add `inventory_revision BIGINT UNSIGNED NOT NULL DEFAULT 1` to `shops` (or equivalent store-revision row). Every successful mutation of `inventory.quantity` or `inventory.reserved` increments the owning store revision **inside the same DB transaction**.

Centralize in `InventoryService`. Cover reserve, release, commit reserved, decrement, increment, adjustment, transfer-out/in, and direct batch receipt.

Revision is a staleness/debug signal, not a substitute for row locks.

## 4. Schema

### `offline_inventory_sessions`

```text
id
session_id UUID UNIQUE
snapshot_id UUID UNIQUE
shop_id FK indexed
store_device_id FK indexed
binding_version
boundary_server_at
opening_inventory_revision
status                    open | reconciling | closed | recovery_required
opened_at
last_client_sequence default 0
reconciling_at nullable
closed_at nullable
recovery_reason_code nullable
reconciliation_summary_json nullable
created_at
updated_at
```

Only one usable open/reconciling session may exist for the current store binding. Because MySQL partial uniqueness is awkward, enforce with a locked store/device row and test the race; do not use an unlocked check-then-insert.

### `offline_inventory_snapshot_items`

```text
id
offline_inventory_session_id FK
product_id FK
variant_id nullable FK
variant_key normalized (0 for simple) if needed for uniqueness
sku_snapshot
product_name_snapshot
opening_quantity
opening_reserved
opening_available
retail_price
wholesale_price
sell_on_pos
sell_on_social
product_active
created_at
```

Unique per session/product/variant key.

## 5. Snapshot service

Create `OfflineSnapshotService`. In a DB transaction:

1. verify device credential/binding version;
2. lock store/device binding;
3. verify store active;
4. reject rotation if client reports unsynced v2 events;
5. capture shop inventory revision;
6. query active products/variants eligible for POS or Social at the bound store;
7. compute quantity, **active** reserved, available;
8. capture retail/wholesale snapshot prices and presentation fields;
9. persist immutable session/item rows;
10. return typed DTO.

Do not bury the authoritative opening fields only inside a serialized Product model.

## 6. APIs

```text
GET /api/v1/admin/offline/bootstrap
GET /api/v1/admin/offline/session/{sessionId}/status
```

Bootstrap uses PRD-02 device headers. `shop_id` may be supplied only as a consistency assertion, never authority.

Request metadata can include:

```text
client_app_version
client_schema_version
unsynced_event_count
last_known_session_id
last_local_sequence
```

If unsynced count > 0 and caller tries to rotate snapshot, return `409 offline_events_must_sync_before_new_snapshot`.

Representative response:

```json
{
  "device": {"device_uuid":"...","binding_version":3,"shop_id":12},
  "session": {
    "session_id":"...",
    "snapshot_id":"...",
    "boundary_server_at":"...",
    "opening_inventory_revision":9182,
    "status":"open"
  },
  "catalog": [{
    "product_id":5,
    "variant_id":null,
    "opening_quantity":10,
    "opening_reserved":2,
    "opening_available":8,
    "retail_price":"1200.00",
    "wholesale_price":"1100.00",
    "sell_on_pos":true,
    "sell_on_social":true
  }]
}
```

## 7. Heartbeat extension

Extend heartbeat response with server inventory revision, active session ID, snapshot revision, and `snapshot_refresh_recommended`.

Heartbeat never rewrites the snapshot. Frontend may refresh only when it has no unsynced local v2 events.

## 8. Session rotation

- First bootstrap requires online server + registered device.
- Healthy refresh with zero unsynced events may close/retire previous fully acknowledged session and issue fresh snapshot.
- If unsynced events exist, do not rotate.
- Device replacement must now reject open/reconciling/recovery-required unresolved session with `409 offline_session_requires_resolution`; PRD-08 later adds audited lost-device recovery.

## 9. Snapshot price authority

Store retail/wholesale boundary prices. A completed offline POS event that used one of these prices must not later be rejected merely because current product price changed. Manual discounts stay separately auditable and must obey business rules.

## 10. Product/stock changes after boundary

Snapshot remains immutable if server later changes price, archives product, adds stock, creates reservations, or receives a transfer. Those changes affect current server state but not what the offline device was entitled to commit from the opening boundary. PRD-06 reconciles the difference.

## 11. Stale snapshot policy

Configuration default:

```text
offline_snapshot_startup_max_age_hours = 24
```

- first-ever offline use without snapshot -> blocked;
- stale cached snapshot on a fresh/restarted app with no trusted continuous session -> blocked;
- continuously offline durable session may continue while local availability remains;
- successful reconcile -> fresh snapshot required.

Stable reason: `offline_snapshot_too_old`.

## 12. Likely files

Backend:

- `app/Models/Shop.php`
- new `OfflineInventorySession` / `OfflineInventorySnapshotItem` models
- new `OfflineSnapshotService` / `OfflineSessionService`
- `InventoryService.php`
- device/connectivity services from PRD-02
- new/extended `OfflineSessionController.php`
- routes/config/migrations/tests

Only small frontend typed API preparation is needed; do not perform POS/Social cutover here.

## 13. Tests

1. opening available = quantity - active reserved;
2. pre-boundary reserved quantity never becomes sellable;
3. snapshot immutable after later stock mutation;
4. shop revision increments on every stock/reservation mutation;
5. snapshot revision remains fixed;
6. concurrent bootstrap -> at most one usable session;
7. new snapshot refused with unsynced events;
8. same open session can be re-read idempotently;
9. cross-store/bootstrap binding mismatch rejected;
10. replaced binding version rejected;
11. price change does not rewrite snapshot;
12. archive does not rewrite snapshot;
13. transfer-in does not enlarge opening available;
14. 24 h stale-start boundary behavior;
15. durable continuous session remains valid solely despite elapsed wall time;
16. PRD-01 tests remain green.

## 14. Acceptance criteria

Server can issue a durable immutable stock/price boundary tied to one store/device/binding version/server time/inventory revision. Existing reservations are excluded from sellable opening stock. Snapshot rotation cannot silently discard unresolved work. Device clock has no authority.

## 15. Handoff gate

Before PRD-04 provide a real seeded-store bootstrap sample, snapshot-vs-ledger reconciliation proof, inventory-revision tests, stale-age test, concurrent bootstrap test, and exact response schema the IndexedDB client will install.
