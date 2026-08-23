<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $hasWebsite = Schema::hasColumn('products', 'sell_on_website');
        $hasSocial = Schema::hasColumn('products', 'sell_on_social');
        $hasPos = Schema::hasColumn('products', 'sell_on_pos');

        Schema::table('products', function (Blueprint $table) use ($hasWebsite, $hasSocial, $hasPos): void {
            if (! $hasWebsite) {
                $table->boolean('sell_on_website')->default(true)->after('visible_in_shop');
            }
            if (! $hasSocial) {
                $table->boolean('sell_on_social')->default(true)->after('sell_on_website');
            }
            if (! $hasPos) {
                $table->boolean('sell_on_pos')->default(true)->after('sell_on_social');
            }
        });
    }

    public function down(): void
    {
        $columns = collect(['sell_on_website', 'sell_on_social', 'sell_on_pos'])
            ->filter(fn (string $column): bool => Schema::hasColumn('products', $column))
            ->values()
            ->all();

        if ($columns !== []) {
            Schema::table('products', fn (Blueprint $table) => $table->dropColumn($columns));
        }
    }
};
