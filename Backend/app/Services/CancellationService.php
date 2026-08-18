<?php

namespace App\Services;

use App\Models\CancellationRequest;
use App\Models\Order;

class CancellationService
{
    public function __construct(private OrderService $orderService) {}

    public function request(Order $order, ?int $userId, ?string $reason = null): CancellationRequest
    {
        $request = CancellationRequest::create([
            'order_id' => $order->id,
            'requested_by' => $userId,
            'reason' => $reason,
            'status' => 'approved',
            'processed_by' => $userId,
            'processed_at' => now(),
        ]);
        $this->orderService->cancel($order, $userId, $reason);
        return $request->fresh();
    }
}
