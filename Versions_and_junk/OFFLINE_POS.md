# HajjMart offline POS

The Point of Sale is now offline-first for **cash sales**. The browser keeps a durable local database in IndexedDB and synchronizes with Laravel/MySQL whenever the backend is reachable again.

## What works during an outage

After the register has visited POS online at least once for a store, it keeps a local store-scoped catalogue and can continue to:

- search cached products and variations;
- use Retail or Wholesale pricing;
- sort by Newest, Cheapest first, or Highest price first;
- build and restore the active cart after refresh/restart;
- hold and resume sales locally;
- complete cash sales;
- decrement the terminal's cached stock snapshot immediately;
- issue an offline receipt/reference;
- queue transactions durably until Laravel acknowledges them;
- reopen the POS shell through the service worker/PWA after a normal outage.

Card, bKash, Nagad and bank payment options are intentionally disabled when the backend is unavailable because those payment methods require network-side authorization/verification.

## Local IndexedDB stores

Database: `hajjmart-pos-offline`

- `products` — store-scoped product/variation/price/inventory snapshots;
- `carts` — current active cart for each store;
- `heldSales` — carts explicitly held by the cashier;
- `sales` — pending, syncing, conflict, rejected and synchronized POS sales;
- `meta` — catalogue synchronization metadata.

The local terminal identifier is stored in browser local storage under `hajjmart-pos-terminal-v1`. Each sale receives a UUID `client_transaction_id`.

## Synchronization API

Authenticated admin endpoints:

- `GET /api/v1/admin/pos/ping`
- `GET /api/v1/admin/pos/bootstrap?shop_id={id}`
- `POST /api/v1/admin/pos/sync`

`bootstrap` downloads the active, in-stock store catalogue with store-scoped inventory. `sync` accepts up to 100 offline transactions and returns a result for each one.

## Duplicate protection

Offline orders now contain:

- `terminal_id`
- `client_transaction_id`
- `offline_created_at`
- `synced_at`

MySQL has a unique constraint across:

```text
(shop_id, terminal_id, client_transaction_id)
```

Therefore a request can be retried after a timeout or connection loss without creating the same sale twice.

## Price protection

The offline browser records the retail/wholesale unit price that was displayed at the time of sale. On synchronization Laravel recalculates the authoritative price from MySQL and compares it with the recorded price.

If the price changed while the terminal was offline, the transaction becomes a **conflict** instead of silently posting an order at a different price. The POS queue shows the conflict and allows a retry after a manager corrects/reconciles it.

The frontend therefore cannot submit an arbitrary modified price and have Laravel trust it.

## Inventory protection

The terminal decrements its cached stock immediately after an offline cash sale. When Laravel receives the sale, the existing `InventoryService` validates and decrements authoritative MySQL inventory inside the normal order transaction.

If central inventory no longer has enough stock, the queued sale is marked as a conflict and remains visible for reconciliation.

### Multi-terminal limitation

IndexedDB is local to one browser/device. If several POS terminals all lose access to the same backend simultaneously, they cannot coordinate their cached stock snapshots with each other. Server-side synchronization will detect over-selling conflicts, but it cannot prevent two disconnected terminals from physically selling the same last unit.

For shops with multiple registers that must continue selling simultaneously during an internet outage, run Laravel/MySQL on a **store-local server/LAN** and synchronize that store server with the central/cloud system. IndexedDB remains useful as a second safety layer if the local store server also becomes temporarily unavailable.

## PWA/service worker

The admin layout registers `/sw-pos.js` and exposes `/pos.webmanifest`. The service worker caches:

- the POS HTML shell;
- Next.js static JS/CSS resources after the POS is visited;
- local POS fallback graphics;
- product images as they are successfully loaded.

The business catalogue and transactions are not cached through generic HTTP caching; they are managed explicitly in IndexedDB.

Service workers require HTTPS in production, except that browsers allow them on `localhost` during development.

## First-use requirement

A register must connect successfully at least once so `/admin/pos/bootstrap` can populate IndexedDB. The POS displays the number and timestamp of cached products. Do not rely on offline selling on a newly provisioned terminal until that initial catalogue sync has completed.

## Recovery after an outage

1. Cashier keeps selling from IndexedDB.
2. Transactions appear in **Offline queue**.
3. The POS checks backend reachability approximately every 15 seconds.
4. When the server is reachable, pending transactions synchronize automatically.
5. Laravel idempotency prevents duplicates.
6. Successful transactions receive their real server order number.
7. Price/stock conflicts remain visible for manual reconciliation and can be retried after correction.
