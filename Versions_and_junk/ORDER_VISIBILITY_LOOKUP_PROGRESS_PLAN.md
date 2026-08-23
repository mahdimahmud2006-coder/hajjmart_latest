# HajjMart — Order Visibility Fix + Lookup & Progress Features
### Master architecture plan, based on a direct read of the Aug 13 codebase

---

## Part 1 — Why a guest website order doesn't show up in admin

I traced the full path a guest order takes and found the disconnect. It is **not** a backend data problem — it's a frontend data-source problem, with one real backend policy gap alongside it.

### 1.1 The actual bug: the admin Orders page can be silently looking at fake data

`app/admin/(panel)/orders/page.tsx` decides where to load orders from like this:

```ts
if (demoMode || !token) {
  const filtered = demoOrders.filter(...);   // ← hardcoded demo dataset, not the database
  ...
  return;
}
void adminRequest<Paginated<AdminOrder>>(`/orders${queryString(filters)}`, { token }) // ← real API
```

If the admin session is in **demo mode** (the "Continue with demo" login path in `admin-context.tsx`'s `continueDemo()`), or if there is momentarily no token, the page renders `demoOrders` from `lib/admin-demo.ts` — a static, hardcoded fixture — and **never calls the real `/admin/orders` API at all**. A guest order placed on the live website has no way to appear, because the page isn't looking at the database. There is a small "Demo data" pill in the top bar (`admin-shell.tsx` line 161) that indicates this, but it's easy to miss, and this same `if (demoMode || !token)` pattern is very likely repeated on other admin pages (dashboard, inventory, etc.) — anywhere it exists, the same disconnect will show up.

**This is almost certainly the actual cause of what you're seeing.** The fix is operational, not code: sign into the admin panel with a real employee account (not "Continue with demo"), and confirm the "Demo data" pill is gone. I'd also recommend the hardening in §1.3 so this failure mode is harder to fall into by accident.

### 1.2 What I confirmed is *not* the problem
I checked the whole path end to end to rule out other causes:
- `POST /checkout/place-order` → `V1\OrderController::storeGuest()` → `OrderService::place()` writes to the **same** `Order` model/table the admin panel reads (`app/Models/Order.php`), tagged `source_channel = 'website'`, `customer_id = null`.
- `GET /admin/orders` (`Admin\OrderController::index`) queries that same `Order` model with **no channel restriction** — website, POS, and social-commerce orders are all included by default; filters (`shop_id`, `source_channel`, `status`) are opt-in (`when(...)`), not applied unless the admin explicitly sets them.
- `shop_id` is never left null — it falls back to `Shop::defaultStore()->id` at creation, so a guest order can't silently fail to be assigned to a store and vanish from a store-scoped view.
- The route wiring (`routes/api.php`) correctly points both `/checkout/place-order` and `/admin/orders` at the same underlying `Order` model — there is no second, disconnected order table or legacy duplicate in the active path. (There is a vestigial top-level `OrderController.php` using an old `order_id`/Stripe-only shape — it still shares the same `Order` model, so it isn't a second data silo, but it looks like dead/legacy code worth removing in cleanup — not part of this bug.)

So the pipe itself is sound: a guest order really does land in the same table the admin panel's "Unified orders" page queries. The break is that the admin page you were looking at wasn't querying it.

### 1.3 A real second gap: nothing is actually "pending your approval"
Even once you're off demo data, there's a genuine workflow mismatch with what you described wanting ("I should be able to approve the order"):

`OrderService::place()`:
```php
$status = $requestedStatus ?: ($paymentMethod === 'cod' ? OrderStatus::CONFIRMED->value : OrderStatus::PENDING->value);
```
A **cash-on-delivery guest order is auto-set to `confirmed` the instant it's placed** — there is nothing left to approve. Only online-payment orders start at `pending`, and only until the gateway confirms payment (an automatic transition, not an admin decision). Given the vast majority of guest checkouts on a COD-heavy Bangladesh storefront will be COD, this means the "approve the order" step you're expecting essentially never happens today — every COD order arrives pre-approved by the system.

**Recommended fix:** change guest **COD** website orders to start at `pending` (matching online orders), and let admin approval be the transition from `pending → confirmed` that already exists (`OrderStatus::allowedNext()` already allows exactly this transition, and the admin Orders page already has a "confirm" action wired to it via `nextStatus` map). This is a one-line change in `OrderService::place()` and requires no new status, no new transition rule, and no frontend change — the approve action already exists in the UI, it just currently has nothing to act on for COD orders.

---

## Part 2 — New feature: "Lookup" tab in the admin sidebar

### 2.1 Design
Reuse what already exists rather than build a parallel search system: `Admin\OrderController::index` already supports a `q` param that searches `order_number`, `order_id`, `checkout_name`, `checkout_mobile_number`, and `source_reference` in one query (`app/Http/Controllers/Api/V1/Admin/OrderController.php`, `index()`). This is exactly the capability a "paste an order number, get the order" tool needs — no new backend endpoint is required.

**Sidebar entry** — add to the primary nav group in `admin-shell.tsx`, right after "Unified orders":
```ts
{ href: "/admin/lookup", label: "Lookup", icon: "search", permission: "orders.view" }
```

**Page** — `app/admin/(panel)/lookup/page.tsx`, deliberately minimal:
1. A single large search field (paste order number → e.g. `ORD-20260813-00042`).
2. On submit (or on paste, debounced), call `GET /admin/orders?q=<value>&per_page=5`.
3. If exactly one result comes back, jump straight into the existing order-detail `Modal`/drawer (the same component the Unified Orders page already uses for row-click — reuse it as a shared component rather than duplicating the order-detail markup, e.g. extract `OrderDetailPanel` out of `orders/page.tsx` if it isn't already a standalone component).
4. If multiple results come back (e.g. searching a phone number that placed several orders), show them as a short list — order number, date, status, total — each opening the same detail view on click.
5. Zero results: the existing `EmptyState` component with a clear "No order matches that number" message.

This makes "Lookup" a focused, fast tool for the single most common support task (a customer calls with an order number) — separate from the full Unified Orders table with its filters/pagination/bulk actions, which is the right tool for browsing, not for a single fast lookup.

### 2.2 Why not just fix the `⌘K` global search bar instead?
`admin-shell.tsx`'s top bar already has a `Search orders, customers, products…` input with a `⌘K` hint — but it's currently **decorative only** (a plain `<input>` with no `value`/`onChange`/submit handler). Wiring that up is a good idea longer-term (and would give lookup power from any admin page), but it's a separate, larger piece of work (needs a command-palette UI, cross-entity search, keyboard handling). The dedicated **Lookup** page you asked for is the right near-term deliverable; I'd log the global-search wiring as a fast-follow rather than block this on it.

---

## Part 3 — New feature: "See progress" page on the website

### 3.1 What guest tracking needs that doesn't exist yet
Today, `GET /checkout/status/{orderNumber}` (`V1\OrderController::checkoutStatus`) exists but requires the customer to already have the exact order number — fine for the post-checkout confirmation page (which has it in the URL/session), not useful for "I lost the confirmation, but I remember my phone number." Nothing in the current API accepts a phone number and returns matching order(s).

### 3.2 Backend: one new lightweight, public, rate-limited endpoint
Per your instruction, this is **API-only** — no new backend admin page, just a data endpoint the existing order pipeline already has everything to answer, since status is already tracked (`status`, `payment_status`, `placed_at`, `confirmed_at`, `shipped_at`, `delivered_at`, `cancelled_at` all already exist on `Order`).

```
GET /api/v1/track-order?mobile_number=01XXXXXXXXX
```
- Add to the same public checkout route group as `/checkout/*` in `routes/api.php`, with the **same `throttle:checkout` middleware** already used for the other public checkout endpoints — this is a phone-number-keyed public lookup, so rate limiting matters here more than anywhere else in the API (prevents someone from mass-querying random Bangladeshi numbers to harvest order data).
- Validate `mobile_number` against the same regex already used at checkout (`^(?:\+?88)?01[3-9]\d{8}$`), then normalize it (strip any `+88`/`88` prefix) before matching — the stored `checkout_mobile_number` isn't normalized today (confirmed in `OrderService`), so the query should normalize **both sides** for the comparison rather than assuming stored data is clean.
- Scope the query to `source_channel = 'website'` (matching the existing pattern in `checkoutStatus()`) and a recent window (e.g. last 180 days) so this doesn't become an unbounded lookup across years of history.
- Return only what a guest needs to see, **not the full order object** (no addresses, no internal notes, no payment references, no admin-only fields):
```json
{
  "orders": [
    {
      "order_number": "ORD-20260813-00042",
      "placed_at": "2026-08-13T10:22:00Z",
      "status": "confirmed",
      "payment_status": "unpaid",
      "payment_method": "cod",
      "grand_total": 4250,
      "items_count": 3,
      "timeline": [
        { "step": "placed", "at": "2026-08-13T10:22:00Z", "done": true },
        { "step": "confirmed", "at": "2026-08-13T10:40:00Z", "done": true },
        { "step": "processing", "at": null, "done": false },
        { "step": "shipped", "at": null, "done": false },
        { "step": "delivered", "at": null, "done": false }
      ]
    }
  ]
}
```
- The `timeline` array is derived directly from the existing status timestamp columns already on `Order` (`confirmed_at`, `shipped_at`, `delivered_at`, etc.) plus the current `status`/`payment_status` — this is exactly the "updates come from the backend automatically as status changes" behavior you asked for: an admin approving an order, or a payment webhook marking it paid, updates the same `Order` row the tracking endpoint reads, so the guest progress page reflects it on its next poll/refresh with zero extra wiring.
- No PII beyond what the guest already knows (their own phone number) is required to call this, and none beyond order status/date/total is returned — no address, no other customer's data, nothing an order number alone couldn't already reveal via the existing status endpoint.

### 3.3 Frontend: `/see-progress` page
A simple, on-theme page (reuses existing `field-input`, `button-primary`, `checkout-card` classes — no new visual language):
1. One field: **Mobile number**, same placeholder/validation pattern as checkout (`01XXXXXXXXX`).
2. On submit, call the new endpoint, show a loading state, then:
   - **No orders found** → friendly empty state with a link to `/contact` / the phone number already used elsewhere in the header for "Need a human?".
   - **One or more orders found** → render each as a card with the order number, date, total, and a horizontal step tracker (Placed → Confirmed → Processing → Shipped → Delivered), driven directly by the `timeline` array — reuse the visual language of the existing `checkout-step` numbered-step component from `checkout-form.tsx` rather than inventing a new stepper component.
   - A cancelled order shows a distinct "Cancelled" state instead of the step tracker.
3. Link this page from the header's "Need help ordering?" area and from the order-confirmation page (`order-success`), so customers who bookmark or screenshot nothing still have a path back to their status later.

This is intentionally read-only and stateless on the frontend — no polling loop is required for v1; a manual "Refresh" button re-calls the endpoint, which is enough for a guest checking back after a few hours, and avoids the complexity of live sockets for what's fundamentally a low-frequency check.

---

## Part 4 — Master architecture: how it all fits together

```
                         ┌─────────────────────────────┐
                         │   Order placement (existing)  │
                         │  Website checkout / POS /     │
                         │  Social commerce / Admin       │
                         │  manual entry                  │
                         └───────────────┬─────────────┘
                                         │  writes to
                                         ▼
                         ┌─────────────────────────────┐
                         │        `orders` table         │
                         │  (single source of truth,      │
                         │   already shared correctly)    │
                         └───────┬─────────────┬─────────┘
                    reads from    │             │  reads from
             (real API, NOT      │             │
              demo fallback)     ▼             ▼
        ┌──────────────────────────┐   ┌───────────────────────────┐
        │   Admin: Unified Orders    │   │   Admin: Lookup (NEW)      │
        │   full table, filters,     │   │   single-result fast path, │
        │   bulk actions, approve    │   │   reuses same `q` search   │
        │   COD orders now start     │   │   as Unified Orders        │
        │   PENDING → real approval  │   └───────────────────────────┘
        │   step (fix in §1.3)       │
        └──────────────────────────┘
                                         │  new narrow, rate-limited,
                                         │  read-only public endpoint
                                         ▼
                         ┌─────────────────────────────┐
                         │  Website: See Progress (NEW)  │
                         │  phone-number lookup →         │
                         │  status timeline, no PII        │
                         │  beyond order status/total       │
                         └─────────────────────────────┘
```

The key architectural point: **no new order data model, no new sync process, no new admin backend page** — every piece above reads or writes the same `Order` row through the existing `OrderService`. The only genuinely new backend surface is the one narrow, throttled, read-only tracking endpoint in §3.2; everything else is either a frontend data-source fix (§1.1), a one-line status-default change (§1.3), or a new frontend view over an existing, already-correct API (§2, §3.3).

### 4.1 Implementation order

| Step | Work | Depends on |
|---|---|---|
| 1 | Verify/fix: confirm admin session isn't in demo mode; audit other admin pages for the same `demoMode \|\| !token` fixture fallback and make sure the "Demo data" pill is impossible to miss (e.g. also disable/relabel any page-level actions while in demo mode) | none — do this first, it may turn out to be the entire fix |
| 2 | Change guest **COD** website orders to start at `pending` instead of auto-`confirmed` in `OrderService::place()` | none |
| 3 | Admin **Lookup** page + sidebar entry, reusing `/admin/orders?q=` | Step 1 (needs real data to be visible to test against) |
| 4 | Backend `GET /api/v1/track-order` (throttled, normalized phone match, website-only, timeline projection) | none |
| 5 | Frontend `/see-progress` page + links from header and order-success page | Step 4 |

Steps 2–5 are independent of each other and can be done in parallel once Step 1 confirms the real data path is what you're looking at.
