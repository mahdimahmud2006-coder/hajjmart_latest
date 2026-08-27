# PRD 12: Product Reviews, Ratings & Q&A

## 1. Document Overview & Objectives
Social proof and verified buyer ratings reduce customer uncertainty. This PRD covers product reviews, customer photo uploads, star rating distributions, verified purchaser badges, and the public Question & Answer (Q&A) tab on the PDP.

---

## 2. Layout & UI Specifications

### 2.1 Ratings & Review Summary Box (PDP)
- **Average Rating Score**: Big numeric score e.g., `4.8` out of 5 stars + star graphics.
- **Rating Distribution Bar Chart**: Percentage progress bars for 5★, 4★, 3★, 2★, 1★.
- **Verified Buyer Tag**: `✅ সত্যতা যাচাইকৃত ক্রেতা` badge on review cards.
- **Review Content**: Customer reviewer name, date, rating stars, comment text in Bengali e.g., `"কাপড়ের মান অত্যন্ত ভালো এবং ইহরামের সাইজ পারফেক্ট। খুব দ্রুত ডেলিভারি পেয়েছি।"`.
- **Customer Photo Thumbnails**: Image gallery grid attached to reviews with lightbox view support.

### 2.2 Submit Review Form Modal
- Rating selector (1 to 5 stars selection).
- Comment text area (Minimum 10 characters).
- Optional Customer Photo Upload (Max 3 images, JPEG/PNG up to 5MB each).
- Works for authenticated buyers or guest order numbers.

### 2.3 Product Q&A Tab
- Customer Question Input: `"পণ্য সম্পর্কে কোনো প্রশ্ন আছে? এখানে লিখুন..."`
- Answer Display: Store Owner / Hajjmart Support Answer with official badge e.g. `[ 🏬 হাজ্জমার্ট সাপোর্ট: জি, এটি ১০০% সুতি কাপড়। ]`.

---

## 3. Backend API Specifications

### 3.1 Fetch Product Reviews (`GET /api/v1/products/{product_id}/reviews`)
- **Query Parameters**: `page=1&per_page=10`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "average_rating": 4.8,
      "total_reviews": 42,
      "distribution": {
        "5_star": 35,
        "4_star": 5,
        "3_star": 2,
        "2_star": 0,
        "1_star": 0
      }
    },
    "reviews": [
      {
        "id": 102,
        "customer_name": "আব্দুল্লাহ আল-মামুন",
        "rating": 5,
        "is_verified_buyer": true,
        "comment": "মাশাল্লাহ, ইহরামের বেল্টটি খুবই মজবুত ও সুবিধাজনক।",
        "created_at": "2026-08-20T14:30:00Z",
        "images": [
          "https://cdn.hajjmart.com/reviews/rev1.jpg"
        ]
      }
    ]
  }
}
```

### 3.2 Submit Review Endpoint (`POST /api/v1/reviews`)
- **Payload Schema**:
```json
{
  "product_id": 88,
  "rating": 5,
  "comment": "অত্যন্ত চমৎকার ও আরামদায়ক সুতি কাপড়।",
  "order_number": "HM-2026-88401",
  "images": ["data:image/jpeg;base64,..."]
}
```

### 3.3 Ask Product Question (`POST /api/v1/products/{product_id}/questions`)
- **Payload Schema**:
```json
{
  "question": "এই ইহরাম কাপড়ের সাথে কি বেল্ট ফ্রি দেওয়া হয়?"
}
```

---

## 4. Acceptance Criteria & Verification
- [ ] Reviews display verified purchaser badge when linked to a completed order.
- [ ] Reviews are moderated via admin before appearing publicly if configured by backend setting.
- [ ] Review image thumbnails open a full-screen lightbox modal on click.
