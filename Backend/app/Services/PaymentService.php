<?php

namespace App\Services;

use App\Contracts\PaymentGatewayInterface;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PaymentService
{
    public function __construct(
        private OrderService $orderService,
        private ActivityLogService $activities,
        private PaymentGatewayInterface $gateway,
    ) {}

    public function initiate(\App\Models\Order $order): array
    {
        return DB::transaction(function () use ($order): array {
            $payment = Payment::query()
                ->where('order_id', $order->id)
                ->latest('id')
                ->lockForUpdate()
                ->firstOrFail();

            if ($payment->payment_method === 'cod') {
                return ['message' => 'COD payment does not need gateway initiation.', 'payment' => $payment];
            }

            $existing = (array) $payment->gateway_response;
            if (! empty($existing['redirect_url'])) {
                return $existing;
            }

            $response = $this->gateway->initiate($payment);
            $payment->update([
                'gateway' => $response['gateway'] ?? $payment->gateway ?? 'unknown',
                'gateway_response' => $response,
                'payment_reference' => $payment->payment_reference ?: ($response['transaction_id'] ?? null),
            ]);
            return $response;
        });
    }

    public function verifyCallback(array $payload): Payment
    {
        $payment = $this->resolvePayment($payload);
        if ($payment->status === 'paid') {
            return $payment->fresh('order');
        }

        $verified = $this->gateway->verifyCallback($payload);
        $payment->update(['gateway_response' => array_merge((array) $payment->gateway_response, ['callback' => $verified])]);

        if ($verified['verified'] ?? false) {
            $this->assertVerifiedPaymentMatches($payment, $verified);
            return DB::transaction(function () use ($payment, $verified): Payment {
                $order = Order::whereKey($payment->order_id)->lockForUpdate()->firstOrFail();
                $locked = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
                if ($locked->status === 'paid') {
                    return $locked->fresh('order');
                }
                $locked->update([
                    'status' => 'paid',
                    'gateway_transaction_id' => $verified['bank_transaction_id'] ?? $verified['transaction_id'] ?? null,
                    'gateway_response' => array_merge((array) $locked->gateway_response, ['verified' => $verified]),
                    'paid_at' => now(),
                ]);
                $order->update([
                    'payment_status' => PaymentStatus::PAID->value,
                    'paid_amount' => $order->grand_total,
                    'due_amount' => 0,
                ]);
                if ($order->status === OrderStatus::PENDING->value) {
                    $this->orderService->transition($order, OrderStatus::CONFIRMED->value, null, 'Payment received');
                }

                return $locked->fresh('order');
            });
        }

        if ($verified['terminal'] ?? false) {
            return DB::transaction(function () use ($payment, $verified): Payment {
                $order = Order::whereKey($payment->order_id)->lockForUpdate()->firstOrFail();
                $locked = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
                if ($locked->status === 'paid') {
                    return $locked->fresh('order');
                }
                $locked->update([
                    'status' => 'failed',
                    'gateway_response' => array_merge((array) $locked->gateway_response, ['verified' => $verified]),
                ]);
                $order->update(['payment_status' => PaymentStatus::DUE->value]);
                if ($order->status === OrderStatus::PENDING->value) {
                    $this->orderService->cancel($order, null, 'Online payment failed or was cancelled');
                }

                return $locked->fresh('order');
            });
        }

        throw new RuntimeException('Payment callback could not be verified.');
    }

    public function refund(Payment $payment, float $amount, ?int $actorId = null): Payment
    {
        return DB::transaction(function () use ($payment, $amount, $actorId): Payment {
            $payment->loadMissing('order');
            $alreadyRefunded = (float) ($payment->refunded_amount ?? 0);
            $refundable = round(max(0, (float) $payment->amount - $alreadyRefunded), 2);
            $amount = round($amount, 2);
            if ($amount <= 0 || $amount > $refundable) {
                throw new RuntimeException("Refund amount cannot exceed the remaining refundable balance of {$refundable}.");
            }

            $response = $this->gateway->refund($payment, $amount);
            $newRefunded = round($alreadyRefunded + $amount, 2);
            $isFull = $newRefunded >= (float) $payment->amount;
            $payment->update([
                'status' => $isFull ? 'refunded' : 'partially_refunded',
                'refunded_amount' => $newRefunded,
                'refund_status' => $isFull ? 'refunded' : 'partial_refund',
                'gateway_response' => array_merge((array) $payment->gateway_response, ['latest_refund' => $response]),
            ]);

            $order = $payment->order;
            if ($order) {
                $totalRefunded = (float) $order->payments()->sum('refunded_amount');
                $netCollected = max(0, (float) $order->paid_amount - $totalRefunded);
                $netGrandTotal = round(max(0, (float) $order->grand_total - $totalRefunded), 2);
                $order->update([
                    'refund_total' => $totalRefunded,
                    'payment_status' => PaymentStatus::forOrder((float) $order->paid_amount, $netGrandTotal),
                ]);
                $this->activities->record('payments', 'refunded', "Refunded {$amount} for {$order->order_number}", $payment, [], ['amount' => $amount, 'net_collected' => $netCollected], $actorId, $order->shop_id);
            }

            return $payment->fresh(['order', 'receiver']);
        });
    }

    private function resolvePayment(array $payload): Payment
    {
        if (! empty($payload['payment_id'])) {
            return Payment::findOrFail((int) $payload['payment_id']);
        }

        $transactionId = $payload['tran_id'] ?? $payload['transaction_id'] ?? null;
        if ($transactionId) {
            return Payment::where('payment_reference', $transactionId)->firstOrFail();
        }

        throw new RuntimeException('Payment callback is missing a payment reference.');
    }

    private function assertVerifiedPaymentMatches(Payment $payment, array $verified): void
    {
        if (! empty($verified['transaction_id']) && $payment->payment_reference && (string) $verified['transaction_id'] !== (string) $payment->payment_reference) {
            throw new RuntimeException('Verified transaction ID does not match the payment intent.');
        }
        if ($verified['amount'] !== null && abs((float) $verified['amount'] - (float) $payment->amount) > 0.009) {
            throw new RuntimeException('Verified payment amount does not match the order total.');
        }
        if (! empty($verified['currency']) && strtoupper((string) $verified['currency']) !== strtoupper((string) $payment->currency)) {
            throw new RuntimeException('Verified payment currency does not match the order currency.');
        }
    }
}
