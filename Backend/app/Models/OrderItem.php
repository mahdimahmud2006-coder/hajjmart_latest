<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id', 'product_id', 'variant_id', 'batch_id', 'category_id', 'product_snapshot', 'quantity',
        'unit_price', 'price_mode', 'unit_cost', 'tax_rate', 'discount_amount', 'line_subtotal',
        'line_discount_total', 'line_tax_total', 'line_total', 'line_grand_total',
        'discount_snapshot', 'cogs_total', 'gross_profit', 'refunded_quantity',
        'refunded_amount', 'exchanged_quantity', 'item_status',
    ];

    protected $casts = [
        'product_snapshot' => 'array',
        'discount_snapshot' => 'array',
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'line_subtotal' => 'decimal:2',
        'line_discount_total' => 'decimal:2',
        'line_tax_total' => 'decimal:2',
        'line_total' => 'decimal:2',
        'line_grand_total' => 'decimal:2',
        'unit_cost' => 'decimal:2',
        'cogs_total' => 'decimal:2',
        'gross_profit' => 'decimal:2',
        'refunded_quantity' => 'integer',
        'refunded_amount' => 'decimal:2',
        'exchanged_quantity' => 'integer',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ProductBatch::class, 'batch_id');
    }

    public function itemBatches(): HasMany
    {
        return $this->hasMany(OrderItemBatch::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function getRefundableUnitAmountAttribute(): float
    {
        $qty = max(1, (int) $this->quantity);
        return round(((float) ($this->line_grand_total ?: $this->line_total) / $qty), 2);
    }

    public function getRemainingReturnableQuantityAttribute(): int
    {
        return max(0, (int) $this->quantity - (int) $this->refunded_quantity - (int) $this->exchanged_quantity);
    }
}
