<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockTransfer extends Model
{
    protected $fillable = [
        'transfer_number', 'from_shop_id', 'to_shop_id', 'status', 'created_by', 'approved_by',
        'received_by', 'note', 'approved_at', 'received_at',
    ];
    protected $casts = ['approved_at' => 'datetime', 'received_at' => 'datetime'];

    public function fromShop(): BelongsTo { return $this->belongsTo(Shop::class, 'from_shop_id'); }
    public function toShop(): BelongsTo { return $this->belongsTo(Shop::class, 'to_shop_id'); }
    public function items(): HasMany { return $this->hasMany(StockTransferItem::class); }
}
