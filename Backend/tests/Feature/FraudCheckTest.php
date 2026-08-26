<?php

namespace Tests\Feature;

use App\Jobs\CheckOrderFraudJob;
use App\Models\Order;
use App\Models\OrderList;
use App\Models\Shop;
use App\Models\User;
use App\Services\PathaoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FraudCheckTest extends TestCase
{
    use RefreshDatabase;

    protected Shop $shop;
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->shop = Shop::create([
            'name' => 'Main Store',
            'code' => 'MAIN01',
            'is_active' => true,
            'is_default' => true,
        ]);

        $this->admin = User::factory()->create([
            'is_employee' => true,
            'is_admin' => true,
            'is_active' => true,
            'shop_id' => $this->shop->id,
        ]);
    }

    private function createTestOrder(array $attributes = []): Order
    {
        $orderList = OrderList::create();
        return Order::create(array_merge([
            'order_list_id' => $orderList->id,
            'order_number' => 'ORD-' . random_int(1000, 9999),
            'order_id' => (string) random_int(1000000, 9999999),
            'shop_id' => $this->shop->id,
            'source_channel' => 'website',
            'status' => 'confirmed',
            'order_status' => 'Confirmed',
            'payment_method' => 'cod',
            'grand_total' => 2000,
            'paid_amount' => 0,
            'due_amount' => 2000,
        ], $attributes));
    }

    public function test_brand_new_number_flags_order_as_potential_fraud(): void
    {
        $order = $this->createTestOrder([
            'order_number' => 'ORD-TEST-101',
            'checkout_name' => 'Brand New Customer',
            'checkout_mobile_number' => '01699999999',
            'grand_total' => 6000, // High value COD (+15) + Brand new number (+40) = 55 points (>= 50)
            'due_amount' => 6000,
        ]);

        // Mock PathaoService to return 0 history for brand new number
        $pathaoMock = $this->createMock(PathaoService::class);
        $pathaoMock->method('lookupCustomerHistory')->willReturn([
            'success' => true,
            'data' => [
                'customer_rating' => 'average',
                'customer' => [
                    'total_delivery' => 0,
                    'successful_delivery' => 0,
                ],
            ],
        ]);

        $job = new CheckOrderFraudJob($order->id);
        $job->handle($pathaoMock);

        $order->refresh();

        $this->assertTrue($order->is_potential_fraud);
        $this->assertEquals('pending', $order->status);
        $this->assertEquals('Pending', $order->order_status);
        $this->assertGreaterThanOrEqual(50, $order->fraud_score);
        $this->assertNotEmpty($order->fraud_reasons);
    }

    public function test_customer_with_good_history_clears_fraud_check(): void
    {
        $order = $this->createTestOrder([
            'order_number' => 'ORD-TEST-102',
            'checkout_name' => 'Good Customer',
            'checkout_mobile_number' => '01711111111',
            'grand_total' => 1200,
            'due_amount' => 1200,
        ]);

        // Mock PathaoService to return excellent history
        $pathaoMock = $this->createMock(PathaoService::class);
        $pathaoMock->method('lookupCustomerHistory')->willReturn([
            'success' => true,
            'data' => [
                'customer_rating' => 'excellent',
                'customer' => [
                    'total_delivery' => 20,
                    'successful_delivery' => 19,
                ],
            ],
        ]);

        $job = new CheckOrderFraudJob($order->id);
        $job->handle($pathaoMock);

        $order->refresh();

        $this->assertFalse($order->is_potential_fraud);
        $this->assertEquals('confirmed', $order->status);
        $this->assertLessThan(50, $order->fraud_score);
    }

    public function test_confirming_order_removes_potential_fraud_tag(): void
    {
        $order = $this->createTestOrder([
            'order_number' => 'ORD-TEST-103',
            'checkout_name' => 'Flagged Customer',
            'checkout_mobile_number' => '01688888888',
            'status' => 'pending',
            'order_status' => 'Pending',
            'is_potential_fraud' => true,
            'fraud_score' => 65,
            'fraud_reasons' => ['Low Pathao delivery rate'],
            'grand_total' => 2500,
        ]);

        $confirmed = $order->confirm();

        $this->assertTrue($confirmed);
        $order->refresh();

        $this->assertFalse($order->is_potential_fraud);
        $this->assertEquals('confirmed', $order->status);
        $this->assertEquals('Confirmed', $order->order_status);
        $this->assertNotNull($order->confirmed_at);
    }

    public function test_admin_api_filters_potential_fraud_orders(): void
    {
        $fraudOrder = $this->createTestOrder([
            'order_number' => 'ORD-FRAUD-01',
            'checkout_name' => 'Fraud User',
            'status' => 'pending',
            'order_status' => 'Pending',
            'is_potential_fraud' => true,
            'fraud_score' => 70,
            'grand_total' => 3000,
        ]);

        $normalOrder = $this->createTestOrder([
            'order_number' => 'ORD-NORMAL-02',
            'checkout_name' => 'Normal User',
            'status' => 'confirmed',
            'order_status' => 'Confirmed',
            'is_potential_fraud' => false,
            'grand_total' => 1500,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/admin/orders?status_group=potential_fraud');

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertCount(1, $data);
        $this->assertEquals('ORD-FRAUD-01', $data[0]['order_number']);
        $this->assertTrue($data[0]['is_potential_fraud']);
    }

    public function test_duplicate_payment_reference_flags_fraud(): void
    {
        $existingOrder = $this->createTestOrder([
            'order_number' => 'ORD-PREV-01',
            'checkout_mobile_number' => '01700000001',
        ]);
        \App\Models\Payment::create([
            'order_id' => $existingOrder->id,
            'payment_reference' => 'BKASH-REF-9999',
            'amount' => 1000,
            'payment_method' => 'bkash',
            'payment_status' => 'paid',
        ]);

        $newOrder = $this->createTestOrder([
            'order_number' => 'ORD-NEW-02',
            'checkout_mobile_number' => '01700000002',
        ]);
        \App\Models\Payment::create([
            'order_id' => $newOrder->id,
            'payment_reference' => 'BKASH-REF-9999',
            'amount' => 1000,
            'payment_method' => 'bkash',
            'payment_status' => 'paid',
        ]);

        $pathaoMock = $this->createMock(PathaoService::class);
        $pathaoMock->method('lookupCustomerHistory')->willReturn(['success' => false]);

        $job = new CheckOrderFraudJob($newOrder->id);
        $job->handle($pathaoMock);

        $newOrder->refresh();
        $this->assertGreaterThanOrEqual(40, $newOrder->fraud_score);
        $this->assertTrue(collect($newOrder->fraud_reasons)->contains(fn ($r) => str_contains($r, 'Duplicate payment reference')));
    }

    public function test_cod_velocity_flags_fraud(): void
    {
        $phone = '01700000003';
        // Create 2 existing COD orders within the last 30 minutes
        $this->createTestOrder(['checkout_mobile_number' => $phone, 'payment_method' => 'cod', 'created_at' => now()->subMinutes(10)]);
        $this->createTestOrder(['checkout_mobile_number' => $phone, 'payment_method' => 'cod', 'created_at' => now()->subMinutes(20)]);

        // 3rd COD order
        $newOrder = $this->createTestOrder(['checkout_mobile_number' => $phone, 'payment_method' => 'cod']);

        $pathaoMock = $this->createMock(PathaoService::class);
        $pathaoMock->method('lookupCustomerHistory')->willReturn(['success' => false]);

        $job = new CheckOrderFraudJob($newOrder->id);
        $job->handle($pathaoMock);

        $newOrder->refresh();
        $this->assertTrue(collect($newOrder->fraud_reasons)->contains(fn ($r) => str_contains($r, 'COD order velocity')));
    }

    public function test_cod_cancellation_history_flags_fraud(): void
    {
        $phone = '01700000004';
        // 2 cancelled orders
        $this->createTestOrder(['checkout_mobile_number' => $phone, 'status' => 'cancelled', 'order_status' => 'Cancelled']);
        $this->createTestOrder(['checkout_mobile_number' => $phone, 'status' => 'cancelled', 'order_status' => 'Cancelled']);

        $newOrder = $this->createTestOrder(['checkout_mobile_number' => $phone]);

        $pathaoMock = $this->createMock(PathaoService::class);
        $pathaoMock->method('lookupCustomerHistory')->willReturn(['success' => false]);

        $job = new CheckOrderFraudJob($newOrder->id);
        $job->handle($pathaoMock);

        $newOrder->refresh();
        $this->assertTrue(collect($newOrder->fraud_reasons)->contains(fn ($r) => str_contains($r, 'COD cancellation history')));
    }

    public function test_multiple_addresses_flags_fraud(): void
    {
        $phone = '01700000005';
        $this->createTestOrder(['checkout_mobile_number' => $phone, 'checkout_full_address' => 'House 1, Road 1, Dhaka']);
        $this->createTestOrder(['checkout_mobile_number' => $phone, 'checkout_full_address' => 'House 2, Road 5, Chittagong']);

        $newOrder = $this->createTestOrder(['checkout_mobile_number' => $phone, 'checkout_full_address' => 'House 99, Sylhet']);

        $pathaoMock = $this->createMock(PathaoService::class);
        $pathaoMock->method('lookupCustomerHistory')->willReturn(['success' => false]);

        $job = new CheckOrderFraudJob($newOrder->id);
        $job->handle($pathaoMock);

        $newOrder->refresh();
        $this->assertTrue(collect($newOrder->fraud_reasons)->contains(fn ($r) => str_contains($r, 'Multiple addresses')));
    }

    public function test_large_customer_due_from_db_or_direct_order_flags_fraud(): void
    {
        $phone = '01700000006';
        // Existing order in DB with 6,000 due
        $this->createTestOrder(['checkout_mobile_number' => $phone, 'due_amount' => 6000, 'status' => 'confirmed']);

        // New order with 5,000 due (Total due across DB + direct order = 11,000 >= 10,000)
        $newOrder = $this->createTestOrder(['checkout_mobile_number' => $phone, 'due_amount' => 5000]);

        $pathaoMock = $this->createMock(PathaoService::class);
        $pathaoMock->method('lookupCustomerHistory')->willReturn(['success' => false]);

        $job = new CheckOrderFraudJob($newOrder->id);
        $job->handle($pathaoMock);

        $newOrder->refresh();
        $this->assertTrue(collect($newOrder->fraud_reasons)->contains(fn ($r) => str_contains($r, 'Large customer due')));
    }
}
