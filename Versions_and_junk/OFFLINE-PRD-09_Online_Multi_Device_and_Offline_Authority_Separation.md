# OFFLINE-PRD-09 — Separate Normal Online Commerce from Offline Device Authority

**Sequence:** 1 of 3 redesign PRDs  
**Depends on:** current HajjMart codebase including the existing offline POS/Social work through PRD-08  
**Unlocks:** OFFLINE-PRD-10 clean offline-device lifecycle and handover

---

## 1. Why this PRD exists

The current HajjMart offline architecture has conflated two different ideas:

1. **A device that is allowed to use HajjMart while online**, and
2. **A device that is trusted to keep selling when the store cannot reach the server.**

Those must be separated.

The desired business rule is:

> A store may have many employees and many devices working normally while online. No device registration is required for normal online POS or Social Commerce. Exactly one device per store may hold offline-selling authority.

The registered device is therefore not the store's only commerce device. It is the store's **offline authority device**.

This PRD changes the access/mode model only. It does **not** yet implement the final handover workflow; that is OFFLINE-PRD-10.

---

## 2. Business decisions that are already resolved

These are requirements, not questions for the implementing agent.

### 2.1 Online use

- Any authenticated employee with the existing permission to use POS or Social Commerce may open the normal HajjMart website from any device.
- Normal online POS/Social Commerce must **not** require:
  - a registered device UUID;
  - an offline device secret/token;
  - a matching offline snapshot;
  - an offline session ID.
- Two or more employees may work online at the same store at the same time.
- Normal server-side inventory/reservation rules remain authoritative online.

### 2.2 Offline use

- Exactly one device per store may be registered for offline authority.
- Only that device receives the ability to finalize POS/Social transactions without server connectivity.
- Other devices may have a cached page shell because of normal browser/service-worker behavior, but without the offline binding + snapshot they must not be able to finalize an offline transaction.
- The offline device may still use the same normal online workflow while the backend is healthy.

### 2.3 Store enters an offline-selling period

Once the registered offline-authority device has actually transitioned into offline selling:

- that device may continue POS + Social locally;
- non-authority devices must not finalize POS/Social for that store until the offline journal is reconciled;
- an employee finding separate mobile internet on another device is **not** a safe bypass;
- if staff want to change devices, they must follow the later handover PRD.

### 2.4 Website/eCommerce customers

Do not change the customer Website allocation/preemption rules except where required by existing PRD-06/07 store safety.

The distinction in this PRD is primarily:

- **employee POS**;
- **employee Social Commerce**;
- **offline-authority device**.

Existing Website multi-store allocation and provisional reservation behavior should remain intact.

---

## 3. Current-code findings that motivate the change

The implementing agent must re-check these against the latest branch before editing, but the current architecture contains these patterns:

- `StoreDeviceService` stores one current device row per shop and rejects a second binding.
- Error/UI wording currently refers to a registered **commerce device**, which makes the device appear to own all commerce instead of offline authority only.
- The current v2 POS/Social cutover uses common device/session/snapshot state for final submission.
- The registered device path is local-first even while the backend is reachable.
- The offline feature flag and device readiness can therefore block normal online commerce when they should only govern offline capability.
- Existing server services already contain the useful primitives that should be preserved:
  - reservation-first non-POS flow;
  - POS physical stock/FIFO behavior;
  - store connectivity state;
  - reconciliation;
  - store-level stock guards;
  - multi-store allocator;
  - one offline binding per store.

Do not throw these away. The task is to **separate mode/authority**, not rebuild inventory.

---

## 4. Target operating model

Each store should conceptually have these modes.

### 4.1 `ONLINE_NORMAL`

Conditions:

- backend reachable for the employee device;
- store is not in reconciliation/recovery;
- store is not currently blocked by an unresolved offline-selling epoch.

Behavior:

- any authorized employee device may use POS/Social;
- orders go directly to normal server APIs;
- no new local offline event is created;
- no local stock is decremented for an online transaction;
- registered offline device behaves like any other online device for the sale itself;
- its offline cache/snapshot is standby only.

### 4.2 `OFFLINE_ACTIVATION_PENDING`

Conditions:

- registered offline device cannot reach backend;
- it has not yet crossed the conservative offline-activation threshold.

