# UI/UX Design Guideline
## Generic E-Commerce Platform (Storefront + Cart/Checkout + Account)

**Version 1.0 — Reference Document**
**Design Standard: "The Three-Click Trust Test"** — *If a first-time visitor cannot find a product, understand what it costs including all fees, and reach a confirmed order in three decisions or fewer without hesitating, the design has failed.*

---

## 0. How to Use This Document

This is the constitution for every screen in the storefront. It is not a moodboard — it is a rulebook.

- **For designers:** every screen you draw must be checked against Section 3 (Non-Negotiable Principles) and Section 14 (Do's/Don'ts) before it goes to dev.
- **For developers / LLMs building this system:** Section 5 (Design Tokens) gives you literal values — colors, spacing, font sizes — use them exactly, do not invent your own. Section 15 gives you a condensed rule block you can paste directly into a system prompt.
- **When guidelines conflict with "make it look impressive":** clarity and trust win. Every single time. A shopper who hesitates for one extra second on price, shipping cost, or checkout safety is a shopper who leaves.

---

## 1. Design Philosophy & North Star

We are not building a portfolio piece or a brand experience for its own sake. We are building for:

- A stranger who has never bought from us before and doesn't yet trust us with their card
- A returning customer who wants to reorder something in under a minute, without browsing again
- Someone comparison-shopping in three tabs, deciding whether to stay or bounce to a competitor
- Someone on a mid-range or older Android phone, on the move, one thumb, one hand full
- An older buyer, possibly reading without their glasses on, who trusts what they can read clearly far more than what looks decorative

**The core psychological job of this UI is to convert uncertainty into confidence at every step** — is this the right product, is this the real price, is my payment safe, will it actually arrive. Every screen either reduces that uncertainty or it's dead weight.

**A specific and non-negotiable trust signal for this audience: plain, high-contrast, unmistakably legible text beats decorative styling every time.** A shopper who has to squint at low-contrast or overly stylized type doesn't think "elegant" — they think "I can't read this, maybe it's not for me" and bounces or asks someone else to order for them. Legibility *is* the premium feel here, not a compromise on it.

**The single sentence to repeat in every design review:**
> "Would I enter my card number here without a second thought — and could I read every word on this screen clearly without my glasses?"

---

## 2. Who We're Designing For

| Persona | Context | Design Implication |
|---|---|---|
| **First-Time Visitor** | Arrived from an ad, search, or a friend's link; zero brand trust yet | Homepage/PDP must establish credibility fast — real photos, clear pricing, visible reviews, no dark patterns |
| **Comparison Shopper** | Has 2–3 tabs open, price- and spec-sensitive, will leave at the first friction point | Product info, pricing, and shipping cost must be visible without extra taps or hidden reveals |
| **Returning/Repeat Customer** | Knows what they want, wants to buy again fast | Order history, "buy again," and saved payment/address must shortcut the full funnel |
| **Cart Abandoner (recoverable)** | Added items, got interrupted, distracted, or hit sticker shock at checkout | Cart persists across sessions/devices; checkout must front-load true total cost, not surprise it at the end |
| **Mobile-First Shopper** | Browsing and buying almost entirely on a phone, often on the move — this is the primary, default target, not one variant among several | Every core flow (browse → cart → checkout) must work one-handed, thumb-reachable, with minimal typing, on a small screen, first |
| **Older / Less Tech-Fluent Shopper** | May be reading without glasses, unfamiliar with app conventions, more comfortable in Bengali than English, and slower/more deliberate with a touchscreen | Large, high-contrast, plain text; Bengali by default; big obvious buttons; nothing that requires "figuring out" a gesture or icon |
| **Assistive-Tech User** | Uses screen readers, keyboard nav, or has low vision | Every flow must be fully operable without a mouse and legible without color dependence |

