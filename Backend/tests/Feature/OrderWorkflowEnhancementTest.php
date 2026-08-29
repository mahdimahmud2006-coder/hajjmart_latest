<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shop;
use App\Models\User;
use App\Services\OrderService;
use App\Services\PathaoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use RuntimeException;
use Tests\TestCase;

class OrderWorkflowEnhancementTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Shop $shop;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->shop = Shop::defaultStore();
        $this->product = Product::factory()->create(['retail_price' => 100, 'wholesale_price' => 80, 'cost_price' => 50]);
        Inventory::create([
            'product_id' => $this->product->id,
            'variant_id' => null,
            'shop_id' => $this->shop->id,
            'quantity' => 20,
            'reserved' => 0,
            'low_stock_threshold' => 5,
        ]);
    }

    public function test_pos_order_defaults_to_delivered_and_paid(): void
    {
        $orderService = app(OrderService::class);
        $order = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $this->shop->id,
            'created_by' => $this->user->id,
            'items' => [['product_id' => $this->product->id, 'quantity' => 2]],
        ]);

        $this->assertSame(OrderStatus::DELIVERED->value, $order->status);
        $this->assertSame(PaymentStatus::PAID->value, $order->payment_status);
        $this->assertEquals((float) $order->grand_total, (float) $order->paid_amount);
        $this->assertEquals(0.00, (float) $order->due_amount);
    }

    public function test_scm_order_defaults_to_confirmed_and_shipped_records_packed_by(): void
    {
        $orderService = app(OrderService::class);
        $order = $orderService->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shop->id,
            'created_by' => $this->user->id,
            'customer_name' => 'John Doe',
            'mobile_number' => '01711000000',
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ]);

        $this->assertSame(OrderStatus::CONFIRMED->value, $order->status);
        $this->assertNull($order->packed_by);

        $shipped = $orderService->transition($order, OrderStatus::SHIPPED->value, $this->user->id);
        $this->assertSame(OrderStatus::SHIPPED->value, $shipped->status);
        $this->assertSame($this->user->id, $shipped->packed_by);
        $this->assertNotNull($shipped->shipped_at);
    }

    public function test_non_cod_order_defaults_to_confirmed_but_waits_for_fraud_check_before_shipping(): void
    {
        Queue::fake();
        $order = app(OrderService::class)->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shop->id,
            'created_by' => $this->user->id,
            'customer_name' => 'Online Customer',
            'mobile_number' => '01711000002',
            'payment_method' => 'online',
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ]);

        $this->assertSame(OrderStatus::CONFIRMED->value, $order->status);
        $this->expectException(RuntimeException::class);
        app(OrderService::class)->transition($order, OrderStatus::SHIPPED->value, $this->user->id);
    }

    public function test_pathao_rejects_order_until_it_is_manually_shipped(): void
    {
        Queue::fake();
        $order = app(OrderService::class)->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shop->id,
            'created_by' => $this->user->id,
            'customer_name' => 'Packed Later',
            'mobile_number' => '01711000003',
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ]);

        $this->expectException(RuntimeException::class);
        app(PathaoService::class)->sendOrderToPathao($order);
    }

    public function test_shipped_order_refused_delivery_restocks_inventory_and_clears_due(): void
    {
        $orderService = app(OrderService::class);
        $order = $orderService->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shop->id,
            'created_by' => $this->user->id,
            'customer_name' => 'Jane Doe',
            'mobile_number' => '01711000001',
            'items' => [['product_id' => $this->product->id, 'quantity' => 5]],
        ]);

        $orderService->transition($order, OrderStatus::SHIPPED->value, $this->user->id);

        $inventoryAfterShipped = Inventory::where('product_id', $this->product->id)->where('shop_id', $this->shop->id)->first();
        $this->assertSame(15, $inventoryAfterShipped->quantity);

        // Transition from SHIPPED directly to RETURNED (Refused delivery)
        $returned = $orderService->transition($order, OrderStatus::RETURNED->value, $this->user->id, 'Customer refused delivery.');

        $this->assertSame(OrderStatus::RETURNED->value, $returned->status);
        $this->assertEquals(0.00, (float) $returned->due_amount);

        // Inventory must be restocked (15 + 5 = 20)
        $inventoryAfterReturn = Inventory::where('product_id', $this->product->id)->where('shop_id', $this->shop->id)->first();
        $this->assertSame(20, $inventoryAfterReturn->quantity);
    }
}
