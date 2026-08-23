<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfflineEventReceipt extends Model
{
    protected $fillable = [
        'shop_id', 'store_device_id', 'offline_inventory_session_id', 'client_transaction_id',
        'local_sequence', 'event_type', 'event_hash', 'server_order_id', 'result_code', 'result_json',
    ];

    protected $casts = ['local_sequence' => 'integer', 'result_json' => 'array'];

    public function session(): BelongsTo { return $this->belongsTo(OfflineInventorySession::class, 'offline_inventory_session_id'); }
    public function device(): BelongsTo { return $this->belongsTo(StoreDevice::class, 'store_device_id'); }
    public function order(): BelongsTo { return $this->belongsTo(Order::class, 'server_order_id'); }
}
