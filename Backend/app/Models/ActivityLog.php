<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id', 'shop_id', 'module', 'action', 'subject_type', 'subject_id', 'description',
        'before', 'after', 'ip_address', 'user_agent',
    ];

    protected $casts = ['before' => 'array', 'after' => 'array'];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function subject(): MorphTo { return $this->morphTo(); }
}
