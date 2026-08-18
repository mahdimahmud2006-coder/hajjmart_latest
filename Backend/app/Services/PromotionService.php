<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponApplication;
use App\Models\CouponUsage;
use App\Models\Order;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PromotionService
{
    /**
     * Build a full pricing quote from validated inventory rows.
     *
     * Supports:
     * - public sale promotions through auto_apply/public coupons
     * - private coupons through supplied coupon_code/coupon_codes
     * - compound coupons when stackable=true
     * - fixed, percent and free_shipping/shipping discounts
     * - line-level discount allocation for correct return/exchange refunds
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
            $lines[$key] = [
                'key' => $key,
                'index' => $index,
                'product_id' => (int) $row['product']->id,
                'variant_id' => $row['variant']?->id,
                'category_id' => $row['product']->category_id ? (int) $row['product']->category_id : null,
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
        $coupons = $this->candidateCoupons($couponCodes);

        $applied = [];
        $rejected = [];
        $shippingRemaining = $shippingOriginal;
        $shippingDiscountTotal = 0.0;
        $hasNonStackable = false;

        foreach ($coupons as $coupon) {
            if ($hasNonStackable && ! $coupon->stackable) {
                $rejected[] = ['code' => $coupon->code, 'reason' => 'Another non-stackable coupon is already applied.'];
                continue;
            }

            $eligibility = $this->validateEligibility($coupon, $subtotal, $validatedItems, $paymentMethod, $district, $customerId, $guestEmail, $guestPhone, $couponCodes);
            if (! $eligibility['ok']) {
                $rejected[] = ['code' => $coupon->code, 'reason' => $eligibility['reason']];
                continue;
            }

            $scope = $coupon->discount_scope ?: 'items';
            $type = strtolower((string) $coupon->type);
            $application = [
                'coupon_id' => $coupon->id,
                'code' => $coupon->code,
                'title' => $coupon->title,
                'promotion_type' => $coupon->promotion_type,
                'visibility' => $coupon->visibility,
                'discount_scope' => $scope,
                'type' => $type,
                'value' => (float) $coupon->value,
                'base_amount' => 0.0,
                'item_discount_amount' => 0.0,
                'shipping_discount_amount' => 0.0,
                'discount_amount' => 0.0,
            ];

            if ($scope === 'shipping' || $type === 'free_shipping') {
                $base = $shippingRemaining;
                $discount = $this->computeDiscount($coupon, $base);
                $discount = min($discount, $shippingRemaining);
                if ($discount <= 0) {
                    $rejected[] = ['code' => $coupon->code, 'reason' => 'No shipping amount left to discount.'];
                    continue;
                }
                $shippingRemaining = round($shippingRemaining - $discount, 2);
                $shippingDiscountTotal = round($shippingDiscountTotal + $discount, 2);
                $application['base_amount'] = round($base, 2);
                $application['shipping_discount_amount'] = round($discount, 2);
                $application['discount_amount'] = round($discount, 2);
            } else {
                $eligibleKeys = array_values(array_filter(array_keys($lines), fn (string $key): bool => $this->lineEligible($coupon, $lines[$key])));
                $eligibleBase = round(array_sum(array_map(fn (string $key): float => (float) $lines[$key]['remaining_subtotal'], $eligibleKeys)), 2);
                $discount = $this->computeDiscount($coupon, $eligibleBase);
                $discount = min($discount, $eligibleBase);
                if ($discount <= 0 || $eligibleBase <= 0) {
                    $rejected[] = ['code' => $coupon->code, 'reason' => 'No eligible item amount left to discount.'];
                    continue;
                }

                $allocations = $this->allocateDiscount($discount, $eligibleKeys, $lines);
                foreach ($allocations as $key => $amount) {
                    $lines[$key]['discount_total'] = round($lines[$key]['discount_total'] + $amount, 2);
                    $lines[$key]['remaining_subtotal'] = round(max(0, $lines[$key]['remaining_subtotal'] - $amount), 2);
                    $lines[$key]['discounts'][] = [
                        'coupon_id' => $coupon->id,
                        'code' => $coupon->code,
                        'amount' => round($amount, 2),
                    ];
                }
                $application['base_amount'] = round($eligibleBase, 2);
                $application['item_discount_amount'] = round(array_sum($allocations), 2);
                $application['discount_amount'] = $application['item_discount_amount'];
            }

            $applied[] = $application;
            if (! $coupon->stackable) {
                $hasNonStackable = true;
            }
            if ($coupon->stop_further_promotions) {
                break;
            }
        }

        $itemDiscountTotal = round(array_sum(array_map(fn (array $line): float => (float) $line['discount_total'], $lines)), 2);
        $discountTotal = round($itemDiscountTotal + $shippingDiscountTotal, 2);
        $netSubtotal = round(max(0, $subtotal - $itemDiscountTotal), 2);
        $shippingTotal = round(max(0, $shippingOriginal - $shippingDiscountTotal), 2);
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
            'shipping_discount_total' => $shippingDiscountTotal,
            'discount_total' => $discountTotal,
            'grand_total' => $grandTotal,
            'coupon_codes' => array_values(array_unique(array_filter(array_map(fn ($row) => $row['code'] ?? null, $applied)))),
            'applied_promotions' => $applied,
            'rejected_promotions' => $rejected,
            'line_allocations' => $lines,
        ];
    }

    public function validateCouponForCart(string $code, array $validatedItems, array $checkoutData, ?int $customerId = null): array
    {
        $checkoutData['coupon_code'] = $code;
        $quote = $this->quote($validatedItems, $checkoutData, $customerId);
        $applied = collect($quote['applied_promotions'])->firstWhere('code', strtoupper(trim($code)));
        if (! $applied) {
            throw new RuntimeException($quote['rejected_promotions'][0]['reason'] ?? 'Coupon is not valid for this cart.');
        }
        return $quote;
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
                    'shipping_discount_amount' => $application['shipping_discount_amount'] ?? 0,
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
            ->where('visibility', 'public')
            ->orderBy('priority')
            ->orderByDesc('value')
            ->get();
    }

    private function candidateCoupons(array $requestedCodes): Collection
    {
        $requestedCodes = array_values(array_unique(array_map('strtoupper', $requestedCodes)));

        return Coupon::active()
            ->where(function ($q) use ($requestedCodes): void {
                $q->where(function ($auto): void {
                    $auto->where('visibility', 'public')->where('auto_apply', true);
                });
                if ($requestedCodes) {
                    $q->orWhereIn('code', $requestedCodes);
                }
            })
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
        if ($coupon->visibility === 'private' && ! in_array(strtoupper($coupon->code), $requestedCodes, true)) {
            return ['ok' => false, 'reason' => 'Private coupon code is required.'];
        }
        if ($subtotal < (float) $coupon->min_order_amount) {
            return ['ok' => false, 'reason' => 'Minimum order amount has not been reached.'];
        }
        if ($coupon->minimum_items && collect($items)->sum('quantity') < $coupon->minimum_items) {
            return ['ok' => false, 'reason' => 'Minimum item quantity has not been reached.'];
        }
        if (! empty($coupon->payment_methods) && ! in_array($paymentMethod, array_map('strtolower', $coupon->payment_methods), true)) {
            return ['ok' => false, 'reason' => 'Coupon is not valid for this payment method.'];
        }
        if (! empty($coupon->included_districts) && $district && ! in_array($district, $coupon->included_districts, true)) {
            return ['ok' => false, 'reason' => 'Coupon is not valid for this district.'];
        }
        if (! empty($coupon->excluded_districts) && $district && in_array($district, $coupon->excluded_districts, true)) {
            return ['ok' => false, 'reason' => 'Coupon is excluded for this district.'];
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

    private function lineEligible(Coupon $coupon, array $line): bool
    {
        if (! empty($coupon->included_product_ids) && ! in_array($line['product_id'], array_map('intval', $coupon->included_product_ids), true)) {
            return false;
        }
        if (! empty($coupon->excluded_product_ids) && in_array($line['product_id'], array_map('intval', $coupon->excluded_product_ids), true)) {
            return false;
        }
        if (! empty($coupon->included_category_ids) && ! in_array((int) $line['category_id'], array_map('intval', $coupon->included_category_ids), true)) {
            return false;
        }
        if (! empty($coupon->excluded_category_ids) && in_array((int) $line['category_id'], array_map('intval', $coupon->excluded_category_ids), true)) {
            return false;
        }

        return (float) $line['remaining_subtotal'] > 0;
    }

    private function computeDiscount(Coupon $coupon, float $base): float
    {
        $base = max(0, $base);
        $type = strtolower((string) $coupon->type);
        $value = (float) $coupon->value;

        $discount = match ($type) {
            'percent' => round($base * ($value / 100), 2),
            'free_shipping' => $base,
            default => min($base, round($value, 2)),
        };

        if ($coupon->max_discount_amount !== null) {
            $discount = min($discount, (float) $coupon->max_discount_amount);
        }

        return round(max(0, min($discount, $base)), 2);
    }

    private function allocateDiscount(float $discount, array $eligibleKeys, array $lines): array
    {
        $base = round(array_sum(array_map(fn (string $key): float => (float) $lines[$key]['remaining_subtotal'], $eligibleKeys)), 2);
        if ($base <= 0 || $discount <= 0) {
            return [];
        }

        $allocations = [];
        $allocated = 0.0;
        foreach ($eligibleKeys as $i => $key) {
            if ($i === count($eligibleKeys) - 1) {
                $amount = round($discount - $allocated, 2);
            } else {
                $amount = round($discount * ((float) $lines[$key]['remaining_subtotal'] / $base), 2);
                $allocated += $amount;
            }
            $allocations[$key] = min($amount, (float) $lines[$key]['remaining_subtotal']);
        }

        return $allocations;
    }

    public function lineKey(int $productId, ?int $variantId): string
    {
        return $productId . ':' . ($variantId ?: '0');
    }
}
