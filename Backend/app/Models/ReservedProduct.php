<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReservedProduct extends Model
{
    protected $fillable = [
        'order_id',
        'product_id',
        'variation_id',
        'variant_id',
        'shop_id',
        'qty',
        'price',
        'total',
    ];

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