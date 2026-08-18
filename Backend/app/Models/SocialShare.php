<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SocialShare extends Model
{
    public $timestamps = false;
    protected $fillable = ['user_id', 'product_id', 'platform', 'created_at'];
    protected $casts = ['created_at' => 'datetime'];
}
