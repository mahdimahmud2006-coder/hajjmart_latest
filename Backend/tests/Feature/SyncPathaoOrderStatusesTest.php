<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Shop;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SyncPathaoOrderStatusesTest extends TestCase
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
        $this->product = Product::factory()->create(['retail_price' => 500, 'cost_price' => 200]);

        Inventory::create([
            'product_id' => $this->product->id,
            'variant_id' => null,
            'shop_id' => $this->shop->id,
            'quantity' => 50,
            'reserved' => 0,
            'low_stock_threshold' => 5,
        ]);
    }

    public function test_pathao_sync_command_updates_delivered_orders_and_clears_dues(): void
    {
        $orderService = app(OrderService::class);
        $order = $orderService->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shop->id,
            'created_by' => $this->user->id,
            'customer_name' => 'Test Customer',
            'mobile_number' => '01700000000',
            'items' => [['product_id' => $this->product->id, 'quantity' => 2]],
        ]);

        $orderService->transition($order, OrderStatus::SHIPPED->value, $this->user->id);
        $order->update([
            'pathao_consignment_id' => 'PTH-1001',
            'delivery_status' => 'shipped_pathao',
        ]);

        $expectedGrandTotal = (float) $order->grand_total;
        $this->assertGreaterThan(0, $expectedGrandTotal);
        $this->assertEquals($expectedGrandTotal, (float) $order->due_amount);
        $this->assertEquals(0.00, (float) $order->paid_amount);

        Http::fake([
            '*/aladdin/api/v1/issue-token' => Http::response([
                'access_token' => 'mock_token',
                'token_type' => 'Bearer',
                'expires_in' => 3600,
            ], 200),
            '*/aladdin/api/v1/orders/PTH-1001/info' => Http::response([
                'code' => 200,
                'type' => 'success',
                'message' => 'Order info',
                'data' => [
                    'consignment_id' => 'PTH-1001',
                    'merchant_order_id' => (string) $order->order_number,
                    'order_status' => 'Delivered',
                    'order_status_slug' => 'Delivered',
                ],
            ], 200),
        ]);

        $this->artisan('pathao:sync-statuses', ['--delay' => 0])
            ->assertExitCode(0);

        $order->refresh();
        $this->assertSame(OrderStatus::DELIVERED->value, $order->status);
        $this->assertSame(PaymentStatus::PAID->value, $order->payment_status);
        $this->assertEquals($expectedGrandTotal, (float) $order->paid_amount);
        $this->assertEquals(0.00, (float) $order->due_amount);

        $payment = Payment::where('order_id', $order->id)->first();
        $this->assertNotNull($payment);
        $this->assertSame('cod', $payment->payment_method);
        $this->assertEquals($expectedGrandTotal, (float) $payment->amount);
        $this->assertSame('paid', $payment->status);

    }

    public function test_pathao_sync_command_updates_returned_orders(): void
    {
        $orderService = app(OrderService::class);
        $order = $orderService->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $this->shop->id,
            'created_by' => $this->user->id,
            'customer_name' => 'Return Customer',
            'mobile_number' => '01700000001',
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ]);

        $orderService->transition($order, OrderStatus::SHIPPED->value, $this->user->id);
        $order->update([
            'pathao_consignment_id' => 'PTH-1002',
            'delivery_status' => 'shipped_pathao',
        ]);

        Http::fake([
            '*/aladdin/api/v1/issue-token' => Http::response([
                'access_token' => 'mock_token',
            ], 200),
            '*/aladdin/api/v1/orders/PTH-1002/info' => Http::response([
                'code' => 200,
                'data' => [
                    'consignment_id' => 'PTH-1002',
                    'order_status' => 'Returned',
                    'order_status_slug' => 'Returned',
                ],
            ], 200),
        ]);

        $this->artisan('pathao:sync-statuses', ['--delay' => 0])
            ->assertExitCode(0);

        $order->refresh();
        $this->assertSame(OrderStatus::RETURNED->value, $order->status);
    }
}
