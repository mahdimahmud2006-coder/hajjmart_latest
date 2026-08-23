# PRD-08 — Offline Operations UI, Recovery, Observability, Full QA Matrix, and Staged Rollout

**Sequence:** 8 of 8  
**Depends on:** PRD-01 through PRD-07  
**Completes:** HajjMart offline POS + offline Social Commerce priority system

## 1. Objective

Make the completed distributed inventory system understandable, recoverable, testable, and safe to roll out.

This PRD is not a cosmetic dashboard task. It provides the operational surfaces and release gates required to trust the system in stores with unreliable internet.

After this PRD, a manager can answer:

- Is this store/device currently safe to sell offline?
- When was its last server snapshot?
- Are there unsynced local events?
- Is reconciliation running, complete, or blocked?
- Which online orders were provisional/preempted?
- Which customer refunds still require work?
- What is the safe recovery action if a device is lost or a journal is inconsistent?

## 2. Baseline and implementation contract

Use the latest August 20 HajjMart implementation plus all seven prior PRDs.

Do not weaken stock invariants for convenience in the UI.

Recovery tools may create explicit compensating/audited actions, but they must never silently:

- delete a completed local POS event;
- rewrite local sequence;
- edit immutable snapshot opening stock;
- mark an event synced without a server mapping;
- lower inventory merely to make an equation pass.

## 3. Store operational status

Extend Store API/cards/details with an authoritative offline-commerce status.

Visible states:

```text
Online
Offline suspected
Offline
Reconciling
Recovery required
```

Show:

- registered device name;
- last heartbeat;
- last successful sync;
- last snapshot/boundary time;
- snapshot age;
- current session status;
- provisional online-order count where known;
- reconciliation/refund attention count.

Do not make binding version/session UUID prominent; put technical identifiers behind a diagnostics disclosure.

## 4. Store device actions

Admin-only actions:

```text
Register This Device
Replace Store Device
View Offline Status
Open Recovery
```

### Replace Store Device

Normal replacement remains blocked if unresolved open/recovery session exists.

Confirmation copy must explicitly say that replacing a device cannot recover sales that never reached the server.

No “force replace and discard queue” button.

## 5. Offline Operations page

Add a focused route under More, recommended:

```text
/admin/offline-operations
```

This page has one job: understand and resolve offline-commerce synchronization state.

### 5.1 Stores needing attention

Show stores with:

- recovery required;
- stale/missing heartbeat beyond configured threshold;
- failed refund/payment-review action;
- unresolved active reconciliation;
- legacy queue issue if the client has reported it.

### 5.2 Sessions

Filters:

- store;
- status;
- date range;
- result.

Each session row/detail shows:

- boundary time;
- opening inventory revision;
- event count;
- local sequence range;
- POS/Social counts;
- victim order count;
- reconciliation result;
- closure/recovery reason.

### 5.3 Reconciliation actions

Show:

- refund;
- void;
- payment review;
- notification action if implemented.

Actions expose Retry only when idempotent/safe.

### 5.4 Device

Read-only binding detail plus admin replacement/recovery entry point.

Do not turn this page into a generic stock editor.

## 6. Unified Orders presentation

Add understandable labels/statuses where applicable:

```text
Reserved
Waiting for store sync
Offline POS — syncing
Offline Social — syncing
Cancelled: store stock sold offline
Refund required
Refund failed — review
```

Use text + icon; do not depend on color alone.

### Order detail explanation

For a preempted online order, show plain operational context:

> This order was placed while the store was offline. The store later synced an earlier-priority local sale/order for the same stock, so this reservation was released and the order was cancelled.

Customer-facing tracker uses the shorter PRD-07 copy and does not expose internal precedence terminology.

## 7. Local POS/Social diagnostics

The shared offline status panel should show:

```text
Store
Storage health
Snapshot age
Unsynced event count
Last sync
Legacy pending count
Needs-attention count
Connectivity state
```

Optional “Technical details” can show:

- device UUID;
- binding version;
- session/snapshot IDs;
- local sequence range;
- schema version.

These fields are for support, not normal operator decision-making.

## 8. Recovery state machine

Create a centralized recovery service/workflow rather than ad-hoc buttons.

