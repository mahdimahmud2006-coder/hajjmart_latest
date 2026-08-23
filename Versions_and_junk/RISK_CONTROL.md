# HajjMart Enterprise Risk & ECM Control Layer

This release adds a native fraud/risk subsystem to the existing Laravel + Next.js application. It does not require SAP, Oracle, Dynamics, NetSuite, Odoo, or a commercial fraud API.

## Runtime flow

1. `OrderService::place()` writes the authoritative order, items, payment rows and inventory movements.
2. `RiskEngine::evaluateOrder()` evaluates enabled `risk_rules` using server-side facts.
3. Every evaluation is written to `risk_events` with score, decision and triggered rule evidence.
4. Score `0–29` = allow, `30–59` = monitor, `60–79` = manual review, `80–100` = hold/critical.
5. Scores >= 60 create a single open `fraud_cases` record for the order. Scores >= 80 also raise order priority to `urgent`.
6. Admin → Fraud & risk provides the investigation queue, rule controls, case notes, resolution, loss and prevented-loss tracking.
7. Case/rule changes are written through the existing activity log service.

## Default rules

| Key | Purpose | Default weight |
|---|---|---:|
| `high_value_cod` | High COD amount | 25 |
| `cod_velocity` | Repeated COD orders from one phone | 30 |
| `cod_cancellation_history` | Prior cancellation/refusal pattern | 25 |
| `address_variance` | Same phone across many addresses | 15 |
| `large_discount` | Unusually high discount percentage | 20 |
| `large_customer_due` | High unpaid balance | 15 |
| `offline_sync_delay` | Delayed offline POS synchronization | 20 |
| `duplicate_payment_reference` | Payment reference seen on another order | 40 |

Rules live in MySQL and can be enabled/disabled from the admin Risk Center by users with `risk.manage`.

## Permissions

- `risk.view` — dashboard and cases
- `risk.resolve` — investigate and resolve cases
- `risk.manage` — change rules and rescan transactions

Super Admin and Store Manager receive full access through the current role seeder. Sales/Order and Inventory Manager roles receive read access by default.

## Security changes shipped with the risk layer

- Legacy administrative endpoints now require an admin-capable role in addition to Sanctum authentication.
- Legacy public order lookup/manual-payment endpoints were moved behind authenticated admin access.
- High-risk public write endpoints now have named rate limits (`login`, `checkout`, `public-write`).
- Non-global employees are automatically scoped to their assigned `shop_id` for the v1 admin API and receive `403` if they attempt another store.
- Sanctum bearer tokens now default to a 12-hour expiry (`SANCTUM_TOKEN_EXPIRATION=720`) instead of never expiring.

## Backfill existing development data

`DatabaseSeeder` evaluates up to 150 seeded orders that have no risk event yet. To build a clean database with populated risk data:

```bash
RESET_DATABASE=1 ./dev1.sh
```

For an existing database, after migrations/seeders are current, Super Admin can also use **Admin → Fraud & risk → Rescan latest 100**.

## Extending the engine

Keep detection logic in `App\Services\RiskEngine`, not in controllers. Add the rule to `RiskControlSeeder`, evaluate a server-side signal, append its evidence, then let the common score bands decide whether a case is created. This preserves one auditable control plane instead of scattered `if` statements.

## Maker-checker financial control

The same release hardens manual business transactions:

- Expenses at or above `HAJJMART_TRANSACTION_APPROVAL_THRESHOLD` (default ৳50,000) are stored as `pending_approval`.
- A user with `transactions.approve` must approve/reject them before they enter financial reports.
- The employee who created the transaction cannot approve or reject their own transaction.
- Recorded financial transactions are never hard-deleted from the admin workflow. The existing DELETE action now creates an opposite reversal transaction and marks the original `reversed`, preserving history and netting the financial impact to zero.
