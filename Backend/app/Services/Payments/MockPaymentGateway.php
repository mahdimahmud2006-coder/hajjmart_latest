<?php

namespace App\Services\Payments;

use App\Contracts\PaymentGatewayInterface;
use App\Models\Payment;

class MockPaymentGateway implements PaymentGatewayInterface
{
    public function initiate(Payment $payment): array
    {
        return [
            'gateway' => 'mock',
            'payment_id' => $payment->id,
            'transaction_id' => $payment->payment_reference ?: 'MOCK-' . $payment->id,
            'redirect_url' => rtrim((string) config('app.url'), '/') . '/api/v1/payments/mock/' . $payment->id,
        ];
    }

    public function verifyCallback(array $payload): array
    {
        $status = strtoupper((string) ($payload['status'] ?? 'VALID'));
        $verified = in_array($status, ['VALID', 'VALIDATED', 'SUCCESS'], true);
        return [
            'verified' => $verified,
            'terminal' => $verified || in_array($status, ['FAILED', 'CANCELLED', 'CANCELED'], true),
            'status' => strtolower($status),
            'transaction_id' => $payload['tran_id'] ?? $payload['transaction_id'] ?? ('MOCK-' . now()->timestamp),
            'bank_transaction_id' => $payload['transaction_id'] ?? null,
            'amount' => isset($payload['amount']) ? (float) $payload['amount'] : null,
            'currency' => $payload['currency'] ?? null,
            'raw' => $payload,
        ];
    }

    public function refund(Payment $payment, float $amount): array
    {
        return ['refunded' => true, 'amount' => $amount, 'transaction_id' => $payment->gateway_transaction_id];
    }
}
