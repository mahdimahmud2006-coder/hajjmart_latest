<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderList;
use App\Actions\CreateOrderAction;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class OrderListController extends Controller
{
    /**
     * Store a newly created order (Manual Admin Action).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ordered_products' => ['required', 'array'],
            'ordered_products.*.id' => ['required', 'integer', 'exists:products,id'],
            'ordered_products.*.qty' => ['required', 'integer', 'min:1'],

            'customer_details.name' => ['required', 'string'],
            'customer_details.email' => ['required', 'email'],
            'customer_details.phone' => ['required', 'string'],

            'payment_method' => ['required', 'in:COD,Online'],
            'payment_status' => ['required', 'in:Unpaid,Paid,Failed'],

            'address.country' => ['nullable', 'string', 'in:Bangladesh'],
            'address.full_address' => ['required_without:address.line1', 'string'],
            'address.line1' => ['nullable', 'string'],
            'address.district' => ['required', 'string', 'in:' . implode(',', config('hajjmart.districts', []))],
            'address.mobile_number' => ['nullable', 'string', 'regex:/^(?:\\+?88)?01[3-9]\\d{8}$/'],
            'address.area' => ['nullable', 'string'],
            'address.postal_code' => ['nullable', 'string', 'max:10'],

            'stripe_checkout_session_id' => ['nullable', 'string', 'required_if:payment_method,Online'],
            'stripe_payment_intent_id'   => ['nullable', 'string'],
        ]);

        $formattedProducts = [];
        foreach ($validated['ordered_products'] as $product) {
            $formattedProducts[] = [
                'product_id' => $product['id'],
                'variation_id' => $product['variation_id'] ?? null,
                'quantity' => $product['qty'],
            ];
        }

        $stripeData = [];
        if ($validated['payment_method'] === 'Online') {
            $stripeData = [
                'stripe_checkout_session_id' => $validated['stripe_checkout_session_id'] ?? null,
                'stripe_payment_intent_id'   => $validated['stripe_payment_intent_id'] ?? null,
            ];
        }

        $order = CreateOrderAction::run(
            $validated['customer_details'],
            $validated['payment_method'],
            $formattedProducts,
            $validated['address'],
            $stripeData
        );

        // For Online orders manually marked as Paid, confirm them (commits reserved inventory).
        // COD orders are already committed inside CreateOrderAction — no double-commit needed.
        if ($validated['payment_status'] === 'Paid' && $validated['payment_method'] === 'Online') {
            $order->confirm();
        }

        return response()->json([
            'success' => true,
            'message' => 'Order created successfully.',
            'data'    => $order->load('stripeIdRecord')
        ], 201);
    }

    /**
     * Display a pagination of order records with search and group sorting.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->input('per_page', 7);
        $search  = $request->input('search');

        $query = Order::with('stripeIdRecord');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('order_id', 'like', "%{$search}%")
                  ->orWhere('customer_details->name', 'like', "%{$search}%")
                  ->orWhere('customer_details->email', 'like', "%{$search}%")
                  ->orWhere('customer_details->phone', 'like', "%{$search}%");
            });
        }

        /**
         * Custom sorting: 
         * 1. Pending
         * 2. Confirmed
         * 3. Cancelled
         * Within each group, newest first.
         */
        $orders = $query->orderByRaw("
                CASE 
                    WHEN order_status = 'Pending' THEN 0
                    WHEN order_status = 'Confirmed' THEN 1
                    WHEN order_status = 'Cancelled' THEN 2
                    ELSE 3
                END
            ")
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        // Transform collection to include stripe_id directly for easier frontend consumption
        $orders->getCollection()->transform(function ($order) {
            $order->stripe_id = $order->stripeIdRecord->stripe_checkout_session_id ?? null;
            return $order;
        });

        return response()->json([
            'success' => true,
            'data'    => $orders
        ]);
    }

    /**
     * Display the specified order list.
     */
    public function show(OrderList $orderList): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data'    => $orderList
        ]);
    }

    /**
     * Delete the specified order list.
     */
    public function destroy(OrderList $orderList): JsonResponse
    {
        $orderList->delete();

        return response()->json(null, 204);
    }
}