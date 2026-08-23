<?php

namespace App\Jobs;

use App\Models\OfflineReconciliationAction;
use App\Models\Order;
use App\Models\Payment;
use App\Services\ActivityLogService;
use App\Services\PaymentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

class ProcessOfflineReconciliationAction implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 5;

    public function __construct(public int $actionId, public ?int $actorId = null) {}

    public function handle(PaymentService $payments, ActivityLogService $activities): void
    {
        $action = DB::transaction(function (): ?OfflineReconciliationAction {
            $row = OfflineReconciliationAction::query()->whereKey($this->actionId)->lockForUpdate()->first();
            if (! $row || in_array($row->status, ['completed', 'failed'], true)) {
                return null;
            }

            $row->update([
                'status' => 'processing',
                'attempts' => $row->attempts + 1,
                'last_error_code' => null,
            ]);
            return $row->fresh();
        });

        if (! $action) {
            return;
        }

        if ($action->action_type !== 'refund') {
            $action->update([
                'status' => 'manual_review',
                'last_error_code' => 'unsupported_action_type',
            ]);
            return;
        }

        $order = $action->order_id ? Order::query()->find($action->order_id) : null;
        $isCod = $order && strtolower((string) $order->payment_method) === 'cod';
        $isPaid = $order && (float) ($order->paid_amount ?? 0) > 0;

        if ($isCod && ! $isPaid && ! $action->payment_id) {
            // COD victim without paid money -> no fake refund needed
            $action->update([
                'status' => 'completed',
                'completed_at' => now(),
                'metadata' => array_merge($action->metadata ?? [], ['cod_unpaid_cancellation' => true]),
            ]);
            $activities->record('refund', 'offline_action_completed', "Action #{$action->id} COD cancellation requires no gateway refund", $action);
            return;
        }

        if (! $action->payment_id && $order) {
            $payment = Payment::query()->where('order_id', $order->id)->first();
            if ($payment) {
                $action->update(['payment_id' => $payment->id]);
                $action->payment_id = $payment->id;
            }
        }

        if (! $action->payment_id) {
            $action->update([
                'status' => 'manual_review',
                'last_error_code' => 'missing_payment_reference',
            ]);
            return;
        }

        try {
            $payment = Payment::query()->findOrFail($action->payment_id);
            $alreadyRefunded = (float) ($payment->refunded_amount ?? 0);
            $originalAmount = (float) $payment->amount;
            $remaining = round(max(0, $originalAmount - $alreadyRefunded), 2);
            $requested = round((float) $action->amount, 2);

            if ($remaining <= 0) {
                $action->update([
                    'status' => 'completed',
                    'completed_at' => now(),
                    'metadata' => array_merge($action->metadata ?? [], ['already_fully_refunded' => true]),
                ]);
                $activities->record('refund', 'offline_action_completed', "Action #{$action->id} payment was already fully refunded", $action);
                return;
            }

            if (abs($remaining - $requested) > 0.01 && $requested > $remaining) {
                $action->update([
                    'status' => 'manual_review',
                    'last_error_code' => 'refundable_balance_exceeded',
                ]);
                return;
            }

            $refundAmount = min($requested, $remaining);
            $result = $payments->refund($payment, $refundAmount, $this->actorId);

            $action->update([
                'status' => 'completed',
                'completed_at' => now(),
                'metadata' => array_merge($action->metadata ?? [], [
                    'gateway_result' => $result,
                    'refunded_amount' => $refundAmount,
                ]),
            ]);

            $activities->record('refund', 'offline_action_completed', "Completed offline refund action #{$action->id} of ৳{$refundAmount}", $action);
        } catch (Throwable $exception) {
            report($exception);

            if ($this->attempts() >= $this->tries) {
                $action->update([
                    'status' => 'failed',
                    'last_error_code' => 'refund_gateway_failed',
                    'metadata' => array_merge($action->metadata ?? [], [
                        'error_message' => $exception->getMessage(),
                        'error_class' => class_basename($exception),
                    ]),
                ]);
            } else {
                $action->update([
                    'status' => 'pending',
                    'last_error_code' => 'transient_retry',
                    'metadata' => array_merge($action->metadata ?? [], [
                        'last_attempt_error' => $exception->getMessage(),
                    ]),
                ]);
                throw $exception;
            }
        }
    }
}
