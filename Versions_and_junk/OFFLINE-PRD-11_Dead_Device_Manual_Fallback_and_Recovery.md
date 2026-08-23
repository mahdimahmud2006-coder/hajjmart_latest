# OFFLINE-PRD-11 — Dead Device, Handwritten Fallback, Manual Re-entry, and Safe Recovery

**Sequence:** 3 of 3 redesign PRDs  
**Depends on:** OFFLINE-PRD-09 and OFFLINE-PRD-10  
**Completes:** revised HajjMart multi-device-online / one-device-offline business model

---

## 1. Objective

Implement the intentionally simple business rule for the hardest failure case:

> If the registered offline-authority device becomes unavailable before it can synchronize, HajjMart does not automatically move offline authority to another device. Staff keep physical handwritten records and enter them into the software later.

The system must make this safe and obvious.

It must **not** pretend that browser-only events can be recovered from a device that cannot be accessed.

---

## 2. Final business rules

### 2.1 Recoverable device failure

Example:

- Store A's registered device completed 5 offline POS sales.
- Its battery dies.
- The device is not destroyed; it can be charged later.

Required procedure:

1. Stop software selling on other devices for that store while the offline epoch is unresolved.
2. New physical sales/orders, if the business chooses to continue operating, are written on paper.
3. Power Device A back on.
4. Give A temporary internet/mobile data.
5. Synchronize A's existing local events first.
6. Enter any additional handwritten transactions that happened while A was unavailable.
7. Verify server stock/reconciliation.
8. Either keep A as offline authority, or use OFFLINE-PRD-10 Release -> register Device B.

### 2.2 Permanently lost/destroyed device

Example:

- A has possible unsynced local events.
- Device is stolen, destroyed, storage unrecoverable, etc.

Required procedure:

1. Mark Device A unavailable/lost.
2. Store enters `recovery_required`.
3. Do **not** register Device B yet.
4. Staff continue on paper only.
5. When a manager can work online, open the recovery case.
6. Reconstruct known transactions from handwritten receipts/order notes/payment records.
7. Capture a physical stock count for evidence.
8. Enter the handwritten/reconstructed transactions into HajjMart through an explicit recovery path.
9. Compare resulting expected stock with physical stock count.
10. Record any remaining discrepancy as an explicit audited stock correction.
11. Run inventory/reservation integrity checks.
12. Close recovery only when server stock is trusted.
13. Revoke/retire A's old binding.
14. Register Device B.
15. B receives a completely fresh snapshot.

No step may invent the contents of A's inaccessible local journal.

### 2.3 No emergency online bypass from Device B

If Device A has an unresolved offline epoch, Device B getting mobile internet does **not** make it safe to sell from B.

B's central server view may not contain A's local sales.

Therefore ordinary employee POS/Social remains blocked for that shop until:

- A synchronizes successfully; or
- lost-device recovery establishes trusted stock.

### 2.4 Manual/notepad is an accepted operational fallback

This is deliberate.

Do not build:

- peer-to-peer recovery;
- LAN/Bluetooth journal transfer;
- cloud shadow copies from a disconnected browser;
- a force-replace button that discards unknown sales.

The manual fallback is the business rule.

---

## 3. Reuse the existing recovery architecture

The current HajjMart offline work already defines recovery concepts such as:

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

Preserve that model.

This PRD extends `lost_device_possible_unsynced_events` into a complete operator workflow.

Do not create a parallel recovery system.

---

## 4. Detecting/declaring unavailable Device A

### 4.1 Temporary outage vs lost device

Do not automatically mark a device permanently lost because heartbeat is old.

Heartbeat age may indicate:

- offline suspected;
- offline confirmed.

A manager must explicitly choose something like:

```text
Mark offline device unavailable
```

with confirmation copy:

> Use this only if the registered offline device cannot currently be used. If it contains sales that never reached HajjMart, those sales cannot be recovered automatically. Keep all handwritten receipts and stock records.

### 4.2 Opening recovery

When confirmed:

- create/update recovery case with reason `lost_device_possible_unsynced_events`;
- mark store/device `recovery_required`;
- retain last heartbeat, binding version, last known session/snapshot, last acknowledged sequence;
- block Device B registration/replacement;
- block ordinary employee POS/Social for the shop;
- keep Website allocator/stock guards using existing recovery behavior;
- do not delete A's server-side session/receipt history.

