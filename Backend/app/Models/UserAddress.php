<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserAddress extends Model
{
    protected $fillable = [
        'user_id', 'label', 'recipient_name', 'phone', 'mobile_number', 'email',
        'country', 'full_address', 'address_line_1', 'address_line_2', 'city',
        'district', 'division', 'upazila', 'area', 'landmark', 'postal_code', 'is_default',
    ];

    protected $casts = ['is_default' => 'boolean'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
