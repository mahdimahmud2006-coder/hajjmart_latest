<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReturnRequest extends Model
{
    protected $fillable = [
        'rr_number', 'order_id', 'customer_id', 'type', 'status', 'reason', 'customer_note',
        'admin_note', 'approved_by', 'approved_at', 'refund_total', 'exchange_credit_total',
        'exchange_due_total', 'promotion_adjustment_total', 'resolved_at', 'shop_id', 'created_by',
        'resolution_type', 'refund_method', 'restock_strategy',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'resolved_at' => 'datetime',
        'refund_total' => 'decimal:2',
        'exchange_credit_total' => 'decimal:2',
        'exchange_due_total' => 'decimal:2',
        'promotion_adjustment_total' => 'decimal:2',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ReturnRequestItem::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(ReturnStatusHistory::class);
    }
}
