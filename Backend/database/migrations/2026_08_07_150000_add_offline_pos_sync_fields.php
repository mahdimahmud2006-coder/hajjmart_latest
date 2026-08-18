<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            if (! Schema::hasColumn('orders', 'terminal_id')) {
                $table->string('terminal_id', 120)->nullable()->after('source_reference')->index();
            }
            if (! Schema::hasColumn('orders', 'client_transaction_id')) {
                $table->uuid('client_transaction_id')->nullable()->after('terminal_id');
            }
            if (! Schema::hasColumn('orders', 'offline_created_at')) {
                $table->timestamp('offline_created_at')->nullable()->after('client_transaction_id');
            }
            if (! Schema::hasColumn('orders', 'synced_at')) {
                $table->timestamp('synced_at')->nullable()->after('offline_created_at');
            }
        });

        // Nullable values keep all historical/non-POS orders compatible while
        // making every offline terminal transaction idempotent once populated.
        Schema::table('orders', function (Blueprint $table): void {
            $table->unique(
                ['shop_id', 'terminal_id', 'client_transaction_id'],
                'orders_offline_pos_transaction_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropUnique('orders_offline_pos_transaction_unique');
            foreach (['synced_at', 'offline_created_at', 'client_transaction_id', 'terminal_id'] as $column) {
                if (Schema::hasColumn('orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
