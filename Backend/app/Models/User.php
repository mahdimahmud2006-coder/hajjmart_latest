<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens, SoftDeletes;

    protected $fillable = [
        'name', 'name_bn', 'email', 'phone', 'password', 'avatar', 'address_default_id', 'is_active',
        'is_employee', 'is_admin', 'employee_code', 'designation', 'shop_id', 'joined_at', 'last_login_at',
        'created_by', 'notes',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'is_employee' => 'boolean',
            'is_admin' => 'boolean',
            'joined_at' => 'date',
            'last_login_at' => 'datetime',
        ];
    }

    public function addresses(): HasMany { return $this->hasMany(UserAddress::class); }
    public function orders(): HasMany { return $this->hasMany(Order::class, 'customer_id'); }
    public function cartItems(): HasMany { return $this->hasMany(CustomerCartItem::class); }
    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
}
