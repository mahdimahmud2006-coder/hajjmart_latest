<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItemBatch extends Model
{
    protected $fillable = [
        'order_item_id',
        'product_batch_id',
        'quantity',
        'cost_price',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'cost_price' => 'decimal:4',
    ];

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function productBatch(): BelongsTo
    {
        return $this->belongsTo(ProductBatch::class, 'product_batch_id');
    }
}
