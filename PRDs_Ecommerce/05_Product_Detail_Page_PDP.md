# PRD 05: Product Detail Page (PDP)

## 1. Document Overview & Objectives
The Product Detail Page (PDP) is the core decision engine of the storefront. It must answer all buyer questions—specifications, sizing, authenticity, delivery timeline, pricing, and stock availability—on a single screen without requiring external research or multi-tab switching.

---

## 2. Layout & Key Features

### 2.1 Media Gallery & Image Zoom
- **Aspect Ratio**: 1:1 or 4:5 ratio with background `#FFFDF8`.
- **Thumbnails**: Carousel list below/left of main product view.
- **Interactions**: Pinch-to-zoom on mobile, hover magnifying zoom on desktop.
- **Variation Image Fallback**: Displays selected variation image -> base product primary image -> default placeholder.

### 2.2 Product Overview & Variation Selection
- **Title**: H1 typography e.g., `"প্রিমিয়াম ওমরাহ সফর কিট (অল-ইন-ওয়ান)"`.
- **Rating Summary**: Star rating + total reviews link e.g., `★★★★☆ ৪.৭ (১২৮টি রিভিউ)`.
- **Price Block**:
  - Selling Price: 26px Bold `#1A1A1A` e.g. `৳৩,৪৫০`.
  - Regular Price Strikethrough: 18px `#5B5650` e.g. `<del>৳৪,০০০</del>`.
  - Discount Savings Badge: `#B8860B` fill pill e.g. `৳৫৫০ ছাড় (১৪% Off)`.
- **Variant Selectors**:
  - Size Options: Interactive 48px radio pills (`[ M ]`, `[ L ]`, `[ XL ]`).
  - Color Options: Color swatches + text label (`[● সাদা]`, `[● কালো]`).
  - Disabled State: Crossed out for out-of-stock variations.
- **Stock Indicator**:
  - In Stock: `✅ স্টকে আছে — ২৪-৪৮ ঘণ্টার মধ্যে শিপিং` (`#16A34A`).
  - Low Stock: `⚠️ মাত্র ৩টি বাকি আছে!` (`#B45309`).
  - Out of Stock: `❌ স্টক শেষ — স্টক এলে নোটিফাই করুন` (`#B3261E`).

### 2.3 Add to Cart & Buy Now Action Block
- **Desktop**:
  - Quantity Stepper: `[ - ] 1 [ + ]` (48×48px touch target).
  - Primary CTA Button: `[ 🛒 কার্টে যোগ করুন ]` (`#1F5D42` fill).
  - Secondary Accent Button: `[ ⚡ এখনই কিনুন ]` (`#B8860B` fill).
  - Wishlist Toggle: Heart icon button (`#DDD6C7` outline / filled red when saved).
- **Mobile Sticky Bottom Action Bar**:
  - Appears automatically when scrolling past the main buy panel.
  - Contains Price display + `[ কার্টে যোগ করুন ]` primary button.

### 2.4 Product Specifications & Tabs
1. **বিবরণ (Description)**: Rich text description, material composition, care instructions.
2. **ডেলিভারি ও রিটার্ন (Shipping & Returns)**: Estimated delivery charge (Inside Dhaka ৳70, Outside Dhaka ৳130), return policy (7-day replacement warranty).
3. **রিভিউ (Reviews & Ratings)**: Rating breakdown bar (5-star to 1-star counts), user review list with photo thumbnails.
4. **প্রশ্ন ও উত্তর (Q&A)**: Customer questions with store owner responses.

---

## 3. Backend API Specifications

### 3.1 Fetch Product Details
- **Endpoint**: `GET /api/v1/products/{slug}`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": 88,
    "name": "প্রিমিয়াম ওমরাহ সফর কিট (অল-ইন-ওয়ান)",
    "slug": "premium-umrah-travel-kit",
    "description": "<p>ওমরাহ পালনের জন্য প্রয়োজনীয় সকল সামগ্রী একসাথে।</p>",
    "retail_price": 3450.00,
    "regular_price": 4000.00,
    "in_stock": true,
    "stock_quantity": 15,
    "primary_image_url": "https://cdn.hajjmart.com/products/kit-main.jpg",
    "gallery_images": [
      "https://cdn.hajjmart.com/products/kit-1.jpg",
      "https://cdn.hajjmart.com/products/kit-2.jpg"
    ],
    "has_variations": true,
    "variations": [
      {
        "id": 201,
        "sku": "KIT-M",
        "retail_price": 3450.00,
        "regular_price": 4000.00,
        "stock_quantity": 5,
        "attribute_values": {
          "Size": "M",
          "Color": "White"
        },
        "image_url": "https://cdn.hajjmart.com/products/kit-m.jpg"
      }
    ],
    "rating_summary": {
      "average": 4.7,
      "total_reviews": 128
    }
  }
}
```

---

## 4. Acceptance Criteria & Verification
- [ ] Selecting a variation updates the displayed price, SKU, stock quantity, and gallery primary image instantly.
- [ ] Clicking " Add to Cart" without selecting required variants highlights the variation selector with a prompt e.g. `"অনুগ্রহ করে সাইজ নির্বাচন করুন"`.
- [ ] Sticky bottom action bar remains functional on mobile across entire scroll depth.
- [ ] Product images support pinch-to-zoom on touch devices.
