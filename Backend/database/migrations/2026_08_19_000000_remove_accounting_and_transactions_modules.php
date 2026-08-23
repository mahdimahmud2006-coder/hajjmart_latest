<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('permissions')) {
            $permissionIds = DB::table('permissions')
                ->where('name', 'like', 'transactions.%')
                ->orWhere('name', 'like', 'accounting.%')
                ->pluck('id');

            if ($permissionIds->isNotEmpty() && Schema::hasTable('permission_role')) {
                DB::table('permission_role')->whereIn('permission_id', $permissionIds)->delete();
            }

            if ($permissionIds->isNotEmpty()) {
                DB::table('permissions')->whereIn('id', $permissionIds)->delete();
            }
        }

        Schema::dropIfExists('journal_lines');
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('posting_rules');
        Schema::dropIfExists('fiscal_periods');
        Schema::dropIfExists('accounts');
        Schema::dropIfExists('dimension_values');
        Schema::dropIfExists('account_dimensions');
        Schema::dropIfExists('legal_entities');
        Schema::dropIfExists('business_transactions');
    }

    public function down(): void
    {
        // Removed modules are intentionally not recreated on rollback. Their original
        // historical migrations remain in the repository for schema history.
    }
};
