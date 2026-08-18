<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'name_bn')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('name_bn')->nullable()->after('name');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'name_bn')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropColumn('name_bn');
            });
        }
    }
};
