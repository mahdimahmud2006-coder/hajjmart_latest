<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ReturnRequest;
use App\Models\ReturnRequestItem;
use App\Models\ReturnStatusHistory;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ReturnService
{
    public function __construct(private InventoryService $inventoryService) {}

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
                'status' => 'requested',
                'reason' => $data['reason'] ?? null,
                'customer_note' => $data['customer_note'] ?? null,
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
                } else {
                    $refundTotal += $refundable;
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

            $order->update(['status' => OrderStatus::RETURN_REQUESTED->value, 'order_status' => OrderStatus::RETURN_REQUESTED->value]);
            ReturnStatusHistory::create(['return_request_id' => $return->id, 'to_status' => 'requested', 'changed_by' => $actorId ?? $customerId, 'created_at' => now()]);
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
                    $this->inventoryService->increment($inventory, (int) $item->quantity, 'return', $item, $actorId);
                }

                if ($returnRequest->type === 'exchange') {
                    if (! $item->exchange_product_id) {
                        throw new RuntimeException('Exchange product is required.');
                    }
                    $replacementInventory = $this->inventoryService->inventoryRow((int) $item->exchange_product_id, $item->exchange_variant_id ? (int) $item->exchange_variant_id : null, $returnRequest->shop_id ?? $returnRequest->order?->shop_id);
                    $this->inventoryService->decrement($replacementInventory, (int) $item->quantity, $item, $actorId);
                    $orderItem->increment('exchanged_quantity', (int) $item->quantity);
                } else {
                    $orderItem->increment('refunded_quantity', (int) $item->quantity);
                    $orderItem->increment('refunded_amount', (float) $item->refundable_amount);
                }
            }

            $returnRequest->update([
                'status' => $returnRequest->type === 'exchange' ? 'exchanged' : 'received',
                'resolved_at' => now(),
            ]);
            $returnRequest->order?->increment('refund_total', (float) $returnRequest->refund_total);
            $returnRequest->order?->increment('exchange_due_total', (float) $returnRequest->exchange_due_total);
            ReturnStatusHistory::create([
                'return_request_id' => $returnRequest->id,
                'from_status' => $fromStatus,
                'to_status' => $returnRequest->status,
                'changed_by' => $actorId,
                'note' => $note,
                'created_at' => now(),
            ]);
            return $returnRequest->fresh(['items.orderItem.product', 'order']);
        });
    }

    public function complete(ReturnRequest $returnRequest, ?int $actorId = null, ?string $note = null, array $details = []): ReturnRequest
    {
        if (! in_array($returnRequest->status, ['received', 'exchanged'], true)) {
            throw new RuntimeException('Only received returns or issued exchanges can be completed.');
        }
        return $this->transition($returnRequest, 'completed', $actorId, $note, array_merge([
            'resolved_at' => now(),
            'admin_note' => $note,
        ], $details));
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
            return $returnRequest->fresh(['items.orderItem.product', 'order']);
        });
    }

    private function exchangeUnitPrice(?int $productId, ?int $variantId): float
    {
        if (! $productId) {
            throw new RuntimeException('Exchange product is required for exchange requests.');
        }
        $product = Product::findOrFail($productId);
        $variant = $variantId ? ProductVariant::findOrFail($variantId) : null;
        return round((float) ($variant?->sale_price ?? $variant?->price ?? $product->selling_price ?? 0), 2);
    }
}
