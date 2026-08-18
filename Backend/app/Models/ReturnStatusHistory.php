<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReturnStatusHistory extends Model
{
    public $timestamps = false;
    protected $fillable = ['return_request_id', 'from_status', 'to_status', 'changed_by', 'note', 'created_at'];
    protected $casts = ['created_at' => 'datetime'];
}
