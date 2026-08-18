# HajjMart Enterprise Control Release — Implementation Summary

## Implemented now

### Fraud / ECM
- Server-side rule engine wired into authoritative order creation.
- Configurable risk rules in MySQL.
- Risk score bands and evidence snapshots.
- Automatic fraud case creation for score >= 60.
- Urgent priority escalation for score >= 80.
- ECM investigation queue with notes, resolution, loss and prevented-loss values.
- Admin rule enable/disable and controlled rescanning.
- Risk exceptions surfaced on the main Command Centre.

### Access/security controls
- Legacy admin routes now require an admin-capable role, not merely a valid customer Sanctum token.
- Legacy order lookup/manual-payment routes are no longer public.
- Named rate limits for login, checkout and public writes.
- Non-global admin employees are forced into their assigned store scope, including route-bound records.
- Sanctum API tokens default to 12-hour expiry.
- Store Manager no longer receives role-management, store-management, risk-rule-management or global settings-management permissions by default.

### Financial governance
- Expenses >= ৳50,000 (configurable) enter `pending_approval`.
- Maker-checker: transaction creator cannot approve or reject their own high-value expense.
- Pending/rejected transactions do not enter financial reports.
- Financial transaction deletion has been replaced with audited reversal; the original remains visible.

### Documentation/validation
- `RUN_LATEST.md` — exact run instructions.
- `RISK_CONTROL.md` — risk architecture and extension guide.
- `validate-project.sh` passes all distributable/static checks in this package.
- All PHP application/config/migration/seeder/route files pass syntax validation.
- All 76 TS/TSX source files pass TypeScript parser validation.

## Intentionally not faked

The broader ERP roadmap (full procurement UI, accounting ledger, reconciliation engines, forecasting/ML, device-key POS signing, and generalized approval workflows for every sensitive action) is not represented by placeholder pages. This package delivers the first production-minded enterprise-control slice on top of the existing working commerce/POS/inventory domains. Those later modules should be implemented incrementally against real business workflows and test data.
