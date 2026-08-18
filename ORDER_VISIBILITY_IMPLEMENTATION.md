# HajjMart — Order Visibility, Lookup & Progress Implementation

Implemented against the Aug 13 workflow-architecture codebase.

## Delivered

- Unified Orders no longer treats a transient missing admin token as permission to show fixture orders. Fixture data is only used in explicit demo mode.
- Demo mode is prominently labelled across the admin shell and the Orders workflow disables live mutation controls.
- Guest website COD orders now begin at `pending`, making the existing `pending → confirmed` transition the employee approval step.
- Pending website orders reserve inventory; confirmation commits the reservation and cancellation releases it.
- New admin `/admin/lookup` sidebar tool searches the existing unified order API (`q`, `per_page=5`) and reuses the shared order-detail panel.
- New public, `throttle:checkout` protected `GET /api/v1/track-order?mobile_number=...` endpoint validates/normalizes Bangladesh numbers, scopes to recent website orders, and returns a narrow progress projection.
- New storefront `/see-progress` page shows recent matching orders, a five-step status timeline, cancelled state, payment state and manual refresh.
- Header/mobile navigation and order-success flows link customers back to `/see-progress`.
- Guest COD order-success messaging now correctly says the order was received and is awaiting HajjMart approval; authenticated COD keeps its existing confirmed messaging.

## Validation

Run from the project root:

```bash
./validate-project.sh
```

The source validator checks PHP syntax, route/controller coverage, package metadata, migrations, offline POS invariants, the new order-visibility files/routes, and clean distributable state. Checkout feature tests were updated for pending guest COD inventory reservations and public progress lookup. Laravel runtime tests and Next.js build run automatically when dependencies are installed.
