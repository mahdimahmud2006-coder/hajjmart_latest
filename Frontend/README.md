# HajjMart Frontend — Direct Product Batch Lifecycle

This Next.js admin frontend uses a direct product-batch workflow. Product masters are created without stock. An authorised inventory user selects one or more active products or variations, enters cost price, selling price and quantity, reviews the complete batch, and explicitly confirms it before stock changes.

## Main workflow

1. Create the product master from **Admin → Products**.
2. Open **Admin → Inventory & product batches**.
3. Select the receiving store and products/variations.
4. Enter cost price, selling price and quantity for each line.
5. Review totals and confirm the batch.
6. The confirmed batch updates prices, inventory, product sellability and batch history.

The former sourcing screens and report links are not part of this frontend.

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set the API base URL according to `.env.example`. The admin client expects the Laravel `/api/v1/admin` endpoints.

## Relevant endpoint

- `GET /api/v1/admin/inventory/batches`
- `POST /api/v1/admin/inventory/batches`

The POST request must include `confirmed: true`, a receiving `shop_id`, and one or more item lines containing `product_id`, optional `variant_id`, `cost_price`, `selling_price`, and `quantity`.
