<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\StripeId;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class StripeIdController extends Controller
{
    /**
     * Manually add or update Stripe IDs for an existing order.
     * Admin only.
     */
    public function updateRecord(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id'                   => 'required|string|exists:orders,order_id',
            'stripe_checkout_session_id' => 'required|string|max:255',
            'stripe_payment_intent_id'   => 'nullable|string|max:255',
        ]);

        $order = Order::where('order_id', $validated['order_id'])->firstOrFail();

        $stripeId = StripeId::setStripeIds(
            $order,
            $validated['stripe_checkout_session_id'],
            $validated['stripe_payment_intent_id']
        );

        return response()->json([
            'success' => true,
            'message' => 'Stripe IDs updated successfully.',
            'data'    => $stripeId->load('order')
        ]);
    }
}
