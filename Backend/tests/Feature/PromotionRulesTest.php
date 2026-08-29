<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\Product;
use App\Services\PromotionService;
use App\Http\Controllers\Api\V1\CouponController;
use Illuminate\Http\Request;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PromotionRulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_promotions_target_products_or_subcategories_do_not_stack_and_never_discount_shipping(): void
    {
        $parent = Category::create(['name' => 'Travel', 'slug' => 'travel', 'is_active' => true]);
        $subcategory = Category::create(['parent_id' => $parent->id, 'name' => 'Neck Bags', 'slug' => 'neck-bags', 'is_active' => true]);

        $saleProduct = Product::factory()->create(['selling_price' => 500, 'retail_price' => 500]);
        $couponProduct = Product::factory()->create(['selling_price' => 200, 'retail_price' => 200]);
        $lowPriceProduct = Product::factory()->create(['selling_price' => 5, 'retail_price' => 5]);
        $saleProduct->categories()->attach($subcategory->id);

        Coupon::create([
            'code' => null,
            'title' => 'Bag sale',
            'type' => 'fixed',
            'value' => 100,
            'is_active' => true,
            'applicable_to' => 'category',
            'included_category_ids' => [$subcategory->id],
            'visibility' => 'public',
            'promotion_type' => 'public_sale',
            'discount_scope' => 'items',
            'stackable' => false,
            'auto_apply' => true,
            'priority' => 10,
        ]);

        Coupon::create([
            'code' => 'SAVE10',
            'title' => 'Checkout coupon',
            'type' => 'percent',
            'value' => 10,
            'is_active' => true,
            'applicable_to' => 'product',
            'included_product_ids' => [$saleProduct->id, $couponProduct->id, $lowPriceProduct->id],
            'visibility' => 'private',
            'promotion_type' => 'coupon',
            'discount_scope' => 'items',
            'stackable' => false,
            'auto_apply' => false,
            'priority' => 20,
        ]);

        // Legacy free-shipping rows must have no runtime effect even before cleanup migration data is removed.
        Coupon::create([
            'code' => 'OLDFREE',
            'title' => 'Old free shipping',
            'type' => 'free_shipping',
            'value' => 0,
            'is_active' => true,
            'applicable_to' => 'all',
            'visibility' => 'public',
            'promotion_type' => 'public_sale',
            'discount_scope' => 'shipping',
            'auto_apply' => true,
        ]);

        $items = [
            ['product' => $saleProduct->load('categories'), 'variant' => null, 'quantity' => 1, 'unitPrice' => 500],
            ['product' => $couponProduct->load('categories'), 'variant' => null, 'quantity' => 1, 'unitPrice' => 200],
            ['product' => $lowPriceProduct->load('categories'), 'variant' => null, 'quantity' => 1, 'unitPrice' => 5],
        ];

        $service = app(PromotionService::class);

        $withoutCoupon = $service->quote($items, ['shipping_total' => 80]);
        $this->assertSame(100.0, $withoutCoupon['discount_total']);
        $this->assertCount(1, $withoutCoupon['applied_promotions']);
        $this->assertSame('public_sale', $withoutCoupon['applied_promotions'][0]['promotion_type']);

        $quote = $service->quote($items, ['shipping_total' => 80, 'coupon_code' => 'SAVE10']);
        $saleLine = $quote['line_allocations'][$service->lineKey($saleProduct->id, null)];
        $couponLine = $quote['line_allocations'][$service->lineKey($couponProduct->id, null)];
        $lowPriceLine = $quote['line_allocations'][$service->lineKey($lowPriceProduct->id, null)];

        $this->assertSame(100.0, $saleLine['discount_total']);
        $this->assertCount(1, $saleLine['discounts'], 'A product must receive at most one promotion.');
        $this->assertSame(20.0, $couponLine['discount_total']);
        $this->assertSame(0.5, $lowPriceLine['discount_total'], 'A valid percentage discount may reduce a low-priced product as long as the price stays positive.');
        $this->assertSame(120.5, $quote['discount_total']);
        $this->assertSame(80.0, $quote['shipping_total']);
        $this->assertSame(0.0, $quote['shipping_discount_total']);
        $this->assertSame(664.5, $quote['grand_total']);
    }

    public function test_coupon_can_be_paused_with_status_only_update_and_deleted(): void
    {
        $coupon = Coupon::create([
            'code' => 'UMRAH101',
            'title' => 'Socks',
            'type' => 'percent',
            'value' => 10,
            'is_active' => true,
            'applicable_to' => 'all',
            'visibility' => 'private',
            'promotion_type' => 'coupon',
            'discount_scope' => 'items',
            'stackable' => false,
            'auto_apply' => false,
        ]);

        $controller = app(CouponController::class);
        $controller->update(Request::create('/coupons/'.$coupon->id, 'PUT', ['is_active' => false]), $coupon);
        $this->assertFalse((bool) $coupon->fresh()->is_active);

        $controller->destroy($coupon->fresh());
        $this->assertDatabaseMissing('coupons', ['id' => $coupon->id]);
    }

    public function test_best_public_promotion_wins_and_equal_or_oversized_discounts_are_ignored(): void
    {
        $product = Product::factory()->create(['selling_price' => 40, 'retail_price' => 40]);
        foreach ([10, 20, 40, 100] as $value) {
            Coupon::create([
                'title' => "Sale {$value}",
                'type' => 'fixed',
                'value' => $value,
                'is_active' => true,
                'applicable_to' => 'all',
                'visibility' => 'public',
                'promotion_type' => 'public_sale',
                'discount_scope' => 'items',
                'stackable' => false,
                'auto_apply' => true,
            ]);
        }

        $service = app(PromotionService::class);
        $quote = $service->quote([
            ['product' => $product->load('categories'), 'variant' => null, 'quantity' => 1, 'unitPrice' => 40],
        ], ['shipping_total' => 80]);
        $line = $quote['line_allocations'][$service->lineKey($product->id, null)];

        $this->assertSame(20.0, $line['discount_total']);
        $this->assertSame(20.0, $line['line_total']);
        $this->assertCount(1, $line['discounts']);
        $this->assertSame(20.0, (float) $quote['applied_promotions'][0]['value']);
    }

    public function test_equal_or_oversized_only_promotion_leaves_original_price_unchanged(): void
    {
        foreach ([40, 100] as $value) {
            $product = Product::factory()->create(['selling_price' => 40, 'retail_price' => 40]);
            $promotion = Coupon::create([
                'title' => "Invalid sale {$value}",
                'type' => 'fixed',
                'value' => $value,
                'is_active' => true,
                'applicable_to' => 'product',
                'included_product_ids' => [$product->id],
                'visibility' => 'public',
                'promotion_type' => 'public_sale',
                'discount_scope' => 'items',
                'stackable' => false,
                'auto_apply' => true,
            ]);

            $service = app(PromotionService::class);
            $quote = $service->quote([
                ['product' => $product->load('categories'), 'variant' => null, 'quantity' => 1, 'unitPrice' => 40],
            ], ['shipping_total' => 80]);
            $line = $quote['line_allocations'][$service->lineKey($product->id, null)];

            $this->assertSame(0.0, $line['discount_total']);
            $this->assertSame(40.0, $line['line_total']);
            $this->assertSame(120.0, $quote['grand_total']);
            $promotion->delete();
        }
    }

}
