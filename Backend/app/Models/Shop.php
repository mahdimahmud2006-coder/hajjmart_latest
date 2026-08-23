<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Shop extends Model
{
    protected $fillable = [
        'name', 'code', 'slug', 'address', 'phone', 'email', 'manager_id', 'is_active', 'is_default', 'settings',
    ];

    protected $casts = ['is_active' => 'boolean', 'is_default' => 'boolean', 'settings' => 'array', 'inventory_revision' => 'integer'];

    public function orderList(): HasOne { return $this->hasOne(OrderList::class); }
    public function manager(): BelongsTo { return $this->belongsTo(User::class, 'manager_id'); }
    public function employees(): HasMany { return $this->hasMany(User::class); }
    public function inventory(): HasMany { return $this->hasMany(Inventory::class); }
    public function orders(): HasMany { return $this->hasMany(Order::class); }
    public function storeDevice(): HasOne { return $this->hasOne(StoreDevice::class); }
    public function offlineInventorySessions(): HasMany { return $this->hasMany(OfflineInventorySession::class); }

    public static function defaultStore(): self
    {
        return static::query()->where('is_default', true)->first()
            ?? static::query()->first()
            ?? static::query()->create([
                'name' => 'HajjMart Main Store',
                'code' => 'MAIN',
                'slug' => 'main-store',
                'is_active' => true,
                'is_default' => true,
            ]);
    }
}
