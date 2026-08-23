<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Services\InventoryService;
use App\Services\PromotionService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CouponController extends Controller
{
    use ApiResponse;

    public function __construct(
        private PromotionService $promotions,
        private InventoryService $inventory
    ) {}

    public function publicPromotions()
    {
        return $this->success($this->promotions->publicPromotions(), 'Public promotions retrieved.');
    }

    public function validateCoupon(Request $request)
    {
        $data = $request->validate([
            'coupon_code' => ['required', 'string', 'max:100'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'payment_method' => ['nullable', 'string'],
            'district' => ['nullable', 'string'],
            'email' => ['nullable', 'email'],
            'mobile_number' => ['nullable', 'string'],
            'shipping_total' => ['nullable', 'numeric', 'min:0'],
        ]);

        $validatedItems = $this->inventory->validateItems($data['items']);
        $quote = $this->promotions->validateCouponForCart($data['coupon_code'], $validatedItems, $data, $request->user()?->id);
        return $this->success($quote, 'Coupon applied successfully.');
    }

    public function index(Request $request)
    {
        $coupons = Coupon::query()
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
        $type = $data['promotion_type'] ?? $coupon?->promotion_type ?? 'coupon';
        if ($type === 'public_sale') {
            $data['code'] = null;
            $data['visibility'] = 'public';
            if (! array_key_exists('auto_apply', $data)) {
                $data['auto_apply'] = true;
            }
        } elseif (array_key_exists('code', $data) && $data['code'] !== null) {
            $data['code'] = strtoupper(trim((string) $data['code']));
            $data['visibility'] = $data['visibility'] ?? 'private';
            $data['auto_apply'] = $data['auto_apply'] ?? false;
        }

        if (($data['type'] ?? $coupon?->type) === 'free_shipping') {
            $data['value'] = 0;
            $data['discount_scope'] = 'shipping';
        }

        return $data;
    }

    private function validatedCoupon(Request $request, ?int $ignoreId = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        $type = (string) ($request->input('promotion_type') ?: ($partial && $ignoreId ? Coupon::whereKey($ignoreId)->value('promotion_type') : 'coupon'));
        return $request->validate([
            'code' => [Rule::requiredIf($type !== 'public_sale'), 'nullable', 'string', 'max:100', Rule::unique('coupons', 'code')->ignore($ignoreId)],
            'title' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'type' => [$required, Rule::in(['fixed', 'percent', 'free_shipping'])],
            'value' => [$required, 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'max_discount_amount' => ['nullable', 'numeric', 'min:0'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'per_customer_limit' => ['nullable', 'integer', 'min:1'],
            'used_count' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'applicable_to' => ['nullable', 'string', Rule::in(['all', 'product', 'category', 'district', 'payment_method'])],
            'visibility' => ['nullable', Rule::in(['public', 'private'])],
            'promotion_type' => ['nullable', Rule::in(['coupon', 'public_sale', 'private_coupon'])],
            'discount_scope' => ['nullable', Rule::in(['items', 'cart', 'shipping'])],
            'stackable' => ['nullable', 'boolean'],
            'auto_apply' => ['nullable', 'boolean'],
            'priority' => ['nullable', 'integer', 'min:0'],
            'minimum_items' => ['nullable', 'integer', 'min:1'],
            'first_order_only' => ['nullable', 'boolean'],
            'stop_further_promotions' => ['nullable', 'boolean'],
            'included_product_ids' => ['nullable', 'array'],
            'included_product_ids.*' => ['integer', 'exists:products,id'],
            'excluded_product_ids' => ['nullable', 'array'],
            'excluded_product_ids.*' => ['integer', 'exists:products,id'],
            'included_category_ids' => ['nullable', 'array'],
            'included_category_ids.*' => ['integer', 'exists:categories,id'],
            'excluded_category_ids' => ['nullable', 'array'],
            'excluded_category_ids.*' => ['integer', 'exists:categories,id'],
            'included_districts' => ['nullable', 'array'],
            'included_districts.*' => ['string'],
            'excluded_districts' => ['nullable', 'array'],
            'excluded_districts.*' => ['string'],
            'payment_methods' => ['nullable', 'array'],
            'payment_methods.*' => ['string', Rule::in(['cod', 'online'])],
            'customer_segments' => ['nullable', 'array'],
        ]);
    }
}
