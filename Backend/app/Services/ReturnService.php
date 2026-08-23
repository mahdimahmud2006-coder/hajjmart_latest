<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Payment;
use App\Models\ReturnRequest;
use App\Models\ReturnRequestItem;
use App\Models\ReturnStatusHistory;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ReturnService
{
    public function __construct(private InventoryService $inventoryService, private PaymentService $paymentService) {}

    public function request(Order $order, array $data, ?int $customerId = null, ?int $actorId = null): ReturnRequest
    {
        return DB::transaction(function () use ($order, $data, $customerId, $actorId): ReturnRequest {
            $type = $data['type'] ?? 'return';
            if (! in_array($type, ['return', 'exchange'], true)) {
                throw new RuntimeException('Return request type must be return or exchange.');
            }

            $return = ReturnRequest::create([
                'rr_number' => 'RR-' . now()->format('YmdHis') . random_int(10, 99),
                'order_id' => $order->id,
                'customer_id' => $customerId ?? $order->customer_id,
                'shop_id' => $order->shop_id,
                'created_by' => $actorId ?? $customerId,
                'type' => $type,
                'status' => 'completed',
                'resolution_type' => $type === 'exchange' ? 'exchange' : 'refund',
                'refund_method' => 'instant_settlement',
                'reason' => $data['reason'] ?? null,
                'customer_note' => $data['customer_note'] ?? null,
                'approved_by' => $actorId,
                'approved_at' => now(),
                'resolved_at' => now(),
            ]);

            $refundTotal = 0.0;
            $creditTotal = 0.0;
            $dueTotal = 0.0;
            $promotionAdjustment = 0.0;

            foreach (($data['items'] ?? []) as $itemData) {
                $orderItem = $order->items()->whereKey($itemData['order_item_id'])->firstOrFail();
                $quantity = (int) $itemData['quantity'];
                if ($quantity < 1 || $quantity > $orderItem->remaining_returnable_quantity) {
                    throw new RuntimeException('Return/exchange quantity exceeds remaining returnable quantity.');
                }

                // 1. Restock the returned item back into store inventory immediately
                $inventory = $this->inventoryService->inventoryRow(
                    $orderItem->product_id,
                    $orderItem->variant_id,
                    $order->shop_id
                );
                $this->inventoryService->increment(
                    $inventory,
                    $quantity,
                    'return',
                    $return,
                    $actorId,
                    'customer_return',
                    (float) $orderItem->unit_cost
                );

                $lineSubtotal = round((float) $orderItem->unit_price * $quantity, 2);
                $discountPerUnit = ((float) $orderItem->line_discount_total) / max(1, (int) $orderItem->quantity);
                $proratedDiscount = round($discountPerUnit * $quantity, 2);
                $refundable = round(max(0, $lineSubtotal - $proratedDiscount), 2);

                $exchangeUnitPrice = 0.0;
                $exchangeLineTotal = 0.0;
                $exchangeDue = 0.0;
                $exchangeRefund = 0.0;

                if ($type === 'exchange') {
                    $exchangeUnitPrice = $this->exchangeUnitPrice($itemData['exchange_product_id'] ?? null, $itemData['exchange_variant_id'] ?? null);
                    $exchangeLineTotal = round($exchangeUnitPrice * $quantity, 2);
                    $exchangeDue = round(max(0, $exchangeLineTotal - $refundable), 2);
                    $exchangeRefund = round(max(0, $refundable - $exchangeLineTotal), 2);
                    $creditTotal += $refundable;
                    $dueTotal += $exchangeDue;
                    $refundTotal += $exchangeRefund;

                    // Deduct replacement product stock immediately
                    if (! empty($itemData['exchange_product_id'])) {
                        $replacementInventory = $this->inventoryService->inventoryRow(
                            (int) $itemData['exchange_product_id'],
                            ! empty($itemData['exchange_variant_id']) ? (int) $itemData['exchange_variant_id'] : null,
                            $order->shop_id
                        );
                        $avail = $replacementInventory->quantity - $replacementInventory->reserved;
                        if ($avail < $quantity) {
                            $needed = $quantity - $avail;
                            $this->inventoryService->increment(
                                $replacementInventory,
                                $needed,
                                'exchange_stock_sync',
                                $return,
                                $actorId,
                                'exchange_auto_replenish'
                            );
                            $replacementInventory->refresh();
                        }
                        $this->inventoryService->decrement($replacementInventory, $quantity, $return, $actorId);
                    }
                    $orderItem->increment('exchanged_quantity', $quantity);
                } else {
                    $refundTotal += $refundable;
                    $orderItem->increment('refunded_quantity', $quantity);
                    $orderItem->increment('refunded_amount', $refundable);
                }
                $promotionAdjustment += $proratedDiscount;

                ReturnRequestItem::create([
                    'return_request_id' => $return->id,
                    'order_item_id' => $orderItem->id,
                    'quantity' => $quantity,
                    'reason' => $itemData['reason'] ?? null,
                    'condition_note' => $itemData['condition_note'] ?? null,
                    'exchange_product_id' => $itemData['exchange_product_id'] ?? null,
                    'exchange_variant_id' => $itemData['exchange_variant_id'] ?? null,
                    'unit_price' => $orderItem->unit_price,
                    'line_subtotal' => $lineSubtotal,
                    'prorated_discount_amount' => $proratedDiscount,
                    'refundable_amount' => $refundable,
                    'exchange_unit_price' => $exchangeUnitPrice,
                    'exchange_line_total' => $exchangeLineTotal,
                    'exchange_price_difference' => round($exchangeLineTotal - $refundable, 2),
                    'exchange_amount_due' => $exchangeDue,
                    'exchange_refund_due' => $exchangeRefund,
                ]);
            }

            $return->update([
                'refund_total' => round($refundTotal, 2),
                'exchange_credit_total' => round($creditTotal, 2),
                'exchange_due_total' => round($dueTotal, 2),
                'promotion_adjustment_total' => round($promotionAdjustment, 2),
            ]);

            // If replacement items cost more than returned items credit, increase order grand_total by the net excess
            $exchangeExcess = $type === 'exchange' ? round($dueTotal, 2) : 0.0;
            if ($exchangeExcess > 0) {
                $order->increment('grand_total', $exchangeExcess);
                $paidInput = min($exchangeExcess, (float) ($data['paid_amount'] ?? 0));
                if ($paidInput > 0) {
                    Payment::create([
                        'order_id' => $order->id,
                        'payment_method' => strtolower((string) ($data['payment_method'] ?? 'cash')),
                        'amount' => $paidInput,
                        'currency' => $order->currency ?: 'BDT',
                        'status' => 'paid',
                        'paid_at' => now(),
                        'received_by' => $actorId,
                        'payment_reference' => $data['payment_reference'] ?? 'Exchange advance payment',
                    ]);
                    $order->increment('paid_amount', $paidInput);
                }
            }

            $order->refresh();
            $newRefundTotal = round((float) $order->refund_total + ($type === 'return' ? $refundTotal : ($refundTotal > 0 ? $refundTotal : 0)), 2);
            $netGrandTotal = round(max(0, (float) $order->grand_total - $newRefundTotal), 2);
            $paidAmount = (float) $order->paid_amount;
            $newDueAmount = round(max(0, $netGrandTotal - $paidAmount), 2);
            $newPaymentStatus = PaymentStatus::forOrder($paidAmount, $netGrandTotal);

            $allReturned = $order->fresh('items')->items->every(fn ($item) => $item->remaining_returnable_quantity <= 0);

            $order->update([
                'status' => $allReturned ? OrderStatus::RETURNED->value : $order->status,
                'order_status' => $allReturned ? OrderStatus::RETURNED->value : $order->status,
                'refund_total' => $newRefundTotal,
                'due_amount' => $newDueAmount,
                'payment_status' => $newPaymentStatus,
            ]);

            ReturnStatusHistory::create(['return_request_id' => $return->id, 'to_status' => 'completed', 'changed_by' => $actorId ?? $customerId, 'note' => 'Instant return/exchange recorded.', 'created_at' => now()]);
            return $return->fresh(['items.orderItem.product', 'items.exchangeProduct', 'items.exchangeVariant']);
        });
    }

    public function approve(ReturnRequest $returnRequest, ?int $actorId = null, ?string $note = null): ReturnRequest
    {
        return $this->transition($returnRequest, 'approved', $actorId, $note, [
            'approved_by' => $actorId,
            'approved_at' => now(),
        ]);
    }

    public function reject(ReturnRequest $returnRequest, ?int $actorId = null, ?string $note = null): ReturnRequest
    {
        return $this->transition($returnRequest, 'rejected', $actorId, $note, ['resolved_at' => now()]);
    }

    public function receive(ReturnRequest $returnRequest, ?int $actorId = null, bool $restockReturnedItems = true, ?string $note = null): ReturnRequest
    {
        return DB::transaction(function () use ($returnRequest, $actorId, $restockReturnedItems, $note): ReturnRequest {
            $fromStatus = $returnRequest->status;
            if (! in_array($returnRequest->status, ['approved', 'requested', 'pending'], true)) {
                throw new RuntimeException('Only pending or approved return/exchange requests can be received.');
            }

            foreach ($returnRequest->items()->with('orderItem')->get() as $item) {
                $orderItem = $item->orderItem;
                if ($restockReturnedItems) {
                    $inventory = $this->inventoryService->inventoryRow($orderItem->product_id, $orderItem->variant_id, $returnRequest->shop_id ?? $returnRequest->order?->shop_id);
                    $this->inventoryService->increment(
                        $inventory,
                        (int) $item->quantity,
                        'return',
                        $item,
                        $actorId,
                        'customer_return',
                        (float) $orderItem->unit_cost,
                    );
                }

                if ($returnRequest->type === 'return') {
                    $orderItem->increment('refunded_quantity', (int) $item->quantity);
                    $orderItem->increment('refunded_amount', (float) $item->refundable_amount);
                }
            }

            $returnRequest->update([
                'status' => 'received',
                'resolved_at' => null,
            ]);
            ReturnStatusHistory::create([
                'return_request_id' => $returnRequest->id,
                'from_status' => $fromStatus,
                'to_status' => $returnRequest->status,
                'changed_by' => $actorId,
                'note' => $note,
                'created_at' => now(),
            ]);
            return $returnRequest->fresh(['order.shop', 'order.payments.receiver', 'items.orderItem.product', 'items.orderItem.variant', 'items.exchangeProduct', 'items.exchangeVariant', 'statusHistory']);
        });
    }

    public function complete(ReturnRequest $returnRequest, ?int $actorId = null, ?string $note = null, array $details = []): ReturnRequest
    {
        if (! in_array($returnRequest->status, ['received', 'exchanged'], true)) {
            throw new RuntimeException('Only received returns or issued exchanges can be completed.');
        }

        return DB::transaction(function () use ($returnRequest, $actorId, $note, $details): ReturnRequest {
            if ($returnRequest->type === 'exchange' && $returnRequest->status === 'received') {
                foreach ($returnRequest->items()->with('orderItem')->get() as $item) {
                    if (! $item->exchange_product_id) {
                        throw new RuntimeException('Exchange product is required.');
                    }
                    $replacementInventory = $this->inventoryService->inventoryRow(
                        (int) $item->exchange_product_id,
                        $item->exchange_variant_id ? (int) $item->exchange_variant_id : null,
                        $returnRequest->shop_id ?? $returnRequest->order?->shop_id
                    );
                    $this->inventoryService->decrement($replacementInventory, (int) $item->quantity, $item, $actorId);
                    $item->orderItem->increment('exchanged_quantity', (int) $item->quantity);
                }
                $returnRequest->order?->increment('exchange_due_total', (float) $returnRequest->exchange_due_total);
            }

            return $this->transition($returnRequest, 'completed', $actorId, $note, array_merge([
                'resolved_at' => now(),
                'admin_note' => $note,
            ], $details));
        });
    }

    public function refund(ReturnRequest $returnRequest, ?int $actorId = null, ?int $preferredPaymentId = null, ?string $note = null): ReturnRequest
    {
        if ($returnRequest->type !== 'return' || $returnRequest->status !== 'received') {
            throw new RuntimeException('Only a received return can be refunded.');
        }

        $order = $returnRequest->order()->with('payments')->firstOrFail();
        $target = round((float) $returnRequest->refund_total, 2);
        if ($target <= 0) {
            return $this->complete($returnRequest, $actorId, $note, ['resolution_type' => 'refund', 'refund_method' => 'original_payment']);
        }

        $priorCompletedRefunds = (float) ReturnRequest::query()
            ->where('order_id', $order->id)
            ->where('id', '<>', $returnRequest->id)
            ->where('type', 'return')
            ->where('status', 'completed')
            ->where('resolution_type', 'refund')
            ->sum('refund_total');
        $actualRefunded = (float) $order->payments()->sum('refunded_amount');
        $alreadyForThisReturn = round(max(0, $actualRefunded - $priorCompletedRefunds), 2);
        $remaining = round(max(0, $target - $alreadyForThisReturn), 2);

        if ($remaining > 0) {
            $payments = $order->payments()
                ->whereIn('status', ['paid', 'partial', 'partially_refunded', 'refunded'])
                ->orderByDesc('paid_at')
                ->get()
                ->filter(fn (Payment $payment): bool => round((float) $payment->amount - (float) ($payment->refunded_amount ?? 0), 2) > 0)
                ->sortByDesc(fn (Payment $payment): int => $preferredPaymentId && $payment->id === $preferredPaymentId ? 1 : 0)
                ->values();

            $available = round($payments->sum(fn (Payment $payment): float => max(0, (float) $payment->amount - (float) ($payment->refunded_amount ?? 0))), 2);
            if ($available + 0.009 < $remaining) {
                throw new RuntimeException('The original payments do not have enough refundable balance for this return.');
            }

            foreach ($payments as $payment) {
                if ($remaining <= 0) break;
                $paymentRemaining = round(max(0, (float) $payment->amount - (float) ($payment->refunded_amount ?? 0)), 2);
                if ($paymentRemaining <= 0) continue;
                $amount = min($remaining, $paymentRemaining);
                $this->paymentService->refund($payment, $amount, $actorId);
                $remaining = round(max(0, $remaining - $amount), 2);
            }
        }

        if ($remaining > 0.009) {
            throw new RuntimeException('The refund is not complete yet. Retry after checking the original payments.');
        }

        return $this->complete($returnRequest->fresh(), $actorId, $note, [
            'resolution_type' => 'refund',
            'refund_method' => 'original_payment',
        ]);
    }

    private function transition(ReturnRequest $returnRequest, string $toStatus, ?int $actorId, ?string $note, array $extra = []): ReturnRequest
    {
        return DB::transaction(function () use ($returnRequest, $toStatus, $actorId, $note, $extra): ReturnRequest {
            $from = $returnRequest->status;
            $returnRequest->update(array_merge(['status' => $toStatus], $extra));
            ReturnStatusHistory::create([
                'return_request_id' => $returnRequest->id,
                'from_status' => $from,
                'to_status' => $toStatus,
                'changed_by' => $actorId,
                'note' => $note,
                'created_at' => now(),
            ]);
            return $returnRequest->fresh(['order.shop', 'order.payments.receiver', 'items.orderItem.product', 'items.orderItem.variant', 'items.exchangeProduct', 'items.exchangeVariant', 'statusHistory']);
        });
    }

    private function exchangeUnitPrice(?int $productId, ?int $variantId): float
    {
        if (! $productId) {
            return 0.0;
        }
        $product = Product::find($productId);
        if (! $product) {
            return 0.0;
        }
        $variant = $variantId ? ProductVariant::where('product_id', $product->id)->find($variantId) : null;
        return round((float) ($variant?->sale_price ?? $variant?->price ?? $product->selling_price ?? 0), 2);
    }
}
