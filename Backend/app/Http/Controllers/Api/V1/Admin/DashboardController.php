<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\ProductBatch;
use App\Models\ReturnRequest;
use App\Models\FraudCase;
use App\Models\Shop;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    use ApiResponse;

    public function __invoke(Request $request)
    {
        $shopId = $request->integer('shop_id') ?: null;
        $orderQuery = Order::query()->when($shopId, fn ($q) => $q->where('shop_id', $shopId));
        $inventoryQuery = Inventory::query()->when($shopId, fn ($q) => $q->where('shop_id', $shopId));
        $batchQuery = ProductBatch::query()->when($shopId, fn ($q) => $q->where('shop_id', $shopId));

        $today = now()->startOfDay();
        $start = now()->subDays(6)->startOfDay();
        $daily = collect(range(0, 6))->map(function (int $offset) use ($orderQuery, $start): array {
            $date = $start->copy()->addDays($offset);
            $query = (clone $orderQuery)->whereDate(DB::raw('COALESCE(order_date, created_at)'), $date->toDateString());
            return [
                'date' => $date->toDateString(),
                'label' => $date->format('D'),
                'orders' => (clone $query)->count(),
                'sales' => round((float) (clone $query)->whereNotIn('status', ['cancelled'])->sum('grand_total'), 2),
            ];
        });

        $sourceMix = (clone $orderQuery)
            ->selectRaw("COALESCE(source_channel, 'website') as source, COUNT(*) as orders, SUM(grand_total) as sales")
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy('source_channel')
            ->get();

        $lowStock = (clone $inventoryQuery)
            ->with(['product:id,name,sku,slug,image_src', 'variant:id,sku', 'shop:id,name,code'])
            ->whereRaw('(quantity - reserved) <= low_stock_threshold')
            ->orderByRaw('(quantity - reserved) asc')
            ->limit(8)
            ->get();

        $recentOrders = (clone $orderQuery)
            ->with(['shop:id,name,code', 'creator:id,name', 'items:id,order_id,quantity'])
            ->latest('order_date')
            ->latest('created_at')
            ->limit(8)
            ->get();

        $todaySales = round((float) (clone $orderQuery)
            ->whereDate(DB::raw('COALESCE(order_date, created_at)'), $today->toDateString())
            ->whereNotIn('status', ['cancelled'])
            ->sum('grand_total'), 2);
        $todayOrders = (clone $orderQuery)
            ->whereDate(DB::raw('COALESCE(order_date, created_at)'), $today->toDateString())
            ->count();
        $lowStockCount = (clone $inventoryQuery)
            ->whereRaw('(quantity - reserved) <= low_stock_threshold')
            ->count();
        $openReturns = ReturnRequest::query()
            ->when($shopId, fn ($q) => $q->where('shop_id', $shopId))
            ->whereIn('status', ['requested', 'approved'])
            ->count();

        $inventoryRows = (clone $inventoryQuery)
            ->with(['product:id,cost_price', 'variant:id,cost_price'])
            ->get();
        $inventoryUnits = (int) $inventoryRows->sum('quantity');
        $availableUnits = (int) $inventoryRows->sum(fn ($row) => $row->available);
        $stockValue = round((float) $inventoryRows->sum(fn ($row) => (int) $row->quantity * (float) ($row->variant?->cost_price ?? $row->product?->cost_price ?? 0)), 2);
        $directBatchesToday = (clone $batchQuery)->whereDate('received_at', $today->toDateString())->distinct('batch_reference')->count('batch_reference');
        $unitsReceivedToday = (int) (clone $batchQuery)->whereDate('received_at', $today->toDateString())->sum('initial_quantity');

        $data = [
            'metrics' => [
                'today_sales' => $todaySales,
                'today_orders' => $todayOrders,
                'pending_orders' => (clone $orderQuery)->whereIn('status', ['pending', 'confirmed', 'processing'])->count(),
                'due_amount' => round((float) (clone $orderQuery)->where('due_amount', '>', 0)->sum('due_amount'), 2),
                'low_stock_products' => $lowStockCount,
                'returns_open' => $openReturns,
                'active_promotions' => Coupon::query()->active()->count(),
                'stock_value' => $stockValue,
                'inventory_units' => $inventoryUnits,
                'available_inventory_units' => $availableUnits,
                'direct_batches_today' => $directBatchesToday,
                'units_received_today' => $unitsReceivedToday,
                'risk_open_cases' => FraudCase::query()->when($shopId, fn ($q) => $q->where('shop_id', $shopId))->whereNotIn('status', ['resolved', 'closed'])->count(),
                'risk_critical_cases' => FraudCase::query()->when($shopId, fn ($q) => $q->where('shop_id', $shopId))->where('severity', 'critical')->whereNotIn('status', ['resolved', 'closed'])->count(),

                // Compatibility aliases for older clients.
                'sales_today' => $todaySales,
                'orders_today' => $todayOrders,
                'low_stock_items' => $lowStockCount,
                'pending_returns' => $openReturns,
                'active_employees' => User::where('is_active', true)->where('role', '!=', 'customer')->when($shopId, fn ($q) => $q->where('shop_id', $shopId))->count(),
                'active_stores' => Shop::where('is_active', true)->count(),
            ],
            'daily_sales' => $daily,
            'source_mix' => $sourceMix,
            'low_stock' => $lowStock,
            'recent_orders' => $recentOrders,
            'generated_at' => now()->toIso8601String(),
        ];

        return $this->success($data, 'Admin dashboard retrieved.');
    }
}
