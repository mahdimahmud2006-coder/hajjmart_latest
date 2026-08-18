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
        Schema::table('product_batches', function (Blueprint $table) {
            $table->unsignedBigInteger('variation_id')->nullable()->after('product_id');
            $table->foreign('variation_id')->references('id')->on('variations')->onDelete('cascade');
        });

        Schema::table('reserved_products', function (Blueprint $table) {
            $table->unsignedBigInteger('variation_id')->nullable()->after('product_id');
            $table->index('variation_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reserved_products', function (Blueprint $table) {
            $table->dropIndex(['variation_id']);
            $table->dropColumn('variation_id');
        });

        Schema::table('product_batches', function (Blueprint $table) {
            $table->dropForeign(['variation_id']);
            $table->dropColumn('variation_id');
        });
    }
};
