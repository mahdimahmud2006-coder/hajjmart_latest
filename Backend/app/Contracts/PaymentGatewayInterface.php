<?php

namespace App\Contracts;

use App\Models\Payment;

interface PaymentGatewayInterface
{
    public function initiate(Payment $payment): array;
    public function verifyCallback(array $payload): array;
    public function refund(Payment $payment, float $amount): array;
}
