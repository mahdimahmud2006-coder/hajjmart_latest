<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            if (! Schema::hasColumn('orders', 'offline_inventory_session_id')) {
                $table->foreignId('offline_inventory_session_id')->nullable()->after('client_transaction_id')->constrained('offline_inventory_sessions', indexName: 'orders_offsess_fk')->nullOnDelete();
            }
            if (! Schema::hasColumn('orders', 'local_sequence')) {
                $table->unsignedBigInteger('local_sequence')->nullable()->after('offline_inventory_session_id')->index();
            }
            if (! Schema::hasColumn('orders', 'reconciliation_status')) {
                $table->string('reconciliation_status', 40)->default('normal')->after('local_sequence')->index();
            }
            if (! Schema::hasColumn('orders', 'preempted_by_session_id')) {
                $table->foreignId('preempted_by_session_id')->nullable()->after('reconciliation_status')->constrained('offline_inventory_sessions', indexName: 'orders_preempt_fk')->nullOnDelete();
            }
            if (! Schema::hasColumn('orders', 'cancellation_reason_code')) {
                $table->string('cancellation_reason_code', 100)->nullable()->after('preempted_by_session_id')->index();
            }
        });

        if (! Schema::hasTable('offline_event_receipts')) {
            Schema::create('offline_event_receipts', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
                $table->foreignId('store_device_id')->constrained('store_devices')->cascadeOnDelete();
                $table->foreignId('offline_inventory_session_id')->constrained('offline_inventory_sessions', indexName: 'receipts_offsess_fk')->cascadeOnDelete();
                $table->uuid('client_transaction_id');
                $table->unsignedBigInteger('local_sequence');
                $table->string('event_type', 30);
                $table->char('event_hash', 64);
                $table->foreignId('server_order_id')->nullable()->constrained('orders')->nullOnDelete();
                $table->string('result_code', 80);
                $table->json('result_json')->nullable();
                $table->timestamps();
                $table->unique(['store_device_id', 'client_transaction_id'], 'offline_receipts_device_tx_unique');
                $table->unique(['offline_inventory_session_id', 'local_sequence'], 'offline_receipts_session_seq_unique');
            });
        }

        if (! Schema::hasTable('offline_reconciliation_actions')) {
            Schema::create('offline_reconciliation_actions', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('offline_inventory_session_id')->constrained('offline_inventory_sessions', indexName: 'actions_offsess_fk')->cascadeOnDelete();
                $table->string('action_type', 40);
                $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
                $table->string('status', 30)->default('pending')->index();
                $table->decimal('amount', 14, 2)->nullable();
                $table->string('currency', 8)->nullable();
                $table->string('reason_code', 100);
                $table->string('idempotency_key', 190)->unique();
                $table->unsignedInteger('attempts')->default(0);
                $table->string('last_error_code', 100)->nullable();
                $table->json('metadata')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('offline_reconciliation_actions');
        Schema::dropIfExists('offline_event_receipts');
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('preempted_by_session_id');
            $table->dropConstrainedForeignId('offline_inventory_session_id');
            $table->dropColumn(['local_sequence', 'reconciliation_status', 'cancellation_reason_code']);
        });
    }
};
