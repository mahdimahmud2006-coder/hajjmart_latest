<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\ProductService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BarcodeController extends Controller
{
    use ApiResponse;

    public function __construct(private ProductService $productService) {}

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        $perPage = min(100, max(10, (int) $request->query('per_page', 20)));

        $query = Product::query()
            ->with(['productVariants', 'productImages'])
            ->where('is_active', true);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%")
                    ->orWhereHas('productVariants', function ($vq) use ($search) {
                        $vq->where('sku', 'like', "%{$search}%")
                            ->orWhere('barcode', 'like', "%{$search}%");
                    });
            });
        }

        $paginated = $query->paginate($perPage);

        // Build flat barcode items list combining products and variations
        $items = [];
        foreach ($paginated->items() as $product) {
            if ($product->productVariants && $product->productVariants->isNotEmpty()) {
                foreach ($product->productVariants as $variant) {
                    $items[] = [
                        'entity_type' => 'variant',
                        'product_id' => $product->id,
                        'variant_id' => $variant->id,
                        'name' => $product->name,
                        'variant_label' => $variant->attribute_values ? (is_array($variant->attribute_values) ? implode(' / ', array_map(function($v, $k) {
                            $str = is_string($k) && !is_numeric($k) ? ucfirst(str_replace(['attribute_', 'attr_'], '', $k)) . ': ' . $v : (string) $v;
                            return preg_replace_callback('/(?:attribute_|attr_)([a-zA-Z0-9_]+):/i', function($m) {
                                return ucfirst(str_replace('_', ' ', $m[1])) . ':';
                            }, $str);
                        }, $variant->attribute_values, array_keys($variant->attribute_values))) : (string) $variant->attribute_values) : 'Variant',
                        'sku' => $variant->sku ?: $product->sku,
                        'barcode' => $variant->barcode ?: $product->barcode,
                        'retail_price' => (float) ($variant->retail_price ?? $variant->sale_price ?? $variant->price ?? $product->selling_price ?? 0),
                        'product_image' => $product->primary_image_url ?? $product->image_src[0] ?? null,
                    ];
                }
            } else {
                $items[] = [
                    'entity_type' => 'product',
                    'product_id' => $product->id,
                    'variant_id' => null,
                    'name' => $product->name,
                    'variant_label' => null,
                    'sku' => $product->sku,
                    'barcode' => $product->barcode,
                    'retail_price' => (float) ($product->selling_price ?? $product->retail_price ?? 0),
                    'product_image' => $product->primary_image_url ?? $product->image_src[0] ?? null,
                ];
            }
        }

        $paginated->setCollection(collect($items));
        return $this->success($paginated, 'Barcodes retrieved.');
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'entity_type' => ['required', 'string', 'in:product,variant'],
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'barcode' => ['required', 'string', 'max:100'],
        ]);

        $barcode = trim($validated['barcode']);

        if ($validated['entity_type'] === 'variant' && ! empty($validated['variant_id'])) {
            $variant = ProductVariant::findOrFail($validated['variant_id']);

            $existsInProduct = Product::where('barcode', $barcode)->exists();
            $existsInVariant = ProductVariant::where('barcode', $barcode)->where('id', '!=', $variant->id)->exists();

            if ($existsInProduct || $existsInVariant) {
                return response()->json([
                    'message' => 'This barcode is already assigned to another product or variant.',
                ], 422);
            }

            $variant->update(['barcode' => $barcode]);
            return response()->json([
                'message' => 'Variant barcode updated successfully.',
                'barcode' => $variant->barcode,
            ]);
        }

        $product = Product::findOrFail($validated['product_id']);

        $existsInProduct = Product::where('barcode', $barcode)->where('id', '!=', $product->id)->exists();
        $existsInVariant = ProductVariant::where('barcode', $barcode)->exists();

        if ($existsInProduct || $existsInVariant) {
            return response()->json([
                'message' => 'This barcode is already assigned to another product or variant.',
            ], 422);
        }

        $product->update(['barcode' => $barcode]);
        return response()->json([
            'message' => 'Product barcode updated successfully.',
            'barcode' => $product->barcode,
        ]);
    }

    public function generate(): JsonResponse
    {
        $barcode = $this->productService->generateUniqueBarcode();
        return response()->json(['barcode' => $barcode]);
    }
}
