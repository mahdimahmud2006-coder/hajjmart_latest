<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderStatusHistory extends Model
{
    public $timestamps = false;
    protected $fillable = ['order_id', 'from_status', 'to_status', 'changed_by', 'note', 'created_at'];
    protected $casts = ['created_at' => 'datetime'];
}
