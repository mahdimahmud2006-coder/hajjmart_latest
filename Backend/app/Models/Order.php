<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    protected $fillable = [
        'order_list_id', 'order_id', 'order_number', 'customer_id', 'checkout_name',
        'checkout_country', 'checkout_full_address', 'checkout_district', 'checkout_mobile_number',
        'checkout_email', 'create_account_requested', 'ship_to_different_address',
        'shipping_full_address', 'shipping_district', 'shipping_mobile_number', 'shipping_email',
        'checkout_note', 'status', 'order_status', 'payment_status', 'payment_method',
        'payment_channel', 'terms_accepted', 'source_channel', 'price_mode', 'subtotal', 'tax_total',
        'shipping_total', 'delivery_method', 'discount_total', 'coupon_code', 'coupon_codes',
        'promotion_snapshot', 'net_subtotal', 'item_discount_total', 'shipping_discount_total',
        'grand_total', 'total_cogs', 'gross_profit', 'refund_total', 'exchange_due_total',
        'currency', 'shipping_address_snapshot', 'billing_address_snapshot', 'customer_note',
        'admin_note', 'shop_id', 'created_by', 'assigned_to', 'order_date', 'paid_amount', 'due_amount',
        'source_reference', 'terminal_id', 'client_transaction_id', 'checkout_idempotency_key', 'offline_created_at', 'synced_at', 'priority', 'delivery_status', 'placed_at', 'confirmed_at', 'shipped_at', 'delivered_at', 'cancelled_at',
        'ordered_products', 'customer_details', 'address', 'delivery_charge', 'total_price',
    ];

    protected $casts = [
        'ordered_products' => 'array',
        'customer_details' => 'array',
        'address' => 'array',
        'shipping_address_snapshot' => 'array',
        'billing_address_snapshot' => 'array',
        'coupon_codes' => 'array',
        'promotion_snapshot' => 'array',
        'delivery_charge' => 'decimal:2',
        'total_price' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'net_subtotal' => 'decimal:2',
        'item_discount_total' => 'decimal:2',
        'shipping_discount_total' => 'decimal:2',
        'create_account_requested' => 'boolean',
        'ship_to_different_address' => 'boolean',
        'terms_accepted' => 'boolean',
        'tax_total' => 'decimal:2',
        'shipping_total' => 'decimal:2',
        'discount_total' => 'decimal:2',
        'grand_total' => 'decimal:2',
        'total_cogs' => 'decimal:2',
        'gross_profit' => 'decimal:2',
        'refund_total' => 'decimal:2',
        'exchange_due_total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'due_amount' => 'decimal:2',
        'order_date' => 'datetime',
        'offline_created_at' => 'datetime',
        'synced_at' => 'datetime',
        'placed_at' => 'datetime',
        'confirmed_at' => 'datetime',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function orderList(): BelongsTo
    {
        return $this->belongsTo(OrderList::class);
    }

    public function stripeIdRecord(): HasOne
    {
        return $this->hasOne(StripeId::class);
    }

    public function reservedProducts(): HasMany
    {
        return $this->hasMany(ReservedProduct::class);
    }


    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    public function couponApplications(): HasMany
    {
        return $this->hasMany(CouponApplication::class);
    }

    public function returnRequests(): HasMany
    {
        return $this->hasMany(ReturnRequest::class);
    }

    public function scopePending(Builder $query): void
    {
        $query->where(function (Builder $q): void {
            $q->where('order_status', 'Pending')->orWhere('status', 'pending');
        });
    }

    public function scopeConfirmed(Builder $query): void
    {
        $query->where(function (Builder $q): void {
            $q->where('order_status', 'Confirmed')->orWhere('status', 'confirmed');
        });
    }

    public function confirm(): bool
    {
        if ($this->order_status === 'Confirmed' && $this->payment_status === 'Paid') {
            return false;
        }

        try {
            if ($this->reservedProducts()->exists()) {
                \App\Actions\CommitInventoryAction::run($this);
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Inventory commit failed during order confirmation: ' . $e->getMessage());
            return false;
        }

        return $this->update([
            'order_status' => 'Confirmed',
            'payment_status' => 'Paid',
        ]);
    }

    public static function findByOrderId(string $orderId): ?self
    {
        return self::where('order_id', $orderId)
            ->with(['stripeIdRecord', 'orderList'])
            ->first();
    }

    public static function generateUniqueId(): string
    {
        do {
            $id = str_pad((string) random_int(0, 9999999), 7, '0', STR_PAD_LEFT);
        } while (self::where('order_id', $id)->exists());

        return $id;
    }
}
