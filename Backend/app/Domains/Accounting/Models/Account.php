<?php

namespace App\Domains\Accounting\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Account extends Model
{
    protected $fillable = [
        'legal_entity_id', 'code', 'name', 'type', 'normal_balance', 'report_category',
        'is_control', 'is_postable', 'active_from', 'active_to',
    ];

    protected $casts = [
        'is_control' => 'boolean',
        'is_postable' => 'boolean',
        'active_from' => 'date',
        'active_to' => 'date',
    ];

    public function legalEntity(): BelongsTo
    {
        return $this->belongsTo(LegalEntity::class);
    }

    public function journalLines(): HasMany
    {
        return $this->hasMany(JournalLine::class);
    }
}
