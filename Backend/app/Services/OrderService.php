<?php

namespace App\Services;

use App\Domains\Accounting\Services\OperationalPostingService;
use App\Actions\CommitInventoryAction;
use App\Actions\ReleaseInventoryAction;
use App\Actions\ReserveInventoryAction;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderList;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Shop;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OrderService
{
    public function __construct(
        private InventoryService $inventoryService,
        private PromotionService $promotionService,
        private RiskEngine $riskEngine,
        private OperationalPostingService $accounting,
    ) {}

    public function validateCart(array $items, array $pricingContext = [], ?int $customerId = null, ?int $shopId = null): array
    {
        $priceMode = strtolower((string) ($pricingContext['price_mode'] ?? 'retail')) === 'wholesale' ? 'wholesale' : 'retail';
        $validatedItems = $this->inventoryService->validateItems($items, $shopId, $priceMode);
        $quote = $this->promotionService->quote($validatedItems, $pricingContext, $customerId);

        return [
            'items' => array_map(function ($row) use ($quote): array {
                $key = $this->promotionService->lineKey($row['product']->id, $row['variant']?->id);
                $allocation = $quote['line_allocations'][$key] ?? [];
                return [
                    'product_id' => $row['product']->id,
                    'variant_id' => $row['variant']?->id,
                    'name' => $row['product']->name,
                    'quantity' => $row['quantity'],
                    'unit_price' => $row['unitPrice'],
                    'line_subtotal' => round($row['quantity'] * $row['unitPrice'], 2),
                    'discount_amount' => round((float) ($allocation['discount_total'] ?? 0), 2),
                    'line_total' => round((float) ($allocation['line_grand_total'] ?? ($row['quantity'] * $row['unitPrice'])), 2),
                    'available_stock' => $row['inventory']->quantity - $row['inventory']->reserved,
                ];
            }, $validatedItems),
            'quote' => $quote,
        ];
    }

    public function quoteCheckout(array $data, ?int $customerId = null): array
    {
        $shopId = Shop::defaultStore()->id;
        $validatedItems = $this->inventoryService->validateItems($data['items'] ?? [], $shopId, 'retail');
        $subtotal = round(array_sum(array_map(
            fn (array $row): float => (float) $row['quantity'] * (float) $row['unitPrice'],
            $validatedItems,
        )), 2);

        $pricingContext = [
            'checkout_district' => $data['district'] ?? null,
            'payment_method' => strtolower((string) ($data['payment_method'] ?? 'cod')),
            'coupon_code' => $data['coupon_code'] ?? null,
            'shipping_total' => $this->calculateDeliveryCharge($data['district'] ?? null, $subtotal),
            'tax_total' => 0,
            'price_mode' => 'retail',
        ];
        $quote = $this->promotionService->quote($validatedItems, $pricingContext, $customerId);
        $requestedCoupon = strtoupper(trim((string) ($data['coupon_code'] ?? '')));
        $couponApplied = $requestedCoupon === '' || in_array($requestedCoupon, $quote['coupon_codes'] ?? [], true);
        $couponMessage = null;
        if ($requestedCoupon !== '') {
            $couponMessage = $couponApplied
                ? 'Coupon applied.'
                : ($quote['rejected_promotions'][0]['reason'] ?? 'Coupon could not be applied.');
        }

        return [
            'currency' => $quote['currency'],
            'subtotal' => $quote['subtotal'],
            'delivery' => $quote['shipping_total'],
            'discount' => $quote['discount_total'],
            'grand_total' => $quote['grand_total'],
            'coupon_applied' => $couponApplied,
            'coupon_message' => $couponMessage,
            'items' => array_map(function (array $row) use ($quote): array {
                $key = $this->promotionService->lineKey($row['product']->id, $row['variant']?->id);
                $allocation = $quote['line_allocations'][$key] ?? [];
                return [
                    'product_id' => $row['product']->id,
                    'variant_id' => $row['variant']?->id,
                    'name' => $row['product']->name,
                    'quantity' => $row['quantity'],
                    'unit_price' => round((float) $row['unitPrice'], 2),
                    'line_total' => round((float) ($allocation['line_grand_total'] ?? ($row['quantity'] * $row['unitPrice'])), 2),
                    'available_stock' => $row['inventory']->quantity - $row['inventory']->reserved,
                ];
            }, $validatedItems),
        ];
    }

    public function place(array $data, ?int $customerId = null): Order
    {
        $checkout = $this->normalizeBangladeshCheckout($data);
        $sourceChannel = strtolower((string) ($data['source_channel'] ?? 'website'));
        $idempotencyKey = $sourceChannel === 'website' ? ($data['checkout_idempotency_key'] ?? null) : null;

        if ($idempotencyKey) {
            $existing = $this->findExistingWebsiteCheckout((string) $idempotencyKey, $customerId, $checkout['mobile_number']);
            if ($existing) {
                return $existing;
            }
        }

        try {
            return DB::transaction(function () use ($data, $customerId, $checkout, $sourceChannel, $idempotencyKey): Order {
                $data = array_merge($data, [
                    'checkout_district' => $checkout['district'],
                    'checkout_email' => $checkout['email'],
                    'checkout_mobile_number' => $checkout['mobile_number'],
                ]);
                $shopId = (int) ($data['shop_id'] ?? Shop::defaultStore()->id);
                $priceMode = $sourceChannel === 'website'
                    ? 'retail'
                    : (strtolower((string) ($data['price_mode'] ?? 'retail')) === 'wholesale' ? 'wholesale' : 'retail');
                $actorId = isset($data['created_by']) ? (int) $data['created_by'] : $customerId;
                $validatedItems = $this->inventoryService->validateItems($data['items'] ?? [], $shopId, $priceMode);

                if ($sourceChannel === 'website') {
                    $subtotal = round(array_sum(array_map(
                        fn (array $row): float => (float) $row['quantity'] * (float) $row['unitPrice'],
                        $validatedItems,
                    )), 2);
                    $data['shipping_total'] = $this->calculateDeliveryCharge($checkout['district'], $subtotal);
                    $data['tax_total'] = 0;
                    $data['manual_discount'] = 0;
                }

                $quote = $this->promotionService->quote($validatedItems, $data, $customerId);
                $quote = $this->applyManualDiscount($quote, (float) ($data['manual_discount'] ?? 0));

                $paymentMethod = strtolower((string) ($data['payment_method'] ?? 'cod'));
                $requestedStatus = strtolower((string) ($data['status'] ?? ''));
                $guestWebsiteCod = $sourceChannel === 'website' && $customerId === null && $paymentMethod === 'cod';
                $status = $requestedStatus ?: ($guestWebsiteCod
                    ? OrderStatus::PENDING->value
                    : ($paymentMethod === 'cod' ? OrderStatus::CONFIRMED->value : OrderStatus::PENDING->value));
                if ($sourceChannel === 'pos' && ! $requestedStatus) $status = OrderStatus::DELIVERED->value;

                $orderList = OrderList::create();
                $paidAmount = min((float) $quote['grand_total'], (float) ($data['paid_amount'] ?? ($sourceChannel === 'pos' ? $quote['grand_total'] : 0)));
                $order = Order::create([
                    'order_list_id' => $orderList->id,
                    'order_id' => (string) random_int(1000000, 9999999),
                    'order_number' => $this->nextOrderNumber(),
                    'customer_id' => $customerId,
                    'shop_id' => $shopId,
                    'created_by' => $actorId,
                    'assigned_to' => $data['assigned_to'] ?? null,
                    'order_date' => $data['order_date'] ?? now(),

                    'checkout_name' => $checkout['name'],
                    'checkout_country' => $checkout['country'],
                    'checkout_full_address' => $checkout['full_address'],
                    'checkout_district' => $checkout['district'],
                    'checkout_mobile_number' => $checkout['mobile_number'],
                    'checkout_email' => $checkout['email'],
                    'create_account_requested' => $checkout['create_account_requested'],
                    'ship_to_different_address' => $checkout['ship_to_different_address'],
                    'shipping_full_address' => $checkout['shipping_full_address'],
                    'shipping_district' => $checkout['shipping_district'],
                    'shipping_mobile_number' => $checkout['shipping_mobile_number'],
                    'shipping_email' => $checkout['shipping_email'],
                    'checkout_note' => $checkout['note'],

                    'status' => $status,
                    'order_status' => $status,
                    'payment_status' => PaymentStatus::PENDING->value,
                    'payment_method' => $paymentMethod,
                    'payment_channel' => $sourceChannel === 'website'
                        ? ($paymentMethod === 'cod' ? 'cash' : 'sslcommerz')
                        : ($data['payment_channel'] ?? ($paymentMethod === 'cod' ? 'cash' : 'sslcommerz')),
                    'terms_accepted' => (bool) ($data['terms_accepted'] ?? true),
                    'source_channel' => $sourceChannel,
                    'price_mode' => $priceMode,
                    'source_reference' => $data['source_reference'] ?? null,
                    'terminal_id' => $data['terminal_id'] ?? null,
                    'client_transaction_id' => $data['client_transaction_id'] ?? null,
                    'checkout_idempotency_key' => $idempotencyKey,
                    'offline_created_at' => $data['offline_created_at'] ?? null,
                    'synced_at' => $data['synced_at'] ?? null,
                    'priority' => $data['priority'] ?? 'normal',
                    'delivery_status' => $data['delivery_status'] ?? ($sourceChannel === 'pos' ? 'handed_over' : 'pending'),
                    'subtotal' => $quote['subtotal'],
                    'net_subtotal' => $quote['net_subtotal'],
                    'tax_total' => $quote['tax_total'],
                    'shipping_total' => $quote['shipping_total'],
                    'delivery_method' => $sourceChannel === 'website' ? 'home_delivery' : ($data['delivery_method'] ?? 'home_delivery'),
                    'discount_total' => $quote['discount_total'],
                    'item_discount_total' => $quote['item_discount_total'],
                    'shipping_discount_total' => $quote['shipping_discount_total'],
                    'coupon_code' => $quote['coupon_codes'][0] ?? ($data['coupon_code'] ?? null),
                    'coupon_codes' => $quote['coupon_codes'],
                    'promotion_snapshot' => $quote,
                    'grand_total' => $quote['grand_total'],
                    'paid_amount' => $paidAmount,
                    'due_amount' => max(0, (float) $quote['grand_total'] - $paidAmount),
                    'total_cogs' => 0,
                    'gross_profit' => 0,
                    'currency' => $sourceChannel === 'website' ? config('hajjmart.currency', 'BDT') : ($data['currency'] ?? config('hajjmart.currency', 'BDT')),
                    'shipping_address_snapshot' => $checkout['shipping_snapshot'],
                    'billing_address_snapshot' => $checkout['billing_snapshot'],
                    'customer_note' => $checkout['note'],
                    'admin_note' => $data['admin_note'] ?? null,
                    'placed_at' => now(),
                    'confirmed_at' => $status === OrderStatus::CONFIRMED->value ? now() : null,

                    // Legacy Sareng compatibility fields.
                    'ordered_products' => $data['items'],
                    'customer_details' => [
                        'name' => $checkout['name'],
                        'email' => $checkout['email'],
                        'phone' => $checkout['mobile_number'],
                    ],
                    'address' => $checkout['billing_snapshot'],
                    'delivery_charge' => $quote['shipping_total'],
                    'total_price' => $quote['grand_total'],
                ]);

                $totalCogs = 0.0;
                $grossProfit = 0.0;
                $reservePendingWebsiteOrder = $sourceChannel === 'website' && $status === OrderStatus::PENDING->value && $paidAmount <= 0;

                foreach ($validatedItems as $row) {
                    $key = $this->promotionService->lineKey($row['product']->id, $row['variant']?->id);
                    $allocation = $quote['line_allocations'][$key] ?? [];
                    $unitCost = (float) ($row['variant']?->cost_price ?? $row['product']->cost_price ?? 0);
                    $lineSubtotal = round($row['quantity'] * $row['unitPrice'], 2);
                    $lineDiscount = round((float) ($allocation['discount_total'] ?? 0), 2);
                    $lineGrand = round(max(0, $lineSubtotal - $lineDiscount), 2);
                    $cogsTotal = round($row['quantity'] * $unitCost, 2);
                    $lineProfit = round($lineGrand - $cogsTotal, 2);
                    $totalCogs += $cogsTotal;
                    $grossProfit += $lineProfit;

                    $item = OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $row['product']->id,
                        'variant_id' => $row['variant']?->id,
                        'category_id' => $row['product']->category_id,
                        'product_snapshot' => $row['product']->toArray(),
                        'quantity' => $row['quantity'],
                        'unit_price' => $row['unitPrice'],
                        'price_mode' => $priceMode,
                        'unit_cost' => $unitCost,
                        'line_subtotal' => $lineSubtotal,
                        'discount_amount' => $lineDiscount,
                        'line_discount_total' => $lineDiscount,
                        'line_tax_total' => 0,
                        'line_total' => $lineGrand,
                        'line_grand_total' => $lineGrand,
                        'discount_snapshot' => $allocation['discounts'] ?? [],
                        'cogs_total' => $cogsTotal,
                        'gross_profit' => $lineProfit,
                        'item_status' => $status,
                    ]);

                    if (! $reservePendingWebsiteOrder) {
                        $this->inventoryService->decrement($row['inventory'], $row['quantity'], $item, $actorId);
                    }
                }

                if ($reservePendingWebsiteOrder) {
                    ReserveInventoryAction::run($order->fresh('items'));
                }

                $order->update([
                    'total_cogs' => round($totalCogs, 2),
                    'gross_profit' => round($grossProfit, 2),
                ]);

                $this->promotionService->persistApplications($order, $quote, $customerId, $checkout['email'], $checkout['mobile_number']);

                $paymentStatus = $paidAmount >= (float) $order->grand_total && (float) $order->grand_total > 0
                    ? PaymentStatus::PAID->value
                    : ($paidAmount > 0 ? 'partial' : PaymentStatus::PENDING->value);
                $order->update(['payment_status' => $paymentStatus]);

                $paymentRowAmount = $paidAmount > 0
                    ? $paidAmount
                    : (($sourceChannel === 'website' && $paymentMethod !== 'cod') ? (float) $quote['grand_total'] : 0.0);
                if ($paymentRowAmount > 0) {
                    Payment::create([
                        'order_id' => $order->id,
                        'payment_method' => $paymentMethod,
                        'gateway' => $paymentMethod === 'cod' ? null : ($sourceChannel === 'website' ? 'sslcommerz' : ($data['gateway'] ?? 'sslcommerz')),
                        'amount' => round($paymentRowAmount, 2),
                        'currency' => $order->currency,
                        'status' => $paidAmount > 0 ? PaymentStatus::PAID->value : PaymentStatus::PENDING->value,
                        'paid_at' => $paidAmount > 0 ? ($data['order_date'] ?? now()) : null,
                        'received_by' => $actorId,
                        'payment_reference' => $data['payment_reference'] ?? ($sourceChannel === 'website' && $paymentMethod !== 'cod' ? $order->order_number : null),
                    ]);
                }

                if ($sourceChannel === 'pos' && $paymentStatus === PaymentStatus::PAID->value) {
                    // A sale is an operational fact first. Accounting is idempotent
                    // and AccountingOperationalBackfillSeeder backfills missed POS journals, so a
                    // temporary GL configuration problem must never roll back a
                    // successfully paid store sale or its stock movement.
                    try {
                        $this->accounting->postCompletedPosSale($order->fresh('items'));
                    } catch (\Throwable $exception) {
                        report($exception);
                    }
                }

                OrderStatusHistory::create([
                    'order_id' => $order->id,
                    'from_status' => null,
                    'to_status' => $status,
                    'changed_by' => $actorId,
                    'note' => 'Order placed from Bangladesh checkout',
                    'created_at' => now(),
                ]);

                $fresh = $order->fresh(['items.product', 'payments', 'statusHistory', 'couponApplications', 'reservedProducts']);
                $this->riskEngine->evaluateOrder($fresh);
                return $fresh->fresh(['items.product', 'payments', 'statusHistory', 'couponApplications', 'reservedProducts']);
            });
        } catch (QueryException $exception) {
            if ($idempotencyKey) {
                $existing = $this->findExistingWebsiteCheckout((string) $idempotencyKey, $customerId, $checkout['mobile_number']);
                if ($existing) {
                    return $existing;
                }
            }
            throw $exception;
        }
    }

    public function transition(Order $order, string $toStatus, ?int $actorId = null, ?string $note = null, bool $force = false): Order
    {
        return DB::transaction(function () use ($order, $toStatus, $actorId, $note, $force): Order {
            $from = $order->status ?: $order->order_status;
            if (! $force && ! in_array($toStatus, OrderStatus::allowedNext($from), true)) {
                throw new RuntimeException("Order cannot move from {$from} to {$toStatus}");
            }

            if ($toStatus === OrderStatus::CONFIRMED->value && $order->reservedProducts()->exists()) {
                CommitInventoryAction::run($order->fresh('items'));
                $order->refresh();
            }

            $timestamps = [];
            if ($toStatus === OrderStatus::CONFIRMED->value) $timestamps['confirmed_at'] = now();
            if ($toStatus === OrderStatus::SHIPPED->value) $timestamps['shipped_at'] = now();
            if ($toStatus === OrderStatus::DELIVERED->value) $timestamps['delivered_at'] = now();
            if ($toStatus === OrderStatus::CANCELLED->value) $timestamps['cancelled_at'] = now();

            $order->update(array_merge(['status' => $toStatus, 'order_status' => $toStatus], $timestamps));
            $order->items()->update(['item_status' => $toStatus]);
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'from_status' => $from,
                'to_status' => $toStatus,
                'changed_by' => $actorId,
                'note' => $note,
                'created_at' => now(),
            ]);
            return $order->fresh(['items.product', 'payments', 'statusHistory']);
        });
    }

    public function cancel(Order $order, ?int $actorId = null, ?string $reason = null): Order
    {
        if (in_array($order->status, [OrderStatus::DELIVERED->value, OrderStatus::CANCELLED->value], true)) {
            throw new RuntimeException('This order cannot be cancelled.');
        }

        return DB::transaction(function () use ($order, $actorId, $reason): Order {
            $order->loadMissing('items');
            if ($order->reservedProducts()->exists()) {
                ReleaseInventoryAction::run($order);
            } elseif ($order->status !== OrderStatus::PENDING->value || $order->payment_status === PaymentStatus::PAID->value) {
                foreach ($order->items as $item) {
                    $inventory = $this->inventoryService->inventoryRow($item->product_id, $item->variant_id, $order->shop_id);
                    $this->inventoryService->increment($inventory, $item->quantity, 'return', $item, $actorId);
                    $item->update([
                        'refunded_quantity' => $item->quantity,
                        'refunded_amount' => $item->line_grand_total ?: $item->line_total,
                    ]);
                }
                $order->update(['refund_total' => $order->grand_total]);
            }

            return $this->transition($order, OrderStatus::CANCELLED->value, $actorId, $reason, true);
        });
    }

    /**
     * Allocate an authorised manual discount proportionally across item lines.
     * Keeping the allocation at line level preserves correct profit and return values.
     */
    private function applyManualDiscount(array $quote, float $requested): array
    {
        $eligibleBase = max(0, (float) ($quote['net_subtotal'] ?? 0));
        $discount = round(min(max(0, $requested), $eligibleBase), 2);
        if ($discount <= 0 || empty($quote['line_allocations'])) {
            $quote['manual_discount_total'] = 0.0;
            return $quote;
        }

        $remaining = $discount;
        $keys = array_keys($quote['line_allocations']);
        $lastKey = end($keys);
        foreach ($quote['line_allocations'] as $key => &$line) {
            $lineBase = max(0, (float) ($line['line_grand_total'] ?? $line['remaining_subtotal'] ?? 0));
            $amount = $key === $lastKey
                ? $remaining
                : round($discount * ($lineBase / $eligibleBase), 2);
            $amount = min($amount, $lineBase, $remaining);
            $remaining = round(max(0, $remaining - $amount), 2);
            $line['discount_total'] = round((float) ($line['discount_total'] ?? 0) + $amount, 2);
            $line['remaining_subtotal'] = round(max(0, (float) ($line['remaining_subtotal'] ?? $lineBase) - $amount), 2);
            $line['line_grand_total'] = round(max(0, (float) ($line['line_subtotal'] ?? 0) - $line['discount_total']), 2);
            $line['line_total'] = $line['line_grand_total'];
            $line['discounts'][] = ['code' => 'MANUAL', 'amount' => $amount, 'type' => 'manual'];
        }
        unset($line);

        $quote['manual_discount_total'] = $discount;
        $quote['item_discount_total'] = round((float) ($quote['item_discount_total'] ?? 0) + $discount, 2);
        $quote['discount_total'] = round((float) ($quote['discount_total'] ?? 0) + $discount, 2);
        $quote['net_subtotal'] = round(max(0, (float) ($quote['net_subtotal'] ?? 0) - $discount), 2);
        $quote['grand_total'] = round(max(0, (float) ($quote['grand_total'] ?? 0) - $discount), 2);
        $quote['applied_promotions'][] = [
            'coupon_id' => null,
            'code' => 'MANUAL',
            'title' => 'Authorised manual discount',
            'promotion_type' => 'manual_discount',
            'visibility' => 'private',
            'discount_scope' => 'items',
            'type' => 'fixed',
            'value' => $discount,
            'base_amount' => $eligibleBase,
            'item_discount_amount' => $discount,
            'shipping_discount_amount' => 0,
            'discount_amount' => $discount,
        ];

        return $quote;
    }

    private function normalizeBangladeshCheckout(array $data): array
    {
        $billing = $data['billing_address'] ?? [];
        $shipping = $data['shipping_address'] ?? [];
        $shipDifferent = (bool) ($data['ship_to_different_address'] ?? false);

        $fullAddress = $data['checkout_full_address'] ?? $data['full_address'] ?? $billing['full_address'] ?? null;
        $upazilaThana = trim((string) ($data['upazila_thana'] ?? ''));
        if ($fullAddress && $upazilaThana !== '' && ! str_starts_with((string) $fullAddress, 'Upazila/Thana:')) {
            $fullAddress = "Upazila/Thana: {$upazilaThana}\n" . $fullAddress;
        }

        $billingSnapshot = [
            'name' => $data['checkout_name'] ?? $data['billing_name'] ?? $data['customer_name'] ?? $data['name'] ?? $billing['name'] ?? null,
            'country' => $data['checkout_country'] ?? $data['country'] ?? 'Bangladesh',
            'full_address' => $fullAddress,
            'district' => $data['checkout_district'] ?? $data['district'] ?? $billing['district'] ?? null,
            'mobile_number' => $data['checkout_mobile_number'] ?? $data['mobile_number'] ?? $data['phone'] ?? $billing['mobile_number'] ?? null,
            'email' => $data['checkout_email'] ?? $data['email'] ?? $billing['email'] ?? null,
        ];

        $shippingSnapshot = $shipDifferent ? [
            'name' => $shipping['name'] ?? $billingSnapshot['name'],
            'country' => $shipping['country'] ?? 'Bangladesh',
            'full_address' => $shipping['full_address'] ?? $billingSnapshot['full_address'],
            'district' => $shipping['district'] ?? $billingSnapshot['district'],
            'mobile_number' => $shipping['mobile_number'] ?? $billingSnapshot['mobile_number'],
            'email' => $shipping['email'] ?? $billingSnapshot['email'],
        ] : $billingSnapshot;

        return [
            'name' => $billingSnapshot['name'],
            'country' => $billingSnapshot['country'] ?: 'Bangladesh',
            'full_address' => $billingSnapshot['full_address'],
            'district' => $billingSnapshot['district'],
            'mobile_number' => $billingSnapshot['mobile_number'],
            'email' => $billingSnapshot['email'],
            'create_account_requested' => (bool) ($data['create_account'] ?? $data['create_account_requested'] ?? false),
            'ship_to_different_address' => $shipDifferent,
            'shipping_full_address' => $shippingSnapshot['full_address'],
            'shipping_district' => $shippingSnapshot['district'],
            'shipping_mobile_number' => $shippingSnapshot['mobile_number'],
            'shipping_email' => $shippingSnapshot['email'],
            'note' => $data['checkout_note'] ?? $data['customer_note'] ?? $data['note'] ?? null,
            'billing_snapshot' => $billingSnapshot,
            'shipping_snapshot' => $shippingSnapshot,
        ];
    }

    private function calculateDeliveryCharge(?string $district, float $subtotal): float
    {
        if (strcasecmp(trim((string) $district), 'Dhaka') === 0 && $subtotal >= 3000) {
            return 0.0;
        }

        return round((float) config('hajjmart.default_delivery_charge', 80), 2);
    }

    private function findExistingWebsiteCheckout(string $key, ?int $customerId, ?string $mobile): ?Order
    {
        $existing = Order::where('checkout_idempotency_key', $key)
            ->where('source_channel', 'website')
            ->first();
        if (! $existing) {
            return null;
        }

        $sameCustomer = $customerId !== null
            ? (int) $existing->customer_id === $customerId
            : $existing->customer_id === null && (string) $existing->checkout_mobile_number === (string) $mobile;
        if (! $sameCustomer) {
            throw new RuntimeException('This checkout idempotency key belongs to a different checkout context.');
        }

        return $existing->fresh(['items.product', 'payments', 'statusHistory', 'couponApplications', 'reservedProducts']);
    }

    private function nextOrderNumber(): string
    {
        return 'HM' . now()->format('Ymd') . random_int(1000, 9999);
    }
}
