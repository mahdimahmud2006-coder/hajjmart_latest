<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentCodDetail extends Model
{
    public $timestamps = false;
    protected $fillable = ['payment_id', 'collected_by', 'collected_at', 'note'];
    protected $casts = ['collected_at' => 'datetime'];
}
