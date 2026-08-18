<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Procurement is no longer part of HajjMart's product lifecycle.
        // Keep this in a new migration instead of editing migration history so
        // existing databases and fresh installations both upgrade consistently.
        foreach (['vendor_payments', 'purchase_order_receipts', 'purchase_order_items', 'purchase_orders', 'vendor_bank_details', 'vendors'] as $table) {
            Schema::dropIfExists($table);
        }

        if (Schema::hasTable('product_batches')) {
            Schema::table('product_batches', function (Blueprint $table): void {
                if (! Schema::hasColumn('product_batches', 'batch_reference')) {
                    $table->string('batch_reference')->nullable()->index()->after('id');
                }
                if (! Schema::hasColumn('product_batches', 'variant_id')) {
                    $table->foreignId('variant_id')->nullable()->after('variation_id')->constrained('product_variants')->nullOnDelete();
                }
                if (! Schema::hasColumn('product_batches', 'shop_id')) {
                    $table->foreignId('shop_id')->nullable()->after('variant_id')->constrained('shops')->nullOnDelete();
                }
                if (! Schema::hasColumn('product_batches', 'initial_quantity')) {
                    $table->unsignedBigInteger('initial_quantity')->default(0)->after('count');
                }
                if (! Schema::hasColumn('product_batches', 'selling_price')) {
                    $table->decimal('selling_price', 15, 2)->default(0)->after('cost_price');
                }
                if (! Schema::hasColumn('product_batches', 'created_by')) {
                    $table->foreignId('created_by')->nullable()->after('selling_price')->constrained('users')->nullOnDelete();
                }
                if (! Schema::hasColumn('product_batches', 'note')) {
                    $table->text('note')->nullable()->after('created_by');
                }
                if (! Schema::hasColumn('product_batches', 'received_at')) {
                    $table->timestamp('received_at')->nullable()->index()->after('note');
                }
            });

            $defaultShopId = Schema::hasTable('shops')
                ? DB::table('shops')->where('is_default', true)->value('id') ?? DB::table('shops')->value('id')
                : null;

            // Row-wise updates avoid driver-specific SQL and work in SQLite tests.
            DB::table('product_batches')
                ->select(['id', 'count', 'created_at', 'batch_reference', 'initial_quantity', 'received_at', 'shop_id'])
                ->orderBy('id')
                ->chunkById(250, function ($rows) use ($defaultShopId): void {
                    foreach ($rows as $row) {
                        $updates = [];
                        if ((int) $row->initial_quantity === 0) {
                            $updates['initial_quantity'] = max(0, (int) $row->count);
                        }
                        if ($row->batch_reference === null || $row->batch_reference === '') {
                            $updates['batch_reference'] = 'MIGRATED-' . $row->id;
                        }
                        if ($row->received_at === null) {
                            $updates['received_at'] = $row->created_at ?? now();
                        }
                        if ($defaultShopId && $row->shop_id === null) {
                            $updates['shop_id'] = $defaultShopId;
                        }
                        if ($updates !== []) {
                            DB::table('product_batches')->where('id', $row->id)->update($updates);
                        }
                    }
                });

            // Existing inventory predating direct batches becomes an opening batch,
            // so every live stock unit has a batch origin after this migration.
            if (Schema::hasTable('inventory')) {
                // The inventory table created by the schema-upgrade migration has
                // updated_at but intentionally has no created_at column. Older databases
                // may have either timestamp (or neither), so select the available one
                // dynamically instead of assuming created_at exists.
                $inventoryTimestampColumn = Schema::hasColumn('inventory', 'created_at')
                    ? 'created_at'
                    : (Schema::hasColumn('inventory', 'updated_at') ? 'updated_at' : null);

                $inventoryColumns = ['id', 'product_id', 'variant_id', 'shop_id', 'quantity'];
                if ($inventoryTimestampColumn !== null) {
                    $inventoryColumns[] = $inventoryTimestampColumn;
                }

                DB::table('inventory')
                    ->select($inventoryColumns)
                    ->where('quantity', '>', 0)
                    ->orderBy('id')
                    ->chunkById(250, function ($rows) use ($inventoryTimestampColumn): void {
                        foreach ($rows as $row) {
                            $inventoryTimestamp = $inventoryTimestampColumn !== null
                                ? ($row->{$inventoryTimestampColumn} ?? null)
                                : null;
                            $tracked = (int) DB::table('product_batches')
                                ->where('product_id', $row->product_id)
                                ->where('shop_id', $row->shop_id)
                                ->when(
                                    $row->variant_id,
                                    fn ($query) => $query->where('variant_id', $row->variant_id),
                                    fn ($query) => $query->whereNull('variant_id')
                                )
                                ->sum('count');

                            $missing = max(0, (int) $row->quantity - $tracked);
                            if ($missing === 0) {
                                continue;
                            }

                            $product = DB::table('products')
                                ->where('id', $row->product_id)
                                ->first(['cost_price', 'selling_price', 'sale_price']);
                            $variant = $row->variant_id
                                ? DB::table('product_variants')->where('id', $row->variant_id)->first(['cost_price', 'price', 'sale_price'])
                                : null;

                            DB::table('product_batches')->insert([
                                'batch_reference' => 'OPENING-INV-' . $row->id,
                                'product_id' => $row->product_id,
                                'variation_id' => null,
                                'variant_id' => $row->variant_id,
                                'shop_id' => $row->shop_id,
                                'count' => $missing,
                                'initial_quantity' => $missing,
                                'cost_price' => $variant?->cost_price ?? $product?->cost_price ?? 0,
                                'selling_price' => $variant?->sale_price ?? $variant?->price ?? $product?->sale_price ?? $product?->selling_price ?? 0,
                                'created_by' => null,
                                'note' => 'Opening batch generated while migrating existing inventory.',
                                'received_at' => $inventoryTimestamp ?? now(),
                                'created_at' => $inventoryTimestamp ?? now(),
                                'updated_at' => now(),
                            ]);
                        }
                    });
            }

            // Rebuild product and variation sellability from batch balances.
            // This closes stale pre-migration flags where a zero-stock item was
            // still marked purchasable, or live inventory lacked a batch origin.
            if (Schema::hasTable('products')) {
                DB::table('products')->select('id')->orderBy('id')->chunkById(250, function ($rows): void {
                    foreach ($rows as $row) {
                        $total = (int) DB::table('product_batches')->where('product_id', $row->id)->sum('count');
                        $updates = [];
                        if (Schema::hasColumn('products', 'total_count')) $updates['total_count'] = $total;
                        if (Schema::hasColumn('products', 'stock_status')) $updates['stock_status'] = $total > 0 ? 'in_stock' : 'out_of_stock';
                        if (Schema::hasColumn('products', 'purchasable')) $updates['purchasable'] = $total > 0;
                        if ($updates !== []) DB::table('products')->where('id', $row->id)->update($updates);
                    }
                });
            }

            if (Schema::hasTable('product_variants')) {
                DB::table('product_variants')->select('id')->orderBy('id')->chunkById(250, function ($rows): void {
                    foreach ($rows as $row) {
                        $available = (int) DB::table('product_batches')->where('variant_id', $row->id)->sum('count') > 0;
                        $updates = [];
                        if (Schema::hasColumn('product_variants', 'in_stock')) $updates['in_stock'] = $available;
                        if (Schema::hasColumn('product_variants', 'purchasable')) $updates['purchasable'] = $available;
                        if (Schema::hasColumn('product_variants', 'available_for_purchase')) $updates['available_for_purchase'] = $available;
                        if ($updates !== []) DB::table('product_variants')->where('id', $row->id)->update($updates);
                    }
                });
            }
        }

        if (Schema::hasTable('permissions')) {
            $obsoleteIds = DB::table('permissions')
                ->where('name', 'like', 'vendors.%')
                ->orWhere('name', 'like', 'purchase_orders.%')
                ->pluck('id');

            if ($obsoleteIds->isNotEmpty() && Schema::hasTable('permission_role')) {
                DB::table('permission_role')->whereIn('permission_id', $obsoleteIds)->delete();
            }
            if ($obsoleteIds->isNotEmpty()) {
                DB::table('permissions')->whereIn('id', $obsoleteIds)->delete();
            }
        }

        if (Schema::hasTable('roles')) {
            $legacyRole = DB::table('roles')
                ->where('slug', 'inventory_procurement')
                ->orWhere('name', 'Inventory & Procurement')
                ->first();
            $inventoryRole = DB::table('roles')->where('slug', 'inventory_manager')->first();

            if ($legacyRole && $inventoryRole && (int) $legacyRole->id !== (int) $inventoryRole->id) {
                if (Schema::hasTable('role_user')) {
                    foreach (DB::table('role_user')->where('role_id', $legacyRole->id)->pluck('user_id') as $userId) {
                        DB::table('role_user')->insertOrIgnore(['role_id' => $inventoryRole->id, 'user_id' => $userId]);
                    }
                }
                if (Schema::hasTable('permission_role')) {
                    foreach (DB::table('permission_role')->where('role_id', $legacyRole->id)->pluck('permission_id') as $permissionId) {
                        DB::table('permission_role')->insertOrIgnore(['permission_id' => $permissionId, 'role_id' => $inventoryRole->id]);
                    }
                }
                DB::table('roles')->where('id', $legacyRole->id)->delete();
            } elseif ($legacyRole) {
                DB::table('roles')->where('id', $legacyRole->id)->update([
                    'name' => 'Inventory Manager',
                    'slug' => 'inventory_manager',
                    'description' => 'Manages products, direct batch receiving, stock accuracy, transfers and inventory reporting.',
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Procurement data is intentionally not recreated. Rolling back only
        // removes fields introduced for the direct-batch lifecycle.
        if (! Schema::hasTable('product_batches')) {
            return;
        }

        foreach (['created_by', 'shop_id', 'variant_id'] as $column) {
            if (Schema::hasColumn('product_batches', $column)) {
                Schema::table('product_batches', function (Blueprint $table) use ($column): void {
                    $table->dropConstrainedForeignId($column);
                });
            }
        }

        foreach (['batch_reference', 'initial_quantity', 'selling_price', 'note', 'received_at'] as $column) {
            if (Schema::hasColumn('product_batches', $column)) {
                Schema::table('product_batches', function (Blueprint $table) use ($column): void {
                    $table->dropColumn($column);
                });
            }
        }
    }
};
