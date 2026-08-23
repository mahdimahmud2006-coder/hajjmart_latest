<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('products')) {
            DB::table('products')->update([
                'sell_on_website' => true,
                'sell_on_social' => true,
                'sell_on_pos' => true,
                'visible_in_shop' => DB::raw('is_active'),
            ]);
        }

        if (Schema::hasTable('offline_inventory_snapshot_items')) {
            DB::table('offline_inventory_snapshot_items')->update([
                'sell_on_pos' => true,
                'sell_on_social' => true,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op for channel restriction removal reset
    }
};
