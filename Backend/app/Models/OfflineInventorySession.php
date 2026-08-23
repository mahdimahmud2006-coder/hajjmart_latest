<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OfflineInventorySession extends Model
{
    protected $fillable = [
        'session_id', 'snapshot_id', 'shop_id', 'store_device_id', 'binding_version',
        'boundary_server_at', 'opening_inventory_revision', 'status', 'opened_at',
        'last_client_sequence', 'reconciling_at', 'closed_at', 'recovery_reason_code',
        'reconciliation_summary_json',
    ];

    protected $casts = [
        'binding_version' => 'integer',
        'boundary_server_at' => 'datetime',
        'opening_inventory_revision' => 'integer',
        'opened_at' => 'datetime',
        'last_client_sequence' => 'integer',
        'reconciling_at' => 'datetime',
        'closed_at' => 'datetime',
        'reconciliation_summary_json' => 'array',
    ];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function storeDevice(): BelongsTo { return $this->belongsTo(StoreDevice::class); }
    public function snapshotItems(): HasMany { return $this->hasMany(OfflineInventorySnapshotItem::class); }
    public function eventReceipts(): HasMany { return $this->hasMany(OfflineEventReceipt::class); }
    public function reconciliationActions(): HasMany { return $this->hasMany(OfflineReconciliationAction::class); }
}
