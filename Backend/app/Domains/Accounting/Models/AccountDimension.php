<?php

namespace App\Domains\Accounting\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountDimension extends Model
{
    protected $fillable = ['code', 'name', 'type', 'is_required', 'is_active'];

    protected $casts = ['is_required' => 'boolean', 'is_active' => 'boolean'];

    public function values(): HasMany
    {
        return $this->hasMany(DimensionValue::class);
    }
}
