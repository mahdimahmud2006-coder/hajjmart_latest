<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HomepageSection extends Model
{
    protected $fillable = [
        'kind',
        'eyebrow',
        'title',
        'description',
        'cta_label',
        'cta_url',
        'image_url',
        'mobile_image_url',
        'category_id',
        'theme',
        'sort_order',
        'is_active',
        'metadata',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'metadata' => 'array',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
