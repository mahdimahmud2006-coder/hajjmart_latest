<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens, SoftDeletes;

    protected $fillable = [
        'name', 'name_bn', 'email', 'phone', 'password', 'avatar', 'address_default_id', 'is_active', 'role',
        'employee_code', 'designation', 'employment_type', 'shop_id', 'joined_at', 'last_login_at',
        'created_by', 'notes',
    ];

    protected $hidden = ['password', 'remember_token'];
    protected $appends = ['permission_names', 'role_names'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'joined_at' => 'date',
            'last_login_at' => 'datetime',
        ];
    }

    public function addresses(): HasMany { return $this->hasMany(UserAddress::class); }
    public function orders(): HasMany { return $this->hasMany(Order::class, 'customer_id'); }
    public function cartItems(): HasMany { return $this->hasMany(CustomerCartItem::class); }
    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_user')->with('permissions');
    }

    public function hasAnyRole(array $roles): bool
    {
        if (in_array($this->role, $roles, true)) {
            return true;
        }

        return $this->roles()->where(function ($query) use ($roles): void {
            $query->whereIn('name', $roles)->orWhereIn('slug', $roles);
        })->exists();
    }

    public function hasPermission(string $permission): bool
    {
        if (in_array($this->role, ['admin', 'super_admin'], true)) {
            return true;
        }

        return $this->roles()
            ->where('roles.is_active', true)
            ->whereHas('permissions', fn ($query) => $query->where('permissions.name', $permission))
            ->exists();
    }

    public function canAccessAdmin(): bool
    {
        if (in_array($this->role, ['admin', 'super_admin'], true)) {
            return true;
        }

        return $this->roles()
            ->where('roles.is_active', true)
            ->whereHas('permissions')
            ->exists();
    }

    public function getPermissionNamesAttribute(): array
    {
        if (in_array($this->role, ['admin', 'super_admin'], true)) {
            return ['*'];
        }

        if (! $this->relationLoaded('roles')) {
            $this->loadMissing('roles.permissions');
        }

        return $this->roles->flatMap(fn (Role $role) => $role->permissions->pluck('name'))->unique()->values()->all();
    }

    public function getRoleNamesAttribute(): array
    {
        if (! $this->relationLoaded('roles')) {
            $this->loadMissing('roles');
        }

        return collect([$this->role])->merge($this->roles->pluck('slug'))->filter()->unique()->values()->all();
    }
}