Behavior:

- cart/draft work may continue locally;
- final Charge / Place Order is temporarily blocked;
- show plain copy such as:
  - `Checking store connection. Offline selling will be available shortly if the connection does not return.`

Reason:

The server also uses heartbeat age to decide when a store is no longer healthy. Starting offline selling immediately on the first failed request could overlap with another employee who is still selling online against server stock.

### 4.3 `OFFLINE_AUTHORITY_ACTIVE`

Conditions:

- device is the current offline authority;
- backend is unreachable;
- offline activation threshold has passed;
- cached session/snapshot is valid;
- store/device is not recovery-required;
- local storage is healthy.

Behavior:

- only the offline-authority device may finalize POS/Social locally;
- local POS/Social share the existing v2 stock pool and local sequence;
- other devices cannot finalize POS/Social for this store.

### 4.4 `SYNC_REQUIRED` / `RECONCILING`

Conditions:

- registered device has unsynced local business events and backend is reachable again.

Behavior:

- upload/reconcile the same immutable local journal;
- final new sales should wait until reconciliation finishes;
- other online employee devices remain blocked for this store until reconciliation establishes trusted server stock again.

### 4.5 `RECOVERY_REQUIRED`

Preserve existing recovery behavior.

- no ordinary POS/Social finalization for this store;
- no device replacement shortcut;
- no outbound stock mutation that undermines recovery;
- Website allocator should avoid/reroute according to existing rules.

---

## 5. Important technical limitation and accepted business tradeoff

There is no way for a disconnected browser to instantly tell the server:

> "I just lost internet; block every other device now."

Therefore the implementation must use the existing heartbeat timing as the shared safety boundary.

Current configuration already has concepts such as:

- heartbeat interval;
- healthy threshold;
- offline suspected;
- offline confirmed.

### Required rule

The offline-authority device must not finalize its **first** offline event until the time since its last successful server contact is at least the configured server healthy threshold.

In other words:

```text
first failed network request
        |
        v
keep cart/draft, no final offline sale yet
        |
        v
wait until last successful contact is old enough that server also
considers the store at least offline-suspected
        |
        v
offline finalization may begin
```

Do not invent a second unrelated timeout. Use the same configuration contract as `StoreConnectivityService`.

### Operational SOP is part of the model

If the store's main internet fails, staff should stop finalizing store POS/Social from other devices rather than trying to work around it with separate mobile data. If they want to move to another offline device, they must first synchronize and hand over from the current authority device.

This business rule is intentionally conservative.

---

## 6. Backend changes

### 6.1 Keep `StoreDevice` as the one offline binding

For simplicity, do **not** rename the database table/model in this PRD.

Change the meaning and UI/API copy from:

> registered commerce device

to:

> registered offline device / offline authority device

The one-row-per-shop binding remains useful.

### 6.2 Normal online POS must not verify offline device credentials

Inspect the current POS server route used by the live POS page.

When the request is an ordinary online POS sale:

- authenticate employee normally;
- authorize store access normally;
- do not require offline headers;
- do not require offline session/snapshot;
- do not write an `offline_event_receipt`;
- use existing server POS/FIFO/Payment services;
- retain idempotency for response-loss retries.

If current online POS idempotency is weaker than the offline journal, add/retain one stable `client_transaction_id` for the online request so a lost HTTP response does not create a duplicate physical sale on retry.

Do not reuse local offline sequence for normal online transactions.

### 6.3 Ordinary online Social Commerce must not verify offline device credentials

For a normal connected Social order:

- authenticate employee normally;
- authorize selected store normally;
- use reservation-first `OrderService` behavior;
- reservation class comes from `ReservationPolicyService`;
- no offline event receipt/session/local sequence is created.

### 6.4 Add one centralized employee-commerce store gate

Do not scatter state checks through controllers.

Prefer extending the existing store connectivity/policy service with something equivalent to:

```php
assertOrdinaryEmployeeCommerceAllowed(Shop $shop, string $channel): void
```

This gate applies to **ordinary employee POS/Social finalization**, not Website checkout.

Expected behavior:

