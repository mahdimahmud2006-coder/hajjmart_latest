<?php

namespace App\Http\Controllers;

use App\Models\DeliveryCharge;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class DeliveryChargeController extends Controller
{
    /**
     * Calculate and display delivery charge.
     */
    /**
     * Get the current global delivery charge.
     */
    public function getDeliveryCharge(): JsonResponse
    {
        $charge = DeliveryCharge::calculate();

        return response()->json([
            'success'         => true,
            'delivery_charge' => $charge
        ]);
    }

    /**
     * Update the global delivery charge.
     */
    public function updateDeliveryCharge(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'delivery_charge' => 'required|numeric|min:0'
        ]);

        \App\Models\SiteSetting::setValue('delivery_charge', $validated['delivery_charge']);

        return response()->json([
            'success' => true,
            'message' => 'Delivery charge updated successfully.',
            'delivery_charge' => $validated['delivery_charge']
        ]);
    }
}
