<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class RiskRule extends Model
{
    protected $fillable = ['key','name','domain','weight','is_active','config','description'];
    protected $casts = ['is_active'=>'boolean','config'=>'array','weight'=>'integer'];
}
