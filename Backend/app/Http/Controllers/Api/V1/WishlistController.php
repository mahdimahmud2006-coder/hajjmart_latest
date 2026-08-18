<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Wishlist;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    use ApiResponse;
    public function index(Request $request) { return $this->success(Wishlist::with('product')->where('user_id', $request->user()->id)->get(), 'Wishlist retrieved.'); }
    public function store(Request $request, int $product)
    {
        $wishlist = Wishlist::firstOrCreate(['user_id' => $request->user()->id, 'product_id' => $product, 'variant_id' => $request->input('variant_id')], ['created_at' => now()]);
        return $this->success($wishlist, 'Wishlist item saved.');
    }
    public function destroy(Request $request, int $product)
    {
        Wishlist::where('user_id', $request->user()->id)->where('product_id', $product)->delete();
        return $this->success(null, 'Wishlist item removed.');
    }
}
