<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfflineReconciliationAction extends Model
{
    protected $fillable = [
        'offline_inventory_session_id', 'action_type', 'order_id', 'payment_id', 'status', 'amount',
        'currency', 'reason_code', 'idempotency_key', 'attempts', 'last_error_code', 'metadata', 'completed_at',
    ];

    protected $casts = ['amount' => 'decimal:2', 'metadata' => 'array', 'completed_at' => 'datetime', 'attempts' => 'integer'];

    public function session(): BelongsTo { return $this->belongsTo(OfflineInventorySession::class, 'offline_inventory_session_id'); }
    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function payment(): BelongsTo { return $this->belongsTo(Payment::class); }
}
