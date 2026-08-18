<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('order_lists') || Schema::hasColumn('order_lists', 'shop_id')) {
            return;
        }

        Schema::table('order_lists', function (Blueprint $table): void {
            $table->foreignId('shop_id')
                ->nullable()
                ->after('id')
                ->constrained('shops')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('order_lists') && Schema::hasColumn('order_lists', 'shop_id')) {
            Schema::table('order_lists', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('shop_id');
            });
        }
    }
};
