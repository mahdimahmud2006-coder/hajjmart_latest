<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductReview extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'product_id', 'user_id', 'order_item_id', 'rating', 'title', 'body', 'is_approved',
        'is_featured', 'helpful_count', 'guest_name', 'guest_email', 'guest_phone',
        'order_number', 'is_guest', 'verified_purchase', 'status', 'approved_at', 'rejected_at',
        'approved_by', 'admin_note', 'source_channel', 'ip_address', 'user_agent',
    ];

    protected $casts = [
        'rating' => 'integer',
        'is_approved' => 'boolean',
        'is_featured' => 'boolean',
        'helpful_count' => 'integer',
        'is_guest' => 'boolean',
        'verified_purchase' => 'boolean',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function images(): HasMany
    {
        return $this->hasMany(ReviewImage::class, 'review_id');
    }
}
