# PRD 11: Wishlist & Saved Items

## 1. Document Overview & Objectives
The Wishlist feature enables shoppers to save items for future consideration. It supports guest local storage wishlist saving and authenticated backend sync so shoppers never lose saved items when transitioning from guest browsing to account creation.

---

## 2. Layout & UI Component Specifications

### 2.1 Wishlist Toggle Button Component
- **Icon**: Heart icon (`♡` unfilled outline when unsaved / `♥` filled red `#B3261E` when saved).
- **Locations**: Over top-right of Product Cards (PLP/Homepage), next to "Add to Cart" button (PDP).
- **Interaction**: Single-tap toggle. Triggers brief 150ms scale micro-animation and toast alert e.g., `"পণ্যটি পছন্দের তালিকায় যোগ করা হয়েছে।"`.

### 2.2 Wishlist Page (`/wishlist`)
- Grid of saved product cards.
- **Card Actions**:
  - `[ 🛒 কার্টে সরান ]` -> Moves item from Wishlist directly to active shopping Cart.
  - `[ 🗑️ মুছুন ]` -> Removes item from Wishlist.
- **Empty State**: Icon illustration + `"আপনার পছন্দের তালিকা ফাঁকা রয়েছে"` + `[ কেনাকাটা শুরু করুন ]` primary green button.

---

## 3. Backend API Specifications

### 3.1 Fetch Wishlist Items Endpoint (`GET /api/v1/wishlist`)
- **Headers**: `Authorization: Bearer {token}`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "product_id": 88,
      "name": "প্রিমিয়াম ওমরাহ সফর কিট (অল-ইন-ওয়ান)",
      "slug": "premium-umrah-travel-kit",
      "price": 3450.00,
      "regular_price": 4000.00,
      "primary_image_url": "https://cdn.hajjmart.com/products/kit-main.jpg",
      "in_stock": true
    }
  ]
}
```

### 3.2 Add to Wishlist Endpoint (`POST /api/v1/wishlist/{productId}`)
- **Headers**: `Authorization: Bearer {token}`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "message": "পণ্যটি পছন্দের তালিকায় যোগ করা হয়েছে।"
}
```

### 3.3 Remove from Wishlist Endpoint (`DELETE /api/v1/wishlist/{productId}`)
- **Headers**: `Authorization: Bearer {token}`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "message": "পণ্যটি পছন্দের তালিকা থেকে সরানো হয়েছে।"
}
```

---

## 4. Acceptance Criteria & Verification
- [ ] Wishlist heart icon reflects current saved status in real time across PLP, PDP, and search dropdowns.
- [ ] Clicking "Move to Cart" transfers the product to the cart and removes it from the wishlist grid.
- [ ] Guest wishlist items automatically sync to account when the guest user registers or logs in.
