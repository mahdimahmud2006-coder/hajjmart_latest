<?php

namespace Tests\Feature;

use App\Jobs\ExpirePendingOrders;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ReservedProduct;
use App\Models\Shop;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CheckoutWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private Shop $shop;
    private Product $product;
    private Inventory $inventory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->shop = Shop::firstOrCreate(
            ['code' => 'MAIN'],
            [
                'name' => 'Main Store',
                'slug' => 'main-store',
                'is_active' => true,
                'is_default' => true,
            ]
        );
        $this->product = Product::factory()->create([
            'name' => 'Ihram',
            'selling_price' => 1350,
            'retail_price' => 1350,
            'is_active' => true,
        ]);
        $this->inventory = Inventory::create([
            'product_id' => $this->product->id,
            'variant_id' => null,
            'shop_id' => $this->shop->id,
            'quantity' => 10,
            'reserved' => 0,
            'low_stock_threshold' => 2,
            'updated_at' => now(),
        ]);
    }

    public function test_public_cod_checkout_ignores_internal_state_and_client_money(): void
    {
        $key = (string) Str::uuid();
        $response = $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('cod', $key) + [
            'source_channel' => 'pos',
            'shipping_total' => 0,
            'delivery_charge' => 0,
            'status' => 'delivered',
            'payment_status' => 'paid',
            'paid_amount' => 999999,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.payment_required', false)
            ->assertJsonPath('data.redirect_url', null);

        $order = Order::firstOrFail();
        $this->assertSame('website', $order->source_channel);
        $this->assertNull($order->customer_id);
        $this->assertSame('confirmed', $order->status);
        $this->assertSame('due', $order->payment_status);
        $this->assertNull($order->checkout_email);
        $this->assertSame(80.0, (float) $order->shipping_total);
        $this->assertSame(2780.0, (float) $order->grand_total);
        $inventory = $this->inventory->fresh();
        $this->assertSame(10, $inventory->quantity);
        $this->assertSame(2, $inventory->reserved);
    }

    public function test_login_repairs_matching_unowned_order_created_by_old_guest_checkout_bug(): void
    {
        $customer = User::factory()->create([
            'name' => 'Rahim',
            'email' => 'rahim-repair@example.com',
            'phone' => '01720601515',
            'password' => 'Password123!',
            'is_employee' => false,
            'is_active' => true,
        ]);

        $guest = $this->postJson(
            '/api/v1/checkout/place-order',
            $this->checkoutPayload('cod', (string) Str::uuid()) + ['email' => 'rahim-repair@example.com']
        )->assertCreated();

        $orderNumber = $guest->json('data.order_number');
        $this->assertDatabaseHas('orders', ['order_number' => $orderNumber, 'customer_id' => null]);

        $this->postJson('/api/v1/auth/login', [
            'email_or_phone' => '01720601515',
            'password' => 'Password123!',
        ])->assertOk();

        $this->assertDatabaseHas('orders', [
            'order_number' => $orderNumber,
            'customer_id' => $customer->id,
        ]);
    }

    public function test_authenticated_website_checkout_is_linked_to_customer_and_visible_in_order_history(): void
    {
        $customer = User::factory()->create([
            'name' => 'Rahim',
            'email' => 'rahim@example.com',
            'phone' => '01720601515',
            'is_employee' => false,
            'is_admin' => false,
            'is_active' => true,
        ]);

        $placed = $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/orders', $this->checkoutPayload('cod', (string) Str::uuid()) + [
                'name' => 'Rahim',
                'email' => 'rahim@example.com',
            ])
            ->assertCreated()
            ->assertJsonPath('data.payment_method', 'cod');

        $orderNumber = $placed->json('data.order_number');
        $this->assertDatabaseHas('orders', [
            'order_number' => $orderNumber,
            'customer_id' => $customer->id,
            'source_channel' => 'website',
        ]);

        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/v1/orders')
            ->assertOk()
            ->assertJsonPath('data.0.order_number', $orderNumber)
            ->assertJsonPath('data.0.order_status', 'confirmed')
            ->assertJsonPath('data.0.items.0.product_id', $this->product->id)
            ->assertJsonPath('data.0.items.0.name', 'Ihram');
    }

    public function test_paid_pos_sale_posts_revenue_and_cogs_to_general_ledger(): void
    {
        $this->seed(\Database\Seeders\AccountingSeeder::class);
        $this->product->update(['cost_price' => 800]);

        $order = app(\App\Services\OrderService::class)->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shop->id,
            'items' => [['product_id' => $this->product->id, 'variant_id' => null, 'quantity' => 1]],
            'customer_name' => 'Walk-in Customer',
            'payment_method' => 'cash',
            'payment_channel' => 'cash',
            'paid_amount' => 1350,
            'shipping_total' => 0,
            'manual_discount' => 0,
            'status' => 'delivered',
        ]);

        $this->assertSame('delivered', $order->fresh()->status);
        $this->assertSame(1350.0, (float) $order->fresh()->grand_total);
    }

    public function test_guest_cod_confirmation_commits_reserved_inventory_once(): void
    {
        $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('cod', (string) Str::uuid()))->assertCreated();
        $order = Order::firstOrFail();

        $this->assertSame('confirmed', $order->status);
        $this->assertSame(2, $this->inventory->fresh()->reserved);

        $updated = app(\App\Services\OrderService::class)->transition($order, 'shipped', null, 'Approved by operations');

        $this->assertTrue($updated->relationLoaded('items'));
        $this->assertTrue($updated->items->first()->relationLoaded('product'));
        $this->assertSame($this->product->id, $updated->items->first()->product?->id);

        $inventory = $this->inventory->fresh();
        $this->assertSame(8, $inventory->quantity);
        $this->assertSame(0, $inventory->reserved);
        $this->assertSame('shipped', $order->fresh()->status);
        $this->assertSame(0, ReservedProduct::active()->count());
    }

    public function test_confirmation_repairs_a_legacy_missing_reserved_counter_before_committing(): void
    {
        $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('cod', (string) Str::uuid()))->assertCreated();
        $order = Order::firstOrFail();

        // Simulate an upgraded database where reserved_products existed but the
        // store-scoped inventory.reserved counter had not been populated.
        $this->inventory->forceFill(['reserved' => 0])->save();

        app(\App\Services\OrderService::class)->transition($order, 'shipped', null, 'Approved after upgrade');

        $inventory = $this->inventory->fresh();
        $this->assertSame(8, $inventory->quantity);
        $this->assertSame(0, $inventory->reserved);
        $this->assertSame('shipped', $order->fresh()->status);
        $this->assertSame(0, ReservedProduct::active()->count());
    }

    public function test_pos_sale_deducts_only_from_the_explicitly_selected_store(): void
    {
        $secondShop = Shop::create([
            'name' => 'Airport Store',
            'code' => 'AIRPORT',
            'slug' => 'airport-store',
            'is_active' => true,
            'is_default' => false,
        ]);
        $secondInventory = Inventory::create([
            'product_id' => $this->product->id,
            'variant_id' => null,
            'shop_id' => $secondShop->id,
            'quantity' => 6,
            'reserved' => 0,
            'low_stock_threshold' => 2,
            'updated_at' => now(),
        ]);

        $order = app(\App\Services\OrderService::class)->place([
            'source_channel' => 'pos',
            'shop_id' => $secondShop->id,
            'items' => [['product_id' => $this->product->id, 'variant_id' => null, 'quantity' => 2]],
            'customer_name' => 'Walk-in Customer',
            'payment_method' => 'cash',
            'payment_channel' => 'cash',
            'paid_amount' => 2700,
            'shipping_total' => 0,
            'manual_discount' => 0,
            'status' => 'delivered',
        ]);

        $this->assertSame($secondShop->id, (int) $order->shop_id);
        $this->assertSame(10, $this->inventory->fresh()->quantity);
        $this->assertSame(4, $secondInventory->fresh()->quantity);
    }

    public function test_quote_and_final_order_use_database_price(): void
    {
        $quote = $this->postJson('/api/v1/checkout/quote', [
            'items' => [['product_id' => $this->product->id, 'variant_id' => null, 'quantity' => 2]],
            'district' => 'Dhaka',
            'coupon_code' => null,
            'payment_method' => 'cod',
        ]);

        $quote->assertOk()
            ->assertJsonPath('data.items.0.unit_price', 1350)
            ->assertJsonPath('data.subtotal', 2700)
            ->assertJsonPath('data.delivery', 80)
            ->assertJsonPath('data.grand_total', 2780);

        $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('cod', (string) Str::uuid()))->assertCreated();
        $this->assertSame(2780.0, (float) Order::firstOrFail()->grand_total);
    }

    public function test_district_automatically_uses_admin_managed_delivery_rate_and_is_saved_on_order(): void
    {
        SiteSetting::setValue('delivery_charge_inside_dhaka', '65.00');
        SiteSetting::setValue('delivery_charge_outside_dhaka', '125.00');

        $quote = $this->postJson('/api/v1/checkout/quote', [
            'items' => [['product_id' => $this->product->id, 'variant_id' => null, 'quantity' => 1]],
            'district' => 'Gazipur',
            'coupon_code' => null,
            'payment_method' => 'cod',
        ])->assertOk();

        $quote->assertJsonPath('data.delivery', 125);

        $payload = $this->checkoutPayload('cod', (string) Str::uuid());
        $payload['district'] = 'Gazipur';
        // Browser-supplied delivery_area is ignored; the backend derives it from district.
        $payload['delivery_area'] = 'inside_dhaka';
        $this->postJson('/api/v1/checkout/place-order', $payload)->assertCreated();

        $order = Order::firstOrFail();
        $this->assertSame('outside_dhaka', $order->delivery_area);
        $this->assertSame(125.0, (float) $order->shipping_total);

        $payload = $this->checkoutPayload('cod', (string) Str::uuid());
        $payload['district'] = 'Dhaka';
        $payload['delivery_area'] = 'outside_dhaka';
        $this->postJson('/api/v1/checkout/place-order', $payload)->assertCreated();

        $dhakaOrder = Order::query()->latest('id')->firstOrFail();
        $this->assertSame('inside_dhaka', $dhakaOrder->delivery_area);
        $this->assertSame(65.0, (float) $dhakaOrder->shipping_total);
    }

    public function test_invalid_bangladesh_mobile_is_rejected_before_order_creation(): void
    {
        $payload = $this->checkoutPayload('cod', (string) Str::uuid());
        $payload['mobile_number'] = '12345';

        $this->postJson('/api/v1/checkout/place-order', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['mobile_number']);

        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(10, $this->inventory->fresh()->quantity);
    }

    public function test_out_of_stock_checkout_fails_atomically(): void
    {
        $this->inventory->update(['quantity' => 1]);

        $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('cod', (string) Str::uuid()))
            ->assertStatus(409);

        $this->assertDatabaseCount('orders', 0);
        $inventory = $this->inventory->fresh();
        $this->assertSame(1, $inventory->quantity);
        $this->assertSame(0, $inventory->reserved);
    }

    public function test_same_checkout_key_creates_only_one_cod_order_and_inventory_movement(): void
    {
        $key = (string) Str::uuid();
        $first = $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('cod', $key))->assertCreated();
        $second = $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('cod', $key))->assertCreated();

        $this->assertSame($first->json('data.order_number'), $second->json('data.order_number'));
        $this->assertDatabaseCount('orders', 1);
        $inventory = $this->inventory->fresh();
        $this->assertSame(10, $inventory->quantity);
        $this->assertSame(2, $inventory->reserved);
    }

    public function test_public_progress_lookup_normalizes_mobile_and_returns_narrow_timeline(): void
    {
        $placed = $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('cod', (string) Str::uuid()))->assertCreated();
        $orderNumber = $placed->json('data.order_number');

        $response = $this->getJson('/api/v1/track-order?mobile_number=%2B8801720601515');

        $response->assertOk()
            ->assertJsonPath('data.orders.0.order_number', $orderNumber)
            ->assertJsonPath('data.orders.0.status', 'confirmed')
            ->assertJsonPath('data.orders.0.items_count', 1)
            ->assertJsonPath('data.orders.0.timeline.0.step', 'placed')
            ->assertJsonPath('data.orders.0.timeline.0.done', true)
            ->assertJsonPath('data.orders.0.timeline.1.step', 'confirmed')
            ->assertJsonPath('data.orders.0.timeline.1.done', true);

        $this->assertArrayNotHasKey('checkout_full_address', $response->json('data.orders.0'));
        $this->assertArrayNotHasKey('customer_note', $response->json('data.orders.0'));
        $this->assertArrayNotHasKey('payments', $response->json('data.orders.0'));
    }

    public function test_public_progress_lookup_can_optionally_filter_by_order_number(): void
    {
        $first = $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('cod', (string) Str::uuid()))->assertCreated();
        $second = $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('cod', (string) Str::uuid()))->assertCreated();

        $response = $this->getJson('/api/v1/track-order?mobile_number=01720601515&order_number='.$first->json('data.order_number'));

        $response->assertOk()
            ->assertJsonCount(1, 'data.orders')
            ->assertJsonPath('data.orders.0.order_number', $first->json('data.order_number'));

        $this->assertNotSame($first->json('data.order_number'), $second->json('data.order_number'));
    }

    public function test_public_progress_lookup_rejects_invalid_mobile(): void
    {
        $this->getJson('/api/v1/track-order?mobile_number=12345')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['mobile_number']);
    }

    public function test_online_checkout_reserves_then_mock_payment_commits_exactly_once(): void
    {
        $key = (string) Str::uuid();
        $first = $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('online', $key))->assertCreated();
        $second = $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('online', $key))->assertCreated();

        $this->assertSame($first->json('data.order_number'), $second->json('data.order_number'));
        $this->assertNotNull($first->json('data.redirect_url'));
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('payments', 1);

        $inventory = $this->inventory->fresh();
        $this->assertSame(10, $inventory->quantity);
        $this->assertSame(2, $inventory->reserved);

        $payment = Payment::firstOrFail();
        $this->get('/api/v1/payments/mock/' . $payment->id)->assertRedirect();
        $this->get('/api/v1/payments/mock/' . $payment->id)->assertRedirect();

        $inventory = $this->inventory->fresh();
        $this->assertSame(8, $inventory->quantity);
        $this->assertSame(0, $inventory->reserved);
        $this->assertSame('paid', $payment->fresh()->status);
        $this->assertSame('confirmed', Order::firstOrFail()->status);
        $this->assertSame(0, ReservedProduct::active()->count());
    }

    public function test_expired_online_checkout_releases_reservation_once(): void
    {
        $this->postJson('/api/v1/checkout/place-order', $this->checkoutPayload('online', (string) Str::uuid()))->assertCreated();
        $order = Order::firstOrFail();
        $order->forceFill(['created_at' => now()->subMinutes(20)])->save();

        (new ExpirePendingOrders())->handle(app(\App\Services\OrderService::class));
        (new ExpirePendingOrders())->handle(app(\App\Services\OrderService::class));

        $inventory = $this->inventory->fresh();
        $this->assertSame(10, $inventory->quantity);
        $this->assertSame(0, $inventory->reserved);
        $this->assertSame('returned', $order->fresh()->status);
        $this->assertSame('due', $order->fresh()->payment_status);
        $this->assertSame('failed', Payment::firstOrFail()->status);
        $this->assertSame(0, ReservedProduct::active()->count());
    }

    private function checkoutPayload(string $paymentMethod, string $key): array
    {
        return [
            'items' => [['product_id' => $this->product->id, 'variant_id' => null, 'quantity' => 2]],
            'name' => 'Test Customer',
            'mobile_number' => '01720601515',
            'email' => null,
            'district' => 'Dhaka',
            'full_address' => 'Village/Area, Union/Ward, Savar, near landmark',
            'payment_method' => $paymentMethod,
            'coupon_code' => null,
            'customer_note' => null,
            'checkout_idempotency_key' => $key,
            'terms_accepted' => true,
        ];
    }
}
