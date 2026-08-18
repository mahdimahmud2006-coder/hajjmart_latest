<?php

namespace App\Domains\Accounting\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DimensionValue extends Model
{
    protected $fillable = [
        'account_dimension_id', 'code', 'label', 'external_type', 'external_id', 'is_active',
    ];

    protected $casts = ['external_id' => 'integer', 'is_active' => 'boolean'];

    public function dimension(): BelongsTo
    {
        return $this->belongsTo(AccountDimension::class, 'account_dimension_id');
    }
}
