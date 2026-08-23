<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('shops', 'inventory_revision')) {
            Schema::table('shops', function (Blueprint $table): void {
                $table->unsignedBigInteger('inventory_revision')->default(1)->after('settings');
            });
        }

        if (! Schema::hasTable('offline_inventory_sessions')) {
            Schema::create('offline_inventory_sessions', function (Blueprint $table): void {
                $table->id();
                $table->uuid('session_id')->unique();
                $table->uuid('snapshot_id')->unique();
                $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
                $table->foreignId('store_device_id')->constrained('store_devices')->cascadeOnDelete();
                $table->unsignedInteger('binding_version');
                $table->timestamp('boundary_server_at');
                $table->unsignedBigInteger('opening_inventory_revision');
                $table->string('status')->default('open')->index();
                $table->timestamp('opened_at');
                $table->unsignedBigInteger('last_client_sequence')->default(0);
                $table->timestamp('reconciling_at')->nullable();
                $table->timestamp('closed_at')->nullable();
                $table->string('recovery_reason_code')->nullable();
                $table->json('reconciliation_summary_json')->nullable();
                $table->timestamps();
                $table->index(['shop_id', 'status'], 'offline_session_shop_status_index');
                $table->index(['store_device_id', 'binding_version', 'status'], 'offline_session_device_status_index');
            });
        }

        if (! Schema::hasTable('offline_inventory_snapshot_items')) {
            Schema::create('offline_inventory_snapshot_items', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('offline_inventory_session_id');
                $table->foreign('offline_inventory_session_id', 'offline_snapshot_session_fk')
                    ->references('id')->on('offline_inventory_sessions')->cascadeOnDelete();
                $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
                $table->foreignId('variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
                $table->unsignedBigInteger('variant_key')->default(0);
                $table->string('sku_snapshot')->nullable();
                $table->string('product_name_snapshot');
                $table->unsignedInteger('opening_quantity');
                $table->unsignedInteger('opening_reserved');
                $table->unsignedInteger('opening_available');
                $table->decimal('retail_price', 15, 2)->default(0);
                $table->decimal('wholesale_price', 15, 2)->default(0);
                $table->boolean('sell_on_pos')->default(false);
                $table->boolean('sell_on_social')->default(false);
                $table->boolean('product_active')->default(true);
                $table->timestamp('created_at')->nullable();
                $table->unique(
                    ['offline_inventory_session_id', 'product_id', 'variant_key'],
                    'offline_snapshot_item_sku_unique'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('offline_inventory_snapshot_items');
        Schema::dropIfExists('offline_inventory_sessions');
        if (Schema::hasColumn('shops', 'inventory_revision')) {
            Schema::table('shops', fn (Blueprint $table) => $table->dropColumn('inventory_revision'));
        }
    }
};
