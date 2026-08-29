<?php

namespace App\Actions;

use App\Models\Order;
use App\Models\OrderList;
use App\Models\Product;
use App\Models\DeliveryCharge;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Exception;

class CreateOrderAction
{
    /**
     * Execute the order creation process.
     *
     * @param array $customerDetails
     * @param string $paymentMethod
     * @param array $orderedProducts [productId => qty]
     * @param array $address
     * @param array $stripeData [checkoutId, paymentId]
     * @return Order
     * @throws Exception
     */
    public function execute(
        array $customerDetails,
        string $paymentMethod,
        array $orderedProducts,
        array $address,
        array $stripeData = []
    ): Order {
        return DB::transaction(function () use ($customerDetails, $paymentMethod, $orderedProducts, $address, $stripeData) {
            $processedProducts = [];
            $subtotal = 0;

            foreach ($orderedProducts as $itemRequest) {
                $productId = $itemRequest['product_id'];
                $variationId = $itemRequest['variation_id'] ?? null;
                $qty = $itemRequest['quantity'];

                $product = Product::with('variations')->find($productId);

                if (!$product) {
                    throw new ModelNotFoundException("Product ID {$productId} not found.");
                }

                if ($product->has_variations && !$variationId) {
                    throw new Exception("Variation selection required for product: {$product->name}.");
                }

                $price = (float) $product->getPriceForQuantity((int) $qty, $variationId);
                $variationName = null;
                if ($variationId && $product->has_variations) {
                     $variation = $product->variations->find($variationId);
                     if ($variation) {
                         $variationName = $variation->name;
                     }
                }

                $lineTotal = $price * (int) $qty;
                $subtotal += $lineTotal;

                $processedProducts[] = [
                    'id'    => $product->id,
                    'variation_id' => $variationId,
                    'name'  => $variationName ? $product->name . ' (' . $variationName . ')' : $product->name,
                    'qty'   => (int) $qty,
                    'price' => $price,
                    'total' => $lineTotal,
                ];
            }

            // Calculate Bangladesh home-delivery charge (default ৳80 unless changed in settings).
            $deliveryCharge = DeliveryCharge::calculate();

            $totalPrice = $subtotal + $deliveryCharge;

            $billingSnapshot = [
                'name' => $customerDetails['name'] ?? null,
                'country' => $address['country'] ?? 'Bangladesh',
                'full_address' => $address['full_address'] ?? $address['line1'] ?? null,
                'district' => $address['district'] ?? null,
                'mobile_number' => $address['mobile_number'] ?? $customerDetails['phone'] ?? null,
                'email' => $customerDetails['email'] ?? null,
            ];

            // Get or create OrderList
            $orderList = OrderList::firstOrCreate();

            // Create Order
            $order = $orderList->orders()->create([
                'order_id'         => Order::generateUniqueId(),
                'status'           => 'confirmed',
                'order_status'     => 'Confirmed',
                'payment_status'   => 'Unpaid',
                'payment_method'   => $paymentMethod,
                'payment_channel'  => $paymentMethod === 'COD' ? 'cash' : 'sslcommerz',
                'terms_accepted'   => true,
                'source_channel'   => 'website',
                'checkout_name' => $billingSnapshot['name'],
                'checkout_country' => $billingSnapshot['country'],
                'checkout_full_address' => $billingSnapshot['full_address'],
                'checkout_district' => $billingSnapshot['district'],
                'checkout_mobile_number' => $billingSnapshot['mobile_number'],
                'checkout_email' => $billingSnapshot['email'],
                'shipping_full_address' => $billingSnapshot['full_address'],
                'shipping_district' => $billingSnapshot['district'],
                'shipping_mobile_number' => $billingSnapshot['mobile_number'],
                'shipping_email' => $billingSnapshot['email'],
                'subtotal' => $subtotal,
                'shipping_total' => $deliveryCharge,
                'delivery_method' => 'home_delivery',
                'grand_total' => $totalPrice,
                'currency' => config('hajjmart.currency', 'BDT'),
                'shipping_address_snapshot' => $billingSnapshot,
                'billing_address_snapshot' => $billingSnapshot,
                'placed_at' => now(),
                'confirmed_at' => now(),
                'ordered_products' => $processedProducts,
                'customer_details' => $customerDetails,
                'address'          => $billingSnapshot,
                'delivery_charge'  => $deliveryCharge,
                'total_price'      => $totalPrice,
            ]);

            // If stripe data is provided and method is Online
            if ($paymentMethod === 'Online' && !empty($stripeData['stripe_checkout_session_id'])) {
                \App\Models\StripeId::setStripeIds(
                    $order,
                    $stripeData['stripe_checkout_session_id'],
                    $stripeData['stripe_payment_intent_id'] ?? null
                );
            }

            // Preserve legacy COD payment behavior. All orders are already
            // confirmed by default; fraud screening may move them to pending.
            if ($paymentMethod === 'COD') {
                $order->update([
                    'payment_status' => 'Paid',
                ]);
            }

            ReserveInventoryAction::run($order->fresh());
            \App\Jobs\CheckOrderFraudJob::dispatch($order->id)->afterCommit();

            return $order;
        });
    }

    /**
     * Static helper for running the action.
     */
    public static function run(array $customerDetails, string $paymentMethod, array $orderedProducts, array $address, array $stripeData = []): Order
    {
        return (new self())->execute($customerDetails, $paymentMethod, $orderedProducts, $address, $stripeData);
    }
}