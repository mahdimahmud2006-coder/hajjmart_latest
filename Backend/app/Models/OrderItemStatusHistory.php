<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItemStatusHistory extends Model
{
    public $timestamps = false;
    protected $fillable = ['order_item_id', 'from_status', 'to_status', 'changed_by', 'note', 'created_at'];
    protected $casts = ['created_at' => 'datetime'];
}
