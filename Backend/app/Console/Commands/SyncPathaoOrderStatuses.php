<?php

namespace App\Console\Commands;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Services\OrderService;
use App\Services\PathaoService;
use Illuminate\Console\Command;
use Throwable;

class SyncPathaoOrderStatuses extends Command
{
    protected $signature = 'pathao:sync-statuses {--delay=3 : Delay in seconds between requests (default 3s = 20 orders/min)}';

    protected $description = 'Sync order status and customer dues for active Pathao shipments.';

    public function handle(PathaoService $pathaoService, OrderService $orderService): int
    {
        $delay = max(0, (int) $this->option('delay'));

        $orders = Order::query()
            ->whereNotNull('pathao_consignment_id')
            ->whereNotIn('status', [
                OrderStatus::DELIVERED->value,
                OrderStatus::RETURNED->value,
            ])
            ->get();


        $total = $orders->count();
        $this->info("Found {$total} active Pathao orders to sync.");

        if ($total === 0) {
            return Command::SUCCESS;
        }

        $deliveredCount = 0;
        $returnedCount = 0;
        $failedCount = 0;

        foreach ($orders as $index => $order) {
            if ($index > 0 && $delay > 0) {
                sleep($delay);
            }

            try {
                $info = $pathaoService->getOrderInfo((string) $order->pathao_consignment_id);
                $rawStatus = $info['order_status_slug'] ?? $info['order_status'] ?? '';
                $statusSlug = strtolower(trim((string) $rawStatus));

                if ($statusSlug === 'delivered') {
                    $orderService->transition($order, OrderStatus::DELIVERED->value, null, 'Pathao status sync: Delivered', true);

                    $freshOrder = $order->fresh();
                    $netTotal = round(max(0, (float) $freshOrder->grand_total - (float) $freshOrder->refund_total), 2);
                    $remainingDue = (float) $freshOrder->due_amount;

                    if ($remainingDue > 0) {
                        Payment::create([
                            'order_id' => $freshOrder->id,
                            'payment_method' => 'cod',
                            'amount' => $remainingDue,
                            'currency' => $freshOrder->currency ?: 'BDT',
                            'status' => 'paid',
                            'paid_at' => now(),
                            'payment_reference' => 'PATHAO-COD-' . $freshOrder->pathao_consignment_id,
                        ]);
                    }

                    $freshOrder->update([
                        'paid_amount' => $netTotal,
                        'due_amount' => 0,
                        'payment_status' => PaymentStatus::PAID->value,
                    ]);

                    $deliveredCount++;
                    $this->info("Order #{$order->order_number} marked Delivered & dues cleared.");
                } elseif ($statusSlug === 'returned' || $statusSlug === 'return') {
                    $orderService->transition($order, OrderStatus::RETURNED->value, null, 'Pathao status sync: Returned', true);
                    $returnedCount++;
                    $this->info("Order #{$order->order_number} marked Returned.");
                }
            } catch (Throwable $e) {
                $failedCount++;
                $this->error("Failed to sync Order #{$order->order_number}: {$e->getMessage()}");
            }
        }

        $this->info("Sync complete. Delivered: {$deliveredCount}, Returned: {$returnedCount}, Failed/Unchanged: {$failedCount}");

        return Command::SUCCESS;
    }
}
