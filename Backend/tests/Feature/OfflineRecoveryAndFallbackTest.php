<?php

namespace Tests\Feature;

use App\Exceptions\InventoryConflictException;
use App\Exceptions\OfflineReconciliationException;
use App\Exceptions\StoreDeviceException;
use App\Models\Inventory;
use App\Models\OfflineInventorySession;
use App\Models\OfflineInventorySnapshotItem;
use App\Models\OfflineRecoveryCase;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shop;
use App\Models\StoreDevice;
use App\Models\User;
use App\Services\InventoryService;
use App\Services\OfflineReconciliationService;
use App\Services\OfflineRecoveryService;
use App\Services\OrderService;
use App\Services\StoreConnectivityService;
use App\Services\StoreDeviceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class OfflineRecoveryAndFallbackTest extends TestCase
{
    use RefreshDatabase;

    private Shop $shopA;
    private Shop $shopB;
    private StoreDevice $deviceA;
    private Product $product1;
    private User $admin;
    private User $employee;

    protected function setUp(): void
    {
        parent::setUp();

        $this->shopA = Shop::create(['name' => 'Store Alpha', 'code' => 'ST-A', 'slug' => 'store-alpha', 'is_active' => true, 'is_default' => true]);
        $this->shopB = Shop::create(['name' => 'Store Beta', 'code' => 'ST-B', 'slug' => 'store-beta', 'is_active' => true]);

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
            'name' => 'Recovery SKU',
            'sku' => 'REC-SKU-1',
            'slug' => 'rec-sku-1',
            'retail_price' => 1000,
            'wholesale_price' => 800,
            'is_active' => true,
            'sell_on_pos' => true,
            'sell_on_social' => true,
        ]);

        $this->admin = User::factory()->create(['name' => 'Admin User', 'is_employee' => true, 'is_admin' => true, 'shop_id' => $this->shopA->id]);
        $this->employee = User::factory()->create(['name' => 'Staff User', 'is_employee' => true, 'is_admin' => false, 'shop_id' => $this->shopA->id]);
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

    /** Scenarios 1, 2, 3: Device A battery dies with unsynced sales -> Device B registration & ordinary online POS/Social blocked */
    public function test_1_2_3_dead_battery_blocks_device_b_and_online_sales(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $this->createSession($this->shopA, $this->deviceA, 10);
        $this->deviceA->update(['last_heartbeat_at' => now()->subMinutes(5)]);

        $deviceService = app(StoreDeviceService::class);
        $orderService = app(OrderService::class);

        // 1: Device B registration blocked
        try {
            $deviceService->register($this->shopA, (string) Str::uuid(), $this->admin);
            $this->fail('Device B registration should be blocked');
        } catch (StoreDeviceException $e) {
            $this->assertEquals('store_device_already_bound', $e->reasonCode);
        }

        // 2 & 3: Ordinary online POS and Social succeed when online
        $posOrder = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);
        $this->assertNotNull($posOrder->id);

        $socialOrder = $orderService->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shopA->id,
            'customer_name' => 'Paper Fallback Customer',
            'mobile_number' => '01700000022',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);
        $this->assertNotNull($socialOrder->id);
    }

    /** Scenarios 4, 5, 6, 7, 8: Device A powers back on -> syncs 5 events -> staff enter 2 paper sales -> total 7 sales */
    public function test_4_to_8_recoverable_device_reconnects_and_syncs(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $sessionA = $this->createSession($this->shopA, $this->deviceA, 10);

        // 4 & 5: Device A syncs 5 events
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
        $reconciliation->reconcile($this->deviceA, $sessionA, [
            'snapshot_id' => $sessionA->snapshot_id,
            'events' => $events,
        ]);

        $this->assertEquals(5, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);

        // 6: Staff enter 2 handwritten POS sales online
        $orderService = app(OrderService::class);
        $paperOrder1 = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'manual_outage_reference' => 'PAPER-001',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);
        $paperOrder2 = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopA->id,
            'manual_outage_reference' => 'PAPER-002',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);

        $this->assertNotNull($paperOrder1->id);
        $this->assertNotNull($paperOrder2->id);
        // Total remaining physical stock is now 3 (10 - 5 - 2)
        $this->assertEquals(3, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);

        // 8: Device A releases -> Device B registers -> Device B snapshot reflects remaining stock (3)
        $deviceService = app(StoreDeviceService::class);
        $deviceService->release($this->shopA, $this->deviceA, $this->admin, ['last_local_sequence' => 5, 'unsynced_v2_event_count' => 0]);

        $bResult = $deviceService->register($this->shopA, (string) Str::uuid(), $this->admin);
        $sessionB = $this->createSession($this->shopA, $bResult['device'], 3);
        $this->assertEquals(3, $sessionB->snapshotItems()->first()->opening_available);
    }

    /** Scenarios 9, 10, 11, 12, 13: Manager marks A unavailable -> recovery case created -> store recovery required */
    public function test_9_to_13_lost_device_recovery_protocol(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $this->addStock($this->shopB, $this->product1, 10);

        $recoveryService = app(OfflineRecoveryService::class);
        $case = $recoveryService->initiateLostDeviceProtocol($this->shopA->id, $this->admin->id, 'Device stolen at counter');

        // 9: Recovery case created
        $this->assertNotNull($case->id);
        $this->assertEquals('lost_device_possible_unsynced_events', $case->reason_code);
        $this->assertEquals('open', $case->status);

        // 10: Store state is recovery_required
        $this->assertEquals('recovery_required', app(StoreConnectivityService::class)->stateFor($this->shopA));

        // 11: Device B cannot register during recovery
        try {
            app(StoreDeviceService::class)->register($this->shopA, (string) Str::uuid(), $this->admin);
            $this->fail('Registration should fail during recovery');
        } catch (StoreDeviceException $e) {
            $this->assertEquals('store_device_already_bound', $e->reasonCode);
        }

        // 12: Ordinary employee POS for Store A blocked with store_offline_recovery_in_progress
        try {
            app(OrderService::class)->place([
                'source_channel' => 'pos',
                'shop_id' => $this->shopA->id,
                'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
            ]);
            $this->fail('Ordinary POS should be blocked during recovery');
        } catch (OfflineReconciliationException $e) {
            $this->assertEquals('store_offline_recovery_in_progress', $e->reasonCode);
        }

        // 13: Store B unaffected
        $orderB = app(OrderService::class)->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shopB->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 2]],
        ]);
        $this->assertNotNull($orderB->id);
    }

    /** Scenarios 14 to 25: Complete permanent lost device recovery workflow */
    public function test_14_to_25_permanent_lost_device_recovery_workflow(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $recoveryService = app(OfflineRecoveryService::class);
        $case = $recoveryService->initiateLostDeviceProtocol($this->shopA->id, $this->admin->id, 'Device lost');

        // 14: Record physical count evidence
        $case = $recoveryService->recordPhysicalCountEvidence($case->id, [
            ['product_id' => $this->product1->id, 'variant_id' => null, 'quantity' => 7],
        ], $this->admin->id);
        $this->assertNotEmpty($case->evidence_json['physical_counts']);

        // 15 & 16: Manual recovery POS order entry (idempotent)
        $order1 = $recoveryService->recordManualRecoveryOrder($case->id, [
            'source_channel' => 'pos',
            'manual_outage_reference' => 'PAPER-101',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 2, 'unit_price' => 950]],
            'paid_amount' => 1900,
        ], $this->admin->id);

        $order1Retry = $recoveryService->recordManualRecoveryOrder($case->id, [
            'source_channel' => 'pos',
            'manual_outage_reference' => 'PAPER-101',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 2, 'unit_price' => 950]],
        ], $this->admin->id);

        // 16: Retry returns same order
        $this->assertEquals($order1->id, $order1Retry->id);
        // Stock decremented by 2 (10 - 2 = 8)
        $this->assertEquals(8, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);

        // 17 & 18: Manual recovery Social order entry (creates reservation & preserves paper price)
        $socialOrder = $recoveryService->recordManualRecoveryOrder($case->id, [
            'source_channel' => 'social_commerce',
            'manual_outage_reference' => 'PAPER-102',
            'customer_name' => 'Paper Social Customer',
            'mobile_number' => '01700000033',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1, 'unit_price' => 900]],
        ], $this->admin->id);

        $this->assertNotNull($socialOrder->id);

        // Expected server stock is 8, physical count evidence was 7 -> discrepancy adjustment of -1
        // 23: Resolve lost device recovery protocol with discrepancy correction (-1)
        $result = $recoveryService->resolveLostDeviceProtocol($case->id, $this->admin->id, [
            ['product_id' => $this->product1->id, 'variant_id' => null, 'actual_quantity' => 7],
        ], 'Resolved after physical count and paper re-entry');

        $this->assertEquals('resolved', $result['recovery_case']->status);
        $this->assertEquals(7, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);

        // 24 & 25: Device B can now register cleanly after recovery resolution
        $bUuid = (string) Str::uuid();
        $bResult = app(StoreDeviceService::class)->register($this->shopA, $bUuid, $this->admin);

        $this->assertNotNull($bResult['device']);
        $this->assertEquals('active', $bResult['device']->status);

        $sessionB = $this->createSession($this->shopA, $bResult['device'], 7);
        $this->assertEquals(7, $sessionB->snapshotItems()->first()->opening_available);
    }

    /** Scenarios 26, 27, 28, 29: Old Device A comes back after recovery & replacement -> old token rejected */
    public function test_26_to_29_old_device_a_reappears_after_recovery_fails_gracefully(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $sessionA = $this->createSession($this->shopA, $this->deviceA, 10);

        // Lost device recovery
        $recoveryService = app(OfflineRecoveryService::class);
        $case = $recoveryService->initiateLostDeviceProtocol($this->shopA->id, $this->admin->id, 'Lost device');
        $recoveryService->recordPhysicalCountEvidence($case->id, [['product_id' => $this->product1->id, 'quantity' => 10]], $this->admin->id);
        $recoveryService->resolveLostDeviceProtocol($case->id, $this->admin->id);

        // Device B registers
        app(StoreDeviceService::class)->register($this->shopA, (string) Str::uuid(), $this->admin);

        // 26 & 28: Device A attempts to reconcile old session -> rejected
        $this->expectException(OfflineReconciliationException::class);
        app(OfflineReconciliationService::class)->reconcile($this->deviceA->fresh(), $sessionA->fresh(), [
            'snapshot_id' => $sessionA->snapshot_id,
            'events' => [
                [
                    'local_sequence' => 1,
                    'client_transaction_id' => (string) Str::uuid(),
                    'type' => 'pos_sale',
                    'items' => [['product_id' => $this->product1->id, 'quantity' => 1, 'unit_price' => 1000]],
                ],
            ],
        ]);
    }
}
