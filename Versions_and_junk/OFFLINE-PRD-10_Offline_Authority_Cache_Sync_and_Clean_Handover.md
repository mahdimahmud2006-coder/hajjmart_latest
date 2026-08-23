# OFFLINE-PRD-10 — Offline Authority Cache, Sync Lifecycle, and Clean Device Handover

**Sequence:** 2 of 3 redesign PRDs  
**Depends on:** OFFLINE-PRD-09  
**Unlocks:** OFFLINE-PRD-11 dead-device/manual-fallback recovery

---

## 1. Objective

Make the one registered offline-authority device behave like a reliable store tool rather than a permanent device lock.

The target business flow is:

```text
Device A is registered offline authority
        |
        v
A can use normal online POS/Social while connected
        |
        v
store internet fails
        |
        v
A alone can continue from its cached offline workspace
        |
        v
A gets temporary mobile internet
        |
        v
A synchronizes every local transaction
        |
        v
0 pending / server stock trusted
        |
        v
A releases offline authority
        |
        v
Device B registers
        |
        v
B receives completely fresh offline stock
        |
        v
B is the new offline authority
```

This PRD must specifically fix the current lifecycle problem where a device can synchronize successfully but immediately retain/open another session that still prevents clean replacement.

---

## 2. Business rules

### 2.1 Exactly one offline authority

At any moment, one shop may have:

- zero registered offline-authority devices; or
- exactly one active offline-authority device.

Never two.

### 2.2 Normal handover requires full synchronization

Device B must not become the new offline authority while Device A has any potentially unsynchronized local business event.

The only supported normal handover is:

1. get Device A online;
2. synchronize A fully;
3. verify no local business event remains pending/needs attention;
4. release A's offline authority;
5. register B;
6. B receives a fresh snapshot/session based on current server stock.

There is no "force replace and discard A" option in normal handover.

### 2.3 Temporary battery/power failure is not replacement

If A merely ran out of battery:

- charge/power A;
- give A temporary internet if necessary;
- synchronize it;
- then decide whether to keep A or hand over to B.

Do not encourage staff to replace A just because it briefly powered off.

### 2.4 The registered browser must survive close/reopen

The offline-authority browser should be usable after:

- tab closed and reopened;
- browser closed and reopened;
- device restarted, assuming browser storage remains intact.

The employee should not need internet merely to reopen the cached offline POS/Social workspace.

### 2.5 Cache does not create authority

For implementation simplicity, the app shell may be cached on more than one browser.

Authority comes from:

- valid offline device binding;
- valid device credential;
- matching store;
- valid local snapshot/session.

A cached page on an unregistered browser must only show that offline selling is unavailable on that device.

---

## 3. Preserve the good parts of the current implementation

Do not replace the existing v2 offline journal.

Preserve:

- one shared POS/Social local stock pool;
- one local sequence;
- atomic local stock + event commit;
- immutable snapshot identity;
- exact retry/idempotency behavior;
- local event durability;
- reconciliation endpoint/receipt mapping;
- legacy records as read-only recovery compatibility;
- no stock clamping;
- no automatic deletion of acknowledged events simply for cleanup.

This PRD is a lifecycle/caching/handover change, not an inventory rewrite.

---

## 4. Offline-ready cached workspace

### 4.1 What must be available offline on the authority browser

At minimum:

- POS page shell;
- Social Commerce page shell;
- current store identity;
- current offline-authority identity/status;
- current snapshot catalog needed by those pages;
- local stock availability;
- current local carts/drafts/held sales;
- unsynced event status;
- plain sync/offline/recovery state.

Do not cache unrelated admin modules merely because POS needs offline support.

### 4.2 Service worker strategy

Use the smallest change to the current service-worker setup.

Likely existing files include:

- `src/components/admin/pos-service-worker.tsx`
- `public/sw-pos.js`

Requirements:

- app shell remains available after browser reopen;
- offline data stores are never wiped by service-worker upgrade;
- unsupported future local schema fails closed;
- service worker does not fabricate successful API writes;
- cache update cannot delete the current journal;
- Social Commerce shell is included alongside POS if not already cached.

Do **not** make service-worker cache possession the security/authority check.

### 4.3 Persistent storage

Continue best-effort browser persistent-storage request.

If the browser refuses persistence:

- online use still works;
- offline readiness may show a warning;
- do not pretend the device is guaranteed durable if the browser can evict storage.

---

## 5. Standby snapshot while the authority device is online

Under OFFLINE-PRD-09, registered Device A uses normal server-first commerce while connected.

Its offline data is standby.

### Required behavior

While A remains online:

