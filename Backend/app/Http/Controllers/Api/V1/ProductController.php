<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Services\ProductService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    use ApiResponse;

    public function __construct(private ProductService $products) {}

    public function index(Request $request)
    {
        $filters = $request->all();
        if (! $request->is('api/v1/admin/*')) {
            $filters['channel'] = 'website';
        }

        return $this->success($this->products->search($filters), 'Products retrieved.');
    }

    public function show(Request $request, string $slug)
    {
        $product = $this->products->detail($slug);
        if (! $request->is('api/v1/admin/*') && ! $product->is_active) {
            abort(404);
        }

        return $this->success($product, 'Product retrieved.');
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());
        return $this->success($this->products->store($data), 'Product created.', 201);
    }

    public function update(Request $request, Product $product)
    {
        $data = $request->validate($this->rules(false));
        if (array_key_exists('variations', $data) && ! $request->user()->is_admin) {
            $existingIds = $product->productVariants()->where('is_active', true)->pluck('id')->sort()->values()->all();
            $submittedIds = collect($data['variations'] ?? [])->pluck('id')->filter()->map(fn ($id) => (int) $id)->sort()->values()->all();
            abort_if($existingIds !== $submittedIds, 403, 'Only an admin can remove a product variation.');
        }
        return $this->success($this->products->update($product, $data), 'Product updated.');
    }

    public function bulkUpdate(Request $request)
    {
        $data = $request->validate([
            'product_ids' => ['required', 'array', 'min:1', 'max:100'],
            'product_ids.*' => ['integer', 'exists:products,id'],
            'action' => ['required', Rule::in(['prices', 'status'])],
            'retail_price' => ['nullable', 'numeric', 'min:0'],
            'wholesale_price' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $products = Product::query()->whereIn('id', $data['product_ids'])->get();
        DB::transaction(function () use ($products, $data): void {
            foreach ($products as $product) {
                if ($data['action'] === 'prices') {
                    abort_unless(isset($data['retail_price']) && isset($data['wholesale_price']), 422, 'Enter both retail and wholesale selling prices.');
                    $product->update([
                        'selling_price' => $data['retail_price'],
                        'retail_price' => $data['retail_price'],
                        'sale_price' => $data['retail_price'],
                        'wholesale_price' => $data['wholesale_price'],
                    ]);
                    $product->productVariants()->where('is_active', true)->update([
                        'price' => $data['retail_price'],
                        'sale_price' => $data['retail_price'],
                        'retail_price' => $data['retail_price'],
                        'wholesale_price' => $data['wholesale_price'],
                    ]);
                } else {
                    abort_unless(array_key_exists('is_active', $data), 422, 'Choose whether the products should be active or archived.');
                    $product->update([
                        'is_active' => $data['is_active'],
                        'visible_in_shop' => (bool) $data['is_active'],
                    ]);
                }
            }
        });

        return $this->success(['updated' => $products->count()], 'Selected products updated.');
    }

    public function uploadImage(Request $request)
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);

        $path = $request->file('image')->store('products', 'public');

        return $this->success([
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
            'mime_type' => $request->file('image')->getMimeType(),
            'size_bytes' => $request->file('image')->getSize(),
        ], 'Image uploaded.');
    }

    public function destroy(Product $product)
    {
        $hasHistory = OrderItem::query()->where('product_id', $product->id)->exists()
            || ProductBatch::query()->where('product_id', $product->id)->exists()
            || Inventory::query()->where('product_id', $product->id)->exists();

        abort_if($hasHistory, 422, "{$product->name} has sales or stock history. Archive it instead of deleting it.");
        $product->delete();
        return $this->success(null, 'Product deleted.');
    }

    private function rules(bool $creating = true): array
    {
        return [
            'name' => [$creating ? 'required' : 'nullable', 'string', 'max:255'],
            'sku' => ['nullable', 'string', 'max:150'],
            'brand' => ['nullable', 'string', 'max:255'],
            'categories' => ['nullable', 'array'],
            'categories.*' => ['string', 'max:150'],
            'short_description' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'product_type' => ['nullable', Rule::in(['simple', 'variable'])],
            'retail_price' => ['nullable', 'numeric', 'min:0'],
            'wholesale_price' => ['nullable', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'images' => ['nullable', 'array'],
            'images.*.path' => ['nullable', 'string', 'max:2048'],
            'images.*.local_path' => ['nullable', 'string', 'max:2048'],
            'images.*.source_url' => ['nullable', 'string', 'max:2048'],
            'images.*.downloaded_url' => ['nullable', 'string', 'max:2048'],
            'images.*.alt_text' => ['nullable', 'string', 'max:255'],
            'images.*.mime_type' => ['nullable', 'string', 'max:100'],
            'images.*.size_bytes' => ['nullable', 'integer', 'min:0'],
            'images.*.is_primary' => ['nullable', 'boolean'],
            'variations' => ['nullable', 'array'],
            'variations.*.id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'variations.*.sku' => ['required', 'string', 'max:150'],
            'variations.*.barcode' => ['nullable', 'string', 'max:100'],
            'variations.*.retail_price' => ['nullable', 'numeric', 'min:0'],
            'variations.*.wholesale_price' => ['nullable', 'numeric', 'min:0'],
            'variations.*.cost_price' => ['nullable', 'numeric', 'min:0'],
            'variations.*.attributes' => ['nullable', 'array'],
            'variations.*.attribute_values' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
            'is_featured' => ['nullable', 'boolean'],
            'visible_in_shop' => ['nullable', 'boolean'],
        ];
    }
}
