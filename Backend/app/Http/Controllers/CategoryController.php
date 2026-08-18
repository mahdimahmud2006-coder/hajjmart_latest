<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CategoryController extends Controller
{
    /**
     * Display a listing of the categories.
     *
     * @return JsonResponse
     */
    public function getAllCategories(): JsonResponse
    {
        $categories = Category::getAllCategories();

        return response()->json([
            'success' => true,
            'data'    => $categories
        ], 200);
    }

    /**
     * Store a newly created category.
     *
     * @param  Request  $request
     * @return JsonResponse
     */
    public function createNewCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:categories,name',
        ]);

        $category = Category::createCategory($validated['name']);

        if (!$category) {
            throw new \Symfony\Component\HttpKernel\Exception\HttpException(403, 'The category name is reserved.');
        }

        return response()->json([
            'success' => true,
            'message' => 'Category created successfully.',
            'data'    => $category
        ], 201);
    }

    /**
     * Display the specified category.
     *
     * @param  int  $id
     * @return JsonResponse
     */
    public function getCategoryById(int $id): JsonResponse
    {
        $category = Category::findOrFail($id);

        return response()->json([
            'success' => true,
            'data'    => $category
        ], 200);
    }

    /**
     * Update the specified category.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return JsonResponse
     */
    public function updateCategoryName(Request $request, int $id): JsonResponse
    {
        $category = Category::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:categories,name,' . $id,
        ]);

        if (!$category->updateCategoryName($validated['name'])) {
            throw new \Symfony\Component\HttpKernel\Exception\HttpException(403, 'Cannot update this category or the name is reserved.');
        }

        return response()->json([
            'success' => true,
            'message' => 'Category updated successfully.',
            'data'    => $category
        ], 200);
    }

    /**
     * Remove the specified category.
     *
     * @param  int  $id
     * @return JsonResponse
     */
    public function deleteCategory(int $id): JsonResponse
    {
        $category = Category::findOrFail($id);
        
        if (!$category->delete()) {
             throw new \RuntimeException('Category could not be deleted.');
        }

        return response()->json([
            'success' => true,
            'message' => 'Category deleted successfully.'
        ], 200);
    }

    /**
     * Get inventory overview (Total product counts) for all categories.
     *
     * @return JsonResponse
     */
    public function getCategoryInventory(): JsonResponse
    {
        $inventory = Category::getCategoryInventory();

        return response()->json([
            'success' => true,
            'data'    => $inventory
        ], 200);
    }
}