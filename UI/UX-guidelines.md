# UI/UX Design Guideline
## Unified ERP for Bangladesh SME Businesses (eCommerce + Social Commerce + POS)

**Version 1.0 — Reference Document**
**Design Standard: "The Grade 5 Test"** — *If a Class 5 student, or a shop assistant who has used a smartphone for six months, cannot complete a core task in under 30 seconds without asking anyone, the design has failed.*

---

## 0. How to Use This Document

This is the constitution for every screen in the product. It is not a moodboard — it is a rulebook.

- **For designers:** every screen you draw must be checked against Section 3 (Non-Negotiable Principles) and Section 14 (Do's/Don'ts) before it goes to dev.
- **For developers / LLMs building this system:** Section 5 (Design Tokens) gives you literal values — colors, spacing, font sizes — use them exactly, do not invent your own. Section 15 gives you a condensed rule block you can paste directly into a system prompt.
- **When guidelines conflict with "make it look impressive":** simplicity wins. Every single time. This is a tool for a busy shop owner, not a portfolio piece.

---

## 1. Design Philosophy & North Star

We are not building software for IT departments. We are building for:

- A shop owner in Bogura who has never used spreadsheet software
- A 19-year-old part-time employee entering Facebook Messenger orders between customers
- A cashier at a physical counter with a customer standing in front of them, waiting

**The Notion comparison is the right one — but for the right reason.** Notion is not "simple" because it has few features. It's simple because:
1. It never makes you think about *where* something is — everything is one click from anywhere.
2. It gets out of your way — the interface is quiet, the content is loud.
3. Every block behaves the same way everywhere, so once you learn one pattern, you know the whole app.

We are borrowing that **"learn once, use everywhere"** consistency — not the minimalist aesthetic for its own sake. Our users need *speed and confidence*, not elegance.

**The single sentence to repeat in every design review:**
> "Could my mother use this to sell rice on Facebook without calling me for help?"

---

## 2. Who We're Designing For

| Persona | Context | Design Implication |
|---|---|---|
| **Shop Owner (Admin)** | Runs the business, checks phone between customers, may know basic English | Dashboard must answer "how's business today" in one glance, no reports-building required |
| **Sales/Chat Staff** | Copies orders from Messenger/WhatsApp/Facebook comments all day | Order entry must be faster than typing into a notebook — this is the bar we're competing against |
| **Cashier (POS)** | Standing at a counter, customer waiting, may be interrupted mid-sale | Must be usable one-handed, with a touchscreen, without reading instructions |
| **Delivery/Inventory Staff** | Lower digital literacy, may prefer Bangla only | Icons + text always paired, never icon-only for critical actions |

