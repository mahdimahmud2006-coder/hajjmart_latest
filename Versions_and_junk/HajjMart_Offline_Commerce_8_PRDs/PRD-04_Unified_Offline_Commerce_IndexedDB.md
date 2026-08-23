# PRD-04 — Unified Offline Commerce IndexedDB and Atomic Local Stock Authority

**Sequence:** 4 of 8  
**Depends on:** PRD-03  
**Unlocks:** PRD-05 POS + Social cutover

## 1. Objective

Replace the independent POS and Social browser queues with one channel-neutral database so both channels consume the **same per-store offline stock pool**. A user-facing offline success may appear only after immutable event + local stock commitment are durable in the same IndexedDB transaction.

## Baseline and implementation contract

This PRD is written against the latest HajjMart implementation package:

- **Package:** `HajjMart_PRD10_Final_Admin_Compliance_Implemented_2026-08-20.zip`
- **SHA-256:** `cbadb81622753f5f8822a3e07726fcff555a9f0b5df28a2a1436a57179bf9df9`
- **Backend:** Laravel API
- **Frontend:** Next.js admin
- **Current foundations to preserve:** one unified `orders` ledger, store-scoped `inventory`, `reserved_products`, FIFO/direct batches, POS IndexedDB queue/idempotency, and the existing Social Commerce fast-order flow.

Before editing, the AI agent must read this PRD, all prior PRDs in this sequence, and the latest handoff. Inspect every named file before changing it. Preserve the unified order/inventory model; do not create a second offline business ledger. Put stock mutations inside DB transactions with row locks where concurrency matters. Treat retries as normal and make network writes idempotent. Expected business conflicts must return stable 4xx reason codes rather than raw exceptions. Add behavioral tests with the implementation, and record migrations, API changes, commands/tests run, changed files, and known limits in the handoff.


## 2. Current problems to remove

Current frontend has:

- DB `hajjmart-pos-offline` in `pos-db.ts`;
- POS queue write and `applyLocalInventoryDelta()` as separate operations;
- local stock code that clamps with `Math.max(0, ...)`;
- DB `hajjmart-social-orders` in `social-order-offline.ts`;
- Social queue that does not consume POS local stock;
- separate device IDs.

This allows cross-channel oversell and crash windows.

## 3. New DB/modules

```text
DB: hajjmart-offline-commerce-v2
schema version: 1
```

Create channel-neutral modules such as:

- `commerce-types.ts`
- `commerce-db.ts`
- `commerce-stock.ts`
- `commerce-sync.ts` (transport skeleton; PRD-06 completes reconciliation)
- `legacy-offline-migration.ts`

## 4. Object stores

### `catalog`
Immutable snapshot presentation/prices/channel eligibility, keyed by store/session/product/variant.

### `stock`

```text
openingQuantity
openingReserved
openingAvailable
committedQuantity
inventoryRevisionAtSnapshot
```

Derived only:

```text
localAvailable = openingAvailable - committedQuantity
```

Never persist a clamped value that hides negative corruption.

### `events`

Key `clientTransactionId`, with:

```text
shopId
deviceUuid
bindingVersion
sessionId
snapshotId
localSequence
type: pos_sale | social_order | correction
status: committed_local | syncing | synced | needs_attention | legacy_pending_review
payload
createdAtDevice       # audit only
committedAtLocal
serverOrderId/serverOrderNumber
attempts
lastErrorCode/Message
syncMetadata
```

Indexes: shop, session, status, sequence, committed time.

### `meta`
Device binding public data/token reference, current session/snapshot, boundary time, opening revision, last local sequence, last acknowledged sequence, schema version, last sync, continuous-session marker.

### `carts`, `held_sales`, `social_drafts`, optional `receipts`

Held POS sales and Social drafts do **not** consume stock.

## 5. Atomic `commitCommerceEvent()`

One channel-neutral method validates and commits an event. In **one readwrite transaction** over `stock`, `events`, and `meta`:

1. verify current session/snapshot;
2. reject duplicate event ID unless idempotently identical;
3. read every affected stock row;
4. verify row/channel exists;
5. verify positive quantities;
6. compute local available;
7. fail if any line insufficient;
8. increment committed quantity on all rows;
9. increment one monotonic local sequence;
10. write immutable event with that sequence;
11. commit;
12. resolve success only after transaction complete.

