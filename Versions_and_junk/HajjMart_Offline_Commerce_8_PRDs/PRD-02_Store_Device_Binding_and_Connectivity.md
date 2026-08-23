# PRD-02 — One Store Device, Device Trust, and Connectivity State

**Sequence:** 2 of 8  
**Depends on:** PRD-01  
**Unlocks:** PRD-03 authoritative snapshots/sessions

## 1. Objective

Enforce the agreed **one commerce device per store** constraint at the backend and give the server a trustworthy device identity/connectivity signal. POS and Social Commerce will share this identity; the current separate POS terminal ID and Social device ID become legacy compatibility data only.

## Baseline and implementation contract

This PRD is written against the latest HajjMart implementation package:

- **Package:** `HajjMart_PRD10_Final_Admin_Compliance_Implemented_2026-08-20.zip`
- **SHA-256:** `cbadb81622753f5f8822a3e07726fcff555a9f0b5df28a2a1436a57179bf9df9`
- **Backend:** Laravel API
- **Frontend:** Next.js admin
- **Current foundations to preserve:** one unified `orders` ledger, store-scoped `inventory`, `reserved_products`, FIFO/direct batches, POS IndexedDB queue/idempotency, and the existing Social Commerce fast-order flow.

Before editing, the AI agent must read this PRD, all prior PRDs in this sequence, and the latest handoff. Inspect every named file before changing it. Preserve the unified order/inventory model; do not create a second offline business ledger. Put stock mutations inside DB transactions with row locks where concurrency matters. Treat retries as normal and make network writes idempotent. Expected business conflicts must return stable 4xx reason codes rather than raw exceptions. Add behavioral tests with the implementation, and record migrations, API changes, commands/tests run, changed files, and known limits in the handoff.


## 2. Fixed decisions

1. One current binding per `shop_id`, protected by a DB unique constraint.
2. Device authority = authenticated employee + bound UUID + high-entropy device secret.
3. Client `shop_id` never establishes authority.
4. Device replacement rotates UUID/secret and invalidates the old device immediately.
5. Connectivity is based on server-observed heartbeat age, not `navigator.onLine`.
6. Defaults, configurable in `config/hajjmart.php`:
   - heartbeat every 25 s;
   - healthy <= 60 s;
   - suspected > 60 s and <= 180 s;
   - confirmed offline > 180 s.
7. Explicit `reconciling` / `recovery_required` overrides heartbeat-derived state.

## 3. Schema — `store_devices`

```text
id
shop_id                 UNIQUE FK shops
device_uuid             UNIQUE
device_token_hash
binding_version         unsigned int default 1
status                  active | revoked
operational_state       normal | reconciling | recovery_required
registered_by           nullable FK users
registered_at
last_heartbeat_at        nullable
last_seen_user_id        nullable FK users
last_app_version         nullable
replaced_at              nullable
replaced_by              nullable FK users
created_at
updated_at
```

One mutable current row per store is intentional: the DB itself prevents a second current binding. Replacement updates/rotates this row; Activity Log preserves history. Never store raw device secret.

## 4. Backend services

### `StoreDeviceService`

Responsibilities:

- first registration;
- idempotent retry by same UUID;
- reject different UUID for already-bound store with `409 store_device_already_bound`;
- rotate binding on explicit admin replacement;
- verify UUID + secret;
- map verified device to authoritative shop;
- update heartbeat metadata;
- expose public DTO without token hash.

### `StoreConnectivityService`

Centralize:

```php
stateFor(Shop $shop)
isHealthy(Shop $shop)
isSuspectedOrOffline(Shop $shop)
blocksOutboundStock(Shop $shop)
allowsOnlineFulfilment(Shop $shop)
```

Controllers must not reimplement heartbeat thresholds.

## 5. APIs

Under existing employee/admin middleware:

```text
GET  /api/v1/admin/offline-device?shop_id={id}
POST /api/v1/admin/offline-device/register
POST /api/v1/admin/offline-device/heartbeat
POST /api/v1/admin/offline-device/replace
```

