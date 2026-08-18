<?php

namespace App\Domains\Accounting\Models;

use App\Domains\Accounting\Exceptions\AccountingException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JournalLine extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'journal_entry_id', 'account_id', 'line_no', 'description', 'debit', 'credit', 'currency',
        'fx_rate', 'functional_amount', 'dimensions', 'tax_transaction_id', 'source_type', 'source_id',
    ];

    protected $casts = [
        'debit' => 'decimal:2',
        'credit' => 'decimal:2',
        'fx_rate' => 'decimal:8',
        'functional_amount' => 'decimal:2',
        'dimensions' => 'array',
        'source_id' => 'integer',
    ];

    protected static function booted(): void
    {
        $guard = function (JournalLine $line): void {
            $entry = $line->journalEntry()->first();
            if ($entry && in_array($entry->status, ['posted', 'reversed'], true)) {
                throw new AccountingException('Posted journal lines are immutable; create a reversing entry instead.');
            }
        };

        static::updating($guard);
        static::deleting($guard);
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
