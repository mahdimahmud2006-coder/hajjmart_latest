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
        $this->addColumn('users', 'phone', fn (Blueprint $table) => $table->string('phone')->nullable());
        $this->addColumn('users', 'avatar', fn (Blueprint $table) => $table->string('avatar')->nullable());
        $this->addColumn('users', 'address_default_id', fn (Blueprint $table) => $table->unsignedBigInteger('address_default_id')->nullable());
        $this->addColumn('users', 'is_active', fn (Blueprint $table) => $table->boolean('is_active')->default(true));
        $this->addColumn('users', 'role', fn (Blueprint $table) => $table->string('role')->default('customer')->index());
        $this->addColumn('users', 'deleted_at', fn (Blueprint $table) => $table->softDeletes());

        if (! Schema::hasTable('roles')) {
            Schema::create('roles', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->unique();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('permissions')) {
            Schema::create('permissions', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->unique();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('role_user')) {
            Schema::create('role_user', function (Blueprint $table): void {
                $table->foreignId('role_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->primary(['role_id', 'user_id']);
            });
        }

        if (! Schema::hasTable('user_addresses')) {
            Schema::create('user_addresses', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('label')->nullable();
                $table->string('recipient_name');
                $table->string('phone');
                $table->string('address_line_1');
                $table->string('address_line_2')->nullable();
                $table->string('city')->nullable();
                $table->string('district')->nullable();
                $table->string('division')->nullable();
                $table->string('postal_code')->nullable();
                $table->boolean('is_default')->default(false);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('vendors')) {
            Schema::create('vendors', function (Blueprint $table): void {
                $table->id();
                $table->string('shop_name');
                $table->string('slug')->unique();
                $table->string('logo')->nullable();
                $table->text('description')->nullable();
                $table->string('contact_person')->nullable();
                $table->string('contact_email')->nullable();
                $table->string('contact_phone')->nullable();
                $table->text('address')->nullable();
                $table->string('trade_license_no')->nullable();
                $table->boolean('is_active')->default(true);
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('vendor_bank_details')) {
            Schema::create('vendor_bank_details', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
                $table->string('bank_name')->nullable();
                $table->string('account_name')->nullable();
                $table->string('account_number')->nullable();
                $table->string('routing_number')->nullable();
                $table->string('bkash')->nullable();
                $table->string('nagad')->nullable();
                $table->timestamps();
            });
        }

        $this->addColumn('categories', 'parent_id', fn (Blueprint $table) => $table->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete());
        $this->addColumn('categories', 'slug', fn (Blueprint $table) => $table->string('slug')->nullable()->unique());
        $this->addColumn('categories', 'description', fn (Blueprint $table) => $table->text('description')->nullable());
        $this->addColumn('categories', 'image', fn (Blueprint $table) => $table->string('image')->nullable());
        $this->addColumn('categories', 'icon', fn (Blueprint $table) => $table->string('icon')->nullable());
        $this->addColumn('categories', 'sort_order', fn (Blueprint $table) => $table->integer('sort_order')->default(0));
        $this->addColumn('categories', 'is_active', fn (Blueprint $table) => $table->boolean('is_active')->default(true));
        $this->addColumn('categories', 'deleted_at', fn (Blueprint $table) => $table->softDeletes());

        $this->addColumn('products', 'category_id', fn (Blueprint $table) => $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete());
        $this->addColumn('products', 'source_product_id', fn (Blueprint $table) => $table->unsignedBigInteger('source_product_id')->nullable()->unique());
        $this->addColumn('products', 'source_url', fn (Blueprint $table) => $table->text('source_url')->nullable());
        $this->addColumn('products', 'slug', fn (Blueprint $table) => $table->string('slug')->nullable()->unique());
        $this->addColumn('products', 'sku', fn (Blueprint $table) => $table->string('sku')->nullable()->index());
        $this->addColumn('products', 'barcode', fn (Blueprint $table) => $table->string('barcode')->nullable()->index());
        $this->addColumn('products', 'product_type', fn (Blueprint $table) => $table->string('product_type')->default('simple'));
        $this->addColumn('products', 'product_type_source', fn (Blueprint $table) => $table->string('product_type_source')->nullable());
        $this->addColumn('products', 'sku_source', fn (Blueprint $table) => $table->string('sku_source')->nullable());
        $this->addColumn('products', 'product_id_source', fn (Blueprint $table) => $table->string('product_id_source')->nullable());
        $this->addColumn('products', 'default_variation_sku', fn (Blueprint $table) => $table->string('default_variation_sku')->nullable());
        $this->addColumn('products', 'currency', fn (Blueprint $table) => $table->string('currency', 8)->default('BDT'));
        $this->addColumn('products', 'price_text', fn (Blueprint $table) => $table->text('price_text')->nullable());
        $this->addColumn('products', 'regular_price', fn (Blueprint $table) => $table->decimal('regular_price', 12, 2)->nullable());
        $this->addColumn('products', 'base_price', fn (Blueprint $table) => $table->decimal('base_price', 12, 2)->nullable());
        $this->addColumn('products', 'sale_price', fn (Blueprint $table) => $table->decimal('sale_price', 12, 2)->nullable());
        $this->addColumn('products', 'cost_price', fn (Blueprint $table) => $table->decimal('cost_price', 12, 2)->nullable());
        $this->addColumn('products', 'price_min', fn (Blueprint $table) => $table->decimal('price_min', 12, 2)->nullable());
        $this->addColumn('products', 'price_max', fn (Blueprint $table) => $table->decimal('price_max', 12, 2)->nullable());
        $this->addColumn('products', 'regular_price_min', fn (Blueprint $table) => $table->decimal('regular_price_min', 12, 2)->nullable());
        $this->addColumn('products', 'regular_price_max', fn (Blueprint $table) => $table->decimal('regular_price_max', 12, 2)->nullable());
        $this->addColumn('products', 'tax_rate', fn (Blueprint $table) => $table->decimal('tax_rate', 5, 2)->default(0));
        $this->addColumn('products', 'tax_inclusive', fn (Blueprint $table) => $table->boolean('tax_inclusive')->default(true));
        $this->addColumn('products', 'stock_status', fn (Blueprint $table) => $table->string('stock_status')->nullable()->index());
        $this->addColumn('products', 'stock_text', fn (Blueprint $table) => $table->string('stock_text')->nullable());
        $this->addColumn('products', 'purchasable', fn (Blueprint $table) => $table->boolean('purchasable')->default(true));
        $this->addColumn('products', 'short_description', fn (Blueprint $table) => $table->text('short_description')->nullable());
        $this->addColumn('products', 'summary_description', fn (Blueprint $table) => $table->text('summary_description')->nullable());
        $this->addColumn('products', 'long_description', fn (Blueprint $table) => $table->longText('long_description')->nullable());
        $this->addColumn('products', 'short_description_html', fn (Blueprint $table) => $table->longText('short_description_html')->nullable());
        $this->addColumn('products', 'summary_description_html', fn (Blueprint $table) => $table->longText('summary_description_html')->nullable());
        $this->addColumn('products', 'description_html', fn (Blueprint $table) => $table->longText('description_html')->nullable());
        $this->addColumn('products', 'long_description_html', fn (Blueprint $table) => $table->longText('long_description_html')->nullable());
        $this->addColumn('products', 'short_description_clean_html', fn (Blueprint $table) => $table->longText('short_description_clean_html')->nullable());
        $this->addColumn('products', 'description_clean_html', fn (Blueprint $table) => $table->longText('description_clean_html')->nullable());
        $this->addColumn('products', 'long_description_clean_html', fn (Blueprint $table) => $table->longText('long_description_clean_html')->nullable());
        $this->addColumn('products', 'additional_information', fn (Blueprint $table) => $table->json('additional_information')->nullable());
        $this->addColumn('products', 'additional_information_rows', fn (Blueprint $table) => $table->json('additional_information_rows')->nullable());
        $this->addColumn('products', 'additional_information_text', fn (Blueprint $table) => $table->text('additional_information_text')->nullable());
        $this->addColumn('products', 'additional_information_html', fn (Blueprint $table) => $table->longText('additional_information_html')->nullable());
        $this->addColumn('products', 'additional_information_clean_html', fn (Blueprint $table) => $table->longText('additional_information_clean_html')->nullable());
        $this->addColumn('products', 'specifications', fn (Blueprint $table) => $table->json('specifications')->nullable());
        $this->addColumn('products', 'variation_attribute_options', fn (Blueprint $table) => $table->json('variation_attribute_options')->nullable());
        $this->addColumn('products', 'variation_extraction', fn (Blueprint $table) => $table->string('variation_extraction')->nullable());
        $this->addColumn('products', 'variation_warning', fn (Blueprint $table) => $table->text('variation_warning')->nullable());
        $this->addColumn('products', 'stock_summary', fn (Blueprint $table) => $table->json('stock_summary')->nullable());
        $this->addColumn('products', 'brand', fn (Blueprint $table) => $table->string('brand')->nullable());
        $this->addColumn('products', 'brands', fn (Blueprint $table) => $table->json('brands')->nullable());
        $this->addColumn('products', 'discovery_sources', fn (Blueprint $table) => $table->json('discovery_sources')->nullable());
        $this->addColumn('products', 'visible_in_shop', fn (Blueprint $table) => $table->boolean('visible_in_shop')->default(true));
        $this->addColumn('products', 'raw_payload', fn (Blueprint $table) => $table->json('raw_payload')->nullable());
        $this->addColumn('products', 'scraped_at', fn (Blueprint $table) => $table->timestamp('scraped_at')->nullable());
        $this->addColumn('products', 'weight', fn (Blueprint $table) => $table->decimal('weight', 10, 3)->nullable());
        $this->addColumn('products', 'weight_unit', fn (Blueprint $table) => $table->string('weight_unit')->default('kg'));
        $this->addColumn('products', 'dimensions_json', fn (Blueprint $table) => $table->json('dimensions_json')->nullable());
        $this->addColumn('products', 'is_featured', fn (Blueprint $table) => $table->boolean('is_featured')->default(false));
        $this->addColumn('products', 'is_active', fn (Blueprint $table) => $table->boolean('is_active')->default(true));
        $this->addColumn('products', 'is_digital', fn (Blueprint $table) => $table->boolean('is_digital')->default(false));
        $this->addColumn('products', 'meta_title', fn (Blueprint $table) => $table->string('meta_title')->nullable());
        $this->addColumn('products', 'meta_description', fn (Blueprint $table) => $table->text('meta_description')->nullable());
        $this->addColumn('products', 'meta_keywords', fn (Blueprint $table) => $table->text('meta_keywords')->nullable());
        $this->addColumn('products', 'deleted_at', fn (Blueprint $table) => $table->softDeletes());

        if (! Schema::hasTable('product_images')) {
            Schema::create('product_images', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->string('path')->nullable();
                $table->text('source_url')->nullable();
                $table->text('downloaded_url')->nullable();
                $table->string('alt_text')->nullable();
                $table->string('mime_type')->nullable();
                $table->unsignedBigInteger('size_bytes')->nullable();
                $table->string('sha256')->nullable()->index();
                $table->json('source_aliases')->nullable();
                $table->integer('sort_order')->default(0);
                $table->boolean('is_primary')->default(false);
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('product_attributes')) {
            Schema::create('product_attributes', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->unique();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('product_attribute_values')) {
            Schema::create('product_attribute_values', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('attribute_id')->constrained('product_attributes')->cascadeOnDelete();
                $table->string('value');
                $table->timestamps();
                $table->unique(['attribute_id', 'value']);
            });
        }

        if (! Schema::hasTable('product_variants')) {
            Schema::create('product_variants', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->unsignedBigInteger('source_variation_id')->nullable()->index();
                $table->string('sku')->nullable()->index();
                $table->string('barcode')->nullable()->index();
                $table->decimal('price', 12, 2)->nullable();
                $table->decimal('sale_price', 12, 2)->nullable();
                $table->decimal('regular_price', 12, 2)->nullable();
                $table->decimal('cost_price', 12, 2)->nullable();
                $table->foreignId('image_id')->nullable()->constrained('product_images')->nullOnDelete();
                $table->json('attributes_json')->nullable();
                $table->json('attribute_labels')->nullable();
                $table->json('attribute_values')->nullable();
                $table->text('variation_description')->nullable();
                $table->string('weight')->nullable();
                $table->json('dimensions_json')->nullable();
                $table->boolean('in_stock')->default(true);
                $table->boolean('purchasable')->default(true);
                $table->boolean('available_for_purchase')->default(true);
                $table->json('image_json')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('product_variant_attribute_values')) {
            Schema::create('product_variant_attribute_values', function (Blueprint $table): void {
                $table->foreignId('variant_id')->constrained('product_variants')->cascadeOnDelete();
                $table->foreignId('attribute_value_id')->constrained('product_attribute_values')->cascadeOnDelete();
                $table->primary(['variant_id', 'attribute_value_id']);
            });
        }

        if (! Schema::hasTable('product_tags')) {
            Schema::create('product_tags', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->unique();
                $table->string('slug')->unique();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('product_tag_pivot')) {
            Schema::create('product_tag_pivot', function (Blueprint $table): void {
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->foreignId('tag_id')->constrained('product_tags')->cascadeOnDelete();
                $table->primary(['product_id', 'tag_id']);
            });
        }

        if (! Schema::hasTable('inventory')) {
            Schema::create('inventory', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->foreignId('variant_id')->nullable()->constrained('product_variants')->cascadeOnDelete();
                $table->integer('quantity')->default(0);
                $table->integer('reserved')->default(0);
                $table->integer('low_stock_threshold')->default(5);
                $table->string('location_note')->nullable();
                $table->timestamp('updated_at')->nullable();
                // Do not make product + variant globally unique here. Inventory becomes
                // store-scoped in the admin operations migration, where the final key is
                // (product_id, variant_id, shop_id). A global key would block the same SKU
                // from being stocked in more than one store.
                $table->index(['product_id', 'variant_id'], 'inventory_product_variant_lookup_index');
            });
        }

        if (! Schema::hasTable('stock_movements')) {
            Schema::create('stock_movements', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('inventory_id')->constrained('inventory')->cascadeOnDelete();
                $table->string('type');
                $table->integer('quantity_change');
                $table->string('reference_type')->nullable();
                $table->unsignedBigInteger('reference_id')->nullable();
                $table->text('note')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('created_at')->nullable();
            });
        }

        $this->addColumn('orders', 'order_number', fn (Blueprint $table) => $table->string('order_number')->nullable()->unique());
        $this->addColumn('orders', 'customer_id', fn (Blueprint $table) => $table->foreignId('customer_id')->nullable()->constrained('users')->nullOnDelete());
        $this->addColumn('orders', 'status', fn (Blueprint $table) => $table->string('status')->default('pending')->index());
        $this->addColumn('orders', 'subtotal', fn (Blueprint $table) => $table->decimal('subtotal', 12, 2)->default(0));
        $this->addColumn('orders', 'tax_total', fn (Blueprint $table) => $table->decimal('tax_total', 12, 2)->default(0));
        $this->addColumn('orders', 'shipping_total', fn (Blueprint $table) => $table->decimal('shipping_total', 12, 2)->default(0));
        $this->addColumn('orders', 'discount_total', fn (Blueprint $table) => $table->decimal('discount_total', 12, 2)->default(0));
        $this->addColumn('orders', 'grand_total', fn (Blueprint $table) => $table->decimal('grand_total', 12, 2)->default(0));
        $this->addColumn('orders', 'currency', fn (Blueprint $table) => $table->string('currency', 8)->default('BDT'));
        $this->addColumn('orders', 'shipping_address_snapshot', fn (Blueprint $table) => $table->json('shipping_address_snapshot')->nullable());
        $this->addColumn('orders', 'billing_address_snapshot', fn (Blueprint $table) => $table->json('billing_address_snapshot')->nullable());
        $this->addColumn('orders', 'customer_note', fn (Blueprint $table) => $table->text('customer_note')->nullable());
        $this->addColumn('orders', 'admin_note', fn (Blueprint $table) => $table->text('admin_note')->nullable());
        $this->addColumn('orders', 'placed_at', fn (Blueprint $table) => $table->timestamp('placed_at')->nullable());
        $this->addColumn('orders', 'confirmed_at', fn (Blueprint $table) => $table->timestamp('confirmed_at')->nullable());
        $this->addColumn('orders', 'shipped_at', fn (Blueprint $table) => $table->timestamp('shipped_at')->nullable());
        $this->addColumn('orders', 'delivered_at', fn (Blueprint $table) => $table->timestamp('delivered_at')->nullable());
        $this->addColumn('orders', 'cancelled_at', fn (Blueprint $table) => $table->timestamp('cancelled_at')->nullable());

        if (! Schema::hasTable('order_items')) {
            Schema::create('order_items', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('order_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->foreignId('variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
                $table->json('product_snapshot')->nullable();
                $table->integer('quantity');
                $table->decimal('unit_price', 12, 2);
                $table->decimal('tax_rate', 5, 2)->default(0);
                $table->decimal('discount_amount', 12, 2)->default(0);
                $table->decimal('line_total', 12, 2);
                $table->string('item_status')->default('pending');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('order_status_history')) {
            Schema::create('order_status_history', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('order_id')->constrained()->cascadeOnDelete();
                $table->string('from_status')->nullable();
                $table->string('to_status');
                $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('note')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('order_item_status_history')) {
            Schema::create('order_item_status_history', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
                $table->string('from_status')->nullable();
                $table->string('to_status');
                $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('note')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('payments')) {
            Schema::create('payments', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('order_id')->constrained()->cascadeOnDelete();
                $table->string('payment_method');
                $table->string('gateway')->nullable();
                $table->string('gateway_transaction_id')->nullable();
                $table->json('gateway_response')->nullable();
                $table->decimal('amount', 12, 2);
                $table->string('currency', 8)->default('BDT');
                $table->string('status')->default('pending')->index();
                $table->timestamp('paid_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('payment_cod_details')) {
            Schema::create('payment_cod_details', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
                $table->foreignId('collected_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('collected_at')->nullable();
                $table->text('note')->nullable();
            });
        }

        if (! Schema::hasTable('purchase_orders')) {
            Schema::create('purchase_orders', function (Blueprint $table): void {
                $table->id();
                $table->string('po_number')->unique();
                $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('status')->default('draft');
                $table->decimal('subtotal', 12, 2)->default(0);
                $table->decimal('tax_total', 12, 2)->default(0);
                $table->decimal('grand_total', 12, 2)->default(0);
                $table->date('expected_delivery_date')->nullable();
                $table->timestamp('received_at')->nullable();
                $table->text('note')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('purchase_order_items')) {
            Schema::create('purchase_order_items', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->foreignId('variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
                $table->integer('quantity_ordered');
                $table->integer('quantity_received')->default(0);
                $table->decimal('unit_cost', 12, 2)->default(0);
                $table->decimal('line_total', 12, 2)->default(0);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('purchase_order_receipts')) {
            Schema::create('purchase_order_receipts', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
                $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('note')->nullable();
                $table->timestamp('received_at')->nullable();
            });
        }

        if (! Schema::hasTable('return_requests')) {
            Schema::create('return_requests', function (Blueprint $table): void {
                $table->id();
                $table->string('rr_number')->unique();
                $table->foreignId('order_id')->constrained()->cascadeOnDelete();
                $table->foreignId('customer_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('type')->default('return');
                $table->string('status')->default('pending');
                $table->string('reason')->nullable();
                $table->text('customer_note')->nullable();
                $table->text('admin_note')->nullable();
                $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('approved_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('return_request_items')) {
            Schema::create('return_request_items', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('return_request_id')->constrained()->cascadeOnDelete();
                $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
                $table->integer('quantity');
                $table->string('reason')->nullable();
                $table->text('condition_note')->nullable();
                $table->foreignId('exchange_product_id')->nullable()->constrained('products')->nullOnDelete();
                $table->foreignId('exchange_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('return_status_history')) {
            Schema::create('return_status_history', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('return_request_id')->constrained()->cascadeOnDelete();
                $table->string('from_status')->nullable();
                $table->string('to_status');
                $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('note')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('cancellation_requests')) {
            Schema::create('cancellation_requests', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('order_id')->constrained()->cascadeOnDelete();
                $table->foreignId('order_item_id')->nullable()->constrained()->cascadeOnDelete();
                $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('reason')->nullable();
                $table->text('note')->nullable();
                $table->string('status')->default('pending');
                $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('processed_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('product_reviews')) {
            Schema::create('product_reviews', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
                $table->unsignedTinyInteger('rating');
                $table->string('title')->nullable();
                $table->text('body')->nullable();
                $table->boolean('is_approved')->default(false);
                $table->boolean('is_featured')->default(false);
                $table->integer('helpful_count')->default(0);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('review_images')) {
            Schema::create('review_images', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('review_id')->constrained('product_reviews')->cascadeOnDelete();
                $table->string('path');
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('wishlists')) {
            Schema::create('wishlists', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->foreignId('variant_id')->nullable()->constrained('product_variants')->cascadeOnDelete();
                $table->timestamp('created_at')->nullable();
                $table->unique(['user_id', 'product_id', 'variant_id']);
            });
        }

        if (! Schema::hasTable('social_shares')) {
            Schema::create('social_shares', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->string('platform');
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('product_questions')) {
            Schema::create('product_questions', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->text('question');
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('product_answers')) {
            Schema::create('product_answers', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('question_id')->constrained('product_questions')->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->boolean('is_admin')->default(false);
                $table->text('answer');
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('coupons')) {
            Schema::create('coupons', function (Blueprint $table): void {
                $table->id();
                $table->string('code')->unique();
                $table->string('type')->default('fixed');
                $table->decimal('value', 10, 2);
                $table->decimal('min_order_amount', 12, 2)->default(0);
                $table->decimal('max_discount_amount', 12, 2)->nullable();
                $table->integer('usage_limit')->nullable();
                $table->integer('used_count')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamp('starts_at')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->string('applicable_to')->default('all');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('coupon_usages')) {
            Schema::create('coupon_usages', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('coupon_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('order_id')->nullable()->constrained()->cascadeOnDelete();
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->string('type');
                $table->morphs('notifiable');
                $table->text('data');
                $table->timestamp('read_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('daily_sales_summaries')) {
            Schema::create('daily_sales_summaries', function (Blueprint $table): void {
                $table->id();
                $table->date('date');
                $table->integer('total_orders')->default(0);
                $table->decimal('total_revenue', 12, 2)->default(0);
                $table->decimal('total_refunds', 12, 2)->default(0);
                $table->integer('total_items_sold')->default(0);
                $table->timestamps();
                $table->unique('date');
            });
        }
    }

    public function down(): void
    {
        foreach ([
            'daily_sales_summaries', 'coupon_usages', 'coupons', 'product_answers', 'product_questions',
            'social_shares', 'wishlists', 'review_images', 'product_reviews', 'cancellation_requests',
            'return_status_history', 'return_request_items', 'return_requests', 'purchase_order_receipts',
            'purchase_order_items', 'purchase_orders', 'payment_cod_details', 'payments',
            'order_item_status_history', 'order_status_history', 'order_items', 'stock_movements',
            'inventory', 'product_tag_pivot', 'product_tags', 'product_variant_attribute_values',
            'product_variants', 'product_attribute_values', 'product_attributes', 'product_images',
            'vendor_bank_details', 'vendors', 'user_addresses', 'role_user', 'permissions', 'roles'
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
