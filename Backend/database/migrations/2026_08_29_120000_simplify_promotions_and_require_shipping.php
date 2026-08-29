<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('coupons')) {
            return;
        }

        // Keep history, but legacy free-shipping offers can never become active again.
        DB::table('coupons')
            ->where(function ($query): void {
                $query->where('type', 'free_shipping')->orWhere('discount_scope', 'shipping');
            })
            ->update(['is_active' => false, 'stackable' => false]);

        DB::table('coupons')
            ->whereIn('type', ['fixed', 'percent'])
            ->update(['discount_scope' => 'items', 'stackable' => false, 'stop_further_promotions' => false]);

        DB::table('coupons')->where('promotion_type', 'private_coupon')->update(['promotion_type' => 'coupon', 'visibility' => 'private', 'auto_apply' => false]);

        DB::table('coupons')
            ->where(function ($query): void {
                $query->whereNull('applicable_to')->orWhereNotIn('applicable_to', ['all', 'product', 'category']);
            })
            ->update([
                'applicable_to' => 'all',
                'included_product_ids' => null,
                'included_category_ids' => null,
                'excluded_product_ids' => null,
                'excluded_category_ids' => null,
            ]);
    }

    public function down(): void
    {
        // Intentionally non-destructive: removed free-shipping/stacking behavior is not restored.
    }
};
