<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reserved_products', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('product_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->integer('qty')->default(0);
            $table->decimal('price', 15, 2)->default(0); // unit price
            $table->decimal('total', 15, 2)->default(0); // qty * price

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reserved_products');
    }
};