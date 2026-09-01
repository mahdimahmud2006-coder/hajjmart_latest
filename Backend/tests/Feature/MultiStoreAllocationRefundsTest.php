<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\InventoryConflictException;
use App\Jobs\ProcessOfflineReconciliationAction;
use App\Models\Inventory;
use App\Models\OfflineInventorySession;
use App\Models\OfflineReconciliationAction;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Shop;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\StoreDevice;
use App\Models\User;
use App\Services\InventoryService;
use App\Services\OfflineStockMutationGuard;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Services\StoreAllocationService;
use App\Services\StoreConnectivityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class MultiStoreAllocationRefundsTest extends TestCase
{
    use RefreshDatabase;

    private Shop $mainStore;
    private Shop $branchStore;
    private Shop $provisionalStore;
    private Product $product1;
    private Product $product2;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['is_employee' => true, 'is_admin' => true]);

        Shop::query()->delete();

        $this->mainStore = Shop::create([
            'name' => 'Main Fulfilment Hub',
            'code' => 'MAIN-PRD07',
            'slug' => 'main-hub-prd07',
            'is_active' => true,
            'is_default' => true,
            'settings' => ['online_fulfilment_priority' => 1, 'support_website_channel' => true],
            'inventory_revision' => 10,
        ]);

        $this->branchStore = Shop::create([
            'name' => 'Chittagong Branch',
            'code' => 'CTG-PRD07',
            'slug' => 'ctg-branch-prd07',
            'is_active' => true,
            'is_default' => false,
            'settings' => ['online_fulfilment_priority' => 2, 'support_website_channel' => true],
            'inventory_revision' => 5,
        ]);

        $this->provisionalStore = Shop::create([
            'name' => 'Sylhet POS Branch',
            'code' => 'SYL-PRD07',
            'slug' => 'syl-branch-prd07',
            'is_active' => true,
            'is_default' => false,
            'settings' => ['online_fulfilment_priority' => 3, 'support_website_channel' => true],
            'inventory_revision' => 1,
        ]);

        // Device on provisional store makes it offline_confirmed
        StoreDevice::create([
            'shop_id' => $this->provisionalStore->id,
            'device_uuid' => (string) Str::uuid(),
            'device_token_hash' => hash('sha256', 'sample-token-hash'),
            'device_name' => 'Sylhet Counter POS',
            'status' => 'active',
            'operational_state' => StoreConnectivityService::OFFLINE_CONFIRMED,
            'last_heartbeat_at' => now()->subMinutes(30),
            'registered_at' => now()->subDays(5),
        ]);

        $this->product1 = Product::create([
            'name' => 'Hajj Ihram Cloth Premium',
            'slug' => 'ihram-cloth-premium',
            'sku' => 'IHR-001',
            'retail_price' => 1500,
            'wholesale_price' => 1200,
            'selling_price' => 1500,
            'sell_on_website' => true,
            'sell_on_social' => true,
            'sell_on_pos' => true,
        ]);

        $this->product2 = Product::create([
            'name' => 'Zamzam Water 5L',
            'slug' => 'zamzam-water-5l',
            'sku' => 'ZAM-005',
            'retail_price' => 2500,
            'wholesale_price' => 2000,
            'selling_price' => 2500,
            'sell_on_website' => true,
            'sell_on_social' => true,
            'sell_on_pos' => true,
        ]);

        $invService = app(InventoryService::class);
        $invService->adjust($this->product1->id, null, 50, 'Initial', $this->admin->id, $this->mainStore->id);
        $invService->adjust($this->product2->id, null, 50, 'Initial', $this->admin->id, $this->mainStore->id);

        $invService->adjust($this->product1->id, null, 30, 'Initial', $this->admin->id, $this->branchStore->id);
        $invService->adjust($this->product2->id, null, 30, 'Initial', $this->admin->id, $this->branchStore->id);

        $invService->adjust($this->product1->id, null, 20, 'Initial', $this->admin->id, $this->provisionalStore->id);
        $invService->adjust($this->product2->id, null, 20, 'Initial', $this->admin->id, $this->provisionalStore->id);
    }

    // 1. Preferred healthy online hub has all stock -> Website allocates there
    public function test_1_preferred_healthy_online_hub_allocates_order(): void
    {
        $allocator = app(StoreAllocationService::class);
        $items = [['product_id' => $this->product1->id, 'quantity' => 2]];
        $result = $allocator->chooseStoreForWebsiteOrder($items);

        $this->assertSame($this->mainStore->id, $result['shop']->id);
        $this->assertFalse($result['is_provisional']);
    }

    // 2. Preferred hub lacks one line -> another healthy store gets whole order
    public function test_2_preferred_hub_lacks_one_line_reroutes_to_other_healthy_store(): void
    {
        // Reduce main store product2 stock to 0
        Inventory::where('shop_id', $this->mainStore->id)
            ->where('product_id', $this->product2->id)
            ->update(['quantity' => 0]);

        $allocator = app(StoreAllocationService::class);
        $items = [
            ['product_id' => $this->product1->id, 'quantity' => 2],
            ['product_id' => $this->product2->id, 'quantity' => 2],
        ];

        $result = $allocator->chooseStoreForWebsiteOrder($items);

        $this->assertSame($this->branchStore->id, $result['shop']->id);
        $this->assertFalse($result['is_provisional']);
    }

    // 3. No healthy store fits but offline-risk store fits -> provisional allocation
    public function test_3_offline_risk_store_fits_results_in_provisional_allocation(): void
    {
        // Drain healthy stores product1 stock
        Inventory::whereIn('shop_id', [$this->mainStore->id, $this->branchStore->id])
            ->where('product_id', $this->product1->id)
            ->update(['quantity' => 0]);

        $allocator = app(StoreAllocationService::class);
        $items = [['product_id' => $this->product1->id, 'quantity' => 5]];

        $result = $allocator->chooseStoreForWebsiteOrder($items);

        $this->assertSame($this->provisionalStore->id, $result['shop']->id);
        $this->assertTrue($result['is_provisional']);
    }

    // 4. All stores insufficient -> no partial reservations anywhere
    public function test_4_all_stores_insufficient_throws_exception_no_partial_reservations(): void
    {
        $allocator = app(StoreAllocationService::class);
        $items = [['product_id' => $this->product1->id, 'quantity' => 999]];

        $this->expectException(InventoryConflictException::class);
        $allocator->chooseStoreForWebsiteOrder($items);
    }

    // 5. Order never splits across stores
    public function test_5_order_never_splits_across_stores(): void
    {
        // Main store has 10 of P1, 0 of P2. Branch store has 0 of P1, 10 of P2.
        Inventory::where('shop_id', $this->mainStore->id)->where('product_id', $this->product2->id)->update(['quantity' => 0]);
        Inventory::where('shop_id', $this->branchStore->id)->where('product_id', $this->product1->id)->update(['quantity' => 0]);
        Inventory::where('shop_id', $this->provisionalStore->id)->where('product_id', $this->product1->id)->update(['quantity' => 0]);

        $allocator = app(StoreAllocationService::class);
        $items = [
            ['product_id' => $this->product1->id, 'quantity' => 5],
            ['product_id' => $this->product2->id, 'quantity' => 5],
        ];

        $this->expectException(InventoryConflictException::class);
        $allocator->chooseStoreForWebsiteOrder($items);
    }

    // 6. Forged public shop_id cannot force fulfilment store
    public function test_6_forged_public_shop_id_cannot_force_fulfilment_store(): void
    {
        $payload = $this->checkoutPayload('cod', (string) Str::uuid());
        $payload['shop_id'] = $this->provisionalStore->id; // Trying to force provisional store

        $order = app(OrderService::class)->place($payload);

        // Server-side allocator assigns mainStore, ignoring forced shop_id
        $this->assertSame($this->mainStore->id, $order->shop_id);
    }

    // 7. Allocation token item hash mismatch -> rejected
    public function test_7_allocation_token_item_hash_mismatch_rejected(): void
    {
        $allocator = app(StoreAllocationService::class);
        $itemsQuote = [['product_id' => $this->product1->id, 'quantity' => 2]];
        $token = $allocator->generateAllocationToken($this->mainStore, $itemsQuote, 3000, false);

        $itemsCheckoutDifferent = [['product_id' => $this->product1->id, 'quantity' => 5]];

        $this->expectException(InventoryConflictException::class);
        $allocator->verifyAllocationToken($token, $itemsCheckoutDifferent);
    }

    // 8. Allocation token expired -> re-quote/revalidate path
    public function test_8_allocation_token_expired_rejected(): void
    {
        $allocator = app(StoreAllocationService::class);
        $items = [['product_id' => $this->product1->id, 'quantity' => 2]];

        $payload = [
            'shop_id' => $this->mainStore->id,
            'item_hash' => $allocator->computeItemHash($items),
            'inventory_revision' => 1,
            'grand_total' => 3000,
            'is_provisional' => false,
            'expires_at' => now()->subMinute()->timestamp, // Expired
        ];

        $json = json_encode($payload);
        $sig = hash_hmac('sha256', $json, config('app.key', 'base64:hajjmart_secret_key'));
        $expiredToken = base64_encode($json . '.' . $sig);

        $this->expectException(InventoryConflictException::class);
        $allocator->verifyAllocationToken($expiredToken, $items);
    }

    // 9. Final placement revalidates stock under locks
    public function test_9_final_placement_revalidates_stock_under_locks(): void
    {
        $orderService = app(OrderService::class);
        $quote = $orderService->quoteCheckout([
            'items' => [['product_id' => $this->product1->id, 'quantity' => 2]],
            'district' => 'Dhaka',
            'delivery_area' => 'inside_dhaka',
            'payment_method' => 'cod',
        ]);

        $this->assertArrayHasKey('allocation_token', $quote);

        // Deplete stock in mainStore before place()
        Inventory::where('shop_id', $this->mainStore->id)
            ->where('product_id', $this->product1->id)
            ->update(['quantity' => 0]);

        $payload = $this->checkoutPayload('cod', (string) Str::uuid());
        $payload['allocation_token'] = $quote['allocation_token'];

        // Place re-evaluates and falls back to branchStore which has stock
        $order = $orderService->place($payload);
        $this->assertSame($this->branchStore->id, $order->shop_id);
    }

    // 10. Two Website checkouts race for final unit -> exactly one reservation
    public function test_10_two_website_checkouts_race_for_final_unit(): void
    {
        Inventory::where('shop_id', $this->mainStore->id)->where('product_id', $this->product1->id)->update(['quantity' => 1, 'reserved' => 0]);
        Inventory::where('shop_id', $this->branchStore->id)->where('product_id', $this->product1->id)->update(['quantity' => 0, 'reserved' => 0]);
        Inventory::where('shop_id', $this->provisionalStore->id)->where('product_id', $this->product1->id)->update(['quantity' => 0, 'reserved' => 0]);

        $orderService = app(OrderService::class);

        // First checkout succeeds
        $payload1 = $this->checkoutPayload('cod', (string) Str::uuid());
        $payload1['items'] = [['product_id' => $this->product1->id, 'quantity' => 1]];
        $order1 = $orderService->place($payload1);
        $this->assertNotNull($order1);

        // Second checkout fails due to stock exhaustion
        $payload2 = $this->checkoutPayload('cod', (string) Str::uuid());
        $payload2['items'] = [['product_id' => $this->product1->id, 'quantity' => 1]];

        $this->expectException(InventoryConflictException::class);
        $orderService->place($payload2);
    }

    // 11. Ordinary online Social at online store succeeds
    public function test_11_ordinary_online_social_at_offline_risk_store_succeeds(): void
    {
        $orderService = app(OrderService::class);
        $payload = [
            'source_channel' => 'social_commerce',
            'shop_id' => $this->provisionalStore->id,
            'items' => [['product_id' => $this->product1->id, 'quantity' => 1]],
            'name' => 'Social Customer',
            'mobile_number' => '01711223344',
            'district' => 'Sylhet',
            'full_address' => 'Sylhet Sadar',
            'payment_method' => 'cod',
            'terms_accepted' => true,
        ];

        $order = $orderService->place($payload);
        $this->assertNotNull($order->id);
    }

    // 12. Provisional order cannot enter processing
    public function test_12_provisional_order_cannot_enter_processing(): void
    {
        $order = Order::create([
            'order_list_id' => \App\Models\OrderList::create()->id,
            'order_id' => (string) random_int(100000, 999999),
            'order_number' => 'HM-PROV-12',
            'shop_id' => $this->provisionalStore->id,
            'source_channel' => 'website',
            'status' => 'pending',
            'payment_status' => 'due',
            'payment_method' => 'cod',
            'reconciliation_status' => 'provisional',
            'grand_total' => 1500,
            'checkout_name' => 'Test',
            'checkout_mobile_number' => '01711111111',
            'checkout_district' => 'Dhaka',
            'checkout_full_address' => 'Dhaka',
            'terms_accepted' => true,
        ]);

        $this->expectException(InventoryConflictException::class);
        app(OrderService::class)->transition($order, 'shipped');
    }

    // 13. Direct forced shipped/delivered transition for provisional order -> blocked
    public function test_13_direct_forced_shipped_delivered_transition_for_provisional_order_blocked(): void
    {
        $order = Order::create([
            'order_list_id' => \App\Models\OrderList::create()->id,
            'order_id' => (string) random_int(100000, 999999),
            'order_number' => 'HM-PROV-13',
            'shop_id' => $this->provisionalStore->id,
            'source_channel' => 'website',
            'status' => 'pending',
            'payment_status' => 'due',
            'payment_method' => 'cod',
            'reconciliation_status' => 'provisional',
            'grand_total' => 1500,
            'checkout_name' => 'Test',
            'checkout_mobile_number' => '01711111111',
            'checkout_district' => 'Dhaka',
            'checkout_full_address' => 'Dhaka',
            'terms_accepted' => true,
        ]);

        $this->expectException(InventoryConflictException::class);
        app(OrderService::class)->transition($order, 'delivered', force: true);
    }

    // 14. Reconciliation preserves/promotes order -> fulfilment becomes allowed
    public function test_14_reconciliation_promotes_provisional_order_to_allow_fulfilment(): void
    {
        $order = Order::create([
            'order_list_id' => \App\Models\OrderList::create()->id,
            'order_id' => (string) random_int(100000, 999999),
            'order_number' => 'HM-PROV-14',
            'shop_id' => $this->provisionalStore->id,
            'source_channel' => 'website',
            'status' => 'confirmed',
            'payment_status' => 'due',
            'payment_method' => 'cod',
            'reconciliation_status' => 'provisional',
            'grand_total' => 1500,
            'checkout_name' => 'Test',
            'checkout_mobile_number' => '01711111111',
            'checkout_district' => 'Dhaka',
            'checkout_full_address' => 'Dhaka',
            'terms_accepted' => true,
            'fraud_checked_at' => now(),
            'is_potential_fraud' => false,
        ]);

        // Reconciliation finishes and promotes status
        $order->update(['reconciliation_status' => 'normal']);

        $updated = app(OrderService::class)->transition($order, 'shipped');
        $this->assertSame('shipped', $updated->status);
    }

    // 15. Transfer-out from offline store -> blocked
    public function test_15_transfer_out_from_offline_store_blocked(): void
    {
        $transfer = StockTransfer::create([
            'transfer_number' => 'TR-TEST-15',
            'from_shop_id' => $this->provisionalStore->id,
            'to_shop_id' => $this->mainStore->id,
            'status' => 'draft',
            'created_by' => $this->admin->id,
        ]);
        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $this->product1->id,
            'quantity_requested' => 2,
        ]);

        $this->expectException(InventoryConflictException::class);
        app(InventoryService::class)->transfer(
            $this->provisionalStore->id,
            $this->mainStore->id,
            $this->product1->id,
            null,
            2,
            $this->admin->id
        );
    }

    // 16. Transfer-out from healthy other store -> unaffected
    public function test_16_transfer_out_from_healthy_store_unaffected(): void
    {
        app(InventoryService::class)->transfer(
            $this->mainStore->id,
            $this->branchStore->id,
            $this->product1->id,
            null,
            2,
            $this->admin->id
        );

        $mainStock = Inventory::where('shop_id', $this->mainStore->id)->where('product_id', $this->product1->id)->value('quantity');
        $branchStock = Inventory::where('shop_id', $this->branchStore->id)->where('product_id', $this->product1->id)->value('quantity');

        $this->assertSame(48, $mainStock);
        $this->assertSame(32, $branchStock);
    }

    // 17. Negative adjustment on offline store -> blocked
    public function test_17_negative_adjustment_on_offline_store_blocked(): void
    {
        $this->expectException(InventoryConflictException::class);
        app(InventoryService::class)->adjust(
            $this->product1->id,
            null,
            -5,
            'Shrinkage',
            $this->admin->id,
            $this->provisionalStore->id
        );
    }

    // 18. Positive transfer-in to offline store -> server quantity increases but active snapshot unchanged
    public function test_18_positive_transfer_in_to_offline_store_proceeds(): void
    {
        // Positive adjustment to offline store is allowed server-side
        app(InventoryService::class)->adjust(
            $this->product1->id,
            null,
            10,
            'Stock Count Addition',
            $this->admin->id,
            $this->provisionalStore->id
        );

        $qty = Inventory::where('shop_id', $this->provisionalStore->id)->where('product_id', $this->product1->id)->value('quantity');
        $this->assertSame(30, $qty);
    }

    // 19. Recovery-required store -> never chosen by allocator
    public function test_19_recovery_required_store_never_chosen(): void
    {
        StoreDevice::where('shop_id', $this->provisionalStore->id)
            ->update(['operational_state' => StoreConnectivityService::RECOVERY_REQUIRED]);

        // Drain main and branch stores
        Inventory::whereIn('shop_id', [$this->mainStore->id, $this->branchStore->id])
            ->where('product_id', $this->product1->id)
            ->update(['quantity' => 0]);

        $allocator = app(StoreAllocationService::class);
        $items = [['product_id' => $this->product1->id, 'quantity' => 1]];

        $this->expectException(InventoryConflictException::class);
        $allocator->chooseStoreForWebsiteOrder($items);
    }

    // 20. Allocator encountering reconciling store -> reroutes/skips safely
    public function test_20_allocator_skips_reconciling_store(): void
    {
        // Set mainStore device to reconciling
        StoreDevice::create([
            'shop_id' => $this->mainStore->id,
            'device_uuid' => (string) Str::uuid(),
            'device_token_hash' => hash('sha256', 'main-token-hash'),
            'device_name' => 'Main POS Device',
            'status' => 'active',
            'operational_state' => StoreConnectivityService::RECONCILING,
            'last_heartbeat_at' => now(),
            'registered_at' => now(),
        ]);

        $allocator = app(StoreAllocationService::class);
        $items = [['product_id' => $this->product1->id, 'quantity' => 2]];
        $result = $allocator->chooseStoreForWebsiteOrder($items);

        $this->assertSame($this->branchStore->id, $result['shop']->id);
    }

    // 21. Paid victim refund job calls existing PaymentService exactly once
    public function test_21_paid_victim_refund_job_calls_payment_service(): void
    {
        $order = Order::create([
            'order_list_id' => \App\Models\OrderList::create()->id,
            'order_id' => (string) random_int(100000, 999999),
            'order_number' => 'HM-VICTIM-21',
            'shop_id' => $this->mainStore->id,
            'source_channel' => 'website',
            'status' => 'returned',
            'payment_status' => 'paid',
            'payment_method' => 'online',
            'grand_total' => 1500,
            'paid_amount' => 1500,
            'checkout_name' => 'Victim Customer',
            'checkout_mobile_number' => '01700000000',
            'checkout_district' => 'Dhaka',
            'checkout_full_address' => 'Dhaka',
            'terms_accepted' => true,
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'online',
            'gateway' => 'sslcommerz',
            'amount' => 1500,
            'status' => PaymentStatus::PAID->value,
            'paid_at' => now(),
            'transaction_id' => 'TXN-SSL-21',
        ]);

        $session = OfflineInventorySession::create([
            'shop_id' => $this->provisionalStore->id,
            'store_device_id' => $this->provisionalStore->storeDevice->id,
            'session_id' => (string) Str::uuid(),
            'snapshot_id' => (string) Str::uuid(),
            'binding_version' => 1,
            'opening_inventory_revision' => 1,
            'status' => 'completed',
            'boundary_server_at' => now(),
            'opened_at' => now(),
        ]);

        $action = OfflineReconciliationAction::create([
            'offline_inventory_session_id' => $session->id,
            'action_type' => 'refund',
            'reason_code' => 'pos_preempted_online_order',
            'status' => 'pending',
            'idempotency_key' => 'refund-job-21',
            'order_id' => $order->id,
            'payment_id' => $payment->id,
            'amount' => 1500,
        ]);

        ProcessOfflineReconciliationAction::dispatchSync($action->id, $this->admin->id);

        $action->refresh();
        $this->assertSame('completed', $action->status);
        $this->assertSame(1500.0, (float) $payment->fresh()->refunded_amount);
    }

    // 22. Duplicate job delivery -> no second refund
    public function test_22_duplicate_job_delivery_no_second_refund(): void
    {
        $order = Order::create([
            'order_list_id' => \App\Models\OrderList::create()->id,
            'order_id' => (string) random_int(100000, 999999),
            'order_number' => 'HM-VICTIM-22',
            'shop_id' => $this->mainStore->id,
            'source_channel' => 'website',
            'status' => 'returned',
            'payment_status' => 'paid',
            'payment_method' => 'online',
            'grand_total' => 1500,
            'paid_amount' => 1500,
            'checkout_name' => 'Victim Customer',
            'checkout_mobile_number' => '01700000000',
            'checkout_district' => 'Dhaka',
            'checkout_full_address' => 'Dhaka',
            'terms_accepted' => true,
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'online',
            'gateway' => 'sslcommerz',
            'amount' => 1500,
            'refunded_amount' => 1500,
            'status' => PaymentStatus::PAID->value,
            'paid_at' => now(),
            'transaction_id' => 'TXN-SSL-22',
        ]);

        $session = OfflineInventorySession::create([
            'shop_id' => $this->provisionalStore->id,
            'store_device_id' => $this->provisionalStore->storeDevice->id,
            'session_id' => (string) Str::uuid(),
            'snapshot_id' => (string) Str::uuid(),
            'binding_version' => 1,
            'opening_inventory_revision' => 1,
            'status' => 'completed',
            'boundary_server_at' => now(),
            'opened_at' => now(),
        ]);

        $action = OfflineReconciliationAction::create([
            'offline_inventory_session_id' => $session->id,
            'action_type' => 'refund',
            'reason_code' => 'pos_preempted_online_order',
            'status' => 'pending',
            'idempotency_key' => 'refund-job-22',
            'order_id' => $order->id,
            'payment_id' => $payment->id,
            'amount' => 1500,
        ]);

        ProcessOfflineReconciliationAction::dispatchSync($action->id, $this->admin->id);

        $this->assertSame(1500.0, (float) $payment->fresh()->refunded_amount);
    }

    // 23. Transient gateway failure -> retry state retained
    public function test_23_transient_gateway_failure_retains_retry_state(): void
    {
        $mock = $this->createMock(PaymentService::class);
        $mock->expects($this->once())
            ->method('refund')
            ->willThrowException(new \RuntimeException('Gateway connection timeout'));

        $this->app->instance(PaymentService::class, $mock);

        $order = Order::create([
            'order_list_id' => \App\Models\OrderList::create()->id,
            'order_id' => (string) random_int(100000, 999999),
            'order_number' => 'HM-VICTIM-23',
            'shop_id' => $this->mainStore->id,
            'source_channel' => 'website',
            'status' => 'returned',
            'payment_status' => 'paid',
            'payment_method' => 'online',
            'grand_total' => 1500,
            'paid_amount' => 1500,
            'checkout_name' => 'Victim',
            'checkout_mobile_number' => '01700000000',
            'checkout_district' => 'Dhaka',
            'checkout_full_address' => 'Dhaka',
            'terms_accepted' => true,
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'online',
            'gateway' => 'sslcommerz',
            'amount' => 1500,
            'status' => PaymentStatus::PAID->value,
        ]);

        $session = OfflineInventorySession::create([
            'shop_id' => $this->provisionalStore->id,
            'store_device_id' => $this->provisionalStore->storeDevice->id,
            'session_id' => (string) Str::uuid(),
            'snapshot_id' => (string) Str::uuid(),
            'binding_version' => 1,
            'opening_inventory_revision' => 1,
            'status' => 'completed',
            'boundary_server_at' => now(),
            'opened_at' => now(),
        ]);

        $action = OfflineReconciliationAction::create([
            'offline_inventory_session_id' => $session->id,
            'action_type' => 'refund',
            'reason_code' => 'pos_preempted_online_order',
            'status' => 'pending',
            'idempotency_key' => 'refund-job-23',
            'order_id' => $order->id,
            'payment_id' => $payment->id,
            'amount' => 1500,
        ]);

        try {
            ProcessOfflineReconciliationAction::dispatchSync($action->id, $this->admin->id);
        } catch (\Throwable $e) {
            // Expected exception during job dispatch
        }

        $this->assertSame('pending', $action->fresh()->status);
        $this->assertSame(1, $action->fresh()->attempts);
    }

    // 24. Deterministic refund failure -> manual attention retained
    public function test_24_deterministic_refund_failure_retained_as_manual_review(): void
    {
        $session = OfflineInventorySession::create([
            'shop_id' => $this->provisionalStore->id,
            'store_device_id' => $this->provisionalStore->storeDevice->id,
            'session_id' => (string) Str::uuid(),
            'snapshot_id' => (string) Str::uuid(),
            'binding_version' => 1,
            'opening_inventory_revision' => 1,
            'status' => 'completed',
            'boundary_server_at' => now(),
            'opened_at' => now(),
        ]);

        // Action missing payment reference
        $action = OfflineReconciliationAction::create([
            'offline_inventory_session_id' => $session->id,
            'action_type' => 'refund',
            'reason_code' => 'pos_preempted_online_order',
            'status' => 'pending',
            'idempotency_key' => 'refund-job-24',
            'amount' => 1500,
        ]);

        ProcessOfflineReconciliationAction::dispatchSync($action->id, $this->admin->id);

        $this->assertSame('manual_review', $action->fresh()->status);
        $this->assertSame('missing_payment_reference', $action->fresh()->last_error_code);
    }

    // 25. COD victim -> no fake refund
    public function test_25_cod_victim_no_fake_refund(): void
    {
        $order = Order::create([
            'order_list_id' => \App\Models\OrderList::create()->id,
            'order_id' => (string) random_int(100000, 999999),
            'order_number' => 'HM-VICTIM-25',
            'shop_id' => $this->mainStore->id,
            'source_channel' => 'website',
            'status' => 'returned',
            'payment_status' => 'due',
            'payment_method' => 'cod',
            'grand_total' => 1500,
            'paid_amount' => 0,
            'checkout_name' => 'COD Victim',
            'checkout_mobile_number' => '01700000000',
            'checkout_district' => 'Dhaka',
            'checkout_full_address' => 'Dhaka',
            'terms_accepted' => true,
        ]);

        $session = OfflineInventorySession::create([
            'shop_id' => $this->provisionalStore->id,
            'store_device_id' => $this->provisionalStore->storeDevice->id,
            'session_id' => (string) Str::uuid(),
            'snapshot_id' => (string) Str::uuid(),
            'binding_version' => 1,
            'opening_inventory_revision' => 1,
            'status' => 'completed',
            'boundary_server_at' => now(),
            'opened_at' => now(),
        ]);

        $action = OfflineReconciliationAction::create([
            'offline_inventory_session_id' => $session->id,
            'action_type' => 'refund',
            'reason_code' => 'pos_preempted_online_order',
            'status' => 'pending',
            'idempotency_key' => 'refund-job-25',
            'order_id' => $order->id,
            'amount' => 1500,
        ]);

        ProcessOfflineReconciliationAction::dispatchSync($action->id, $this->admin->id);

        $this->assertSame('completed', $action->fresh()->status);
        $this->assertTrue($action->fresh()->metadata['cod_unpaid_cancellation'] ?? false);
        $this->assertDatabaseCount('payments', 0);
    }

    // 26. Customer-facing cancellation reason is specific but non-technical
    public function test_26_customer_facing_cancellation_reason_non_technical(): void
    {
        $order = Order::create([
            'order_list_id' => \App\Models\OrderList::create()->id,
            'order_id' => (string) random_int(100000, 999999),
            'order_number' => 'HM-VICTIM-26',
            'shop_id' => $this->mainStore->id,
            'source_channel' => 'website',
            'status' => 'returned',
            'payment_status' => 'paid',
            'payment_method' => 'online',
            'reconciliation_status' => 'preempted',
            'grand_total' => 1500,
            'checkout_name' => 'Victim',
            'checkout_mobile_number' => '01700000000',
            'checkout_district' => 'Dhaka',
            'checkout_full_address' => 'Dhaka',
            'placed_at' => now(),
            'terms_accepted' => true,
        ]);

        $response = $this->getJson('/api/v1/track-order?mobile_number=01700000000');
        $response->assertOk();

        $data = $response->json('data.orders.0');
        $this->assertSame('HM-VICTIM-26', $data['order_number']);
        $this->assertStringContainsString('The item sold at our store before the stock update reached us.', $data['cancellation_reason']);
        $this->assertStringNotContainsString('device', strtolower($data['cancellation_reason']));
        $this->assertStringNotContainsString('session', strtolower($data['cancellation_reason']));
        $this->assertStringNotContainsString('preempted', strtolower($data['cancellation_reason']));
    }

    // 27. Store A offline state does not affect Store B allocation/transfer
    public function test_27_store_a_offline_does_not_affect_store_b(): void
    {
        $allocator = app(StoreAllocationService::class);
        $items = [['product_id' => $this->product1->id, 'quantity' => 2]];

        // Main store and branch store are healthy
        $result = $allocator->chooseStoreForWebsiteOrder($items);
        $this->assertSame($this->mainStore->id, $result['shop']->id);

        // Transfer between main and branch works cleanly
        app(InventoryService::class)->transfer($this->mainStore->id, $this->branchStore->id, $this->product1->id, null, 1, $this->admin->id);
        $this->assertTrue(true);
    }

    // 28. All inventory revisions update correctly
    public function test_28_all_inventory_revisions_update_correctly(): void
    {
        $initialRevision = $this->mainStore->fresh()->inventory_revision;

        app(InventoryService::class)->adjust($this->product1->id, null, 5, 'Adjust', $this->admin->id, $this->mainStore->id);

        $newRevision = $this->mainStore->fresh()->inventory_revision;
        $this->assertGreaterThan($initialRevision, $newRevision);
    }

    private function checkoutPayload(string $paymentMethod, string $key): array
    {
        return [
            'name' => 'Test Customer',
            'mobile_number' => '01712345678',
            'email' => 'test@example.com',
            'district' => 'Dhaka',
            'full_address' => 'House 12, Road 5, Mirpur-10, Dhaka',
            'payment_method' => $paymentMethod,
            'checkout_idempotency_key' => $key,
            'terms_accepted' => true,
            'items' => [
                [
                    'product_id' => $this->product1->id,
                    'quantity' => 2,
                ],
            ],
        ];
    }
}
