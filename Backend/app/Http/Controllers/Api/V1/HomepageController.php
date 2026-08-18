<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\HomepageSection;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HomepageController extends Controller
{
    use ApiResponse;

    public function index()
    {
        $sections = HomepageSection::query()
            ->with('category')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return $this->success(['sections' => $sections], 'Homepage content retrieved.');
    }

    public function adminIndex()
    {
        return $this->success(
            HomepageSection::query()->with('category')->orderBy('sort_order')->orderBy('id')->get(),
            'Homepage sections retrieved.'
        );
    }

    public function store(Request $request)
    {
        $section = HomepageSection::create($this->validated($request));

        return $this->success($section->load('category'), 'Homepage section created.', 201);
    }

    public function update(Request $request, HomepageSection $homepageSection)
    {
        $homepageSection->update($this->validated($request, true));

        return $this->success($homepageSection->fresh('category'), 'Homepage section updated.');
    }

    public function destroy(HomepageSection $homepageSection)
    {
        $homepageSection->delete();

        return $this->success(null, 'Homepage section deleted.');
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $sometimes = $partial ? ['sometimes'] : [];

        return $request->validate([
            'kind' => [...$sometimes, 'required', 'string', Rule::in([
                'hero',
                'category_banner',
                'seasonal_collection',
                'editorial_banner',
                'announcement',
            ])],
            'eyebrow' => ['nullable', 'string', 'max:255'],
            'title' => [...$sometimes, 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'cta_label' => ['nullable', 'string', 'max:100'],
            'cta_url' => ['nullable', 'string', 'max:500'],
            'image_url' => ['nullable', 'string', 'max:2048'],
            'mobile_image_url' => ['nullable', 'string', 'max:2048'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'theme' => ['nullable', 'string', Rule::in(['forest', 'sand', 'night', 'clay'])],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'metadata' => ['nullable', 'array'],
        ]);
    }
}
