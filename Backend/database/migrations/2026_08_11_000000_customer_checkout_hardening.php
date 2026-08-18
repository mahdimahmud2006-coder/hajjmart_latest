<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('orders', 'checkout_idempotency_key')) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->uuid('checkout_idempotency_key')->nullable()->after('client_transaction_id');
                $table->unique('checkout_idempotency_key', 'orders_checkout_idempotency_key_unique');
            });
        }

        Schema::table('reserved_products', function (Blueprint $table): void {
            if (! Schema::hasColumn('reserved_products', 'variant_id')) {
                $table->foreignId('variant_id')->nullable()->after('variation_id')->constrained('product_variants')->nullOnDelete();
            }
            if (! Schema::hasColumn('reserved_products', 'shop_id')) {
                $table->foreignId('shop_id')->nullable()->after('variant_id')->constrained('shops')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'checkout_idempotency_key')) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->dropUnique('orders_checkout_idempotency_key_unique');
                $table->dropColumn('checkout_idempotency_key');
            });
        }

        Schema::table('reserved_products', function (Blueprint $table): void {
            if (Schema::hasColumn('reserved_products', 'shop_id')) {
                $table->dropConstrainedForeignId('shop_id');
            }
            if (Schema::hasColumn('reserved_products', 'variant_id')) {
                $table->dropConstrainedForeignId('variant_id');
            }
        });
    }
};