Recommended server recovery states/reasons include:

```text
sequence_gap
payload_hash_mismatch
snapshot_demand_exceeded
physical_progress_conflict
lost_device_possible_unsynced_events
inventory_corruption
refund_failure
legacy_queue_unresolved
```

A recovery case records:

```text
shop
session/device
reason
opened_at
opened_by/automatic source
notes/evidence
resolution action
resolved_at
resolved_by
```

This can be a new `offline_recovery_cases` table or equivalent durable structured record if existing activity/audit architecture is sufficient. Prefer a table if operators must work a queue/stateful case.

## 9. Safe recovery actions

Depending on reason, permit only explicit safe operations:

- re-authenticate then retry same event sync;
- retry full-session reconciliation;
- inspect event->server-order mappings;
- retry failed refund action;
- run an explicit physical stock count/reconciliation;
- create a compensating stock/order correction linked to original event;
- close case only after invariants pass.

A completed POS sale stays in history. If it was operator error, correction is a new compensating event/workflow, not deletion.

## 10. Lost or destroyed device protocol

A browser-only architecture cannot recover events that were never synchronized anywhere.

Implement an honest admin workflow:

1. mark old device unavailable;
2. show last known heartbeat/session/snapshot;
3. require admin acknowledgement that unsynced local events may exist;
4. move store to `recovery_required`;
5. block online allocation and outbound stock operations;
6. perform physical stock count/reconciliation for affected store;
7. record discrepancies/corrections with reason and actor;
8. close recovery only when server inventory is trusted;
9. rotate device binding;
10. issue a completely fresh snapshot to the replacement device.

Do not infer “no unsynced events” merely because the old device cannot be contacted.

## 11. Activity logging and observability

Ensure these events are recorded with stable machine code + human label:

- device registered/replaced/revoked;
- heartbeat state transitions where operationally meaningful;
- snapshot issued;
- session opened/reconciling/closed/recovery-required;
- v2 event accepted/acknowledged;
- victim order preempted;
- reservation protected/preempted/released;
- refund/void action created/completed/failed;
- transfer/adjustment blocked by offline guard;
- recovery case opened/resolved;
- stock count/correction performed during lost-device recovery.

Logs include store/entity/reason/actor/timestamp but never secrets or raw payment credentials.

## 12. Stable diagnostic codes

Standardize at least:

```text
store_device_already_bound
store_device_invalid
store_device_replaced
offline_snapshot_required
offline_snapshot_too_old
offline_events_must_sync_before_new_snapshot
offline_insufficient_local_stock
offline_local_stock_corrupt
offline_session_sequence_gap
offline_session_payload_mismatch
offline_session_recovery_required
order_waiting_for_store_sync
store_offline_stock_locked
offline_store_precedence_stock_conflict
offline_payment_verification_required
offline_refund_failed
```

Map them to concise EN/বাংলা copy through the existing admin i18n layer.

API responses return machine code + safe message; frontend should branch on code, not string matching.

## 13. Required 30-scenario QA matrix

All scenarios below are release gates. Automate wherever technically practical; retain a reproducible manual case only when browser/device behavior cannot reasonably be automated.

