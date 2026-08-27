# PRD 01: Core UI/UX Design System & Tokens

## 1. Document Overview & Objectives
This Product Requirement Document defines the foundational visual language, layout grid, typography scale, color tokens, and interaction primitives for the Hajjmart E-Commerce storefront. The goal is to enforce the **"Three-Click Trust Test"**: establishing absolute customer confidence through high-contrast legibility, immediate clarity, zero visual clutter, and mobile-first design.

---

## 2. Design System Architecture & Tokens

### 2.1 Color Tokens
All surfaces, text, buttons, and state indicators MUST strictly use the hex tokens defined below. No arbitrary or inline colors are permitted.

| Token Key | Hex Code | Purpose & Usage Guidelines | Contrast & Legibility Rules |
|---|---|---|---|
| `bg-base` | `#FBF8F1` | Primary Page Background (Warm Ivory) | Used across all page containers. Ensures a calm, non-glare canvas. |
| `bg-surface` | `#FFFDF8` | Card / Panel Surface (Off-White) | Elevated 1 shade above base for distinct cards without hard contrast clashes. |
| `primary` | `#1F5D42` | Deep Green Fill | Primary CTAs ("অর্ডার সম্পন্ন করুন", "কার্টে যোগ করুন"), active nav tabs, primary link highlights. |
| `primary-hover` | `#164A34` | Hover / Pressed Deep Green | Active state for primary buttons. |
| `primary-tint` | `#E4EFE8` | Soft Pale Green Tint (10-15%) | Status chips, active filter pills, selected table row highlights. NEVER behind body text. |
| `gold` | `#B8860B` | Muted Matte Gold Accent | Decorative borders, "featured" ribbons, star icons. NEVER primary CTA fill. |
| `gold-tint` | `#F5EEDD` | Light Gold Background | Highlighted promo cards or special badges. |
| `success` | `#16A34A` | Forest Green Success | "In Stock", payment completed, order confirmed badges with text/icon. |
| `warning` | `#B45309` | Amber / Warning | Low stock alerts ("মাত্র ৩টি অবশিষ্ট"), processing status. |
| `error` | `#B3261E` | Crimson Error | Validation failures, out-of-stock badges, payment errors. |
| `neutral-900` | `#1A1A1A` | Near-Black Primary Text | Primary typography color. Provides crisp legibility without harsh black clipping. |
| `neutral-600` | `#5B5650` | Warm Slate Secondary Text | Subtitles, metadata, timestamps. |
| `neutral-300` | `#DDD6C7` | Warm Light Border Tone | Input borders, card dividers, subtle container outlines. |
| `neutral-100` | `#F1ECE0` | Neutral Muted Fill | Disabled buttons, skeleton loaders, subtle hover states. |

### 2.2 Typography System
- **Bengali Default Font**: Noto Sans Bengali / Hind Siliguri (Humanist sans-serif with high x-height).
- **Latin / Numeral Font**: Inter / Noto Sans.
- **Strict Rule**: No decorative, script, or calligraphic typefaces inside the app.
- **Baseline Floor**: 18px body baseline floor. Text size NEVER drops below 16px under any circumstances.

| Style Class | Size (px) | Weight | Line Height | Application |
|---|---|---|---|---|
| `display` | 32px | 700 (Bold) | 1.2 | Hero campaign headlines, landing highlights |
| `h1` | 26px | 700 (Bold) | 1.3 | Main page headers ("আপনার কার্ট", "পণ্য তালিকা") |
| `h2` | 20px | 700 (Bold) | 1.4 | Section titles, PDP product name |
| `body` | 18px | 400 (Regular) | 1.5 | General descriptions, shipping notes, policies |
| `body-bold` | 18px | 700 (Bold) | 1.5 | Product prices, form field labels, key specifications |
| `caption` | 16px | 400 (Regular) | 1.4 | Auxiliary metadata, timestamps, secondary disclaimers |

### 2.3 Spacing Grid & Touch Target Rules
- **Base Grid Unit**: 4px.
- **Allowed Spacing Steps**: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`, `96px`.
- **Minimum Touch Target**: 44×44px minimum. **48×48px preferred** for cart quantity steppers, primary CTAs, and size swatches.
- **Minimum Target Gap**: 8px between adjacent interactive elements.

### 2.4 Buttons & CTA Hierarchy
1. **Primary CTA**: Filled `primary` (`#1F5D42`), text white, `radius-md` (8px). Used ONCE per screen key view (e.g., "কার্টে যোগ করুন" on PDP, "অর্ডার করুন - ৳২,৪৫০" on Checkout).
2. **Secondary CTA**: Outlined 1.5px `primary`, text `primary`, background transparent. Used for secondary choices ("পছন্দের তালিকায় রাখুন").
3. **Urgency / Accent CTA**: Muted fill `gold` (`#B8860B`) or `gold-tint` with near-black text. Used for immediate "এখনই কিনুন" or stock notification requests.
4. **Destructive CTA**: Outlined `error` (`#B3261E`), text `error`. Used for item removal or order cancellation.

### 2.5 Elevation & Corner Radius Scale
- `radius-sm` (4px): Inputs, badges, small buttons.
- `radius-md` (8px): Product cards, primary CTAs, bottom sheets.
- `radius-lg` (12px): Desktop modals, cart drawer containers.
- `radius-full` (999px): Pills, percentage badges, status tags.
- `elevation-0`: Flat surface, transparent.
- `elevation-1`: `0 1px 2px rgba(0,0,0,0.06)` (Product cards resting).
- `elevation-2`: `0 4px 6px rgba(0,0,0,0.10)` (Dropdowns, sticky header).
- `elevation-3`: `0 10px 25px rgba(0,0,0,0.15)` (Modals, cart drawer).

---

## 3. Responsive Layout Grid Specs

| Breakpoint | Target Screen Width | Priority | Column Count | Gutter Width | Sidebar / Container |
|---|---|---|---|---|---|
| **Mobile** | 360px – 599px | **Primary (Mandatory)** | 4 Columns | 16px | Single Column Stack, Fixed Bottom Tab Bar |
| **Tablet** | 600px – 1023px | Secondary | 8 Columns | 20px | 2-Column Product Grid, Slide-in Drawer Filters |
| **Desktop** | 1024px+ | Secondary | 12 Columns | 24px | Max width 1280px Centered, Persistent Sidebar |

---

## 4. Backend & System Integration Rules
- Theme and token configurations are baked into CSS custom properties (`:root`).
- System settings like default currency format (`৳`), decimal precision, and brand defaults are fetched from `GET /api/v1/homepage` or cached site settings.

---

## 5. Acceptance Criteria & Trust Checklist
- [ ] Page background strictly renders `#FBF8F1` (Ivory).
- [ ] All primary text renders in `#1A1A1A` on `#FBF8F1` or `#FFFDF8` with contrast ratio > 7:1.
- [ ] No font size on any screen is smaller than 16px.
- [ ] All interactive buttons pass the 48px thumb test on 360px viewport.
- [ ] Mobile navigation and shopping workflows function without horizontal overflow.
