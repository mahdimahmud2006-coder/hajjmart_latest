<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponApplication;
use App\Models\CouponUsage;
use App\Models\Order;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PromotionService
{
    /**
     * Build a checkout pricing quote from validated inventory rows.
     *
     * Public sales auto-apply. A checkout coupon is applied only when its code
     * is supplied. Promotions are item-only and a product line can receive at
     * most one promotion.
     */
    public function quote(array $validatedItems, array $checkoutData, ?int $customerId = null): array
    {
        $shippingOriginal = round((float) ($checkoutData['shipping_total'] ?? $checkoutData['delivery_charge'] ?? config('hajjmart.default_delivery_charge', 80)), 2);
        $tax = round((float) ($checkoutData['tax_total'] ?? 0), 2);
        $paymentMethod = strtolower((string) ($checkoutData['payment_method'] ?? 'cod'));
        $district = $checkoutData['checkout_district'] ?? $checkoutData['district'] ?? ($checkoutData['billing_address']['district'] ?? null);
        $guestEmail = strtolower((string) ($checkoutData['checkout_email'] ?? $checkoutData['email'] ?? ($checkoutData['billing_address']['email'] ?? '')));
        $guestPhone = (string) ($checkoutData['checkout_mobile_number'] ?? $checkoutData['mobile_number'] ?? $checkoutData['phone'] ?? ($checkoutData['billing_address']['mobile_number'] ?? ''));

        $lines = [];
        foreach ($validatedItems as $index => $row) {
            $key = $this->lineKey($row['product']->id, $row['variant']?->id);
            $subtotal = round((float) $row['quantity'] * (float) $row['unitPrice'], 2);
            $categoryIds = $row['product']->relationLoaded('categories')
                ? $row['product']->categories->pluck('id')->map(fn ($id) => (int) $id)->all()
                : $row['product']->categories()->pluck('categories.id')->map(fn ($id) => (int) $id)->all();
            if ($row['product']->category_id) {
                $categoryIds[] = (int) $row['product']->category_id;
            }

            $lines[$key] = [
                'key' => $key,
                'index' => $index,
                'product_id' => (int) $row['product']->id,
                'variant_id' => $row['variant']?->id,
                'category_ids' => array_values(array_unique($categoryIds)),
                'quantity' => (int) $row['quantity'],
                'unit_price' => round((float) $row['unitPrice'], 2),
                'line_subtotal' => $subtotal,
                'remaining_subtotal' => $subtotal,
                'discount_total' => 0.0,
                'discounts' => [],
            ];
        }

        $subtotal = round(array_sum(array_column($lines, 'line_subtotal')), 2);
        $couponCodes = $this->requestedCodes($checkoutData);
        $candidates = $this->candidateCoupons($couponCodes);
        $eligiblePromotions = collect();
        $rejected = [];

        foreach ($candidates as $coupon) {
            $eligibility = $this->validateEligibility($coupon, $subtotal, $validatedItems, $paymentMethod, $district, $customerId, $guestEmail, $guestPhone, $couponCodes);
            if (! $eligibility['ok']) {
                $rejected[] = ['code' => $coupon->code, 'reason' => $eligibility['reason']];
                continue;
            }
            $eligiblePromotions->push($coupon);
        }

        // One winner per product line. Every candidate is calculated from the
        // original unit price, never from another promotion's discounted price.
        $selected = [];
        foreach ($lines as $key => $line) {
            $matches = [];
            foreach ($eligiblePromotions as $coupon) {
                if (! $this->lineMatchesTarget($coupon, $line)) {
                    continue;
                }
                $raw = $this->rawLineDiscount($coupon, $line);

                // A promotion must leave a positive product price. Equal-to-
                // price and oversized discounts are invalid, never capped.
                if ($raw <= 0 || $raw >= (float) $line['line_subtotal'] - 0.00001) {
                    continue;
                }
                $matches[] = [
                    'coupon' => $coupon,
                    'raw' => $raw,
                    'amount' => round($raw, 2),
                ];
            }

            if (! $matches) {
                continue;
            }

            // Promotions never stack. Every candidate is calculated from the
            // original price; the single largest valid discount wins.
            usort($matches, function (array $a, array $b): int {
                $amount = $b['amount'] <=> $a['amount'];
                if ($amount !== 0) return $amount;
                return ((int) ($a['coupon']->priority ?? 100)) <=> ((int) ($b['coupon']->priority ?? 100));
            });
            $selected[$key] = $matches[0];
        }

        // Keep the legacy optional campaign cap without allowing stacking.
        $byPromotion = [];
        foreach ($selected as $key => $winner) {
            $byPromotion[$winner['coupon']->id][$key] = (float) $winner['amount'];
        }
        foreach ($byPromotion as $couponId => $allocations) {
            $coupon = $eligiblePromotions->firstWhere('id', $couponId);
            if (! $coupon || $coupon->max_discount_amount === null) continue;
            $cap = round(max(0, (float) $coupon->max_discount_amount), 2);
            $total = round(array_sum($allocations), 2);
            if ($total <= $cap) continue;
            $scaled = $this->capAllocations($allocations, $cap);
            foreach ($scaled as $key => $amount) {
                $selected[$key]['amount'] = $amount;
            }
        }

        $appliedByPromotion = [];
        foreach ($selected as $key => $winner) {
            $amount = round((float) $winner['amount'], 2);
            if ($amount <= 0) continue;
            /** @var Coupon $coupon */
            $coupon = $winner['coupon'];
            $lines[$key]['discount_total'] = $amount;
            $lines[$key]['remaining_subtotal'] = round($lines[$key]['line_subtotal'] - $amount, 2);
            $lines[$key]['discounts'] = [[
                'coupon_id' => $coupon->id,
                'code' => $coupon->code,
                'amount' => $amount,
                'type' => $coupon->type,
            ]];

            if (! isset($appliedByPromotion[$coupon->id])) {
                $appliedByPromotion[$coupon->id] = [
                    'coupon_id' => $coupon->id,
                    'code' => $coupon->code,
                    'title' => $coupon->title,
                    'promotion_type' => $coupon->promotion_type,
                    'visibility' => $coupon->visibility,
                    'discount_scope' => 'items',
                    'type' => strtolower((string) $coupon->type),
                    'value' => (float) $coupon->value,
                    'base_amount' => 0.0,
                    'item_discount_amount' => 0.0,
                    'shipping_discount_amount' => 0.0,
                    'discount_amount' => 0.0,
                ];
            }
            $appliedByPromotion[$coupon->id]['base_amount'] = round($appliedByPromotion[$coupon->id]['base_amount'] + $lines[$key]['line_subtotal'], 2);
            $appliedByPromotion[$coupon->id]['item_discount_amount'] = round($appliedByPromotion[$coupon->id]['item_discount_amount'] + $amount, 2);
            $appliedByPromotion[$coupon->id]['discount_amount'] = $appliedByPromotion[$coupon->id]['item_discount_amount'];
        }

        foreach ($eligiblePromotions as $coupon) {
            if ($coupon->promotion_type === 'coupon' && ! isset($appliedByPromotion[$coupon->id])) {
                $rejected[] = ['code' => $coupon->code, 'reason' => 'No eligible product amount is available, or a better promotion is already applied.'];
            }
        }

        $applied = array_values($appliedByPromotion);
        $itemDiscountTotal = round(array_sum(array_map(fn (array $line): float => (float) $line['discount_total'], $lines)), 2);
        $netSubtotal = round(max(0, $subtotal - $itemDiscountTotal), 2);
        $shippingTotal = $shippingOriginal;
        $grandTotal = round(max(0, $netSubtotal + $shippingTotal + $tax), 2);

        foreach ($lines as &$line) {
            $line['line_grand_total'] = round(max(0, $line['line_subtotal'] - $line['discount_total']), 2);
            $line['line_total'] = $line['line_grand_total'];
        }
        unset($line);

        return [
            'currency' => config('hajjmart.currency', 'BDT'),
            'subtotal' => $subtotal,
            'tax_total' => $tax,
            'shipping_original' => $shippingOriginal,
            'shipping_total' => $shippingTotal,
            'net_subtotal' => $netSubtotal,
            'item_discount_total' => $itemDiscountTotal,
            'shipping_discount_total' => 0.0,
            'discount_total' => $itemDiscountTotal,
            'grand_total' => $grandTotal,
            'coupon_codes' => array_values(array_unique(array_filter(array_map(fn ($row) => $row['code'] ?? null, $applied)))),
            'applied_promotions' => $applied,
            'rejected_promotions' => $rejected,
            'line_allocations' => $lines,
        ];
    }

    public function persistApplications(Order $order, array $quote, ?int $customerId = null, ?string $guestEmail = null, ?string $guestPhone = null): void
    {
        DB::transaction(function () use ($order, $quote, $customerId, $guestEmail, $guestPhone): void {
            foreach ($quote['applied_promotions'] as $application) {
                CouponApplication::create([
                    'order_id' => $order->id,
                    'coupon_id' => $application['coupon_id'] ?? null,
                    'code' => $application['code'] ?? null,
                    'promotion_type' => $application['promotion_type'] ?? null,
                    'visibility' => $application['visibility'] ?? null,
                    'discount_scope' => $application['discount_scope'] ?? null,
                    'base_amount' => $application['base_amount'] ?? 0,
                    'item_discount_amount' => $application['item_discount_amount'] ?? 0,
                    'shipping_discount_amount' => 0,
                    'discount_amount' => $application['discount_amount'] ?? 0,
                    'snapshot' => $application,
                ]);

                if (! empty($application['coupon_id'])) {
                    CouponUsage::create([
                        'coupon_id' => $application['coupon_id'],
                        'user_id' => $customerId,
                        'order_id' => $order->id,
                        'guest_email' => $guestEmail,
                        'guest_phone' => $guestPhone,
                        'discount_amount' => $application['discount_amount'] ?? 0,
                        'snapshot' => $application,
                        'created_at' => now(),
                    ]);
                    Coupon::whereKey($application['coupon_id'])->increment('used_count');
                }
            }
        });
    }

    public function publicPromotions(): Collection
    {
        return Coupon::active()
            ->where('promotion_type', 'public_sale')
            ->where('visibility', 'public')
            ->whereIn('type', ['fixed', 'percent'])
            ->where(function ($q): void {
                $q->whereNull('discount_scope')->orWhere('discount_scope', '!=', 'shipping');
            })
            ->orderBy('priority')
            ->orderByDesc('value')
            ->get();
    }

    private function candidateCoupons(array $requestedCodes): Collection
    {
        $requestedCodes = array_values(array_unique(array_map('strtoupper', $requestedCodes)));

        return Coupon::active()
            ->whereIn('type', ['fixed', 'percent'])
            ->where(function ($q): void {
                $q->whereNull('discount_scope')->orWhere('discount_scope', '!=', 'shipping');
            })
            ->where(function ($q) use ($requestedCodes): void {
                $q->where(function ($auto): void {
                    $auto->where('promotion_type', 'public_sale')
                        ->where('visibility', 'public')
                        ->where('auto_apply', true);
                });
                if ($requestedCodes) {
                    $q->orWhere(function ($coupon) use ($requestedCodes): void {
                        $coupon->where('promotion_type', 'coupon')->whereIn('code', $requestedCodes);
                    });
                }
            })
            ->orderByRaw("CASE WHEN promotion_type = 'public_sale' THEN 0 ELSE 1 END")
            ->orderBy('priority')
            ->orderByDesc('value')
            ->get()
            ->unique('id')
            ->values();
    }

    private function requestedCodes(array $data): array
    {
        $codes = [];
        if (! empty($data['coupon_code'])) {
            $codes[] = $data['coupon_code'];
        }
        foreach (($data['coupon_codes'] ?? []) as $code) {
            $codes[] = $code;
        }
        return array_values(array_filter(array_map(fn ($code): string => strtoupper(trim((string) $code)), $codes)));
    }

    private function validateEligibility(Coupon $coupon, float $subtotal, array $items, string $paymentMethod, ?string $district, ?int $customerId, string $guestEmail, string $guestPhone, array $requestedCodes): array
    {
        if ($coupon->promotion_type === 'coupon' && ! in_array(strtoupper((string) $coupon->code), $requestedCodes, true)) {
            return ['ok' => false, 'reason' => 'Coupon code is required at checkout.'];
        }
        if ($subtotal < (float) $coupon->min_order_amount) {
            return ['ok' => false, 'reason' => 'Minimum order amount has not been reached.'];
        }
        if ($coupon->minimum_items && collect($items)->sum('quantity') < $coupon->minimum_items) {
            return ['ok' => false, 'reason' => 'Minimum item quantity has not been reached.'];
        }
        if ($coupon->first_order_only && $customerId && Order::where('customer_id', $customerId)->exists()) {
            return ['ok' => false, 'reason' => 'Coupon is only valid on first order.'];
        }
        if ($coupon->per_customer_limit) {
            $usageQuery = CouponUsage::where('coupon_id', $coupon->id);
            if ($customerId) {
                $usageQuery->where('user_id', $customerId);
            } elseif ($guestEmail || $guestPhone) {
                $usageQuery->where(function ($q) use ($guestEmail, $guestPhone): void {
                    if ($guestEmail) $q->orWhere('guest_email', $guestEmail);
                    if ($guestPhone) $q->orWhere('guest_phone', $guestPhone);
                });
            }
            if ($usageQuery->count() >= $coupon->per_customer_limit) {
                return ['ok' => false, 'reason' => 'Coupon usage limit reached for this customer.'];
            }
        }
        return ['ok' => true, 'reason' => null];
    }

    private function lineMatchesTarget(Coupon $coupon, array $line): bool
    {
        $target = $coupon->applicable_to ?: 'all';
        if ($target === 'product') {
            return in_array((int) $line['product_id'], array_map('intval', $coupon->included_product_ids ?? []), true);
        }
        if ($target === 'category') {
            return (bool) array_intersect(
                array_map('intval', $coupon->included_category_ids ?? []),
                array_map('intval', $line['category_ids'] ?? []),
            );
        }
        return (float) $line['line_subtotal'] > 0;
    }

    private function rawLineDiscount(Coupon $coupon, array $line): float
    {
        $value = max(0, (float) $coupon->value);
        if (strtolower((string) $coupon->type) === 'percent') {
            return round((float) $line['line_subtotal'] * ($value / 100), 2);
        }
        return round($value * (int) $line['quantity'], 2);
    }

    private function capAllocations(array $allocations, float $cap): array
    {
        $total = round(array_sum($allocations), 2);
        if ($cap <= 0 || $total <= 0) {
            return array_fill_keys(array_keys($allocations), 0.0);
        }
        if ($total <= $cap) {
            return $allocations;
        }

        $scaled = [];
        $allocated = 0.0;
        $keys = array_keys($allocations);
        foreach ($keys as $index => $key) {
            if ($index === count($keys) - 1) {
                $amount = round($cap - $allocated, 2);
            } else {
                $amount = round($cap * ((float) $allocations[$key] / $total), 2);
                $allocated += $amount;
            }
            $scaled[$key] = round(max(0, min($amount, (float) $allocations[$key])), 2);
        }
        return $scaled;
    }

    public function lineKey(int $productId, ?int $variantId): string
    {
        return $productId . ':' . ($variantId ?: '0');
    }
}
