<?php

namespace Tests\Feature;

use App\Actions\CommitInventoryAction;
use App\Models\Order;
use App\Models\OrderItemBatch;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ReturnRequest;
use App\Models\Shop;
use App\Models\User;
use App\Services\InventoryService;
use App\Services\OrderService;
use App\Services\ReturnService;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BatchReturnRestockTest extends TestCase
{
    use RefreshDatabase;
    public function test_sale_records_batch_allocation_and_same_store_return_revives_batch(): void
    {
        $admin = User::factory()->create(['is_employee' => true, 'is_admin' => true]);
        $shopA = Shop::create(['name' => 'Store A', 'code' => 'STA']);
        $product = Product::factory()->create(['name' => 'Batch Test Product', 'cost_price' => 100.00, 'selling_price' => 200.00, 'retail_price' => 200.00]);

        // 1. Create a batch for Store A with 10 units @ cost 100.00
        $batch = ProductBatch::recordIncrease(
            $product->id,
            null,
            $shopA->id,
            10,
            $admin->id,
            'BATCH-TEST-001',
            'Initial test batch',
            100.00,
            200.00
        );

        $inventoryService = app(InventoryService::class);
        $inventoryRow = $inventoryService->inventoryRow($product->id, null, $shopA->id);
        $inventoryRow->update(['quantity' => 10, 'reserved' => 0]);

        // 2. Place an order for 2 units
        $orderService = app(OrderService::class);
        $order = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $shopA->id,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
            'payment_method' => 'cash',
        ], $admin->id);

        CommitInventoryAction::run($order);

        // Verify batch was consumed: remaining count should be 8
        $batch->refresh();
        $this->assertEquals(8, $batch->count);

        // Verify order item has batch_id set and OrderItemBatch recorded
        $orderItem = $order->items()->first();
        $this->assertNotNull($orderItem->batch_id);
        $this->assertEquals($batch->id, $orderItem->batch_id);

        $itemBatch = OrderItemBatch::where('order_item_id', $orderItem->id)->first();
        $this->assertNotNull($itemBatch);
        $this->assertEquals($batch->id, $itemBatch->product_batch_id);
        $this->assertEquals(2, $itemBatch->quantity);

        // 3. Same-Store Return: Return 2 units to Store A
        $returnService = app(ReturnService::class);
        $returnRequest = $returnService->request($order, [
            'type' => 'return',
            'shop_id' => $shopA->id,
            'items' => [
                ['order_item_id' => $orderItem->id, 'quantity' => 2],
            ],
        ], actorId: $admin->id);

        $returnService->approve($returnRequest, actorId: $admin->id);
        $returnService->receive($returnRequest, actorId: $admin->id, restockReturnedItems: true);

        // Verify original batch count is revived to 10
        $batch->refresh();
        $this->assertEquals(10, $batch->count);
    }

    public function test_cross_store_return_matches_exact_cost_price_batch(): void
    {
        $admin = User::factory()->create(['is_employee' => true, 'is_admin' => true]);
        $shopA = Shop::create(['name' => 'Store A', 'code' => 'STA']);
        $shopB = Shop::create(['name' => 'Store B', 'code' => 'STB']);

        $product = Product::factory()->create(['name' => 'Cross Store Product', 'cost_price' => 150.00, 'selling_price' => 300.00, 'retail_price' => 300.00]);

        $batchA = ProductBatch::recordIncrease(
            $product->id,
            null,
            $shopA->id,
            5,
            $admin->id,
            'BATCH-STA-150',
            'Batch Store A',
            150.00,
            300.00
        );

        $inventoryService = app(InventoryService::class);
        $inventoryService->inventoryRow($product->id, null, $shopA->id)->update(['quantity' => 5, 'reserved' => 0]);
        $inventoryService->inventoryRow($product->id, null, $shopB->id)->update(['quantity' => 0, 'reserved' => 0]);

        $orderService = app(OrderService::class);
        $order = $orderService->place([
            'source_channel' => 'pos',
            'shop_id' => $shopA->id,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'payment_method' => 'cash',
        ], $admin->id);

        $orderItem = $order->items()->first();

        // Cross-store return to Store B
        $returnService = app(ReturnService::class);
        $returnRequest = $returnService->request($order, [
            'type' => 'return',
            'shop_id' => $shopB->id,
            'items' => [
                ['order_item_id' => $orderItem->id, 'quantity' => 1],
            ],
        ], actorId: $admin->id);

        $returnService->approve($returnRequest, actorId: $admin->id);
        $returnService->receive($returnRequest, actorId: $admin->id, restockReturnedItems: true);

        // Verify a batch in Store B was created with exact cost price 150.00 and count = 1
        $batchB = ProductBatch::where('shop_id', $shopB->id)->where('product_id', $product->id)->first();
        $this->assertNotNull($batchB);
        $this->assertEquals(150.00, (float) $batchB->cost_price);
        $this->assertEquals(1, $batchB->count);
    }
}
