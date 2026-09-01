<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'priority')) {
            try {
                Schema::table('orders', function (Blueprint $table) {
                    $table->dropIndex(['priority']);
                });
            } catch (\Throwable) {
            }

            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('priority');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('orders', 'priority')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->string('priority')->default('normal')->index();
            });
        }
    }
};
