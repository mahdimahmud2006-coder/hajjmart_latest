<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductAttributeValue;
use App\Services\ProductService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class HajjMartProductSeeder extends Seeder
{
    public function run(): void
    {
        $path = database_path('seeders/data/hajjmart_products.json');
        if (! file_exists($path)) {
            $this->command?->warn('HajjMart products JSON not found.');
            return;
        }

        $catalog = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $products = $catalog['products'] ?? [];
        $service = app(ProductService::class);
        DB::transaction(function () use ($products, $service): void {
            foreach ($products as $item) {
                // Source data contains historical regular/sale prices. HajjMart now
                // has one retail base price; promotions are the only storefront
                // discount layer. Normalize the imported aliases before saving.
                $retailPrice = $item['retail_price'] ?? $item['selling_price'] ?? $item['sale_price'] ?? $item['regular_price'] ?? 0;
                $item['retail_price'] = $retailPrice;
                $item['selling_price'] = $retailPrice;
                $item['sale_price'] = $retailPrice;
                $item['regular_price'] = $retailPrice;
                $item['base_price'] = $retailPrice;
                foreach (($item['variations'] ?? []) as $index => $variation) {
                    $variantRetail = $variation['retail_price'] ?? $variation['sale_price'] ?? $variation['price'] ?? $variation['regular_price'] ?? $retailPrice;
                    $item['variations'][$index]['retail_price'] = $variantRetail;
                    $item['variations'][$index]['sale_price'] = $variantRetail;
                    $item['variations'][$index]['price'] = $variantRetail;
                    $item['variations'][$index]['regular_price'] = $variantRetail;
                }

                $item['slug'] = $this->uniqueSlug($item['slug'] ?? Str::slug($item['name']), $item['product_id'] ?? null);
                $existing = Product::where('source_product_id', $item['product_id'] ?? 0)->first();

                if ($existing) {
                    $product = $service->update($existing, $item);
                } else {
                    $product = $service->store($item);
                }

                // Product catalog imports create masters only. Stock, cost and selling
                // prices become live only after a confirmed direct product batch.
                if (! $product->productBatches()->where('count', '>', 0)->exists()) {
                    $product->update([
                        'total_count' => 0,
                        'stock_status' => 'out_of_stock',
                        'purchasable' => false,
                    ]);
                    $product->productVariants()->update([
                        'in_stock' => false,
                        'purchasable' => false,
                        'available_for_purchase' => false,
                    ]);
                } else {
                    $product->updateTotalCount();
                }

                foreach ($product->productVariants as $variant) {
                    $attributes = $variant->attributes_json ?? [];
                    foreach ($attributes as $name => $value) {
                        if ($value === null || $value === '') continue;
                        $attribute = ProductAttribute::firstOrCreate(['name' => str_replace('attribute_', '', (string) $name)]);
                        $attributeValue = ProductAttributeValue::firstOrCreate(['attribute_id' => $attribute->id, 'value' => (string) $value]);
                        $variant->attributeValues()->syncWithoutDetaching([$attributeValue->id]);
                    }
                }
            }
        });
    }

    private function uniqueSlug(string $slug, ?int $sourceProductId = null): string
    {
        $slug = Str::slug($slug) ?: 'product';
        $base = $slug;
        $counter = 1;
        while (Product::where('slug', $slug)
            ->when($sourceProductId, fn ($q) => $q->where('source_product_id', '!=', $sourceProductId))
            ->exists()) {
            $slug = $base . '-' . $counter++;
        }
        return $slug;
    }
}