**Device & environment reality (design for this, don't assume otherwise):**
- Primary device is a **mid-to-low-end Android phone** (5.5"–6.5" screen, sometimes 2–4GB RAM)
- Internet is **inconsistent** — 4G in Dhaka, patchy 3G outside it. **Design offline-tolerant, not offline-hostile.**
- Many users **switch between Bangla and English mid-sentence** (common in BD business contexts)
- Multiple staff often **share one login/device** — the UI should never assume "this is always the same person"

---

## 3. The Five Non-Negotiable Principles

Every screen, before shipping, must pass all five:

### 1. One Screen, One Job
Each screen has exactly one primary purpose and one obvious primary action. If a screen tries to do two jobs ("view orders" + "manage products"), split it.

### 2. Recognition, Not Recall
Never make the user remember a code, a menu path, or a term. Always show recent items, autocomplete, and visible options instead of empty text fields waiting for the "right" input.

### 3. Forgiving & Reversible
Nothing is scary to press. Every destructive action can be undone or requires one plain-language confirmation. Drafts autosave. Nobody should ever lose an hour of typed orders because the app crashed or the phone lost signal.

### 4. Speed Is a Feature, Not a Nice-to-Have
- A returning customer's POS sale: **under 15 seconds, under 4 taps.**
- A social commerce order entry: **under 30 seconds** for a repeat customer.
- Any action a staff member does 20+ times a day gets the *most* optimized flow in the product, even if it means a less "clean" looking screen.

### 5. One Visual Language, Three Modules
The POS, the chat-order panel, and the eCommerce admin must look like **siblings**, not three different apps stitched together. Same buttons, same colors, same icons, same spacing — only the layout density changes based on context (POS = biggest touch targets, admin = more information density).

---

## 4. Information Architecture

### 4.1 The Core Idea: Unified Order Inbox
Regardless of channel — website checkout, a Messenger order typed in by staff, or a walk-in POS sale — **every order lands in one place**: the Orders Inbox, tagged with a small colored channel badge (🛒 Website / 💬 Social / 🏬 POS). This is the single biggest UX decision in this product: **the owner should never have to check three different places to know what sold today.**

### 4.2 Primary Navigation (max 5 items — never more)

```
┌─────────────────────────────┐
│  🏠 Dashboard                │  ← "How's my business today"
│  📦 Orders (unified inbox)   │  ← all channels, one list
│  🏷️  Products & Inventory    │  ← shared stock across all channels
│  👥 Customers                │  ← shared customer list across all channels
│  ⚙️  More (Reports/Settings) │  ← everything else lives here
└─────────────────────────────┘
```

- **Desktop:** persistent left sidebar, icon + label always visible (never icon-only)
- **Mobile/Tablet:** bottom tab bar, same 5 items, same order
- **POS mode** is a distinct full-screen mode launched *from* Dashboard, not buried in the nav — when a cashier is in POS mode, hide all other navigation to prevent accidental exits mid-sale

### 4.3 Depth Rule
**No screen should ever be more than 3 taps from the Dashboard.** If your flow needs a 4th tap, you're over-engineering it — flatten it.

---

## 5. Visual Design System (Design Tokens)

Use these values exactly. Do not introduce new colors, fonts, or spacing values without updating this document first.

### 5.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#0D6E4E` (deep green) | Primary buttons, active nav, brand — evokes trust/money, works well culturally in BD retail |
| `primary-hover` | `#0A5A3F` | Hover/pressed state |
| `secondary` | `#1C64F2` (blue) | Links, secondary actions, info highlights |
| `success` | `#16A34A` | Payment received, order confirmed |
| `warning` | `#D97706` | Low stock, pending payment, needs attention |
| `error` | `#DC2626` | Failed action, out of stock, validation error |
| `neutral-900` | `#111827` | Primary text |
| `neutral-600` | `#4B5563` | Secondary text |
| `neutral-300` | `#D1D5DB` | Borders, dividers |
| `neutral-100` | `#F3F4F6` | Backgrounds, cards |
| `surface` | `#FFFFFF` | Card/panel background |

**Rule:** color alone never carries meaning. Every status (paid/unpaid, in-stock/out-of-stock) must pair color with an icon or label — many users have some degree of color vision difficulty, and low-end screens distort color.

### 5.2 Typography

- **Font pairing:** `Noto Sans Bengali` for Bangla script + `Inter` for Latin/numerals — both free, both render cleanly at small sizes on low-end screens.
- **Never go below 16px** for any readable text (body text on low-end phones under 16px causes real reading strain — this is a hard floor, not a suggestion).

| Style | Size | Weight | Usage |
|---|---|---|---|
| Display | 28px | 700 | Dashboard big numbers ("Today: ৳45,200") |
| H1 | 22px | 700 | Screen titles |
| H2 | 18px | 600 | Section headers |
| Body | 16px | 400 | All standard text |
| Body Bold | 16px | 600 | Emphasis, labels |
| Caption | 14px | 400 | Timestamps, helper text only — never for critical info |

### 5.3 Spacing Scale (4px base grid)
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` — pick from this scale only. Consistent spacing is what makes an interface feel calm; random spacing is what makes it feel amateurish.

### 5.4 Touch Targets
- **Minimum 44×44px**, **48×48px preferred** for anything in the POS module.
- Minimum **8px gap** between adjacent tappable elements — thumb mis-taps on a busy counter are a real, costly failure mode (wrong item added to a sale).

### 5.5 Buttons

| Type | Look | Usage | Example Label |
|---|---|---|---|
| Primary | Filled, `primary` color | One per screen, the main action | "Save Order" not "Submit" |
| Secondary | Outlined | Alternative action | "Save as Draft" |
| Destructive | Filled, `error` color | Delete/cancel actions | "Delete Product" |
| Ghost/Text | No fill | Low-emphasis actions | "Cancel" |

**Rule: buttons say what they do.** Never "Submit," "OK," or "Confirm" alone — always the verb + object: "Add to Cart," "Print Receipt," "Mark as Paid."

> **A note on the emoji used throughout this document:** symbols like 🛒 💬 🏬 📱 ✅ are used here purely as *shorthand for readability in this guideline*. They must **not** be implemented as literal emoji glyphs in the product. Emoji render inconsistently across Android manufacturers (Samsung, Xiaomi, Symphony, Walton, etc.) and OS versions — a common real fragmentation problem in the BD device market, sometimes falling back to broken boxes. Every symbol referenced in this document must be built as an actual SVG icon from the icon library defined in 5.7.

### 5.6 Grid & Responsive Breakpoints

| Breakpoint | Width | Layout Behavior |
|---|---|---|
| Mobile | 360px – 599px | Single column, bottom tab nav, full-width cards |
| Tablet | 600px – 1023px | Sidebar collapses to icon-only, 2-column content where useful |
| Desktop | 1024px+ | Full labeled sidebar, multi-column content, max content width **1280px** centered |

- Base grid: **4 columns** (mobile) / **8 columns** (tablet) / **12 columns** (desktop), **16px gutter**.
- Outer page padding: **16px** (mobile) / **24px** (tablet) / **32–48px** (desktop).
- **Design mobile-first, literally** — build the 360px layout before the 1024px one. Never design desktop-first and shrink down; details get lost that way, especially in POS and Order Entry.

### 5.7 Iconography

- **One icon library only** — pick a single open-source line-icon set (e.g., Phosphor or Lucide) and use nothing else. Mixing icon styles is one of the fastest ways to make an interface feel unfinished.
- **Stroke weight:** consistent 1.5–2px across every icon.
- **Style:** outline/line icons by default. A **filled variant is reserved exclusively for the "active/selected" state** (e.g., the current nav tab) — this becomes a learnable, consistent signal for "you are here."
- **Size scale:**

| Size | Usage |
|---|---|
| 16px | Inline with captions/timestamps |
| 20px | List rows, secondary buttons |
| 24px | Navigation, primary buttons |
| 32px+ | Empty states, feature/onboarding highlights |

- Icons in primary actions are **always paired with a text label** (see Section 13) — never icon-only for anything critical.

### 5.8 Corner Radius & Elevation

**Radius scale** — pick from these only:

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4px | Inputs, small buttons, chips |
| `radius-md` | 8px | Cards, primary buttons, modals-sheet on mobile |
| `radius-lg` | 12px | Desktop modals/dialogs |
| `radius-full` | 999px | Pills, badges, avatars |

**Elevation scale** — keep shadows subtle. Heavy skeuomorphic shadows render poorly (and slowly) on low-end GPUs, and read as dated:

| Level | Shadow | Usage |
|---|---|---|
| 0 | none | Page background, flat sections |
| 1 | `0 1px 2px rgba(0,0,0,0.06)` | Resting cards |
| 2 | `0 4px 6px rgba(0,0,0,0.10)` | Dropdowns, popovers |
| 3 | `0 10px 25px rgba(0,0,0,0.15)` | Modals, sheets |

Where possible, **prefer a 1px `neutral-300` border over a shadow** for cards in list-heavy screens (Orders, Products) — it's visually calmer, and cheaper to render on low-end devices at scroll.

### 5.9 Core Component Visual Specs

| Component | Spec |
|---|---|
| **Text Input** | 48px min height · 1px `neutral-300` border · `radius-sm` (4px) · 12–16px horizontal padding · focus = 2px `primary` ring + faint tint · placeholder text in `neutral-600` (not lighter — must stay legible in bright outdoor light) |
| **Card** | White surface · `radius-md` (8px) · 16px internal padding · Level 1 shadow or 1px border (see above) |
| **Table** (admin/reports, mostly desktop) | 48px row height · sticky header row · zebra striping (`neutral-100`) optional for 6+ rows · numeric/currency columns right-aligned, text columns left-aligned |
| **Badge / Chip** | Pill shape (`radius-full`) · 4–8px vertical / 12px horizontal padding · background = 10–15% tint of semantic color, text/icon = full-opacity same color — never a loud solid-fill badge |

### 5.10 Channel & Status Indicators

Replaces the emoji shorthand used elsewhere in this document with actual implementation specs:

| Channel | Icon | Chip Color |
|---|---|---|
| Website | Shopping-bag icon | `secondary` (blue) tint |
| Social Commerce | Chat-bubble icon | Violet/purple tint |
| POS | Storefront icon | `primary` (green) tint |

| Order Status | Chip Color |
|---|---|
| Pending | `warning` tint |
| Confirmed | `secondary` tint |
| Shipped | `secondary` solid-leaning tint |
| Delivered / Paid | `success` tint |
| Cancelled / Failed | `error` tint |

### 5.11 Imagery & Illustration Style

- **Product photos:** enforce a **1:1 square crop** on upload, consistent thumbnail size across every list and grid — never mix aspect ratios in the same view, it reads as chaotic. Auto-compress on upload (Section 11).
- **Empty-state & onboarding illustrations:** simple, flat, 2-color line illustrations using the brand palette (primary green + neutral) — no generic stock photography, and avoid an overly cartoonish/childish style. The product should feel **credible to an adult business owner**; "easy to use" is not the same as "looks like a kids' app."
- **Avatars:** default to initials-based colored circles (e.g., "RU" for Rahim Uddin) rather than a generic silhouette placeholder; photo upload is optional, never required.

### 5.12 Logo & Branding Placement

- Logo sits top-left of the sidebar/header at a consistent **40px height**, with minimum clear space equal to its own height on all sides.
- Never stretch, recolor, or distort the logo.
- Provide a square, icon-only variant of the logo for the collapsed sidebar (tablet) and mobile tab bar contexts.

### 5.13 Motion & Animation

- **Duration:** 150–200ms for micro-interactions (button press, toast, item-added-to-cart); 250ms max for full screen transitions.
- **Easing:** ease-out for elements entering the screen, ease-in for elements leaving.
- **Motion must communicate a state change, never decorate.** A product sliding into the cart confirms the tap registered; a spinning logo on load does not.
- Avoid parallax, bounce, or elaborate transition effects entirely — they stutter on low-RAM devices and add nothing for this user base.

---

## 6. Core Interaction Patterns

### 6.1 Forms
- **Only ask for what's needed right now.** Customer address can be added later — don't block order creation on it.
- **One column, always.** Never side-by-side fields on mobile; even on desktop, prefer single-column for anything staff fill under time pressure.
- **Smart defaults everywhere:** payment method defaults to the customer's last-used method; delivery area autofills from phone number history if the customer has ordered before.
- **Phone number is the universal key.** In BD, phone number is more reliable than name for identifying a returning customer. Every order/customer form leads with phone number, and typing a known number should instantly surface that customer's name/address for one-tap confirm.

### 6.2 Search
- Every list of more than 8 items gets a search bar at the top — pinned, not hidden behind an icon.
- Search should match partial phone numbers, partial names, and product names simultaneously — users don't know or care which field they're searching.

### 6.3 Confirmations & Undo
- Low-risk actions (edit quantity, change status): **no confirmation**, just an instant "Undo" toast for 5 seconds.
- High-risk actions (delete product, cancel paid order): **one plain-language confirmation dialog** — never a technical one.
  - Bad: "Are you sure you want to delete this record?"
  - Good: "Delete 'Red Saree - Size M'? This can't be undone."

### 6.4 Notifications & Toasts
- Appear at the same screen position every time (bottom-center on mobile, top-right on desktop)
- Auto-dismiss in 4–5 seconds, but always include a manual dismiss (✕)
- Never stack more than 2 at once — queue the rest

---

## 7. Module-Specific Guidelines

### 7.1 Social Commerce Order Entry Panel
*This is the highest-frequency, highest-pressure screen in the product. Optimize ruthlessly.*

**Design goal: enter an order in under 30 seconds while reading it off a phone screen in another app.**

```
┌───────────────────────────────────────┐
│  New Order                             │
│                                         │
│  📱 Phone Number  [ 018________ ]      │
│     → auto-shows matching customer     │
│       "Rahim Uddin — 3 past orders"    │
│                                         │
│  🛍️  Product     [ + Add Item ]        │
│     Red Saree ×1        ৳1,200         │
│                                         │
│  📍 Delivery Address (optional, can    │
│      add later)                        │
│                                         │
│  💳 Payment      [COD] Bkash Nagad     │
│                                         │
│  ┌───────────────────────────────┐    │
│  │      Save Order — ৳1,200       │    │
│  └───────────────────────────────┘    │
└───────────────────────────────────────┘
```

- **Product picker** must support type-ahead search AND a "recently sold" quick-grid — most orders are for a small set of popular items.
- **Autosave every field as typed** — if the app is interrupted (call comes in, app backgrounds), nothing is lost when staff returns.
- Once saved, the order enters the **Unified Order Inbox** tagged 💬 Social, identical in structure to a POS or website order — same statuses (Pending → Confirmed → Shipped → Delivered), so the owner tracks all channels the same way.
- **Do not** attempt full chat-parsing/AI-extraction as a required step in v1 — offer it as an optional "paste message" assist, but the manual fast-form must work perfectly on its own, since AI parsing will sometimes be wrong and staff need a reliable fallback.

### 7.2 Point of Sale (POS)

**Design goal: a completed cash sale in under 15 seconds, 4 taps or fewer.**

```
┌───────────────────────────────────────┐
│  Product Grid (large tiles, image+name)│
│  [Rice 5kg]  [Oil 1L]  [Soap]  [Egg]   │
│  [Sugar]     [Milk]    [Tea]   [Salt]  │
│                                         │
├───────────────────────────────────────┤
│  Cart (always visible)                 │
│   Rice 5kg  ×1        ৳650              │
│   Oil 1L    ×2        ৳380              │
│  ─────────────────────────             │
│   Total                ৳1,030           │
│                                         │
│   [ Cash ]  [ bKash ]  [ Card ]        │
│                                         │
│  ┌───────────────────────────────┐    │
│  │     Charge ৳1,030               │    │
│  └───────────────────────────────┘    │
└───────────────────────────────────────┘
```

- **Barcode scan support** where hardware allows, but the product grid must work equally well with zero scanner (many small shops won't have one).
- **Payment method selection is single-tap**, defaulting to Cash (the dominant method in BD retail).
- **Receipt sharing:** offer print (if printer connected), and always offer "Send via SMS/WhatsApp" — many small shops skip paper receipts entirely.
- **Offline-first is mandatory here.** A sale must be completable with zero internet, queued, and synced automatically when connection returns. A cashier should never see a spinning loader block a sale because of a dropped connection.
- **Undo-friendly:** removing an item from cart or voiding a sale (before payment) needs zero confirmation — speed over caution here, since nothing is committed until "Charge" is pressed.

### 7.3 eCommerce Admin

- **Product management and inventory are shared data** with POS and Social Commerce — one stock number, decremented from wherever the sale happens, to prevent overselling across channels. This is a backend requirement with a direct UX consequence: **always show which channels a product is enabled for**, with simple toggles (🛒 Website / 💬 Social / 🏬 POS).
- **Bulk actions** (price update, stock update, enable/disable) via checkbox-select + action bar — common SME need when updating seasonal pricing across many SKUs at once.
- **Image upload:** drag-and-drop with a big obvious drop zone; auto-compress on upload (many users will try to upload large phone-camera photos on slow connections).
- Order management here reuses the exact same Unified Order Inbox and status pattern as Section 7.1 — **do not build a separate "eCommerce orders" screen.**

---

## 8. Language, Numerals & Currency

- **Bilingual by default:** every label exists in both Bangla and English; a persistent, one-tap language toggle (🌐 বাং/EN) in the top bar, remembered per user login.
- **Currency:** always `৳` before the number (e.g., `৳1,200`), comma-separated thousands. Avoid decimals unless the amount actually has paisa — most day-to-day SME transactions are whole taka.
- **Numerals:** default to standard (0–9) digits even in Bangla mode, since most business/financial contexts in BD use standard numerals — never force Bangla numerals (১,২,৩) on prices, as this actively slows down reading for most users.
- **Dates:** `DD Mon YYYY` (e.g., "19 Aug 2026") — avoid ambiguous `08/19/2026` vs `19/08/2026` confusion entirely by never using all-numeric date formats in the UI.

---

## 9. Forms & Data Entry Rules

1. **Required fields are truly required** — if you marked it required, the business cannot function without it. Everything else is optional and deferrable.
2. **Numeric keypad by default** for phone, quantity, and price fields (not the full alphabet keyboard) — this alone meaningfully speeds up mobile data entry.
3. **Inline validation**, not modal popups — show the error directly under the field, in plain language, the moment it's clear it's wrong (e.g., after leaving the field), not while still typing.
4. **Never punish partial input.** If a phone number is 10 digits instead of 11, don't block saving — flag it gently and let staff proceed if they know it's correct (real-world data is messy).

---

## 10. Feedback, Errors & Empty States

- **Error messages are written for a shopkeeper, not a developer.** Never show error codes, stack traces, or technical terms.
  - Bad: `Error 500: Network request failed`
  - Good: "Couldn't save — check your internet and try again. Your order is saved as a draft so nothing is lost."
- **Empty states always have a next action**, never just blank space with text.
  - Example (no products yet): illustration + "You haven't added any products yet." + a prominent `[+ Add Your First Product]` button.
- **Loading states:** show a spinner/skeleton within 200ms of any wait; if a wait may exceed 2 seconds (e.g., report generation), show a progress indicator with a short reassuring label ("Getting your sales ready…").

---

## 11. Performance & Offline Behavior

- **Design for 3G, test on 3G.** Every screen's first meaningful content should appear within 2 seconds on a throttled connection.
- **POS and Order Entry must function offline**, queuing actions locally and syncing silently when connectivity returns — with a small, unobtrusive "Syncing…" / "All synced ✓" indicator, never a blocking screen.
- **Images lazy-load and are compressed** aggressively — product photos are the single biggest bandwidth cost in a system like this.
- **Avoid heavy animation.** Simple fades/slides (150–200ms) only — no elaborate transitions that stutter on low-RAM devices.

---

## 12. Onboarding & Learning

- **First-login checklist**, not a slideshow: "Add your first product," "Make your first sale," "Invite a staff member" — each with a one-tap deep link into the actual task, checked off as completed. People learn by doing, not by reading intro screens.
- **Contextual tooltips** (coach marks) on first encounter with a feature, dismissable, never shown twice.
- **Demo/sample data mode** so a new owner can explore the whole system (Dashboard, Orders, POS) with pre-filled sample data before risking their real inventory — removes the fear of "breaking something."
- **No manual required.** If a feature needs a help article to be understood, the feature is designed wrong — simplify it instead.

---

## 13. Accessibility & Inclusivity

- **Contrast ratio minimum 4.5:1** for all text (WCAG AA) — critical here since screens are often viewed outdoors in bright sunlight.
- **Never rely on color alone** for status — always pair with icon + text label (Section 5.1).
- **Icons are always labeled**, never icon-only for primary actions — icon literacy varies significantly across this user base.
- **Large, forgiving tap targets** (Section 5.4) also serve users with limited smartphone dexterity/experience, not just POS speed.
- **Works on small screens first.** Design and test at 360px width as the baseline, then scale up — do not design at desktop resolution and shrink down.

---

## 14. Do's and Don'ts Checklist

| ✅ Do | ❌ Don't |
|---|---|
| One primary button per screen | Multiple equally-weighted CTAs competing for attention |
| Autosave drafts continuously | Require a manual "save" before data is safe |
| Show recent/frequent items first | Force users to search/type from scratch every time |
| Use plain-language confirmations | Use technical or vague confirmation dialogs |
| Keep navigation to 5 items | Nest features 4+ levels deep |
| Pair every icon with a text label | Ship icon-only buttons for primary actions |
| Default to the most common choice (Cash, COD) | Make users choose from a long list for the common case |
| Test every screen on a real low-end Android phone | Design only on a large monitor and assume it translates down |
| Keep body text at 16px minimum | Shrink text to fit more on screen |
| Let users undo | Make every action a scary, irreversible decision |

---

## 15. Appendix: Condensed Rule Block (for LLM System Prompts)

Paste this block into any LLM instruction set used to generate or review UI for this product:

```
When designing or generating any screen for this ERP system, you must follow these rules without exception:

1. Every screen has exactly one primary action, visually dominant over all others.
2. Navigation has a maximum of 5 top-level items; no menu nests more than 3 levels deep.
3. Body text is never smaller than 16px. Headings follow the type scale in Section 5.2.
4. Use only the color tokens defined in Section 5.1 — no ad hoc colors.
5. Use only the 4px spacing scale (4/8/12/16/24/32/48/64) — no arbitrary spacing values.
6. All tappable elements are at least 44x44px (48x48px in POS screens), with 8px minimum gap.
7. Buttons are labeled with a verb + object ("Save Order"), never generic labels ("Submit", "OK").
8. Only phone number + core item(s) are required to save an order. All other fields are optional
   and can be added later.
9. Forms are single-column. Numeric fields trigger a numeric keypad.
10. Every destructive action requires one plain-language confirmation naming exactly what will
    be deleted/cancelled. Non-destructive actions (edits, quantity changes) get instant "Undo"
    toasts instead of confirmation dialogs.
11. Every list of 8+ items has a visible (not hidden) search bar.
12. Every empty state includes a clear next action button, never just blank space.
13. Error messages are written in plain language for a small business owner — no error codes,
    no technical jargon, always suggest what to do next.
14. All UI must render correctly at 360px width first; this is the primary target, not a
    fallback.
15. POS and Order Entry screens must remain usable with no internet connection, queuing actions
    for sync with a non-blocking sync indicator.
16. Every screen supports both Bangla and English via a persistent toggle; never hardcode
    English-only or Bangla-only text.
17. Currency is always shown as ৳ + comma-separated amount; numerals stay in standard (0-9)
    form even in Bangla mode.
18. All orders — regardless of source (Website, Social Commerce, POS) — appear in one Unified
    Order Inbox with consistent statuses and a small channel badge (🛒/💬/🏬).
19. Before finalizing any screen, apply the Grade 5 Test: could a Class 5 student or a new
    staff member complete this task in under 30 seconds with zero instructions?
20. When any rule in this list conflicts with visual polish, this rule wins.
21. Use only one icon library throughout the product (Section 5.7); never mix icon styles, and
    never implement functional icons as native emoji glyphs — build them as SVG icons instead.
22. Use only the defined radius scale (4/8/12px, full for pills) and elevation scale (Section
    5.8) — no arbitrary border-radius or box-shadow values.
23. Design and build the 360px-wide mobile layout first for every screen, then adapt up to
    tablet/desktop — never design desktop-first and shrink down.
24. Product images are always cropped to 1:1 square with consistent thumbnail sizing across all
    lists and grids; never mix aspect ratios in the same view.
25. Animations are limited to 150–250ms, ease-out on enter / ease-in on exit, and must always
    signal a state change — never purely decorative motion.
```

---

*End of document. This guideline should be treated as living — update Section 5 (tokens) in one place if values ever change, and every screen in the product inherits the update automatically in principle, if not in code.*