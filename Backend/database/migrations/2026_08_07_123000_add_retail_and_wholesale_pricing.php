<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('products')) {
            if (! Schema::hasColumn('products', 'retail_price')) {
                Schema::table('products', function (Blueprint $table): void {
                    $table->decimal('retail_price', 15, 2)->nullable()->after('selling_price');
                });
            }
            if (! Schema::hasColumn('products', 'wholesale_price')) {
                Schema::table('products', function (Blueprint $table): void {
                    $table->decimal('wholesale_price', 15, 2)->nullable()->after('retail_price');
                });
            }

            DB::table('products')->update([
                'retail_price' => DB::raw('COALESCE(retail_price, sale_price, selling_price, regular_price, 0)'),
                'wholesale_price' => DB::raw('COALESCE(wholesale_price, retail_price, sale_price, selling_price, regular_price, 0)'),
            ]);
        }

        if (Schema::hasTable('product_variants')) {
            if (! Schema::hasColumn('product_variants', 'retail_price')) {
                Schema::table('product_variants', function (Blueprint $table): void {
                    $table->decimal('retail_price', 12, 2)->nullable()->after('sale_price');
                });
            }
            if (! Schema::hasColumn('product_variants', 'wholesale_price')) {
                Schema::table('product_variants', function (Blueprint $table): void {
                    $table->decimal('wholesale_price', 12, 2)->nullable()->after('retail_price');
                });
            }

            DB::table('product_variants')->update([
                'retail_price' => DB::raw('COALESCE(retail_price, sale_price, price, regular_price, 0)'),
                'wholesale_price' => DB::raw('COALESCE(wholesale_price, retail_price, sale_price, price, regular_price, 0)'),
            ]);
        }

        if (Schema::hasTable('product_batches')) {
            if (! Schema::hasColumn('product_batches', 'retail_price')) {
                Schema::table('product_batches', function (Blueprint $table): void {
                    $table->decimal('retail_price', 15, 2)->nullable()->after('selling_price');
                });
            }
            if (! Schema::hasColumn('product_batches', 'wholesale_price')) {
                Schema::table('product_batches', function (Blueprint $table): void {
                    $table->decimal('wholesale_price', 15, 2)->nullable()->after('retail_price');
                });
            }

            DB::table('product_batches')->update([
                'retail_price' => DB::raw('COALESCE(retail_price, selling_price, 0)'),
                'wholesale_price' => DB::raw('COALESCE(wholesale_price, retail_price, selling_price, 0)'),
            ]);
        }

        if (Schema::hasTable('orders') && ! Schema::hasColumn('orders', 'price_mode')) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->string('price_mode', 20)->default('retail')->after('source_channel')->index();
            });
        }

        if (Schema::hasTable('order_items') && ! Schema::hasColumn('order_items', 'price_mode')) {
            Schema::table('order_items', function (Blueprint $table): void {
                $table->string('price_mode', 20)->default('retail')->after('unit_price');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'price_mode')) {
            Schema::table('order_items', fn (Blueprint $table) => $table->dropColumn('price_mode'));
        }
        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'price_mode')) {
            Schema::table('orders', fn (Blueprint $table) => $table->dropColumn('price_mode'));
        }
        if (Schema::hasTable('product_batches') && Schema::hasColumn('product_batches', 'wholesale_price')) {
            Schema::table('product_batches', fn (Blueprint $table) => $table->dropColumn('wholesale_price'));
        }
        if (Schema::hasTable('product_batches') && Schema::hasColumn('product_batches', 'retail_price')) {
            Schema::table('product_batches', fn (Blueprint $table) => $table->dropColumn('retail_price'));
        }
        if (Schema::hasTable('product_variants') && Schema::hasColumn('product_variants', 'wholesale_price')) {
            Schema::table('product_variants', fn (Blueprint $table) => $table->dropColumn('wholesale_price'));
        }
        if (Schema::hasTable('product_variants') && Schema::hasColumn('product_variants', 'retail_price')) {
            Schema::table('product_variants', fn (Blueprint $table) => $table->dropColumn('retail_price'));
        }
        if (Schema::hasTable('products') && Schema::hasColumn('products', 'wholesale_price')) {
            Schema::table('products', fn (Blueprint $table) => $table->dropColumn('wholesale_price'));
        }
        if (Schema::hasTable('products') && Schema::hasColumn('products', 'retail_price')) {
            Schema::table('products', fn (Blueprint $table) => $table->dropColumn('retail_price'));
        }
    }
};
