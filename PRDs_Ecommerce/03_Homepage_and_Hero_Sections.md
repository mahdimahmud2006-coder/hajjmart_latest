# PRD 03: Homepage & Hero Sections

## 1. Document Overview & Objectives
The Homepage serves as the primary landing hub and brand reassurance experience for first-time visitors. It must establish instant credibility, highlight core product lines (Hajj & Umrah essentials, Islamic lifestyle products), and provide rapid 1-click access to featured categories, current promotions, and top-selling items.

---

## 2. Layout & UI/UX Structure

### 2.1 Hero Banner Carousel / Showcase
- **Background**: `#FBF8F1` with subtle warm ivory container background.
- **Content**: Plain, high-contrast headline text (`neutral-900` `#1A1A1A` on light canvas). **NO dark green/gold full-bleed background fills behind text body.**
- **CTA Button**: Primary deep green button (`#1F5D42`) with clear text e.g., `"এখনই ব্রাউজ করুন"` or `"অফার দেখুন"`.
- **Image**: Clean, high-resolution product shot with 1:1 or 16:9 aspect ratio.

### 2.2 Reassurance & Trust Signals Bar
Placed directly beneath the Hero section:
1. 🚚 **দ্রুত হোম ডেলিভারি** (Fast Home Delivery across Bangladesh via Pathao)
2. 🛡️ **১০০% আসল পণ্য** (100% Genuine Quality Products)
3. 💵 **ক্যাশ অন ডেলিভারি** (Cash on Delivery Available)
4. 🔄 **সহজ রিটার্ন সুবিধা** (Easy 7-day Return Policy)

### 2.3 Featured Category Grid
- Responsive 4-column layout on mobile (2x2 grid), 6-column on desktop.
- Displays category thumbnail image, category name in 18px Bold Bengali, and item counts.

### 2.4 Dynamic Merchandising Sections
Configured dynamically via backend admin panel:
- **হট ডিলস (Flash Sales / Limited Offers)**: Product cards featuring strikethrough original prices, percentage savings badge e.g. `২০% ছাড়`, and countdown/stock urgency indicators.
- **সর্বোচ্চ বিক্রিত পণ্য (Best Selling Products)**: Top 8 best-sellers with quick "কার্টে যোগ করুন" buttons.
- **নতুন কালেকশন (New Arrivals)**: Newly cataloged products.
- **গ্রাহক রিভিউ ও শরিয়াহ ট্রাস্ট (Customer Testimonials & Trust)**: Verified buyer ratings, star distributions, and customer photo feedback.

---

## 3. Backend API Specifications

### 3.1 Homepage Configuration Endpoint
- **Endpoint**: `GET /api/v1/homepage`
- **Response Structure (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "sections": [
      {
        "id": 1,
        "title": "হিরো ব্যানার",
        "type": "hero_slider",
        "order": 1,
        "content": {
          "slides": [
            {
              "headline": "হজ্জ ও ওমরাহ ২০২৩-এর প্রয়োজনীয় সামগ্রী",
              "subheadline": "সেরা মানের ইহরাম, বেল্ট ও আরামদায়ক জুতা",
              "cta_text": "অফার দেখুন",
              "cta_link": "/categories/hajj-essentials",
              "image_url": "https://cdn.hajjmart.com/banners/hero1.jpg"
            }
          ]
        }
      },
      {
        "id": 2,
        "title": "জনপ্রিয় ক্যাটাগরি",
        "type": "featured_categories",
        "order": 2,
        "content": {
          "category_ids": [1, 3, 5, 8]
        }
      },
      {
        "id": 3,
        "title": "সর্বোচ্চ বিক্রিত পণ্য",
        "type": "product_grid",
        "order": 3,
        "content": {
          "products": [
            {
              "id": 10,
              "name": "সুতি ইহরাম টাওয়েল সেটিং",
              "slug": "cotton-ihram-towel",
              "retail_price": 1950.00,
              "regular_price": 2400.00,
              "rating_avg": 4.8,
              "rating_count": 54,
              "primary_image_url": "https://cdn.hajjmart.com/products/ihram.jpg",
              "in_stock": true
            }
          ]
        }
      }
    ]
  }
}
```

---

## 4. Acceptance Criteria & Trust Verification
- [ ] First Meaningful Paint (FMP) loads in under 2 seconds on 4G connections.
- [ ] Layout renders correctly on 360px viewport without dynamic height jumps or horizontal scrollbars.
- [ ] Every product card displays product title, image, price, discount amount, rating, and stock badge.
- [ ] Clicking any banner or category card navigates directly to the targeted product list page within 1 click.
