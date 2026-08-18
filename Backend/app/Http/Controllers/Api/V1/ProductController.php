<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\ProductService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    use ApiResponse;

    public function __construct(private ProductService $products) {}

    public function index(Request $request)
    {
        return $this->success($this->products->search($request->all()), 'Products retrieved.');
    }

    public function show(string $slug)
    {
        return $this->success($this->products->detail($slug), 'Product retrieved.');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['nullable', 'string'],
            'slug' => ['nullable', 'string'],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'retail_price' => ['nullable', 'numeric', 'min:0'],
            'wholesale_price' => ['nullable', 'numeric', 'min:0'],
            'regular_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'brand' => ['nullable', 'string', 'max:150'],
            'barcode' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'short_description' => ['nullable', 'string'],
            'long_description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'categories' => ['nullable', 'array'],
            'categories.*' => ['string', 'max:150'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string', 'max:100'],
            'images' => ['nullable', 'array'],
            'variations' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
            'is_featured' => ['nullable', 'boolean'],
            'visible_in_shop' => ['nullable', 'boolean'],
        ]);
        return $this->success($this->products->store($data), 'Product created.', 201);
    }

    public function update(Request $request, Product $product)
    {
        $data = $request->all();
        return $this->success($this->products->update($product, $data), 'Product updated.');
    }

    public function destroy(Product $product)
    {
        $product->delete();
        return $this->success(null, 'Product deleted.');
    }
}