If one line fails, zero lines/event/sequence changes survive.

Stable local errors:

```text
offline_storage_unavailable
offline_session_missing
offline_snapshot_mismatch
offline_sku_missing_from_snapshot
offline_channel_not_allowed
offline_insufficient_local_stock
offline_local_stock_corrupt
offline_duplicate_event
```

## 6. Multi-tab correctness

One device is not one tab. IndexedDB transaction is final authority. Additionally use `navigator.locks` when available and BroadcastChannel for UI refresh, but correctness must still hold without browser locks.

Be careful with Safari auto-commit: do not `await` unrelated work mid-transaction and then assume the transaction remains open. Chain IDB requests/transaction-safe helpers.

## 7. Snapshot install

`installOfflineSnapshot()` must verify store/device/binding, refuse replacement with unsynced v2 events, write catalog/stock/meta without exposing half-installed state, set committed quantity 0 for new session, and preserve historical synced events according to retention.

Request `navigator.storage.persist()` where supported. Failure is diagnostic, not fatal while storage itself works.

## 8. Shared reads

Expose:

```ts
getLocalAvailability(...)
getLocalCatalog(shopId, channel)
getCurrentOfflineSession(shopId)
countUnsyncedCommerceEvents(shopId)
listCommerceEvents(...)
```

PRD-05 ProductPicker/pages use these.

## 9. Legacy migration — no sale loss

Unsynced old events predate server sessions and cannot honestly be attached to a new snapshot. Implement one-time importer:

1. read old POS DB unsynced sales/carts/held sales;
2. read old Social DB unsynced orders/drafts;
3. copy unresolved business events into v2 `events` as `legacy_pending_review`;
4. copy held/draft state without stock commitment;
5. leave original DBs untouched;
6. mark import version in v2 meta.

If `legacy_pending_review` exists:

- new v2 offline selling is disabled;
- when online, sync old events through existing legacy endpoints first;
- only after they resolve may client bootstrap a fresh v2 snapshot;
- unresolvable legacy event requires explicit review; never silently discard it to unlock v2.

Do not delete old DBs in this PRD.

## 10. Device migration

Move/copy PRD-02 common device binding into v2 meta. Old POS/Social IDs are retained only on imported legacy events where needed for old sync endpoints.

## 11. Test tooling

Current frontend lacks behavioral IndexedDB unit tests. Add a minimal stack such as `vitest` + `fake-indexeddb`. Do not add a large E2E framework only for this PRD.

## 12. Likely files

Frontend:

- new `src/lib/offline/commerce-types.ts`
- `commerce-db.ts`
- `commerce-stock.ts`
- `commerce-sync.ts`
- `legacy-offline-migration.ts`
- `commerce-device.ts`
- `package.json`
- tests + optional verification script

Do not remove old `pos-db.ts`, `pos-sync.ts`, or `social-order-offline.ts` until PRD-05 cutover is proven.

## 13. Tests

1. opening stock 1, two tabs POS/Social commit concurrently -> exactly one wins;
2. multi-line event with one short line -> no mutation anywhere;
3. local sequence increments once per committed event;
4. duplicate transaction ID -> no second stock commitment;
5. transaction abort -> no event/no mutation;
6. failure after request writes but before transaction completion -> full abort;
7. negative local available is error, never clamped;
8. held sale no commitment;
9. Social draft no commitment;
10. snapshot replacement refused with unsynced events;
11. Store A key cannot satisfy Store B;
12. variants isolated;
13. old POS unsynced record imported without deletion;
14. old Social unsynced record imported without deletion;
15. legacy pending blocks v2 offline mode;
16. fresh snapshot after legacy clear enables v2;
17. IndexedDB unavailable -> fail closed.

## 14. Acceptance criteria

POS and Social can use one local DB/stock table/session/sequence; event+stock mutation is atomic; negative stock cannot be hidden; legacy business events are preserved; behavioral race tests pass; channel pages have not yet been switched prematurely.

## 15. Handoff gate

Before PRD-05 provide object-store manifest, two-tab final-unit test output, legacy POS+Social migration demo, proof old DBs remain intact, fresh snapshot install demo, and the exact `commitCommerceEvent()` contract.
