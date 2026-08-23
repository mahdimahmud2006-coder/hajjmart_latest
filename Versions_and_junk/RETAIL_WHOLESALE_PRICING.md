# Retail / wholesale pricing implementation

## User workflow

1. Go to **Admin → Inventory → Add product batch**.
2. Choose the product/SKU/variation.
3. Enter **Cost price**, **Retail selling price**, **Wholesale selling price**, and quantity.
4. In **Point of Sale** or **Social Commerce**, select **Retail** or **Wholesale** from the pricing toggle.
5. Add products and complete the order normally.

Changing the pricing mode reprices the current cart from the product/variation price data. Retail is the default for every new order.

## Backend authority

The frontend submits `price_mode: retail|wholesale` but does not submit trusted unit prices. `InventoryService` resolves the price from the selected product/variation, and `OrderService` stores the resolved unit price on each order item.

For auditability:

- `orders.price_mode` records the order pricing mode.
- `order_items.price_mode` records the pricing mode used for each line.
- `products`, `product_variants`, and `product_batches` each contain `retail_price` and `wholesale_price`.
- legacy `selling_price` remains synchronized with retail pricing for compatibility with the existing storefront and older API code.

## Existing databases

Run `./dev1.sh`. The included migration adds the new columns without deleting data. Existing retail/selling prices are copied to wholesale prices initially so old products remain sellable. Enter a different wholesale price in the next inventory batch when needed.

Do not use `RESET_DATABASE=1` merely to enable this feature; it is only for intentionally rebuilding a development database.
