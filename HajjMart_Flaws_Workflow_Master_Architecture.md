# HajjMart — Flaw Audit, Workflow Redesign & Master Architectural Plan

This is based on a direct read of the running code — `context/store-context.tsx`, `context/admin-context.tsx`, `lib/api.ts`, `components/checkout-form.tsx`, `components/cart-drawer.tsx`, `components/site-header.tsx`, `components/shop-controls.tsx`, `components/auth-form.tsx`, `components/account-dashboard.tsx`, `components/admin/admin-ui.tsx`, `lib/offline/pos-sync.ts` — not a generic checklist. Every flaw below points to the file/behavior that causes it.

---

## Part 1 — Flaws found

### 1.1 Storefront: account, cart & wishlist architecture

| # | Flaw | Where | Why it matters |
|---|---|---|---|
| 1 | **Cart and wishlist are 100% client-side (`localStorage`), never tied to the account.** `hajjmart-cart-v1` / `hajjmart-wishlist-v1` in `store-context.tsx`. | store-context.tsx | A pilgrim who adds items on their phone can't see them on desktop. Logging in doesn't merge or restore a server-side cart/wishlist — there isn't one. The account page itself admits this: *"Saved products are kept on this device."* This is the single biggest architectural gap in the storefront. |
| 2 | **No cart/wishlist merge-on-login.** `setSession()` just stores the token; it never reconciles the guest cart against the account. | store-context.tsx | A returning customer who built a cart as a guest, then logs in, keeps the guest cart by coincidence (same localStorage), but if they log in on a *different* device, everything they added is gone with no warning. |
| 3 | **Cart line prices are snapshotted at add-time and never revalidated until checkout.** `unitPrice` is stored on the cart item at `addToCart()` and used verbatim for `cartSubtotal` and in the cart drawer. | store-context.tsx, cart-drawer.tsx | If a price or promotion changes between "add to cart" and checkout, the cart drawer/cart page silently show a stale number; only the checkout page fetches a server-authoritative quote. Two different totals exist in the app for the same cart. |
| 4 | **Stock ceiling fails silently.** `updateQuantity`/`addToCart` clamp to `item.maxStock || 99` with no message. | store-context.tsx, cart-drawer.tsx | Clicking "+" at the stock limit just... does nothing. No toast, no disabled state, no "only 3 left" — a customer will assume the button is broken. |
| 5 | **No confirmation before delete-via-decrement.** Pressing "−" repeatedly silently removes the item once quantity hits 0. | cart-drawer.tsx (`updateQuantity`) | A double-click or a slow tap can delete a line item with zero warning and no undo. |
| 6 | **No address book despite checkout demanding full address every time.** Account page literally says *"Addresses saved... will be available here in a future checkout."* | account-dashboard.tsx, checkout-form.tsx | Every order — even for a repeat customer — requires re-typing district, thana, and a full free-text address. For a brand whose customers likely order multiple times before a Hajj/Umrah trip, this is meaningful repeated friction. |
| 7 | **No order-detail drill-down for customers.** Each row in the order history (`account-dashboard.tsx`) is a plain `<div>`, not a link — there is no `/account/orders/[id]` route. | account-dashboard.tsx | A customer can see a list of totals and statuses but cannot open an order to see items, delivery timeline, or tracking. For a physical-goods, cash-on-delivery-heavy business this is a real support-load generator ("where is my order" calls). |
| 8 | **No "forgot password" flow.** `auth-form.tsx` has no reset-password link anywhere. | auth-form.tsx | Users who forget a password have no self-service recovery path. |
| 9 | **Wishlist is invisible on mobile top nav.** The wishlist icon is `hidden sm:grid` and only reachable through the mobile menu's generic "Hello, X" account link. | site-header.tsx | Mobile is very likely the majority of this traffic (Bangladesh retail), and the wishlist — arguably the single best re-engagement surface on the whole site — is effectively hidden there. |

### 1.2 Storefront: search, filtering, discovery

