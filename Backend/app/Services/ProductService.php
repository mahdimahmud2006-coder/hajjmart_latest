<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductTag;
use App\Models\ProductVariant;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductService
{
    public function search(array $filters = []): LengthAwarePaginator
    {
        $shopId = isset($filters['shop_id']) ? (int) $filters['shop_id'] : null;
        $relations = [
            'primaryCategory', 'categories', 'productImages', 'tags',
            'inventory' => fn ($q) => $q->when($shopId, fn ($inventory) => $inventory->where('shop_id', $shopId)),
            'productVariants' => fn ($q) => $q->where('is_active', true),
            'productVariants.inventory' => fn ($q) => $q->when($shopId, fn ($inventory) => $inventory->where('shop_id', $shopId)),
        ];

        $query = Product::query()
            ->with($relations)
            ->when(! array_key_exists('include_inactive', $filters), fn ($q) => $q->where('is_active', true));

        if ($search = $filters['q'] ?? $filters['search'] ?? null) {
            $query->where(function ($q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhere('short_description', 'like', "%{$search}%")
                  ->orWhere('brand', 'like', "%{$search}%")
                  ->orWhereHas('productVariants', fn ($variant) => $variant->where('sku', 'like', "%{$search}%"));
            });
        }

        if ($slug = $filters['category'] ?? null) {
            $query->whereHas('categories', fn ($q) => $q->where('slug', $slug)->orWhere('name', $slug));
        }

        if ($categoryId = $filters['category_id'] ?? null) {
            $query->where(function ($q) use ($categoryId): void {
                $q->where('category_id', $categoryId)->orWhereHas('categories', fn ($sub) => $sub->where('categories.id', $categoryId));
            });
        }

        if (isset($filters['min_price'])) {
            $query->where('selling_price', '>=', (float) $filters['min_price']);
        }

        if (isset($filters['max_price'])) {
            $query->where('selling_price', '<=', (float) $filters['max_price']);
        }

        $positiveInventory = fn ($q) => $q
            ->when($shopId, fn ($inventory) => $inventory->where('shop_id', $shopId))
            ->whereRaw('quantity - reserved > 0');

        if (($filters['in_stock'] ?? null) !== null) {
            $query->where(function ($stock) use ($positiveInventory): void {
                $stock->whereHas('inventory', $positiveInventory)
                    ->orWhereHas('productVariants.inventory', $positiveInventory);
            });
        }

        if ($stockState = $filters['stock_state'] ?? null) {
            if ($stockState === 'instock') {
                $query->where(function ($stock) use ($positiveInventory): void {
                    $stock->whereHas('inventory', $positiveInventory)
                        ->orWhereHas('productVariants.inventory', $positiveInventory);
                });
            } elseif ($stockState === 'lowstock') {
                $lowInventory = fn ($q) => $q
                    ->when($shopId, fn ($inventory) => $inventory->where('shop_id', $shopId))
                    ->whereRaw('quantity - reserved > 0')
                    ->whereRaw('quantity - reserved <= low_stock_threshold');
                $query->where(function ($stock) use ($lowInventory): void {
                    $stock->whereHas('inventory', $lowInventory)
                        ->orWhereHas('productVariants.inventory', $lowInventory);
                });
            } elseif ($stockState === 'outofstock') {
                $query->whereDoesntHave('inventory', $positiveInventory)
                    ->whereDoesntHave('productVariants.inventory', $positiveInventory);
            }
        }

        if (($filters['featured'] ?? null) !== null) {
            $query->where('is_featured', (bool) $filters['featured']);
        }

        $priceMode = strtolower((string) ($filters['price_mode'] ?? 'retail')) === 'wholesale' ? 'wholesale' : 'retail';
        $variantPriceExpression = $priceMode === 'wholesale'
            ? 'COALESCE(product_variants.wholesale_price, products.wholesale_price, product_variants.retail_price, product_variants.sale_price, product_variants.price, product_variants.regular_price, products.retail_price, products.selling_price)'
            : 'COALESCE(product_variants.retail_price, product_variants.sale_price, product_variants.price, product_variants.regular_price)';
        $productPriceExpression = $priceMode === 'wholesale'
            ? 'COALESCE(products.wholesale_price, products.retail_price, products.sale_price, products.selling_price, products.regular_price, 0)'
            : 'COALESCE(products.retail_price, products.sale_price, products.selling_price, products.regular_price, 0)';
        $effectivePriceExpression = "COALESCE((SELECT MIN({$variantPriceExpression}) FROM product_variants WHERE product_variants.product_id = products.id AND product_variants.is_active = 1), {$productPriceExpression})";

        match ($filters['sort'] ?? 'newest') {
            'price_asc' => $query->orderByRaw("{$effectivePriceExpression} asc")->orderBy('products.id'),
            'price_desc' => $query->orderByRaw("{$effectivePriceExpression} desc")->orderBy('products.id'),
            'best_selling' => $query->orderByDesc('sold_count'),
            default => $query->latest('products.created_at'),
        };

        $perPage = max(1, min(250, (int) ($filters['per_page'] ?? 20)));
        return $query->paginate($perPage);
    }

    public function detail(string $slugOrId): Product
    {
        return Product::with([
            'primaryCategory', 'categories', 'productImages', 'productVariants.attributeValues.attribute',
            'productVariants.inventory', 'inventory', 'tags',
        ])->where('slug', $slugOrId)
          ->orWhere('sku', $slugOrId)
          ->orWhere('id', is_numeric($slugOrId) ? (int) $slugOrId : 0)
          ->firstOrFail();
    }

    public function store(array $data): Product
    {
        return DB::transaction(function () use ($data): Product {
            $product = Product::create($this->normalizeProductData($data));
            $this->syncRelations($product, $data);
            return $product->fresh(['categories', 'productImages', 'productVariants', 'tags', 'inventory']);
        });
    }

    public function update(Product $product, array $data): Product
    {
        return DB::transaction(function () use ($product, $data): Product {
            $product->update($this->normalizeProductData($data, false));
            $this->syncRelations($product, $data);
            return $product->fresh(['categories', 'productImages', 'productVariants', 'tags', 'inventory']);
        });
    }

    private function normalizeProductData(array $data, bool $creating = true): array
    {
        $slug = $data['slug'] ?? ($creating ? Str::slug($data['name'] ?? Str::random(8)) : null);
        $retailPrice = $data['retail_price'] ?? $data['selling_price'] ?? $data['sale_price'] ?? $data['price'] ?? ($creating ? 0 : null);
        $wholesalePrice = $data['wholesale_price'] ?? ($creating ? $retailPrice : null);
        $payload = [
            'category_id' => $data['category_id'] ?? null,
            'source_product_id' => $data['product_id'] ?? $data['source_product_id'] ?? null,
            'source_url' => $data['url'] ?? $data['source_url'] ?? null,
            'name' => $data['name'] ?? null,
            'slug' => $slug,
            'sku' => $data['sku'] ?? null,
            'barcode' => $data['barcode'] ?? null,
            'product_type' => $data['product_type'] ?? 'simple',
            'product_type_source' => $data['product_type_source'] ?? null,
            'sku_source' => $data['sku_source'] ?? null,
            'product_id_source' => $data['product_id_source'] ?? null,
            'default_variation_sku' => $data['default_variation_sku'] ?? null,
            'currency' => $data['currency'] ?? 'BDT',
            'price_text' => $data['price_text'] ?? null,
            'selling_price' => $retailPrice,
            'retail_price' => $retailPrice,
            'wholesale_price' => $wholesalePrice,
            'regular_price' => $data['regular_price'] ?? null,
            'base_price' => $data['base_price'] ?? $data['regular_price'] ?? null,
            'sale_price' => $retailPrice,
            'cost_price' => $data['cost_price'] ?? null,
            'price_min' => $data['price_min'] ?? null,
            'price_max' => $data['price_max'] ?? null,
            'regular_price_min' => $data['regular_price_min'] ?? null,
            'regular_price_max' => $data['regular_price_max'] ?? null,
            'stock_status' => $data['stock_status'] ?? ($creating ? 'out_of_stock' : null),
            'stock_text' => $data['stock_text'] ?? null,
            'purchasable' => $data['purchasable'] ?? ($creating ? false : null),
            'short_description' => $data['short_description'] ?? null,
            'summary_description' => $data['summary_description'] ?? null,
            'description' => $data['description'] ?? $data['long_description'] ?? null,
            'long_description' => $data['long_description'] ?? null,
            'short_description_html' => $data['short_description_html'] ?? null,
            'summary_description_html' => $data['summary_description_html'] ?? null,
            'description_html' => $data['description_html'] ?? null,
            'long_description_html' => $data['long_description_html'] ?? null,
            'short_description_clean_html' => $data['short_description_clean_html'] ?? null,
            'description_clean_html' => $data['description_clean_html'] ?? null,
            'long_description_clean_html' => $data['long_description_clean_html'] ?? null,
            'additional_information' => $data['additional_information'] ?? null,
            'additional_information_rows' => $data['additional_information_rows'] ?? null,
            'additional_information_text' => $data['additional_information_text'] ?? null,
            'additional_information_html' => $data['additional_information_html'] ?? null,
            'additional_information_clean_html' => $data['additional_information_clean_html'] ?? null,
            'specifications' => $data['specifications'] ?? null,
            'variation_attribute_options' => $data['variation_attribute_options'] ?? null,
            'variation_extraction' => $data['variation_extraction'] ?? null,
            'variation_warning' => $data['variation_warning'] ?? null,
            'stock_summary' => $data['stock_summary'] ?? null,
            'brand' => $data['brand'] ?? null,
            'brands' => $data['brands'] ?? null,
            'discovery_sources' => $data['discovery_sources'] ?? null,
            'visible_in_shop' => $data['visible_in_shop'] ?? true,
            'raw_payload' => $data,
            'scraped_at' => $data['scraped_at'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'is_featured' => $data['is_featured'] ?? false,
            'has_variations' => ($data['product_type'] ?? null) === 'variable' || ! empty($data['variations']),
        ];

        if (! $creating) {
            return array_filter($payload, fn ($value) => $value !== null);
        }

        return $payload;
    }

    private function syncRelations(Product $product, array $data): void
    {
        if (! empty($data['categories'])) {
            $categoryIds = [];
            foreach ($data['categories'] as $name) {
                $category = Category::firstOrCreate(
                    ['slug' => Str::slug($name)],
                    ['name' => $name, 'is_active' => true]
                );
                $categoryIds[] = $category->id;
            }
            $product->categories()->syncWithoutDetaching($categoryIds);
            if (! $product->category_id && ! empty($categoryIds)) {
                $product->update(['category_id' => $categoryIds[0]]);
            }
        }

        if (! empty($data['tags'])) {
            $tagIds = [];
            foreach ($data['tags'] as $name) {
                $tag = ProductTag::firstOrCreate(['slug' => Str::slug($name)], ['name' => $name]);
                $tagIds[] = $tag->id;
            }
            $product->tags()->sync($tagIds);
        }

        if (array_key_exists('images', $data)) {
            $product->productImages()->delete();
            foreach (($data['images'] ?? []) as $index => $image) {
                ProductImage::create([
                    'product_id' => $product->id,
                    'path' => $image['local_path'] ?? $image['path'] ?? null,
                    'source_url' => $image['source_url'] ?? null,
                    'downloaded_url' => $image['downloaded_url'] ?? null,
                    'alt_text' => $image['alt'] ?? $image['alt_text'] ?? $product->name,
                    'mime_type' => $image['mime_type'] ?? null,
                    'size_bytes' => $image['size_bytes'] ?? null,
                    'sha256' => $image['sha256'] ?? null,
                    'source_aliases' => $image['source_aliases'] ?? [],
                    'sort_order' => $index,
                    'is_primary' => $index === 0,
                    'created_at' => now(),
                ]);
            }
        }

        if (array_key_exists('variations', $data)) {
            $product->productVariants()->delete();
            foreach (($data['variations'] ?? []) as $variant) {
                ProductVariant::create([
                    'product_id' => $product->id,
                    'source_variation_id' => $variant['variation_id'] ?? null,
                    'sku' => $variant['sku'] ?? null,
                    'price' => $variant['retail_price'] ?? $variant['selling_price'] ?? null,
                    'sale_price' => $variant['retail_price'] ?? $variant['selling_price'] ?? null,
                    'retail_price' => $variant['retail_price'] ?? $variant['selling_price'] ?? null,
                    'wholesale_price' => $variant['wholesale_price'] ?? $variant['retail_price'] ?? $variant['selling_price'] ?? null,
                    'regular_price' => $variant['regular_price'] ?? null,
                    'attributes_json' => $variant['attributes'] ?? [],
                    'attribute_labels' => $variant['attribute_labels'] ?? [],
                    'attribute_values' => $variant['attribute_values'] ?? [],
                    'variation_description' => $variant['variation_description'] ?? null,
                    'weight' => $variant['weight'] ?? null,
                    'dimensions_json' => $variant['dimensions'] ?? null,
                    'in_stock' => $variant['in_stock'] ?? false,
                    'purchasable' => $variant['purchasable'] ?? false,
                    'available_for_purchase' => $variant['available_for_purchase'] ?? false,
                    'image_json' => $variant['image'] ?? null,
                    'is_active' => true,
                ]);
            }
        }

    }
}
