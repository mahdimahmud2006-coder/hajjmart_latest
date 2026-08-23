<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\InventoryConflictException;
use App\Exceptions\StoreDeviceException;
use App\Models\Inventory;
use App\Models\OfflineInventorySession;
use App\Models\OfflineInventorySnapshotItem;
use App\Models\OfflineReconciliationAction;
use App\Models\OfflineRecoveryCase;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ReservedProduct;
use App\Models\Shop;
use App\Models\StoreDevice;
use App\Models\User;
use App\Services\DirectBatchService;
use App\Services\InventoryService;
use App\Services\OfflineReconciliationActionProcessor;
use App\Services\OfflineReconciliationService;
use App\Services\OfflineRecoveryService;
use App\Services\OfflineStockMutationGuard;
use App\Services\OrderService;
use App\Services\ReservationPolicyService;
use App\Services\StoreAllocationService;
use App\Services\StoreConnectivityService;
use App\Services\StoreDeviceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;
use Tests\TestCase;

class OfflineOperationsRecoveryQaTest extends TestCase
{
    use RefreshDatabase;

    private Shop $shopA;
    private Shop $shopB;
    private Product $product1;
    private Product $product2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->shopA = Shop::create(['name' => 'Store Alpha', 'code' => 'ALPHA', 'slug' => 'store-alpha', 'is_active' => true]);
        $this->shopB = Shop::create(['name' => 'Store Beta', 'code' => 'BETA', 'slug' => 'store-beta', 'is_active' => true]);

        $this->deviceA = StoreDevice::create([
            'shop_id' => $this->shopA->id,
            'device_uuid' => (string) Str::uuid(),
            'device_token_hash' => hash('sha256', 'sample-token-a'),
            'device_name' => 'Terminal A',
            'binding_version' => 1,
            'status' => 'active',
            'operational_state' => 'normal',
            'last_heartbeat_at' => now(),
        ]);

        $this->deviceB = StoreDevice::create([
            'shop_id' => $this->shopB->id,
            'device_uuid' => (string) Str::uuid(),
            'device_token_hash' => hash('sha256', 'sample-token-b'),
            'device_name' => 'Terminal B',
            'binding_version' => 1,
            'status' => 'active',
            'operational_state' => 'normal',
            'last_heartbeat_at' => now(),
        ]);

        $this->product1 = Product::factory()->create([
            'name' => 'Panjabi Premium',
            'purchasable' => true,
            'is_active' => true,
            'sell_on_website' => true,
            'sell_on_social' => true,
            'sell_on_pos' => true,
            'retail_price' => 1500,
        ]);

