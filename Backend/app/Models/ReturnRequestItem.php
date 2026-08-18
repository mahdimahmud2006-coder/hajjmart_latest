<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReturnRequestItem extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'return_request_id', 'order_item_id', 'quantity', 'reason', 'condition_note',
        'exchange_product_id', 'exchange_variant_id', 'unit_price', 'line_subtotal',
        'prorated_discount_amount', 'refundable_amount', 'exchange_unit_price',
        'exchange_line_total', 'exchange_price_difference', 'exchange_amount_due', 'exchange_refund_due',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'line_subtotal' => 'decimal:2',
        'prorated_discount_amount' => 'decimal:2',
        'refundable_amount' => 'decimal:2',
        'exchange_unit_price' => 'decimal:2',
        'exchange_line_total' => 'decimal:2',
        'exchange_price_difference' => 'decimal:2',
        'exchange_amount_due' => 'decimal:2',
        'exchange_refund_due' => 'decimal:2',
    ];

    public function returnRequest(): BelongsTo
    {
        return $this->belongsTo(ReturnRequest::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function exchangeProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'exchange_product_id');
    }

    public function exchangeVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'exchange_variant_id');
    }
}
