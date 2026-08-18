<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CouponApplication extends Model
{
    protected $fillable = [
        'order_id', 'coupon_id', 'code', 'promotion_type', 'visibility', 'discount_scope',
        'base_amount', 'item_discount_amount', 'shipping_discount_amount', 'discount_amount', 'snapshot',
    ];

    protected $casts = [
        'base_amount' => 'decimal:2',
        'item_discount_amount' => 'decimal:2',
        'shipping_discount_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'snapshot' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }
}
