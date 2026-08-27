# PRD 04: Product Listing & Catalog Browsing (PLP)

## 1. Document Overview & Objectives
The Product Listing Page (PLP) allows shoppers to browse, filter, sort, and compare products efficiently. The design goal is to enable shoppers to locate their desired item and reach a buying decision within 20 seconds.

---

## 2. UI/UX Layout & Component Specifications

### 2.1 Layout Breakdown
- **Mobile (<600px)**:
  - 2-Column Product Card Grid.
  - Sticky Filter & Sort Action Bar at bottom or top of grid: `[ 🌪️ ফিল্টার (২) ]` `[ ⇅ সাজান ]`.
  - Filter panel slides in from bottom as a Bottom Sheet with 48px touch controls.
- **Desktop (1024px+)**:
  - Left Sidebar (Width 280px): Persistent filter panel.
  - Right Grid: 3 or 4-Column Product Cards. Max width 1280px.

### 2.2 Product Card Component
- **Image Aspect Ratio**: Fixed 1:1 square image canvas with uniform border `1px #DDD6C7`.
- **Badge**: Top-left over image. Options: `ইন স্টক` (`#16A34A`), `মাত্র ৩টি বাকি` (`#B45309`), `২০% ছাড়` (`#B8860B`).
- **Product Title**: 2 lines maximum, 18px Bold, ellipsis truncation (`...`).
- **Star Rating**: Yellow star icon + rating score (e.g. `★ ৪.৮ (২৫)`).
- **Price Block**:
  - Current Selling Price: 18px Bold `#1A1A1A` (e.g. `৳১,৯৫০`).
  - Original Struck-through Price: 16px `#5B5650` (e.g. `<del>৳২,৪০০</del>`).
- **Action Button**:
  - Mobile: Persistent `[ + কার্ট ]` primary green button (`#1F5D42`).
  - Desktop: Quick "কার্টে যোগ করুন" hover reveal or persistent button.

### 2.3 Filtering Controls
- **Categories Tree**: Expandable checkbox list.
- **Price Range Slider & Inputs**: Min Price to Max Price input fields (in ৳).
- **Stock Availability**: Checkbox `শুধুমাত্র স্টকে থাকা পণ্য`.
- **Attribute Filters**: Size (e.g. S, M, L, XL), Color swatches, Material (e.g. Pure Cotton, Synthetic).
- **Active Filter Chips Bar**: Rendered above product grid as removable pills with an `✕` icon (e.g. `[ সাইজ: L ✕ ]`, `[ মূল্য: ৳১০০০-৳৩০০০ ✕ ]`, `[ সব মুছুন ]`).

### 2.4 Sorting Options
- `relevance` (প্রাসঙ্গিকতা অনুযায়ী)
- `price_asc` (কম দাম থেকে বেশি)
- `price_desc` (বেশি দাম থেকে কম)
- `newest` (নতুন পণ্য আগে)
- `rating` (সর্বোচ্চ রেটিং)

---

## 3. Backend API Specifications

### 3.1 Fetch Products Listing
- **Endpoint**: `GET /api/v1/products` or `GET /api/v1/categories/{slug}/products`
- **Query Parameters**:
  - `page` (integer, default: 1)
  - `per_page` (integer, default: 20)
  - `sort` (string: `price_asc`, `price_desc`, `newest`, `rating`)
  - `min_price` (numeric)
  - `max_price` (numeric)
  - `in_stock` (boolean)
  - `attributes` (array/json of attribute value IDs)
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 45,
        "name": "প্রিমিয়াম সুতি ইহরাম বেল্ট (এডজাস্টেবল)",
        "slug": "premium-ihram-belt",
        "retail_price": 450.00,
        "regular_price": 600.00,
        "primary_image_url": "https://cdn.hajjmart.com/products/belt.jpg",
        "rating_avg": 4.9,
        "reviews_count": 18,
        "in_stock": true,
        "stock_quantity": 12,
        "has_variations": false
      }
    ],
    "pagination": {
      "total": 142,
      "per_page": 20,
      "current_page": 1,
      "last_page": 8
    },
    "available_filters": {
      "min_price": 100,
      "max_price": 5000,
      "sizes": ["S", "M", "L", "XL", "Free Size"],
      "colors": ["White", "Black", "Green"]
    }
  }
}
```

---

## 4. Acceptance Criteria & Verification
- [ ] Applying any filter updates the product grid in-place without losing page scroll position.
- [ ] Active filters are displayed as removable chips above the product grid.
- [ ] Returning to PLP via browser back button restores previous scroll position, page number, and selected filter state.
- [ ] Out of stock items display an explicit `স্টক শেষ` tag and disable direct add-to-cart buttons.
