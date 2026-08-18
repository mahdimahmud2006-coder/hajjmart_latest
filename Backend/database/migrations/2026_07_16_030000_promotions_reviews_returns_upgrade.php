<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function addColumn(string $table, string $column, callable $definition): void
    {
        if (Schema::hasTable($table) && ! Schema::hasColumn($table, $column)) {
            Schema::table($table, function (Blueprint $blueprint) use ($definition): void {
                $definition($blueprint);
            });
        }
    }

    public function up(): void
    {
        // Promotion/coupon engine: public sale, private coupon and compound/stacked discounts.
        $this->addColumn('coupons', 'title', fn (Blueprint $table) => $table->string('title')->nullable());
        $this->addColumn('coupons', 'description', fn (Blueprint $table) => $table->text('description')->nullable());
        $this->addColumn('coupons', 'visibility', fn (Blueprint $table) => $table->string('visibility')->default('private')->index()); // public/private
        $this->addColumn('coupons', 'promotion_type', fn (Blueprint $table) => $table->string('promotion_type')->default('coupon')->index()); // coupon/public_sale/private_coupon
        $this->addColumn('coupons', 'discount_scope', fn (Blueprint $table) => $table->string('discount_scope')->default('items')); // items/cart/shipping
        $this->addColumn('coupons', 'stackable', fn (Blueprint $table) => $table->boolean('stackable')->default(false));
        $this->addColumn('coupons', 'auto_apply', fn (Blueprint $table) => $table->boolean('auto_apply')->default(false)->index());
        $this->addColumn('coupons', 'priority', fn (Blueprint $table) => $table->integer('priority')->default(100)->index());
        $this->addColumn('coupons', 'per_customer_limit', fn (Blueprint $table) => $table->integer('per_customer_limit')->nullable());
        $this->addColumn('coupons', 'minimum_items', fn (Blueprint $table) => $table->integer('minimum_items')->nullable());
        $this->addColumn('coupons', 'first_order_only', fn (Blueprint $table) => $table->boolean('first_order_only')->default(false));
        $this->addColumn('coupons', 'stop_further_promotions', fn (Blueprint $table) => $table->boolean('stop_further_promotions')->default(false));
        $this->addColumn('coupons', 'included_product_ids', fn (Blueprint $table) => $table->json('included_product_ids')->nullable());
        $this->addColumn('coupons', 'excluded_product_ids', fn (Blueprint $table) => $table->json('excluded_product_ids')->nullable());
        $this->addColumn('coupons', 'included_category_ids', fn (Blueprint $table) => $table->json('included_category_ids')->nullable());
        $this->addColumn('coupons', 'excluded_category_ids', fn (Blueprint $table) => $table->json('excluded_category_ids')->nullable());
        $this->addColumn('coupons', 'included_districts', fn (Blueprint $table) => $table->json('included_districts')->nullable());
        $this->addColumn('coupons', 'excluded_districts', fn (Blueprint $table) => $table->json('excluded_districts')->nullable());
        $this->addColumn('coupons', 'payment_methods', fn (Blueprint $table) => $table->json('payment_methods')->nullable());
        $this->addColumn('coupons', 'customer_segments', fn (Blueprint $table) => $table->json('customer_segments')->nullable());

        $this->addColumn('coupon_usages', 'guest_email', fn (Blueprint $table) => $table->string('guest_email')->nullable()->index());
        $this->addColumn('coupon_usages', 'guest_phone', fn (Blueprint $table) => $table->string('guest_phone')->nullable()->index());
        $this->addColumn('coupon_usages', 'discount_amount', fn (Blueprint $table) => $table->decimal('discount_amount', 12, 2)->default(0));
        $this->addColumn('coupon_usages', 'snapshot', fn (Blueprint $table) => $table->json('snapshot')->nullable());

        if (! Schema::hasTable('coupon_applications')) {
            Schema::create('coupon_applications', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('order_id')->constrained()->cascadeOnDelete();
                $table->foreignId('coupon_id')->nullable()->constrained()->nullOnDelete();
                $table->string('code')->nullable()->index();
                $table->string('promotion_type')->nullable();
                $table->string('visibility')->nullable();
                $table->string('discount_scope')->nullable();
                $table->decimal('base_amount', 12, 2)->default(0);
                $table->decimal('item_discount_amount', 12, 2)->default(0);
                $table->decimal('shipping_discount_amount', 12, 2)->default(0);
                $table->decimal('discount_amount', 12, 2)->default(0);
                $table->json('snapshot')->nullable();
                $table->timestamps();
            });
        }

        // Store gross/net split and per-line discount allocation so returns/exchanges refund the correct net amount.
        $this->addColumn('orders', 'coupon_codes', fn (Blueprint $table) => $table->json('coupon_codes')->nullable());
        $this->addColumn('orders', 'promotion_snapshot', fn (Blueprint $table) => $table->json('promotion_snapshot')->nullable());
        $this->addColumn('orders', 'net_subtotal', fn (Blueprint $table) => $table->decimal('net_subtotal', 12, 2)->default(0));
        $this->addColumn('orders', 'item_discount_total', fn (Blueprint $table) => $table->decimal('item_discount_total', 12, 2)->default(0));
        $this->addColumn('orders', 'shipping_discount_total', fn (Blueprint $table) => $table->decimal('shipping_discount_total', 12, 2)->default(0));
        $this->addColumn('orders', 'refund_total', fn (Blueprint $table) => $table->decimal('refund_total', 12, 2)->default(0));
        $this->addColumn('orders', 'exchange_due_total', fn (Blueprint $table) => $table->decimal('exchange_due_total', 12, 2)->default(0));

        $this->addColumn('order_items', 'line_subtotal', fn (Blueprint $table) => $table->decimal('line_subtotal', 12, 2)->default(0));
        $this->addColumn('order_items', 'line_discount_total', fn (Blueprint $table) => $table->decimal('line_discount_total', 12, 2)->default(0));
        $this->addColumn('order_items', 'line_tax_total', fn (Blueprint $table) => $table->decimal('line_tax_total', 12, 2)->default(0));
        $this->addColumn('order_items', 'line_grand_total', fn (Blueprint $table) => $table->decimal('line_grand_total', 12, 2)->default(0));
        $this->addColumn('order_items', 'discount_snapshot', fn (Blueprint $table) => $table->json('discount_snapshot')->nullable());
        $this->addColumn('order_items', 'refunded_quantity', fn (Blueprint $table) => $table->integer('refunded_quantity')->default(0));
        $this->addColumn('order_items', 'refunded_amount', fn (Blueprint $table) => $table->decimal('refunded_amount', 12, 2)->default(0));
        $this->addColumn('order_items', 'exchanged_quantity', fn (Blueprint $table) => $table->integer('exchanged_quantity')->default(0));

        $this->addColumn('return_requests', 'refund_total', fn (Blueprint $table) => $table->decimal('refund_total', 12, 2)->default(0));
        $this->addColumn('return_requests', 'exchange_credit_total', fn (Blueprint $table) => $table->decimal('exchange_credit_total', 12, 2)->default(0));
        $this->addColumn('return_requests', 'exchange_due_total', fn (Blueprint $table) => $table->decimal('exchange_due_total', 12, 2)->default(0));
        $this->addColumn('return_requests', 'promotion_adjustment_total', fn (Blueprint $table) => $table->decimal('promotion_adjustment_total', 12, 2)->default(0));
        $this->addColumn('return_requests', 'resolved_at', fn (Blueprint $table) => $table->timestamp('resolved_at')->nullable());

        $this->addColumn('return_request_items', 'unit_price', fn (Blueprint $table) => $table->decimal('unit_price', 12, 2)->default(0));
        $this->addColumn('return_request_items', 'line_subtotal', fn (Blueprint $table) => $table->decimal('line_subtotal', 12, 2)->default(0));
        $this->addColumn('return_request_items', 'prorated_discount_amount', fn (Blueprint $table) => $table->decimal('prorated_discount_amount', 12, 2)->default(0));
        $this->addColumn('return_request_items', 'refundable_amount', fn (Blueprint $table) => $table->decimal('refundable_amount', 12, 2)->default(0));
        $this->addColumn('return_request_items', 'exchange_unit_price', fn (Blueprint $table) => $table->decimal('exchange_unit_price', 12, 2)->default(0));
        $this->addColumn('return_request_items', 'exchange_line_total', fn (Blueprint $table) => $table->decimal('exchange_line_total', 12, 2)->default(0));
        $this->addColumn('return_request_items', 'exchange_price_difference', fn (Blueprint $table) => $table->decimal('exchange_price_difference', 12, 2)->default(0));
        $this->addColumn('return_request_items', 'exchange_amount_due', fn (Blueprint $table) => $table->decimal('exchange_amount_due', 12, 2)->default(0));
        $this->addColumn('return_request_items', 'exchange_refund_due', fn (Blueprint $table) => $table->decimal('exchange_refund_due', 12, 2)->default(0));

        // Reviews from guest checkout or logged-in customer with moderation and verified purchase flag.
        $this->addColumn('product_reviews', 'guest_name', fn (Blueprint $table) => $table->string('guest_name')->nullable());
        $this->addColumn('product_reviews', 'guest_email', fn (Blueprint $table) => $table->string('guest_email')->nullable()->index());
        $this->addColumn('product_reviews', 'guest_phone', fn (Blueprint $table) => $table->string('guest_phone')->nullable()->index());
        $this->addColumn('product_reviews', 'order_number', fn (Blueprint $table) => $table->string('order_number')->nullable()->index());
        $this->addColumn('product_reviews', 'is_guest', fn (Blueprint $table) => $table->boolean('is_guest')->default(false));
        $this->addColumn('product_reviews', 'verified_purchase', fn (Blueprint $table) => $table->boolean('verified_purchase')->default(false)->index());
        $this->addColumn('product_reviews', 'status', fn (Blueprint $table) => $table->string('status')->default('pending')->index());
        $this->addColumn('product_reviews', 'approved_at', fn (Blueprint $table) => $table->timestamp('approved_at')->nullable());
        $this->addColumn('product_reviews', 'rejected_at', fn (Blueprint $table) => $table->timestamp('rejected_at')->nullable());
        $this->addColumn('product_reviews', 'approved_by', fn (Blueprint $table) => $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete());
        $this->addColumn('product_reviews', 'admin_note', fn (Blueprint $table) => $table->text('admin_note')->nullable());
        $this->addColumn('product_reviews', 'source_channel', fn (Blueprint $table) => $table->string('source_channel')->default('website'));
        $this->addColumn('product_reviews', 'ip_address', fn (Blueprint $table) => $table->string('ip_address')->nullable());
        $this->addColumn('product_reviews', 'user_agent', fn (Blueprint $table) => $table->text('user_agent')->nullable());

        $this->addColumn('products', 'average_rating', fn (Blueprint $table) => $table->decimal('average_rating', 3, 2)->default(0));
        $this->addColumn('products', 'review_count', fn (Blueprint $table) => $table->integer('review_count')->default(0));
    }

    public function down(): void
    {
        // Non-destructive: production-safe downgrade keeps data.
    }
};
