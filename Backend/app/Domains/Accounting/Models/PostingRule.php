<?php

namespace App\Domains\Accounting\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PostingRule extends Model
{
    protected $fillable = [
        'legal_entity_id', 'event_type', 'conditions', 'line_template', 'version', 'is_active',
        'effective_from', 'effective_to', 'description',
    ];

    protected $casts = [
        'conditions' => 'array',
        'line_template' => 'array',
        'version' => 'integer',
        'is_active' => 'boolean',
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];

    public function legalEntity(): BelongsTo
    {
        return $this->belongsTo(LegalEntity::class);
    }

    public function journalEntries(): HasMany
    {
        return $this->hasMany(JournalEntry::class);
    }
}