**Device & environment reality (design for this, don't assume otherwise):**
- **Mobile is the primary and required target for every screen. Desktop/tablet is a secondary, optional layer added afterward** — not the other way around. If a choice has to be made under time or budget pressure, the mobile experience wins; a screen is allowed to ship "desktop-unpolished" but never "mobile-unpolished."
- Majority of traffic is **mobile**, often on mid-range or older Android devices and imperfect connections.
- Shoppers arrive **mid-intent**, not from the homepage — most sessions land on a product page or search results, not the front door. Every page must work as a landing page.
- **Trust is earned per-session, not assumed.** A first-time visitor and a tenth-time customer see the same UI, but the first-timer needs more reassurance signals (reviews, return policy, security badges) visible without digging.
- **Price sensitivity to hidden costs is extreme.** Shipping, tax, or fees revealed only at the final checkout step is the single largest cause of cart abandonment industry-wide — treat "no surprise costs" as a hard functional requirement, not a nicety.
- **Legibility beats decoration, categorically.** For a meaningful share of this audience, plain black text on a light, even background is read with more confidence and speed than styled text on a colored or patterned background — even when the styled version tests as "more premium-looking" in a vacuum. Default to the plainer, more readable option whenever the two are in tension.

---

## 3. The Five Non-Negotiable Principles

Every screen, before shipping, must pass all five:

### 1. One Screen, One Job
Each screen has exactly one primary purpose and one obvious primary action. A product page's job is "help me decide and add to cart" — not also cross-sell aggressively, collect an email, and promote a sale banner all competing for the same eye.

### 2. Price and Cost Are Never Hidden
The price shown when browsing is the price paid, or the path to the true total is visible before checkout, not revealed at the last step. Shipping estimates, taxes, and fees are shown as early as the cart, never first-disclosed at payment.

### 3. Forgiving & Reversible
Nothing is scary to press. Adding to cart, removing an item, applying/removing a coupon, and changing quantity are all instant and undoable. Nobody should ever be forced to restart a checkout because of a slip.

### 4. Speed and Friction Reduction Is a Feature
- A returning customer's repeat purchase (saved card, saved address): **checkout in under 60 seconds.**
- Guest checkout must always exist — **account creation is never a blocker to purchase.**
- Every field removed from checkout is a measurable reduction in abandonment; treat form length itself as a cost.

### 5. One Visual Language Across the Whole Funnel
Browse, product detail, cart, checkout, and account must look like **one continuous experience**, not a marketing site bolted onto a separate checkout app. Same buttons, same colors, same type scale, same iconography — trust breaks the moment checkout suddenly looks like a different, less-polished product.

---

## 4. Information Architecture

### 4.1 The Core Idea: The Funnel Is the Architecture
Unlike an internal tool, this product has a **linear core path** — Discover → Decide → Cart → Checkout → Confirmation — and every other section (account, wishlist, support) is a *branch off* that path, not a parallel destination. Navigation should always make it obvious how to get back onto the core path from anywhere.

### 4.2 Primary Navigation (max 5–6 top-level items)

```
┌───────────────────────────────────────────┐
│  🔍 Search (always visible, never hidden)   │
│  🗂️  Categories / Shop                      │
│  ❤️  Wishlist / Saved                       │
│  🛒 Cart (persistent, item count badge)     │
│  👤 Account / Orders                        │
└───────────────────────────────────────────┘
```

- **Desktop:** persistent top header — logo, search bar, category mega-menu, cart icon with live count, account menu.
- **Mobile:** collapsed hamburger/category menu + bottom tab bar with Home, Search, Cart, Account as the fixed anchors — cart and search must never be more than one tap away from anywhere.
- **Search is a first-class citizen, not a menu item.** For a shopper who already knows what they want, search is the fastest path to purchase — it should be visually prominent on every page, not buried behind a magnifying-glass icon alone.

### 4.3 Depth Rule
**No product should ever be more than 3 taps from the homepage or 1 search away.** Category → Subcategory → Product Listing → Product Detail is the maximum acceptable depth for browsing; filters narrow within a level, they don't add a level.

### 4.4 The Checkout Is Not Navigable Away From Accidentally
Once a shopper enters checkout, global navigation (header links, category menu) is minimized or removed — the only ways out are "back to cart" and completing the purchase. This mirrors the "don't let a cashier accidentally exit mid-sale" logic from POS design: checkout is a protected, linear mode.

---

## 5. Visual Design System (Design Tokens)

Use these values exactly. Do not introduce new colors, fonts, or spacing values without updating this document first.

### 5.1 Color Palette

**The base of every screen is off-white/ivory, not white and not a saturated brand color.** Green and gold are accents layered on top of that calm, neutral base — they are never the dominant background color of a page, and they are never used as a background behind body text. The reasoning is deliberate: a light, warm, slightly-textured ivory background with near-black text is what reads as clean, calm, and trustworthy to this audience — a heavily colored background (even an on-brand green) behind white or gold text looks festive/decorative rather than like a place to safely enter payment details, and is measurably harder to read fast or without glasses.

| Token | Hex | Usage |
|---|---|---|
| `bg-base` | `#FBF8F1` (ivory) | Default page background — used almost everywhere, on every screen, every breakpoint |
| `bg-surface` | `#FFFDF8` (off-white, slightly warmer than pure white) | Card/panel background, sitting one shade lighter than the page base so cards are still visibly distinct without a hard white/ivory clash |
| `primary` (deep green) | `#1F5D42` | Primary buttons, active nav, links, primary CTA fills — the main brand/action color |
| `primary-hover` | `#164A34` | Hover/pressed state |
| `primary-tint` | `#E4EFE8` (pale green, 10–15% tint) | Badge backgrounds, selected filter chips, subtle section dividers — never behind body text |
| `gold` (accent) | `#B8860B` (muted, matte gold — not bright/metallic yellow) | Premium/featured badges, dividers, icon accents, subtle borders on cards — decorative accent only |
| `gold-tint` | `#F5EEDD` | Very light gold-tinted background for a "featured" section or promo card, still light enough for black text on top |
| `success` | `#16A34A` | Order confirmed, in stock, payment successful |
| `warning` | `#B45309` | Low stock, limited-time offer, action needed |
| `error` | `#B3261E` | Out of stock, failed payment, validation error |
| `neutral-900` (near-black) | `#1A1A1A` | Primary text — this is the color that carries the most weight in this system; see 5.2 |
| `neutral-600` | `#5B5650` (warm dark gray, not cool gray, to sit comfortably on ivory) | Secondary text, metadata |
| `neutral-300` | `#DDD6C7` (warm light border tone) | Borders, dividers — warm-toned to match the ivory base rather than a cool gray that would clash |
| `neutral-100` | `#F1ECE0` | Subtle backgrounds, disabled states |

**Rule: text sits on ivory/off-white or white, never directly on a saturated green or gold fill.** Green and gold are for buttons, icons, borders, badges, and small accents — not full-bleed backgrounds behind paragraphs, prices, or form fields. If a section needs a colored background for visual separation, use `primary-tint` or `gold-tint`, both light enough that near-black text stays effortlessly readable on top.

**Rule:** color alone never carries meaning. Stock status, sale badges, and order status must pair color with an icon or text label — never a colored dot alone.

**Rule:** gold is a genuine accent, not a second primary color — it appears in small doses (an icon, a thin border, a "featured" ribbon), never as a large fill competing with green for the shopper's attention. A screen with green buttons and gold buttons side by side creates ambiguity about which is the real action; there is exactly one primary action color (`primary` green), and gold never fills a primary CTA button.

### 5.2 Typography

**The single most important rule in this entire document: plain, high-contrast, near-black text on the ivory background beats any decorative or script-style typography, every time, for every audience segment this product serves.** It is tempting to reach for an elegant calligraphic or decorative headline treatment on a colored background because it photographs well — resist this. For a large share of shoppers here, especially older ones reading without their glasses, a stylized headline is genuinely harder or slower to read than a plain one, and "harder to read" reads as "not for me" or "hiding something," which actively damages trust rather than building it. If a designer is choosing between "looks more elegant" and "reads instantly to someone squinting at arm's length," the second one wins, without exception.

- **Font choice:** one clean, high-legibility Bengali typeface (e.g., Noto Sans Bengali, Hind Siliguri, or similar humanist Bengali sans) paired with a matching plain Latin sans (e.g., Inter, Noto Sans) for English/numerals — both render cleanly at small sizes on low-end screens. **No decorative, script, or calligraphic typefaces anywhere in the product UI** — not on the homepage hero, not on promotional banners, not on badges. Decorative type treatment, if used at all, is reserved for static marketing assets outside the app (e.g., a printed poster), never inside the shopping experience itself.
- **Never go below 16px** for any body text, and **18px is the preferred baseline for this audience** — this is a deliberately higher floor than a typical e-commerce product, in direct response to the number of shoppers reading without glasses. Price, total, and policy text should default to 18px or larger, never smaller than surrounding body text.
- **Text-on-background contrast target is higher than the WCAG AA minimum where practical** — aim for nearly black (`neutral-900` / `#1A1A1A`) text on the ivory/off-white base rather than a softened dark gray, specifically because this combination is what tested well for older readers without corrective lenses. Don't lighten primary text "for aesthetics."
- **Bold weight is the primary tool for hierarchy, not size alone** — a bold 18px price is easier for this audience to scan than a thin 24px one.

| Style | Size | Weight | Usage |
|---|---|---|---|
| Display | 32px | 700 | Hero/campaign headlines — plain typeface, near-black or deep green text on ivory, never white text on a colored background |
| H1 | 26px | 700 | Page titles (category name, "Your Cart") |
| H2 | 20px | 700 | Section headers (product title on PDP) |
| Body | 18px | 400 | Standard text, descriptions — raised floor vs. typical e-commerce baseline |
| Body Bold | 18px | 700 | Prices, labels, emphasis |
| Caption | 16px | 400 | Metadata, timestamps, fine print — never for price or total, and still above the old 14px floor |

### 5.3 Spacing Scale (4px base grid)
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96` — pick from this scale only.

### 5.4 Touch Targets
- **Minimum 44×44px**, **48×48px preferred** for cart quantity steppers, size/variant selectors, and the primary "Add to Cart" / "Buy Now" buttons — these are the highest-frequency taps in the product.
- Minimum **8px gap** between adjacent tappable elements (especially variant swatches — a mis-tapped size/color is a real, costly failure mode leading to returns).

### 5.5 Buttons

| Type | Look | Usage | Example Label |
|---|---|---|---|
| Primary | Filled, `primary` color | One per screen, the main conversion action | "Add to Cart," "Place Order" not "Submit" |
| Secondary | Outlined | Alternative action | "Save for Later," "Add to Wishlist" |
| Urgency/Accent | Filled, `accent` color | Time-limited or high-intent action, used sparingly | "Buy Now," "Notify Me When Back in Stock" |
| Destructive | Outlined or text, `error` color | Remove/cancel actions | "Remove Item," "Cancel Order" |
| Ghost/Text | No fill | Low-emphasis actions | "Continue Shopping" |

**Rule: buttons say what they do and what happens next.** Never "Submit," "Next," or "Continue" alone in checkout — always "Continue to Payment," "Review Order," "Place Order — $84.20" so the shopper always knows both the action and the cost/commitment level.

### 5.6 Grid & Responsive Breakpoints

**Mobile is the product. Tablet and desktop are a secondary, optional layer built afterward, time and budget permitting — not co-equal targets.** Every core flow (browse, PDP, cart, checkout, account) must be fully designed, built, and tested at mobile width before any desktop layout work begins. It is acceptable for desktop to launch later, simpler, or even absent for v1; it is not acceptable for mobile to launch second or simplified.

| Breakpoint | Width | Priority | Layout Behavior |
|---|---|---|---|
| Mobile | 360px – 599px | **Primary — required, gets the most design attention** | Single column, bottom tab nav, full-width product cards, sticky "Add to Cart" bar on PDP |
| Tablet | 600px – 1023px | Secondary, optional | 2-column product grid, collapsible filters drawer — nice-to-have adaptation of the mobile layout, not a distinct design pass |
| Desktop | 1024px+ | Secondary, optional | 3–4 column product grid, persistent filter sidebar, max content width **1280–1440px** centered — can reasonably ship after mobile, and can start as a straightforward centered/scaled-up version of the mobile layout rather than a from-scratch desktop design |

- Base grid: **4 columns** (mobile) / **8 columns** (tablet) / **12 columns** (desktop), **16–24px gutter**.
- **Design mobile-first, literally, and treat it as the only mandatory deliverable per screen.** Build and fully approve the 360px layout before touching the 1024px one; if a project timeline gets compressed, cut desktop scope, not mobile quality.

### 5.7 Iconography

- **One icon library only** (e.g., Phosphor, Lucide, Heroicons) — never mix styles.
- **Stroke weight:** consistent 1.5–2px.
- **Style:** outline by default; filled variant reserved for "active/selected" state (current nav tab, selected filter chip, filled wishlist heart once saved).
- Icons for **primary actions are always paired with a text label** (cart, checkout, wishlist) — icon-only is acceptable only for universally understood, secondary/repeated micro-actions (e.g., a trash icon next to an already-labeled cart line item), never for anything that gates the purchase.
- **No literal emoji glyphs in production UI** — they render inconsistently across OS/device combinations. Build every symbol as an SVG icon from the chosen library.

### 5.8 Corner Radius & Elevation

**Radius scale** — pick from these only:

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4px | Inputs, small buttons, badges |
| `radius-md` | 8px | Product cards, primary buttons, mobile bottom sheets |
| `radius-lg` | 12px | Desktop modals (quick-view, cart drawer) |
| `radius-full` | 999px | Pills, sale badges, avatar/initials |

**Elevation scale** — keep shadows subtle and functional:

| Level | Shadow | Usage |
|---|---|---|
| 0 | none | Page background |
| 1 | `0 1px 2px rgba(0,0,0,0.06)` | Resting product cards |
| 2 | `0 4px 6px rgba(0,0,0,0.10)` | Dropdowns, mini-cart popover, sticky header on scroll |
| 3 | `0 10px 25px rgba(0,0,0,0.15)` | Modals, cart drawer, quick-view overlay |

Prefer a 1px `neutral-300` border over a shadow for dense product grids — calmer at scale and cheaper to render while scrolling long listing pages.

### 5.9 Core Component Visual Specs

| Component | Spec |
|---|---|
| **Text Input** | 48px min height · 1px `neutral-300` border · `radius-sm` · 12–16px horizontal padding · focus = 2px `primary` ring · label always visible above field, never placeholder-only (placeholders disappear on input and shoppers forget what they typed) |
| **Product Card** | Square or fixed-aspect image · title (2-line max, truncate with ellipsis) · price prominent, bold · sale price shown with strikethrough original · rating stars + review count if available · quick "Add to Cart" affordance on hover (desktop) or persistent (mobile) |
| **Price Display** | Current price always bold/largest; original (struck-through) price and % off shown together when discounted; "as low as" / installment text (if used) in smaller caption weight below, never larger than the main price |
| **Cart Line Item** | Product image · name · selected variant (size/color) · quantity stepper (48px targets) · line total · remove action — all in one row on desktop, stacked on mobile with total still visible without scrolling |
| **Badge / Chip** | Pill shape (`radius-full`) · background = 10–15% tint of semantic color · used for stock status, sale %, shipping speed ("Free shipping," "Ships in 2 days") |

### 5.10 Stock & Order Status Indicators

| Stock State | Chip Color | Label |
|---|---|---|
| In Stock | `success` tint | "In Stock" |
| Low Stock | `warning` tint | "Only 3 left" (real number, never a vague "almost gone" if not true) |
| Out of Stock | `error` tint (muted) | "Out of Stock" + "Notify Me" action, product still visible not hidden |
| Preorder | `gold-tint` | "Ships [date]" |

| Order Status | Chip Color |
|---|---|
| Order Placed | `neutral-100` / gray-tint |
| Processing | `warning` tint |
| Shipped | `primary-tint` |
| Out for Delivery | `primary-tint`, bolder/darker green text |
| Delivered | `success` tint |
| Cancelled / Refunded | `error` tint |

**Rule: never fabricate urgency.** Countdown timers, "X people viewing this," and stock counts must reflect real data. Fabricated scarcity is a trust-destroying dark pattern and, once a shopper catches it once, it poisons trust in every other signal on the site (real reviews, real prices) going forward.

### 5.11 Imagery Style

- **Product photography:** consistent aspect ratio (commonly 1:1 or 4:5) across every card and gallery — never mix ratios within the same grid. First image is always the primary "clean" product shot; lifestyle/context shots come after in the gallery, not first.
- **Zoom/detail view is mandatory** for any product where texture, print, or fine detail affects the purchase decision — pinch-zoom on mobile, hover-zoom or click-to-expand on desktop.
- **Empty-state illustrations** (empty cart, no search results, empty wishlist): simple, on-brand, 2-color — always paired with a clear next action, never decoration alone.
- **User-generated/review photos**, if supported, are visually distinguished from official product photography (e.g., smaller, in a separate row) so shoppers don't confuse the two.

### 5.12 Logo & Branding Placement

- Logo top-left of header (or centered on mobile if that's the brand convention), consistent height across breakpoints, minimum clear space equal to its own height.
- Never stretch, recolor, or distort the logo; provide a favicon/app-icon variant separately.

### 5.13 Motion & Animation

- **Duration:** 150–200ms for micro-interactions (add-to-cart confirmation, button press, badge update); 250ms max for page/panel transitions (cart drawer sliding in).
- **Easing:** ease-out entering, ease-in leaving.
- **Motion communicates a state change** — an item flying into the cart icon confirms the add-to-cart registered; it should never be purely decorative on a page that shoppers are trying to move quickly through.
- Avoid heavy parallax or elaborate scroll-jacking effects on category/listing pages — they slow down the exact moment shoppers are trying to scan quickly.

---

## 6. Core Interaction Patterns

### 6.1 Forms
- **Only ask for what's needed at that step.** Don't collect a full account profile to complete a guest checkout — email, shipping address, and payment are enough.
- **One column, always**, in checkout and account forms — side-by-side fields slow down scanning and increase error rates, on both mobile and desktop.
- **Smart defaults:** returning customers see their last-used shipping address and payment method pre-selected, with an easy "use a different address/card" escape hatch.
- **Autofill-friendly:** correct `autocomplete` attributes and input types (email, tel, postal code) so browser/OS autofill works — this alone removes a large share of checkout typing.

### 6.2 Search & Filtering
- Search bar is **pinned and always visible**, not hidden behind an icon, on both mobile and desktop.
- Search supports **typo tolerance and partial matches** — a shopper searching "sneekers" should still get sneakers.
- **Filters narrow, they never navigate away** — applying a filter updates the current grid in place (or via a slide-in drawer on mobile), never a full page reload that loses scroll position.
- **Active filters are always visible as removable chips** above the results, so a shopper always knows what's currently narrowing their view.

### 6.3 Confirmations & Undo
- Low-risk actions (change quantity, remove item from cart, apply/remove coupon): **no confirmation dialog**, just an instant "Undo" toast for 5 seconds.
- High-risk actions (cancel a placed order, delete a saved payment method): **one plain-language confirmation** — never a technical one.
  - Bad: "Are you sure you want to proceed with this action?"
  - Good: "Cancel Order #4021? You won't be charged and any refund will process in 3–5 days."

### 6.4 Notifications & Toasts
- Appear at the same screen position every time (bottom-center on mobile, top-right on desktop).
- "Added to cart" confirmations show a mini-preview (thumbnail + name + updated cart total), not just a generic "Item added" — this reassures the shopper the right item/variant was captured.
- Auto-dismiss in 4–5 seconds, always with a manual dismiss; never stack more than 2 at once.

---

## 7. Module-Specific Guidelines

### 7.1 Product Listing / Category Page

**Design goal: let a shopper scan, compare, and narrow down to a shortlist in under 20 seconds.**

- Grid density and filter prominence scale with breakpoint (persistent sidebar on desktop, drawer on mobile) but the **information shown per product card stays identical** across breakpoints — image, name, price, rating, stock/shipping badge.
- **Sort and filter controls are always visible**, not buried in a secondary menu — sort by relevance/price/rating/newest is table stakes.
- Pagination or infinite scroll — either is acceptable, but **infinite scroll must not break the browser back button** (returning from a product detail page should land the shopper back at their scroll position, not the top of page 1).

### 7.2 Product Detail Page (PDP)

**Design goal: answer "is this the right product at the right price" without the shopper needing to leave the page.**

```
┌───────────────────────────────────────┐
│  [ Image Gallery, zoomable ]           │
│                                         │
│  Product Name                          │
│  ★★★★☆ 4.3 (212 reviews)                │
│                                         │
│  $49.99  (was $69.99 — 29% off)        │
│                                         │
│  Color: [●][●][●]   Size: [S][M][L]    │
│                                         │
│  ✅ In Stock — Ships in 2 days          │
│                                         │
│  ┌───────────────────────────────┐    │
│  │   Add to Cart                  │    │
│  └───────────────────────────────┘    │
│                                         │
│  ▼ Description                         │
│  ▼ Shipping & Returns                  │
│  ▼ Reviews                             │
└───────────────────────────────────────┘
```

- **Variant selection (size/color) is required before "Add to Cart" activates** if variants exist — the button is disabled/grayed with a gentle prompt ("Select a size") rather than allowing an ambiguous add.
- **Price, stock status, and the primary CTA stay visible** — on mobile, this means a sticky bottom bar with price + "Add to Cart" that persists as the shopper scrolls through description/reviews.
- **Shipping cost or "calculated at checkout" note is visible on the PDP itself**, not first revealed in the cart — even an estimate range reduces surprise later.
- Reviews are **never hidden behind an extra click** for a summary view (star average + count must be visible near the price); full review text can be a scroll-down section.
- **Related/cross-sell products** are secondary and visually subordinate — they never compete with the primary "Add to Cart" action for attention.

### 7.3 Cart

**Design goal: the shopper reviews exactly what they're about to pay, with zero surprises, and can act on any line instantly.**

```
┌───────────────────────────────────────┐
│  Your Cart (2 items)                   │
│                                         │
│  [img] Product A — Size M              │
│        Qty [ - 1 + ]      $29.99       │
│        Remove · Save for Later         │
│  ─────────────────────────             │
│  [img] Product B                       │
│        Qty [ - 2 + ]      $40.00       │
│        Remove · Save for Later         │
│                                         │
│  Subtotal              $69.99          │
│  Estimated Shipping    $4.99           │
│  Estimated Tax         $5.60           │
│  ─────────────────────────             │
│  Estimated Total       $80.58          │
│                                         │
│  ┌───────────────────────────────┐    │
│  │   Checkout                     │    │
│  └───────────────────────────────┘    │
└───────────────────────────────────────┘
```

- **Cart persists** across sessions and, if the shopper is logged in, across devices — nothing is lost by closing the tab.
- **Quantity and removal changes update the total instantly**, no separate "Update Cart" button to press.
- **Estimated shipping and tax show in the cart**, before checkout begins — even a "calculated based on your location" placeholder with a ZIP/postcode field is better than total silence until the final step.
- A **cart icon/drawer preview** (mini-cart) accessible from anywhere lets a shopper glance at contents without leaving the page they're browsing.

### 7.4 Checkout

**Design goal: a returning customer with saved details completes checkout in under 60 seconds; a first-time guest completes it in one continuous, single-column flow with no dead ends.**

- **Guest checkout is always available and never demoted** — "Checkout as Guest" is equally prominent as "Log In," never a small link buried below a login form.
- **Single-page or clearly progressed multi-step** — if multi-step (Shipping → Payment → Review), a persistent progress indicator shows exactly where the shopper is and what's left; back navigation between steps never loses entered data.
- **The order total, with every line item (subtotal, shipping, tax, discount), is visible at every step** — not just revealed once at the final screen.
- **Payment method selection is simple and trust-signaling** — recognizable payment logos, a security/lock indicator near the card field, and (if supported) one-tap wallet options (saved card, digital wallet) surfaced above manual card entry for returning customers.
- **Address entry supports autocomplete** (postal/ZIP code lookup or address-suggestion API) to minimize typing and typo-driven delivery failures.
- **Errors are caught inline, before submission attempts** — an invalid card number or expired promo code is flagged the moment it's clear, in plain language, next to the field, not after a failed submit and a page reload.
- **Order confirmation is unambiguous** — a dedicated confirmation screen with order number, itemized summary, estimated delivery date, and a clear next step ("Track Your Order" / "Continue Shopping"), plus an immediate confirmation email.

### 7.5 Account & Order History

- **Order history uses the same status pattern as Section 5.10** — a shopper checking "where's my order" should recognize the same status language used throughout the site.
- **Reorder / "Buy Again"** is a one-tap action from order history for repeat-purchase categories (consumables, apparel basics) — this is the fastest possible path to a repeat sale.
- **Saved addresses and payment methods** are editable without needing to go through checkout — account settings is a first-class place to manage this, not checkout-only.
- **Returns/exchanges initiation** lives directly on the order detail screen, not in a separate help-center flow the shopper has to search for.

---

## 8. Language, Numerals & Currency

- **Bengali is the default language for every shopper, every screen, on first load — not an auto-detected option, the actual default.** English is available as an explicit, easy-to-find, one-tap opt-in (not opt-out), and the choice is remembered per device/account once made. Nothing in the core purchase flow — product names, buttons, checkout, confirmation, order status — should ever be English-only; if a piece of content only exists in English (e.g., a supplier-provided description), show it clearly labeled as such rather than silently mixing languages.
- **The language switcher itself must be instantly recognizable without reading** — a flag or "বাং / EN" toggle placed consistently in the same header/footer location on every screen, large enough to be an easy, unambiguous tap.
- **Numerals default to standard (0–9) digits, even in Bengali mode**, for prices, quantities, and phone numbers — most everyday commerce and financial numbers in Bangladesh are read faster in standard digits than Bengali numerals (১,২,৩); don't force Bengali numerals onto anything transactional.
- **Currency is always ৳, shown before the number, comma-separated** (e.g., `৳2,450`) — consistent on every screen, no ambiguity, no alternate currency codes unless genuinely needed.
- **Dates use an unambiguous written format** (e.g., "২৪ আগস্ট" / "24 Aug") rather than all-numeric `24/08/2026` vs `08/24/2026`, which reads ambiguously across conventions.
- **Discounts are shown both as amount and percentage when helpful** ("৳500 off (20% off)") — shoppers process relative and absolute savings differently, and showing both removes ambiguity.
- **Plain, everyday Bengali wording throughout — never a stiff, overly formal, or literally-translated register.** Button and error copy should read the way a shopkeeper would actually say it out loud, not like a machine translation of the English original; a direct translation that sounds unnatural undermines exactly the trust this document is built to protect.

---

## 9. Forms & Data Entry Rules

1. **Required fields are truly required for the transaction** — anything not needed to ship the order and process payment is optional and deferrable to post-purchase account setup.
2. **Correct input types and keyboards by default** — numeric keypad for card number/CVV/postal code, email keyboard for email fields — this alone meaningfully speeds up mobile checkout.
3. **Inline validation, not modal popups** — errors show directly under the field, in plain language, the moment it's clear (e.g., after leaving the field or on submit attempt), not while the shopper is still mid-keystroke.
4. **Never punish minor formatting variance.** A phone number with or without dashes, a card number with spaces — normalize and accept common formats rather than rejecting on strict pattern match.

---

## 10. Feedback, Errors & Empty States

- **Error messages are written for a shopper, not a developer.**
  - Bad: `Error: Payment gateway timeout (code 402)`
  - Good: "We couldn't process your payment — please check your card details and try again. Your cart is saved, nothing is lost."
- **Empty states always have a next action.**
  - Empty cart: illustration + "Your cart is empty" + a prominent `[Continue Shopping]` button, ideally with a few popular/recent items shown below.
  - No search results: "No results for 'x'" + suggested spelling correction or related categories, never a dead end.
- **Loading states:** show a skeleton/placeholder within 200ms of any wait (product grid, checkout submission); if payment processing may take more than 2 seconds, show a clear "Processing your payment — don't close this window" indicator so the shopper never double-submits out of uncertainty.

---

## 11. Performance & Reliability

- **Design and test for 4G/throttled connections.** First meaningful content (hero image, product grid) should appear within 2–3 seconds; slow-loading product images are a leading cause of listing-page bounce.
- **Checkout must never lose data on a dropped connection or accidental navigation.** Entered shipping/payment info persists locally until the order is confirmed; a failed submission returns the shopper to a filled-in form, not a blank one.
- **Images are lazy-loaded and compressed/responsive** (serve appropriately sized images per breakpoint) — product imagery is typically the single largest performance cost on an e-commerce site.
- **Avoid heavy animation and layout shift.** Content should not visibly jump as images or ads load in — reserve space for images before they load to prevent shoppers from mis-tapping a button that moved.

---

## 12. Onboarding & Trust-Building

- **No forced account creation before browsing or checkout.** Account creation is offered, never required, and is easiest right after a successful guest purchase ("Create an account to track this order" with fields pre-filled from checkout).
- **Trust signals are visible where decisions happen**, not relegated to a separate "About Us" page: return policy near the "Add to Cart" button, security/payment badges near the payment field, real review counts near the price.
- **First-purchase reassurance**, not a slideshow: order confirmation and shipping-status emails/pages that clearly show what happens next and when, reducing "did this actually go through" anxiety.
- **No dark patterns** — no pre-checked add-ons, no forced newsletter opt-in to complete a purchase, no countdown timers that reset on refresh, no hidden subscription enrollment. Each of these generates short-term conversion at the cost of long-term trust and return rate.

---

## 13. Accessibility & Inclusivity

- **Contrast ratio minimum 4.5:1** for all text (WCAG AA) — this includes price text and stock-status labels, which are exactly the elements most often rendered in low-contrast decorative color.
- **Never rely on color alone** for stock status, sale badges, or form validation — always pair with icon and/or text.
- **Fully keyboard-operable checkout** — a shopper using only a keyboard or screen reader must be able to browse, add to cart, and complete checkout without a mouse, with logical tab order and visible focus states throughout.
- **Alt text on all product images**, descriptive enough to convey the product, not just the filename.
- **Large, forgiving tap targets** (Section 5.4) serve both speed-focused mobile shoppers and users with limited dexterity — same rule, two justifications.
- **Works on small screens first.** Design and test at 360px width as the baseline, especially for cart and checkout, where errors are most costly.

---

## 14. Do's and Don'ts Checklist

| ✅ Do | ❌ Don't |
|---|---|
| Show the true total cost as early as the cart | Reveal shipping/fees for the first time at final checkout |
| Offer guest checkout, prominently | Force account creation to complete a purchase |
| One primary CTA per screen ("Add to Cart," "Place Order") | Multiple competing CTAs pulling attention from the main action |
| Persist cart and checkout data across sessions/interruptions | Make a shopper re-enter everything after a dropped connection |
| Use plain-language, reassuring error and confirmation messages | Show technical error codes or vague "Something went wrong" |
| Show real stock counts and real urgency signals | Fabricate scarcity ("Only 2 left!") that isn't true |
| Keep navigation, search, and cart reachable from anywhere | Bury search behind an icon or nest categories 4+ levels deep |
| Pair every status/badge with an icon or label, not color alone | Rely on color alone to signal stock, sale, or order status |
| Test every screen on a real mid-range phone on a throttled connection | Design only on a large monitor and assume it translates down |
| Let shoppers undo cart/quantity changes instantly | Require a confirmation dialog for low-risk, reversible actions |
| Use plain near-black text on ivory/off-white for anything the shopper must read | Put white or gold decorative text on a green/colored background for real content |
| Default every screen to Bengali, with English one tap away | Auto-switch language silently, or leave any checkout step English-only |
| Design and finish the mobile layout completely before starting desktop | Treat desktop as the reference design and mobile as the shrink-down |
| Use green and gold as accents — buttons, icons, thin borders, badges | Use green or gold as a full-bleed background behind paragraphs or prices |

---

## 15. Appendix: Condensed Rule Block (for LLM System Prompts)

Paste this block into any LLM instruction set used to generate or review UI for this e-commerce platform:

```
When designing or generating any screen for this e-commerce platform, you must follow these
rules without exception:

1. Every screen has exactly one primary action, visually dominant over all others.
2. Navigation has a maximum of 5-6 top-level items; no category nests more than 3 levels deep.
   Search and cart are reachable from every page.
3. Body text is never smaller than 16px, with 18px as the preferred default for body, prices,
   and policy text - this is a deliberately high floor for readability. Headings follow the
   type scale in Section 5.2.
4. The page background is ivory/off-white (`bg-base`), never white-on-green or white-on-gold.
   Body text, prices, and any real content are near-black on ivory/off-white/white only - green
   and gold are accents (buttons, icons, borders, badges, small tints), never full-bleed
   backgrounds behind text. When in doubt, choose the plainer, higher-contrast option over the
   more decorative one.
5. No decorative, script, or calligraphic typefaces anywhere inside the shopping experience -
   use a single plain, high-legibility Bengali sans (e.g., Noto Sans Bengali / Hind Siliguri)
   paired with a plain Latin sans, both from Section 5.2's approved pairing.
6. Use only the color tokens defined in Section 5.1 - no ad hoc colors. Never use color alone
   to convey stock status, sale status, or order status - always pair with icon/text.
7. Use only the 4px spacing scale (4/8/12/16/24/32/48/64/96) - no arbitrary spacing values.
8. All tappable elements are at least 44x44px (48x48px for cart/variant/CTA controls), with 8px
   minimum gap.
9. Buttons are labeled with a verb + object and, in checkout, the commitment/cost ("অর্ডার করুন
   - ৳2,450" / "Place Order - ৳2,450"), never generic labels ("Submit", "Next", "OK").
10. Shipping cost, tax, and total cost must be visible by the cart step at the latest - never
    first revealed at final checkout. No hidden or surprise fees.
11. Guest checkout is always available and equally prominent as account login - account creation
    is never a purchase blocker.
12. Forms are single-column in checkout and account flows. Inputs use correct type/keyboard
    (numeric, phone, etc.) and support autofill.
13. Every destructive/high-risk action (cancel order, delete saved payment) requires one
    plain-language confirmation naming exactly what happens. Low-risk actions (quantity change,
    remove cart item, apply coupon) get instant "Undo" toasts instead.
14. Every product listing/search page has a visible (not hidden) search bar and visible sort/
    filter controls; applied filters show as removable chips.
15. Every empty state (empty cart, no search results, empty wishlist) includes a clear next
    action button, never just blank space.
16. Error messages are written in plain, everyday Bengali for a shopper - no error codes, no
    technical jargon, no stiff literal-translation phrasing, always state what happens next.
17. All UI must render correctly at 360px width first, and mobile is the required, primary
    deliverable for every screen - tablet and desktop are secondary, optional, and may ship
    later or simpler. Never design desktop-first and shrink down.
18. Checkout persists entered data across interruptions, dropped connections, or back
    navigation between steps - never force a shopper to re-enter completed fields.
19. Bengali is the default language on first load for every shopper, on every screen, including
    checkout and order status - not auto-detected, not English-first. English is available via
    a persistent, obvious one-tap toggle, and the choice is remembered. Numerals stay in
    standard (0-9) digits even in Bengali mode for prices, quantities, and phone numbers.
    Currency is always ৳ before the number, comma-separated.
20. Product cards show image, name, price, rating (if available), and stock/shipping badge
    consistently across every grid and breakpoint - no ad hoc card layouts.
21. Never fabricate urgency or scarcity signals (fake countdowns, fake low-stock, fake viewer
    counts). Never use pre-checked add-ons, forced opt-ins, or hidden subscriptions.
22. When any rule in this list conflicts with visual polish, this rule wins - clarity,
    legibility, and purchase confidence outrank decoration, every time.
23. Use only one icon library throughout the product; never mix icon styles, and never
    implement functional icons as native emoji glyphs - build them as SVG icons instead.
24. Use only the defined radius scale (4/8/12px, full for pills) and elevation scale (Section
    5.8) - no arbitrary border-radius or box-shadow values.
25. Product images use a consistent aspect ratio across every list/grid on a given page; the
    primary product image is a clean product shot, not a lifestyle image, shown first.
26. Animations are limited to 150-250ms, ease-out on enter / ease-in on exit, and must always
    signal a state change (e.g., add-to-cart confirmation) - never purely decorative motion.
```

---

*End of document. This guideline should be treated as living — update Section 5 (tokens) in one place if values ever change, and every screen in the product inherits the update automatically in principle, if not in code.*