| Store state | Ordinary employee POS/Social |
|---|---|
| no offline device | allowed while request is online |
| online healthy | allowed |
| offline suspected | blocked |
| offline confirmed | blocked |
| reconciling | blocked |
| recovery required | blocked |

Stable machine code recommendation:

```text
store_waiting_for_offline_device_sync
```

Safe operator copy:

> This store is using offline sales. Wait for the registered offline device to sync before selling from this device.

Do not expose UUID/session terminology.

### 6.5 Preserve Website allocation semantics

Do **not** apply the employee-commerce block blindly to Website checkout.

Website allocation should continue to:

- prefer healthy stores;
- reroute where possible;
- use existing provisional/preemptible behavior where permitted by the current allocator/reconciliation design.

### 6.6 Feature flag semantics

`offline_commerce_v2_enabled` must mean:

> This store may use the new offline-authority capability.

It must **not** mean:

> This store may use POS/Social at all.

Therefore:

- flag off + backend online -> normal online POS/Social still works on any employee device;
- flag off + backend offline -> no offline finalization;
- flag on + registered authority + valid offline readiness -> offline finalization may work.

Do not restore the old legacy browser queues as the normal flag-off path.

Legacy DB/code stays recovery/migration compatibility only.

---

## 7. Frontend changes

### 7.1 Introduce one mode decision for POS and Social

Do not let the two pages independently guess their operating mode.

Extend the shared offline readiness state or add the smallest common helper necessary to expose:

```text
backendReachable
storeConnectivityState
isThisBrowserOfflineAuthority
hasValidOfflineSnapshot
hasUnsyncedOfflineEvents
offlineActivationEligibleAt
commerceMode
canSubmitOnline
canCommitOffline
blockReasonCode
```

Recommended `commerceMode` values:

```text
online_server
offline_activation_pending
offline_authority
sync_required
blocked_non_authority
reconciling
recovery_required
```

Do not create a second state machine in each page.

### 7.2 POS page

When `online_server`:

- ProductPicker uses live server stock;
- Charge posts directly to the normal POS server endpoint;
- do not call `commitCommerceEvent()`;
- do not increment local committed quantity;
- registered and non-registered browsers behave the same for the sale.

When `offline_authority`:

- use cached snapshot catalog/stock;
- Charge uses `commitCommerceEvent()`;
- only the registered authority browser may do this.

When another browser loses internet:

- show the page if browser cache happens to exist;
- do not show it as offline-ready;
- Charge is disabled with plain copy:
  > Offline sales are available only on this store's registered offline device.

### 7.3 Social Commerce page

When `online_server`:

- any authorized employee browser can create Social orders normally;
- store selector continues to follow existing authorization;
- normal server reservation flow is used;
- no offline device identity required.

When `offline_authority`:

- store is fixed to the registered authority's store;
- cached catalog/draft may be used;
- final Place Order uses the shared local event commit.

When non-authority + offline:

- typed customer/order content may remain in ordinary browser form state if available;
- do not create a local business event;
- final Place Order is blocked.

### 7.4 Registered authority browser while online

This is important:

> Being registered must not force the browser onto the local-first path while online.

The registered browser should still use the normal server-first path while healthy. Its offline snapshot is standby data only.

---

## 8. Online concurrency requirements

Opening normal online access to multiple devices means server-side concurrency must be treated as a release gate.

### 8.1 POS final unit

Scenario:

```text
Server stock = 1
Device X online POS -> Charge x1
Device Y online POS -> Charge x1 at same time
```

Exactly one physical sale may succeed.

The loser receives a normal stock conflict. No negative quantity/FIFO duplication.

### 8.2 Social final unit

Two connected Social employees reserving the final unit must serialize through the normal reservation/inventory transaction.

### 8.3 Mixed POS/Social online

A physical POS sale and Social reservation racing for the final unit must produce one valid deterministic outcome based on the server transaction/locking rules.

Do not rely on React state or pre-submit availability displays.

---

## 9. Offline activation safety

The registered device must maintain:

- last successful heartbeat/server contact time;
- last known server inventory revision;
- snapshot inventory revision;
- offline readiness state.

Before the **first** local offline event in a new disconnected period, require:

1. current browser is registered authority;
2. offline feature enabled for the shop;
3. local storage healthy;
4. snapshot/session valid;
5. snapshot was known current at last successful server contact;
6. no recovery state;
7. enough time has passed since last successful contact for the server to no longer classify the shop `online_healthy`.

