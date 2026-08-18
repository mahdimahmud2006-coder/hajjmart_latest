<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Services\ActivityLogService;
use App\Services\InventoryService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class StockTransferController extends Controller
{
    use ApiResponse;
    public function __construct(private InventoryService $inventory, private ActivityLogService $activities) {}

    public function index(Request $request)
    {
        $transfers = StockTransfer::with(['fromShop:id,name,code', 'toShop:id,name,code', 'items.product:id,name,sku', 'items.variant:id,sku'])
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->shop_id, fn ($q, $shopId) => $q->where(fn ($sub) => $sub->where('from_shop_id', $shopId)->orWhere('to_shop_id', $shopId)))
            ->latest()->paginate((int) $request->get('per_page', 30));
        return $this->success($transfers, 'Stock transfers retrieved.');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'from_shop_id' => ['required', 'integer', 'exists:shops,id', 'different:to_shop_id'],
            'to_shop_id' => ['required', 'integer', 'exists:shops,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $transfer = DB::transaction(function () use ($data, $request): StockTransfer {
            $transfer = StockTransfer::create([
                'transfer_number' => 'TR-' . now()->format('Ymd-His'),
                'from_shop_id' => $data['from_shop_id'],
                'to_shop_id' => $data['to_shop_id'],
                'status' => 'draft',
                'created_by' => $request->user()->id,
                'note' => $data['note'] ?? null,
            ]);
            foreach ($data['items'] as $item) {
                StockTransferItem::create([
                    'stock_transfer_id' => $transfer->id,
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'] ?? null,
                    'quantity_requested' => $item['quantity'],
                ]);
            }
            return $transfer;
        });
        $this->activities->record('inventory', 'transfer_created', "Created stock transfer {$transfer->transfer_number}", $transfer, [], $transfer->toArray(), request: $request);
        return $this->success($transfer->load('items.product', 'fromShop', 'toShop'), 'Stock transfer created.', 201);
    }

    public function approve(Request $request, StockTransfer $stockTransfer)
    {
        abort_unless($stockTransfer->status === 'draft', 422, 'Only draft transfers can be approved.');
        foreach ($stockTransfer->items as $item) {
            $row = $this->inventory->inventoryRow($item->product_id, $item->variant_id, $stockTransfer->from_shop_id);
            if ($row->available < $item->quantity_requested) throw new RuntimeException("Insufficient source stock for {$item->product?->name}.");
        }
        $stockTransfer->update(['status' => 'approved', 'approved_by' => $request->user()->id, 'approved_at' => now()]);
        $this->activities->record('inventory', 'transfer_approved', "Approved {$stockTransfer->transfer_number}", $stockTransfer, [], $stockTransfer->toArray(), request: $request);
        return $this->success($stockTransfer->fresh(['items.product', 'fromShop', 'toShop']), 'Stock transfer approved.');
    }

    public function receive(Request $request, StockTransfer $stockTransfer)
    {
        abort_unless($stockTransfer->status === 'approved', 422, 'Only approved transfers can be received.');
        DB::transaction(function () use ($stockTransfer, $request): void {
            foreach ($stockTransfer->items as $item) {
                $this->inventory->transfer(
                    $stockTransfer->from_shop_id,
                    $stockTransfer->to_shop_id,
                    $item->product_id,
                    $item->variant_id,
                    $item->quantity_requested,
                    $request->user()->id,
                    $stockTransfer,
                );
                $item->update(['quantity_received' => $item->quantity_requested]);
            }
            $stockTransfer->update(['status' => 'received', 'received_by' => $request->user()->id, 'received_at' => now()]);
        });
        $this->activities->record('inventory', 'transfer_received', "Received {$stockTransfer->transfer_number}", $stockTransfer, [], $stockTransfer->toArray(), request: $request);
        return $this->success($stockTransfer->fresh(['items.product', 'fromShop', 'toShop']), 'Stock transfer received.');
    }
}
