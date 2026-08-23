<?php

namespace App\Jobs;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class ExpirePendingOrders implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 900;

    public function handle(OrderService $orders): void
    {
        Order::query()
            ->where('status', OrderStatus::PENDING->value)
            ->where('payment_status', PaymentStatus::DUE->value)
            ->where('payment_method', '!=', 'cod')
            ->where('created_at', '<', now()->subMinutes(15))
            ->chunkById(100, function ($pendingOrders) use ($orders): void {
                foreach ($pendingOrders as $order) {
                    DB::transaction(function () use ($order, $orders): void {
                        $locked = Order::whereKey($order->id)->lockForUpdate()->first();
                        if (! $locked
                            || $locked->status !== OrderStatus::PENDING->value
                            || $locked->payment_status !== PaymentStatus::DUE->value) {
                            return;
                        }

                        $locked->payments()
                            ->where('status', 'pending')
                            ->update(['status' => 'failed']);
                        $locked->update(['payment_status' => PaymentStatus::DUE->value]);
                        $orders->cancel($locked, null, 'Online payment expired before completion');
                    });
                }
            });
    }
}
