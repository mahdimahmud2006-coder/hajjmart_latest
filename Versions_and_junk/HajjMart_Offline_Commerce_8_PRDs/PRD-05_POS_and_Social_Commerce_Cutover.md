# PRD-05 — POS and Social Commerce Cutover to One Offline Stock Authority

**Sequence:** 5 of 8  
**Depends on:** PRD-01 through PRD-04  
**Unlocks:** PRD-06 deterministic reconciliation

## 1. Objective

Switch HajjMart POS and Social Commerce from their current independent offline paths to the same device identity, snapshot, IndexedDB journal, local sequence, and per-store local stock pool.

After this PRD:

- POS and Social Commerce cannot independently sell the same final offline unit;
- the operator sees success only after the local event and stock commitment are durably committed;
- held POS sales and Social drafts remain non-reserving until final submission;
- a store-bound device cannot create an offline sale for another store;
- completed offline POS sales retain snapshot-authorized pricing even if the server price changes later;
- the old POS and Social offline databases remain only as migration/recovery compatibility paths and receive no new v2 business events.

## 2. Baseline and implementation contract

This PRD is written against the latest HajjMart implementation package:

- **Package:** `HajjMart_PRD10_Final_Admin_Compliance_Implemented_2026-08-20.zip`
- **SHA-256:** `cbadb81622753f5f8822a3e07726fcff555a9f0b5df28a2a1436a57179bf9df9`
- **Backend:** Laravel API
- **Frontend:** Next.js admin
- **Current foundations being preserved:** unified `orders`, store-scoped inventory, FIFO/direct batches, reservation ledger from PRD-01, device/session/snapshot authority from PRD-02/03, unified IndexedDB v2 from PRD-04.

Before editing, the implementing agent must read this PRD, all preceding PRDs, and the latest handoff. Keep changes surgical and do not create channel-specific server order tables.

## 3. Current-code problems this PRD must remove

The current frontend has two different offline behaviors:

1. POS uses `pos-db.ts` / `pos-sync.ts`. It queues a sale and mutates local cached inventory in separate operations.
2. Social Commerce uses `social-order-offline.ts`. It queues an order in a separate IndexedDB and does not consume the POS local stock pool.
3. POS and Social have separate local device identifiers.
4. The current POS server sync rejects an offline sale if today's server price differs from the locally captured price.

Those behaviors are incompatible with the required precedence model and must not remain on the v2 path.

## 4. Shared commerce readiness state

Create one frontend source of truth, for example:

```text
OfflineCommerceState
```

It must expose at least:

```text
backendReachable
registeredDevice
boundShopId
bindingVersion
currentSessionId
currentSnapshotId
snapshotBoundaryAt
snapshotAge
snapshotInventoryRevision
serverInventoryRevision
unsyncedV2EventCount
legacyPendingCount
storageHealthy
operationalState
canSellOffline
blockReasonCode
```

POS and Social Commerce must consume this same state rather than implementing their own network/offline decisions.

### `navigator.onLine`

`navigator.onLine` may trigger a retry, but it is not proof that the Laravel API is reachable. The shared heartbeat/bootstrap response from PRD-02/03 is authoritative.

## 5. Offline readiness gate

An offline POS Charge or Social Place Order is allowed only when all are true:

```text
registered current device binding
AND current snapshot/session belongs to that binding + store
AND v2 IndexedDB is healthy
AND snapshot/session passes PRD-03 age rules
AND no unresolved legacy business events block v2
AND session/store is not recovery_required
```

If any condition fails, block the final transaction action but keep browsing/drafts where safe.

Stable visible states:

```text
All synced
Syncing
Offline — saved on device
Snapshot required
Old unsynced sales need attention
Storage unavailable — offline sales disabled
Recovery required
```

Do not expose raw exceptions or IDs as normal operator copy.

## 6. Online freshness rule before local-first commit

V2 uses a local-first durable journal even when the backend appears reachable, because an HTTP response can disappear after a server commit.

However, a healthy online device must not intentionally sell from a stale snapshot while newer protected reservations already exist.

Before a new local-first POS/Social commit when:

```text
backendReachable == true
AND unsyncedV2EventCount == 0
AND serverInventoryRevision != snapshotInventoryRevision
```

refresh/bootstrap the snapshot first.

If the refresh succeeds, use the new snapshot.

