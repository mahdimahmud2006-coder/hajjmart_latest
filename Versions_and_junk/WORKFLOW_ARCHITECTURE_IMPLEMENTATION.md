# HajjMart — Flaw Audit & Workflow Architecture Implementation

Implemented on 2026-08-13 against the UI-engagement implementation baseline.

## What is implemented

### Phase 0 — Shared foundation
- Added `Frontend/src/components/overlay-primitive.tsx` and reused it across storefront mobile navigation, search, filters, cart drawer, and admin Modal/Drawer.
- Shared overlay behavior now includes Escape-to-close, focus trapping, focus restoration, and reference-counted body scroll locking.
- Storefront/PDP/cart/POS use the shared `QuantityStepper` from the earlier interaction-kit pass.
- Cart stock ceilings are explicit and removal retains the undo path instead of silently disappearing.

### Phase 1 — Durable account state
- Added `customer_cart_items` migration, Eloquent model, user relationship, and authenticated `/api/v1/cart` GET/PUT/DELETE endpoints.
- Server cart responses rehydrate current product price and stock rather than trusting the old client price snapshot for authenticated sessions.
- Login loads the account cart and presents an explicit device/account merge choice when both contain different items.
- Authenticated cart changes are synchronized back to MySQL; successful authenticated orders clear the server cart.
- Existing wishlist API is now used by the storefront. Device wishlist state is merged into the account wishlist and changes synchronize across sessions/devices.
- Existing address API is now surfaced in the customer account and checkout. Customers can add/remove/default addresses and reuse them at checkout.
- Added persistent `/account/orders/[orderNumber]` order detail UI with order items, totals, delivery data, payment/order status and status timeline.

### Phase 2 — Checkout and discovery
- Search overlay now provides debounced live product results with thumbnails/prices plus recent searches; Enter still opens the full shop result page.
- Mobile header exposes wishlist directly.
- Shop filters now show active filter chips, one-click clear-all, and price inputs that reflect the current URL filter state.
- Checkout shows subtotal before district selection, then adds the authoritative delivery/discount quote once district is known.
- Checkout maps `items.N.*` errors to the matching cart row and also maps stock errors containing a product name back to that product row.
- Checkout can prefill a saved address and optionally save a new successful-order address back to the account.

### Phase 3 — Session/security hardening
- Customer and admin sessions now include an issue timestamp and attempt token rotation before the existing 12-hour token boundary.
- Both customer and admin contexts listen for cross-tab auth storage changes so sign-out/rotation propagates to other tabs.
- Admin demo state is only treated as demo when no real bearer token exists; a tampered `demoMode` bit cannot make a real authenticated token appear omnipotent in the UI.
- Sign-out now invalidates the current Sanctum token server-side on a best-effort basis.
- Full httpOnly-cookie migration is intentionally not mixed into this pass; the architecture document explicitly allows pre-expiry refresh + cross-tab sync as the in-place hardening path before a separately scoped cookie/CSRF migration.

### Phase 4 — Offline POS rework
- `/pos/sync` now receives terminal-scoped batches of up to 100 queued sales rather than one request per sale.
- Server results are reconciled per `client_transaction_id`, so one rejected/conflicting sale no longer strands the rest of the queue.
- Genuine request/connectivity failure stops later batches cleanly.
- Automatic retries use exponential backoff (30 seconds up to 15 minutes), capped at 5 attempts.
- Exhausted, rejected and conflicting records become `needs_review` and remain visible in the POS queue with the last error and attempt count.
- POS reconciliation toast can report e.g. “3 synced, 1 needs review.” Manual retry remains available after correction.

### Phase 5 — Admin workflow upgrades
- `AdminSelect` preserves numeric values as numbers instead of forcing every caller through string parsing.
- Shared `TableShell` now has a bulk-action slot and shared `BulkActionBar`.
- Orders ledger implements row selection, select-all-on-page, clear selection, and bulk “advance workflow” with per-order isolation.
- Dashboard mini-bars and donut legend now support optional keyboard/click selection.
- Seven-day sales and channel-mix selections filter the existing “Orders moving now” panel inline and can be cleared without leaving the dashboard.
- Earlier UI pass chart tooltips/count-up and optimistic risk feedback remain intact.

### Phase 6 — Missing account flows
- Added forgot-password request page and reset-password page.
- Added Laravel password-broker endpoints and configured reset links to point to the Next.js frontend.
- Password reset invalidates existing user Sanctum tokens.
- Mobile wishlist access is present in both the icon row and mobile menu.

## Backend additions
- `Backend/database/migrations/2026_08_13_000000_create_customer_cart_items_table.php`
- `Backend/app/Models/CustomerCartItem.php`
- Cart read/sync/clear API in `Api/V1/CartController.php`
- Password refresh/forgot/reset API in `Api/V1/AuthController.php`
- Frontend reset URL binding in `AppServiceProvider.php`

## Validation performed
- Project validation script passes.
- PHP syntax validation passes for the changed backend files and full project validation PHP pass.
- Route-handler audit passes: **184 handlers**.
- All **87 TS/TSX source files** parse/transpile with TypeScript 5.8.3 with **0 syntax failures**.
- Full Laravel runtime tests and the Next.js production build cannot run in this sandbox because Composer/npm framework dependencies are not installed. The project validator records both as skipped rather than falsely reporting them as passed.

## First run after extracting
Run the normal project launcher. The new customer-cart migration is picked up by the Laravel migration step:

```bash
chmod +x dev1.sh
./dev1.sh
```

For a clean development database:

```bash
RESET_DATABASE=1 ./dev1.sh
```
