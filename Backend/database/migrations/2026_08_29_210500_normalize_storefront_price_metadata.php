<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('products')) {
            DB::table('products')->orderBy('id')->chunkById(200, function ($products): void {
                foreach ($products as $product) {
                    $price = $this->firstPrice([
                        $product->retail_price ?? null,
                        $product->selling_price ?? null,
                        $product->sale_price ?? null,
                        $product->regular_price ?? null,
                    ]);

                    DB::table('products')->where('id', $product->id)->update([
                        'retail_price' => $price,
                        'selling_price' => $price,
                        'sale_price' => $price,
                        'regular_price' => $price,
                        'base_price' => $price,
                    ]);
                }
            });
        }

        if (Schema::hasTable('product_variants')) {
            DB::table('product_variants')->orderBy('id')->chunkById(200, function ($variants): void {
                foreach ($variants as $variant) {
                    $price = $this->firstPrice([
                        $variant->retail_price ?? null,
                        $variant->sale_price ?? null,
                        $variant->price ?? null,
                        $variant->regular_price ?? null,
                    ]);

                    DB::table('product_variants')->where('id', $variant->id)->update([
                        'retail_price' => $price,
                        'sale_price' => $price,
                        'price' => $price,
                        'regular_price' => $price,
                    ]);
                }
            });
        }
    }

    public function down(): void
    {
        // Historical source prices cannot be reconstructed safely. This migration
        // intentionally makes retail price the single storefront base price.
    }

    private function firstPrice(array $values): float
    {
        $fallback = 0.0;
        foreach ($values as $value) {
            if ($value === null || ! is_numeric($value)) continue;
            $price = round(max(0, (float) $value), 2);
            if ($price > 0) return $price;
            $fallback = $price;
        }

        return $fallback;
    }
};
