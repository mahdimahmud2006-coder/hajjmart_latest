<?php

namespace App\Services;

use App\Models\CouponApplication;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductBatch;
use App\Models\ReturnRequest;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class ReportService
{
    private function resultLimit(array $filters, int $default = 100): int
    {
        return max(1, min(250, (int) ($filters['limit'] ?? $default)));
    }

    private function applyOrderFilters($query, array $filters, string $dateColumn = 'orders.created_at')
    {
        return $query
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->whereDate($dateColumn, '>=', $from))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->whereDate($dateColumn, '<=', $to))
            ->when($filters['shop_id'] ?? null, fn ($q, $shopId) => $q->where('orders.shop_id', $shopId))
            ->when($filters['district'] ?? null, fn ($q, $district) => $q->where('orders.checkout_district', $district))
            ->when($filters['payment_method'] ?? null, fn ($q, $method) => $q->whereRaw('LOWER(orders.payment_method) = ?', [strtolower($method)]))
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->whereRaw("LOWER(COALESCE(orders.status, orders.order_status, '')) = ?", [strtolower($status)]))
            ->when($filters['year'] ?? null, fn ($q, $year) => $q->whereYear($dateColumn, $year))
            ->when($filters['month'] ?? null, fn ($q, $month) => $q->whereMonth($dateColumn, $month));
    }

    private function validOrders($query)
    {
        return $query->whereRaw("LOWER(COALESCE(orders.status, orders.order_status, '')) != 'cancelled'");
    }

    private function orderItemsBase(array $filters)
    {
        $query = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'order_items.variant_id')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id');

        $this->validOrders($query);
        $this->applyOrderFilters($query, $filters);

        return $query
            ->when($filters['product_id'] ?? null, fn ($q, $id) => $q->where('order_items.product_id', $id))
            ->when($filters['category_id'] ?? null, fn ($q, $id) => $q->where('products.category_id', $id));
    }

    private function aggregateSelect($query)
    {
        return $query->selectRaw('COUNT(DISTINCT orders.id) as orders_count')
            ->selectRaw('COALESCE(SUM(order_items.quantity), 0) as units_sold')
            ->selectRaw('COALESCE(SUM(CASE WHEN order_items.line_grand_total > 0 THEN order_items.line_grand_total ELSE order_items.line_total END), 0) as revenue')
            ->selectRaw('COALESCE(SUM(order_items.line_discount_total), 0) as discount')
            ->selectRaw('COALESCE(SUM(order_items.cogs_total), 0) as cogs')
            ->selectRaw('COALESCE(SUM(order_items.gross_profit), 0) as gross_profit');
    }

    public function performance(array $filters): array
    {
        $orders = $this->applyOrderFilters(Order::query()->from('orders'), $filters);
        $validOrders = $this->validOrders($this->applyOrderFilters(Order::query()->from('orders'), $filters));
        $itemMetrics = $this->aggregateSelect($this->orderItemsBase($filters))->first();
        $totalOrders = (clone $orders)->count();
        $validOrderCount = (clone $validOrders)->count();
        $cancelledOrders = (clone $orders)->whereRaw("LOWER(COALESCE(status, order_status, '')) = 'cancelled'")->count();
        $totalRevenue = (float) (clone $validOrders)->sum('grand_total');
        $collection = (float) (clone $validOrders)->sum('paid_amount');
        $customerDue = (float) (clone $validOrders)->sum('due_amount');
        $grossProfit = (float) ($itemMetrics->gross_profit ?? 0);
        $refundTotal = (float) (clone $validOrders)->sum('refund_total');
        $totalCogs = (float) ($itemMetrics->cogs ?? 0);

        $inventory = Inventory::query()
            ->when($filters['shop_id'] ?? null, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->get();
        $stockValue = (float) ProductBatch::query()
            ->when($filters['shop_id'] ?? null, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->where('count', '>', 0)
            ->selectRaw('COALESCE(SUM(count * cost_price), 0) as value')
            ->value('value');
        $lowStockCount = $inventory->filter(fn ($row) => $row->available <= (int) $row->low_stock_threshold)->count();
        $stockUnits = (int) $inventory->sum('quantity');
        $reservedStockUnits = (int) $inventory->sum('reserved');
        $availableStockUnits = (int) $inventory->sum(fn ($row) => $row->available);

        $batchReceipts = ProductBatch::query()
            ->when($filters['shop_id'] ?? null, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->whereDate('received_at', '>=', $from))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->whereDate('received_at', '<=', $to));

        $returns = ReturnRequest::query()
            ->when($filters['shop_id'] ?? null, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->whereDate('created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->whereDate('created_at', '<=', $to));

        $purgedMovements = DB::table('stock_movements')
            ->leftJoin('product_batches', function ($join) {
                $join->on('stock_movements.reference_id', '=', 'product_batches.id')
                    ->where('stock_movements.reference_type', '=', 'App\\Models\\ProductBatch');
            })
            ->when($filters['shop_id'] ?? null, fn ($q, $shopId) => $q->where('stock_movements.shop_id', $shopId))
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->whereDate('stock_movements.created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->whereDate('stock_movements.created_at', '<=', $to))
            ->where(function ($q) {
                $q->where('stock_movements.type', 'purge')
                  ->orWhere('stock_movements.reason_code', 'stock_purge');
            })
            ->selectRaw('COALESCE(SUM(ABS(stock_movements.quantity_change)), 0) as units')
            ->selectRaw('COALESCE(SUM(ABS(stock_movements.quantity_change) * COALESCE(product_batches.cost_price, 0)), 0) as cost_loss')
            ->first();

        $purgedUnits = (int) ($purgedMovements->units ?? 0);
        $purgedStockCost = round((float) ($purgedMovements->cost_loss ?? 0), 2);

        return [
            'currency' => config('hajjmart.currency', 'BDT'),
            'filters' => $filters,
            'summary' => [
                'total_orders' => $totalOrders,
                'valid_orders' => $validOrderCount,
                'cancelled_orders' => $cancelledOrders,
                'cancellation_rate' => $totalOrders > 0 ? round(($cancelledOrders / $totalOrders) * 100, 2) : 0,
                'pending_orders' => (clone $orders)->whereRaw("LOWER(COALESCE(status, order_status, '')) NOT IN ('delivered', 'returned')")->count(),
                'total_sales' => round($totalRevenue, 2),
                'collection' => round($collection, 2),
                'customer_due' => round($customerDue, 2),
                'online_sales' => round((float) (clone $validOrders)->whereIn('source_channel', ['website', 'ecommerce'])->sum('grand_total'), 2),
                'social_sales' => round((float) (clone $validOrders)->where('source_channel', 'social_commerce')->sum('grand_total'), 2),
                'pos_sales' => round((float) (clone $validOrders)->where('source_channel', 'pos')->sum('grand_total'), 2),
                'total_discount' => round((float) (clone $validOrders)->sum('discount_total'), 2),
                'item_discount_total' => round((float) ($itemMetrics->discount ?? 0), 2),
                'shipping_discount_total' => round((float) (clone $validOrders)->sum('shipping_discount_total'), 2),
                'refund_total' => round($refundTotal, 2),
                'total_refunds' => round($refundTotal, 2),
                'exchange_due_total' => round((float) (clone $validOrders)->sum('exchange_due_total'), 2),
                'total_cogs' => round($totalCogs, 2),
                'cogs' => round($totalCogs, 2),
                'gross_profit' => round($grossProfit, 2),
                'gross_profit_margin' => $totalRevenue > 0 ? round(($grossProfit / $totalRevenue) * 100, 2) : 0,
                'average_order_value' => $validOrderCount > 0 ? round($totalRevenue / $validOrderCount, 2) : 0,
                'items_sold' => (int) ($itemMetrics->units_sold ?? 0),
                'unique_customers' => (clone $validOrders)->whereNotNull('customer_id')->distinct('customer_id')->count('customer_id'),
                'stock_units' => $stockUnits,
                'reserved_stock_units' => $reservedStockUnits,
                'available_stock_units' => $availableStockUnits,
                'batch_receipts' => (clone $batchReceipts)->distinct('batch_reference')->count('batch_reference'),
                'stock_received_units' => (int) (clone $batchReceipts)->sum('initial_quantity'),
                'stock_value' => round((float) $stockValue, 2),
                'purged_units' => $purgedUnits,
                'purged_stock_cost' => $purgedStockCost,
                'stock_damage_loss' => $purgedStockCost,
                'net_profit' => round($grossProfit - $purgedStockCost, 2),
                'low_stock_count' => $lowStockCount,
                'return_requests' => (clone $returns)->count(),
            ],
            'payment_methods' => $this->validOrders($this->applyOrderFilters(Order::query()->from('orders'), $filters))
                ->selectRaw('payment_method, COUNT(*) as orders, COALESCE(SUM(grand_total), 0) as sales')
                ->groupBy('payment_method')
                ->orderByDesc('sales')
                ->get(),
            'source_mix' => (clone $validOrders)
                ->selectRaw("COALESCE(source_channel, 'unknown') as source, COUNT(*) as orders, COALESCE(SUM(grand_total), 0) as sales")
                ->groupBy('source')
                ->orderByDesc('sales')
                ->get(),
            'top_products' => array_slice($this->products($filters), 0, 10),
            'top_categories' => array_slice($this->categories($filters), 0, 10),
            'top_districts' => array_slice($this->districts($filters), 0, 10),
            'monthly' => $this->months($filters),
            'promotions' => array_slice($this->promotions($filters), 0, 10),
        ];
    }

    public function sales(array $filters): array
    {
        $orders = $this->applyOrderFilters(Order::query()->from('orders'), $filters);
        $valid = $this->validOrders($this->applyOrderFilters(Order::query()->from('orders'), $filters));

        return [
            'currency' => config('hajjmart.currency', 'BDT'),
            'total_orders' => (clone $orders)->count(),
            'total_revenue' => (float) (clone $valid)->sum('grand_total'),
            'total_discount' => (float) (clone $valid)->sum('discount_total'),
            'item_discount_total' => (float) (clone $valid)->sum('item_discount_total'),
            'shipping_discount_total' => (float) (clone $valid)->sum('shipping_discount_total'),
            'total_refunds' => (float) (clone $valid)->sum('refund_total'),
            'total_delivery_charge' => (float) (clone $valid)->sum('shipping_total'),
            'average_order_value' => round((float) (clone $valid)->avg('grand_total'), 2),
            'by_day' => (clone $valid)
                ->selectRaw('DATE(created_at) as date, COUNT(*) as orders, COALESCE(SUM(grand_total), 0) as revenue, COALESCE(SUM(gross_profit), 0) as profit')
                ->groupBy('date')
                ->orderBy('date')
                ->get(),
            'by_month' => $this->months($filters),
        ];
    }

    public function orders(array $filters): array
    {
        $orders = $this->applyOrderFilters(Order::query()->from('orders'), $filters);
        $total = (clone $orders)->count();
        return [
            'total_orders' => $total,
            'cancelled_orders' => $cancelled,
            'cancellation_rate' => $total > 0 ? round(($cancelled / $total) * 100, 2) : 0,
            'pending_orders' => (clone $orders)->whereRaw("LOWER(COALESCE(status, order_status, '')) NOT IN ('delivered', 'returned')")->count(),
            'total_order_value' => round((float) (clone $orders)->whereRaw("LOWER(COALESCE(status, order_status, '')) != 'returned'")->sum('grand_total'), 2),
            'total_paid' => round((float) (clone $orders)->whereRaw("LOWER(COALESCE(status, order_status, '')) != 'returned'")->sum('paid_amount'), 2),
            'total_due' => round((float) (clone $orders)->whereRaw("LOWER(COALESCE(status, order_status, '')) != 'returned'")->sum('due_amount'), 2),
            'by_status' => (clone $orders)
                ->selectRaw("COALESCE(status, order_status, 'unknown') as status_name, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as order_value")
                ->groupBy('status_name')->orderByDesc('count')->get(),
            'by_payment_method' => (clone $orders)
                ->selectRaw("COALESCE(payment_method, 'unspecified') as payment_method, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as order_value")
                ->groupBy('payment_method')->orderByDesc('count')->get(),
            'by_source' => (clone $orders)
                ->selectRaw("COALESCE(source_channel, 'unknown') as source, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as order_value")
                ->groupBy('source')->orderByDesc('count')->get(),
            'recent_orders' => (clone $orders)
                ->with(['shop:id,name,code', 'customer:id,name,phone'])
                ->latest('created_at')
                ->limit($this->resultLimit($filters))
                ->get([
                    'id', 'order_number', 'customer_id', 'checkout_name', 'checkout_mobile_number',
                    'checkout_district', 'status', 'order_status', 'payment_status', 'payment_method',
                    'source_channel', 'grand_total', 'paid_amount', 'due_amount', 'shop_id', 'created_at',
                ])
                ->map(fn ($order) => [
                    'order_number' => $order->order_number,
                    'customer_name' => $order->checkout_name ?: $order->customer?->name ?: 'Walk-in customer',
                    'customer_phone' => $order->checkout_mobile_number ?: $order->customer?->phone,
                    'district' => $order->checkout_district,
                    'store_name' => $order->shop?->name,
                    'source' => $order->source_channel,
                    'status' => $order->status ?: $order->order_status,
                    'payment_status' => $order->payment_status,
                    'payment_method' => $order->payment_method,
                    'order_value' => round((float) $order->grand_total, 2),
                    'paid_amount' => round((float) $order->paid_amount, 2),
                    'due_amount' => round((float) $order->due_amount, 2),
                    'created_at' => optional($order->created_at)->toDateTimeString(),
                ]),
        ];
    }

    public function products(array $filters): array
    {
        return $this->aggregateSelect($this->orderItemsBase($filters))
            ->addSelect('products.id as product_id', 'products.name', 'products.sku', 'categories.name as category_name')
            ->groupBy('products.id', 'products.name', 'products.sku', 'categories.name')
            ->orderByDesc('revenue')
            ->limit($this->resultLimit($filters))
            ->get()
            ->map(fn ($row) => [
                'product_id' => $row->product_id,
                'name' => $row->name,
                'sku' => $row->sku,
                'category_name' => $row->category_name,
                'orders_count' => (int) $row->orders_count,
                'units_sold' => (int) $row->units_sold,
                'sales' => round((float) $row->revenue, 2),
                'discount' => round((float) ($row->discount ?? 0), 2),
                'cogs' => round((float) $row->cogs, 2),
                'gross_profit' => round((float) $row->gross_profit, 2),
                'profit_margin' => (float) $row->revenue > 0 ? round(((float) $row->gross_profit / (float) $row->revenue) * 100, 2) : 0,
            ])->toArray();
    }

    public function categories(array $filters): array
    {
        return $this->aggregateSelect($this->orderItemsBase($filters))
            ->addSelect('categories.id as category_id', DB::raw("COALESCE(categories.name, 'Uncategorized') as category_name"))
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc('revenue')
            ->limit($this->resultLimit($filters))
            ->get()
            ->map(fn ($row) => [
                'category_id' => $row->category_id,
                'category_name' => $row->category_name,
                'orders_count' => (int) $row->orders_count,
                'units_sold' => (int) $row->units_sold,
                'sales' => round((float) $row->revenue, 2),
                'discount' => round((float) ($row->discount ?? 0), 2),
                'cogs' => round((float) $row->cogs, 2),
                'gross_profit' => round((float) $row->gross_profit, 2),
                'profit_margin' => (float) $row->revenue > 0 ? round(((float) $row->gross_profit / (float) $row->revenue) * 100, 2) : 0,
            ])->toArray();
    }

    public function districts(array $filters): array
    {
        return $this->aggregateSelect($this->orderItemsBase($filters))
            ->addSelect(DB::raw("COALESCE(orders.checkout_district, 'Unknown') as district"))
            ->groupBy('district')
            ->orderByDesc('revenue')
            ->limit($this->resultLimit($filters))
            ->get()
            ->map(fn ($row) => [
                'district' => $row->district,
                'orders_count' => (int) $row->orders_count,
                'units_sold' => (int) $row->units_sold,
                'sales' => round((float) $row->revenue, 2),
                'discount' => round((float) ($row->discount ?? 0), 2),
                'cogs' => round((float) $row->cogs, 2),
                'gross_profit' => round((float) $row->gross_profit, 2),
            ])->toArray();
    }

    public function months(array $filters): array
    {
        $monthExpr = DB::getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', orders.created_at)"
            : "DATE_FORMAT(orders.created_at, '%Y-%m')";

        return $this->aggregateSelect($this->orderItemsBase($filters))
            ->addSelect(DB::raw("{$monthExpr} as month"))
            ->groupBy('month')
            ->orderBy('month')
            ->limit($this->resultLimit($filters))
            ->get()
            ->map(fn ($row) => [
                'month' => $row->month,
                'orders_count' => (int) $row->orders_count,
                'units_sold' => (int) $row->units_sold,
                'sales' => round((float) $row->revenue, 2),
                'discount' => round((float) ($row->discount ?? 0), 2),
                'cogs' => round((float) $row->cogs, 2),
                'gross_profit' => round((float) $row->gross_profit, 2),
            ])->toArray();
    }

    public function promotions(array $filters): array
    {
        $query = CouponApplication::query()
            ->join('orders', 'orders.id', '=', 'coupon_applications.order_id');
        $this->applyOrderFilters($query, $filters);
        $this->validOrders($query);

        return $query
            ->selectRaw("COALESCE(coupon_applications.code, 'AUTO') as code")
            ->selectRaw('coupon_applications.promotion_type')
            ->selectRaw('coupon_applications.visibility')
            ->selectRaw('COUNT(DISTINCT coupon_applications.order_id) as orders_count')
            ->selectRaw('COALESCE(SUM(coupon_applications.discount_amount), 0) as discount_given')
            ->selectRaw('COALESCE(SUM(coupon_applications.item_discount_amount), 0) as item_discount')
            ->selectRaw('COALESCE(SUM(coupon_applications.shipping_discount_amount), 0) as shipping_discount')
            ->groupBy('code', 'coupon_applications.promotion_type', 'coupon_applications.visibility')
            ->orderByDesc('discount_given')
            ->get()
            ->map(fn ($row) => [
                'code' => $row->code,
                'promotion_type' => $row->promotion_type,
                'visibility' => $row->visibility,
                'orders_count' => (int) $row->orders_count,
                'discount_given' => round((float) $row->discount_given, 2),
                'item_discount' => round((float) $row->item_discount, 2),
                'shipping_discount' => round((float) $row->shipping_discount, 2),
            ])->toArray();
    }

    public function inventory(array $filters): array
    {
        $batchValues = ProductBatch::query()
            ->selectRaw('product_id, variant_id, shop_id, SUM(count) as tracked_units, SUM(count * cost_price) as tracked_value')
            ->where('count', '>', 0)
            ->when($filters['shop_id'] ?? null, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->groupBy('product_id', 'variant_id', 'shop_id')
            ->get()
            ->keyBy(fn ($row) => $row->product_id . ':' . ($row->variant_id ?: 0) . ':' . $row->shop_id);

        return Inventory::with([
                'product:id,name,sku,cost_price,category_id',
                'product.primaryCategory:id,name',
                'variant:id,product_id,sku,cost_price,attribute_values',
                'shop:id,name,code',
            ])
            ->when($filters['shop_id'] ?? null, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->limit($this->resultLimit($filters))
            ->get()
            ->map(function ($row) use ($batchValues): array {
                $quantity = max(0, (int) $row->quantity);
                $batchValue = $batchValues->get($row->product_id . ':' . ($row->variant_id ?: 0) . ':' . $row->shop_id);
                $trackedUnits = min($quantity, (int) ($batchValue?->tracked_units ?? 0));
                $trackedValue = (float) ($batchValue?->tracked_value ?? 0);
                $fallbackCost = (float) ($row->variant?->cost_price ?? $row->product?->cost_price ?? 0);
                $stockValue = $trackedValue + max(0, $quantity - $trackedUnits) * $fallbackCost;
                $unitCost = $quantity > 0 ? $stockValue / $quantity : $fallbackCost;
                $variation = $row->variant?->attribute_values;
                if (is_array($variation)) {
                    $variation = collect($variation)->map(fn ($value, $key) => ucfirst((string) $key) . ': ' . $value)->implode(', ');
                }

                return [
                    'product_name' => $row->product?->name,
                    'product_sku' => $row->product?->sku,
                    'variation' => $variation ?: 'Base product',
                    'variant_sku' => $row->variant?->sku,
                    'category_name' => $row->product?->primaryCategory?->name,
                    'store_name' => $row->shop?->name,
                    'store_code' => $row->shop?->code,
                    'quantity' => $quantity,
                    'reserved' => (int) $row->reserved,
                    'available' => (int) $row->available,
                    'low_stock_threshold' => (int) $row->low_stock_threshold,
                    'unit_cost' => round($unitCost, 2),
                    'stock_value' => round($stockValue, 2),
                    'stock_health' => $row->stock_health,
                    'low_stock' => $row->available <= $row->low_stock_threshold,
                ];
            })->toArray();
    }

    public function returns(array $filters): array
    {
        $returns = ReturnRequest::query()
            ->when($filters['shop_id'] ?? null, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->whereDate('created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->whereDate('created_at', '<=', $to));

        return [
            'total' => (clone $returns)->count(),
            'refund_total' => round((float) (clone $returns)->sum('refund_total'), 2),
            'exchange_credit_total' => round((float) (clone $returns)->sum('exchange_credit_total'), 2),
            'exchange_due_total' => round((float) (clone $returns)->sum('exchange_due_total'), 2),
            'by_status' => (clone $returns)
                ->select('status', DB::raw('COUNT(*) as count'), DB::raw('COALESCE(SUM(refund_total), 0) as refund_total'))
                ->groupBy('status')->orderByDesc('count')->get(),
            'by_type' => (clone $returns)
                ->select('type', DB::raw('COUNT(*) as count'), DB::raw('COALESCE(SUM(refund_total), 0) as refund_total'), DB::raw('COALESCE(SUM(exchange_due_total), 0) as exchange_due_total'))
                ->groupBy('type')->orderByDesc('count')->get(),
            'requests' => (clone $returns)
                ->with(['order:id,order_number,checkout_name,checkout_mobile_number,grand_total', 'shop:id,name,code', 'creator:id,name'])
                ->latest('created_at')
                ->limit($this->resultLimit($filters))
                ->get([
                    'id', 'rr_number', 'order_id', 'type', 'status', 'reason', 'refund_total',
                    'exchange_credit_total', 'exchange_due_total', 'resolution_type', 'refund_method',
                    'restock_strategy', 'shop_id', 'created_by', 'resolved_at', 'created_at',
                ])
                ->map(fn ($return) => [
                    'request_number' => $return->rr_number,
                    'order_number' => $return->order?->order_number,
                    'customer_name' => $return->order?->checkout_name,
                    'customer_phone' => $return->order?->checkout_mobile_number,
                    'type' => $return->type,
                    'status' => $return->status,
                    'reason' => $return->reason,
                    'refund_total' => round((float) $return->refund_total, 2),
                    'exchange_credit_total' => round((float) $return->exchange_credit_total, 2),
                    'exchange_due_total' => round((float) $return->exchange_due_total, 2),
                    'resolution_type' => $return->resolution_type,
                    'refund_method' => $return->refund_method,
                    'stock_disposition' => $return->restock_strategy,
                    'store_name' => $return->shop?->name,
                    'created_by' => $return->creator?->name,
                    'resolved_at' => optional($return->resolved_at)->toDateTimeString(),
                    'created_at' => optional($return->created_at)->toDateTimeString(),
                ]),
        ];
    }

}
