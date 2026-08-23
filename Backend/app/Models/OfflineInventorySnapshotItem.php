<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfflineInventorySnapshotItem extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'offline_inventory_session_id', 'product_id', 'variant_id', 'variant_key',
        'sku_snapshot', 'product_name_snapshot', 'opening_quantity', 'opening_reserved',
        'opening_available', 'retail_price', 'wholesale_price', 'sell_on_pos',
        'sell_on_social', 'product_active',
    ];

    protected $casts = [
        'variant_key' => 'integer',
        'opening_quantity' => 'integer',
        'opening_reserved' => 'integer',
        'opening_available' => 'integer',
        'retail_price' => 'decimal:2',
        'wholesale_price' => 'decimal:2',
        'sell_on_pos' => 'boolean',
        'sell_on_social' => 'boolean',
        'product_active' => 'boolean',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(OfflineInventorySession::class, 'offline_inventory_session_id');
    }

    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function variant(): BelongsTo { return $this->belongsTo(ProductVariant::class, 'variant_id'); }
}
