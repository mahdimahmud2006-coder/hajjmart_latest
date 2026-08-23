# HajjMart Admin Pagination Runtime Fix — 17 Aug 2026

## User-visible failures fixed

- **Transactions** crashed with `Cannot read properties of undefined (reading 'reduce')`.
- **Accounting** crashed with `Cannot read properties of undefined (reading 'length')`.

## Root cause

The Laravel `ApiResponse` helper serializes `LengthAwarePaginator` responses as:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "current_page": 1,
    "per_page": 25,
    "total": 0,
    "last_page": 1
  }
}
```

The shared frontend `adminRequest()` helper returned only `payload.data`, discarding `payload.meta`. Pages typed as `Paginated<T>` therefore received a bare array at runtime and attempted to read `result.data`, which was undefined.

## Fix

1. `Frontend/src/lib/admin-api.ts` now rehydrates paginator wire responses into the existing `Paginated<T>` shape.
2. Transactions defensively derives rows only when `result.data` is an array.
3. Accounting defensively normalizes setup, journal, trial-balance, and journal-line collections before rendering.
4. `npm run verify:admin-pagination` reproduces and guards the API contract regression.

The change is shared, so it also repairs other admin pages that consume Laravel paginator responses through `adminRequest()`.
