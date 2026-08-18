<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\ProductBatch;
use App\Services\ActivityLogService;
use App\Services\DirectBatchService;
use App\Services\InventoryService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    use ApiResponse;

    public function __construct(
        private InventoryService $inventory,
        private DirectBatchService $batches,
        private ActivityLogService $activities,
    ) {}

    public function index(Request $request)
    {
        $rows = Inventory::query()
            ->with(['product:id,name,sku,slug,image_src,selling_price,retail_price,wholesale_price,cost_price,stock_status', 'product.productImages', 'variant:id,sku,price,sale_price,retail_price,wholesale_price,cost_price', 'shop:id,name,code'])
            ->when($request->q, fn ($q, $search) => $q->whereHas('product', fn ($product) => $product->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%")))
            ->when($request->shop_id, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->when($request->health === 'low', fn ($q) => $q->whereRaw('(quantity - reserved) > 0')->whereRaw('(quantity - reserved) <= low_stock_threshold'))
            ->when($request->health === 'out', fn ($q) => $q->whereRaw('(quantity - reserved) <= 0'))
            ->when($request->health === 'healthy', fn ($q) => $q->whereRaw('(quantity - reserved) > low_stock_threshold'))
            ->orderByRaw('(quantity - reserved) asc')
            ->paginate((int) $request->get('per_page', 50));

        return $this->success($rows, 'Inventory retrieved.');
    }

    public function batches(Request $request)
    {
        $rows = ProductBatch::query()
            ->with([
                'product:id,name,sku,slug,image_src,selling_price,retail_price,wholesale_price,cost_price',
                'product.productImages',
                'variant:id,product_id,sku,price,sale_price,retail_price,wholesale_price,cost_price',
                'shop:id,name,code',
                'creator:id,name',
            ])
            ->when($request->shop_id, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->when($request->product_id, fn ($q, $productId) => $q->where('product_id', $productId))
            ->when($request->q, function ($q, $search): void {
                $q->where(function ($sub) use ($search): void {
                    $sub->where('batch_reference', 'like', "%{$search}%")
                        ->orWhereHas('product', fn ($product) => $product->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%"))
                        ->orWhereHas('variant', fn ($variant) => $variant->where('sku', 'like', "%{$search}%"));
                });
            })
            ->latest('received_at')
            ->latest('id')
            ->paginate((int) $request->get('per_page', 50));

        return $this->success($rows, 'Direct product batches retrieved.');
    }

    public function storeBatch(Request $request)
    {
        $data = $request->validate([
            'confirmed' => ['required', 'accepted'],
            'shop_id' => ['required', 'integer', 'exists:shops,id'],
            'note' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.cost_price' => ['required', 'numeric', 'min:0'],
            'items.*.selling_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.retail_price' => ['required', 'numeric', 'min:0'],
            'items.*.wholesale_price' => ['required', 'numeric', 'min:0'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
        ]);

        $result = $this->batches->receive($data, $request->user()->id);
        $this->activities->record(
            'inventory',
            'batch_received',
            "Received direct batch {$result['batch_reference']} with {$result['total_units']} units.",
            after: $result,
            shopId: (int) $data['shop_id'],
            request: $request,
        );

        return $this->success($result, 'Product batch confirmed and stock entered.', 201);
    }

    public function adjust(Request $request)
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'shop_id' => ['required', 'integer', 'exists:shops,id'],
            'quantity_change' => ['required', 'integer'],
            'note' => ['required', 'string', 'max:1000'],
            'reason_code' => ['nullable', 'string', 'max:80'],
        ]);
        $row = $this->inventory->adjust(
            $data['product_id'],
            $data['variant_id'] ?? null,
            $data['quantity_change'],
            $data['note'],
            $request->user()->id,
            $data['shop_id'],
            $data['reason_code'] ?? 'manual_adjustment',
        );
        $this->activities->record('inventory', 'adjusted', "Adjusted stock for {$row->product?->name}", $row, [], $data, request: $request);
        return $this->success($row, 'Inventory adjusted.');
    }

    public function movements(Request $request)
    {
        $rows = \App\Models\StockMovement::with(['inventory.product:id,name,sku', 'inventory.variant:id,sku', 'shop:id,name,code', 'actor:id,name'])
            ->when($request->inventory_id, fn ($q, $id) => $q->where('inventory_id', $id))
            ->when($request->shop_id, fn ($q, $id) => $q->where('shop_id', $id))
            ->when($request->type, fn ($q, $type) => $q->where('type', $type))
            ->latest('created_at')->paginate((int) $request->get('per_page', 50));
        return $this->success($rows, 'Stock movements retrieved.');
    }
}
