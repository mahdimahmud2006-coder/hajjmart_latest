<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ReturnRequest;
use App\Services\ReturnService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReturnRequestController extends Controller
{
    use ApiResponse;

    public function __construct(private ReturnService $returns) {}

    public function index(Request $request)
    {
        $statusGroups = [
            'needs_action' => ['requested', 'pending'],
            'awaiting_product' => ['approved'],
            'ready' => ['received'],
            'completed' => ['completed', 'exchanged'],
            'rejected' => ['rejected'],
        ];
        $query = trim((string) $request->get('q', ''));
        $group = (string) $request->get('status_group', '');

        $returns = ReturnRequest::with([
            'order:id,order_number,checkout_name,checkout_mobile_number,checkout_district,grand_total,shop_id,payment_status',
            'order.shop:id,name,code',
            'creator:id,name',
            'order.payments:id,order_id,payment_method,amount,status,payment_reference,refunded_amount,refund_status,paid_at',
            'items.orderItem.product:id,name,sku,slug,image_src',
            'items.orderItem.variant:id,sku',
            'items.exchangeProduct:id,name,sku',
            'items.exchangeVariant:id,sku',
        ])
            ->when($query !== '', function ($q) use ($query): void {
                $q->where(function ($inner) use ($query): void {
                    $inner->where('rr_number', 'like', "%{$query}%")
                        ->orWhereHas('order', function ($order) use ($query): void {
                            $order->where('order_number', 'like', "%{$query}%")
                                ->orWhere('checkout_name', 'like', "%{$query}%")
                                ->orWhere('checkout_mobile_number', 'like', "%{$query}%");
                        });
                });
            })
            ->when(isset($statusGroups[$group]), fn ($q) => $q->whereIn('status', $statusGroups[$group]))
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->type && $request->type !== 'all', fn ($q, $type) => $q->where('type', $type))
            ->when($request->shop_id, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->when($request->from, fn ($q, $from) => $q->whereDate('created_at', '>=', $from))
            ->when($request->to, fn ($q, $to) => $q->whereDate('created_at', '<=', $to))
            ->latest()
            ->paginate(min(100, max(1, (int) $request->get('per_page', 20))));

        return $this->success($returns, 'Return/exchange requests retrieved.');
    }

    public function show(ReturnRequest $returnRequest)
    {
        return $this->success($returnRequest->load(['order.shop', 'order.payments.receiver', 'items.orderItem.product', 'items.orderItem.variant', 'items.exchangeProduct', 'items.exchangeVariant', 'statusHistory']), 'Return/exchange request retrieved.');
    }

    public function approve(Request $request, ReturnRequest $returnRequest)
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:1000']]);
        return $this->success($this->returns->approve($returnRequest, $request->user()?->id, $data['note'] ?? null), 'Return/exchange approved.');
    }

    public function reject(Request $request, ReturnRequest $returnRequest)
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:1000']]);
        return $this->success($this->returns->reject($returnRequest, $request->user()?->id, $data['note'] ?? null), 'Return/exchange rejected.');
    }

    public function receive(Request $request, ReturnRequest $returnRequest)
    {
        $data = $request->validate([
            'restock_returned_items' => ['nullable', 'boolean'],
            'restock_strategy' => ['nullable', Rule::in(['sellable', 'damaged', 'do_not_restock'])],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $strategy = $data['restock_strategy'] ?? (($data['restock_returned_items'] ?? true) ? 'sellable' : 'do_not_restock');
        $returnRequest->update(['restock_strategy' => $strategy]);

        return $this->success(
            $this->returns->receive($returnRequest, $request->user()?->id, $strategy === 'sellable', $data['note'] ?? null),
            'Return/exchange received.'
        );
    }
    public function complete(Request $request, ReturnRequest $returnRequest)
    {
        $data = $request->validate([
            'resolution_type' => ['required', Rule::in(['refund', 'exchange', 'store_credit'])],
            'refund_method' => ['nullable', 'string', 'max:80'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        return $this->success(
            $this->returns->complete($returnRequest, $request->user()?->id, $data['note'] ?? null, [
                'resolution_type' => $data['resolution_type'],
                'refund_method' => $data['refund_method'] ?? null,
            ]),
            'Return/exchange workflow completed.'
        );
    }

    public function refund(Request $request, ReturnRequest $returnRequest)
    {
        $data = $request->validate([
            'payment_id' => ['nullable', 'integer', 'exists:payments,id'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        return $this->success(
            $this->returns->refund($returnRequest, $request->user()?->id, $data['payment_id'] ?? null, $data['note'] ?? null),
            'Customer refund completed.'
        );
    }

}
