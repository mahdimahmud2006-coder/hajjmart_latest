<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ProductVariant extends Model
{
    protected $fillable = [
        'product_id', 'source_variation_id', 'sku', 'barcode', 'price', 'sale_price', 'retail_price', 'wholesale_price', 'regular_price',
        'cost_price', 'image_id', 'attributes_json', 'attribute_labels', 'attribute_values',
        'variation_description', 'weight', 'dimensions_json', 'in_stock', 'purchasable',
        'available_for_purchase', 'image_json', 'is_active',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'retail_price' => 'decimal:2',
        'wholesale_price' => 'decimal:2',
        'regular_price' => 'decimal:2',
        'cost_price' => 'decimal:2',
        'attributes_json' => 'array',
        'attribute_labels' => 'array',
        'attribute_values' => 'array',
        'dimensions_json' => 'array',
        'image_json' => 'array',
        'in_stock' => 'boolean',
        'purchasable' => 'boolean',
        'available_for_purchase' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function image(): BelongsTo
    {
        return $this->belongsTo(ProductImage::class, 'image_id');
    }

    public function attributeValues(): BelongsToMany
    {
        return $this->belongsToMany(ProductAttributeValue::class, 'product_variant_attribute_values', 'variant_id', 'attribute_value_id');
    }

    public function inventory(): HasOne
    {
        return $this->hasOne(Inventory::class, 'variant_id');
    }
}
