<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DailySalesSummary extends Model
{
    protected $fillable = [
        'date', 'total_orders', 'cancelled_orders', 'total_revenue', 'total_cogs',
        'gross_profit', 'total_refunds', 'total_items_sold', 'district_breakdown',
    ];

    protected $casts = [
        'date' => 'date',
        'total_revenue' => 'decimal:2',
        'total_cogs' => 'decimal:2',
        'gross_profit' => 'decimal:2',
        'total_refunds' => 'decimal:2',
        'district_breakdown' => 'array',
    ];
}
