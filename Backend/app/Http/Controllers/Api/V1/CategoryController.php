<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    use ApiResponse;

    public function index()
    {
        return $this->success(Category::with('children.children')->whereNull('parent_id')->orderBy('sort_order')->orderBy('name')->get(), 'Categories retrieved.');
    }

    public function showProducts(string $slug, Request $request)
    {
        $category = Category::with('children.children')->where('slug', $slug)->orWhere('name', $slug)->firstOrFail();
        $products = $category->products()->with('productImages', 'inventory')->paginate((int) $request->get('per_page', 20));
        return $this->success(['category' => $category, 'products' => $products], 'Category products retrieved.');
    }

    public function store(Request $request)
    {
        $data = $request->validate(['name' => ['required', 'string'], 'parent_id' => ['nullable', 'integer', 'exists:categories,id'], 'description' => ['nullable', 'string'], 'image' => ['nullable', 'string'], 'icon' => ['nullable', 'string'], 'sort_order' => ['nullable', 'integer']]);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        return $this->success(Category::create($data), 'Category created.', 201);
    }

    public function update(Request $request, Category $category)
    {
        $data = $request->all();
        if (isset($data['name']) && empty($data['slug'])) $data['slug'] = Str::slug($data['name']);
        $category->update($data);
        return $this->success($category->fresh(), 'Category updated.');
    }

    public function destroy(Category $category)
    {
        $category->delete();
        return $this->success(null, 'Category deleted.');
    }
}