| # | Scenario | Required result |
|---:|---|---|
| 1 | Store has 5 available; offline POS sells 5 | Local available becomes 0; sixth blocked |
| 2 | Store has 1; POS and Social try same unit in two tabs | Exactly one local commit |
| 3 | 3 units are reserved before outage | Offline device never steals them |
| 4 | Offline POS sells 3; Website later reserves 3; opening available was 3 | Website order preempted; POS accepted |
| 5 | Offline POS and Website order use unrelated SKU | Website order survives |
| 6 | Offline Social x2 vs later online Social x2 | Offline Social wins conflict |
| 7 | Offline demand 3 + later online demand 1; opening available 5 | Both survive |
| 8 | Two later online orders; cancelling one is sufficient | Newest suitable victim cancelled |
| 9 | Multi-line online victim conflicts on one line | Whole order cancelled; all reservations released |
| 10 | Victim online order is paid | Cancellation plus exactly one refund/void obligation |
| 11 | Same POS event sync is retried 10 times | One order, one FIFO/stock decrement |
| 12 | Full session replayed after response loss | Same reconciliation result; no duplicate victims/actions |
| 13 | Browser crashes after local Charge commit | Event and reduced local availability survive |
| 14 | Browser crashes before local transaction commits | No receipt, event, or stock mutation |
| 15 | Server price changes during outage | Snapshot-priced completed POS sale accepted |
| 16 | Product is archived during outage | Snapshot-valid POS sale accepted with audit drift |
| 17 | Device submits demand above signed opening available | Recovery required; no silent oversell |
| 18 | Transfer-out attempted from offline store | Blocked |
| 19 | Transfer-in recorded to offline store | Not locally sellable until fresh snapshot |
| 20 | Employee auth token expires offline | Local history preserved; sync asks re-auth; same events retry |
| 21 | IndexedDB unavailable | Offline Charge/Place blocked before success |
| 22 | New phone attempts to use already-bound store | Blocked until approved replacement |
| 23 | Two different stores sell same SKU offline | Each limited independently by its own snapshot |
| 24 | Website checkout arrives while store is reconciling | Store skipped/rerouted; no new reservation there |
| 25 | Journal contains malformed/tampered event | Safe recovery state; valid history not duplicated |
| 26 | Online reservation created just before boundary | Protected |
| 27 | Online reservation created just after boundary while offline-risk | Preemptible |
| 28 | Device wall clock is moved backward | Local sequence remains authoritative |
| 29 | Social draft exists while POS consumes its stock | Draft has no reservation; final Place revalidates |
| 30 | Held POS sale exists while Social consumes its stock | Held sale has no reservation; Resume/Charge revalidates |

## 14. Additional concurrency/stress suite

Add reproducible tests for:

1. 20+ concurrent Website checkouts against one final stock pool;
2. reconciliation while checkout workers attempt allocation;
3. 10 identical full-session sync requests in parallel;
4. two tabs committing mixed multi-SKU POS/Social events;
5. heartbeat flapping around suspected/offline thresholds;
6. duplicate refund job deliveries;
7. process crash after reconciliation DB commit but before HTTP response;
8. process crash after refund action creation but before queue dispatch;
9. simultaneous reconciliation for two stores carrying the same SKU;
10. large session replay within a bounded batch size/performance target.

Success means:

```text
no negative available
no duplicate orders
no duplicate reservation rows
no duplicate FIFO consumption
no duplicate refunds
no cross-store mutation
```

## 15. Test organization

### Backend

Use PHPUnit feature/unit tests plus database/concurrency tests where the environment supports them.

Create deterministic fixtures for:

- shops/devices;
- inventory/batches;
- snapshots/sessions;
- protected vs preemptible reservations;
- paid/unpaid orders;
- reconciliation events.

### Frontend

Use the Vitest + `fake-indexeddb` stack introduced in PRD-04 for:

- atomic IDB commit;
- two-tab race simulation;
- crash/reload behavior;
- stale snapshot/readiness state;
- legacy migration state;
- acknowledgement/idempotency handling.

Retain:

```text
npm run typecheck
npm run build
```

A top-level helper such as:

```text
npm run verify:offline-commerce
```

may orchestrate checks, but static source checks are not a substitute for behavioral inventory tests.

## 16. Inventory/reservation reconciliation assertion

Add a diagnostic/test command that can verify, per store/product/variant:

```text
inventory.reserved
== SUM(active reserved_products.quantity)
```

and checks:

```text
quantity >= 0
reserved >= 0
reserved <= quantity
```

The command defaults to read-only/report mode.

If an automatic repair mode is ever added, it must be a separate explicit reviewed feature; do not silently “fix” production counters in this PRD.

## 17. Feature flag

Introduce a server-controlled per-store flag, recommended in store settings/config:

```text
offline_commerce_v2_enabled
```

The flag controls creation of new v2 offline events.

Even when disabled, required recovery/sync endpoints must remain available for already-committed v2 events.

Never strand a journal because a feature flag was turned off.

## 18. Staged rollout

### Stage 0 — dark deployment

- deploy migrations/services;
- v2 flag off;
- current legacy operations continue;
- verify reservation-first behavior and inventory identities in staging/production-safe observation.

