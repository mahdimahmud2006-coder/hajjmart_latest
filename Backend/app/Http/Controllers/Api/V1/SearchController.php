<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ProductService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    use ApiResponse;
    public function __construct(private ProductService $products) {}
    public function __invoke(Request $request) { return $this->success($this->products->search(['q' => $request->get('q'), 'per_page' => $request->get('per_page', 20)]), 'Search results.'); }
}
