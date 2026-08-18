<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CancellationRequest extends Model
{
    protected $fillable = ['order_id', 'order_item_id', 'requested_by', 'reason', 'note', 'status', 'processed_by', 'processed_at'];
    protected $casts = ['processed_at' => 'datetime'];
}
