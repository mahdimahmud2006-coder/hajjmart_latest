<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StoreDevice extends Model
{
    protected $fillable = [
        'shop_id', 'device_uuid', 'device_token_hash', 'binding_version', 'status', 'operational_state',
        'registered_by', 'registered_at', 'last_heartbeat_at', 'last_seen_user_id', 'last_app_version',
        'replaced_at', 'replaced_by',
    ];

    protected $hidden = ['device_token_hash'];

    protected function casts(): array
    {
        return [
            'binding_version' => 'integer',
            'registered_at' => 'datetime',
            'last_heartbeat_at' => 'datetime',
            'replaced_at' => 'datetime',
        ];
    }

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function registrar(): BelongsTo { return $this->belongsTo(User::class, 'registered_by'); }
    public function lastSeenUser(): BelongsTo { return $this->belongsTo(User::class, 'last_seen_user_id'); }
    public function replacer(): BelongsTo { return $this->belongsTo(User::class, 'replaced_by'); }
    public function offlineInventorySessions(): HasMany { return $this->hasMany(OfflineInventorySession::class); }
}
