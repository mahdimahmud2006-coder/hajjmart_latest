<?php

namespace App\Services;

use App\Models\DeliveryCharge;
use Stripe\Stripe;
use Stripe\Checkout\Session;
use App\Models\Order;
use Illuminate\Support\Facades\Log as Log;
use Exception;

class StripePaymentService
{
    public function __construct()
    {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    /**
     * Create Stripe checkout session with line items from order products
     */
    public function createCheckoutSession(Order $order)
    {
        // Build line items array
        $lineItems = [];

        foreach ($order->ordered_products as $product) {
            $lineItems[] = [
                'price_data' => [
                    'currency' => strtolower(config('hajjmart.currency', 'BDT')), 
                    'product_data' => [
                        'name' => $product['name'],
                    ],
                    'unit_amount' => (int)round($product['price'] * 100), 
                ],
                'quantity' => $product['qty'],
            ];
        }

        // Use delivery charge from order
        $lineItems[] = [
            'price_data' => [
                'currency' => strtolower(config('hajjmart.currency', 'BDT')),
                'product_data' => [
                    'name' => 'Delivery Charge',
                ],
                'unit_amount' => (int)round(($order->delivery_charge ?? 0) * 100),
            ],
            'quantity' => 1,
        ];

        try {
            // Create Stripe Checkout session
            return Session::create([
                'payment_method_types' => ['card'],
                'mode' => 'payment',
                'line_items' => $lineItems,
                'success_url' => rtrim(config('app.frontend_url', env('FRONTEND_URL', 'https://hajjmart.com.bd')), '/') . '/order-status/' . $order->order_id,
                'cancel_url' => rtrim(config('app.frontend_url', env('FRONTEND_URL', 'https://hajjmart.com.bd')), '/') . '/order-status/' . $order->order_id,
                'metadata' => [
                    'order_id' => $order->id,
                ],
            ]);
        } catch (Exception $e) {
            Log::error('Stripe Session creation failed', [
                'error' => $e->getMessage(),
                'order_id' => $order->id
            ]);
            throw $e;
        }
    }
}
