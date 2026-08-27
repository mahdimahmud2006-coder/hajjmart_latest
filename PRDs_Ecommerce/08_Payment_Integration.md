# PRD 08: Payment Integration & Gateway Callbacks

## 1. Document Overview & Objectives
This PRD outlines payment gateway integrations for Hajjmart: SSLCommerz (Mobile Banking like bKash, Nagad, Rocket, local Visa/Mastercard), Stripe (International Credit/Debit Cards), and Cash on Delivery (COD). The checkout UI must provide clear payment steps, fee transparency, and security reassure signals.

---

## 2. Payment Method Options & UI Presentation

| Payment Option | Label (Bengali) | Supported Gateways / Channels | Trust Reassurance Badge |
|---|---|---|---|
| **Cash on Delivery** | ক্যাশ অন ডেলিভারি (ক্যাশ হ্যান্ডওভার) | Physical Cash upon receiving parcel | 🛡️ পণ্য দেখে বুঝে নিয়ে পেমেন্ট করুন |
| **Mobile Banking / Local Cards** | বিকাশ / নগদ / রকেট / ব্যাংক কার্ড | SSLCommerz Gateway Integration | 🔒 SSLCommerz সিকিউর্ড পেমেন্ট |
| **International Card** | আন্তর্জাতিক ক্রেডিট / ডেবিট কার্ড | Stripe Payment Gateway | 🔒 256-Bit SSL Encrypted |

---

## 3. Workflow & Technical Callbacks

### 3.1 SSLCommerz Payment Flow
1. Customer selects **"বিকাশ / নগদ / কার্ড"** and clicks `[ অর্ডার ও পেমেন্ট করুন ]`.
2. System calls backend initiate endpoint `GET /api/v1/payments/{order_id}/initiate?gateway=sslcommerz`.
3. Backend registers payment request with SSLCommerz and returns gateway redirect URL.
4. Browser redirects user to SSLCommerz hosted portal.
5. Upon payment completion, SSLCommerz redirects to backend callback endpoints:
   - `POST /api/v1/payments/sslcommerz/success` -> Verifies hash transaction, marks order `paid`, redirects frontend to `/checkout/success?order={order_number}`.
   - `POST /api/v1/payments/sslcommerz/fail` -> Marks transaction `failed`, redirects frontend to `/checkout/payment-failed?order={order_number}` with retry option.
   - `POST /api/v1/payments/sslcommerz/cancel` -> Restores cart, redirects frontend to `/cart`.

### 3.2 Stripe Payment Flow
1. Customer inputs card details via Stripe Elements iframe inside checkout.
2. Payment intent confirmed on client via Stripe JS SDK.
3. Stripe Webhook (`POST /api/stripe/webhook`) updates backend DB order payment status to `paid`.

---

## 4. Backend API Specifications

### 4.1 Payment Initiate Endpoint (`GET /api/v1/payments/{order_id}/initiate`)
- **Headers**: `Authorization: Bearer {token}`
- **Query Parameters**: `gateway=sslcommerz` or `gateway=stripe`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "payment_id": 402,
    "gateway": "sslcommerz",
    "redirect_url": "https://sandbox.sslcommerz.com/gwprocess/v4/api.php?Q=ssl_token_12345",
    "amount": 3020.00,
    "currency": "BDT"
  }
}
```

### 4.2 Payment Status Check Endpoint (`GET /api/v1/payments/{order_id}/status`)
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "order_number": "HM-2026-88401",
    "payment_status": "paid",
    "gateway_transaction_id": "SSL_TXN_9918231",
    "amount_paid": 3020.00,
    "paid_at": "2026-08-27T13:48:10Z"
  }
}
```

---

## 5. Acceptance Criteria & Verification
- [ ] Payment gateway errors display plain Bengali messages e.g., `"পেমেন্ট সম্পন্ন হয়নি। অনুগ্রহ করে আপনার কার্ডের তথ্য রি-চেক করুন।"`.
- [ ] Payment timeouts or cancelled transactions restore the shopping cart intact.
- [ ] Successful payments redirect within 2 seconds to the Order Confirmation page and trigger an order confirmation SMS/Email.
