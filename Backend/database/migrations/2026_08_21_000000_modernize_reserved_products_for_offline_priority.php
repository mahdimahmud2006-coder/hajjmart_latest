<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('reserved_products')) {
            return;
        }

        Schema::table('reserved_products', function (Blueprint $table): void {
            if (! Schema::hasColumn('reserved_products', 'order_item_id')) {
                $table->foreignId('order_item_id')->nullable()->constrained('order_items')->nullOnDelete();
            }
            if (! Schema::hasColumn('reserved_products', 'status')) {
                $table->string('status')->default('active')->index();
            }
            if (! Schema::hasColumn('reserved_products', 'reservation_class')) {
                $table->string('reservation_class')->default('protected')->index();
            }
            if (! Schema::hasColumn('reserved_products', 'source_channel')) {
                $table->string('source_channel')->nullable()->index();
            }
            if (! Schema::hasColumn('reserved_products', 'reserved_at')) {
                $table->timestamp('reserved_at')->nullable();
            }
            if (! Schema::hasColumn('reserved_products', 'committed_at')) {
                $table->timestamp('committed_at')->nullable();
            }
            if (! Schema::hasColumn('reserved_products', 'released_at')) {
                $table->timestamp('released_at')->nullable();
            }
            if (! Schema::hasColumn('reserved_products', 'release_reason')) {
                $table->string('release_reason')->nullable();
            }
            if (! Schema::hasColumn('reserved_products', 'metadata')) {
                $table->json('metadata')->nullable();
            }
        });

        DB::table('reserved_products')->update([
            'status' => 'active',
            'reservation_class' => 'protected',
            'reserved_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)'),
        ]);

        $this->backfillSourceChannel();
        $this->backfillUnambiguousOrderItems();

        if (Schema::hasColumn('reserved_products', 'order_item_id')) {
            Schema::table('reserved_products', function (Blueprint $table): void {
                $table->unique('order_item_id', 'reserved_products_order_item_unique');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('reserved_products')) {
            return;
        }

        Schema::table('reserved_products', function (Blueprint $table): void {
            if (Schema::hasColumn('reserved_products', 'order_item_id')) {
                $table->dropUnique('reserved_products_order_item_unique');
                $table->dropConstrainedForeignId('order_item_id');
            }

            $columns = [
                'status', 'reservation_class', 'source_channel', 'reserved_at',
                'committed_at', 'released_at', 'release_reason', 'metadata',
            ];
            $existing = array_values(array_filter($columns, fn (string $column): bool => Schema::hasColumn('reserved_products', $column)));
            if ($existing !== []) {
                $table->dropColumn($existing);
            }
        });
    }

    private function backfillSourceChannel(): void
    {
        if (! Schema::hasTable('orders') || ! Schema::hasColumn('orders', 'source_channel')) {
            return;
        }

        DB::table('reserved_products')
            ->whereNull('source_channel')
            ->orderBy('id')
            ->chunkById(250, function ($rows): void {
                foreach ($rows as $row) {
                    $sourceChannel = DB::table('orders')->where('id', $row->order_id)->value('source_channel');
                    if ($sourceChannel) {
                        DB::table('reserved_products')->where('id', $row->id)->update(['source_channel' => $sourceChannel]);
                    }
                }
            });
    }

    private function backfillUnambiguousOrderItems(): void
    {
        if (! Schema::hasTable('order_items') || ! Schema::hasColumn('reserved_products', 'order_item_id')) {
            return;
        }

        DB::table('reserved_products')
            ->whereNull('order_item_id')
            ->orderBy('id')
            ->chunkById(250, function ($rows): void {
                foreach ($rows as $row) {
                    $candidateQuery = DB::table('order_items')
                        ->where('order_id', $row->order_id)
                        ->where('product_id', $row->product_id);

                    if (Schema::hasColumn('order_items', 'variant_id') && Schema::hasColumn('reserved_products', 'variant_id')) {
                        $row->variant_id
                            ? $candidateQuery->where('variant_id', $row->variant_id)
                            : $candidateQuery->whereNull('variant_id');
                    }

                    $candidates = $candidateQuery->limit(2)->pluck('id');
                    if ($candidates->count() !== 1) {
                        continue;
                    }

                    $siblingQuery = DB::table('reserved_products')
                        ->where('order_id', $row->order_id)
                        ->where('product_id', $row->product_id);
                    if (Schema::hasColumn('reserved_products', 'variant_id')) {
                        $row->variant_id
                            ? $siblingQuery->where('variant_id', $row->variant_id)
                            : $siblingQuery->whereNull('variant_id');
                    }
                    if ($siblingQuery->count() !== 1) {
                        continue;
                    }

                    DB::table('reserved_products')->where('id', $row->id)->update([
                        'order_item_id' => $candidates->first(),
                    ]);
                }
            });
    }
};