If the connection fails during refresh and the store transitions into an offline-risk state, the device may continue from the still-valid old snapshot according to PRD-03. It must not falsely label the snapshot as fresh.

## 7. POS flow

Update the current POS page to use the shared v2 database.

### 7.1 Product availability

When v2 is active:

- ProductPicker availability comes from `commerce-stock.ts` for the device-bound store;
- product/variant presentation can use cached snapshot catalog data offline;
- displayed availability is `openingAvailable - committedQuantity`;
- zero/negative invariant failures do not get clamped;
- cross-tab commit notifications refresh the POS list/cart state.

### 7.2 Charge

On Charge:

1. validate cart and payment fields;
2. generate one UUID `client_transaction_id`;
3. construct an immutable `pos_sale` payload;
4. call `commitCommerceEvent()` exactly once;
5. the IndexedDB transaction validates all lines and atomically increments local committed stock + writes event + local sequence;
6. only after local commit resolves may the UI show success/receipt;
7. clear the active cart;
8. if backend is reachable, immediately invoke v2 sync;
9. if transport fails or response is lost, keep the event `committed_local`; never ask the cashier to charge the customer again solely because sync failed.

The v2 path must not call old `queuePosSale()` followed by old `applyLocalInventoryDelta()`.

### 7.3 Receipt

The receipt/success state shows:

- local reference until server number exists;
- total;
- payment method;
- sync state;
- server order number when acknowledged.

A temporary local number must be visually distinguishable from the final server order number.

## 8. POS pricing and payments

Store on each POS event:

```text
snapshot_id
snapshot retail/wholesale base price
actual charged unit price
price mode
manual discount if any
payment method
payment reference if required
payment verification state
```

### Snapshot price authority

Do not apply the legacy rule “current server price differs -> reject” to v2 events.

A completed POS sale is valid if its base price was authorized by the event's immutable snapshot and any manual discount followed existing discount rules.

Current-price drift becomes audit metadata, not a reason to erase a physical sale.

### Offline digital payments

V1 permits Cash / bKash / Nagad / Card according to current POS UI.

When real-time verification was not possible, mark digital payment:

```text
unverified_offline
```

A later payment-verification problem becomes operational attention. It does not retroactively make the stock physically unsold.

Do not implement offline stateful loyalty redemption, one-time vouchers, or server-only credit limits in this PRD.

## 9. Held POS sales

Held sales remain non-reserving.

Rules:

- Hold Sale writes cart content only;
- held sale does not increment local committed stock;
- Resume re-reads current shared availability;
- if another POS/Social event consumed a held line, show the exact shortage;
- do not automatically lower quantity or silently substitute another variant;
- final Charge performs the atomic stock check again.

## 10. Social Commerce flow

Update the current Social Commerce page to use the same v2 database and device binding.

### 10.1 Draft/autosave

A draft is not a reservation.

Autosave customer/order-entry progress into `social_drafts`, but do not consume local stock.

### 10.2 Place Order

On final Place Order:

1. validate customer, store, lines, delivery fields, totals;
2. generate one `client_transaction_id`;
3. construct immutable `social_order` event;
4. call the same `commitCommerceEvent()` used by POS;
5. atomically consume local committed stock from the shared pool;
6. show local reference and `Saved on device` only after IDB commit;
7. if online, immediately invoke v2 sync;
8. if response is lost, event remains retryable and must not be recreated as a new order.

When synchronized, PRD-06 will create a **protected reservation** for this Social order. It must not physically consume FIFO at Social order creation.

## 11. Cross-channel final-unit invariant

This scenario is a release gate:

```text
Opening local SKU A = 1

Tab A: POS Charge SKU A x1
Tab B: Social Place Order SKU A x1
```

Exactly one IndexedDB transaction commits.

The loser receives:

```text
offline_insufficient_local_stock
```

No combination of React state timing, two tabs, or rapid double-clicks may show two successful transactions.

## 12. Store binding and store switching

The current Social Commerce UI may expose a store selector. The selector must not override device authority offline.

Rules:

- a device registered to Store A can create v2 offline events only for Store A;
- POS cannot switch store while using offline commerce mode;
- Social can browse other-store data online if current admin behavior permits, but Place Order offline is disabled for another store;
- if the UI-selected store differs from the binding, show plain copy such as:
  `This device is registered to Mirpur Store.`
- server-side PRD-06 sync revalidates store/device/session regardless of frontend checks.

## 13. Legacy cutover

