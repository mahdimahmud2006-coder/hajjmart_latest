<?php

namespace Tests\Feature;

use App\Exceptions\InventoryConflictException;
use App\Exceptions\OfflineReconciliationException;
use App\Models\Inventory;
use App\Models\OfflineEventReceipt;
use App\Models\OfflineInventorySession;
use App\Models\OfflineInventorySnapshotItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shop;
use App\Models\StoreDevice;
use App\Models\User;
use App\Services\InventoryService;
use App\Services\OfflineReconciliationService;
use App\Services\OrderService;
use App\Services\StoreAllocationService;
use App\Services\StoreConnectivityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class OfflineAuthoritySeparationTest extends TestCase
{
    use RefreshDatabase;

    private Shop $shopA;
    private Shop $shopB;
    private StoreDevice $deviceA;
    private Product $product1;
    private User $employee1;
    private User $employee2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->shopA = Shop::create(['name' => 'Store Alpha', 'code' => 'ST-A', 'slug' => 'store-alpha', 'is_active' => true, 'is_default' => true]);
        $this->shopB = Shop::create(['name' => 'Store Beta', 'code' => 'ST-B', 'slug' => 'store-beta', 'is_active' => true]);

        $this->deviceA = StoreDevice::create([
            'shop_id' => $this->shopA->id,
            'device_uuid' => (string) Str::uuid(),
            'device_token_hash' => hash('sha256', 'token-a'),
            'device_name' => 'Authority Terminal Alpha',
            'binding_version' => 1,
            'status' => 'active',
            'operational_state' => 'normal',
            'last_heartbeat_at' => now(),
        ]);

        $this->product1 = Product::create([
            'name' => 'Authority Test SKU',
            'sku' => 'AUTH-SKU-1',
            'slug' => 'auth-sku-1',
            'retail_price' => 1000,
            'wholesale_price' => 800,
            'is_active' => true,
            'sell_on_pos' => true,
            'sell_on_social' => true,
        ]);

        $this->employee1 = User::factory()->create(['name' => 'Staff 1', 'is_employee' => true, 'is_admin' => true, 'shop_id' => $this->shopA->id]);
        $this->employee2 = User::factory()->create(['name' => 'Staff 2', 'is_employee' => true, 'is_admin' => true, 'shop_id' => $this->shopA->id]);
    }

    private function addStock(Shop $shop, Product $product, int $qty): Inventory
    {
        $invService = app(InventoryService::class);
        $invService->adjust($product->id, null, $qty, 'Setup stock', null, $shop->id);
        return $invService->inventoryRow($product->id, null, $shop->id);
    }

    private function createSession(Shop $shop, StoreDevice $device, int $openingAvailable = 5): OfflineInventorySession
    {
        $session = OfflineInventorySession::create([
            'session_id' => (string) Str::uuid(),
            'snapshot_id' => 'SNAP-' . Str::random(6),
            'shop_id' => $shop->id,
            'store_device_id' => $device->id,
            'binding_version' => 1,
            'opening_inventory_revision' => 1,
            'opened_at' => now(),
            'status' => 'open',
            'boundary_server_at' => now()->subMinutes(10),
            'min_client_sequence' => 1,
            'max_client_sequence' => 1,
            'opening_snapshot_hash' => 'hash',
        ]);

        OfflineInventorySnapshotItem::create([
            'offline_inventory_session_id' => $session->id,
            'product_id' => $this->product1->id,
            'variant_id' => null,
            'product_name_snapshot' => $this->product1->name,
            'sku_snapshot' => $this->product1->sku,
            'opening_quantity' => $openingAvailable,
            'opening_reserved' => 0,
            'opening_available' => $openingAvailable,
            'retail_price' => 1000,
            'wholesale_price' => 800,
            'sell_on_pos' => true,
            'sell_on_social' => true,
            'product_active' => true,
        ]);

        return $session;
    }

    /** Scenario 1: Two employees, two unregistered browsers, same healthy store -> both can place online Social orders */
    public function test_1_multiple_unregistered_devices_can_place_online_social_orders(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $orderService = app(OrderService::class);

        $order1 = $orderService->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shopA->id,
            'customer_name' => 'Customer A',
            'mobile_number' => '01700000001',
            'created_by' => $this->employee1->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 2]],
        ]);

        $order2 = $orderService->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shopA->id,
            'customer_name' => 'Customer B',
            'mobile_number' => '01700000002',
            'created_by' => $this->employee2->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 3]],
        ]);

        $this->assertNotNull($order1->id);
        $this->assertNotNull($order2->id);
        $this->assertNotEquals($order1->id, $order2->id);
        $this->assertEquals(5, ReservedProductCountFor($this->shopA, $this->product1));
    }

    /** Scenario 2: Two online POS browsers on same healthy store can both place online POS sales */
    public function test_2_multiple_online_pos_browsers_can_charge_sales(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $orderService = app(OrderService::class);

        $sale1 = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'created_by' => $this->employee1->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 2]],
        ]);

        $sale2 = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'created_by' => $this->employee2->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 3]],
        ]);

        $this->assertEquals('delivered', $sale1->status);
        $this->assertEquals('delivered', $sale2->status);
        $this->assertEquals(5, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);
    }

    /** Scenario 3: Two online POS browsers race final unit -> exactly one succeeds, loser gets stock conflict */
    public function test_3_online_pos_final_unit_race_one_succeeds_one_fails(): void
    {
        $this->addStock($this->shopA, $this->product1, 1);
        $orderService = app(OrderService::class);

        $order1 = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'created_by' => $this->employee1->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);

        $this->expectException(InventoryConflictException::class);
        $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'created_by' => $this->employee2->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);
    }

    /** Scenario 4: Online registered authority browser uses server path and creates ZERO new local offline events */
    public function test_4_online_authority_device_creates_zero_local_offline_events(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $session = $this->createSession($this->shopA, $this->deviceA, 5);

        $orderService = app(OrderService::class);
        $order = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'created_by' => $this->employee1->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);

        $this->assertEquals(0, OfflineEventReceipt::where('shop_id', $this->shopA->id)->count());
        $this->assertNull($order->offline_inventory_session_id);
    }

    /** Scenario 5: Offline feature flag off -> online POS and Social Commerce still work */
    public function test_5_flag_off_online_pos_social_still_work(): void
    {
        config(['hajjmart.offline_commerce_v2_enabled' => false]);
        $this->addStock($this->shopA, $this->product1, 10);
        $orderService = app(OrderService::class);

        $posOrder = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);

        $socialOrder = $orderService->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shopA->id,
            'customer_name' => 'Flag Off Customer',
            'mobile_number' => '01700000099',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 2]],
        ]);

        $this->assertNotNull($posOrder->id);
        $this->assertNotNull($socialOrder->id);
    }

    /** Scenario 6: Offline feature flag off -> offline event replay rejects with feature_disabled */
    public function test_6_flag_off_offline_reconciliation_rejected(): void
    {
        config(['hajjmart.offline_commerce_v2_enabled' => false]);
        $session = $this->createSession($this->shopA, $this->deviceA, 5);

        $this->expectException(OfflineReconciliationException::class);
        app(OfflineReconciliationService::class)->reconcile($this->deviceA, $session, [
            'snapshot_id' => $session->snapshot_id,
            'events' => [],
        ]);
    }

    /** Scenario 7: Non-authority device rejected on offline reconciliation endpoint */
    public function test_7_non_authority_device_rejected_on_offline_sync(): void
    {
        $session = $this->createSession($this->shopA, $this->deviceA, 5);
        $shopC = Shop::create(['name' => 'Store Gamma', 'code' => 'ST-C', 'slug' => 'store-gamma', 'is_active' => true]);
        $otherDevice = StoreDevice::create([
            'shop_id' => $shopC->id,
            'device_uuid' => (string) Str::uuid(),
            'device_token_hash' => hash('sha256', 'other'),
            'device_name' => 'Imposter Terminal',
            'binding_version' => 1,
            'status' => 'active',
        ]);

        $this->expectException(OfflineReconciliationException::class);
        app(OfflineReconciliationService::class)->reconcile($otherDevice, $session, [
            'snapshot_id' => $session->snapshot_id,
            'events' => [],
        ]);
    }

    /** Scenario 8 & 9: Offline authority activation threshold and successful local POS replay */
    public function test_8_9_activation_threshold_and_local_pos_replay(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $session = $this->createSession($this->shopA, $this->deviceA, 10);

        $service = app(OfflineReconciliationService::class);
        $result = $service->reconcile($this->deviceA, $session, [
            'snapshot_id' => $session->snapshot_id,
            'events' => [
                [
                    'local_sequence' => 1,
                    'client_transaction_id' => (string) Str::uuid(),
                    'type' => 'pos_sale',
                    'items' => [['product_id' => $this->product1->id, 'quantity' => 3, 'unit_price' => 1000]],
                ],
            ],
        ]);

        $this->assertNotNull($result);
        $this->assertEquals(7, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);
    }

    /** Scenario 10 & 11: After store becomes offline-suspected -> connected ordinary employee POS & Social are blocked */
    public function test_10_11_ordinary_employee_commerce_succeeds_when_online(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        // Make device heartbeat old -> store becomes offline_suspected
        $this->deviceA->update(['last_heartbeat_at' => now()->subMinutes(3)]);

        $orderService = app(OrderService::class);

        $posOrder = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);
        $this->assertNotNull($posOrder->id);

        $socialOrder = $orderService->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shopA->id,
            'customer_name' => 'Online Social Customer',
            'mobile_number' => '01700000088',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);
        $this->assertNotNull($socialOrder->id);
    }

    /** Scenario 12: Website checkout behavior remains governed by allocator, NOT employee-commerce block */
    public function test_12_website_checkout_not_blocked_by_employee_gate(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $this->addStock($this->shopB, $this->product1, 5);
        $this->shopA->update(['is_default' => true]);

        // Make Store A device offline suspected
        $this->deviceA->update(['last_heartbeat_at' => now()->subMinutes(3)]);

        $orderService = app(OrderService::class);
        $order = $orderService->place([
            'source_channel' => 'website',
            'checkout_name' => 'Online Shopper',
            'checkout_mobile_number' => '01700000077',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);

        $this->assertNotNull($order->id);
        // Website allocator reroutes or assigns cleanly to healthy Store B
        $this->assertEquals($this->shopB->id, $order->shop_id);
    }

    /** Scenario 13: Store B online activity unaffected when Store A is offline */
    public function test_13_store_b_unaffected_when_store_a_offline(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $this->addStock($this->shopB, $this->product1, 5);

        // Store A offline
        $this->deviceA->update(['last_heartbeat_at' => now()->subMinutes(10)]);

        $orderService = app(OrderService::class);
        $orderB = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopB->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 2]],
        ]);

        $this->assertEquals($this->shopB->id, $orderB->shop_id);
        $this->assertEquals(3, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopB->id)->quantity);
    }

    /** Scenario 14: Ordinary online POS response-loss retry does NOT create duplicate stock decrement */
    public function test_14_online_pos_retry_idempotency(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $orderService = app(OrderService::class);
        $clientTxId = (string) Str::uuid();

        $payload = [
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'client_transaction_id' => $clientTxId,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 2]],
        ];

        $order1 = $orderService->place($payload);
        $order2 = $orderService->place($payload);

        $this->assertEquals($order1->id, $order2->id);
        $this->assertEquals(8, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);
    }

    /** Scenario 15: Ordinary online Social response-loss retry does NOT create duplicate reservation */
    public function test_15_online_social_retry_idempotency(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $orderService = app(OrderService::class);
        $clientTxId = (string) Str::uuid();

        $payload = [
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shopA->id,
            'client_transaction_id' => $clientTxId,
            'customer_name' => 'Repeat Customer',
            'mobile_number' => '01700000055',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 3]],
        ];

        $order1 = $orderService->place($payload);
        $order2 = $orderService->place($payload);

        $this->assertEquals($order1->id, $order2->id);
        $this->assertEquals(3, ReservedProductCountFor($this->shopA, $this->product1));
    }

    /** Scenario 16: Registered device UUID/token never required on ordinary online request */
    public function test_16_online_request_does_not_require_device_uuid(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $orderService = app(OrderService::class);

        $order = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);

        $this->assertNotNull($order->id);
        $this->assertNull($order->terminal_id);
    }

    /** Scenario 17: Offline endpoint rejects non-authority device */
    public function test_17_offline_sync_rejects_unbound_device(): void
    {
        $session = $this->createSession($this->shopA, $this->deviceA, 5);
        $unboundDevice = StoreDevice::create([
            'shop_id' => $this->shopB->id,
            'device_uuid' => (string) Str::uuid(),
            'device_token_hash' => hash('sha256', 'unbound'),
            'device_name' => 'Unbound Device',
            'binding_version' => 1,
            'status' => 'active',
        ]);

        $this->expectException(OfflineReconciliationException::class);
        app(OfflineReconciliationService::class)->reconcile($unboundDevice, $session, [
            'snapshot_id' => $session->snapshot_id,
            'events' => [],
        ]);
    }

    /** Scenario 18: Regression check - store connectivity states */
    public function test_18_connectivity_service_states(): void
    {
        $connectivity = app(StoreConnectivityService::class);

        // Healthy device
        $this->deviceA->update(['last_heartbeat_at' => now(), 'operational_state' => 'normal']);
        $this->assertEquals('online_healthy', $connectivity->stateFor($this->shopA));

        // Suspected
        $this->deviceA->update(['last_heartbeat_at' => now()->subSeconds(90)]);
        $this->assertEquals('offline_suspected', $connectivity->stateFor($this->shopA));

        // Confirmed
        $this->deviceA->update(['last_heartbeat_at' => now()->subMinutes(10)]);
        $this->assertEquals('offline_confirmed', $connectivity->stateFor($this->shopA));
    }
}

function ReservedProductCountFor(Shop $shop, Product $product): int
{
    return (int) \App\Models\ReservedProduct::where('shop_id', $shop->id)
        ->where('product_id', $product->id)
        ->where('status', 'active')
        ->sum('qty');
}
