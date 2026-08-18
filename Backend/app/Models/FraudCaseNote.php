<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class FraudCaseNote extends Model
{
    protected $fillable = ['fraud_case_id','user_id','note','meta'];
    protected $casts = ['meta'=>'array'];
    public function fraudCase(): BelongsTo { return $this->belongsTo(FraudCase::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