- heartbeat continues;
- server inventory revision is compared with cached snapshot revision;
- when safe and there are no unsynced local events, refresh/install a newer snapshot automatically;
- do not interrupt an active cart/draft unnecessarily;
- do not rotate snapshot while unsynced local events depend on the old snapshot.

The purpose is to keep A as ready as reasonably possible for an unexpected outage.

### Important limitation

A disconnected browser cannot know about a server stock mutation that occurred after its final successful contact.

Therefore offline activation still obeys the conservative threshold from OFFLINE-PRD-09. Do not claim mathematically instantaneous failover across independently connected employee devices.

---

## 6. Entering offline mode

The registered authority browser may enter offline-authority mode only if:

```text
offline feature enabled
AND current device binding valid
AND current store matches binding
AND current local snapshot/session exists
AND snapshot passed startup age/integrity rules
AND local storage healthy
AND no recovery-required state
AND last-known snapshot revision matched server revision at last successful contact
AND offline activation grace has elapsed
```

When the first local event commits:

- that snapshot/session becomes the authoritative local epoch for the outage;
- do not refresh/replace it until reconciliation;
- all POS/Social local events share the same sequence and stock pool.

---

## 7. Reconnect and synchronization

### 7.1 Device A gets internet again

As soon as the registered authority reaches the server with unsynced business events:

- stop accepting ordinary new final transactions during the short reconciliation window;
- upload the same complete immutable journal;
- server performs existing deterministic reconciliation;
- retry on lost response with the same IDs/sequences;
- do not create a second order because the response disappeared.

### 7.2 After successful sync and A is staying as authority

If no handover was requested:

1. all local events become acknowledged;
2. store reconciliation completes;
3. server stock becomes trusted;
4. A gets/installs a fresh snapshot;
5. A remains the registered authority;
6. store returns to ordinary online multi-device operation once connectivity is healthy.

### 7.3 After successful sync and A will hand over

The current lifecycle must support a separate explicit release step.

Do not rely on "replace" magically knowing A is clean.

---

## 8. New explicit `Release Offline Device` operation

### 8.1 Why it is needed

Current replacement protection correctly blocks a replacement when an unresolved session exists.

However, after a successful reconciliation the current implementation may immediately establish another fresh open snapshot/session for A. That can leave normal replacement blocked even though A has no unsynced sales.

The correct solution is not to weaken `assertDeviceReplacementAllowed()`.

Add an explicit clean release/handover operation.

### 8.2 Suggested endpoint

Use a route conceptually similar to:

```text
POST /api/v1/admin/offline/device/release
```

Exact route naming should match existing API conventions.

Request must authenticate:

- employee;
- current Device A UUID + secret;
- current binding version;
- shop.

Admin/manager permission should be required unless the current device-registration permissions already define a safer owner role.

### 8.3 Release preconditions

Server must verify under shop/device/session lock:

- this is still the current active binding;
- device operational state is not `reconciling`;
- device/store is not `recovery_required`;
- no unresolved legacy business event exists;
- all server-received local sequence values are acknowledged;
- any current open session is clean and has no unacknowledged local work;
- browser supplies its current local `lastLocalSequence` / unsynced count and they agree with server acknowledgement;
- no action requiring reconciliation is pending.

If not clean, return a stable code such as:

```text
offline_device_release_requires_sync
```

Safe copy:

> Sync this device before moving offline access to another device.

### 8.4 Release transaction

When clean:

1. lock shop/device/current clean session;
2. close clean open session if one exists;
3. do **not** automatically issue another snapshot;
4. set current binding to a released/inactive state;
5. invalidate the old device secret for future offline writes;
6. keep audit history;
7. return `released` success.

Do not delete old acknowledged event history.

### 8.5 Idempotency

If Device A repeats Release because the response was lost:

- return the same released state;
- do not increment binding repeatedly;
- do not create duplicate activity records except normal retry telemetry if desired.

---

## 9. Registering Device B after release

`StoreDeviceService::register()` / replacement semantics must support a shop whose previous binding is cleanly released.

Recommended minimal behavior:

- reuse the current store-device row if the model is intentionally one-row-per-shop;
- increment `binding_version`;
- assign B's new device UUID + token;
- status becomes active;
- old A credentials no longer verify;
- issue a fresh snapshot from **current server stock**;
- B stores the new identity/snapshot;
- B reports `Ready for offline use` only after the fresh snapshot is durably installed.

Do not reuse A's old snapshot on B.

---

## 10. User-facing handover flow

### Device A

Provide a simple action where offline status is shown:

1. `Sync now`
2. status becomes `All offline sales synced`
3. `Release offline device`
4. one plain confirmation:

> Move offline access away from this device? Make sure another device is ready to register. This device will still work online, but it will no longer work during an internet outage.

On success:

> Offline access released. You can now register the new store device.