| # | Flaw | Where | Why it matters |
|---|---|---|---|
| 10 | **Search has no live results.** The full-screen search overlay only navigates to `/shop?q=` on submit — no debounce/instant preview, no product thumbnails, no "did you mean," no recent searches. | site-header.tsx | Every search is a full page load with zero feedback until the shop page renders. For a catalog this size, that's a slow, low-confidence search experience. |
| 11 | **Price filter inputs don't reflect existing state.** `<input ... defaultValue="" ...>` for min/max price, always empty regardless of the current `min_price`/`max_price` in the URL. | shop-controls.tsx (`FilterContent`) | Reopen the filter drawer after setting a price range and the fields show blank — the filter is still applied (the URL has it), but the UI lies about it, which reads as a bug. |
| 12 | **No "active filters" summary or one-click clear-all.** Category, in-stock, and price filters can only be removed one at a time by re-opening the drawer. | shop-controls.tsx | Standard e-commerce pattern (filter chips + "clear all") is missing; users who over-filter and get zero results have no fast way out. |
| 13 | **No keyboard escape / focus trap on overlays.** The mobile menu, search overlay, and cart drawer only close via a visible × button or backdrop click — no `Escape` key handling (unlike the **admin** `Modal`/`Drawer`, which correctly implement this). | site-header.tsx, cart-drawer.tsx | Inconsistent with the admin side of the same codebase, and a real accessibility gap. |

### 1.3 Storefront: checkout

| # | Flaw | Where | Why it matters |
|---|---|---|---|
| 14 | **Per-item validation errors are silently discarded.** `submit()` strips any field name matching `items.\d+...` down to an empty string via regex, then falls back to a generic "please review the details" message with no indication of *which* cart line is the problem (e.g., insufficient stock on one item). | checkout-form.tsx | If the API rejects the order because item #2 went out of stock between add-to-cart and submit, the customer sees a vague error and has to guess which product to remove. |
| 15 | **Quote requires district selection before showing any total.** The subtotal/total area shows "—" until a district is picked, even though a subtotal (pre-delivery) is knowable immediately from the cart. | checkout-form.tsx | Minor but real friction — the summary panel looks broken/empty on first render of the checkout page. |

