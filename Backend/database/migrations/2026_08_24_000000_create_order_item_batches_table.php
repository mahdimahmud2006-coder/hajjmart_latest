<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_items') && ! Schema::hasColumn('order_items', 'batch_id')) {
            Schema::table('order_items', function (Blueprint $table): void {
                $table->unsignedBigInteger('batch_id')->nullable()->after('variant_id');
            });
        }

        if (! Schema::hasTable('order_item_batches')) {
            Schema::create('order_item_batches', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('order_item_id');
                $table->unsignedBigInteger('product_batch_id');
                $table->integer('quantity');
                $table->decimal('cost_price', 12, 4);
                $table->timestamps();

                $table->foreign('order_item_id')->references('id')->on('order_items')->onDelete('cascade');
                $table->foreign('product_batch_id')->references('id')->on('product_batches')->onDelete('cascade');
                $table->index(['order_item_id', 'product_batch_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('order_item_batches');

        if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'batch_id')) {
            Schema::table('order_items', function (Blueprint $table): void {
                $table->dropColumn('batch_id');
            });
        }
    }
};
