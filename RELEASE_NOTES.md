# Corrected release notes

This release consolidates the fixes discovered while running the earlier packages:

1. npm installation no longer references an unreachable internal registry.
2. MySQL readiness requires a successful database login, not only an open port.
3. Laravel migrations run before database-backed cache clearing.
4. The final inventory migration no longer assumes an `inventory.created_at` column.
5. Retrying the previously failed migration is safe because its schema changes are guarded with `Schema::hasColumn` and `Schema::hasTable` checks.
6. Normal restarts no longer rerun the large realistic seeder after a complete seed.
7. Backend and frontend startup is verified before the launcher reports success.
8. Missing Laravel view and stale database table assertions were corrected.

9. Store-scoped order lists now have their required `shop_id` database column.
10. Invalid `Shop` relationships that referenced nonexistent foreign keys were removed.
11. The large first-run seed prints stage-by-stage progress instead of appearing stalled.
12. Docker Compose uses a stable project name compatible with both Compose v1 and v2.

Use `./dev1.sh` for a normal start or `RESET_DATABASE=1 ./dev1.sh` for a clean disposable development database.

## Aug 07 2026 — Offline POS release

- Added native IndexedDB persistence for POS catalogue, active cart, held sales and offline transaction queue.
- Added automatic store catalogue bootstrap and offline product search/sorting fallback.
- Added durable local-first cash sale workflow with terminal UUID and client transaction UUID.
- Added automatic synchronization when Laravel becomes reachable again.
- Added MySQL idempotency columns and unique constraint for offline POS transactions.
- Added server-side price verification and stock-conflict preservation for offline sales.
- Added offline/online/sync status UI, held-sales drawer and synchronization queue/retry UI.
- Added PWA manifest and service worker caching for the POS application shell/static assets/product images.
- Preserved Retail/Wholesale pricing and Cheapest-first/Highest-first sorting.
- Kept Card, bKash, Nagad and Bank payments online-only for payment integrity.

## Aug 08, 2026 — Inventory navigation split

- Inventory is now a parent section in the admin sidebar.
- Added `Inventory view` and `Product batches` child navigation items.
- Removed recent product batches from the bottom of the inventory ledger page.
- Added a dedicated product-batch page with batch search and the existing batch receiving workflow.

## Aug 08, 2026 — Product batch sorting

- Added Newest first, Cheapest first, and Expensive first controls beside Product Batches search.
- Cheapest/Expensive use the recorded batch retail selling price.
- Sorting composes with the existing batch/product/SKU/store search and keeps newest receipt as the price tie-breaker.

## 2026-08-09 — Enterprise Risk / ECM Release

- Added `risk_rules`, `risk_events`, `fraud_cases`, and `fraud_case_notes` database domains.
- Added compact `RiskEngine` integration directly after authoritative order creation.
- Added configurable COD velocity/history, address variance, high-value, discount, due, offline-sync, and duplicate-reference controls.
- Added `/api/v1/admin/risk/*` dashboard, case, rule and rescan endpoints.
- Added Admin → Fraud & risk with investigation drawer, evidence, notes, outcomes and loss tracking.
- Added risk exceptions to the existing admin Command Centre.
- Added risk permissions to the current RBAC model.
- Enforced shop scope for non-global v1 admin users.
- Protected legacy admin endpoints with role checks; moved legacy order lookup/manual payment behind authentication.
- Added named public rate limits and a default 12-hour Sanctum token expiry.
- Added `RUN_LATEST.md` and `RISK_CONTROL.md`.
- Added maker-checker approval for expenses at/above the configurable ৳50,000 threshold.
- Replaced destructive business-transaction deletion with audited financial reversal.
- Excluded pending/rejected transactions from financial reports while preserving recorded/reversed audit history.
