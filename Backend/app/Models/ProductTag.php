<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ProductTag extends Model
{
    protected $fillable = ['name', 'slug'];

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_tag_pivot', 'tag_id', 'product_id');
    }
}
