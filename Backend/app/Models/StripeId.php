<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StripeId extends Model
{
    protected $fillable = [
        'order_id',
        'stripe_checkout_session_id',
        'stripe_payment_intent_id',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Create or update Stripe IDs for an order.
     * Only applicable if payment method is 'Online'.
     */
    public static function setStripeIds(Order $order, string $checkoutId, ?string $paymentIntentId = null): self
    {
        return self::updateOrCreate(
            ['order_id' => $order->id],
            [
                'stripe_checkout_session_id' => $checkoutId,
                'stripe_payment_intent_id'   => $paymentIntentId,
            ]
        );
    }
}
