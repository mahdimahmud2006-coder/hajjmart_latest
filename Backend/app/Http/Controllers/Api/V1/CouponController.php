<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CouponController extends Controller
{
    use ApiResponse;

    public function __construct(private \App\Services\PromotionService $promotions) {}

    public function publicPromotions()
    {
        return $this->success($this->promotions->publicPromotions(), 'Public promotions retrieved.');
    }

    public function index(Request $request)
    {
        $coupons = Coupon::query()
            ->whereIn('type', ['fixed', 'percent'])
            ->where(function ($q): void {
                $q->whereNull('discount_scope')->orWhere('discount_scope', '!=', 'shipping');
            })
            ->when($request->visibility, fn ($q, $visibility) => $q->where('visibility', $visibility))
            ->when($request->promotion_type, fn ($q, $type) => $q->where('promotion_type', $type))
            ->when($request->active !== null, fn ($q) => $q->where('is_active', filter_var(request('active'), FILTER_VALIDATE_BOOLEAN)))
            ->when(trim((string) $request->get('q', '')) !== '', function ($q) use ($request): void {
                $term = trim((string) $request->get('q'));
                $q->where(fn ($inner) => $inner->where('title', 'like', "%{$term}%")->orWhere('code', 'like', "%{$term}%"));
            })
            ->latest()
            ->paginate((int) $request->get('per_page', 20));

        return $this->success($coupons, 'Coupons retrieved.');
    }

    public function store(Request $request)
    {
        $data = $this->validatedCoupon($request);
        $data = $this->normalizePromotion($data, null);
        return $this->success(Coupon::create($data), 'Coupon/promotion created.', 201);
    }

    public function update(Request $request, Coupon $coupon)
    {
        $data = $this->validatedCoupon($request, $coupon->id, true);
        $data = $this->normalizePromotion($data, $coupon);
        $coupon->update($data);
        return $this->success($coupon->fresh(), 'Coupon/promotion updated.');
    }

    public function destroy(Coupon $coupon)
    {
        $coupon->delete();
        return $this->success(null, 'Coupon/promotion deleted.');
    }

    private function normalizePromotion(array $data, ?Coupon $coupon): array
    {
        $promotionType = $data['promotion_type'] ?? $coupon?->promotion_type ?? 'coupon';
        if ($promotionType === 'public_sale') {
            $data['code'] = null;
            $data['visibility'] = 'public';
            $data['auto_apply'] = true;
        } else {
            if (array_key_exists('code', $data) && $data['code'] !== null) {
                $data['code'] = strtoupper(trim((string) $data['code']));
            }
            $data['visibility'] = 'private';
            $data['auto_apply'] = false;
            $data['promotion_type'] = 'coupon';
        }

        // Promotions are item-only and never stack. Shipping always remains payable.
        $data['discount_scope'] = 'items';
        $data['stackable'] = false;
        $data['stop_further_promotions'] = false;

        $target = $data['applicable_to'] ?? $coupon?->applicable_to ?? 'all';
        $data['applicable_to'] = $target;
        if ($target === 'all') {
            $data['included_product_ids'] = null;
            $data['included_category_ids'] = null;
        } elseif ($target === 'product') {
            $data['included_category_ids'] = null;
        } elseif ($target === 'category') {
            $data['included_product_ids'] = null;
        }

        // Old exclusion/district/payment targeting is intentionally disabled for the simplified rules.
        $data['excluded_product_ids'] = null;
        $data['excluded_category_ids'] = null;
        $data['included_districts'] = null;
        $data['excluded_districts'] = null;
        $data['payment_methods'] = null;
        $data['customer_segments'] = null;

        return $data;
    }

    private function validatedCoupon(Request $request, ?int $ignoreId = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        $promotionType = (string) ($request->input('promotion_type') ?: ($partial && $ignoreId ? Coupon::whereKey($ignoreId)->value('promotion_type') : 'coupon'));
        $target = (string) $request->input('applicable_to', '');

        $codeRules = $partial
            ? ['sometimes', 'nullable', 'string', 'max:100', Rule::unique('coupons', 'code')->ignore($ignoreId)]
            : [Rule::requiredIf($promotionType !== 'public_sale'), 'nullable', 'string', 'max:100', Rule::unique('coupons', 'code')->ignore($ignoreId)];

        return $request->validate([
            'code' => $codeRules,
            'title' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'type' => [$required, Rule::in(['fixed', 'percent'])],
            'value' => [$required, 'numeric', 'gt:0', Rule::when($request->input('type') === 'percent', ['max:100'])],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'max_discount_amount' => ['nullable', 'numeric', 'min:0'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'per_customer_limit' => ['nullable', 'integer', 'min:1'],
            'used_count' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'applicable_to' => [$required, Rule::in(['all', 'product', 'category'])],
            'promotion_type' => ['nullable', Rule::in(['coupon', 'public_sale'])],
            'priority' => ['nullable', 'integer', 'min:0'],
            'minimum_items' => ['nullable', 'integer', 'min:1'],
            'first_order_only' => ['nullable', 'boolean'],
            'included_product_ids' => [Rule::requiredIf($target === 'product'), 'nullable', 'array', 'min:1'],
            'included_product_ids.*' => ['integer', 'exists:products,id'],
            'included_category_ids' => [Rule::requiredIf($target === 'category'), 'nullable', 'array', 'min:1'],
            'included_category_ids.*' => [
                'integer',
                Rule::exists('categories', 'id')->whereNotNull('parent_id'),
            ],
        ]);
    }
}
