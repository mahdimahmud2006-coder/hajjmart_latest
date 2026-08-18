<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductAnswer extends Model
{
    public $timestamps = false;
    protected $fillable = ['question_id', 'user_id', 'is_admin', 'answer', 'created_at'];
    protected $casts = ['is_admin' => 'boolean', 'created_at' => 'datetime'];
}
