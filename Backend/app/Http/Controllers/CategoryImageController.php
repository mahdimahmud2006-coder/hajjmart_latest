<?php

namespace App\Http\Controllers;

use App\Models\CategoryImage;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class CategoryImageController extends Controller
{
    public function saveImage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => 'required|integer|exists:categories,id|unique:category_images,category_id',
            'image_url'   => 'required|image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        $categoryImage = CategoryImage::saveImage(
            $validated['category_id'],
            $request->file('image_url')
        );

        return response()->json([
            'success'   => true,
            'message'   => 'Category image saved successfully.',
            'image_url' => $categoryImage->image_url
        ], 201);
    }

    public function getImage(int $categoryId): JsonResponse
    {
        $imageUrl = CategoryImage::getImage($categoryId);

        if (!$imageUrl) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException('Image not found.');
        }

        return response()->json([
            'success'   => true,
            'image_url' => $imageUrl
        ], 200);
    }

    public function updateImage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => 'required|integer|exists:category_images,category_id',
            'image_url'   => 'required|image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        $categoryImage = CategoryImage::where('category_id', $validated['category_id'])->firstOrFail();

        $categoryImage->updateImage($request->file('image_url'));

        return response()->json([
            'success'   => true,
            'message'   => 'Category image updated successfully.',
            'image_url' => $categoryImage->image_url
        ], 200);
    }

    public function deleteImage(int $categoryId): JsonResponse
    {
        $categoryImage = CategoryImage::where('category_id', $categoryId)->firstOrFail();

        $categoryImage->deleteImage();

        return response()->json([
            'success' => true,
            'message' => 'Category image deleted successfully.'
        ], 200);
    }
}
