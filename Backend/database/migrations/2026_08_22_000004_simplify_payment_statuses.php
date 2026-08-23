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
            // Remap existing payment_status strings to simplified 3-status schema: due, partially_paid, paid
            DB::table('orders')->whereIn('payment_status', ['unpaid', 'pending', 'failed', 'Unpaid', 'Pending', 'Failed'])->update(['payment_status' => 'due']);
            DB::table('orders')->whereIn('payment_status', ['partial', 'partially_refunded', 'partial_refund', 'Partial', 'Partially Refunded'])->update(['payment_status' => 'partially_paid']);
            DB::table('orders')->whereIn('payment_status', ['paid', 'completed', 'refunded', 'Paid', 'Completed', 'Refunded'])->update(['payment_status' => 'paid']);

            // Update column default to 'due'
            Schema::table('orders', function (Blueprint $table): void {
                $table->string('payment_status')->default('due')->change();
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
                $table->string('payment_status')->default('due')->change();
            });
        }
    }
};
