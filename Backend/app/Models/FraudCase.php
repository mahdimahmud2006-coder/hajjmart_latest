<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
class FraudCase extends Model
{
    protected $fillable = ['case_number','risk_event_id','subject_type','subject_id','shop_id','case_type','risk_score','severity','status','assigned_to','resolved_by','resolution','resolution_note','loss_amount','prevented_loss','opened_at','resolved_at'];
    protected $casts = ['risk_score'=>'integer','loss_amount'=>'decimal:2','prevented_loss'=>'decimal:2','opened_at'=>'datetime','resolved_at'=>'datetime'];
    public function riskEvent(): BelongsTo { return $this->belongsTo(RiskEvent::class); }
    public function subject(): MorphTo { return $this->morphTo(); }
    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function assignee(): BelongsTo { return $this->belongsTo(User::class, 'assigned_to'); }
    public function resolver(): BelongsTo { return $this->belongsTo(User::class, 'resolved_by'); }
    public function notes(): HasMany { return $this->hasMany(FraudCaseNote::class); }
}
