# PRD 02: Header, Navigation & Search Interface

## 1. Document Overview & Objectives
This PRD specifies the top header, mobile navigation tab bar, category browsing menu, and search interface. The navigation architecture ensures that no product is more than 3 taps away, and the search bar remains permanently accessible on all viewports.

---

## 2. UI/UX & Layout Requirements

### 2.1 Desktop Top Header (1024px+)
- **Fixed Height**: 72px, background `#FFFDF8`, bottom border 1px `#DDD6C7`.
- **Left**: Hajjmart Logo (linked to `/`).
- **Center**: Prominent Search Bar (min-width 480px) with live autocomplete results popover.
- **Right**:
  - Language Toggle (`বাং` / `EN` pill switch).
  - Track Order link ("অর্ডার ট্র্যাকিং").
  - Wishlist Icon + Live Item Badge Count.
  - Cart Icon + Live Item Count Badge (triggers Mini-Cart Drawer).
  - Account Dropdown ("আমার অ্যাকাউন্ট" / Login trigger).

### 2.2 Mobile Navigation & Tab Bar (<600px)
- **Top Sticky Bar (Height 56px)**: Brand Logo + Language Switcher + Category Menu Hamburger Trigger.
- **Top Search Bar**: Embedded directly below sticky header or pinned in viewport, visible on every scroll position.
- **Bottom Fixed Navigation Bar (Height 60px)**:
  - Background `#FFFDF8` with 1px top border `#DDD6C7` and `elevation-2`.
  - 4 Fixed Touch Anchors (48×48px target minimum):
    1. 🏠 **হোম (Home)** -> `/`
    2. 🔍 **খুঁজুন (Search)** -> Triggers instant search overlay/focus.
    3. 🛒 **কার্ট (Cart)** -> Opens Cart Drawer with live numeric item count badge (`bg: #1F5D42`, text: white).
    4. 👤 **অ্যাকাউন্ট (Account)** -> `/profile` or Login Modal.

### 2.3 Category Navigation & Mega-Menu
- Drawer slide-out on mobile / hover dropdown on desktop.
- Maximum 3 levels of category depth: Primary Category -> Subcategory -> Product Type.
- Shows total category product counts and visual icon/thumbnail.

### 2.4 Live Autocomplete Search Bar
- **Input Placeholder**: `"হজ্জ ও ওমরাহ সামগ্রী, আতর, জায়নামাজ খুঁজুন..."`
- **Features**: Typo tolerance, partial match, debounced input (250ms delay).
- **Search Overlay Dropdown**:
  - Displays top 5 matching product suggestions with thumbnail image, name, price, and stock status.
  - Displays matching categories.
  - Displays recent search terms history (stored locally).

---

## 3. Backend API Specifications

### 3.1 Search Endpoint
- **Endpoint**: `GET /api/v1/search`
- **Query Parameters**:
  - `q` (string, required): Search query term (e.g., `q=ihram`).
  - `category_id` (integer, optional): Filter search by category.
  - `limit` (integer, default: 10): Results limit.
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "message": "Search results retrieved.",
  "data": {
    "products": [
      {
        "id": 14,
        "name": "প্রিমিয়াম সুতি ইহরাম কাপড়ে ২ খণ্ড",
        "slug": "premium-cotton-ihram-fabric",
        "price": 1850.00,
        "regular_price": 2200.00,
        "primary_image_url": "https://cdn.hajjmart.com/products/ihram-1.jpg",
        "in_stock": true
      }
    ],
    "categories": [
      {
        "id": 3,
        "name": "ইহরাম কাপড়",
        "slug": "ihram-fabric"
      }
    ]
  }
}
```

### 3.2 Navigation Categories Endpoint
- **Endpoint**: `GET /api/v1/categories`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "হজ্জ সামগ্রী",
      "slug": "hajj-essentials",
      "image_url": "https://cdn.hajjmart.com/cat/hajj.png",
      "children": [
        {
          "id": 5,
          "name": "ইহরাম সেট",
          "slug": "ihram-sets"
        }
      ]
    }
  ]
}
```

---

## 4. Acceptance Criteria & Verification
- [ ] Search input is visible and focused without extra taps on mobile search mode.
- [ ] Mobile bottom tab bar remains sticky across all scroll actions.
- [ ] Cart badge updates instantaneously when items are added/removed.
- [ ] Language toggle switches UI text between Bengali (default) and English seamlessly without losing cart/session state.
