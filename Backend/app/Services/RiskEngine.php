<?php

namespace App\Services;

use App\Models\FraudCase;
use App\Models\Order;
use App\Models\Payment;
use App\Models\RiskEvent;
use App\Models\RiskRule;
use Illuminate\Support\Carbon;

class RiskEngine
{
    public function evaluateOrder(Order $order): RiskEvent
    {
        $order->loadMissing('payments');
        $rules = RiskRule::query()->where('domain', 'order')->where('is_active', true)->get()->keyBy('key');
        $signals = [];
        $score = 0;
        $phone = trim((string) $order->checkout_mobile_number);

        $hit = function (string $key, bool $condition, array $facts = []) use (&$signals, &$score, $rules): void {
            $rule = $rules->get($key);
            if (! $rule || ! $condition) return;
            $weight = (int) $rule->weight;
            $score += $weight;
            $signals[] = ['rule'=>$key,'name'=>$rule->name,'weight'=>$weight,'facts'=>$facts];
        };

        $cod = strtolower((string) $order->payment_method) === 'cod';
        $highValue = (float) $order->grand_total >= (float) ($rules->get('high_value_cod')?->config['amount'] ?? 15000);
        $hit('high_value_cod', $cod && $highValue, ['amount'=>(float)$order->grand_total]);

        if ($phone !== '') {
            $velocityRule = $rules->get('cod_velocity');
            $velocitySince = now()->subMinutes((int) ($velocityRule?->config['minutes'] ?? 60));
            $velocity = Order::query()->where('id','<>',$order->id)->where('checkout_mobile_number',$phone)
                ->where('created_at','>=',$velocitySince)->where('payment_method','cod')->count() + ($cod ? 1 : 0);
            $hit('cod_velocity', $cod && $velocity >= (int) ($velocityRule?->config['orders'] ?? 3), ['orders'=>$velocity]);

            $cancelRule = $rules->get('cod_cancellation_history');
            $cancelled = Order::query()->where('id','<>',$order->id)->where('checkout_mobile_number',$phone)
                ->where('created_at','>=',now()->subDays((int)($cancelRule?->config['days'] ?? 90)))
                ->where(function ($q): void { $q->where('status','cancelled')->orWhere('order_status','Cancelled'); })->count();
            $hit('cod_cancellation_history', $cod && $cancelled >= (int)($cancelRule?->config['cancelled_orders'] ?? 2), ['cancelled_orders'=>$cancelled]);

            $addressRule = $rules->get('address_variance');
            $addresses = Order::query()->where('id','<>',$order->id)->where('checkout_mobile_number',$phone)
                ->where('created_at','>=',now()->subDays((int)($addressRule?->config['days'] ?? 90)))
                ->whereNotNull('checkout_full_address')->distinct()->count('checkout_full_address');
            if ($order->checkout_full_address) $addresses++;
            $hit('address_variance', $addresses >= (int)($addressRule?->config['addresses'] ?? 3), ['distinct_addresses'=>$addresses]);
        }

        $subtotal = max(0.01, (float) $order->subtotal);
        $discountPercent = ((float) $order->discount_total / $subtotal) * 100;
        $hit('large_discount', $discountPercent >= (float)($rules->get('large_discount')?->config['percent'] ?? 15), ['discount_percent'=>round($discountPercent,1)]);
        $hit('large_customer_due', (float)$order->due_amount >= (float)($rules->get('large_customer_due')?->config['amount'] ?? 10000), ['due_amount'=>(float)$order->due_amount]);

        if ($order->offline_created_at) {
            $hours = Carbon::parse($order->offline_created_at)->diffInHours($order->synced_at ?: now());
            $hit('offline_sync_delay', $hours >= (int)($rules->get('offline_sync_delay')?->config['hours'] ?? 12), ['sync_delay_hours'=>$hours]);
        }

        $references = $order->payments->pluck('payment_reference')->filter()->unique();
        $duplicateReference = $references->first(fn ($ref) => Payment::query()->where('order_id','<>',$order->id)->where('payment_reference',$ref)->exists());
        $hit('duplicate_payment_reference', (bool)$duplicateReference, ['payment_reference'=>$duplicateReference]);

        $score = min(100, $score);
        [$severity,$decision] = match (true) {
            $score >= 80 => ['critical','hold'],
            $score >= 60 => ['high','review'],
            $score >= 30 => ['medium','monitor'],
            default => ['low','allow'],
        };

        $event = RiskEvent::create([
            'event_type'=>'order.created','subject_type'=>Order::class,'subject_id'=>$order->id,'shop_id'=>$order->shop_id,
            'score'=>$score,'severity'=>$severity,'decision'=>$decision,'signals'=>$signals,
            'context'=>['order_number'=>$order->order_number,'source_channel'=>$order->source_channel,'payment_method'=>$order->payment_method,'grand_total'=>(float)$order->grand_total],
            'evaluated_at'=>now(),
        ]);

        if ($score >= 60) {
            $existing = FraudCase::query()->where('subject_type', Order::class)->where('subject_id', $order->id)
                ->whereNotIn('status', ['resolved','closed'])->first();
            if ($existing) {
                $existing->update(['risk_score'=>$score,'severity'=>$severity]);
            } else {
                FraudCase::create([
                    'case_number'=>$this->nextCaseNumber(),'risk_event_id'=>$event->id,'subject_type'=>Order::class,'subject_id'=>$order->id,
                    'shop_id'=>$order->shop_id,'case_type'=>'order_risk','risk_score'=>$score,'severity'=>$severity,'status'=>'open','opened_at'=>now(),
                ]);
            }
            if ($score >= 80 && $order->priority !== 'urgent') $order->update(['priority'=>'urgent']);
        }

        return $event;
    }

    private function nextCaseNumber(): string
    {
        do { $number = 'FC-'.now()->format('Ym').'-'.str_pad((string) random_int(1,99999),5,'0',STR_PAD_LEFT); }
        while (FraudCase::where('case_number',$number)->exists());
        return $number;
    }
}
