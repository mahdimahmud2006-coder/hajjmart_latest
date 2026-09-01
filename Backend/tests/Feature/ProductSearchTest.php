<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Shop;
use App\Models\User;
use App\Services\ProductService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductSearchTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Shop $shop;
    private ProductService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->shop = Shop::first() ?? Shop::create([
            'name' => 'Main Store',
            'code' => 'TEST_MAIN',
            'is_default' => true,
            'is_active' => true,
        ]);
        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin_test_' . uniqid() . '@test.local',
            'password' => bcrypt('password'),
            'is_admin' => true,
            'is_employee' => true,
            'is_active' => true,
            'shop_id' => $this->shop->id,
        ]);
        $this->service = app(ProductService::class);
    }

    public function test_multi_word_search_matches_regardless_of_word_order(): void
    {
        $product = Product::create([
            'name' => 'Unscented Hajj Soap Fragrance Free',
            'slug' => 'unscented-hajj-soap',
            'sku' => 'SOAP-01',
            'is_active' => true,
            'selling_price' => 120,
        ]);
        Inventory::create([
            'shop_id' => $this->shop->id,
            'product_id' => $product->id,
            'quantity' => 10,
            'reserved' => 0,
        ]);

        $forward = $this->service->search(['q' => 'hajj soap', 'shop_id' => $this->shop->id, 'in_stock' => 1]);
        $reverse = $this->service->search(['q' => 'soap hajj', 'shop_id' => $this->shop->id, 'in_stock' => 1]);

        $this->assertSame(1, $forward->total());
        $this->assertSame($product->id, $forward->first()->id);
        $this->assertSame(1, $reverse->total());
        $this->assertSame($product->id, $reverse->first()->id);
    }

    public function test_search_by_numeric_id_and_hm_prefix(): void
    {
        $product = Product::create([
            'name' => 'Travel Mat',
            'slug' => 'travel-mat',
            'sku' => null,
            'is_active' => true,
            'selling_price' => 250,
        ]);
        Inventory::create([
            'shop_id' => $this->shop->id,
            'product_id' => $product->id,
            'quantity' => 5,
            'reserved' => 0,
        ]);

        $byId = $this->service->search(['q' => (string) $product->id, 'shop_id' => $this->shop->id]);
        $byHm = $this->service->search(['q' => "HM-{$product->id}", 'shop_id' => $this->shop->id]);
        $byHash = $this->service->search(['q' => "#{$product->id}", 'shop_id' => $this->shop->id]);

        $this->assertSame(1, $byId->total());
        $this->assertSame($product->id, $byId->first()->id);
        $this->assertSame(1, $byHm->total());
        $this->assertSame($product->id, $byHm->first()->id);
        $this->assertSame(1, $byHash->total());
        $this->assertSame($product->id, $byHash->first()->id);
    }

    public function test_search_by_category_name(): void
    {
        $category = Category::create([
            'name' => 'Cosmetics & Toiletries',
            'slug' => 'cosmetics-toiletries',
            'is_active' => true,
        ]);
        $product = Product::create([
            'name' => 'Organic Lip Balm',
            'slug' => 'organic-lip-balm',
            'category_id' => $category->id,
            'is_active' => true,
            'selling_price' => 80,
        ]);
        $product->categories()->attach($category->id);
        Inventory::create([
            'shop_id' => $this->shop->id,
            'product_id' => $product->id,
            'quantity' => 8,
            'reserved' => 0,
        ]);

        $res = $this->service->search(['q' => 'Cosmetics', 'shop_id' => $this->shop->id]);
        $this->assertSame(1, $res->total());
        $this->assertSame($product->id, $res->first()->id);
    }

    public function test_search_by_variant_attributes(): void
    {
        $product = Product::create([
            'name' => 'Men Cotton Ihram',
            'slug' => 'men-cotton-ihram',
            'has_variations' => true,
            'is_active' => true,
            'selling_price' => 1500,
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'IHR-XL',
            'attribute_values' => ['Size' => 'XL', 'Color' => 'White'],
            'attributes_json' => ['size' => 'XL', 'color' => 'White'],
            'is_active' => true,
            'price' => 1500,
        ]);
        Inventory::create([
            'shop_id' => $this->shop->id,
            'product_id' => $product->id,
            'variant_id' => $variant->id,
            'quantity' => 12,
            'reserved' => 0,
        ]);

        $res = $this->service->search(['q' => 'XL', 'shop_id' => $this->shop->id, 'in_stock' => 1]);
        $this->assertSame(1, $res->total());
        $this->assertSame($product->id, $res->first()->id);
    }

    public function test_api_admin_products_search_endpoint(): void
    {
        $product = Product::create([
            'name' => 'Miswak Pack of 3',
            'slug' => 'miswak-pack-of-3',
            'sku' => 'MISWAK-3',
            'barcode' => '8901234567890',
            'is_active' => true,
            'selling_price' => 100,
        ]);
        Inventory::create([
            'shop_id' => $this->shop->id,
            'product_id' => $product->id,
            'quantity' => 20,
            'reserved' => 0,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/v1/admin/products?q=8901234567890&shop_id={$this->shop->id}&in_stock=1");

        $response->assertOk();
        $response->assertJsonPath('data.0.id', $product->id);
        $response->assertJsonPath('data.0.sku', 'MISWAK-3');
    }
}
