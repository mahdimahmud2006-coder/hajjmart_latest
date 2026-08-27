# PRD 10: Customer Account, Profile & Authentication

## 1. Document Overview & Objectives
This PRD specifies customer authentication (Laravel Sanctum API tokens), profile management, address book, and order history. Returning customers must be able to view past purchases and complete repeat orders ("Buy Again") in under 60 seconds.

---

## 2. Authentication & Account Sections

### 2.1 Customer Authentication Modals / Pages
- **Registration (`/auth/register`)**: Full Name, Mobile Number / Email, Password, Terms acceptance.
- **Login (`/auth/login`)**: Mobile Number / Email + Password. Includes `"পাসওয়ার্ড ভুলে গেছেন?"` link.
- **Password Reset (`/auth/forgot-password`)**: Sends SMS OTP or Email reset link.

### 2.2 Customer Account Dashboard (`/profile`)
- **Profile Summary Header**: User Name, Phone Number, Primary Shipping District, Account Creation Date.
- **Navigation Tabs / Menu**:
  1. 📦 **আমার অর্ডারসমূহ (Order History)**: List of active and completed orders with status chips.
  2. 📍 **ঠিকানা বই (Address Book)**: Saved delivery addresses (Default Shipping, Secondary).
  3. ❤️ **পছন্দের তালিকা (Wishlist)**: Saved products.
  4. ⚙️ **প্রোফাইল এডিট (Profile Settings)**: Edit Name, Phone, Password.

### 2.3 Order History & "Buy Again" One-Tap Action
- Displays order card with Order Number, Date, Status Chip e.g. `ডেলিভারি সম্পন্ন` (`#16A34A`), total price.
- **Order Details Modal / Page**: Lists purchased items, delivery address, invoice download.
- **"Buy Again" (`পুনরায় অর্ডার করুন`) Button**: Adds all items from that previous order directly into the current cart with 1 click and navigates directly to Checkout.

---

## 3. Backend API Specifications

### 3.1 Customer Login Endpoint (`POST /api/v1/auth/login`)
- **Payload Schema**:
```json
{
  "email_or_phone": "01711000111",
  "password": "Password123!"
}
```
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "message": "লগইন সফল হয়েছে।",
  "data": {
    "token": "14|sanctum_token_string_here",
    "user": {
      "id": 52,
      "name": "রহিম আহমেদ",
      "email": "rahim@example.com",
      "phone": "01711000111"
    }
  }
}
```

### 3.2 Customer Address Management (`GET / POST / PUT / DELETE /api/v1/addresses`)
- **Headers**: `Authorization: Bearer {token}`
- **Payload Schema (Create/Update)**:
```json
{
  "title": "বাসা",
  "recipient_name": "রহিম আহমেদ",
  "phone": "01711000111",
  "district": "Dhaka",
  "thana": "Dhanmondi",
  "address_line": "হাউজ ১২, রোড ৫",
  "is_default": true
}
```

### 3.3 Customer Order History (`GET /api/v1/orders`)
- **Headers**: `Authorization: Bearer {token}`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "order_number": "HM-2026-88401",
      "grand_total": 3020.00,
      "order_status": "delivered",
      "created_at": "2026-08-15T10:00:00Z",
      "items": [
        {
          "product_id": 88,
          "name": "প্রিমিয়াম ওমরাহ সফর কিট",
          "quantity": 1,
          "unit_price": 3450.00,
          "image": "https://cdn.hajjmart.com/products/kit-main.jpg"
        }
      ]
    }
  ]
}
```

---

## 4. Acceptance Criteria & Verification
- [ ] Authentication tokens persist across page refreshes using secure HTTP/Sanctum cookies or client storage.
- [ ] Clicking "Buy Again" on a previous order populates the cart and redirects to checkout in under 2 seconds.
- [ ] Saved addresses automatically pre-fill shipping fields during checkout.
