<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\DeliveryCharge;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class DeliveryChargeController extends Controller
{
    use ApiResponse;

    public function show()
    {
        return $this->success($this->payload(), 'Delivery charges retrieved.');
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'inside_dhaka' => ['required', 'numeric', 'min:1'],
            'outside_dhaka' => ['required', 'numeric', 'min:1'],
        ]);

        DeliveryCharge::updateRates((float) $data['inside_dhaka'], (float) $data['outside_dhaka']);

        return $this->success($this->payload(), 'Delivery charges updated.');
    }

    private function payload(): array
    {
        $rates = DeliveryCharge::rates();

        return [
            'inside_dhaka' => $rates[DeliveryCharge::INSIDE_DHAKA],
            'outside_dhaka' => $rates[DeliveryCharge::OUTSIDE_DHAKA],
        ];
    }
}
