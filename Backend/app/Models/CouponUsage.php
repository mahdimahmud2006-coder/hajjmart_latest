<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CouponUsage extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'coupon_id', 'user_id', 'order_id', 'guest_email', 'guest_phone', 'discount_amount', 'snapshot', 'created_at',
    ];

    protected $casts = [
        'discount_amount' => 'decimal:2',
        'snapshot' => 'array',
        'created_at' => 'datetime',
    ];

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
