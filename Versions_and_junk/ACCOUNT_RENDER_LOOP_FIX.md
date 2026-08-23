# Account Dashboard Render Loop & Shopping Navigation Fix

## Issue reproduced from the Aug 16 account build

The account page could trigger React's `Maximum update depth exceeded` error from `RecentlyViewedRail`. The component declared its prop as `products = []`. Because that default array was recreated on every render, the effect watching `products` ran on every render and called `setResolved`, which caused another render and another new array. The account page renders `RecentlyViewedRail` without a `products` prop, so it hit this path immediately.

A second edge case existed in the same component: missing/deleted recently-viewed product IDs could be requested repeatedly because the fetch effect depended on resolved state and had no per-ID retry guard.

## Fix

- Added a module-level stable `EMPTY_PRODUCTS` default.
- Removed the effect that copied the `products` prop into component state.
- Derive provided + fetched products with `useMemo` instead.
- Added `attemptedIds` so a failed/missing product is requested at most once per mounted rail, preventing a retry/render loop.
- Kept `Shop again` and `Start shopping` pointed at the existing `/shop` route; the links were correct and were being disrupted by the render storm / Next development error overlay.
- Made `selectTab()` idempotent so clicking an already-active tab does not schedule redundant state updates.
- Added project-validator regression guards for the unstable default and shopping links.

## Validation

- `validate-project.sh`: passed (185 route handlers; PHP/JSON/migration/cleanliness checks passed).
- TypeScript 5.8.3 syntax/transpile parse: 90 TS/TSX files, 0 failures.
- No database reset or migration is required for this fix.
