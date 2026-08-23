<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            if (! Schema::hasColumn('orders', 'offline_recovery_case_id')) {
                $table->foreignId('offline_recovery_case_id')->nullable()->constrained('offline_recovery_cases')->nullOnDelete();
            }
            if (! Schema::hasColumn('orders', 'manual_outage_reference')) {
                $table->string('manual_outage_reference')->nullable()->index();
            }
            if (! Schema::hasColumn('orders', 'manual_outage_occurred_at')) {
                $table->timestamp('manual_outage_occurred_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            if (Schema::hasColumn('orders', 'offline_recovery_case_id')) {
                $table->dropForeign(['offline_recovery_case_id']);
                $table->dropColumn('offline_recovery_case_id');
            }
            if (Schema::hasColumn('orders', 'manual_outage_reference')) {
                $table->dropColumn('manual_outage_reference');
            }
            if (Schema::hasColumn('orders', 'manual_outage_occurred_at')) {
                $table->dropColumn('manual_outage_occurred_at');
            }
        });
    }
};
