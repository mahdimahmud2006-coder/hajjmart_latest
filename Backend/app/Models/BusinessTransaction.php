<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class BusinessTransaction extends Model
{
    protected $fillable = [
        'transaction_number', 'shop_id', 'type', 'category', 'amount', 'payment_method',
        'reason', 'reference', 'attachment_path', 'occurred_at', 'status', 'created_by',
        'approved_by', 'meta',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'occurred_at' => 'datetime',
        'meta' => 'array',
    ];

    protected $appends = ['attachment_url'];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function approver(): BelongsTo { return $this->belongsTo(User::class, 'approved_by'); }

    public function getAttachmentUrlAttribute(): ?string
    {
        return $this->attachment_path ? url(Storage::disk('public')->url($this->attachment_path)) : null;
    }
}
