<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'pathao_consignment_id')) {
                $table->string('pathao_consignment_id')->nullable()->after('invoice_printed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'pathao_consignment_id')) {
                $table->dropColumn('pathao_consignment_id');
            }
        });
    }
};
