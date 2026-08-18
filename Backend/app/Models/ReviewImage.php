<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReviewImage extends Model
{
    public $timestamps = false;
    protected $fillable = ['review_id', 'path', 'created_at'];
    protected $casts = ['created_at' => 'datetime'];
}
