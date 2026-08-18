<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('selling_price', 15, 2)->nullable()->change();
            $table->boolean('has_dynamic_pricing')->default(false)->after('selling_price');
            $table->json('price_slabs')->nullable()->after('has_dynamic_pricing');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('selling_price', 15, 2)->nullable(false)->change();
            $table->dropColumn(['has_dynamic_pricing', 'price_slabs']);
        });
    }
};
