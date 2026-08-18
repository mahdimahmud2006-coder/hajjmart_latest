<?php

namespace App\Jobs;

use App\Models\DailySalesSummary;
use App\Models\Order;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class GenerateDailySalesSummary implements ShouldQueue
{
    use Queueable;

    public function __construct(public ?string $date = null) {}

    public function handle(): void
    {
        $date = $this->date ?: now()->subDay()->toDateString();

        $orders = Order::query()->whereDate('created_at', $date);
        $validOrders = Order::query()
            ->whereDate('created_at', $date)
            ->whereRaw("LOWER(COALESCE(status, order_status, '')) != 'cancelled'");

        $itemMetrics = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereDate('orders.created_at', $date)
            ->whereRaw("LOWER(COALESCE(orders.status, orders.order_status, '')) != 'cancelled'")
            ->selectRaw('COALESCE(SUM(order_items.quantity), 0) as items')
            ->selectRaw('COALESCE(SUM(order_items.cogs_total), 0) as cogs')
            ->selectRaw('COALESCE(SUM(order_items.gross_profit), 0) as profit')
            ->first();

        $districtBreakdown = Order::query()
            ->whereDate('created_at', $date)
            ->whereRaw("LOWER(COALESCE(status, order_status, '')) != 'cancelled'")
            ->selectRaw("COALESCE(checkout_district, 'Unknown') as district, COUNT(*) as orders, COALESCE(SUM(grand_total), 0) as revenue")
            ->groupBy('district')
            ->orderByDesc('revenue')
            ->get()
            ->toArray();

        DailySalesSummary::updateOrCreate(
            ['date' => $date],
            [
                'total_orders' => (clone $orders)->count(),
                'cancelled_orders' => (clone $orders)->whereRaw("LOWER(COALESCE(status, order_status, '')) = 'cancelled'")->count(),
                'total_revenue' => (float) (clone $validOrders)->sum('grand_total'),
                'total_cogs' => (float) ($itemMetrics->cogs ?? 0),
                'gross_profit' => (float) ($itemMetrics->profit ?? 0),
                'total_refunds' => 0,
                'total_items_sold' => (int) ($itemMetrics->items ?? 0),
                'district_breakdown' => $districtBreakdown,
            ]
        );
    }
}
