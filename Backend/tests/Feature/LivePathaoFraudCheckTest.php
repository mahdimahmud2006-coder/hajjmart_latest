<?php

namespace Tests\Feature;

use App\Jobs\CheckOrderFraudJob;
use App\Models\Order;
use App\Models\OrderList;
use App\Models\Product;
use App\Models\Shop;
use App\Models\SiteSetting;
use App\Models\User;
use App\Services\OrderService;
use App\Services\PathaoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LivePathaoFraudCheckTest extends TestCase
{
    use RefreshDatabase;

    protected Shop $shop;
    protected User $admin;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        // Configure Live Pathao credentials from the environment/database
        SiteSetting::setValue('pathao_client_id', 'ELe3QM9b69');
        SiteSetting::setValue('pathao_client_secret', '34wMViuF691Ms80C2nWT8ofaTDpKmo7ZABME4EmH');
        SiteSetting::setValue('pathao_username', 'khondakershamsr@gmail.com');
        SiteSetting::setValue('pathao_password', '5K4<tDDg');
        SiteSetting::setValue('pathao_environment', 'production');
        SiteSetting::setValue('pathao_enabled', 'true');

        $this->shop = Shop::create([
            'name' => 'Main Store',
            'code' => 'MAIN01',
            'is_active' => true,
            'is_default' => true,
        ]);

        $this->admin = User::create([
            'name' => 'Admin Tester',
            'email' => 'admin_test_fraud@hajjmart.test',
            'password' => bcrypt('secret123'),
            'is_employee' => true,
            'is_admin' => true,
            'is_active' => true,
            'shop_id' => $this->shop->id,
        ]);

        $this->product = Product::create([
            'name' => 'Test Fraud Product',
            'slug' => 'test-fraud-product',
            'sku' => 'TEST-FRAUD-SKU-01',
            'retail_price' => 1500,
            'cost_price' => 800,
            'is_active' => true,
        ]);

        \App\Models\Inventory::create([
            'product_id' => $this->product->id,
            'variant_id' => null,
            'shop_id' => $this->shop->id,
            'quantity' => 100,
            'reserved' => 0,
            'low_stock_threshold' => 5,
        ]);
    }

    public function test_ecommerce_order_with_live_pathao_service(): void
    {
        $testPhone = '01723670951';
        $orderService = app(OrderService::class);
        $pathaoService = app(PathaoService::class);

        // 1. Verify Pathao API returns data for the number (with retry if rate-limited)
        $lookup = $pathaoService->lookupCustomerHistory($testPhone);
        if (! $lookup['success'] && str_contains($lookup['message'] ?? '', 'Too Many Requests')) {
            sleep(2);
            $lookup = $pathaoService->lookupCustomerHistory($testPhone);
        }
        $this->assertTrue($lookup['success'], 'Pathao API authentication and customer history lookup must succeed: ' . ($lookup['message'] ?? ''));
        $this->assertNotNull($lookup['data'], 'Pathao API must return customer data payload.');

        // 2. Place an ecommerce (website) order
        $order = $orderService->place([
            'source_channel' => 'website',
            'shop_id' => $this->shop->id,
            'customer_name' => 'Ecommerce Test Customer',
            'mobile_number' => $testPhone,
            'full_address' => 'House 12, Road 4, Dhanmondi',
            'district' => 'Dhaka',
            'payment_method' => 'cod',
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 1],
            ],
        ]);

        $this->assertNotNull($order->id);

        // 3. Run CheckOrderFraudJob with live PathaoService
        $job = new CheckOrderFraudJob($order->id);
        $job->handle($pathaoService);

        $order->refresh();

        // 4. Assert fraud check results
        $this->assertNotNull($order->fraud_checked_at, 'Order must have fraud_checked_at timestamp.');
        $this->assertNotNull($order->fraud_score, 'Order must have a calculated fraud_score.');
        $this->assertIsArray($order->fraud_reasons, 'Order must have fraud_reasons array.');

        // For a new mobile number (0 Pathao deliveries & 0 DB deliveries), score >= 50
        $this->assertTrue($order->is_potential_fraud, 'Brand new number with 0 Pathao deliveries must be marked as potential fraud.');
        $this->assertSame('pending', $order->status, 'Flagged potential fraud order status must be pending.');
        $this->assertGreaterThanOrEqual(50, $order->fraud_score);

        dump([
            'test' => 'Ecommerce Order Fraud Check',
            'order_number' => $order->order_number,
            'channel' => $order->source_channel,
            'phone' => $order->checkout_mobile_number,
            'is_potential_fraud' => $order->is_potential_fraud,
            'fraud_score' => $order->fraud_score,
            'fraud_reasons' => $order->fraud_reasons,
            'status' => $order->status,
            'pathao_raw_lookup' => $lookup['data'],
        ]);
    }

    public function test_social_commerce_order_with_live_pathao_service(): void
    {
        $testPhone = '01723670951';
        $orderService = app(OrderService::class);
        $pathaoService = app(PathaoService::class);

        // 1. Place a social commerce order
        $order = $orderService->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shop->id,
            'created_by' => $this->admin->id,
            'customer_name' => 'Social Commerce Customer',
            'mobile_number' => $testPhone,
            'full_address' => 'Sector 7, Uttara',
            'district' => 'Dhaka',
            'payment_method' => 'cod',
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 1],
            ],
        ]);

        $this->assertNotNull($order->id);

        // 2. Run CheckOrderFraudJob with live PathaoService
        $job = new CheckOrderFraudJob($order->id);
        $job->handle($pathaoService);

        $order->refresh();

        // 3. Assert fraud check results
        $this->assertNotNull($order->fraud_checked_at, 'Order must have fraud_checked_at timestamp.');
        $this->assertNotNull($order->fraud_score, 'Order must have a calculated fraud_score.');
        $this->assertIsArray($order->fraud_reasons, 'Order must have fraud_reasons array.');
        $this->assertTrue($order->is_potential_fraud, 'Order must be flagged as potential fraud.');
        $this->assertSame('pending', $order->status, 'Status must be moved to pending.');

        dump([
            'test' => 'Social Commerce Order Fraud Check',
            'order_number' => $order->order_number,
            'channel' => $order->source_channel,
            'phone' => $order->checkout_mobile_number,
            'is_potential_fraud' => $order->is_potential_fraud,
            'fraud_score' => $order->fraud_score,
            'fraud_reasons' => $order->fraud_reasons,
            'status' => $order->status,
        ]);
    }
}
