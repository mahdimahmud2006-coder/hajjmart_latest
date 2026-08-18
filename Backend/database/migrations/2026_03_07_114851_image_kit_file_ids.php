<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('imagekit_file_ids', function (Blueprint $table) {
            $table->id();
            $table->string('url')->unique();
            $table->string('file_id');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('imagekit_file_ids');
    }
};