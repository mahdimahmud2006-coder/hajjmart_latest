<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function addColumn(string $table, string $column, callable $definition): void
    {
        if (! Schema::hasColumn($table, $column)) {
            Schema::table($table, function (Blueprint $blueprint) use ($definition): void {
                $definition($blueprint);
            });
        }
    }

    public function up(): void
    {
        if (! Schema::hasTable('vendors')) {
            return;
        }

        // Vendors are now supplier/original-retailer records only. They are not users.
        $this->addColumn('vendors', 'contact_person', fn (Blueprint $table) => $table->string('contact_person')->nullable()->after('description'));
        $this->addColumn('vendors', 'address', fn (Blueprint $table) => $table->text('address')->nullable()->after('contact_phone'));
        $this->addColumn('vendors', 'trade_license_no', fn (Blueprint $table) => $table->string('trade_license_no')->nullable()->after('address'));
        $this->addColumn('vendors', 'notes', fn (Blueprint $table) => $table->text('notes')->nullable()->after('is_active'));

        if (Schema::hasTable('product_answers')) {
            $this->addColumn('product_answers', 'is_admin', fn (Blueprint $table) => $table->boolean('is_admin')->default(false)->after('user_id'));
        }

        // Keep legacy columns if they already exist to avoid destructive migration surprises.
        // The application no longer reads user_id, commission_rate, is_verified, banner,
        // product.vendor_id, inventory.vendor_id, or order_items.vendor_id.
    }

    public function down(): void
    {
        // Non-destructive by design. Supplier-vendor columns can remain safely.
    }
};
