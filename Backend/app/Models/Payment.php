<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Payment extends Model
{
    protected $fillable = [
        'order_id', 'payment_method', 'gateway', 'gateway_transaction_id', 'gateway_response',
        'amount', 'currency', 'status', 'paid_at', 'received_by', 'payment_reference', 'refunded_amount', 'refund_status',
    ];

    protected $casts = ['gateway_response' => 'array', 'amount' => 'decimal:2', 'refunded_amount' => 'decimal:2', 'paid_at' => 'datetime'];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function codDetails(): HasOne
    {
        return $this->hasOne(PaymentCodDetail::class);
    }
}
