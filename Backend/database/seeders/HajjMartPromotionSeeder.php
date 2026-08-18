<?php

namespace Database\Seeders;

use App\Models\Coupon;
use Illuminate\Database\Seeder;

class HajjMartPromotionSeeder extends Seeder
{
    public function run(): void
    {
        Coupon::whereIn('code', ['FREESHIPBD'])->delete();

        Coupon::updateOrCreate(
            ['code' => 'UMRAH5'],
            [
                'title' => 'Umrah Preparation Sale — 5% Off',
                'description' => 'Public HajjMart promotion valid across the catalogue.',
                'type' => 'percent',
                'value' => 5,
                'min_order_amount' => 0,
                'max_discount_amount' => 500,
                'usage_limit' => 1000,
                'per_customer_limit' => 2,
                'used_count' => 0,
                'is_active' => true,
                'visibility' => 'public',
                'promotion_type' => 'public_sale',
                'discount_scope' => 'items',
                'stackable' => false,
                'auto_apply' => false,
                'priority' => 20,
                'applicable_to' => 'all',
                'starts_at' => now()->subDays(30),
                'expires_at' => now()->addDays(30),
            ]
        );
    }
}
