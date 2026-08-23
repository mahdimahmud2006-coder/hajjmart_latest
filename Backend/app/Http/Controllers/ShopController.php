<?php

namespace App\Http\Controllers;

use App\Models\Shop;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use App\Services\ProductFeedService;
use App\Actions\CreateOrderAction;
use App\Services\StripePaymentService;
use Exception;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use App\Models\Product;
use App\Models\Category;
use App\Models\Order;

class ShopController extends Controller
{
    /**
     * Helper: Get single Shop instance
     */
    private function shop(): Shop
    {
        return Shop::firstOrFail();
    }

    /**
     * Orchestrate selling a product and creating an order.
     *
     * @param  Request  $request
     * @return JsonResponse
     */
    public function sellProduct(Request $request): JsonResponse
    {
        Log::info('Initiating sellProduct', ['request' => $request->all()]);

        $validated = $request->validate([
            'products' => ['required', 'array'],
            'products.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'products.*.variation_id' => ['nullable', 'integer', 'exists:variations,id'],
            'products.*.quantity' => ['required', 'integer', 'min:1'],

            'orderData.customer_details.name' => ['required', 'string'],
            'orderData.customer_details.email' => ['required', 'email'],
            'orderData.customer_details.phone' => ['required', 'string'],

            'orderData.payment_method' => [
                'required',
                Rule::in(['COD', 'Online'])
            ],

            'orderData.address.country' => ['nullable', 'string', 'in:Bangladesh'],
            'orderData.address.full_address' => ['required_without:orderData.address.line1', 'string', 'max:1000'],
            'orderData.address.line1' => ['nullable', 'string', 'max:1000'],
            'orderData.address.district' => ['required', 'string', 'in:' . implode(',', config('hajjmart.districts', []))],
            'orderData.address.mobile_number' => ['nullable', 'string', 'regex:/^(?:\\+?88)?01[3-9]\\d{8}$/'],
            'orderData.address.area' => ['nullable', 'string', 'max:100'],
            'orderData.address.postal_code' => ['nullable', 'string', 'max:10'],
        ]);

        $formattedProducts = [];
        foreach ($validated['products'] as $item) {
            $product = Product::find($item['product_id']);
            if ($product->has_variations && empty($item['variation_id'])) {
                return response()->json([
                    'success' => false,
                    'message' => "Variation selection required for: {$product->name}"
                ], 422);
            }

            $formattedProducts[] = [
                'product_id' => $item['product_id'],
                'variation_id' => $item['variation_id'] ?? null,
                'quantity' => $item['quantity']
            ];
        }

        return DB::transaction(function () use ($validated, $formattedProducts) {
            // Step 1: Create the Order
            $order = CreateOrderAction::run(
                $validated['orderData']['customer_details'],
                $validated['orderData']['payment_method'],
                $formattedProducts,
                $validated['orderData']['address']
            );

            $response = [
                'success' => true,
                'order' => $order->load('stripeIdRecord'),
            ];

            // Step 2: Handle Payment Method
            if ($order->payment_method === 'Online') {
                $stripeService = app(StripePaymentService::class);
                $session = $stripeService->createCheckoutSession($order);
                $response['checkout_url'] = $session->url;
            }

            return response()->json($response);
        });
    }


    /**
     * Fetch products for the public feed.
     *
     * @param  Request  $request
     * @param  ProductFeedService  $service
     * @return JsonResponse
     */
    public function getProductFeed(Request $request, ProductFeedService $service): JsonResponse
    {
        $validated = $request->validate([
            'categories' => ['nullable', 'array'],
            'categories.*' => ['integer', 'exists:categories,id'],

            'min_price' => ['nullable', 'numeric', 'min:0'],
            'max_price' => ['nullable', 'numeric', 'min:0'],

            'search' => ['nullable', 'string'],

            'sort_by' => [
                'nullable',
                Rule::in(['newest', 'most_sold', 'price_low_high', 'price_high_low'])
            ],

            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $feed = $service->getFeed($validated);

        return response()->json($feed);
    }

    /**
     * Validate and update cart items.
     *
     * @param  Request  $request
     * @return JsonResponse
     */
    public function updateForCart(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.variation_id' => ['nullable', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
        ]);

        $result = $this->shop()->updateForCart($validated['items']);

        return response()->json($result);
    }

    /**
     * Get public statistics for the shop (About Us page).
     *
     * @return JsonResponse
     */
    public function getPublicStats(): JsonResponse
    {
        $productCount = Product::count();
        $categoryCount = Category::count();
        $confirmedOrderCount = Order::confirmed()->count();

        return response()->json([
            'success' => true,
            'data' => [
                'products' => $productCount,
                'categories' => $categoryCount,
                'successful_orders' => $confirmedOrderCount,
            ]
        ]);
    }
}