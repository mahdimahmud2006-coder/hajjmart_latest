<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class ProductFeedService
{
    /**
     * Get product feed with filtering, sorting, blending and pagination.
     */
    public function getFeed(array $filters): LengthAwarePaginator
    {
        $query = $this->baseQuery();

        $query = $this->applyFilters($query, $filters);

        $query = $this->applySortingOrBlending($query, $filters);

        return $query->paginate(
            $filters['per_page'] ?? 12
        );
    }

    /**
     * Base query — always eager loads categories
     */
    private function baseQuery(): Builder
    {
        return Product::query()
            ->where('is_active', true)
            ->whereHas('productBatches', function ($query) {
                $query->where('count', '>', 0);
            })
            ->with(['categories:id,name'])
            ->select('products.*');
    }

    /**
     * Apply filtering logic
     */
    private function applyFilters(Builder $query, array $filters): Builder
    {
        // Filter by categories (Many-to-Many)
        if (!empty($filters['categories']) && is_array($filters['categories'])) {
            $query->whereHas('categories', function ($q) use ($filters) {
                $q->whereIn('categories.id', $filters['categories']);
            });
        }

        // Filter by minimum price
        if (isset($filters['min_price'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('selling_price', '>=', $filters['min_price'])
                  ->orWhereHas('variations', function ($vQ) use ($filters) {
                      $vQ->where('selling_price', '>=', $filters['min_price']);
                  });
            });
        }

        // Filter by maximum price
        if (isset($filters['max_price'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('selling_price', '<=', $filters['max_price'])
                  ->orWhereHas('variations', function ($vQ) use ($filters) {
                      $vQ->where('selling_price', '<=', $filters['max_price']);
                  });
            });
        }

        // Search by name, description, or variant name (multi-keyword support)
        if (!empty($filters['search'])) {
            $keywords = array_filter(explode(' ', $filters['search']));
            
            $query->where(function ($q) use ($keywords) {
                foreach ($keywords as $keyword) {
                    $q->where(function ($innerQ) use ($keyword) {
                        $innerQ->where('name', 'LIKE', '%' . $keyword . '%')
                               ->orWhere('description', 'LIKE', '%' . $keyword . '%')
                               ->orWhereHas('variations', function ($vQ) use ($keyword) {
                                   $vQ->where('name', 'LIKE', '%' . $keyword . '%');
                               });
                    });
                }
            });
        }

        return $query;
    }

    /**
     * Apply explicit sorting OR blended feed
     */
    private function applySortingOrBlending(Builder $query, array $filters): Builder
    {
        if (!empty($filters['sort_by'])) {
            return $this->applySorting($query, $filters['sort_by']);
        }

        return $this->applyBlendedFeed($query);
    }

    /**
     * Explicit sorting logic
     */
    private function applySorting(Builder $query, string $sortBy): Builder
    {
        if ($sortBy === 'price_low_high' || $sortBy === 'price_high_low') {
            $query->leftJoin('variations', 'products.id', '=', 'variations.product_id')
                ->selectRaw('products.*, COALESCE(products.selling_price, MIN(variations.selling_price)) as effective_min_price')
                ->groupBy('products.id');
            
            return $sortBy === 'price_low_high' 
                ? $query->orderBy('effective_min_price', 'asc')
                : $query->orderBy('effective_min_price', 'desc');
        }

        return match ($sortBy) {
            'newest' => $query->orderByDesc('created_at'),
            'most_sold' => $query->orderByDesc('sold_count'),
            default => $this->applyBlendedFeed($query),
        };
    }

    /**
     * Blended feed logic
     */
    private function applyBlendedFeed(Builder $query): Builder
    {
        $sevenDaysAgo = Carbon::now()->subDays(7);

        return $query->orderByRaw("
            CASE
                WHEN created_at >= ? THEN 1
                WHEN sold_count >= (
                    SELECT AVG(sold_count) FROM products
                ) THEN 2
                ELSE 3
            END
        ", [$sevenDaysAgo])
        ->orderByDesc('created_at');
    }
}