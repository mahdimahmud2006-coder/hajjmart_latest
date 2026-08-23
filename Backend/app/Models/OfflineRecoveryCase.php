<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfflineRecoveryCase extends Model
{
    protected $fillable = [
        'case_number',
        'shop_id',
        'store_device_id',
        'offline_inventory_session_id',
        'reason_code',
        'status',
        'opened_at',
        'opened_by_user_id',
        'evidence_json',
        'resolution_action',
        'resolved_at',
        'resolved_by_user_id',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'resolved_at' => 'datetime',
        'evidence_json' => 'array',
    ];

    public function scopeOpen($query)
    {
        return $query->where('status', 'open');
    }

    public function scopeResolved($query)
    {
        return $query->where('status', 'resolved');
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function storeDevice(): BelongsTo
    {
        return $this->belongsTo(StoreDevice::class);
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(OfflineInventorySession::class, 'offline_inventory_session_id');
    }

    public function openedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by_user_id');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_user_id');
    }
}
