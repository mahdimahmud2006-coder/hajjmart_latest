<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class ProductController extends Controller
{
    /**
     * Get all products.
     *
     * @return JsonResponse
     */
    public function getAllProducts(): JsonResponse
    {
        $products = Product::getAllProducts();

        return response()->json([
            'success' => true,
            'data'    => $products
        ], 200);
    }

    /**
     * Get paginated products.
     *
     * @param  Request  $request
     * @return JsonResponse
     */
    public function getAllProductsPaginated(Request $request): JsonResponse
    {
        $perPage    = $request->input('per_page', 7);
        $page       = $request->input('page', 1);
        $search     = $request->input('search');
        $categoryId = $request->input('category_id');

        $result = Product::getAllProductsPaginated((int)$perPage, (int)$page, $search, $categoryId ? (int)$categoryId : null);

        return response()->json([
            'success' => true,
            'data'    => $result
        ], 200);
    }

    /**
     * Get product by ID.
     *
     * @param  int  $id
     * @return JsonResponse
     */
    public function getProductById(int $id): JsonResponse
    {
        $product = Product::with(['productBatches', 'categories', 'variations', 'variations.productBatches'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data'    => $product
        ], 200);
    }

    /**
     * Create a new product.
     *
     * @param  Request  $request
     * @return JsonResponse
     */
    public function createProduct(Request $request): JsonResponse
    {
        if ($request->has('price_slabs') && is_string($request->price_slabs)) {
            $request->merge(['price_slabs' => json_decode($request->price_slabs, true)]);
        }

        if ($request->has('variations') && is_string($request->variations)) {
            $request->merge(['variations' => json_decode($request->variations, true)]);
        }

        $validated = $request->validate([
            'name'                => 'required|string|max:255',
            'selling_price'       => 'nullable|numeric|min:0',
            'image_src'           => 'nullable|array',
            'image_src.*'         => 'image|mimes:jpeg,png,jpg,webp|max:5120',
            'description'         => 'nullable|string',
            'categories_id'       => 'nullable|array',
            'categories_id.*'     => 'integer|exists:categories,id',
            'has_dynamic_pricing' => 'nullable|boolean',
            'price_slabs'         => 'nullable|array',
            'has_variations'      => 'nullable|boolean',
            'variations'          => 'nullable|array',
        ]);

        $product = Product::createProduct(
            $request->name,
            $request->selling_price !== null ? (float)$request->selling_price : null,
            $request->file('image_src', []),
            $request->description,
            $request->categories_id,
            $request->boolean('has_dynamic_pricing'),
            $request->price_slabs,
            $request->boolean('has_variations'),
            $request->variations,
            $request->allFiles() // Passes all files including variation_images_{idx}
        );

        return response()->json([
            'success' => true,
            'message' => 'Product created successfully.',
            'data'    => $product
        ], 201);
    }

    /**
     * Update product name.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return JsonResponse
     */
    public function updateProductName(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $product->updateProductName($validated['name']);

        return response()->json([
            'success' => true,
            'message' => 'Product name updated successfully.',
            'data'    => $product
        ], 200);
    }

    /**
     * Update product description.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return JsonResponse
     */
    public function updateProductDescription(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'description' => 'nullable|string',
        ]);

        $product->updateDescription($validated['description']);
        $product->load(['variations', 'variations.productBatches']);

        return response()->json([
            'success' => true,
            'message' => 'Product description updated successfully.',
            'data'    => $product
        ], 200);
    }

    /**
     * Update selling price.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return JsonResponse
     */
    public function updateSellingPrice(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'selling_price' => 'nullable|numeric|min:0',
        ]);

        $product->updateSellingPrice($validated['selling_price'] !== null ? (float)$validated['selling_price'] : null);
        $product->load(['variations', 'variations.productBatches']);

        return response()->json([
            'success' => true,
            'message' => 'Selling price updated successfully.',
            'data'    => $product
        ], 200);
    }

    /**
     * Update dynamic pricing toggle and slabs.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return JsonResponse
     */
    public function updateDynamicPricing(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        if ($request->has('price_slabs') && is_string($request->price_slabs)) {
            $request->merge(['price_slabs' => json_decode($request->price_slabs, true)]);
        }

        $validated = $request->validate([
            'has_dynamic_pricing' => 'required|boolean',
            'price_slabs'         => 'nullable|array',
        ]);

        $product->update([
            'has_dynamic_pricing' => $validated['has_dynamic_pricing'],
            'price_slabs'         => $validated['price_slabs'],
        ]);
        $product->load(['variations', 'variations.productBatches']);

        return response()->json([
            'success' => true,
            'message' => 'Dynamic pricing updated successfully.',
            'data'    => $product
        ], 200);
    }

    /**
     * Add categories to product.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return JsonResponse
     */
    public function addCategory(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'category_ids'   => 'required|array',
            'category_ids.*' => 'integer|exists:categories,id',
        ]);

        $product->addCategory($validated['category_ids']);

        return response()->json([
            'success' => true,
            'message' => 'Categories added successfully.',
            'data'    => $product->fresh('categories')
        ], 200);
    }

    /**
     * Remove categories from product.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return JsonResponse
     */
    public function removeCategory(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'category_ids'   => 'required|array',
            'category_ids.*' => 'integer|exists:categories,id',
        ]);

        $product->removeCategory($validated['category_ids']);

        return response()->json([
            'success' => true,
            'message' => 'Categories removed successfully.',
            'data'    => $product->fresh('categories')
        ], 200);
    }

    /**
     * Delete product by ID.
     *
     * @param  int  $id
     * @return JsonResponse
     */
    public function deleteProductById(int $id): JsonResponse
    {
        if (!Product::deleteProductById($id)) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException("Product not found.");
        }

        return response()->json([
            'success' => true,
            'message' => 'Product deleted successfully.'
        ], 200);
    }

    /**
     * Add new images to product.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return JsonResponse
     */
    public function addNewImage(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'images'   => 'required|array',
            'images.*' => 'image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        $product->addNewImage($request->file('images'));

        return response()->json([
            'success' => true,
            'message' => 'Images added successfully.',
            'data'    => $product
        ], 200);
    }

    /**
     * Delete images from product.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return JsonResponse
     */
    public function deleteImage(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'paths'   => 'required|array',
            'paths.*' => 'string',
        ]);

        $product->deleteImage($validated['paths']);

        return response()->json([
            'success' => true,
            'message' => 'Images deleted successfully.',
            'data'    => $product
        ], 200);
    }

    /**
     * Manually trigger total count update.
     *
     * @param  int  $id
     * @return JsonResponse
     */
    public function updateTotalCount(int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $product->updateTotalCount();

        return response()->json([
            'success'     => true,
            'message'     => 'Total count updated.',
            'total_count' => $product->total_count
        ], 200);
    }

    /**
     * Get total count of product.
     *
     * @param  int  $id
     * @return JsonResponse
     */
    public function getTotalCount(int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        return response()->json([
            'success'     => true,
            'total_count' => $product->getTotalCount()
        ], 200);
    }

    /**
     * Update has_variations flag.
     */
    public function updateHasVariations(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'has_variations' => 'required|boolean',
        ]);

        $product->update([
            'has_variations' => $validated['has_variations']
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Variations flag updated successfully.',
            'data'    => $product
        ], 200);
    }

    /**
     * Create variation for a product.
     */
    public function createVariation(Request $request, int $productId): JsonResponse
    {
        $product = Product::findOrFail($productId);

        if ($request->has('price_slabs') && is_string($request->price_slabs)) {
            $request->merge(['price_slabs' => json_decode($request->price_slabs, true)]);
        }

        $validated = $request->validate([
            'name'                => 'required|string|max:255',
            'selling_price'       => 'nullable|numeric|min:0',
            'has_dynamic_pricing' => 'nullable|boolean',
            'price_slabs'         => 'nullable|array',
            'images'              => 'nullable|array',
            'images.*'            => 'image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        $storedPaths = [];
        if ($request->hasFile('images')) {
            $imageKit = new \App\Services\ImageKitService();
            foreach ($request->file('images') as $img) {
                $storedPaths[] = $imageKit->upload($img, 'products');
            }
        }

        $variation = $product->variations()->create([
            'name'                => $validated['name'],
            'selling_price'       => $request->selling_price !== null ? round((float)$request->selling_price, 2) : null,
            'image_src'           => empty($storedPaths) ? null : $storedPaths,
            'has_dynamic_pricing' => false,
            'price_slabs'         => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Variation created successfully.',
            'data'    => $variation
        ], 201);
    }

    /**
     * Update variation details.
     */
    public function updateVariation(Request $request, int $variationId): JsonResponse
    {
        $variation = \App\Models\Variation::findOrFail($variationId);

        $validated = $request->validate([
            'name'                => 'nullable|string|max:255',
            'selling_price'       => 'nullable|numeric|min:0',
            'has_dynamic_pricing' => 'nullable|boolean',
            'price_slabs'         => 'nullable|array',
        ]);

        if ($request->has('name')) {
            $variation->name = $validated['name'];
        }
        if ($request->has('selling_price')) {
            $variation->selling_price = $request->selling_price !== null ? round((float)$request->selling_price, 2) : null;
        }
        $variation->save();

        return response()->json([
            'success' => true,
            'message' => 'Variation updated successfully.',
            'data'    => $variation
        ], 200);
    }

    /**
     * Delete a variation.
     */
    public function deleteVariation(int $variationId): JsonResponse
    {
        $variation = \App\Models\Variation::findOrFail($variationId);

        if (!empty($variation->image_src)) {
            $imageKit = new \App\Services\ImageKitService();
            foreach ($variation->image_src as $url) {
                $imageKit->delete($url);
            }
        }

        $variation->delete();

        return response()->json([
            'success' => true,
            'message' => 'Variation deleted successfully.'
        ], 200);
    }

    /**
     * Add images to a specific variation.
     */
    public function addVariationImage(Request $request, int $variationId): JsonResponse
    {
        $variation = \App\Models\Variation::findOrFail($variationId);

        $validated = $request->validate([
            'images'   => 'required|array',
            'images.*' => 'image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        $variation->addNewImage($request->file('images'));

        return response()->json([
            'success' => true,
            'message' => 'Variation images added successfully.',
            'data'    => $variation
        ], 200);
    }

    /**
     * Delete images from a specific variation.
     */
    public function deleteVariationImage(Request $request, int $variationId): JsonResponse
    {
        $variation = \App\Models\Variation::findOrFail($variationId);

        $validated = $request->validate([
            'paths'   => 'required|array',
            'paths.*' => 'string',
        ]);

        $variation->deleteImage($validated['paths']);

        return response()->json([
            'success' => true,
            'message' => 'Variation images deleted successfully.',
            'data'    => $variation
        ], 200);
    }
}