A remains a perfectly normal online employee browser after release.

### Device B

After A released:

- employee logs in normally;
- opens Offline Operations/device setup;
- presses `Register This Device`;
- B receives fresh offline data;
- success copy:
  > This device is ready for offline POS and Social Commerce.

No staff member should need to understand binding versions or sessions.

---

## 11. Browser state after A is released

On Device A:

- remove/disable the active offline credential;
- mark local authority state as released;
- keep acknowledged historical local events read-only for the existing retention period;
- normal online POS/Social remains available;
- if internet later disappears, Charge/Place is blocked because A is no longer authority.

Do not silently delete history on release.

---

## 12. Auth expiry while offline

Preserve current policy unless explicitly contradicted by authentication requirements:

- previously authenticated registered authority may continue valid local offline work according to current policy;
- local history is not deleted because employee token expires;
- reconnecting sync may require re-authentication;
- retry after login uses the same immutable events;
- release/handover requires authenticated authorized user.

---

## 13. Likely files

### Backend

- `app/Services/StoreDeviceService.php`
- `app/Services/OfflineSessionService.php`
- `app/Services/OfflineSnapshotService.php`
- `app/Services/OfflineReconciliationService.php`
- `app/Services/StoreConnectivityService.php`
- `app/Http/Controllers/Api/V1/Admin/OfflineDeviceController.php`
- `app/Http/Controllers/Api/V1/Admin/OfflineSessionController.php`
- `app/Models/StoreDevice.php`
- `app/Models/OfflineInventorySession.php`
- routes
- activity logging
- tests

### Frontend

- `src/lib/offline/commerce-device.ts`
- `src/lib/offline/commerce-session.ts`
- `src/lib/offline/commerce-db.ts`
- `src/lib/offline/commerce-stock.ts`
- `src/lib/offline/commerce-sync.ts`
- current shared commerce readiness state
- `src/components/admin/pos-service-worker.tsx`
- `public/sw-pos.js`
- current Offline Operations/device status page/components
- POS page
- Social Commerce page
- i18n/types
- tests

---

## 14. Required tests

At minimum:

1. A registered + online -> A uses normal server POS path;
2. A browser closed/reopened offline -> cached POS shell loads;
3. same for Social Commerce;
4. non-authority browser with cached shell offline -> cannot Charge/Place;
5. A begins outage after activation threshold -> local POS works;
6. A creates 5 offline POS sales -> local stock reflects 5 committed;
7. A reconnects -> all 5 reconcile once;
8. lost sync HTTP response -> retry maps to same server orders;
9. A cannot Release while any local event remains unsynced;
10. A cannot Release while reconciliation running;
11. A cannot Release while recovery-required;
12. clean A can Release even if a newly refreshed **clean** session exists;
13. Release closes that clean session and does not auto-open another;
14. repeated Release request is idempotent;
15. B cannot register before A released;
16. B can register after A released;
17. B binding version is newer than A;
18. A token cannot create offline event after release;
19. A continues normal online employee POS/Social after release;
20. B receives fresh snapshot after A's five sales are server-side;
21. B can then lose internet and sell only from that fresh snapshot;
22. normal sync without Release keeps A as authority and refreshes A;
23. browser storage unavailable -> offline readiness blocked but online usage unaffected;
24. service-worker update preserves local events/history;
25. existing PRD-01–09 regressions remain green.

---

## 15. Acceptance criteria

This PRD is complete only when:

- offline authority survives normal browser close/reopen;
- registered authority still uses normal server flow while connected;
- reconnect sync is deterministic/idempotent;
- Device A cannot hand over with unsynced work;
- a clean explicit Release operation exists;
- Release solves the current "fresh open session still blocks replacement" lifecycle issue without weakening safety checks;
- A's old offline credentials stop working after release;
- B can register only after clean release;
- B receives current server stock, never A's stale snapshot;
- normal online multi-device usage remains unaffected;
- no history is silently deleted.

---

## 16. Explicit non-goals

Do not implement here:

- dead/lost-device force replacement;
- automatic reconstruction of unsynced events from a dead browser;
- paper/manual order entry;
- two offline authorities;
- peer-to-peer handoff of local databases;
- copying A's local journal directly into B;
- deleting old browser DBs;
- changing customer Website allocation priority.

Those failure cases belong to OFFLINE-PRD-11.

---

## 17. Handoff to OFFLINE-PRD-11

Include:

- exact Release API contract;
- server checks before release;
- binding status/version behavior;
- cache/service-worker behavior;
- offline activation requirements;
- sync-without-release trace;
- 5-offline-sale -> sync -> release -> B-register trace;
- proof B snapshot reflects A's synchronized sales;
- proof A cannot perform offline sale after release;
- all test results.
