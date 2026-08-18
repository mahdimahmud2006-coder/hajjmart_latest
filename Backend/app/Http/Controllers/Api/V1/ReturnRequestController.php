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
        $returns = ReturnRequest::with(['order:id,order_number,checkout_name,checkout_mobile_number,checkout_district,grand_total,shop_id,payment_status', 'order.shop:id,name,code', 'order.payments:id,order_id,payment_method,amount,status,payment_reference,refunded_amount,refund_status,paid_at', 'items.orderItem.product'])
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->type, fn ($q, $type) => $q->where('type', $type))
            ->when($request->from, fn ($q, $from) => $q->whereDate('created_at', '>=', $from))
            ->when($request->to, fn ($q, $to) => $q->whereDate('created_at', '<=', $to))
            ->latest()
            ->paginate((int) $request->get('per_page', 20));

        return $this->success($returns, 'Return/exchange requests retrieved.');
    }

    public function show(ReturnRequest $returnRequest)
    {
        return $this->success($returnRequest->load(['order.shop', 'order.payments.receiver', 'items.orderItem.product', 'items.exchangeProduct', 'items.exchangeVariant', 'statusHistory']), 'Return/exchange request retrieved.');
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
            'note' => ['required', 'string', 'max:1000'],
        ]);

        return $this->success(
            $this->returns->complete($returnRequest, $request->user()?->id, $data['note'], [
                'resolution_type' => $data['resolution_type'],
                'refund_method' => $data['refund_method'] ?? null,
            ]),
            'Return/exchange workflow completed.'
        );
    }

}