---

## 5. Paper-sales operating procedure in the UI

The Offline Operations page should show a highly visible non-technical instruction when this recovery reason is active:

> **Use paper records for new sales.** Do not register another offline device yet. If the old device can be powered on, connect it to the internet and sync it first. If it cannot be recovered, enter the handwritten sales here before completing stock recovery.

Provide a short checklist:

- Record sale/order number on paper.
- Record date/time.
- Record item + variant + quantity.
- Record price/discount actually charged.
- Record payment method/reference where applicable.
- For Social orders, record customer phone/name and whether goods were physically handed over.

Do not force staff to understand event journals.

---

## 6. Explicit manual outage entry

The user requirement says handwritten work will be entered into software later. There must be an auditable path for that.

Do not create a second order ledger.

### 6.1 Add recovery-linked order entry

Use existing `OrderService`, POS/FIFO services, reservation service, and payment service.

Add the minimum metadata needed to identify a manually reconstructed outage transaction, for example on `orders`:

```text
offline_recovery_case_id nullable
manual_outage_reference nullable
manual_outage_occurred_at nullable
```

Exact column names may follow current conventions.

Recommended uniqueness:

```text
UNIQUE(offline_recovery_case_id, manual_outage_reference)
```

where reference is supplied.

The goal is idempotent re-entry of a paper record, not a new business model.

### 6.2 Manual POS recovery entry

Use when goods physically left the store.

Required fields:

- recovery case;
- paper/reference number;
- original occurrence date/time if known;
- products/variants/quantities;
- actual charged price/discount from paper record;
- payment method/reference;
- customer optional according to existing POS rules;
- note/evidence.

Behavior:

- create one normal unified POS order tagged as manual outage recovery;
- physically decrement inventory/FIFO exactly once;
- create normal payment row using recorded method/status;
- do not create an offline local event receipt;
- do not pretend it originated from Device A's missing journal;
- activity log must identify recovery case + actor.

If current server stock cannot legitimately support the reconstructed physical sale:

- do not manufacture a batch;
- do not go negative;
- keep recovery open;
- require physical stock reconciliation/correction.

### 6.3 Manual Social recovery entry

Use when the handwritten transaction was an order/commitment and goods did **not** physically leave yet.

Behavior:

- create normal unified Social order;
- create reservation using current centralized reservation rules appropriate to recovery processing;
- do not physically consume FIFO merely because the Messenger order was written on paper;
- tag with recovery case/reference.

If the customer physically took the goods, staff must enter it as a physical/manual POS recovery sale or another existing fulfilment flow that actually represents the physical movement. Do not misclassify it as an unfulfilled Social reservation.

### 6.4 Recorded prices

Manual recovery exists to reconstruct what actually happened.

A manager may need to enter the price/discount written on the receipt even if today's catalog price changed.

Reuse the existing audit/discount permission model where practical, but do not silently rewrite the historical amount to today's price.

---

## 7. Order of recovery actions

The sequence matters to prevent double-adjusting inventory.

### Recommended lost-device sequence

```text
open recovery
   |
   v
capture physical count as evidence only (do not auto-post correction yet)
   |
   v
enter all known handwritten/reconstructed POS/Social transactions
   |
   v
recalculate expected server stock
   |
   v
compare with captured physical count
   |
   +--> matches -> integrity checks
   |
   +--> differs -> explicit audited stock correction linked to case
   |
   v
integrity checks pass
   |
   v
close recovery
   |
   v
retire old binding
   |
   v
register new authority device + fresh snapshot
```

Do not apply a physical stock count first and then also decrement stock again for the same reconstructed POS sales.

---

## 8. Recoverable A returns after paper sales occurred

This common case should not require the full lost-device workflow.

Example:

- A had 5 local POS events.
- A battery died.
- Staff wrote 2 later sales on paper.
- A powers back on.

Correct sequence:

1. A reconnects.
2. Sync A's existing 5 local events first.
3. Confirm 0 pending and reconciliation complete.
4. Enter the 2 handwritten transactions online/recovery-linked.
5. Verify stock.
6. If keeping A, refresh snapshot and continue.
7. If moving to B, Release A then register B.

