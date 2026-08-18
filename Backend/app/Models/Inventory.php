<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Inventory extends Model
{
    public $timestamps = false;
    protected $table = 'inventory';
    protected $fillable = [
        'product_id', 'variant_id', 'shop_id', 'quantity', 'reserved', 'low_stock_threshold',
        'location_note', 'bin_location', 'last_counted_at', 'updated_at',
    ];
    protected $casts = [
        'quantity' => 'integer', 'reserved' => 'integer', 'low_stock_threshold' => 'integer',
        'last_counted_at' => 'datetime', 'updated_at' => 'datetime',
    ];
    protected $appends = ['available', 'stock_health'];

    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function variant(): BelongsTo { return $this->belongsTo(ProductVariant::class, 'variant_id'); }
    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function movements(): HasMany { return $this->hasMany(StockMovement::class); }

    public function getAvailableAttribute(): int { return max(0, (int) $this->quantity - (int) $this->reserved); }
    public function getStockHealthAttribute(): string
    {
        if ($this->available <= 0) return 'out';
        if ($this->available <= (int) $this->low_stock_threshold) return 'low';
        return 'healthy';
    }
}
