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
        if (Schema::hasTable('orders')) {
            // Remap existing status strings to simplified 5-status schema
            DB::table('orders')->whereIn('status', ['processing', 'ready_to_ship'])->update(['status' => 'confirmed']);
            DB::table('orders')->whereIn('order_status', ['processing', 'ready_to_ship', 'Confirmed', 'Processing', 'Ready to Ship'])->update(['order_status' => 'confirmed']);

            DB::table('orders')->whereIn('status', ['out_for_delivery', 'completed'])->update(['status' => 'delivered']);
            DB::table('orders')->whereIn('order_status', ['out_for_delivery', 'completed', 'Delivered', 'Completed', 'Out for Delivery'])->update(['order_status' => 'delivered']);

            DB::table('orders')->whereIn('status', ['cancelled', 'return_requested', 'refunded'])->update(['status' => 'returned']);
            DB::table('orders')->whereIn('order_status', ['cancelled', 'return_requested', 'refunded', 'Cancelled', 'Return Requested', 'Refunded'])->update(['order_status' => 'returned']);

            DB::table('orders')->whereIn('status', ['Pending'])->update(['status' => 'pending']);
            DB::table('orders')->whereIn('order_status', ['Pending'])->update(['order_status' => 'pending']);

            // Update column default to 'confirmed'
            Schema::table('orders', function (Blueprint $table): void {
                $table->string('status')->default('confirmed')->change();
                $table->string('order_status')->default('confirmed')->change();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->string('status')->default('pending')->change();
                $table->string('order_status')->default('pending')->change();
            });
        }
    }
};
