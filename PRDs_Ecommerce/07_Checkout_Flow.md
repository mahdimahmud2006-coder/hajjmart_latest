# PRD 07: Checkout Flow

## 1. Document Overview & Objectives
The Checkout flow turns shopper intent into confirmed orders. It enforces the "Three-Click Trust Test": zero hidden fees, guest checkout equal in prominence to login, single-column forms with Pathao location autocomplete, inline validation, and server-authoritative price verification.

---

## 2. UI/UX Structure & Principles

### 2.1 Navigation & Safety Mode
- Global header navigation links and category menus are hidden/minimized to prevent accidental exit during checkout.
- Only "◀ কার্টে ফিরে যান" and security reassurance badges are visible in the header.

### 2.2 Layout Structure
- **Single Column Form (Left Side)**:
  1. **গ্রাহকের তথ্য (Customer Details)**: Full Name, Phone Number e.g. `01712345678`, Email Address (optional for guest).
  2. **ডেলিভারি ঠিকানা (Shipping Address)**: District selection (Dhaka, Chittagong, etc. powering Pathao delivery rules), Thana/Upazila lookup dropdown, Detailed Street Address.
  3. **পেমেন্ট পদ্ধতি (Payment Selection)**: Radio list for Cash on Delivery (COD), SSLCommerz (Mobile Banking / Cards), Stripe.
- **Order Summary Sidebar (Right Side on Desktop / Top Drawer on Mobile)**:
  - Item list preview (thumbnails, variant labels, quantities).
  - Subtotal, Shipping Fee, Coupon Discount, Tax breakdown.
  - Final Grand Total displayed prominently e.g. `মোট দেয়: ৳৩,৪৭০`.
  - Primary Submission Button e.g. `[ অর্ডার নিশ্চিত করুন — ৳৩,৪৭০ ]`.

### 2.3 Guest Checkout & Saved Address Integration
- Guest Checkout is available by default without requiring password setup.
- Logged-in users have saved delivery addresses pre-selected with a "নতুন ঠিকানা যোগ করুন" option.

---

## 3. Backend API Specifications

### 3.1 Checkout Quoting Endpoint (`POST /api/v1/checkout/quote`)
- **Payload Schema**:
```json
{
  "items": [
    {
      "product_id": 88,
      "variant_id": 201,
      "quantity": 1
    }
  ],
  "district": "Dhaka",
  "thana": "Dhanmondi",
  "coupon_code": "HAJJ2026",
  "payment_method": "cod"
}
```
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "allocation_token": "alloc_tok_991823ab817c",
    "allocated_shop_id": 1,
    "is_provisional": false,
    "currency": "BDT",
    "subtotal": 3450.00,
    "delivery": 70.00,
    "discount": 500.00,
    "grand_total": 3020.00,
    "coupon_applied": true,
    "coupon_message": "কুপন কোড সঠিকভাবে প্রয়োগ করা হয়েছে।"
  }
}
```

### 3.2 Place Guest Order Endpoint (`POST /api/v1/checkout/place-order`)
- **Payload Schema**:
```json
{
  "customer_name": "রহিম আহমেদ",
  "mobile_number": "01711000111",
  "email": "rahim@example.com",
  "district": "Dhaka",
  "thana": "Dhanmondi",
  "shipping_address": "হাউজ ১২, রোড ৫, ধানমন্ডি, ঢাকা",
  "payment_method": "cod",
  "allocation_token": "alloc_tok_991823ab817c",
  "items": [
    {
      "product_id": 88,
      "variant_id": 201,
      "quantity": 1
    }
  ],
  "coupon_code": "HAJJ2026"
}
```
- **Response Structure (`201 Created`)**:
```json
{
  "success": true,
  "message": "অর্ডার সফলভাবে গ্রহণ করা হয়েছে!",
  "data": {
    "order_number": "HM-2026-88401",
    "grand_total": 3020.00,
    "payment_method": "cod",
    "payment_status": "pending",
    "delivery_status": "processing",
    "created_at": "2026-08-27T13:45:00Z"
  }
}
```

---

## 4. Acceptance Criteria & Verification
- [ ] Browser autofill fills Name, Phone, and Address fields without format rejection.
- [ ] Checkout prices are calculated strictly on the backend; client-supplied unit prices are ignored.
- [ ] Entering an invalid phone number flags an inline error e.g. `"সঠিক ১১ ডিজিটের মোবাইল নম্বর লিখুন"`.
- [ ] Interruptions or page refreshes retain entered address and form state locally without data loss.