On startup, run PRD-04 legacy import once.

If unresolved old POS/Social events exist:

- show a blocking migration state;
- when online, sync those events through the existing legacy endpoint/path;
- do not create new v2 business events until legacy business events are acknowledged or explicitly reviewed;
- after legacy queue is clear, fetch a fresh v2 snapshot;
- then enable v2 Charge/Place.

New v2 transactions must not write into:

```text
hajjmart-pos-offline
hajjmart-social-orders
```

Keep old databases readable for recovery until PRD-08 rollout retires them.

## 14. Service worker behavior

Inspect and update current POS service-worker integration as needed.

Requirements:

- app shell can load offline;
- service worker never fabricates a success response for a failed API write;
- IndexedDB is not cleared on service worker/version upgrade;
- unsupported future schema fails closed instead of deleting/recreating local event history;
- cache updates do not interrupt an already-open transaction/session.

## 15. Authentication expiry while offline

If the employee's access token/session expires during an outage:

- existing durable local device/session data is not erased;
- POS/Social may continue local offline selling only if the previously authenticated device/session policy allows it;
- on reconnect, sync requests that receive 401 require re-authentication;
- unsynced events remain intact through login;
- after login, retry the same immutable events with the same IDs/sequences.

Do not couple local event deletion to auth token state.

## 16. Likely files

Frontend, likely:

- `src/app/admin/(panel)/pos/page.tsx`
- `src/app/admin/(panel)/social-commerce/page.tsx`
- current `ProductPicker` component
- `src/components/admin/pos-service-worker.tsx`
- `src/components/admin/social-order-sync.tsx`
- new/shared `src/components/admin/offline-commerce-sync.tsx`
- new/shared `src/components/admin/offline-commerce-status.tsx`
- `src/lib/offline/commerce-db.ts`
- `src/lib/offline/commerce-stock.ts`
- `src/lib/offline/commerce-sync.ts`
- `src/lib/offline/commerce-device.ts`
- `src/lib/offline/legacy-offline-migration.ts`
- old `pos-db.ts`, `pos-sync.ts`, `social-order-offline.ts` only for compatibility/migration
- `src/lib/admin-types.ts`
- `src/lib/admin-i18n.ts`
- tests

Backend changes should be limited to v2 transport seams required for PRD-06; do not implement partial victim/preemption logic here.

## 17. Required tests

Automate at least:

1. POS sells exactly opening local available; next unit blocked;
2. Social consumes same local stock pool;
3. two-tab POS/Social final-unit race -> one winner;
4. held POS sale does not reserve;
5. held sale resumes after Social consumes stock -> exact shortage shown;
6. Social draft does not reserve;
7. Social final Place revalidates after POS consumes stock;
8. device Store A cannot submit offline Store B event;
9. browser crash after local commit -> event and committed quantity survive;
10. crash before transaction commit -> no receipt, event, or stock change;
11. IndexedDB unavailable -> Charge/Place blocked;
12. HTTP response loss after local-first online commit -> same event remains retryable;
13. server price changes after snapshot -> snapshot price stays on event;
14. product archived after snapshot -> immutable event still contains original identity;
15. digital offline payment -> `unverified_offline`;
16. stale startup snapshot -> transaction blocked;
17. auth expires offline -> local history preserved and sync waits for re-auth;
18. unresolved legacy queue -> v2 blocked;
19. after legacy queue clear + fresh bootstrap -> v2 enabled;
20. no new transaction records appear in either old DB.

## 18. Acceptance criteria

- New POS and Social events share one DB, one stock pool, one device identity, one snapshot/session, and one sequence.
- No offline success is shown before durable atomic local commit.
- POS and Social cannot double-sell the same final local unit.
- Held sales and drafts remain non-reserving.
- Snapshot-authorized POS pricing survives later server price changes.
- Cross-store offline submission is blocked.
- Legacy unsynced business events are preserved and must resolve before v2 activation.
- Existing fast POS and Social UX remains operational.

## 19. Handoff gate

Do not begin PRD-06 until the handoff includes:

- a two-tab POS-vs-Social final-unit demonstration;
- a browser crash/reload recovery demonstration;
- representative POS and Social v2 event records using the same session with increasing local sequences;
- proof that no new v2 event was written into old databases;
- stale-snapshot and IndexedDB-unavailable failure demonstrations;
- frontend typecheck/build/test output.