*(Note: the checkout flow's idempotency-key handling, field-level server error mapping, and server-authoritative quote are genuinely well engineered — this is the most solid part of the storefront. The flaws above are refinements, not structural problems.)*

### 1.4 Storefront ↔ Admin architecture asymmetry

| # | Flaw | Where | Why it matters |
|---|---|---|---|
| 16 | **Two design systems, only one has a component kit.** `components/admin/admin-ui.tsx` is a genuinely well-built shared kit — `Modal`, `Drawer`, `Pagination`, `EmptyState`, `StatCard`, `ConfirmBar`, `SearchField`, all with consistent Escape/overlay-lock handling. The storefront has **no equivalent** — every drawer/overlay (`cart-drawer.tsx`, mobile sheet, search overlay, `filter-drawer`) reimplements its own open/close/backdrop/scroll-lock logic from scratch, with duplicated CSS conventions. | whole `components/` tree | This is why the storefront overlays are missing Escape-key handling that the admin overlays already have "for free" — the fix exists in the codebase, it just isn't shared. Any future storefront overlay will keep repeating the same gaps until this is factored out. |
| 17 | **Three near-duplicate quantity-stepper implementations** (`.quantity-picker` on PDP, `.quantity-small` in the cart drawer, `.admin-qty` in POS), each with separately hand-rolled markup and slightly different min/max/clamp behavior. | product-detail.tsx, cart-drawer.tsx, sales-builder.tsx | Bug fixes (like flaw #4 above) have to be applied three times, and probably won't be applied consistently. |

### 1.5 Session, auth & security posture

| # | Flaw | Where | Why it matters |
|---|---|---|---|
| 18 | **Bearer tokens (both customer and admin/POS) are stored in `localStorage`, not an httpOnly cookie.** | store-context.tsx (`AUTH_KEY`), admin-context.tsx (`AUTH_KEY`) | Any successful XSS anywhere in the app can read the token directly from storage. This matters more here than average because the admin token guards financial-approval and POS actions (IMPLEMENTATION_SUMMARY confirms 12-hour Sanctum token expiry is already enforced server-side — but the client has no complementary hardening). |
| 19 | **No client-side token-expiry handling or silent refresh.** `admin-context.tsx`'s `refreshSession()` only runs `if (hydrated && token && !demoMode)` once on load; there is no interval re-check or pre-expiry refresh. A 401 is only discovered the next time a request happens to fire. | admin-context.tsx | A store employee mid-way through a POS sale near the 12-hour token boundary gets no warning; the failure surfaces as a confusing mid-action error instead of a graceful "please sign in again" before it happens. |
| 20 | **No cross-tab session sync.** Signing out in one browser tab does not update `useStore()`/`useAdmin()` state in another open tab (no `storage` event listener). | store-context.tsx, admin-context.tsx | An admin who signs out on one screen (e.g., after finishing a shift) can still act in a second open tab until it happens to make a request and get rejected. |
| 21 | **`demoMode` is a client-trusted boolean that bypasses all permission checks.** `can()` in `admin-context.tsx` returns `true` for every permission whenever `demoMode` is set, and `demoMode` is read straight out of `localStorage` on load. | admin-context.tsx | As long as the backend independently enforces permissions (which IMPLEMENTATION_SUMMARY suggests it does), this is contained — but it means the client UI cannot be trusted at all to reflect real permission state while a stale/tampered `demoMode` flag exists in storage, which is a fragile assumption to build future UI on. |

### 1.6 Admin / POS operational flaws

| # | Flaw | Where | Why it matters |
|---|---|---|---|
| 22 | **Offline POS sync aborts the entire queue on the first unexpected error.** `syncPendingSales()` loops through pending sales and `break`s out entirely on *any* thrown exception, with the comment "likely connectivity; don't hammer the API." | lib/offline/pos-sync.ts | This conflates two very different situations: a genuine network drop (where stopping is correct) vs. one bad/malformed sale record (where stopping strands every *other* sale behind it). A single corrupt offline record can silently block an entire day's queued sales from ever syncing, with no per-item isolation. |
| 23 | **Offline sync sends one sale per API request in a loop**, even though the endpoint already accepts a `sales: []` array (`/pos/sync`). | lib/offline/pos-sync.ts | On a spotty reconnect (the exact moment this code path matters most), a queue of 30 held sales means 30 round trips instead of 1 batched request — much more likely to fail partway through, and much slower for staff waiting for the register to catch up. |
| 24 | **No visible retry cap or backoff.** `attempts` is tracked and incremented on each sync attempt but nothing in this file caps retries or backs off — a persistently failing sale (e.g., a genuine data problem) will be retried identically forever on every sync trigger. | lib/offline/pos-sync.ts | Risk of hammering the API with an unfixable request repeatedly, and no clear signal to staff that "this sale needs manual attention," only ever "pending" or "rejected." |
| 25 | **Admin charts are static and non-interactive.** `MiniBars`/`Donut` in `admin-ui.tsx` render pure CSS/SVG shapes with only a native `title` tooltip attribute — no click-to-filter, no period comparison, no drill-down. | admin-ui.tsx | The dashboard shows *what* happened but gives no fast path to *why* — every follow-up question requires navigating away to a different report page. |
| 26 | **`AdminSelect` always returns a string, forcing every numeric call site to re-parse it.** `onChange: (value: string) => void` regardless of whether the bound value is numeric (store IDs, etc.). | admin-ui.tsx | Not a user-facing bug today, but a consistency smell that invites a real bug the next time someone forgets the `Number(...)` conversion at a call site. |
| 27 | **No bulk actions surfaced in the shared table/pagination kit.** `Pagination`/`TableShell` have no built-in row-selection or bulk-action affordance. | admin-ui.tsx | Any list workflow that would benefit from "select 12 orders → mark packed" (a very normal retail-ops task) has to build selection state from scratch per page, so it's likely inconsistently available (or missing) across orders/returns/inventory. |

---

## Part 2 — Improved workflows

### 2.1 Storefront: the "add to purchase" journey, redesigned

**Current implicit workflow:** Browse → add to cart (localStorage only) → open cart drawer → go to `/checkout` → re-enter full address every time → server quote appears only after district is picked → place order → done, cart cleared, no link back to that order except a URL fragment stored in `sessionStorage`.

**Proposed workflow:**

```
Browse/Search ──▶ Add to cart ──▶ Cart (drawer or /cart) ──▶ Checkout ──▶ Confirmation ──▶ Order detail (persists)
     │                 │                    │                     │
     ▼                 ▼                    ▼                     ▼
 Live search      Stock-aware          Saved address        Server quote visible
 results,         feedback (toast      picker (if logged     immediately from
 recent           on stock limit,      in) OR manual entry    subtotal, before
 searches         confirm before       (guest) — no retyping  district is chosen;
                  removing via ‑)      for returning users     delivery fee shown
                                                                as "—" until district
                                                                picked, not the whole
                                                                total
```

Concretely:
1. **Account-synced cart & wishlist for logged-in users**, with guest localStorage cart as today for anonymous browsing, and a one-time **merge prompt** on login ("You have 2 items from this device — keep them?") instead of a silent overwrite or silent coexistence.
2. **Stock-aware cart controls**: disable "+" at the ceiling with a small inline label ("Only 3 left"), and require an explicit confirm step (or a 3-second undo toast) before a decrement-to-zero removes a line.
3. **Address book** for logged-in users: save the delivery address used in a successful order, offer it as a one-tap default on the next checkout, with "use a different address" always available. This is the highest-leverage single change for repeat-customer friction.
4. **Order detail pages** (`/account/orders/[id]`): every order row becomes a link into a real detail view (items, status timeline, delivery address used, payment method) — this alone should reduce "where is my order" support contacts.
5. **Item-level checkout errors mapped back to the cart summary**: instead of discarding `items.N.*` validation errors, resolve `N` back to the specific cart line and highlight that row in the order summary panel with its actual message ("Only 2 left in stock").
6. **Search-as-you-type**: debounced (250–300ms) inline results panel inside the existing search overlay showing 5–6 matching products with thumbnails, falling back to the current "press enter → full results page" behavior for anything past that.
7. **Filter chips + clear-all**, and fix the price-input desync so reopening filters always reflects the live URL state.

### 2.2 Admin: the daily operational workflow, redesigned

**Current implicit workflow:** Sign in → land on dashboard (static charts, no drill-down) → navigate to whichever module has today's task → for POS, ring up items one at a time, occasionally offline, sync one-by-one on reconnect with no isolation between sales → for risk cases, review and resolve manually with no optimistic feedback.

**Proposed workflow, by role:**

**Store staff / POS (highest-frequency users):**
```
Shift start ──▶ Ring sales (online or offline, same UI) ──▶ Reconnect
                                                                  │
                                                                  ▼
                                                     Batch-sync ALL pending sales
                                                     in one request; per-sale result
                                                     surfaced individually (synced /
                                                     needs review / failed) instead of
                                                     all-or-nothing
                                                                  │
                                                                  ▼
                                                     "3 synced, 1 needs review" toast,
                                                     with the 1 flagged sale routed to
                                                     a visible "needs attention" queue
                                                     — never silently stuck forever
```
- Batch the `/pos/sync` call (the endpoint already supports an array — this is a client-side fix, not a backend change).
- Isolate failures per sale: a genuine connectivity drop stops the batch cleanly; a per-record rejection (bad data, conflict) is captured and shown, and the *rest of the queue still syncs*.
- Add a retry cap (e.g., 5 attempts with backoff) after which a sale is flagged "needs manual review" instead of retried forever.

**Store manager / merchandiser (dashboard + reports):**
```
Sign in ──▶ Dashboard shows live comparison-to-previous-period on every stat card
                    │
                    ▼
          Click any chart segment/bar → filters the panel below it to that
          slice (no full navigation required for the common "why did this
          spike" question)
                    │
                    ▼
          Attention list (low stock, risk exceptions) → resolve/snooze
          inline from the dashboard, not only from a drill-down drawer
```

**Risk / ECM reviewer:**
```
New flagged case appears ──▶ Reviewer opens case ──▶ Adds note / resolves
                                                              │
                                                              ▼
                                                   List updates optimistically
                                                   (case shows as "resolving…"
                                                   immediately), confirmed or
                                                   rolled back on server response
                                                              │
                                                              ▼
                                                   Critical-band cases get a
                                                   persistent, unmissable visual
                                                   state (not just a colored dot)
                                                   until acknowledged
```

**Cross-cutting admin workflow fix:** any list view (orders, returns, product batches) gets consistent row-selection + bulk actions from the shared `TableShell`/`Pagination` kit, rather than being built ad hoc per page if built at all.

---

## Part 3 — Master architectural plan

The flaws above cluster into four architectural gaps, not dozens of unrelated bugs. Fixing the architecture fixes most of the individual items above as a side effect.

### 3.1 Target architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Shared foundation layer                       │
│  Design tokens (existing, unchanged) · Overlay primitive             │
│  (Escape+focus-trap+scroll-lock, extracted from admin-ui.tsx and     │
│  reused by storefront) · Shared <QuantityStepper> · Shared           │
│  <Toast>/<EmptyState> API used by BOTH admin and storefront          │
└───────────────────────────┬───────────────────────────────────────────┘
                             │
        ┌────────────────────┴─────────────────────┐
        ▼                                            ▼
┌────────────────────────┐                ┌───────────────────────────┐
│  Storefront domain      │                │  Admin/POS/ECM domain     │
│  ─────────────────────  │                │  ────────────────────────│
│  Account-synced cart &  │                │  Batched offline sync +  │
│  wishlist (server-      │                │  per-record isolation    │
│  backed, localStorage   │                │                          │
│  only as an offline/    │                │  Interactive charts      │
│  guest cache)           │                │  (tooltip + drill-down)  │
│                          │                │                          │
│  Address book            │                │  Optimistic list updates │
│  Order detail pages      │                │  for case/order actions  │
│  Item-aware checkout     │                │  Bulk row actions in the │
│  error mapping            │                │  shared table kit         │
│  Live search              │                │                          │
└────────────────────────┘                └───────────────────────────┘
                             │                                            │
                             ▼                                            ▼
                  ┌────────────────────────────────────────────────────┐
                  │        Session & security layer (shared)            │
                  │  Short-lived access token in memory + httpOnly      │
                  │  refresh cookie (or, minimally: pre-expiry refresh  │
                  │  timer + cross-tab `storage`-event sync on top of   │
                  │  the current localStorage approach)                 │
                  └────────────────────────────────────────────────────┘
```

### 3.2 Why this shape

- **A shared foundation layer first**, because flaw #16 (two design systems) is the root cause of several downstream bugs (#4, #5, #13, #17): the fix for "Escape key doesn't close the cart drawer" already exists in `admin-ui.tsx`'s `Drawer`/`Modal` — it just needs to be extracted and reused, not reinvented for the storefront.
- **Account-synced cart/wishlist becomes a real backend resource** (a customer-scoped cart, not just an order), with the existing localStorage behavior demoted to "offline/guest cache that syncs up on login" rather than the source of truth. This is the correct fix for flaws #1–#3 and #6 simultaneously, because an address book and a persistent cart are the same underlying capability: *durable, account-attached state*.
- **POS sync becomes record-isolated and batched**, which is a contained change entirely inside `lib/offline/pos-sync.ts` (loop → batched request, `break` → per-item error capture) and doesn't require backend changes since `/pos/sync` already accepts arrays.
- **Session/security is pulled into one shared layer** used by both `store-context.tsx` and `admin-context.tsx`, since today they duplicate the same (incomplete) pattern independently — fixing token-refresh and cross-tab sync once, in one place, fixes it for both the storefront and the higher-stakes admin/POS/finance surface at the same time.

### 3.3 Phased roadmap

| Phase | Scope | Fixes | Est. duration |
|---|---|---|---|
| **0 — Shared overlay & interaction primitives** | Extract `Drawer`/`Modal`/focus-trap pattern from `admin-ui.tsx` into a shared module; build one `<QuantityStepper>` used by PDP, cart drawer, and POS; unify `<Toast>`/`<EmptyState>`. | #4, #5, #13, #16, #17 | 1–1.5 weeks |
| **1 — Account-backed cart, wishlist & address book** | New backend-facing cart resource keyed to the logged-in user; login-time merge prompt; address book CRUD + checkout integration; order-detail route. | #1, #2, #3, #6, #7 | 2–3 weeks (includes a backend endpoint set) |
| **2 — Checkout & discovery polish** | Item-aware error mapping in `checkout-form.tsx`; immediate subtotal before district selection; live search-as-you-type; filter chips + clear-all + fix price-input desync. | #10, #11, #12, #14, #15 | 1–1.5 weeks |
| **3 — Session & security hardening** | Pre-expiry refresh timer, cross-tab `storage` sync, evaluate httpOnly-cookie migration for tokens as a follow-on. | #18, #19, #20, #21 | 1 week for the in-place hardening; cookie migration scoped separately given backend involvement |
| **4 — POS offline sync rework** | Batch `/pos/sync` calls; isolate per-sale failures instead of aborting the queue; add retry cap + "needs review" state surfaced to staff. | #22, #23, #24 | 1 week |
| **5 — Admin dashboard & list-view upgrades** | Chart tooltips/drill-down, period-comparison stat cards, optimistic risk-case updates, bulk row actions in the shared table kit. | #25, #26, #27 | 1.5–2 weeks |
| **6 — Missing account flows** | Forgot-password flow, mobile wishlist entry point in the header. | #8, #9 | 3–4 days |

**Sequencing logic:** Phase 0 is first because Phases 1–5 all touch overlays, steppers, or toasts and would otherwise re-solve the same problem repeatedly (this is exactly how the codebase ended up with three quantity-stepper implementations in the first place). Phase 1 is the largest single piece of *value* (it removes the single biggest structural gap — no durable account state) and can run in parallel with Phase 4 (POS sync) since they touch unrelated code paths, once Phase 0 has landed.

### 3.4 What stays untouched

Per the brief, none of this changes the visual theme, the color tokens, the typography, or the existing well-built pieces — specifically: the server-authoritative checkout quote + idempotency key design, the admin's existing `Modal`/`Drawer`/`Pagination` kit (this plan *extends its reach* to the storefront, not replaces it), the risk-scoring/ECM backend logic, and the offline-POS IndexedDB caching strategy in `pos-db.ts` (only the *sync* loop in `pos-sync.ts` changes, not the local storage layer).
