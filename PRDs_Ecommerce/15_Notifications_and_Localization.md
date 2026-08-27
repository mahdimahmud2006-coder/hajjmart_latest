# PRD 15: Localization, Notifications & Toast Feedback System

## 1. Document Overview & Objectives
This PRD establishes the default language rules, currency and date formatting, in-app notification center, and non-intrusive toast alert feedback system. Everyday plain Bengali is the default language across every screen for every user, with standard digits `0-9` and `৳` currency formatting.

---

## 2. Localization & Formatting Rules

### 2.1 Language & Text Conventions
- **Default Language**: **Bengali (বাংলা) on first load for ALL users on ALL screens.**
- **Language Switcher**: Persistent header/footer toggle (`[ বাংলা / English ]`). Remembers preference per device (`localStorage`).
- **Tone**: Plain, conversational, everyday Bengali (how an attentive shopkeeper speaks out loud) e.g., `"আপনার কার্ট ফাঁকা রয়েছে"` instead of formal machine translations like `"আপনার ক্রয়কৃত ঝুড়ি শূন্য"`.

### 2.2 Numerals, Currency & Date Formats
- **Numerals**: Standard `0-9` digits across ALL numbers (Prices, Quantities, Order IDs, Phone Numbers). E.g. `৳২,৪৫০` or `৳2,450`.
- **Currency Symbol**: `৳` placed BEFORE the number, with comma separation e.g. `৳১,৯৫০`.
- **Date Format**: Unambiguous written format e.g. `২৪ আগস্ট ২০২৬` / `24 Aug 2026`. Never numeric slash dates like `08/24/2026`.

---

## 3. Notification Center & Toast Feedback

### 3.1 Toast Notification Specs
- **Position**: Bottom-center on Mobile, Top-right on Desktop.
- **Duration**: Auto-dismiss after 4-5 seconds. Manual dismiss `✕` button included.
- **Max Stacking**: Maximum 2 toasts visible simultaneously.
- **Toast Types**:
  - **Success (`#16A34A`)**: Product added to cart (includes thumbnail preview + subtotal), wishlist item saved.
  - **Error (`#B3261E`)**: Out of stock, invalid coupon code, payment gateway failure.
  - **Info / Undo (`#1A1A1A`)**: Item removed from cart with 5-second `[ পূর্বাবস্থায় ফেরান ]` button.

### 3.2 In-App Account Notifications (`/notifications`)
- Header Bell Icon + Unread Badge Count.
- Displays transactional updates:
  - 🚚 `"আপনার অর্ডার #HM-2026-88401 পাঠাও কুরিয়ারে হস্তান্তরিত হয়েছে।"`
  - 🏷️ `"আপনার পছন্দের পণ্যটি এখন ১৫% ছাড়ে পাওয়া যাচ্ছে!"`

---

## 4. Backend API Specifications

### 4.1 In-App Notifications Endpoint (`GET /api/v1/notifications`)
- **Headers**: `Authorization: Bearer {token}`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "notif_99182",
      "title": "অর্ডার শিপমেন্ট আপডেট",
      "body": "আপনার অর্ডার HM-2026-88401 গন্তব্যের উদ্দেশ্যে রওনা হয়েছে।",
      "read": false,
      "link": "/track-order?order_number=HM-2026-88401",
      "created_at": "2026-08-27T13:40:00Z"
    }
  ]
}
```

### 4.2 Mark Notification as Read (`PUT /api/v1/notifications/{id}/read`)
- **Headers**: `Authorization: Bearer {token}`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "message": "নোটিফিকেশন পঠিত হিসেবে চিহ্নিত করা হয়েছে।"
}
```

---

## 5. Acceptance Criteria & Verification
- [ ] Bengali is the active default language on first load across all public and checkout routes.
- [ ] Prices display the `৳` symbol with comma formatting and standard numerals e.g. `৳২,৯৫০`.
- [ ] Toast notifications dismiss automatically after 4 seconds and do not block primary call-to-action buttons.
- [ ] Switching language from Bengali to English updates interface labels without clearing the user's cart or active checkout session.
