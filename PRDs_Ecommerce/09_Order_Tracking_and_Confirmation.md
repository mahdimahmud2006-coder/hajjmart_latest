# PRD 09: Order Tracking & Confirmation Interface

## 1. Document Overview & Objectives
This PRD covers the Order Confirmation success screen, printable/downloadable invoice view, and public self-service Order Tracker. The post-purchase flow must reassure shoppers that their order is recorded, clearly show shipping timelines, and allow instant tracking via mobile number or order ID.

---

## 2. Layout & UI Specifications

### 2.1 Order Confirmation Screen (`/checkout/success`)
- **Header**: Confetti graphics + Green Success Checkmark icon (`#16A34A`).
- **Main Heading**: `"আপনার অর্ডার সফলভাবে সম্পন্ন হয়েছে!"`
- **Subheading**: `"অর্ডার নম্বর: HM-2026-88401 | আনুমানিক ডেলিভারি: ২৮-২৯ আগস্ট"`
- **Order Summary Details Box**:
  - Item list, variation details, price breakdown.
  - Delivery address, selected payment method (e.g. `ক্যাশ অন ডেলিভারি`).
- **Primary Actions**:
  - `[ 🚚 অর্ডার ট্র্যাক করুন ]` -> Links to tracking page.
  - `[ 📄 রসিদ / ইনভয়েস ডাউনলোড ]` -> Triggers printable PDF view.
  - `[ 🛒 আরও কেনাকাটা করুন ]` -> Returns to Homepage.

### 2.2 Public Self-Service Order Tracker (`/track-order`)
- **Accessibility**: Available on main header navigation for guests and logged-in users alike.
- **Search Form**:
  - Input Field 1: Order ID (e.g. `HM-2026-88401`).
  - Input Field 2: Mobile Number (e.g. `01711000111`).
  - Action Button: `[ ট্র্যাক করুন ]` (`#1F5D42`).
- **Visual Progress Timeline**:
  1. 📝 **অর্ডার গৃহীত** (Order Placed - Timestamp)
  2. 📦 **প্রসেসিং চলছে** (Processing / Packing)
  3. 🚚 **পাঠাও কুরিয়ারে হস্তান্তরিত** (Handed over to Pathao Courier - Tracking Code: `PTH-881923`)
  4. 🏡 **ডেলিভারির জন্য বের হয়েছে** (Out for Delivery)
  5. ✅ **ডেলিভারি সম্পন্ন** (Delivered)

---

## 3. Backend API Specifications

### 3.1 Order Status Endpoint (`GET /api/v1/checkout/status/{orderNumber}`)
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "order_number": "HM-2026-88401",
    "customer_name": "রহিম আহমেদ",
    "mobile_number": "01711000111",
    "order_status": "processing",
    "payment_status": "pending",
    "payment_method": "cod",
    "grand_total": 3020.00,
    "items_count": 2,
    "created_at": "2026-08-27T13:45:00Z",
    "estimated_delivery_date": "2026-08-29"
  }
}
```

### 3.2 Public Track Order Endpoint (`GET /api/v1/track-order`)
- **Query Parameters**: `order_number=HM-2026-88401&mobile_number=01711000111`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "order_number": "HM-2026-88401",
    "status": "shipped",
    "courier_name": "Pathao Courier",
    "consignment_id": "PTH-881923",
    "tracking_url": "https://pathao.com/courier/tracking?consignment_id=PTH-881923",
    "timeline": [
      {
        "status": "placed",
        "title": "অর্ডার কনফার্মড",
        "timestamp": "2026-08-27 13:45:00",
        "completed": true
      },
      {
        "status": "shipped",
        "title": "কুরিয়ারে পিকআপ সম্পন্ন",
        "timestamp": "2026-08-27 16:30:00",
        "completed": true
      },
      {
        "status": "delivered",
        "title": "ডেলিভারি সম্পন্ন",
        "timestamp": null,
        "completed": false
      }
    ]
  }
}
```

---

## 4. Acceptance Criteria & Verification
- [ ] Order tracker accepts valid order number + phone number pair without demanding login credentials.
- [ ] Live Pathao courier tracking link redirects directly to Pathao's official tracking status portal.
- [ ] Invoice download generates a clean, printable PDF format containing store contacts, item list, VAT/tax details, and total amount paid.
