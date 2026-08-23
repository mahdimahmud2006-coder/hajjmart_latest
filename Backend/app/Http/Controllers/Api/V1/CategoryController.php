<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $query = Category::with('children')->whereNull('parent_id');
        if (! $request->is('api/v1/admin/*')) {
            $query->where('is_active', true);
        }

        return $this->success($query->orderBy('sort_order')->orderBy('name')->get(), 'Categories retrieved.');
    }

    public function showProducts(string $slug, Request $request)
    {
        $category = Category::where('slug', $slug)->orWhere('name', $slug)->firstOrFail();
        abort_unless($category->is_active, 404);
        $products = $category->products()
            ->where('products.is_active', true)
            ->with('productImages', 'inventory')
            ->paginate((int) $request->get('per_page', 20));
        return $this->success(['category' => $category, 'products' => $products], 'Category products retrieved.');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'description' => ['nullable', 'string'],
            'image' => ['nullable', 'string'],
            'icon' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $data['slug'] = Str::slug($data['name']);
        $data['is_active'] = $data['is_active'] ?? true;
        return $this->success(Category::create($data), 'Category created.', 201);
    }

    public function update(Request $request, Category $category)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'description' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        if (isset($data['name'])) $data['slug'] = Str::slug($data['name']);
        $category->update($data);
        return $this->success($category->fresh(), 'Category updated.');
    }

    public function destroy(Category $category)
    {
        $hasChildren = $category->children()->exists();
        $hasProducts = $category->products()->exists() || Product::query()->where('category_id', $category->id)->exists();

        abort_if($hasChildren, 422, "{$category->name} has subcategories. Move or remove them before deleting this category.");
        abort_if($hasProducts, 422, "{$category->name} is used by products. Move those products before deleting this category.");

        $category->delete();
        return $this->success(null, 'Category deleted.');
    }
}
