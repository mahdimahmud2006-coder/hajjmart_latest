# Endpoint database coverage

The API is MySQL-backed. The migration set creates storage for every stateful endpoint group currently registered in `routes/api.php`.

| Endpoint group | Main MySQL tables |
|---|---|
| Authentication, profile, sessions | `users`, `personal_access_tokens`, `sessions` |
| Addresses and wishlist | `user_addresses`, `wishlists` |
| Homepage, categories, products, search | `homepage_sections`, `categories`, `category_product`, `products`, `product_images`, `product_variants`, `variations`, `inventory` |
| Cart and checkout | `products`, `product_variants`, `inventory`, `delivery_charges`, `site_settings` |
| Orders and cancellations | `orders`, `order_items`, `order_status_histories`, `order_item_status_histories`, `cancellation_requests`, `reserved_products` |
| Payments and Stripe callbacks | `payments`, `payment_cod_details`, `stripe_ids`, `orders` |
| Coupons and promotions | `coupons`, `coupon_applications`, `coupon_usages` |
| Reviews, questions, answers | `product_reviews`, `review_images`, `product_questions`, `product_answers` |
| Notifications | `notifications` |
| Inventory and direct batches | `inventory`, `product_batches`, `stock_movements` |
| Returns and refunds | `return_requests`, `return_request_items`, `return_status_histories`, `payments` |
| Stores, employees, roles | `shops`, `users`, `roles`, `permissions`, `role_user`, `permission_role` |
| Transactions and activity | `business_transactions`, `activity_logs` |
| Stock transfers | `stock_transfers`, `stock_transfer_items`, `inventory`, `stock_movements` |
| Reports and dashboard | Aggregate reads across orders, payments, inventory, products, returns, promotions, transactions, and `daily_sales_summaries` |
| Contact and delivery settings | `contact_messages`, `delivery_charges`, `site_settings` |
| Queue and cache workers | `jobs`, `job_batches`, `failed_jobs`, `cache`, `cache_locks` |

Run the automated coverage assertion with:

```bash
cd Backend
php artisan test --filter=DatabaseSchemaCoverageTest
```
