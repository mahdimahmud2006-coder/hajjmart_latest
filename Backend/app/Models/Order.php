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
        'shipping_total', 'delivery_method', 'delivery_area', 'discount_total', 'coupon_code', 'coupon_codes',
        'promotion_snapshot', 'net_subtotal', 'item_discount_total', 'shipping_discount_total',
        'grand_total', 'total_cogs', 'gross_profit', 'refund_total', 'exchange_due_total',
        'currency', 'shipping_address_snapshot', 'billing_address_snapshot', 'customer_note',
        'admin_note', 'shop_id', 'created_by', 'assigned_to', 'packed_by', 'order_date', 'paid_amount', 'due_amount',
        'source_reference', 'terminal_id', 'client_transaction_id', 'offline_inventory_session_id', 'local_sequence', 'reconciliation_status', 'preempted_by_session_id', 'cancellation_reason_code', 'checkout_idempotency_key', 'offline_created_at', 'synced_at', 'priority', 'delivery_status', 'placed_at', 'confirmed_at', 'shipped_at', 'delivered_at', 'cancelled_at',
        'offline_recovery_case_id', 'manual_outage_reference', 'manual_outage_occurred_at',
        'ordered_products', 'customer_details', 'address', 'delivery_charge', 'total_price', 'invoice_printed_at', 'pathao_consignment_id',
        'is_potential_fraud', 'fraud_score', 'fraud_reasons', 'fraud_checked_at',
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
        'local_sequence' => 'integer',
        'order_date' => 'datetime',
        'offline_created_at' => 'datetime',
        'synced_at' => 'datetime',
        'placed_at' => 'datetime',
        'confirmed_at' => 'datetime',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'invoice_printed_at' => 'datetime',
        'is_potential_fraud' => 'boolean',
        'fraud_score' => 'integer',
        'fraud_reasons' => 'array',
        'fraud_checked_at' => 'datetime',
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

    public function activeReservedProducts(): HasMany
    {
        return $this->hasMany(ReservedProduct::class)->where('status', 'active');
    }


    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function offlineInventorySession(): BelongsTo
    {
        return $this->belongsTo(OfflineInventorySession::class);
    }

    public function preemptedBySession(): BelongsTo
    {
        return $this->belongsTo(OfflineInventorySession::class, 'preempted_by_session_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function packer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'packed_by');
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

    public function scopePotentialFraud(Builder $query): void
    {
        $query->where('is_potential_fraud', true);
    }

    public function confirm(): bool
    {
        if ($this->order_status === 'Confirmed' && $this->status === 'confirmed' && ! $this->is_potential_fraud) {
            return false;
        }

        return $this->update([
            'status' => 'confirmed',
            'order_status' => 'Confirmed',
            'is_potential_fraud' => false,
            'confirmed_at' => $this->confirmed_at ?: now(),
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