If any fail, block final offline action and keep cart/draft where safe.

Do not silently use an obviously stale snapshot.

---

## 10. Likely files

Re-check names in the latest branch before editing.

### Backend

- `app/Services/StoreDeviceService.php`
- `app/Services/StoreConnectivityService.php`
- `app/Services/ReservationPolicyService.php`
- `app/Services/OrderService.php`
- `app/Services/InventoryService.php`
- `app/Http/Controllers/Api/V1/Admin/PosController.php`
- `app/Http/Controllers/Api/V1/Admin/OrderController.php`
- public Website checkout controller only if shared guards accidentally affect it
- route definitions
- tests

### Frontend

- `src/app/admin/(panel)/pos/page.tsx`
- `src/app/admin/(panel)/social-commerce/page.tsx`
- shared ProductPicker
- `src/lib/offline/commerce-device.ts`
- `src/lib/offline/commerce-session.ts`
- `src/lib/offline/commerce-stock.ts`
- `src/lib/offline/commerce-sync.ts`
- shared offline readiness/state helper introduced in PRD-05/08
- `src/components/admin/offline-commerce-status.tsx` or current equivalent
- `src/lib/admin-i18n.ts`
- tests/verifiers

---

## 11. Required automated tests

At minimum:

1. two employees, two unregistered browsers, same healthy store -> both can use online Social;
2. two online POS browsers same store -> both can open/use page;
3. two online POS browsers race final unit -> one succeeds;
4. online registered authority browser uses server path and creates **zero** new local offline event;
5. offline feature flag off -> online POS/Social still work;
6. offline feature flag off -> offline Charge/Place blocked;
7. non-authority browser loses internet -> offline finalization blocked;
8. authority browser first loses connection -> final offline action blocked during activation grace;
9. after activation threshold + valid snapshot -> authority local POS succeeds;
10. after store becomes offline-suspected -> connected non-authority employee POS submission rejected;
11. same for ordinary online Social submission;
12. Website checkout behavior remains governed by allocator, not the new employee-commerce block;
13. store B online activity unaffected when Store A offline;
14. ordinary online POS response-loss retry does not create duplicate stock decrement;
15. ordinary online Social response-loss retry does not create duplicate order/reservation;
16. registered device UUID/token never required on ordinary online request;
17. offline endpoint still rejects non-authority device;
18. current PRD-01–08 inventory/reconciliation regressions remain green.

---

## 12. Acceptance criteria

This PRD is complete only when all are true:

- Multiple employee devices can use POS/Social online at the same healthy store.
- Normal online use requires employee authentication/authorization only, not offline-device registration.
- Exactly one device still owns offline authority.
- Registered authority browser uses normal server path while online.
- Local v2 event/stock authority is used only in offline-authority mode.
- Non-authority devices cannot finalize offline sales.
- Ordinary employee POS/Social is blocked while a store has entered unresolved offline risk/reconciliation.
- Website allocation behavior is not accidentally disabled.
- `offline_commerce_v2_enabled` controls offline capability only.
- Online final-unit races are server-safe.
- Existing offline journal/reconciliation history remains intact.

---

## 13. Explicit non-goals

Do not implement in this PRD:

- two offline devices for one store;
- peer-to-peer device sync;
- Bluetooth/LAN transfer;
- automatic dead-device recovery;
- manual handwritten-sale recovery workflow;
- final device handover/release UX;
- deleting legacy browser databases;
- a new inventory ledger;
- stock partitioning/escrow between online devices.

Those would either violate the agreed business model or belong to later PRDs.

---

## 14. Handoff to OFFLINE-PRD-10

The handoff must document:

- which online POS/Social routes are now device-independent;
- the centralized employee-commerce block rule;
- exact mode resolution used by both POS and Social pages;
- offline activation threshold and how it maps to server connectivity state;
- proof registered authority online requests create no local event;
- proof non-authority online devices work normally while store healthy;
- proof non-authority devices are blocked once the store is in an offline-selling epoch;
- current offline binding row/status semantics;
- all tests/results.

Do not start OFFLINE-PRD-10 until this separation is stable.