### Stage 1 — one pilot store

- register exactly one approved device;
- confirm old queues are empty;
- enable v2 for that store;
- run controlled network-off scenarios;
- inspect stock/reservation/reconciliation/refund records daily during pilot.

### Stage 2 — sequential store enablement

For each store:

- old queue empty;
- device registered;
- fresh snapshot obtained;
- staff understands status/recovery copy;
- 30-case core suite has passed in staging;
- enable flag.

Do not enable all stores at once merely because compilation passes.

### Stage 3 — legacy retirement

Only after telemetry/QA shows no unresolved legacy queue records:

- stop loading old DB code in normal path;
- preserve recovery/read compatibility for a defined period;
- remove old IndexedDB/code in a later dedicated cleanup migration/change.

Do not silently delete old browser databases during this PRD.

## 19. Rollback strategy

Feature rollback must preserve business history.

If v2 is disabled while unsynced v2 events exist:

- block new v2 offline transactions;
- keep sync/reconciliation/recovery endpoints available;
- finish existing events;
- then move the store to approved fallback behavior.

Do not roll back by dropping:

- reservation history;
- offline sessions/snapshots;
- event receipts;
- reconciliation actions;
- recovery cases.

Database rollback in production should be forward-fix oriented for these durable audit tables.

## 20. Operational metrics

Expose/log at least:

```text
stores currently offline/suspected
stores recovery_required
open/reconciling sessions
unsynced/acknowledged event counts where server knows them
provisional online orders
preempted orders
refund actions pending/failed
reconciliation duration
reconciliation retry count
snapshot age
```

Use metrics for operations, not as a second source of truth.

## 21. Likely files

Backend, likely:

- Store admin controller/resource/service
- new `OfflineOperationsController`
- offline device/session/reconciliation services/models
- new recovery case model/service/migration if chosen
- order admin controller/resource
- `ActivityLogService`
- reconciliation action job/service
- config/store settings/seed
- diagnostic Artisan command
- tests

Frontend, likely:

- Stores page/detail
- Unified Orders page/order detail
- new `/admin/offline-operations` page
- More menu entry
- shared offline status/diagnostic components
- POS/Social sync status surfaces
- `admin-types.ts`
- `admin-i18n.ts`
- offline v2 test files
- optional verification script/package command.

## 22. Acceptance criteria

The complete system is done only when all are true:

1. one active commerce device per store is backend-enforced;
2. POS and offline Social share one local stock authority;
3. local commitments cannot exceed server-signed opening available;
4. pre-boundary/protected reservations are never stolen;
5. valid local events beat only conflicting later provisional online commitments;
6. victim selection is deterministic and whole-order coherent;
7. paid victims have a real idempotent refund/void workflow;
8. non-POS orders are reservation-first;
9. POS/FIFO stock changes happen once at physical sale;
10. Social/Website FIFO stock changes happen once at physical fulfilment;
11. sync is session-aware, locked, transactional and idempotent;
12. price drift does not invalidate a snapshot-priced completed POS sale;
13. local event + stock commitment is atomic across browser crash;
14. transfers/negative adjustments cannot undermine an offline snapshot;
15. managers have understandable recovery/status UI;
16. lost-device recovery does not pretend missing local events are recoverable;
17. all 30 blueprint QA scenarios pass;
18. stress/retry suite produces zero duplicate/negative/cross-store effects.

## 23. Final implementation handoff

The final AI-agent handoff must contain:

- migrations in exact deployment order;
- backup/pre-deployment requirements;
- new/changed API route list;
- frontend IndexedDB DB name + schema version + object stores;
- feature flags and enabled stores;
- old queue/legacy migration state;
- all changed files grouped by PRD;
- backend PHPUnit totals/results;
- frontend unit-test totals/results;
- typecheck/build results;
- concurrency/stress results;
- output of inventory/reservation diagnostic command;
- one no-conflict reconciliation audit;
- one victim-order reconciliation audit;
- one paid-victim refund audit;
- one recovery-required case and resolution demonstration;
- known limitations;
- rollout/rollback procedure.

Do not declare completion based only on build/typecheck success. The stock, idempotency, reconciliation, payment, crash, and concurrency cases are the release gate.
