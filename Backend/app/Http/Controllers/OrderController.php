<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderList;
use App\Services\StripePaymentService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Exception;

class OrderController extends Controller
{
    /**
     * Get order by business ID (order_id string).
     */
    public function getOrderById(string $order_id): JsonResponse
    {
        $order = Order::where('order_id', $order_id)
            ->with('stripeIdRecord')
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data'    => $order
        ]);
    }

    /**
     * Confirm order payment (Manual Admin Action).
     */
    public function confirmOrderPayment(string $order_id): JsonResponse
    {
        $order = Order::where('order_id', $order_id)->firstOrFail();

        if (!$order->confirm()) {
            throw new \RuntimeException('Order already confirmed or cannot be confirmed.');
        }

        return response()->json([
            'success' => true,
            'message' => 'Order payment confirmed.',
            'data'    => $order->fresh()
        ]);
    }

    /**
     * Generate Stripe checkout URL for manual payment of a pending order.
     */
    public function manualOrderPayment(Request $request, StripePaymentService $stripePaymentService): JsonResponse
    {
        $request->validate([
            'order_id' => 'required|string',
        ]);

        $order = Order::where('order_id', $request->order_id)->firstOrFail();

        if ($order->order_status !== 'Pending' || $order->payment_status === 'Paid') {
            throw new \RuntimeException('This order is not eligible for manual payment.');
        }

        $session = $stripePaymentService->createCheckoutSession($order);

        return response()->json([
            'success' => true,
            'checkout_url' => $session->url,
            'order' => $order
        ]);
    }

    /**
     * Update order details.
     */
    public function updateOrder(Request $request, string $order_id): JsonResponse
    {
        $validated = $request->validate([
            'order_status'               => 'nullable|string|in:Pending,Confirmed,Cancelled',
            'payment_method'             => 'nullable|string|in:COD,Online',
            'payment_status'             => 'nullable|string|in:Unpaid,Paid,Failed',
            'ordered_products'           => 'nullable|array',
            'customer_details'           => 'nullable|array',
            'address'                    => 'nullable|array',
            'delivery_charge'            => 'nullable|numeric|min:0',
            'total_price'                => 'nullable|numeric|min:0',
            'stripe_checkout_session_id' => 'nullable|string',
            'stripe_payment_intent_id'   => 'nullable|string',
        ]);

        $order = Order::where('order_id', $order_id)->firstOrFail();

        // If payment method is being changed to Online and Stripe IDs are provided
        if (($validated['payment_method'] ?? $order->payment_method) === 'Online' && !empty($validated['stripe_checkout_session_id'])) {
            \App\Models\StripeId::setStripeIds(
                $order,
                $validated['stripe_checkout_session_id'],
                $validated['stripe_payment_intent_id'] ?? null
            );
        }

        $order->update(collect($validated)->except(['stripe_checkout_session_id', 'stripe_payment_intent_id'])->toArray());

        // If payment status is changed to Paid, trigger confirmation logic
        if (isset($validated['payment_status']) && $validated['payment_status'] === 'Paid') {
            $order->confirm();
        }

        return response()->json([
            'success' => true,
            'message' => 'Order updated.',
            'data'    => $order->fresh()->load('stripeIdRecord')
        ]);
    }

    /**
     * Delete an order.
     */
    public function deleteOrder(string $order_id): JsonResponse
    {
        $order = Order::where('order_id', $order_id)->firstOrFail();

        $order->delete();

        return response()->json(null, 204);
    }
}