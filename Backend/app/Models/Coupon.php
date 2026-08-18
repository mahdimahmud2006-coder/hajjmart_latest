<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Coupon extends Model
{
    protected $fillable = [
        'code', 'title', 'description', 'type', 'value', 'min_order_amount', 'max_discount_amount',
        'usage_limit', 'used_count', 'is_active', 'starts_at', 'expires_at', 'applicable_to',
        'visibility', 'promotion_type', 'discount_scope', 'stackable', 'auto_apply', 'priority',
        'per_customer_limit', 'minimum_items', 'first_order_only', 'stop_further_promotions',
        'included_product_ids', 'excluded_product_ids', 'included_category_ids', 'excluded_category_ids',
        'included_districts', 'excluded_districts', 'payment_methods', 'customer_segments',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'min_order_amount' => 'decimal:2',
        'max_discount_amount' => 'decimal:2',
        'used_count' => 'integer',
        'is_active' => 'boolean',
        'starts_at' => 'datetime',
        'expires_at' => 'datetime',
        'stackable' => 'boolean',
        'auto_apply' => 'boolean',
        'priority' => 'integer',
        'per_customer_limit' => 'integer',
        'minimum_items' => 'integer',
        'first_order_only' => 'boolean',
        'stop_further_promotions' => 'boolean',
        'included_product_ids' => 'array',
        'excluded_product_ids' => 'array',
        'included_category_ids' => 'array',
        'excluded_category_ids' => 'array',
        'included_districts' => 'array',
        'excluded_districts' => 'array',
        'payment_methods' => 'array',
        'customer_segments' => 'array',
    ];

    public function usages(): HasMany
    {
        return $this->hasMany(CouponUsage::class);
    }

    public function applications(): HasMany
    {
        return $this->hasMany(CouponApplication::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)
            ->where(function (Builder $q): void {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function (Builder $q): void {
                $q->whereNull('expires_at')->orWhere('expires_at', '>=', now());
            })
            ->where(function (Builder $q): void {
                $q->whereNull('usage_limit')->orWhereColumn('used_count', '<', 'usage_limit');
            });
    }
}
