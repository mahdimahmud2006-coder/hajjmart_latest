<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('payments')) {
            Schema::table('payments', function (Blueprint $table): void {
                if (! Schema::hasColumn('payments', 'received_by')) {
                    $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
                }
                if (! Schema::hasColumn('payments', 'payment_reference')) {
                    $table->string('payment_reference')->nullable()->index();
                }
                if (! Schema::hasColumn('payments', 'refunded_amount')) {
                    $table->decimal('refunded_amount', 12, 2)->default(0);
                }
                if (! Schema::hasColumn('payments', 'refund_status')) {
                    $table->string('refund_status')->nullable()->index();
                }
            });
        }

        $this->repairOrderWorkflowSchema();

        if (Schema::hasTable('reserved_products')) {
            Schema::table('reserved_products', function (Blueprint $table): void {
                if (! Schema::hasColumn('reserved_products', 'variant_id')) {
                    $table->foreignId('variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
                }
                if (! Schema::hasColumn('reserved_products', 'shop_id')) {
                    $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete();
                }
            });
        }

        $this->repairReservationOwnership();
        $this->repairReservationCounters();
    }

    public function down(): void
    {
        // This is an idempotent production repair migration. Columns and reconciled
        // reservation counters are intentionally retained on rollback.
    }


    private function repairOrderWorkflowSchema(): void
    {
        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table): void {
                if (! Schema::hasColumn('orders', 'status')) {
                    $table->string('status')->default('pending')->index();
                }
                if (! Schema::hasColumn('orders', 'order_status')) {
                    $table->string('order_status')->default('pending')->index();
                }
                if (! Schema::hasColumn('orders', 'shop_id')) {
                    $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete();
                }
                if (! Schema::hasColumn('orders', 'order_date')) {
                    $table->dateTime('order_date')->nullable()->index();
                }
                if (! Schema::hasColumn('orders', 'paid_amount')) {
                    $table->decimal('paid_amount', 12, 2)->default(0);
                }
                if (! Schema::hasColumn('orders', 'due_amount')) {
                    $table->decimal('due_amount', 12, 2)->default(0);
                }
                if (! Schema::hasColumn('orders', 'confirmed_at')) {
                    $table->timestamp('confirmed_at')->nullable();
                }
                if (! Schema::hasColumn('orders', 'shipped_at')) {
                    $table->timestamp('shipped_at')->nullable();
                }
                if (! Schema::hasColumn('orders', 'delivered_at')) {
                    $table->timestamp('delivered_at')->nullable();
                }
                if (! Schema::hasColumn('orders', 'cancelled_at')) {
                    $table->timestamp('cancelled_at')->nullable();
                }
            });
        }

        if (Schema::hasTable('order_items') && ! Schema::hasColumn('order_items', 'item_status')) {
            Schema::table('order_items', function (Blueprint $table): void {
                $table->string('item_status')->default('pending')->index();
            });
        }

        // Some early builds used the singular history table while Eloquent's
        // OrderStatusHistory model correctly expects the plural name.
        if (! Schema::hasTable('order_status_histories') && Schema::hasTable('order_status_history')) {
            Schema::rename('order_status_history', 'order_status_histories');
        }
        if (! Schema::hasTable('order_status_histories')) {
            Schema::create('order_status_histories', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('order_id')->constrained()->cascadeOnDelete();
                $table->string('from_status')->nullable();
                $table->string('to_status');
                $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('note')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }
    }

    private function repairReservationOwnership(): void
    {
        if (! Schema::hasTable('reserved_products') || ! Schema::hasTable('orders') || ! Schema::hasColumn('reserved_products', 'shop_id')) {
            return;
        }

        DB::table('reserved_products')
            ->whereNull('shop_id')
            ->orderBy('id')
            ->chunkById(250, function ($rows): void {
                foreach ($rows as $row) {
                    $order = DB::table('orders')->where('id', $row->order_id)->first(['id', 'shop_id']);
                    if (! $order?->shop_id) {
                        continue;
                    }

                    $updates = ['shop_id' => $order->shop_id];
                    if (Schema::hasColumn('reserved_products', 'variant_id') && ! $row->variant_id && Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'variant_id')) {
                        $item = DB::table('order_items')
                            ->where('order_id', $row->order_id)
                            ->where('product_id', $row->product_id)
                            ->when(isset($row->variation_id) && $row->variation_id && Schema::hasColumn('order_items', 'variation_id'), fn ($query) => $query->where('variation_id', $row->variation_id))
                            ->first(['variant_id']);
                        if ($item?->variant_id) {
                            $updates['variant_id'] = $item->variant_id;
                        }
                    }

                    DB::table('reserved_products')->where('id', $row->id)->update($updates);
                }
            });
    }

    private function repairReservationCounters(): void
    {
        if (! Schema::hasTable('reserved_products') || ! Schema::hasTable('inventory') || ! Schema::hasColumn('reserved_products', 'shop_id')) {
            return;
        }

        $groups = DB::table('reserved_products')
            ->select(['product_id', 'variant_id', 'shop_id', DB::raw('SUM(qty) as reserved_qty')])
            ->whereNotNull('shop_id')
            ->groupBy(['product_id', 'variant_id', 'shop_id'])
            ->get();

        foreach ($groups as $group) {
            $inventoryQuery = DB::table('inventory')
                ->where('product_id', $group->product_id)
                ->where('shop_id', $group->shop_id);
            $group->variant_id
                ? $inventoryQuery->where('variant_id', $group->variant_id)
                : $inventoryQuery->whereNull('variant_id');

            $inventory = $inventoryQuery->first(['id', 'quantity', 'reserved']);
            if (! $inventory) {
                continue;
            }

            $expected = min((int) $inventory->quantity, max(0, (int) $group->reserved_qty));
            if ((int) $inventory->reserved !== $expected) {
                DB::table('inventory')->where('id', $inventory->id)->update([
                    'reserved' => $expected,
                    'updated_at' => now(),
                ]);
            }
        }
    }
};
