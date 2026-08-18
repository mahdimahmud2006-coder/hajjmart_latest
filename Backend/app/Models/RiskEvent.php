<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
class RiskEvent extends Model
{
    protected $fillable = ['event_type','subject_type','subject_id','shop_id','score','severity','decision','signals','context','evaluated_at'];
    protected $casts = ['signals'=>'array','context'=>'array','evaluated_at'=>'datetime','score'=>'integer'];
    public function subject(): MorphTo { return $this->morphTo(); }
    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function fraudCase(): HasOne { return $this->hasOne(FraudCase::class); }
}
