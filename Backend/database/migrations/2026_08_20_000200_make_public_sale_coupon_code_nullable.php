<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('coupons', function (Blueprint $table): void {
            $table->string('code')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Public sales can legitimately have no code; keep rollback non-destructive.
    }
};