Do not manually re-enter A's 5 already-local events before trying to sync A, or duplicates may be created.

The UI should say this explicitly.

---

## 9. Old Device A comes back after recovery and replacement

This must fail safely.

Suppose:

- A was declared lost;
- manager manually reconstructed its sales;
- recovery closed;
- B became the new authority;
- later A is found and opened.

Required behavior on A:

- old binding/token no longer verifies;
- A must not auto-upload old events into the live store;
- local event history remains read-only;
- show plain copy:

> This device is no longer the store's offline device. Its old offline records cannot be synced automatically because the store has already completed recovery. Contact a manager if these records need to be compared.

Do not delete those local records automatically.

This rule prevents duplicate orders after manual reconstruction.

Optional support-only export may be added only if a current export pattern already exists; do not make it a requirement for this PRD.

---

## 10. Closing a lost-device recovery case

Do not allow `Close Recovery` unless all required conditions pass.

At minimum:

- manager acknowledged lost-device risk;
- paper/reconstructed transaction step is marked complete (`entered`, or explicit `none`);
- physical count evidence exists for permanent-loss case;
- any explicit correction is recorded/audited;
- `inventory.reserved == SUM(active reservation quantities)`;
- quantity/reserved constraints pass;
- no unresolved reconciliation action that directly prevents trust of stock;
- no active old-device reconciliation is running;
- old device binding is ready to be retired/replaced.

Closing recovery does not magically reconstruct missing events.

---

## 11. Device replacement after recovery

Only after recovery is closed/trusted:

- revoke/retire A binding;
- allow B registration;
- increment binding version;
- issue B a fresh snapshot from recovered current stock;
- old A remains unable to sync.

There is still never a "force replace and ignore queue" action.

---

## 12. Operational status/copy

### 12.1 Store status

When lost-device recovery active, show:

```text
Recovery required — offline device unavailable
```

### 12.2 Online employee POS/Social

If an employee on Device B tries to finalize:

> This store has unfinished offline sales or recovery work. Use paper records until the store is recovered or the registered offline device syncs.

Stable code recommendation:

```text
store_offline_recovery_in_progress
```

### 12.3 Device registration

If B tries to register too early:

> Finish the current device sync or store recovery before registering a new offline device.

Reuse a current safe machine code if one already expresses this; do not proliferate codes unnecessarily.

---

## 13. Multi-store behavior

Recovery is strictly store-scoped.

If Store A lost its authority device:

- Store A employee POS/Social finalization is blocked as above;
- Store A Website allocation follows existing recovery avoidance/rerouting;
- Store A transfer-out/negative adjustments remain blocked by existing guard;
- Store B and Store C continue normally;
- Device B belonging to another healthy store is unaffected.

---

## 14. Activity/audit requirements

Record at least:

- offline device marked unavailable;
- recovery case opened;
- manager acknowledgement of possible unsynced events;
- paper/manual recovery POS entry;
- paper/manual recovery Social entry;
- physical count evidence recorded;
- discrepancy correction applied;
- recovery integrity check result;
- recovery case resolved;
- old binding retired;
- new offline device registered.

Include:

- shop;
- recovery case;
- order/correction where applicable;
- actor;
- timestamp;
- safe reason.

Never log device secrets or raw payment credentials.

---

## 15. Likely files

### Backend

- existing Offline Recovery model/service/controller from PRD-08
- `app/Services/StoreDeviceService.php`
- `app/Services/OfflineSessionService.php`
- `app/Services/InventoryIntegrityService.php`
- `app/Services/OrderService.php`
- `app/Services/InventoryService.php`
- POS/FIFO services/controllers
- `app/Http/Controllers/Api/V1/Admin/OfflineOperationsController.php`
- admin order/POS/Social controllers as needed
- `app/Models/Order.php`
- migration for recovery-link/manual-reference fields
- activity logging
- routes
- tests

### Frontend

- `/admin/offline-operations` page
- recovery case detail/modal/sheet
- POS/Social pages for recovery block copy
- store/offline device status component
- `admin-types.ts`
- `admin-i18n.ts`
- offline local status for revoked old devices
- tests

---

## 16. Required tests

At minimum:

### Recoverable device

