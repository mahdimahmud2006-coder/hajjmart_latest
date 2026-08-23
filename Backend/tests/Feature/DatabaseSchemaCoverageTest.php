<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseSchemaCoverageTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_endpoint_entity_tables_exist(): void
    {
        $tables = [
            'users', 'personal_access_tokens', 'sessions', 'notifications',
            'user_addresses', 'wishlists',
            'homepage_sections', 'categories', 'category_product',
            'products', 'product_images', 'product_variants', 'variations',
            'product_attributes', 'product_attribute_values', 'product_variant_attribute_values',
            'product_tags', 'product_tag_pivot',
            'inventory', 'product_batches', 'stock_movements',
            'orders', 'order_items', 'order_status_histories', 'order_item_status_histories',
            'cancellation_requests', 'reserved_products',
            'payments', 'payment_cod_details', 'stripe_ids',
            'coupons', 'coupon_applications', 'coupon_usages',
            'product_reviews', 'review_images', 'product_questions', 'product_answers',
            'return_requests', 'return_request_items', 'return_status_histories',
            'shops', 'stock_transfers', 'stock_transfer_items', 'store_devices',
            'offline_inventory_sessions', 'offline_inventory_snapshot_items', 'offline_reconciliation_actions',
            'activity_logs', 'daily_sales_summaries',
            'contact_messages', 'delivery_charges', 'site_settings', 'social_shares',
            'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs',
        ];

        $missing = array_values(array_filter($tables, fn (string $table): bool => ! Schema::hasTable($table)));

        $this->assertSame([], $missing, 'Missing endpoint database tables: '.implode(', ', $missing));
    }

    public function test_retail_and_wholesale_pricing_columns_exist(): void
    {
        $columns = [
            'products' => ['retail_price', 'wholesale_price'],
            'product_variants' => ['retail_price', 'wholesale_price'],
            'product_batches' => ['retail_price', 'wholesale_price'],
            'orders' => ['price_mode'],
            'order_items' => ['price_mode'],
        ];

        $missing = [];
        foreach ($columns as $table => $tableColumns) {
            foreach ($tableColumns as $column) {
                if (! Schema::hasColumn($table, $column)) {
                    $missing[] = "{$table}.{$column}";
                }
            }
        }

        $this->assertSame([], $missing, 'Missing retail/wholesale pricing columns: '.implode(', ', $missing));
    }
    public function test_runtime_order_payment_and_reservation_columns_exist(): void
    {
        $columns = [
            'orders' => ['status', 'order_status', 'shop_id', 'order_date', 'paid_amount', 'due_amount', 'confirmed_at', 'shipped_at', 'delivered_at', 'cancelled_at'],
            'order_items' => ['item_status'],
            'payments' => ['received_by', 'payment_reference', 'refunded_amount', 'refund_status'],
            'reserved_products' => ['variant_id', 'shop_id'],
        ];

        $missing = [];
        foreach ($columns as $table => $tableColumns) {
            foreach ($tableColumns as $column) {
                if (! Schema::hasColumn($table, $column)) {
                    $missing[] = "{$table}.{$column}";
                }
            }
        }

        $this->assertSame([], $missing, 'Missing runtime workflow columns: '.implode(', ', $missing));
    }

    public function test_offline_pos_idempotency_columns_exist(): void
    {
        $columns = ['terminal_id', 'client_transaction_id', 'offline_created_at', 'synced_at'];
        $missing = array_values(array_filter($columns, fn (string $column): bool => ! Schema::hasColumn('orders', $column)));
        $this->assertSame([], $missing, 'Missing offline POS order columns: '.implode(', ', $missing));
    }

}
