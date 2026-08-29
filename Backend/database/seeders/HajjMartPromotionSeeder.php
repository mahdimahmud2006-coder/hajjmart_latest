<?php

namespace Database\Seeders;

use App\Models\Coupon;
use Illuminate\Database\Seeder;

class HajjMartPromotionSeeder extends Seeder
{
    public function run(): void
    {
        // Intentionally empty by default: promotions are created from Admin > Promotions.
        Coupon::query()->delete();
    }
}
