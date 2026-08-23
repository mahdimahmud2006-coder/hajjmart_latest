<?php
namespace App\Models;

use App\Models\ReservedProduct;
use App\Services\ImageKitService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Product extends Model
{
    use HasFactory;
    protected $fillable = [
        'category_id', 'source_product_id', 'source_url', 'name', 'slug', 'sku', 'barcode',
        'product_type', 'product_type_source', 'sku_source', 'product_id_source', 'default_variation_sku',
        'currency', 'price_text', 'selling_price', 'retail_price', 'wholesale_price', 'regular_price', 'base_price', 'sale_price', 'cost_price',
        'price_min', 'price_max', 'regular_price_min', 'regular_price_max', 'tax_rate', 'tax_inclusive',
        'stock_status', 'stock_text', 'purchasable', 'short_description', 'summary_description',
        'description', 'long_description', 'short_description_html', 'summary_description_html',
        'description_html', 'long_description_html', 'short_description_clean_html', 'description_clean_html',
        'long_description_clean_html', 'additional_information', 'additional_information_rows',
        'additional_information_text', 'additional_information_html', 'additional_information_clean_html',
        'specifications', 'variation_attribute_options', 'variation_extraction', 'variation_warning',
        'stock_summary', 'brand', 'brands', 'discovery_sources', 'visible_in_shop', 'sell_on_website', 'sell_on_social', 'sell_on_pos', 'raw_payload',
        'scraped_at', 'weight', 'weight_unit', 'dimensions_json', 'is_featured', 'is_active', 'is_digital',
        'meta_title', 'meta_description', 'meta_keywords',
        'sold_count', 'total_count', 'image_src', 'has_dynamic_pricing', 'price_slabs', 'has_variations',
        'average_rating', 'review_count',
    ];

    protected $appends = ['available_stock', 'primary_image_url'];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    |
    */

    public function reservedProducts(): HasMany
    {
        return $this->hasMany(ReservedProduct::class);
    }

    /**
     * Return the legacy image_src array when present, otherwise expose the
     * scraper/product_images records used by the current catalogue importer.
     */
    public function getImageSrcAttribute($value): array
    {
        $legacy = [];
        if (is_array($value)) {
            $legacy = $value;
        } elseif (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            $legacy = is_array($decoded) ? $decoded : [$value];
        }

        $legacy = array_values(array_filter($legacy, fn ($url) => is_string($url) && trim($url) !== ''));
        if ($legacy !== []) {
            return $legacy;
        }

        $images = $this->relationLoaded('productImages')
            ? $this->productImages
            : $this->productImages()->orderByDesc('is_primary')->orderBy('sort_order')->get();

        return $images
            ->sortBy([['is_primary', 'desc'], ['sort_order', 'asc']])
            ->map(fn (ProductImage $image) => $image->url)
            ->filter(fn ($url) => is_string($url) && trim($url) !== '')
            ->values()
            ->all();
    }

    public function getPrimaryImageUrlAttribute(): ?string
    {
        return $this->image_src[0] ?? null;
    }

    protected $casts = [
        'image_src' => 'array',
        'selling_price' => 'decimal:2',
        'retail_price' => 'decimal:2',
        'wholesale_price' => 'decimal:2',
        'regular_price' => 'decimal:2',
        'base_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'cost_price' => 'decimal:2',
        'price_min' => 'decimal:2',
        'price_max' => 'decimal:2',
        'regular_price_min' => 'decimal:2',
        'regular_price_max' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'tax_inclusive' => 'boolean',
        'purchasable' => 'boolean',
        'is_featured' => 'boolean',
        'is_active' => 'boolean',
        'is_digital' => 'boolean',
        'visible_in_shop' => 'boolean',
        'sell_on_website' => 'boolean',
        'sell_on_social' => 'boolean',
        'sell_on_pos' => 'boolean',
        'has_dynamic_pricing' => 'boolean',
        'price_slabs' => 'array',
        'has_variations' => 'boolean',
        'additional_information' => 'array',
        'additional_information_rows' => 'array',
        'specifications' => 'array',
        'variation_attribute_options' => 'array',
        'stock_summary' => 'array',
        'brands' => 'array',
        'discovery_sources' => 'array',
        'dimensions_json' => 'array',
        'raw_payload' => 'array',
        'average_rating' => 'decimal:2',
        'review_count' => 'integer',
        'scraped_at' => 'datetime',
    ];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function productBatches(): HasMany
    {
        return $this->hasMany(ProductBatch::class);
    }

    public function variations(): HasMany
    {
        return $this->hasMany(Variation::class);
    }

    /**
     * Many-to-many via the category_product pivot table.
     */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'category_product');
    }

    /*
    |--------------------------------------------------------------------------
    | Create
    |--------------------------------------------------------------------------
    |
    | Required : name, selling_price
    | Optional : image_src (array of UploadedFile), description, category (id)
    |
    | - Stores images in ImageKit (folder: products)
    | - If a product with the same name already exists, appends _1, _2, etc.
    | - Attaches the product to the given category via the pivot table
    |
    */

    public static function createProduct(
        string $name,
        ?float $sellingPrice = null,
        array  $imageSrc = [],
        ?string $description = null,
        ?array  $categories_id = [],
        bool   $hasDynamicPricing = false,
        ?array $priceSlabs = null,
        bool   $hasVariations = false,
        ?array $variations = null,
        array $requestData = [] // For variation files
    ): self {
        // ── Resolve unique name ──────────────────────────────────────
        $finalName = $name;
        $counter   = 1;

        while (self::where('name', $finalName)->exists()) {
            $finalName = $name . '_' . $counter;
            $counter++;
        }

        // ── Store images ─────────────────────────────────────────────
        $storedPaths  = [];
        $imageKit     = new ImageKitService();

        foreach ($imageSrc as $image) {
            $storedPaths[] = $imageKit->upload($image, 'products');
        }

        // ── Create the product ──────────────────────────────────────
        $product = self::create([
            'name'                => $finalName,
            'selling_price'       => $sellingPrice !== null ? round($sellingPrice, 2) : null,
            'image_src'           => empty($storedPaths) ? [] : $storedPaths,
            'description'         => $description,
            'has_dynamic_pricing' => $hasDynamicPricing,
            'price_slabs'         => $priceSlabs,
            'has_variations'      => $hasVariations,
            'total_count'          => 0,
            'stock_status'         => 'out_of_stock',
            'purchasable'          => false,
        ]);

        // ── Attach category (pivot) ─────────────────────────────────
        if ($categories_id !== null) {
            foreach ($categories_id as $category_id) {
                $product->categories()->attach($category_id);
            }
        }

        // ── Create Variations if provided ───────────────────────────
        if ($hasVariations && !empty($variations)) {
            foreach ($variations as $idx => $vData) {
                $varStoredPaths = [];
                $fileKey = "variation_images_{$idx}";
                
                // Check if any files were uploaded for this specific variation
                if (isset($requestData[$fileKey]) && is_array($requestData[$fileKey])) {
                    foreach ($requestData[$fileKey] as $file) {
                        $varStoredPaths[] = $imageKit->upload($file, 'products');
                    }
                }

                $product->variations()->create([
                    'name'                => $vData['name'] ?? 'Default Variation',
                    'selling_price'       => isset($vData['selling_price']) ? round((float)$vData['selling_price'], 2) : $product->selling_price,
                    'image_src'           => empty($varStoredPaths) ? null : $varStoredPaths,
                    'has_dynamic_pricing' => false,
                    'price_slabs'         => null,
                ]);
            }
        }

        return $product;
    }

    /*
    |--------------------------------------------------------------------------
    | Core Retrieval
    |--------------------------------------------------------------------------
    */

    /**
     * Get a single product by its ID (with batches & categories).
     */
    public static function getProductById(int $id): ?self
    {
        return self::with(['productBatches', 'categories', 'variations', 'variations.productBatches'])->find($id);
    }

    /**
     * Get every product (with batches, categories & variations).
     */
    public static function getAllProducts()
    {
        return self::with(['productBatches', 'categories', 'variations'])->get();
    }

    /**
     * Get paginated products (with batches & categories).
     */
    public static function getAllProductsPaginated(int $perPage = 7, int $page = 1, ?string $search = null, ?int $categoryId = null): array
    {
        $query = self::with(['categories', 'productBatches', 'variations'])
            ->orderBy('created_at', 'desc');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                    ->orWhere('description', 'like', '%' . $search . '%')
                    ->orWhereHas('categories', function ($cq) use ($search) {
                        $cq->where('name', 'like', '%' . $search . '%');
                    })
                    ->orWhereHas('variations', function ($vq) use ($search) {
                        $vq->where('name', 'like', '%' . $search . '%');
                    });
            });
        }

        if ($categoryId) {
            $query->whereHas('categories', function ($q) use ($categoryId) {
                $q->where('categories.id', $categoryId);
            });
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return [
            'data' => $paginator->getCollection()->map(function ($product) {
                return [
                    'id'            => $product->id,
                    'name'          => $product->name,
                    'description'   => $product->description,
                    'selling_price' => $product->selling_price,
                    'categories'    => $product->categories,
                    'sold_count'    => $product->sold_count,
                    'total_count'   => $product->total_count,
                    'available_stock' => $product->getAvailableStock(),
                    'image_src'     => $product->image_src ?? [],
                    'has_dynamic_pricing' => $product->has_dynamic_pricing,
                    'price_slabs'   => $product->price_slabs,
                    'has_variations' => $product->has_variations,
                    'variations'    => $product->variations->map(function ($v) {
                        return [
                            'id' => $v->id,
                            'name' => $v->name,
                            'selling_price' => $v->selling_price,
                            'has_dynamic_pricing' => $v->has_dynamic_pricing,
                            'price_slabs' => $v->price_slabs,
                            'image_src' => $v->image_src,
                            'total_count' => $v->getTotalCount(),
                            'available_stock' => $v->getAvailableStock(),
                        ];
                    }),

                    'product_batches' => $product->productBatches->map(function ($batch) {
                        return [
                            'id'         => $batch->id,
                            'count'      => $batch->count,
                            'cost_price' => $batch->cost_price ?? null,
                            'created_at' => $batch->created_at,
                            'variation_id' => $batch->variation_id,
                            'variation' => $batch->variation ? ['id' => $batch->variation->id, 'name' => $batch->variation->name] : null,
                        ];
                    })->values(),
                ];
            }),

            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
                'from'         => $paginator->firstItem(),
                'to'           => $paginator->lastItem(),
            ],
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Basic Updates
    |--------------------------------------------------------------------------
    */

    /**
     * Rename the product.
     */
    public function updateProductName(string $name): void
    {
        $this->name = $name;
        $this->save();
    }

    /**
     * Update description.
     */
    public function updateDescription(?string $description): void
    {
        $this->description = $description;
        $this->save();
    }

    /*
    |--------------------------------------------------------------------------
    | Category Management (pivot)
    |--------------------------------------------------------------------------
    */

    /**
     * Attach one or more categories without detaching existing ones.
     *
     * @param int|array $categoryIds  Single ID or array of IDs
     */
    public function addCategory(int|array $categoryIds): void
    {
        $this->categories()->syncWithoutDetaching($categoryIds);
    }

    /**
     * Detach one or more categories.
     *
     * @param int|array $categoryIds  Single ID or array of IDs
     */
    public function removeCategory(int|array $categoryIds): void
    {
        $this->categories()->detach($categoryIds);
    }

    /*
    |--------------------------------------------------------------------------
    | Delete
    |--------------------------------------------------------------------------
    */

    /**
     * Delete the product with the given ID (and its stored images).
     */
    public static function deleteProductById(int $id): bool
    {
        $product = self::find($id);

        if (!$product) {
            return false;
        }

        // Clean up stored images
        $imageKit = new ImageKitService();
        foreach ($product->image_src ?? [] as $url) {
            $imageKit->delete($url);
        }

        return (bool) $product->delete();
    }

    /*
    |--------------------------------------------------------------------------
    | Inventory Aggregation
    |--------------------------------------------------------------------------
    */

    public function updateTotalCount(): void
    {
        $this->total_count = (int) $this->productBatches()->sum('count');
        $this->stock_status = $this->total_count > 0 ? 'in_stock' : 'out_of_stock';
        $this->purchasable = $this->total_count > 0;
        $this->save();
    }

    public function getTotalCount(): int
    {
        // Read-only: sum directly from batches without writing to the DB.
        // Use updateTotalCount() explicitly when you need to persist the aggregated value.
        return (int) $this->productBatches()->sum('count');
    }

    /**
     * Get reserved quantity across all orders
     */
    public function getReservedQty(): int
    {
        return (int) $this->reservedProducts()->active()->whereNull('variation_id')->sum('qty');
    }

    /**
     * Get available stock : total_count - reserved_qty
     */
    public function getAvailableStock(): int
    {
        if ($this->has_variations) {
            return (int) $this->variations->sum(fn ($variation) => $variation->getAvailableStock());
        }
        return $this->getTotalCount() - $this->getReservedQty();
    }

    public function getAvailableStockAttribute(): int
    {
        // The upgraded admin and checkout workflows use store-aware inventory rows.
        // When that relationship has been explicitly loaded (and optionally scoped
        // to one store), prefer it over the legacy product-batch stock calculation.
        if ($this->relationLoaded('inventory') && $this->inventory->isNotEmpty()) {
            return (int) $this->inventory->sum(fn ($row) => max(0, (int) $row->quantity - (int) $row->reserved));
        }

        if ($this->relationLoaded('productVariants') && $this->productVariants->isNotEmpty()) {
            $variantStock = $this->productVariants->sum(function ($variant): int {
                if ($variant->relationLoaded('inventory') && $variant->inventory) {
                    return max(0, (int) $variant->inventory->quantity - (int) $variant->inventory->reserved);
                }
                return 0;
            });
            if ($variantStock > 0) {
                return (int) $variantStock;
            }
        }

        return $this->getAvailableStock();
    }

    /*
    |--------------------------------------------------------------------------
    | Selling Logic (Cheapest First)
    |--------------------------------------------------------------------------
    */

    public function sellProduct(int $count, ?int $variationId = null): array
    {
        if ($this->has_variations && $variationId) {
            $variation = $this->variations()->find($variationId);
            if ($variation) {
                return $variation->sellProduct($count);
            }
            return [
                'success' => false,
                'message' => 'Variation not found',
            ];
        }

        if ($this->getTotalCount() < $count) {
            return [
                'success' => false,
                'message' => 'Insufficient inventory',
            ];
        }

        $remaining      = $count;
        $totalCostPrice = 0;

        $batches = $this->productBatches()
            ->where('count', '>', 0)
            ->orderBy('cost_price', 'asc')
            ->get();

        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }

            if ($batch->count > $remaining) {
                $batch->count   -= $remaining;
                $totalCostPrice += $remaining * $batch->cost_price;
                $batch->save();
                $remaining = 0;
            } else {
                $totalCostPrice += $batch->count * $batch->cost_price;
                $remaining      -= $batch->count;
                ProductBatch::deleteProductBatch($this, $batch);
            }
        }

        $this->sold_count += $count;
        $this->updateTotalCount();
        $this->save();

        return [
            'success'        => true,
            'totalCostPrice' => round($totalCostPrice, 2),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Price Update
    |--------------------------------------------------------------------------
    */

    public function updateSellingPrice(?float $newPrice): void
    {
        $this->selling_price = $newPrice !== null ? round($newPrice, 2) : null;
        $this->save();
    }

    /*
    |--------------------------------------------------------------------------
    | Dynamic Pricing Logic
    |--------------------------------------------------------------------------
    */

    /**
     * Get the unit price for a given quantity.
     * 
     * @param int $qty
     * @return float|null
     */
    public function getPriceForQuantity(int $qty, ?int $variationId = null): ?float
    {
        if ($this->has_variations && $variationId) {
            $variation = $this->variations()->find($variationId);
            if ($variation) {
                return $variation->getPriceForQuantity($qty);
            }
        }

        if ($this->has_dynamic_pricing && !empty($this->price_slabs)) {
            foreach ($this->price_slabs as $slab) {
                $min = $slab['min_qty'] ?? 0;
                $max = $slab['max_qty'] ?? PHP_INT_MAX;

                if ($qty >= $min && $qty <= $max) {
                    return (float) $slab['price'];
                }
            }
        }

        return $this->selling_price ? (float) $this->selling_price : null;
    }

    /*
    |--------------------------------------------------------------------------
    | Image Handling
    |--------------------------------------------------------------------------
    */

    public function addNewImage(array $images): void
    {
        $paths    = $this->image_src ?? [];
        $imageKit = new ImageKitService();

        foreach ($images as $image) {
            $paths[] = $imageKit->upload($image, 'products');
        }

        $this->image_src = $paths;
        $this->save();
    }

    public function deleteImage(array $pathsToDelete): void
    {
        $currentImages = collect($this->image_src ?? []);
        $imageKit      = new ImageKitService();

        foreach ($pathsToDelete as $url) {
            $imageKit->delete($url);
            $currentImages = $currentImages->reject(fn($img) => $img === $url);
        }

        $this->image_src = $currentImages->values()->toArray();
        $this->save();
    }

    public function primaryCategory(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function productImages(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort_order');
    }

    public function productVariants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function inventory(): HasMany
    {
        return $this->hasMany(Inventory::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(ProductTag::class, 'product_tag_pivot', 'product_id', 'tag_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class);
    }

    public function approvedReviews(): HasMany
    {
        return $this->hasMany(ProductReview::class)->where('status', 'approved')->where('is_approved', true);
    }

}