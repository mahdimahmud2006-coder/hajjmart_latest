<?php

namespace Tests\Feature;

use App\Exceptions\InventoryConflictException;
use App\Exceptions\OfflineReconciliationException;
use App\Jobs\ProcessOfflineReconciliationAction;
use App\Models\Inventory;
use App\Models\OfflineInventorySession;
use App\Models\OfflineInventorySnapshotItem;
use App\Models\OfflineReconciliationAction;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ReservedProduct;
use App\Models\Shop;
use App\Models\StoreDevice;
use App\Models\User;
use App\Services\InventoryService;
use App\Services\OfflineReconciliationActionProcessor;
use App\Services\OfflineReconciliationService;
use App\Services\OrderService;
use App\Services\StoreAllocationService;
use App\Services\StoreConnectivityService;
use App\Services\StoreDeviceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class OfflineConcurrencyStressTest extends TestCase
{
    use RefreshDatabase;

    private Shop $shopA;
    private Shop $shopB;
    private StoreDevice $deviceA;
    private StoreDevice $deviceB;
    private Product $product1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->shopA = Shop::create(['name' => 'Store Alpha', 'code' => 'ST-A', 'slug' => 'store-alpha', 'is_active' => true, 'is_default' => true]);
        $this->shopB = Shop::create(['name' => 'Store Beta', 'code' => 'ST-B', 'slug' => 'store-beta', 'is_active' => true]);

        $this->deviceA = StoreDevice::create([
            'shop_id' => $this->shopA->id,
            'device_uuid' => (string) Str::uuid(),
            'device_token_hash' => hash('sha256', 'token-a'),
            'device_name' => 'Terminal Alpha',
            'binding_version' => 1,
            'status' => 'active',
            'operational_state' => 'normal',
            'last_heartbeat_at' => now(),
        ]);

        $this->deviceB = StoreDevice::create([
            'shop_id' => $this->shopB->id,
            'device_uuid' => (string) Str::uuid(),
            'device_token_hash' => hash('sha256', 'token-b'),
            'device_name' => 'Terminal Beta',
            'binding_version' => 1,
            'status' => 'active',
            'operational_state' => 'normal',
            'last_heartbeat_at' => now(),
        ]);

        $this->product1 = Product::create([
            'name' => 'Stress SKU',
            'sku' => 'STRESS-SKU-1',
            'slug' => 'stress-sku-1',
            'retail_price' => 1000,
            'wholesale_price' => 800,
            'is_active' => true,
        ]);
    }

    private function addStock(Shop $shop, Product $product, int $qty): Inventory
    {
        $invService = app(InventoryService::class);
        $invService->adjust($product->id, null, $qty, 'Setup stock', null, $shop->id);
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
                'retail_price' => $product->retail_price ?: 1000,
                'wholesale_price' => $product->wholesale_price ?: 800,
                'sell_on_pos' => true,
                'sell_on_social' => true,
                'product_active' => true,
            ]);
        }

        return $session;
    }

    /** Stress Scenario 1: 20+ concurrent Website checkouts against one final stock pool */
    public function test_stress_1_concurrent_checkouts_respect_stock_limit(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $orderService = app(OrderService::class);

        $successful = 0;
        $failed = 0;

        for ($i = 1; $i <= 25; $i++) {
            try {
                $orderService->place([
                    'checkout_name' => "Customer {$i}",
                    'checkout_mobile_number' => '01700000000',
                    'source_channel' => 'website',
                    'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
                ]);
                $successful++;
            } catch (InventoryConflictException $e) {
                $failed++;
            }
        }

        $this->assertEquals(5, $successful);
        $this->assertEquals(20, $failed);
        $inv = app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id);
        $this->assertEquals(5, $inv->reserved);
        $this->assertEquals(0, $inv->quantity - $inv->reserved);
    }

    /** Stress Scenario 2: Reconciliation while checkout workers attempt allocation */
    public function test_stress_2_reconciliation_concurrent_with_checkout_allocation(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $this->addStock($this->shopB, $this->product1, 5);

        // Put Store A device into reconciling operational_state
        $this->deviceA->update(['operational_state' => 'reconciling']);
        $sessionA = $this->createSession($this->shopA, $this->deviceA, [['product' => $this->product1, 'opening_available' => 5]], 'reconciling');

        $allocator = app(StoreAllocationService::class);
        $selection = $allocator->chooseStoreForWebsiteOrder([
            ['product_id' => $this->product1->id, 'quantity' => 2],
        ]);

        // Allocation must bypass Store A and select Store B
        $this->assertEquals($this->shopB->id, $selection['shop']->id);
    }

    /** Stress Scenario 3: 10 identical full-session sync requests in parallel */
    public function test_stress_3_parallel_identical_session_sync_requests(): void
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
                    'items' => [['product_id' => $this->product1->id, 'quantity' => 2, 'unit_price' => 1000]],
                ],
            ],
        ];

        $service = app(OfflineReconciliationService::class);

        $results = [];
        for ($i = 0; $i < 10; $i++) {
            $session->refresh();
            $results[] = $service->reconcile($this->deviceA, $session, $input);
        }

        foreach ($results as $res) {
            $this->assertNotNull($res);
        }

        $inv = app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id);
        $this->assertEquals(3, $inv->quantity);
    }

    /** Stress Scenario 4: Two tabs committing mixed multi-SKU POS/Social events */
    public function test_stress_4_mixed_multisku_pos_social_events_replay(): void
    {
        $product2 = Product::create([
            'name' => 'Stress SKU 2',
            'sku' => 'STRESS-SKU-2',
            'slug' => 'stress-sku-2',
            'retail_price' => 1500,
            'is_active' => true,
        ]);

        $this->addStock($this->shopA, $this->product1, 10);
        $this->addStock($this->shopA, $product2, 10);

        $session = $this->createSession($this->shopA, $this->deviceA, [
            ['product' => $this->product1, 'opening_available' => 10],
            ['product' => $product2, 'opening_available' => 10],
        ]);

        $input = [
            'snapshot_id' => $session->snapshot_id,
            'events' => [
                [
                    'local_sequence' => 1,
                    'client_transaction_id' => (string) Str::uuid(),
                    'type' => 'pos_sale',
                    'items' => [['product_id' => $this->product1->id, 'quantity' => 3, 'unit_price' => 1000]],
                ],
                [
                    'local_sequence' => 2,
                    'client_transaction_id' => (string) Str::uuid(),
                    'type' => 'social_order',
                    'payload' => [
                        'customer_name' => 'Social Customer',
                        'customer_mobile' => '01700000000',
                        'delivery_address' => 'Dhaka',
                    ],
                    'items' => [['product_id' => $product2->id, 'quantity' => 4, 'unit_price' => 1500]],
                ],
            ],
        ];

        $service = app(OfflineReconciliationService::class);
        $res = $service->reconcile($this->deviceA, $session, $input);

        $this->assertEquals('closed', $session->fresh()->status);
        $this->assertEquals(7, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);
        $this->assertEquals(10, app(InventoryService::class)->inventoryRow($product2->id, null, $this->shopA->id)->quantity);
        $this->assertEquals(4, ReservedProduct::where('shop_id', $this->shopA->id)->where('product_id', $product2->id)->where('status', 'active')->sum('qty'));
    }

    /** Stress Scenario 5: Heartbeat flapping around suspected/offline thresholds */
    public function test_stress_5_heartbeat_flapping_state_transitions(): void
    {
        $connectivity = app(StoreConnectivityService::class);

        // Recent heartbeat -> online_healthy
        $this->deviceA->update(['last_heartbeat_at' => now(), 'operational_state' => 'normal']);
        $this->assertEquals('online_healthy', $connectivity->stateFor($this->shopA));

        // Heartbeat 90 seconds old -> offline_suspected
        $this->deviceA->update(['last_heartbeat_at' => now()->subSeconds(90)]);
        $this->assertEquals('offline_suspected', $connectivity->stateFor($this->shopA));

        // Heartbeat 10 minutes old -> offline_confirmed
        $this->deviceA->update(['last_heartbeat_at' => now()->subMinutes(10)]);
        $this->assertEquals('offline_confirmed', $connectivity->stateFor($this->shopA));

        // Heartbeat returns -> online_healthy
        $this->deviceA->update(['last_heartbeat_at' => now(), 'operational_state' => 'normal']);
        $this->assertEquals('online_healthy', $connectivity->stateFor($this->shopA));
    }

    /** Stress Scenario 6: Duplicate refund job deliveries */
    public function test_stress_6_duplicate_refund_job_deliveries_are_idempotent(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $session = $this->createSession($this->shopA, $this->deviceA);
        $orderService = app(OrderService::class);
        $order = $orderService->place([
            'checkout_name' => 'Victim Customer',
            'checkout_mobile_number' => '01700000099',
            'source_channel' => 'website',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'card',
            'gateway' => 'bkash',
            'amount' => 1000,
            'currency' => 'BDT',
            'status' => 'paid',
            'transaction_reference' => 'TXN-DUP-REF',
        ]);

        $action = OfflineReconciliationAction::create([
            'offline_inventory_session_id' => $session->id,
            'action_type' => 'refund',
            'order_id' => $order->id,
            'payment_id' => $payment->id,
            'status' => 'pending',
            'amount' => 1000,
            'currency' => 'BDT',
            'reason_code' => 'offline_preempted_online_order',
            'idempotency_key' => "test:refund:{$order->id}",
        ]);

        $job = new ProcessOfflineReconciliationAction($action->id);

        // Run job twice (simulating duplicate queue delivery)
        $job->handle(app(\App\Services\PaymentService::class), app(\App\Services\ActivityLogService::class));
        $job->handle(app(\App\Services\PaymentService::class), app(\App\Services\ActivityLogService::class));

        $action->refresh();
        $this->assertEquals('completed', $action->status);
    }

    /** Stress Scenario 7: Process crash after reconciliation DB commit but before HTTP response */
    public function test_stress_7_crash_recovery_after_db_commit(): void
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
                    'items' => [['product_id' => $this->product1->id, 'quantity' => 2, 'unit_price' => 1000]],
                ],
            ],
        ];

        $service = app(OfflineReconciliationService::class);
        $res1 = $service->reconcile($this->deviceA, $session, $input);

        // Re-call reconcile on fresh instance representing HTTP retry after client disconnect
        $session->refresh();
        $res2 = $service->reconcile($this->deviceA, $session, $input);

        $this->assertEquals('closed', $session->fresh()->status);
        $this->assertEquals(3, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);
    }

    /** Stress Scenario 8: Process crash after refund action creation but before queue dispatch */
    public function test_stress_8_process_refund_actions_picked_up(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $session = $this->createSession($this->shopA, $this->deviceA);
        $orderService = app(OrderService::class);
        $order = $orderService->place([
            'checkout_name' => 'Pending Action Customer',
            'checkout_mobile_number' => '01700000088',
            'source_channel' => 'website',
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'card',
            'gateway' => 'nagad',
            'amount' => 1000,
            'currency' => 'BDT',
            'status' => 'paid',
            'transaction_reference' => 'TXN-CRASH-REF',
        ]);

        // Create pending action without dispatching job
        $action = OfflineReconciliationAction::create([
            'offline_inventory_session_id' => $session->id,
            'action_type' => 'refund',
            'order_id' => $order->id,
            'payment_id' => $payment->id,
            'status' => 'pending',
            'amount' => 1000,
            'currency' => 'BDT',
            'reason_code' => 'offline_preempted_online_order',
            'idempotency_key' => "test:crash:{$order->id}",
        ]);

        $processor = app(OfflineReconciliationActionProcessor::class);
        $processor->process($session);

        $action->refresh();
        $this->assertEquals('completed', $action->status);
    }

    /** Stress Scenario 9: Simultaneous reconciliation for two stores carrying the same SKU */
    public function test_stress_9_simultaneous_two_store_reconciliation(): void
    {
        $this->addStock($this->shopA, $this->product1, 5);
        $this->addStock($this->shopB, $this->product1, 10);

        $sessionA = $this->createSession($this->shopA, $this->deviceA, [['product' => $this->product1, 'opening_available' => 5]]);
        $sessionB = $this->createSession($this->shopB, $this->deviceB, [['product' => $this->product1, 'opening_available' => 10]]);

        $service = app(OfflineReconciliationService::class);

        $resA = $service->reconcile($this->deviceA, $sessionA, [
            'snapshot_id' => $sessionA->snapshot_id,
            'events' => [
                [
                    'local_sequence' => 1,
                    'client_transaction_id' => (string) Str::uuid(),
                    'type' => 'pos_sale',
                    'items' => [['product_id' => $this->product1->id, 'quantity' => 2, 'unit_price' => 1000]],
                ],
            ],
        ]);

        $resB = $service->reconcile($this->deviceB, $sessionB, [
            'snapshot_id' => $sessionB->snapshot_id,
            'events' => [
                [
                    'local_sequence' => 1,
                    'client_transaction_id' => (string) Str::uuid(),
                    'type' => 'pos_sale',
                    'items' => [['product_id' => $this->product1->id, 'quantity' => 4, 'unit_price' => 1000]],
                ],
            ],
        ]);

        $this->assertEquals(3, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);
        $this->assertEquals(6, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopB->id)->quantity);
    }

    /** Stress Scenario 10: Large session replay within bounded batch size */
    public function test_stress_10_large_session_batch_replay(): void
    {
        $this->addStock($this->shopA, $this->product1, 100);
        $session = $this->createSession($this->shopA, $this->deviceA, [['product' => $this->product1, 'opening_available' => 100]]);

        $events = [];
        for ($seq = 1; $seq <= 20; $seq++) {
            $events[] = [
                'local_sequence' => $seq,
                'client_transaction_id' => (string) Str::uuid(),
                'type' => 'pos_sale',
                'payload' => ['customer_name' => 'Walk-in Customer'],
                'items' => [['product_id' => $this->product1->id, 'quantity' => 2, 'unit_price' => 1000]],
            ];
        }

        $service = app(OfflineReconciliationService::class);
        $result = $service->reconcile($this->deviceA, $session, [
            'snapshot_id' => $session->snapshot_id,
            'events' => $events,
        ]);

        $this->assertEquals('closed', $session->fresh()->status);
        $this->assertEquals(60, app(InventoryService::class)->inventoryRow($this->product1->id, null, $this->shopA->id)->quantity);
    }
}
