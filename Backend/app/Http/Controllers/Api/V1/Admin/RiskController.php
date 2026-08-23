<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\FraudCase;
use App\Models\FraudCaseNote;
use App\Models\Order;
use App\Models\RiskEvent;
use App\Models\RiskRule;
use App\Services\ActivityLogService;
use App\Services\RiskEngine;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RiskController extends Controller
{
    use ApiResponse;

    public function __construct(private ActivityLogService $activities) {}

    public function dashboard(Request $request)
    {
        $shopId = $request->integer('shop_id') ?: null;
        $cases = FraudCase::query()->when($shopId, fn($q)=>$q->where('shop_id',$shopId));
        $events = RiskEvent::query()->when($shopId, fn($q)=>$q->where('shop_id',$shopId));
        $recent = (clone $cases)->with(['shop:id,name,code','assignee:id,name','riskEvent','subject'])
            ->latest('opened_at')->limit(12)->get();

        return $this->success([
            'metrics'=>[
                'open_cases'=>(clone $cases)->whereNotIn('status',['resolved','closed'])->count(),
                'critical_cases'=>(clone $cases)->whereNotIn('status',['resolved','closed'])->where('severity','critical')->count(),
                'high_cases'=>(clone $cases)->whereNotIn('status',['resolved','closed'])->where('severity','high')->count(),
                'events_24h'=>(clone $events)->where('evaluated_at','>=',now()->subDay())->count(),
                'review_events_24h'=>(clone $events)->where('evaluated_at','>=',now()->subDay())->whereIn('decision',['review','hold'])->count(),
                'prevented_loss'=>round((float)(clone $cases)->sum('prevented_loss'),2),
            ],
            'score_bands'=>[
                'low'=>(clone $events)->where('evaluated_at','>=',now()->subDays(30))->whereBetween('score',[0,29])->count(),
                'medium'=>(clone $events)->where('evaluated_at','>=',now()->subDays(30))->whereBetween('score',[30,59])->count(),
                'high'=>(clone $events)->where('evaluated_at','>=',now()->subDays(30))->whereBetween('score',[60,79])->count(),
                'critical'=>(clone $events)->where('evaluated_at','>=',now()->subDays(30))->whereBetween('score',[80,100])->count(),
            ],
            'recent_cases'=>$recent,
            'rules'=>RiskRule::query()->orderBy('domain')->orderByDesc('weight')->get(),
        ], 'Risk command centre retrieved.');
    }

    public function cases(Request $request)
    {
        $query = FraudCase::query()->with(['shop:id,name,code','assignee:id,name','resolver:id,name','riskEvent','subject','notes.user:id,name'])
            ->when($request->integer('shop_id'), fn($q,$id)=>$q->where('shop_id',$id))
            ->when($request->status_group, function ($q, $group): void {
                $statuses = match ($group) {
                    'open' => ['open'],
                    'in_review' => ['assigned', 'investigating', 'awaiting_information'],
                    'resolved' => ['resolved', 'closed'],
                    default => [],
                };
                if ($statuses) $q->whereIn('status', $statuses);
            })
            ->when(! $request->status_group && $request->status, fn($q,$value)=>$q->where('status',$value))
            ->when($request->severity, fn($q,$value)=>$q->where('severity',$value))
            ->when($request->q, function($q,$value): void {
                $q->where(function($sub) use ($value): void {
                    $sub->where('case_number','like',"%{$value}%")
                        ->orWhereHasMorph('subject',[Order::class],fn($o)=>$o->where(function ($orders) use ($value): void {
                            $orders->where('order_number','like',"%{$value}%")
                                ->orWhere('checkout_name','like',"%{$value}%")
                                ->orWhere('checkout_mobile_number','like',"%{$value}%");
                        }));
                });
            })
            ->latest('opened_at');
        return $this->success($query->paginate(max(1,min(100,(int)$request->get('per_page',25)))), 'Fraud cases retrieved.');
    }

    public function updateCase(Request $request, FraudCase $fraudCase)
    {
        $data = $request->validate([
            'status'=>['nullable',Rule::in(['open','assigned','investigating','awaiting_information','resolved','closed'])],
            'assigned_to'=>['nullable','integer','exists:users,id'],
            'resolution'=>['nullable',Rule::in(['confirmed_fraud','false_positive','customer_abuse','employee_abuse','operational_error','system_error','approved'])],
            'resolution_note'=>['nullable','string','max:4000'],
            'loss_amount'=>['nullable','numeric','min:0'],
            'prevented_loss'=>['nullable','numeric','min:0'],
            'note'=>['nullable','string','max:4000'],
        ]);
        $before = $fraudCase->toArray();
        $updates = collect($data)->except('note')->toArray();
        if (($updates['status'] ?? null) === 'resolved' || isset($updates['resolution'])) {
            $updates['status'] = 'resolved';
            $updates['resolved_by'] = $request->user()->id;
            $updates['resolved_at'] = now();
        }
        $fraudCase->update($updates);
        if (!empty($data['note'])) FraudCaseNote::create(['fraud_case_id'=>$fraudCase->id,'user_id'=>$request->user()->id,'note'=>$data['note']]);
        $this->activities->record('risk','case_updated',"Updated fraud case {$fraudCase->case_number}",$fraudCase,$before,$fraudCase->fresh()->toArray(),request:$request);
        return $this->success($fraudCase->fresh(['riskEvent','subject','shop','assignee','resolver','notes.user']), 'Fraud case updated.');
    }

    public function updateRule(Request $request, RiskRule $riskRule)
    {
        $data = $request->validate(['is_active'=>['sometimes','boolean'],'weight'=>['sometimes','integer','min:0','max:100'],'config'=>['sometimes','array']]);
        $before = $riskRule->toArray();
        $riskRule->update($data);
        $this->activities->record('risk','rule_updated',"Updated risk rule {$riskRule->key}",$riskRule,$before,$riskRule->fresh()->toArray(),request:$request);
        return $this->success($riskRule->fresh(), 'Risk rule updated.');
    }

    public function rescan(Request $request, RiskEngine $engine)
    {
        $data = $request->validate(['order_id'=>['nullable','integer','exists:orders,id'],'limit'=>['nullable','integer','min:1','max:250']]);
        $orders = Order::query()->when($data['order_id'] ?? null, fn($q,$id)=>$q->whereKey($id))->latest()->limit($data['limit'] ?? 50)->get();
        foreach ($orders as $order) $engine->evaluateOrder($order);
        return $this->success(['scanned'=>$orders->count()], 'Orders rescanned.');
    }
}
