<?php

namespace Tests\Feature;

use App\Exceptions\OfflineReconciliationException;
use App\Exceptions\StoreDeviceException;
use App\Models\Inventory;
use App\Models\OfflineInventorySession;
use App\Models\OfflineInventorySnapshotItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shop;
use App\Models\StoreDevice;
use App\Models\User;
use App\Services\InventoryService;
use App\Services\OfflineReconciliationService;
use App\Services\OfflineSessionService;
use App\Services\OrderService;
use App\Services\StoreConnectivityService;
use App\Services\StoreDeviceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class OfflineCleanHandoverTest extends TestCase
{
    use RefreshDatabase;

    private Shop $shopA;
    private StoreDevice $deviceA;
    private Product $product1;
    private User $employee1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->shopA = Shop::create(['name' => 'Store Alpha', 'code' => 'ST-A', 'slug' => 'store-alpha', 'is_active' => true, 'is_default' => true]);

        $this->deviceA = StoreDevice::create([
            'shop_id' => $this->shopA->id,
            'device_uuid' => (string) Str::uuid(),
            'device_token_hash' => hash_hmac('sha256', 'token-a', (string) config('app.key')),
            'device_name' => 'Authority Terminal A',
            'binding_version' => 1,
            'status' => 'active',
            'operational_state' => 'normal',
            'last_heartbeat_at' => now(),
        ]);

        $this->product1 = Product::create([
            'name' => 'Handover Test Product',
            'sku' => 'HANDOVER-SKU-1',
            'slug' => 'handover-sku-1',
            'retail_price' => 1000,
            'wholesale_price' => 800,
            'is_active' => true,
            'sell_on_pos' => true,
            'sell_on_social' => true,
        ]);

        $this->employee1 = User::factory()->create(['name' => 'Staff A', 'is_employee' => true, 'is_admin' => true, 'shop_id' => $this->shopA->id]);
    }

    private function addStock(Shop $shop, Product $product, int $qty): Inventory
    {
        $invService = app(InventoryService::class);
        $invService->adjust($product->id, null, $qty, 'Setup stock', null, $shop->id);
        return $invService->inventoryRow($product->id, null, $shop->id);
    }

    private function createSession(Shop $shop, StoreDevice $device, int $openingAvailable = 10): OfflineInventorySession
    {
        $session = OfflineInventorySession::create([
            'session_id' => (string) Str::uuid(),
            'snapshot_id' => 'SNAP-' . Str::random(6),
            'shop_id' => $shop->id,
            'store_device_id' => $device->id,
            'binding_version' => $device->binding_version,
            'opening_inventory_revision' => (int) $shop->inventory_revision,
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

    /** Scenario 1: Device A registered + online -> uses normal server POS path */
    public function test_1_online_device_a_uses_server_path(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $orderService = app(OrderService::class);

        $order = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'created_by' => $this->employee1->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 2]],
        ]);

        $this->assertNotNull($order->id);
        $this->assertEquals('delivered', $order->status);
        $this->assertEquals(8, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);
    }

    /** Scenario 9: Device A cannot Release while local events remain unsynced */
    public function test_9_release_blocked_if_unsynced_work_exists(): void
    {
        $deviceService = app(StoreDeviceService::class);
        $this->createSession($this->shopA, $this->deviceA, 10);

        $this->expectException(StoreDeviceException::class);
        $deviceService->release($this->shopA, $this->deviceA, $this->employee1, [
            'unsynced_v2_event_count' => 1,
            'last_local_sequence' => 1,
        ]);
    }

    /** Scenario 10: Device A cannot Release while reconciliation running */
    public function test_10_release_blocked_if_reconciling(): void
    {
        $this->deviceA->update(['operational_state' => 'reconciling']);
        $deviceService = app(StoreDeviceService::class);

        $this->expectException(StoreDeviceException::class);
        $deviceService->release($this->shopA, $this->deviceA, $this->employee1);
    }

    /** Scenario 11: Device A cannot Release while recovery required */
    public function test_11_release_blocked_if_recovery_required(): void
    {
        $this->deviceA->update(['operational_state' => 'recovery_required']);
        $deviceService = app(StoreDeviceService::class);

        $this->expectException(StoreDeviceException::class);
        $deviceService->release($this->shopA, $this->deviceA, $this->employee1);
    }

    /** Scenario 12 & 13: Clean Device A can Release even if clean open session exists, closing session without opening another */
    public function test_12_13_clean_device_a_release_closes_session(): void
    {
        $session = $this->createSession($this->shopA, $this->deviceA, 10);
        $deviceService = app(StoreDeviceService::class);

        $result = $deviceService->release($this->shopA, $this->deviceA, $this->employee1, [
            'unsynced_v2_event_count' => 0,
            'last_local_sequence' => 0,
        ]);

        $this->assertTrue($result['released']);
        $this->assertEquals('released', $result['device']->status);
        $this->assertEquals('closed', $session->fresh()->status);
        $this->assertNotEquals(hash_hmac('sha256', 'token-a', (string) config('app.key')), $result['device']->device_token_hash);
    }

    /** Scenario 14: Repeated Release request is idempotent */
    public function test_14_release_is_idempotent(): void
    {
        $deviceService = app(StoreDeviceService::class);
        $result1 = $deviceService->release($this->shopA, $this->deviceA, $this->employee1);
        $result2 = $deviceService->release($this->shopA, $this->deviceA, $this->employee1);

        $this->assertTrue($result1['released']);
        $this->assertTrue($result2['released']);
        $this->assertEquals('released', $result2['device']->status);
    }

    /** Scenario 15 & 16: Device B cannot register before A is released, but CAN register after A is released */
    public function test_15_16_device_b_register_preconditions_and_success(): void
    {
        $deviceService = app(StoreDeviceService::class);
        $bUuid = (string) Str::uuid();

        // 15: Device A is active -> Device B register fails
        try {
            $deviceService->register($this->shopA, $bUuid, $this->employee1);
            $this->fail('Registering Device B before A is released should fail');
        } catch (StoreDeviceException $e) {
            $this->assertEquals('store_device_already_bound', $e->reasonCode);
        }

        // Release Device A
        $deviceService->release($this->shopA, $this->deviceA, $this->employee1);

        // 16: Device B can now register successfully!
        $bResult = $deviceService->register($this->shopA, $bUuid, $this->employee1);
        $this->assertNotNull($bResult['device']);
        $this->assertNotNull($bResult['device_token']);
        $this->assertEquals('active', $bResult['device']->status);
        $this->assertEquals(2, $bResult['device']->binding_version);
    }

    /** Scenario 17: Device B binding version is newer than Device A */
    public function test_17_device_b_binding_version_incremented(): void
    {
        $deviceService = app(StoreDeviceService::class);
        $deviceService->release($this->shopA, $this->deviceA, $this->employee1);

        $bResult = $deviceService->register($this->shopA, (string) Str::uuid(), $this->employee1);
        $this->assertGreaterThan($this->deviceA->binding_version, $bResult['device']->binding_version);
    }

    /** Scenario 18: Device A token cannot sync offline events after release */
    public function test_18_released_device_token_cannot_sync(): void
    {
        $session = $this->createSession($this->shopA, $this->deviceA, 10);
        $deviceService = app(StoreDeviceService::class);
        $deviceService->release($this->shopA, $this->deviceA, $this->employee1);

        $this->expectException(OfflineReconciliationException::class);
        app(OfflineReconciliationService::class)->reconcile($this->deviceA->fresh(), $session->fresh(), [
            'snapshot_id' => $session->snapshot_id,
            'events' => [],
        ]);
    }

    /** Scenario 19: Device A continues normal online employee POS & Social Commerce after release */
    public function test_19_device_a_continues_normal_online_commerce_after_release(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $deviceService = app(StoreDeviceService::class);
        $deviceService->release($this->shopA, $this->deviceA, $this->employee1);

        $orderService = app(OrderService::class);

        $posOrder = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'created_by' => $this->employee1->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);

        $socialOrder = $orderService->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shopA->id,
            'customer_name' => 'Post Release Customer',
            'mobile_number' => '01700000011',
            'created_by' => $this->employee1->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);

        $this->assertNotNull($posOrder->id);
        $this->assertNotNull($socialOrder->id);
    }

    /** Full End-to-End Handover Scenario: 5 sales on A -> sync -> release -> B registers -> B gets fresh stock snapshot */
    public function test_20_21_full_e2e_handover_flow(): void
    {
        // 1. Initial Stock = 10
        $this->addStock($this->shopA, $this->product1, 10);
        $sessionA = $this->createSession($this->shopA, $this->deviceA, 10);

        // 2. Device A makes 5 offline sales
        $reconciliation = app(OfflineReconciliationService::class);
        $events = [];
        for ($i = 1; $i <= 5; $i++) {
            $events[] = [
                'local_sequence' => $i,
                'client_transaction_id' => (string) Str::uuid(),
                'type' => 'pos_sale',
                'items' => [['product_id' => $this->product1->id, 'quantity' => 1, 'unit_price' => 1000]],
            ];
        }

        // 3. Sync Device A -> 5 sales reconciled to server
        $result = $reconciliation->reconcile($this->deviceA, $sessionA, [
            'snapshot_id' => $sessionA->snapshot_id,
            'events' => $events,
        ]);
        $this->assertNotNull($result);

        // Server stock is now 5
        $this->assertEquals(5, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);

        // 4. Device A cleanly Releases
        $deviceService = app(StoreDeviceService::class);
        $releaseRes = $deviceService->release($this->shopA, $this->deviceA, $this->employee1, [
            'last_local_sequence' => 5,
            'unsynced_v2_event_count' => 0,
        ]);
        $this->assertTrue($releaseRes['released']);

        // 5. Device B registers as new authority
        $bUuid = (string) Str::uuid();
        $bResult = $deviceService->register($this->shopA, $bUuid, $this->employee1);
        $deviceB = $bResult['device'];

        $this->assertEquals('active', $deviceB->status);
        $this->assertEquals(2, $deviceB->binding_version);

        // 6. Device B receives a fresh snapshot reflecting server stock (5)
        $sessionB = $this->createSession($this->shopA, $deviceB, 5);
        $snapshotBItem = $sessionB->snapshotItems()->first();

        $this->assertEquals(5, $snapshotBItem->opening_available);
    }
}
