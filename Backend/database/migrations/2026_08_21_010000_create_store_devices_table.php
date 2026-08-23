<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('store_devices')) {
            return;
        }

        Schema::create('store_devices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('shop_id')->unique()->constrained('shops')->cascadeOnDelete();
            $table->uuid('device_uuid')->unique();
            $table->string('device_token_hash', 64);
            $table->unsignedInteger('binding_version')->default(1);
            $table->string('status')->default('active')->index();
            $table->string('operational_state')->default('normal')->index();
            $table->foreignId('registered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('registered_at')->nullable();
            $table->timestamp('last_heartbeat_at')->nullable()->index();
            $table->foreignId('last_seen_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('last_app_version')->nullable();
            $table->timestamp('replaced_at')->nullable();
            $table->foreignId('replaced_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_devices');
    }
};
