# HajjMart Accounting Engine — Implemented Build

This build now goes beyond the dormant Phase 0 foundation and exposes the accounting engine in the admin UI while wiring selected operational events into the GL.

## Visible admin implementation

A new **Finance & control → Accounting** page is available at `/admin/accounting` for users with `accounting.view`.

It includes:

- General-ledger KPI cards
- Journal Explorer with fiscal-period, account, and status filters
- Expandable journal lines showing account, debit, credit, and dimensions
- Trial Balance with balance status
- Active Posting Rules viewer
- Chart of Accounts viewer

The Transactions page now shows the journal entry number for transactions that have been posted.

## Operational posting now active

### Manual business transactions

`BusinessTransaction` is no longer a parallel cash-only record for newly recorded transactions:

- Recorded expenses post through `MANUAL_JOURNAL`
- Recorded other income posts through `MANUAL_JOURNAL`
- High-value expenses remain pending until maker-checker approval; posting occurs only after approval
- Reversing a transaction creates a true reversing journal and preserves the original audit record
- The journal entry ID is stored in transaction metadata for drill-through/audit visibility

Starter manual-journal mapping:

- Expense: Dr `6000 Operating Expenses`, Cr `1000 Cash`
- Other income: Dr `1000 Cash`, Cr `4100 Other Operating Income`

### Paid POS sales

A fully paid POS sale now posts automatically:

1. `SALE_COMPLETED`
   - Dr Gateway / Cash Clearing
   - Dr Sales Discounts when applicable
   - Cr Sales Revenue
   - Cr Output Tax when applicable
2. `SALE_COGS_RECOGNIZED`
   - Dr Cost of Goods Sold
   - Cr Inventory

The same posting is triggered when a partially paid POS order becomes fully paid through the admin payment-collection flow. Operational calls are idempotent by order/event key.

## Upgrade behavior

`dev1.sh` now refreshes the idempotent `AdminAccessSeeder` and `AccountingSeeder` after migrations even when the development database already contains normal seed data. This is important for upgrades: the Accounting sidebar permission, COA additions, fiscal periods, and new posting rules appear without requiring `migrate:fresh`.

## Accounting foundation retained

The original additive accounting bounded context remains:

- `legal_entities`
- `accounts`
- `account_dimensions`
- `dimension_values`
- `fiscal_periods`
- `posting_rules`
- `journal_entries`
- `journal_lines`
- `PostingEngine`

Core invariants remain enforced: balanced entries, open-period enforcement, immutable posted lines, source traceability, idempotency, and reversal-by-new-entry.

## Verification performed in this environment

- All 207 PHP source/test/migration files pass `php -l`
- Shell syntax passes
- Route-handler audit passes all 188 registered handlers
- Targeted TypeScript parse check reports no TS1000/TS1100-class syntax errors in the changed admin files
- Full Next typecheck/build could not be run here because the distributable archive intentionally has no `node_modules`
- Full PHPUnit execution could not be run here because the distributable archive has no Composer `vendor/`
- The repository validator still stops at the same pre-existing migration-regression check observed in the untouched source build

## Still not claimed as complete

This is **not** the entire multi-phase master plan. The largest remaining accounting items are formal `inventory_cost_layers`/FIFO valuation, return/refund GL wiring, gateway clearing/fee/payout reconciliation, tax engine, wholesale AR, procure-to-pay/AP, period-close controls UI, and bank reconciliation. The current build makes the implemented accounting work visible and live instead of presenting those future phases as already done.
