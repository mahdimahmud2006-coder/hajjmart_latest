<?php

namespace App\Domains\Accounting\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LegalEntity extends Model
{
    protected $fillable = [
        'code', 'name', 'functional_currency', 'fiscal_year_start_month', 'is_default', 'is_active',
    ];

    protected $casts = [
        'fiscal_year_start_month' => 'integer',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function accounts(): HasMany
    {
        return $this->hasMany(Account::class);
    }

    public function fiscalPeriods(): HasMany
    {
        return $this->hasMany(FiscalPeriod::class);
    }

    public function journalEntries(): HasMany
    {
        return $this->hasMany(JournalEntry::class);
    }
}