1. A has 5 unsynced POS events and battery dies -> B registration blocked;
2. B with mobile data attempts ordinary online POS for Store A -> blocked while A epoch unresolved;
3. same for ordinary online Social;
4. A powers back on -> can sync same 5 events;
5. five events reconcile once;
6. staff enter two later handwritten POS records -> two server orders/decrements only;
7. A can then remain authority with fresh snapshot;
8. or A can Release -> B registers -> B snapshot reflects all seven physical sales.

### Permanently lost device

9. manager marks A unavailable -> recovery case created;
10. store goes recovery-required;
11. B cannot register during recovery;
12. ordinary employee POS/Social Store A blocked;
13. Store B unaffected;
14. manager captures physical count evidence;
15. manual recovery POS creates unified order + FIFO decrement once;
16. duplicate manual reference retry does not duplicate order/decrement;
17. manual recovery Social creates reservation, not physical decrement;
18. current catalog price drift does not silently overwrite recorded recovery price;
19. impossible/insufficient stock reconstruction fails without negative inventory;
20. explicit correction can be linked to recovery case through existing controlled adjustment path;
21. recovery cannot close while inventory/reservation integrity fails;
22. recovery cannot close without required physical-count evidence for permanent loss;
23. recovery closes once all checks pass;
24. B registration succeeds only after closure/old-binding retirement;
25. B receives fresh recovered snapshot;

### Old device reappears

26. A opens after B replacement -> old token rejected;
27. A's local old events remain present/read-only;
28. A cannot auto-sync old events;
29. manually reconstructed server orders are not duplicated;
30. activity log shows recovery/manual entries/replacement.

### General regression

31. no force-replace path bypasses recovery;
32. no local event deletion occurs as part of replacement;
33. Website allocator avoids/reroutes recovery store according to current policy;
34. transfer-out/negative adjustment guards still block recovery store;
35. all earlier offline/online multi-device tests remain green.

---

## 17. Acceptance criteria

The redesign is complete only when all are true:

- Many employee devices can operate normally online when a store is healthy.
- Exactly one device holds offline authority.
- A clean authority transfer requires old-device full sync first.
- If the authority device is temporarily dead, staff can safely wait/use paper and later sync A.
- If A is permanently lost with possible unsynced work, the system does not allow automatic replacement.
- Paper/manual transactions have an explicit auditable re-entry path.
- Physical stock count is evidence/reconciliation, not an automatic history rewrite.
- Old Device A cannot later auto-sync after manual recovery + replacement.
- B receives only a fresh trusted snapshot after recovery.
- Multi-store isolation remains intact.
- No hidden technical shortcut violates the agreed handwritten-fallback business rule.

---

## 18. Explicit non-goals

Do not add:

- multiple offline-authority devices for one store;
- peer-to-peer local journal transfer;
- background cloud mirroring of offline events from an unreachable browser;
- forced session deletion to enable replacement;
- automatic inference of missing sales from stock differences;
- auto-generated fake orders to make stock equations balance;
- automatic deletion of old A's browser data;
- a second payment/inventory/order ledger.

---

## 19. Final rollout QA scenario

Before enabling this redesign broadly, demonstrate this exact business scenario end to end:

```text
Store stock SKU X = 10
A is offline authority
B is ordinary employee browser

1. Both A and B are online.
2. B makes an online sale successfully without device registration.
3. A remains offline-ready but uses server path while online.
4. Store internet fails.
5. A enters offline mode after safety threshold.
6. A makes 5 offline POS sales.
7. B gets mobile data but is blocked from Store A POS/Social while A epoch unresolved.
8. A battery dies.
9. Staff record two further sales on paper.
10. A is charged and gets mobile data.
11. A syncs its 5 offline sales.
12. Staff enter the 2 paper sales.
13. A releases offline authority.
14. B registers as the new offline authority.
15. B receives fresh stock reflecting every server-known sale.
16. A can still work online but cannot sell offline.
17. B can close/reopen browser and still use offline POS/Social later.
```

Then separately demonstrate permanent-loss recovery:

```text
A has possible unsynced events -> A permanently unavailable -> paper only ->
recovery case -> manual reconstruction + physical count -> correction if needed ->
integrity pass -> close recovery -> B registers -> A later reappears but cannot auto-sync.
```

If either demonstration fails, the redesign is not ready for production.
