<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
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
        // Bangladesh checkout/address fields based on HajjMart checkout:
        // name, Bangladesh, full address, district, mobile, email, optional account, optional separate shipping, note.
        $this->addColumn('user_addresses', 'country', fn (Blueprint $table) => $table->string('country')->default('Bangladesh')->after('phone'));
        $this->addColumn('user_addresses', 'full_address', fn (Blueprint $table) => $table->text('full_address')->nullable()->after('country'));
        $this->addColumn('user_addresses', 'mobile_number', fn (Blueprint $table) => $table->string('mobile_number')->nullable()->after('phone'));
        $this->addColumn('user_addresses', 'email', fn (Blueprint $table) => $table->string('email')->nullable()->after('mobile_number'));
        $this->addColumn('user_addresses', 'upazila', fn (Blueprint $table) => $table->string('upazila')->nullable()->after('district'));
        $this->addColumn('user_addresses', 'area', fn (Blueprint $table) => $table->string('area')->nullable()->after('upazila'));
        $this->addColumn('user_addresses', 'landmark', fn (Blueprint $table) => $table->string('landmark')->nullable()->after('area'));

        $this->addColumn('orders', 'checkout_name', fn (Blueprint $table) => $table->string('checkout_name')->nullable()->after('customer_id'));
        $this->addColumn('orders', 'checkout_country', fn (Blueprint $table) => $table->string('checkout_country')->default('Bangladesh')->after('checkout_name'));
        $this->addColumn('orders', 'checkout_full_address', fn (Blueprint $table) => $table->text('checkout_full_address')->nullable()->after('checkout_country'));
        $this->addColumn('orders', 'checkout_district', fn (Blueprint $table) => $table->string('checkout_district')->nullable()->index()->after('checkout_full_address'));
        $this->addColumn('orders', 'checkout_mobile_number', fn (Blueprint $table) => $table->string('checkout_mobile_number')->nullable()->index()->after('checkout_district'));
        $this->addColumn('orders', 'checkout_email', fn (Blueprint $table) => $table->string('checkout_email')->nullable()->index()->after('checkout_mobile_number'));
        $this->addColumn('orders', 'create_account_requested', fn (Blueprint $table) => $table->boolean('create_account_requested')->default(false)->after('checkout_email'));
        $this->addColumn('orders', 'ship_to_different_address', fn (Blueprint $table) => $table->boolean('ship_to_different_address')->default(false)->after('create_account_requested'));
        $this->addColumn('orders', 'shipping_full_address', fn (Blueprint $table) => $table->text('shipping_full_address')->nullable()->after('ship_to_different_address'));
        $this->addColumn('orders', 'shipping_district', fn (Blueprint $table) => $table->string('shipping_district')->nullable()->index()->after('shipping_full_address'));
        $this->addColumn('orders', 'shipping_mobile_number', fn (Blueprint $table) => $table->string('shipping_mobile_number')->nullable()->after('shipping_district'));
        $this->addColumn('orders', 'shipping_email', fn (Blueprint $table) => $table->string('shipping_email')->nullable()->after('shipping_mobile_number'));
        $this->addColumn('orders', 'checkout_note', fn (Blueprint $table) => $table->text('checkout_note')->nullable()->after('shipping_email'));
        $this->addColumn('orders', 'coupon_code', fn (Blueprint $table) => $table->string('coupon_code')->nullable()->index()->after('discount_total'));
        $this->addColumn('orders', 'delivery_method', fn (Blueprint $table) => $table->string('delivery_method')->default('home_delivery')->after('shipping_total'));
        $this->addColumn('orders', 'payment_channel', fn (Blueprint $table) => $table->string('payment_channel')->nullable()->after('payment_method'));
        $this->addColumn('orders', 'terms_accepted', fn (Blueprint $table) => $table->boolean('terms_accepted')->default(false)->after('payment_channel'));
        $this->addColumn('orders', 'source_channel', fn (Blueprint $table) => $table->string('source_channel')->default('website')->after('terms_accepted'));
        $this->addColumn('orders', 'total_cogs', fn (Blueprint $table) => $table->decimal('total_cogs', 12, 2)->default(0)->after('grand_total'));
        $this->addColumn('orders', 'gross_profit', fn (Blueprint $table) => $table->decimal('gross_profit', 12, 2)->default(0)->after('total_cogs'));

        $this->addColumn('order_items', 'category_id', fn (Blueprint $table) => $table->foreignId('category_id')->nullable()->after('variant_id')->constrained('categories')->nullOnDelete());
        $this->addColumn('order_items', 'unit_cost', fn (Blueprint $table) => $table->decimal('unit_cost', 12, 2)->default(0)->after('unit_price'));
        $this->addColumn('order_items', 'cogs_total', fn (Blueprint $table) => $table->decimal('cogs_total', 12, 2)->default(0)->after('line_total'));
        $this->addColumn('order_items', 'gross_profit', fn (Blueprint $table) => $table->decimal('gross_profit', 12, 2)->default(0)->after('cogs_total'));

        $this->addColumn('daily_sales_summaries', 'total_cogs', fn (Blueprint $table) => $table->decimal('total_cogs', 12, 2)->default(0)->after('total_revenue'));
        $this->addColumn('daily_sales_summaries', 'gross_profit', fn (Blueprint $table) => $table->decimal('gross_profit', 12, 2)->default(0)->after('total_cogs'));
        $this->addColumn('daily_sales_summaries', 'cancelled_orders', fn (Blueprint $table) => $table->integer('cancelled_orders')->default(0)->after('total_orders'));
        $this->addColumn('daily_sales_summaries', 'district_breakdown', fn (Blueprint $table) => $table->json('district_breakdown')->nullable()->after('total_items_sold'));

        if (Schema::hasTable('site_settings')) {
            DB::table('site_settings')->updateOrInsert(
                ['key' => 'delivery_charge'],
                ['value' => '80.00', 'created_at' => now(), 'updated_at' => now()]
            );
            DB::table('site_settings')->updateOrInsert(
                ['key' => 'country'],
                ['value' => 'Bangladesh', 'created_at' => now(), 'updated_at' => now()]
            );
            DB::table('site_settings')->updateOrInsert(
                ['key' => 'currency'],
                ['value' => 'BDT', 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }

    public function down(): void
    {
        // Non-destructive downgrade: these fields are safe to keep.
    }
};
