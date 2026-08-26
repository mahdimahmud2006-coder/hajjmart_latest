<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'is_potential_fraud')) {
                $table->boolean('is_potential_fraud')->default(false)->index()->after('pathao_consignment_id');
            }
            if (! Schema::hasColumn('orders', 'fraud_score')) {
                $table->integer('fraud_score')->nullable()->after('is_potential_fraud');
            }
            if (! Schema::hasColumn('orders', 'fraud_reasons')) {
                $table->json('fraud_reasons')->nullable()->after('fraud_score');
            }
            if (! Schema::hasColumn('orders', 'fraud_checked_at')) {
                $table->timestamp('fraud_checked_at')->nullable()->after('fraud_reasons');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $columnsToDrop = [];
            if (Schema::hasColumn('orders', 'is_potential_fraud')) {
                $columnsToDrop[] = 'is_potential_fraud';
            }
            if (Schema::hasColumn('orders', 'fraud_score')) {
                $columnsToDrop[] = 'fraud_score';
            }
            if (Schema::hasColumn('orders', 'fraud_reasons')) {
                $columnsToDrop[] = 'fraud_reasons';
            }
            if (Schema::hasColumn('orders', 'fraud_checked_at')) {
                $columnsToDrop[] = 'fraud_checked_at';
            }
            if (! empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
