# PRD 13: Coupons, Promotions & Discounts Engine

## 1. Document Overview & Objectives
This PRD defines the customer-facing coupon code application, promotional banners, free shipping threshold notifications, and discount calculation rules. Coupons and discounts must provide immediate feedback in the UI without causing confusion or surprise total changes.

---

## 2. Discount Types & User Touchpoints

### 2.1 Discount Types Supported
1. **Fixed Amount Discount**: Flat savings e.g. `৳৫০০ ছাড়` on total bill.
2. **Percentage Discount**: Percentage savings e.g. `১৫% ছাড়` up to maximum cap `৳১,০০০`.
3. **Free Shipping Promotion**: Waives delivery charges when order subtotal exceeds minimum threshold e.g., `"৳৩,০০০ টাকার বেশি অর্ডারে ফ্রি ডেলিভারি!"`.

### 2.2 UI Touchpoints & Feedback
- **Header Promo Announcement Bar**: Top bar e.g. `🎉 কুপন কোড HAJJ2026 ব্যবহারে ৫০০ টাকা ছাড়! [কপি কোড]`.
- **Cart & Checkout Coupon Input**: Text box + `[ প্রয়োগ করুন ]` primary button.
- **Applied Coupon Chip**: Green badge with discount value e.g. `[ HAJJ2026 (-৳৫০০) ✕ ]`.
- **Free Shipping Progress Tracker Bar (Cart Page)**:
  - Displays remaining amount needed e.g., `"ফ্রি ডেলিভারি পেতে আরও ৳৫৫০ টাকার কেনাকাটা করুন"`.
  - Full progress indicator when threshold reached: `🎉 অভিনন্দন! আপনি ফ্রি ডেলিভারি পাচ্ছেন।`

---

## 3. Backend API Specifications

### 3.1 Public Promotions Endpoint (`GET /api/v1/promotions`)
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "code": "HAJJ2026",
      "description": "হজ্জ সিজন স্পেশাল ৫০০ টাকা ছাড়",
      "discount_type": "fixed",
      "discount_value": 500.00,
      "min_spend": 2500.00,
      "expires_at": "2026-09-30T23:59:59Z"
    }
  ]
}
```

### 3.2 Coupon Validation Endpoint (`POST /api/v1/coupons/validate`)
- **Payload Schema**:
```json
{
  "coupon_code": "HAJJ2026",
  "subtotal": 3450.00,
  "items": [
    {
      "product_id": 88,
      "quantity": 1
    }
  ]
}
```
- **Success Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "coupon_code": "HAJJ2026",
    "discount_type": "fixed",
    "discount_amount": 500.00,
    "message": "কুপন কোড সফলভাবে প্রয়োগ করা হয়েছে।"
  }
}
```
- **Failure Response Structure (`422 Unprocessable Entity`)**:
```json
{
  "success": false,
  "message": "কুপন কোডটি ব্যবহারের জন্য ন্যূনতম ৳২,৫০০ টাকার কেনাকাটা প্রয়োজন।",
  "data": {
    "valid": false,
    "reason_code": "MIN_SPEND_NOT_MET"
  }
}
```

---

## 4. Acceptance Criteria & Verification
- [ ] Valid coupons update the cart subtotal, discount line, and grand total in real time.
- [ ] Invalid or expired coupons output plain Bengali explanations stating why the coupon failed.
- [ ] Removing an applied coupon chip restores the original full price instantly.