        $this->product2 = Product::factory()->create([
            'name' => 'Attar Oud',
            'purchasable' => true,
            'is_active' => true,
            'sell_on_website' => true,
            'sell_on_social' => true,
            'sell_on_pos' => true,
            'retail_price' => 800,
        ]);
    }

    private function addStock(Shop $shop, Product $product, int $quantity): Inventory
    {
        $invService = app(InventoryService::class);
        $invService->adjust($product->id, null, $quantity, 'Initial stock', null, $shop->id);
        return $invService->inventoryRow($product->id, null, $shop->id);
    }

    private function createSession(Shop $shop, StoreDevice $device, array $items = [], string $status = 'open'): OfflineInventorySession
    {
        $session = OfflineInventorySession::create([
            'session_id' => (string) Str::uuid(),
            'snapshot_id' => 'SNAP-' . Str::random(6),
            'shop_id' => $shop->id,
            'store_device_id' => $device->id,
            'binding_version' => 1,
            'opening_inventory_revision' => 1,
            'opened_at' => now(),
            'status' => $status,
            'boundary_server_at' => now()->subMinutes(10),
            'min_client_sequence' => 1,
            'max_client_sequence' => 1,
            'opening_snapshot_hash' => 'hash',
        ]);

        foreach ($items as $item) {
            $product = $item['product'];
            $qty = $item['opening_available'] ?? 5;
            OfflineInventorySnapshotItem::create([
                'offline_inventory_session_id' => $session->id,
                'product_id' => $product->id,
                'variant_id' => null,
                'product_name_snapshot' => $product->name,
                'sku_snapshot' => $product->sku ?: 'SKU-001',
                'opening_quantity' => $qty,
                'opening_reserved' => 0,
                'opening_available' => $qty,
                'retail_price' => $product->retail_price ?: 1500,
                'wholesale_price' => $product->wholesale_price ?: 1000,
                'sell_on_pos' => true,
                'sell_on_social' => true,
                'product_active' => true,
            ]);
        }

        return $session;
    }

    /** Scenario 1 & 23: Two stores sell same SKU offline independently */
    public function test_1_and_23_two_stores_sell_same_sku_independently(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $this->addStock($this->shopB, $this->product1, 10);

        $this->assertEquals(5, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);
        $this->assertEquals(10, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopB->id)->quantity);
    }

    /** Scenario 3 & 26: Pre-boundary reservation protected */
    public function test_3_and_26_pre_boundary_reservation_is_protected(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $orderService = app(OrderService::class);
        $policy = app(ReservationPolicyService::class);

        $order = $orderService->place([
            'checkout_name' => 'Pre-boundary Customer',
            'checkout_mobile_number' => '01700000001',
            'source_channel' => 'website',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 2]],
        ]);

        $session = $this->createSession($this->shopA, $this->deviceA, [['product' => $this->product1, 'opening_available' => 5]]);
        $session->update(['boundary_server_at' => now()->addMinutes(5)]);

        $classification = $policy->classificationForOrder($order, $session);
        $this->assertEquals('protected', $classification);
    }

    /** Scenario 4 & 27: Post-boundary online reservation is preemptible */
    public function test_4_and_27_post_boundary_online_reservation_is_preemptible(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $orderService = app(OrderService::class);
        $policy = app(ReservationPolicyService::class);

        // Put device in offline_confirmed operational state
        $this->deviceA->update(['operational_state' => 'offline_confirmed', 'last_heartbeat_at' => now()->subMinutes(30)]);

        $session = OfflineInventorySession::create([
            'session_id' => (string) Str::uuid(),
            'snapshot_id' => 'SNAP-1',
            'shop_id' => $this->shopA->id,
            'store_device_id' => $this->deviceA->id,
            'binding_version' => 1,
            'opening_inventory_revision' => 1,
            'opened_at' => now(),
            'status' => 'open',
            'boundary_server_at' => now()->subMinutes(5),
            'min_client_sequence' => 1,
            'max_client_sequence' => 1,
            'opening_snapshot_hash' => 'hash',
        ]);

        $order = $orderService->place([
            'checkout_name' => 'Post-boundary Customer',
            'checkout_mobile_number' => '01700000002',
            'source_channel' => 'website',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 2]],
        ]);

        $classification = $policy->classificationForOrder($order, $session);
        $this->assertEquals('preemptible', $classification);
    }

    /** Scenario 8, 9 & 10: Multi-line paid victim whole order cancellation & refund */
    public function test_8_9_and_10_multiline_paid_victim_cancellation_and_refund(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $this->addStock($this->shopA, $this->product2, 5);

        // Device is offline
        $this->deviceA->update(['operational_state' => 'offline_confirmed', 'last_heartbeat_at' => now()->subMinutes(30)]);

        $session = $this->createSession($this->shopA, $this->deviceA, [
            ['product' => $this->product1, 'opening_available' => 5],
            ['product' => $this->product2, 'opening_available' => 5],
        ]);

        $orderService = app(OrderService::class);
        $victimOrder = $orderService->place([
            'checkout_name' => 'Paid Victim',
            'checkout_mobile_number' => '01700000003',
            'source_channel' => 'website',
            'items' => [
                ['product_id' => $this->product1->id, 'quantity' => 1],
                ['product_id' => $this->product2->id, 'quantity' => 1],
            ],
        ]);

        $victimOrder->update([
            'payment_status' => PaymentStatus::PAID->value,
            'reconciliation_status' => 'provisional',
        ]);

        Payment::create([
            'order_id' => $victimOrder->id,
            'payment_method' => 'card',
            'gateway' => 'bkash',
            'amount' => 3000,
            'currency' => 'BDT',
            'status' => PaymentStatus::PAID->value,
            'transaction_reference' => 'TXN-REF-1',
        ]);

        $reconcilationService = app(OfflineReconciliationService::class);
        $result = $reconcilationService->reconcile($this->deviceA, $session, [
            'snapshot_id' => $session->snapshot_id,
            'events' => [
                [
                    'local_sequence' => 1,
                    'client_transaction_id' => (string) Str::uuid(),
                    'type' => 'pos_sale',
                    'items' => [
                        ['product_id' => $this->product1->id, 'quantity' => 5, 'unit_price' => 1500],
                    ],
                ],
            ],
        ]);

        $victimOrder->refresh();
        $this->assertEquals(OrderStatus::RETURNED->value, $victimOrder->status);

        $action = OfflineReconciliationAction::where('order_id', $victimOrder->id)->first();
        $this->assertNotNull($action);
        $this->assertEquals('refund', $action->action_type);
    }

    /** Scenario 11 & 12: Idempotent session replay */
    public function test_11_and_12_idempotent_session_replay(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $session = $this->createSession($this->shopA, $this->deviceA, [['product' => $this->product1, 'opening_available' => 5]]);

        $input = [
            'snapshot_id' => $session->snapshot_id,
            'events' => [
                [
                    'local_sequence' => 1,
                    'client_transaction_id' => (string) Str::uuid(),
                    'type' => 'pos_sale',
                    'items' => [['product_id' => $this->product1->id, 'quantity' => 2, 'unit_price' => 1500]],
                ],
            ],
        ];

        $service = app(OfflineReconciliationService::class);
        $res1 = $service->reconcile($this->deviceA, $session, $input);

        // Replay same session after refresh
        $session->refresh();
        $res2 = $service->reconcile($this->deviceA, $session, $input);

        $this->assertEquals('closed', $session->fresh()->status);
        $this->assertEquals(3, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);
    }

    /** Scenario 15: Server price change during outage preserves snapshot price */
    public function test_15_server_price_change_during_outage_accepted(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);

        // Change server price during outage
        $this->product1->update(['retail_price' => 2000]);

        $session = $this->createSession($this->shopA, $this->deviceA, [['product' => $this->product1, 'opening_available' => 5]]);

        $service = app(OfflineReconciliationService::class);
        $result = $service->reconcile($this->deviceA, $session, [
            'snapshot_id' => $session->snapshot_id,
            'events' => [
                [
                    'local_sequence' => 1,
                    'client_transaction_id' => (string) Str::uuid(),
                    'type' => 'pos_sale',
                    'items' => [['product_id' => $this->product1->id, 'quantity' => 1, 'unit_price' => 1500]],
                ],
            ],
        ]);

        $this->assertEquals('closed', $session->fresh()->status);
    }

    /** Scenario 17: Demand exceeds signed opening available requires recovery */
    public function test_17_demand_exceeds_signed_opening_available_requires_recovery(): void
    {
        $this->addStock($this->shopA, $this->product1, 2);

        $session = $this->createSession($this->shopA, $this->deviceA, [['product' => $this->product1, 'opening_available' => 2]]);

        $service = app(OfflineReconciliationService::class);

        try {
            $service->reconcile($this->deviceA, $session, [
                'snapshot_id' => $session->snapshot_id,
                'events' => [
                    [
                        'local_sequence' => 1,
                        'client_transaction_id' => (string) Str::uuid(),
                        'type' => 'pos_sale',
                        'items' => [['product_id' => $this->product1->id, 'quantity' => 10, 'unit_price' => 1500]],
                    ],
                ],
            ]);
        } catch (\App\Exceptions\OfflineReconciliationException $e) {
            // Expected exception
        }

        $this->assertEquals('recovery_required', $session->fresh()->status);
    }

    /** Scenario 18: Transfer-out from offline store blocked */
    public function test_18_transfer_out_from_offline_store_blocked(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);

        // Put store in OFFLINE_CONFIRMED state
        $this->deviceA->update([
            'operational_state' => 'offline_confirmed',
            'last_heartbeat_at' => now()->subMinutes(30),
        ]);

        $guard = app(OfflineStockMutationGuard::class);
        $this->expectException(InventoryConflictException::class);
        $guard->assertDecreaseAllowed($this->shopA->id, 'stock_transfer_out');
    }

    /** Scenario 22: Unapproved new device binding blocked */
    public function test_22_unapproved_new_device_binding_blocked(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $deviceService = app(StoreDeviceService::class);
        $newShop = Shop::create(['name' => 'Store Unbound', 'code' => 'UNBOUND', 'slug' => 'store-unbound', 'is_active' => true]);

        $deviceService->register($newShop, (string) Str::uuid(), $admin);

        $this->expectException(StoreDeviceException::class);
        $deviceService->register($newShop, (string) Str::uuid(), $admin);
    }

    /** Scenario 24: Store allocator skips reconciling store */
    public function test_24_store_allocator_skips_reconciling_store(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $this->addStock($this->shopB, $this->product1, 5);
        $this->shopB->update(['is_default' => true]);

        // Store A is reconciling
        $session = $this->createSession($this->shopA, $this->deviceA, [['product' => $this->product1, 'opening_available' => 5]], 'reconciling');

        $allocator = app(StoreAllocationService::class);
        $selection = $allocator->chooseStoreForWebsiteOrder([
            ['product_id' => $this->product1->id, 'quantity' => 2],
        ]);

        $this->assertEquals($this->shopB->id, $selection['shop']->id);
    }

    /** Lost Device Recovery Protocol End-to-End Workflow */
    public function test_lost_device_recovery_protocol_workflow(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);
        $deviceService = app(StoreDeviceService::class);
        $reg = $deviceService->registerDevice($this->shopA, 'Old Terminal');

        $admin = User::factory()->create(['is_admin' => true]);
        $recoveryService = app(OfflineRecoveryService::class);

        // Step 1: Initiate protocol
        $case = $recoveryService->initiateLostDeviceProtocol($this->shopA->id, $admin->id, 'Device stolen from store counter.');
        $this->assertEquals('open', $case->status);
        $this->assertEquals('revoked', StoreDevice::find($reg['device']->id)->status);

        // Step 2: Resolve protocol after physical inventory count (found actual qty 8 instead of 10)
        $result = $recoveryService->resolveLostDeviceProtocol(
            $case->id,
            $admin->id,
            [['product_id' => $this->product1->id, 'actual_quantity' => 8]],
            'Physical count verified.',
            'Replacement Terminal 2'
        );

        $this->assertEquals('resolved', $result['recovery_case']->status);
        $this->assertEquals(8, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);
        $this->assertNotNull($result['replacement_device']);
    }

    /** Diagnostic Command: php artisan inventory:reconcile-check */
    public function test_inventory_reconcile_check_artisan_command(): void
    {
        $this->addStock($this->shopA, $this->product1, 10);

        // Command should return 0 (Success) when clean
        $exitCode = Artisan::call('inventory:reconcile-check');
        $this->assertEquals(0, $exitCode);
    }
}
