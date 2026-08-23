<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function add(string $table, string $column, callable $definition): void
    {
        if (Schema::hasTable($table) && ! Schema::hasColumn($table, $column)) {
            Schema::table($table, function (Blueprint $blueprint) use ($definition): void {
                $definition($blueprint);
            });
        }
    }

    public function up(): void
    {
        // Human-readable roles and granular page/action permissions.
        $this->add('roles', 'slug', fn (Blueprint $table) => $table->string('slug')->nullable()->unique()->after('name'));
        $this->add('roles', 'description', fn (Blueprint $table) => $table->text('description')->nullable());
        $this->add('roles', 'is_system', fn (Blueprint $table) => $table->boolean('is_system')->default(false));
        $this->add('roles', 'is_active', fn (Blueprint $table) => $table->boolean('is_active')->default(true));

        $this->add('permissions', 'group', fn (Blueprint $table) => $table->string('group')->default('General')->index());
        $this->add('permissions', 'label', fn (Blueprint $table) => $table->string('label')->nullable());
        $this->add('permissions', 'description', fn (Blueprint $table) => $table->text('description')->nullable());
        $this->add('permissions', 'sort_order', fn (Blueprint $table) => $table->unsignedInteger('sort_order')->default(0));

        if (! Schema::hasTable('permission_role')) {
            Schema::create('permission_role', function (Blueprint $table): void {
                $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
                $table->foreignId('role_id')->constrained()->cascadeOnDelete();
                $table->primary(['permission_id', 'role_id']);
            });
        }

        // Multi-store operating model. One store works as a complete single-store system.
        $this->add('shops', 'name', fn (Blueprint $table) => $table->string('name')->default('HajjMart Main Store'));
        $this->add('shops', 'code', fn (Blueprint $table) => $table->string('code')->nullable()->unique());
        $this->add('shops', 'slug', fn (Blueprint $table) => $table->string('slug')->nullable()->unique());
        $this->add('shops', 'address', fn (Blueprint $table) => $table->text('address')->nullable());
        $this->add('shops', 'phone', fn (Blueprint $table) => $table->string('phone')->nullable());
        $this->add('shops', 'email', fn (Blueprint $table) => $table->string('email')->nullable());
        $this->add('shops', 'manager_id', fn (Blueprint $table) => $table->foreignId('manager_id')->nullable()->constrained('users')->nullOnDelete());
        $this->add('shops', 'is_active', fn (Blueprint $table) => $table->boolean('is_active')->default(true)->index());
        $this->add('shops', 'is_default', fn (Blueprint $table) => $table->boolean('is_default')->default(false)->index());
        $this->add('shops', 'settings', fn (Blueprint $table) => $table->json('settings')->nullable());

        // Employees are regular users with operational metadata and one or more roles.
        $this->add('users', 'employee_code', fn (Blueprint $table) => $table->string('employee_code')->nullable()->unique());
        $this->add('users', 'designation', fn (Blueprint $table) => $table->string('designation')->nullable());
        $this->add('users', 'employment_type', fn (Blueprint $table) => $table->string('employment_type')->nullable());
        $this->add('users', 'shop_id', fn (Blueprint $table) => $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete());
        $this->add('users', 'joined_at', fn (Blueprint $table) => $table->date('joined_at')->nullable());
        $this->add('users', 'last_login_at', fn (Blueprint $table) => $table->timestamp('last_login_at')->nullable());
        $this->add('users', 'created_by', fn (Blueprint $table) => $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete());
        $this->add('users', 'notes', fn (Blueprint $table) => $table->text('notes')->nullable());

        // Store-aware inventory. Existing stock is attached to the default store below.
        $this->add('inventory', 'shop_id', fn (Blueprint $table) => $table->foreignId('shop_id')->nullable()->constrained('shops')->cascadeOnDelete());
        $this->add('inventory', 'bin_location', fn (Blueprint $table) => $table->string('bin_location')->nullable());
        $this->add('inventory', 'last_counted_at', fn (Blueprint $table) => $table->timestamp('last_counted_at')->nullable());

        // MySQL can refuse to drop the old product+variant unique key when that key is
        // also being used by the product foreign key. Add dedicated lookup indexes first,
        // then remove the legacy global key and create the correct store-scoped key.
        if (Schema::hasTable('inventory')) {
            foreach ([
                ['column' => 'product_id', 'name' => 'inventory_product_id_lookup_index'],
                ['column' => 'variant_id', 'name' => 'inventory_variant_id_lookup_index'],
                ['column' => 'shop_id', 'name' => 'inventory_shop_id_lookup_index'],
            ] as $index) {
                try {
                    Schema::table('inventory', function (Blueprint $table) use ($index): void {
                        $table->index($index['column'], $index['name']);
                    });
                } catch (Throwable) {
                    // The column already has a usable index on upgraded databases.
                }
            }

            try {
                Schema::table('inventory', function (Blueprint $table): void {
                    $table->dropUnique('inventory_product_id_variant_id_unique');
                });
            } catch (Throwable) {
                // The legacy unique index may already be absent.
            }

            try {
                Schema::table('inventory', function (Blueprint $table): void {
                    $table->unique(['product_id', 'variant_id', 'shop_id'], 'inventory_product_variant_shop_unique');
                });
            } catch (Throwable) {
                // A final repair migration verifies and corrects the actual index layout.
            }
        }

        $this->add('stock_movements', 'shop_id', fn (Blueprint $table) => $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete());
        $this->add('stock_movements', 'balance_after', fn (Blueprint $table) => $table->integer('balance_after')->nullable());
        $this->add('stock_movements', 'reason_code', fn (Blueprint $table) => $table->string('reason_code')->nullable()->index());

        $this->add('purchase_orders', 'shop_id', fn (Blueprint $table) => $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete());
        $this->add('purchase_orders', 'approved_by', fn (Blueprint $table) => $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete());
        $this->add('purchase_orders', 'approved_at', fn (Blueprint $table) => $table->timestamp('approved_at')->nullable());
        $this->add('purchase_orders', 'payment_status', fn (Blueprint $table) => $table->string('payment_status')->default('unpaid')->index());
        $this->add('purchase_orders', 'paid_amount', fn (Blueprint $table) => $table->decimal('paid_amount', 12, 2)->default(0));
        $this->add('purchase_orders', 'reference_no', fn (Blueprint $table) => $table->string('reference_no')->nullable());

        if (! Schema::hasTable('vendor_payments')) {
            Schema::create('vendor_payments', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
                $table->foreignId('purchase_order_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete();
                $table->decimal('amount', 12, 2);
                $table->string('payment_method')->default('cash');
                $table->string('reference')->nullable();
                $table->text('note')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('paid_at')->nullable();
                $table->timestamps();
            });
        }

        // One order ledger for POS, social-commerce and website orders.
        $this->add('orders', 'shop_id', fn (Blueprint $table) => $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete());
        $this->add('orders', 'created_by', fn (Blueprint $table) => $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete());
        $this->add('orders', 'assigned_to', fn (Blueprint $table) => $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete());
        $this->add('orders', 'order_date', fn (Blueprint $table) => $table->dateTime('order_date')->nullable()->index());
        $this->add('orders', 'paid_amount', fn (Blueprint $table) => $table->decimal('paid_amount', 12, 2)->default(0));
        $this->add('orders', 'due_amount', fn (Blueprint $table) => $table->decimal('due_amount', 12, 2)->default(0));
        $this->add('orders', 'source_reference', fn (Blueprint $table) => $table->string('source_reference')->nullable()->index());
        $this->add('orders', 'priority', fn (Blueprint $table) => $table->string('priority')->default('normal')->index());
        $this->add('orders', 'delivery_status', fn (Blueprint $table) => $table->string('delivery_status')->nullable()->index());

        $this->add('payments', 'received_by', fn (Blueprint $table) => $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete());
        $this->add('payments', 'payment_reference', fn (Blueprint $table) => $table->string('payment_reference')->nullable()->index());
        $this->add('payments', 'refunded_amount', fn (Blueprint $table) => $table->decimal('refunded_amount', 12, 2)->default(0));
        $this->add('payments', 'refund_status', fn (Blueprint $table) => $table->string('refund_status')->nullable()->index());

        $this->add('return_requests', 'shop_id', fn (Blueprint $table) => $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete());
        $this->add('return_requests', 'created_by', fn (Blueprint $table) => $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete());
        $this->add('return_requests', 'resolution_type', fn (Blueprint $table) => $table->string('resolution_type')->nullable());
        $this->add('return_requests', 'refund_method', fn (Blueprint $table) => $table->string('refund_method')->nullable());
        $this->add('return_requests', 'restock_strategy', fn (Blueprint $table) => $table->string('restock_strategy')->default('sellable'));

        if (! Schema::hasTable('activity_logs')) {
            Schema::create('activity_logs', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete();
                $table->string('module')->index();
                $table->string('action')->index();
                $table->string('subject_type')->nullable();
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->string('description');
                $table->json('before')->nullable();
                $table->json('after')->nullable();
                $table->string('ip_address')->nullable();
                $table->text('user_agent')->nullable();
                $table->timestamps();
                $table->index(['subject_type', 'subject_id']);
            });
        }

        if (! Schema::hasTable('stock_transfers')) {
            Schema::create('stock_transfers', function (Blueprint $table): void {
                $table->id();
                $table->string('transfer_number')->unique();
                $table->foreignId('from_shop_id')->constrained('shops')->restrictOnDelete();
                $table->foreignId('to_shop_id')->constrained('shops')->restrictOnDelete();
                $table->string('status')->default('draft')->index();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('note')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->timestamp('received_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('stock_transfer_items')) {
            Schema::create('stock_transfer_items', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('stock_transfer_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->foreignId('variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
                $table->unsignedInteger('quantity_requested');
                $table->unsignedInteger('quantity_received')->default(0);
                $table->timestamps();
            });
        }

        // Ensure there is always a usable default store for single-store deployments.
        if (Schema::hasTable('shops')) {
            $defaultShopId = DB::table('shops')->value('id');
            if (! $defaultShopId) {
                $defaultShopId = DB::table('shops')->insertGetId([
                    'name' => 'HajjMart Main Store',
                    'code' => 'MAIN',
                    'slug' => 'main-store',
                    'is_active' => true,
                    'is_default' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('shops')->where('id', $defaultShopId)->update(['is_default' => true]);
            }

            if (Schema::hasColumn('inventory', 'shop_id')) {
                DB::table('inventory')->whereNull('shop_id')->update(['shop_id' => $defaultShopId]);
            }
            if (Schema::hasColumn('orders', 'shop_id')) {
                DB::table('orders')->whereNull('shop_id')->update(['shop_id' => $defaultShopId]);
            }
            if (Schema::hasColumn('purchase_orders', 'shop_id')) {
                DB::table('purchase_orders')->whereNull('shop_id')->update(['shop_id' => $defaultShopId]);
            }
        }
    }

    public function down(): void
    {
        // Deliberately non-destructive. Operational data must not be removed on rollback.
    }
};
