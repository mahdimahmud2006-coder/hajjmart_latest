<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReservedProduct extends Model
{
    protected $fillable = [
        'order_id',
        'order_item_id',
        'product_id',
        'variation_id',
        'variant_id',
        'shop_id',
        'qty',
        'price',
        'total',
        'status',
        'reservation_class',
        'source_channel',
        'reserved_at',
        'committed_at',
        'released_at',
        'release_reason',
        'metadata',
    ];

    protected $casts = [
        'reserved_at' => 'datetime',
        'committed_at' => 'datetime',
        'released_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeProtected($query)
    {
        return $query->where('reservation_class', 'protected');
    }

    public function scopePreemptible($query)
    {
        return $query->where('reservation_class', 'preemptible');
    }

    public function orderItem()
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function variation()
    {
        return $this->belongsTo(Variation::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}