<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Clean manual test slate for the new promotion-floor behaviour.
        if (Schema::hasTable('coupon_usages')) {
            DB::table('coupon_usages')->delete();
        }
        if (Schema::hasTable('coupons')) {
            DB::table('coupons')->delete();
        }
    }

    public function down(): void
    {
        // Removed test promotions cannot be reconstructed safely.
    }
};
