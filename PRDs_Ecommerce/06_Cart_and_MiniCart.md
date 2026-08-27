# PRD 06: Cart & Mini-Cart Interface

## 1. Document Overview & Objectives
The Cart interface gives shoppers a complete breakdown of items selected, prices, applied discounts, and estimated shipping fees before checkout begins. Zero surprise fees are permitted. Low-risk cart edits (quantity changes, item deletions) must provide instant updates with undo capabilities.

---

## 2. Layout & Feature Specifications

### 2.1 Mini-Cart Drawer (Slide-In)
- **Trigger**: Tap on Cart Icon in Header or Mobile Bottom Tab.
- **Behavior**: Slides in from right (desktop) or bottom (mobile) with `elevation-3` overlay.
- **Header**: `"আপনার কার্ট (২টি পণ্য)"` + Close button (`✕`).
- **Line Item Row**:
  - 64×64px thumbnail image.
  - Product Name (truncated 1 line) + Selected Variation (e.g. `সাইজ: L`).
  - Quantity Stepper `[ - ] 1 [ + ]` (48×48px targets).
  - Line Total Price (e.g. `৳১,৯৫০`).
  - Remove Action Link (`🗑️ মুছে ফেলুন` or `✕`).
- **Footer**:
  - Subtotal Amount.
  - Delivery Note: `"শিপিং খরচ চেকআউটে হিসাব করা হবে"`.
  - Primary CTA: `[ চেকআউট করুন — ৳৩,৯০০ ]` (`#1F5D42`).
  - Secondary CTA: `[ কার্ট দেখুন ]` (`#FFFDF8` outline).

### 2.2 Full Cart Page (`/cart`)
- Single-column layout on mobile, 2-column on desktop (Left: Items list, Right: Order Summary sticky box).
- **Line Item Actions**:
  - Quantity Stepper (+ / -).
  - Save for Later (`পছন্দের তালিকায় রাখুন`).
  - Item Removal -> Triggers **5-Second Toast Undo Notice** e.g., `"পণ্যটি কার্ট থেকে সরানো হয়েছে। [পূর্বাবস্থায় ফেরান]"`.
- **Order Summary Card**:
  - Subtotal: `৳৩,৯০০`
  - Coupon Code Input Box + `[ প্রয়োগ করুন ]` button.
  - Applied Coupon Discount: `-৳৫০০` (Green text `#16A34A`).
  - Estimated Delivery Charge (dhaka/outside dhaka selector): `৳৭০`.
  - Estimated Total: `৳৩,৪৭০` (18px Bold `#1A1A1A`).
  - Primary CTA: `[ অর্ডার সম্পন্নের দিকে যান ]`.

### 2.3 Guest & User Cart Persistence
- **Guest Users**: Cart items stored in `localStorage` keyed by `product_id` and `variant_id`.
- **Logged-in Users**: Synchronized with backend DB table `customer_cart_items`.
- **Login Merge Flow**: Upon user login, guest local items automatically merge with server cart items using `PUT /api/v1/cart` (`mode: merge`).

---

## 3. Backend API Specifications

### 3.1 Synchronize Cart (`PUT /api/v1/cart`)
- **Headers**: `Authorization: Bearer {token}`
- **Payload Schema**:
```json
{
  "mode": "merge",
  "items": [
    {
      "product_id": 88,
      "variant_id": 201,
      "quantity": 2
    }
  ]
}
```

### 3.2 Validate Cart & Calculate Totals (`POST /api/v1/cart/validate`)
- **Payload Schema**:
```json
{
  "items": [
    {
      "product_id": 88,
      "variant_id": 201,
      "quantity": 2
    }
  ],
  "coupon_code": "HAJJ2026",
  "district": "Dhaka"
}
```
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "product_id": 88,
        "variant_id": 201,
        "name": "প্রিমিয়াম ওমরাহ সফর কিট",
        "quantity": 2,
        "unit_price": 3450.00,
        "line_subtotal": 6900.00,
        "discount_amount": 500.00,
        "line_total": 6400.00,
        "available_stock": 15
      }
    ],
    "quote": {
      "subtotal": 6900.00,
      "discount_total": 500.00,
      "shipping_total": 70.00,
      "grand_total": 6470.00,
      "currency": "BDT"
    }
  }
}
```
- **Inventory Stock Conflict (`409 Conflict`)**:
```json
{
  "success": false,
  "message": "পছন্দকৃত পণ্যের স্টক অপর্যাপ্ত। (লভ্য: ১টি)",
  "error_code": "INSUFFICIENT_STOCK"
}
```

---

## 4. Acceptance Criteria & Verification
- [ ] Quantity changes automatically re-calculate line totals and summary totals in real time.
- [ ] Removing an item triggers a 5-second undo toast; clicking "Undo" restores the item at its previous quantity.
- [ ] Logging in merges guest local cart items into the user's saved account cart without dropping items.
- [ ] Out-of-stock cart items display an error message and prevent proceeding to checkout until quantity is updated.
