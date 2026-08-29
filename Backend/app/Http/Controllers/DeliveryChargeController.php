<?php

namespace App\Http\Controllers;

use App\Models\DeliveryCharge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryChargeController extends Controller
{
    public function getDeliveryCharge(): JsonResponse
    {
        $rates = DeliveryCharge::rates();

        return response()->json([
            'success' => true,
            'inside_dhaka' => $rates[DeliveryCharge::INSIDE_DHAKA],
            'outside_dhaka' => $rates[DeliveryCharge::OUTSIDE_DHAKA],
        ]);
    }

    public function updateDeliveryCharge(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'inside_dhaka' => ['required', 'numeric', 'min:1'],
            'outside_dhaka' => ['required', 'numeric', 'min:1'],
        ]);

        $rates = DeliveryCharge::updateRates(
            (float) $validated['inside_dhaka'],
            (float) $validated['outside_dhaka'],
        );

        return response()->json([
            'success' => true,
            'message' => 'Delivery charges updated successfully.',
            'inside_dhaka' => $rates[DeliveryCharge::INSIDE_DHAKA],
            'outside_dhaka' => $rates[DeliveryCharge::OUTSIDE_DHAKA],
        ]);
    }
}
