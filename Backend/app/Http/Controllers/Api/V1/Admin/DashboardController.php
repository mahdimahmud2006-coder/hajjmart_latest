<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\FraudCase;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductBatch;
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
        $today = now()->toDateString();

        $orders = Order::query()->when($shopId, fn ($query) => $query->where('shop_id', $shopId));
        $validOrders = (clone $orders)->where('status', '!=', 'cancelled');
        $inventory = Inventory::query()->when($shopId, fn ($query) => $query->where('shop_id', $shopId));

        $todaySummary = (clone $validOrders)
            ->whereDate(DB::raw('COALESCE(order_date, created_at)'), $today)
            ->selectRaw('COUNT(*) as orders, COALESCE(SUM(grand_total), 0) as sales')
            ->first();

        $channelRows = (clone $validOrders)
            ->whereDate(DB::raw('COALESCE(order_date, created_at)'), $today)
            ->selectRaw("COALESCE(source_channel, 'website') as source, COUNT(*) as orders, COALESCE(SUM(grand_total), 0) as sales")
            ->groupBy('source_channel')
            ->get();

        $channels = collect([
            'website' => ['source' => 'website', 'orders' => 0, 'sales' => 0.0],
            'social_commerce' => ['source' => 'social_commerce', 'orders' => 0, 'sales' => 0.0],
            'pos' => ['source' => 'pos', 'orders' => 0, 'sales' => 0.0],
        ]);

        foreach ($channelRows as $row) {
            $source = $row->source === 'ecommerce' ? 'website' : $row->source;
            if (! $channels->has($source)) {
                $source = 'website';
            }
            $current = $channels->get($source);
            $channels->put($source, [
                'source' => $source,
                'orders' => $current['orders'] + (int) $row->orders,
                'sales' => round($current['sales'] + (float) $row->sales, 2),
            ]);
        }

        $attentionCounts = (clone $validOrders)
            ->selectRaw("SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders")
            ->selectRaw("SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_orders")
            ->first();

        $attention = collect();
        if ((int) ($attentionCounts->pending_orders ?? 0) > 0) {
            $attention->push([
                'type' => 'pending_orders',
                'urgency' => 1,
                'count' => (int) $attentionCounts->pending_orders,
            ]);
        }
        if ((int) ($attentionCounts->confirmed_orders ?? 0) > 0) {
            $attention->push([
                'type' => 'confirmed_orders',
                'urgency' => 2,
                'count' => (int) $attentionCounts->confirmed_orders,
            ]);
        }

        $lowStockRows = (clone $inventory)
            ->with(['product:id,name,sku', 'variant:id,sku'])
            ->whereRaw('(quantity - reserved) <= low_stock_threshold')
            ->orderByRaw('(quantity - reserved) asc')
            ->limit(3)
            ->get();

        foreach ($lowStockRows as $row) {
            $available = max(0, (int) $row->quantity - (int) $row->reserved);
            $attention->push([
                'type' => $available <= 0 ? 'out_of_stock' : 'low_stock',
                'urgency' => $available <= 0 ? 1 : 3,
                'inventory_id' => $row->id,
                'product_id' => $row->product_id,
                'variant_id' => $row->variant_id,
                'product_name' => $row->product?->name,
                'sku' => $row->variant?->sku ?: $row->product?->sku,
                'available' => $available,
            ]);
        }

        $criticalRiskCases = FraudCase::query()
            ->when($shopId, fn ($query) => $query->where('shop_id', $shopId))
            ->where('severity', 'critical')
            ->where('status', 'open')
            ->count();

        if ($criticalRiskCases > 0) {
            $attention->push([
                'type' => 'critical_risk',
                'urgency' => 1,
                'count' => $criticalRiskCases,
            ]);
        }

        $attention = $attention
            ->sortBy('urgency')
            ->values();

        $recentOrders = (clone $orders)
            ->select([
                'id', 'order_number', 'checkout_name', 'checkout_mobile_number', 'source_channel',
                'status', 'grand_total', 'order_date', 'created_at',
            ])
            ->latest('order_date')
            ->latest('created_at')
            ->limit(5)
            ->get();

        $lowStockCount = (clone $inventory)
            ->whereRaw('(quantity - reserved) <= low_stock_threshold')
            ->count();

        $data = [
            'metrics' => [
                'sales_today' => round((float) ($todaySummary->sales ?? 0), 2),
                'orders_today' => (int) ($todaySummary->orders ?? 0),
                'customer_due' => round((float) (clone $validOrders)->where('due_amount', '>', 0)->sum('due_amount'), 2),
                'low_stock_count' => $lowStockCount,
            ],
            'channel_today' => $channels->values(),
            'attention' => $attention,
            'recent_orders' => $recentOrders,
            'onboarding' => [
                'has_product' => Product::query()->exists(),
                'has_stock' => ProductBatch::query()
                    ->when($shopId, fn ($query) => $query->where('shop_id', $shopId))
                    ->where('initial_quantity', '>', 0)
                    ->exists(),
                'has_order' => (clone $validOrders)->exists(),
                'employee_count' => User::query()
                    ->where('is_employee', true)
                    ->where('is_active', true)
                    ->count(),
            ],
            'generated_at' => now()->toIso8601String(),
        ];

        return $this->success($data, 'Admin dashboard retrieved.');
    }
}
