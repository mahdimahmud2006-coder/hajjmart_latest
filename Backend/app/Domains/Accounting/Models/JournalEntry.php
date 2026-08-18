<?php

namespace App\Domains\Accounting\Models;

use App\Domains\Accounting\Exceptions\AccountingException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JournalEntry extends Model
{
    protected $fillable = [
        'legal_entity_id', 'fiscal_period_id', 'posting_date', 'document_date', 'source_type', 'source_id',
        'posting_rule_id', 'posting_rule_version', 'status', 'idempotency_key', 'reversal_of_id',
        'description', 'metadata', 'created_by', 'posted_at',
    ];

    protected $casts = [
        'posting_date' => 'date',
        'document_date' => 'date',
        'source_id' => 'integer',
        'posting_rule_version' => 'integer',
        'metadata' => 'array',
        'posted_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(function (JournalEntry $entry): void {
            if (! in_array($entry->getOriginal('status'), ['posted', 'reversed'], true)) {
                return;
            }

            $dirty = array_keys($entry->getDirty());
            $allowed = $entry->getOriginal('status') === 'posted' && $entry->status === 'reversed'
                ? ['status', 'updated_at']
                : ['updated_at'];

            if (array_diff($dirty, $allowed) !== []) {
                throw new AccountingException('Posted journal entries are append-only; only a reversal status transition is allowed.');
            }
            if ($entry->getOriginal('status') === 'reversed' && $entry->status !== 'reversed') {
                throw new AccountingException('A reversed journal entry cannot be reopened or changed.');
            }
        });

        static::deleting(function (JournalEntry $entry): void {
            if (in_array($entry->status, ['posted', 'reversed'], true)) {
                throw new AccountingException('Posted journal entries are append-only and cannot be deleted.');
            }
        });
    }

    public function legalEntity(): BelongsTo
    {
        return $this->belongsTo(LegalEntity::class);
    }

    public function fiscalPeriod(): BelongsTo
    {
        return $this->belongsTo(FiscalPeriod::class);
    }

    public function postingRule(): BelongsTo
    {
        return $this->belongsTo(PostingRule::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(JournalLine::class)->orderBy('line_no');
    }

    public function reversalOf(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reversal_of_id');
    }

    public function reversals(): HasMany
    {
        return $this->hasMany(self::class, 'reversal_of_id');
    }
}
