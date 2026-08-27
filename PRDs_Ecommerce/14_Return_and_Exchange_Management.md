# PRD 14: Customer Return & Exchange Management

## 1. Document Overview & Objectives
This PRD outlines customer self-service return and exchange request submission, reason code selection, status tracking, and backend return workflow integration. Customers must feel confident that purchases are risk-free and backed by an easy 7-day return/exchange process.

---

## 2. Customer Return Workflow & UI Layout

### 2.1 Return/Exchange Request Initiation
- Located inside **Order History (`/orders/{order_number}`)** for delivered orders within the 7-day policy window.
- Action Button: `[ 🔄 রিটার্ন বা এক্সচেঞ্জ আবেদন করুন ]`.

### 2.2 Return Submission Form Step-by-Step
1. **পণ্য নির্বাচন (Item Selection)**: Select specific order line items and quantities to return.
2. **রিটার্নের কারণ (Reason Selection)**: Radio list options:
   - 📏 সাইজ মানানসই নয় (Incorrect Size)
   - 📦 ভুল পণ্য পাওয়া গেছে (Received Wrong Product)
   - ⚠️ ত্রুটিপূর্ণ বা ক্ষতিগ্রস্ত পণ্য (Damaged / Defective Product)
   - 💭 পছন্দ পরিবর্তন (Changed Mind)
3. **টাইপ নির্বাচন (Request Type)**:
   - `রিফান্ড (Refund)` -> Return item and receive refund to Original Payment / Mobile Banking.
   - `এক্সচেঞ্জ (Exchange)` -> Swap item for different size or variation.
4. **ছবি আপলোড (Photo Proof)**: Required for damaged/wrong item claims (Up to 3 photos).
5. **ব্যাখ্যা (Notes)**: Optional comments box.

### 2.3 Return Request Status Timeline (`/profile/returns`)
- Displays Return Case ID e.g. `RET-2026-041`.
- Status Progression Chips:
  1. ⏳ **আবেদন জমা হয়েছে (Request Submitted)**
  2. 🔍 **যাচাই চলছে (Under Review)**
  3. 📦 **পণ্য পিকআপের জন্য অনুমোদিত (Approved for Pickup)**
  4. 📥 **পণ্য ওয়ারহাউসে গৃহীত (Item Received in Warehouse)**
  5. ✅ **রিফান্ড সম্পন্ন (Refund Completed)** / 🔄 **নতুন পণ্য প্রেরিত (Replacement Shipped)**

---

## 3. Backend API Specifications

### 3.1 Submit Return Request Endpoint (`POST /api/v1/orders/{orderNumber}/return-exchange`)
- **Headers**: `Authorization: Bearer {token}`
- **Payload Schema**:
```json
{
  "request_type": "refund",
  "reason": "damaged_product",
  "notes": "প্যাকেট খোলার পর কাপড়ে দাগ দেখা গেছে।",
  "refund_method": "bkash",
  "refund_account_number": "01711000111",
  "items": [
    {
      "order_item_id": 402,
      "quantity": 1
    }
  ],
  "photos": [
    "data:image/jpeg;base64,..."
  ]
}
```
- **Response Structure (`201 Created`)**:
```json
{
  "success": true,
  "message": "রিটার্ন আবেদনটি সফলভাবে জমা হয়েছে। ৪৮ ঘণ্টার মধ্যে আপডেট জানানো হবে।",
  "data": {
    "return_request_id": "RET-2026-041",
    "status": "pending",
    "created_at": "2026-08-27T13:50:00Z"
  }
}
```

### 3.2 Customer Return List Endpoint (`GET /api/v1/return-requests`)
- **Headers**: `Authorization: Bearer {token}`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 41,
      "return_number": "RET-2026-041",
      "order_number": "HM-2026-88401",
      "request_type": "refund",
      "status": "approved",
      "created_at": "2026-08-27T13:50:00Z"
    }
  ]
}
```

---

## 4. Acceptance Criteria & Verification
- [ ] Delivered orders older than 7 days disable the "Return Request" button with an explanatory note e.g. `"৭ দিনের রিটার্ন সময়সীমা পার হয়েছে"`.
- [ ] Submitting a return request triggers an immediate confirmation notification to the customer.
- [ ] Customers can view real-time return status progression from their account dashboard.
