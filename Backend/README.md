# HajjMart Backend — Direct Product Batch Lifecycle

This Laravel backend treats a confirmed product batch as the beginning of stock. Creating a product master never creates inventory. Stock, cost price, selling price and purchasability become live only through a confirmed direct batch or a separately audited correction/return/transfer movement.

## Upgrade

```bash
composer install
php artisan migrate
php artisan db:seed
php artisan serve
```

The migration `2026_08_06_000000_direct_batch_inventory_lifecycle.php`:

- removes the retired sourcing tables and permissions;
- adds store, variation, reference, opening quantity, selling price, actor, note and received time to `product_batches`;
- converts existing positive inventory without matching batch quantities into opening batches;
- rebuilds product and variation sellability from batch balances;
- preserves historical migration order so both fresh and existing installations can upgrade.

Back up a production database before migration. Retired sourcing records are intentionally removed and are not recreated by rollback.

## Direct batch API

- `GET /api/v1/admin/inventory/batches` — batch history
- `POST /api/v1/admin/inventory/batches` — review-confirmed stock entry

Example body:

```json
{
  "confirmed": true,
  "shop_id": 1,
  "note": "Opening warehouse stock",
  "items": [
    {
      "product_id": 10,
      "variant_id": null,
      "cost_price": 850,
      "selling_price": 1100,
      "quantity": 20
    }
  ]
}
```

Duplicate product/variation lines, inactive products, mismatched variations and variable products without a selected variation are rejected inside the transaction.

## Reporting

Inventory reporting now covers physical, reserved and available units, stock value, low-stock rows, distinct batch receipts and units received. Retired sourcing metrics and routes are absent.
