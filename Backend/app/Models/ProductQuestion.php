<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductQuestion extends Model
{
    public $timestamps = false;
    protected $fillable = ['product_id', 'user_id', 'question', 'created_at'];
    protected $casts = ['created_at' => 'datetime'];
    public function answers(): HasMany { return $this->hasMany(ProductAnswer::class, 'question_id'); }
}
