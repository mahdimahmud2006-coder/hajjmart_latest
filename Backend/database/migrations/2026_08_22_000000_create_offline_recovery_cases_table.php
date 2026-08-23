<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('offline_recovery_cases')) {
            Schema::create('offline_recovery_cases', function (Blueprint $table): void {
                $table->id();
                $table->string('case_number')->unique();
                $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
                $table->foreignId('store_device_id')->nullable()->constrained('store_devices')->nullOnDelete();
                $table->foreignId('offline_inventory_session_id')->nullable()->constrained('offline_inventory_sessions')->nullOnDelete();
                $table->string('reason_code')->index();
                $table->string('status')->default('open')->index();
                $table->timestamp('opened_at')->nullable();
                $table->foreignId('opened_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->json('evidence_json')->nullable();
                $table->string('resolution_action')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->foreignId('resolved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['shop_id', 'status'], 'offline_recovery_shop_status_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('offline_recovery_cases');
    }
};