### Register

Admin-only. Body contains store, generated device UUID, optional name/app version. Success returns the raw device token **once**. Same UUID retry is idempotent; different UUID is 409.

### Heartbeat

Employee-authenticated plus device credentials, preferably headers:

```text
X-HajjMart-Device-Id
X-HajjMart-Device-Token
```

Response includes authoritative shop, server time, effective connectivity state, binding version. If body/query shop disagrees with binding, reject.

### Replace

Admin-only and online. Rotate UUID/secret, increment binding version, audit actor/store, invalidate old credential. PRD-03 adds unresolved-session blocking; leave a clean service hook rather than fake logic now.

## 6. Frontend common identity

Create `frontend/src/lib/offline/commerce-device.ts` using a new identity key such as `hajjmart-commerce-device-v2`.

It owns:

- stable browser UUID;
- returned device token;
- binding version;
- bound store ID;
- registration/heartbeat API calls;
- explicit credential clear on revoke/replace.

Old POS/Social IDs remain readable only until PRD-04 legacy migration finishes.

## 7. Heartbeat integration

Mount one `OfflineCommerceHeartbeat` component in the authenticated admin shell/layout rather than independent POS/Social loops.

Rules:

- only heartbeat when a binding exists;
- back off during connection loss;
- resume on browser `online`, visibility regain, and timer;
- token expiry asks for re-auth but never erases local device/offline data;
- failed heartbeat changes local indication only; server state comes from last successful heartbeat.

## 8. Security

- Hash high-entropy device secret server-side.
- Never return the hash.
- Rate-limit register/heartbeat/replace.
- Guessed/copied UUID without secret is insufficient.
- Store A credential cannot submit Store B context.
- inactive store/device cannot bootstrap future offline work.
- non-admin cannot register/replace.
- replacement activity log contains actor/store/binding version but no secret.

## 9. Compatibility

Do not remove `/admin/pos/ping`, `/admin/pos/bootstrap`, `/admin/pos/sync`, old POS IndexedDB, or old Social queue yet. PRD-04/05 migrate them. This PRD adds authority without breaking deployed POS.

## 10. Likely files

Backend:

- new `app/Models/StoreDevice.php`
- new `app/Services/StoreDeviceService.php`
- new `app/Services/StoreConnectivityService.php`
- new `app/Http/Controllers/Api/V1/Admin/OfflineDeviceController.php`
- `app/Models/Shop.php`
- `routes/api.php`
- `config/hajjmart.php`
- migration + tests

Frontend:

- new `src/lib/offline/commerce-device.ts`
- new `src/components/admin/offline-commerce-heartbeat.tsx`
- admin layout/shell as needed to mount it
- `src/lib/admin-types.ts`
- i18n strings for visible states/errors

## 11. Tests

1. first registration succeeds and returns one-time secret;
2. same UUID retry idempotent;
3. different UUID same store -> 409;
4. two concurrent registrations -> one binding wins;
5. cross-store heartbeat rejected;
6. wrong secret rejected without heartbeat update;
7. replaced old secret invalid;
8. binding version increments;
9. non-admin register/replace forbidden;
10. active employee heartbeat works;
11. exact healthy/suspected/offline thresholds;
12. explicit reconciling/recovery overrides heartbeat;
13. inactive store rejects binding/bootstrap preparation;
14. old POS APIs still work after migration.

## 12. Acceptance criteria

- DB guarantees one current binding per store.
- Server maps device -> store without trusting client store ID.
- Old device becomes invalid on replacement.
- Connectivity is deterministic/configurable/tested.
- POS/Social have one common future identity seam.
- Existing production path remains functional until cutover.

## 13. Handoff gate

Before PRD-03 show: concurrent registration protection, cross-store rejection, heartbeat state transitions, replacement invalidation, exact frontend storage key, and the API fields PRD-03 will bind into snapshots.
