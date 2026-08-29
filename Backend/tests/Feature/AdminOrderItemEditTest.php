<?php

namespace Tests\Feature;

use App\Exceptions\InventoryConflictException;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\Shop;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class AdminOrderItemEditTest extends TestCase
{
    use RefreshDatabase;

    public function test_editing_reserved_order_items_rebalances_stock_and_rolls_back_on_insufficient_stock(): void
    {
        Queue::fake();
        $admin = User::factory()->create(['is_employee' => true, 'is_admin' => true]);
        $shop = Shop::defaultStore();
        $first = Product::factory()->create(['name' => 'First', 'retail_price' => 100, 'selling_price' => 100]);
        $second = Product::factory()->create(['name' => 'Second', 'retail_price' => 50, 'selling_price' => 50]);

        foreach ([[$first, 5], [$second, 2]] as [$product, $quantity]) {
            Inventory::create([
                'product_id' => $product->id,
                'variant_id' => null,
                'shop_id' => $shop->id,
                'quantity' => $quantity,
                'reserved' => 0,
                'low_stock_threshold' => 1,
            ]);
        }

        $orders = app(OrderService::class);
        $order = $orders->place([
            'source_channel' => 'social_commerce',
            'shop_id' => $shop->id,
            'created_by' => $admin->id,
            'customer_name' => 'Test Customer',
            'mobile_number' => '01700000000',
            'items' => [['product_id' => $first->id, 'quantity' => 2]],
        ]);

        $this->assertSame(2, Inventory::where('product_id', $first->id)->where('shop_id', $shop->id)->value('reserved'));

        $edited = $orders->replaceEditableItems($order, [
            ['product_id' => $first->id, 'quantity' => 3],
            ['product_id' => $second->id, 'quantity' => 1],
        ], $admin->id);

        $this->assertSame(3, Inventory::where('product_id', $first->id)->where('shop_id', $shop->id)->value('reserved'));
        $this->assertSame(1, Inventory::where('product_id', $second->id)->where('shop_id', $shop->id)->value('reserved'));
        $this->assertCount(2, $edited->items);

        $edited = $orders->replaceEditableItems($edited, [
            ['product_id' => $first->id, 'quantity' => 1],
        ], $admin->id);

        $this->assertSame(1, Inventory::where('product_id', $first->id)->where('shop_id', $shop->id)->value('reserved'));
        $this->assertSame(0, Inventory::where('product_id', $second->id)->where('shop_id', $shop->id)->value('reserved'));
        $this->assertCount(1, $edited->items);

        try {
            $orders->replaceEditableItems($edited, [
                ['product_id' => $first->id, 'quantity' => 6],
            ], $admin->id);
            $this->fail('Expected insufficient stock to reject the edit.');
        } catch (InventoryConflictException $exception) {
            $this->assertSame('inventory_insufficient_available', $exception->reasonCode);
        }

        $this->assertSame(1, Inventory::where('product_id', $first->id)->where('shop_id', $shop->id)->value('reserved'));
        $this->assertSame(1, $edited->fresh('items')->items->first()->quantity);
    }
}
