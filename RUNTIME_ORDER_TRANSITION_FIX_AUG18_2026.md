# Runtime order-transition fix — Aug 18, 2026

- Removed the explanatory subtitle under the Unified Orders page title.
- `OrderService::transition()` now reloads `items.product` before returning the updated order.
- Unified Orders return form and order detail panel now tolerate partially hydrated order items and fall back to product IDs instead of crashing.
- Added regression assertions that transitioned orders return product-hydrated items.
