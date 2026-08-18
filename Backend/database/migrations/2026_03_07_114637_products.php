<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();

            $table->string('name');

            $table->decimal('selling_price', 15, 2)->default(0);

            $table->unsignedBigInteger('sold_count')->default(0);

            $table->unsignedBigInteger('total_count')->default(0);

            $table->json('image_src')->nullable();

            $table->text('description')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};