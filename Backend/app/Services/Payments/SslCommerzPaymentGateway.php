<?php

namespace App\Services\Payments;

use App\Contracts\PaymentGatewayInterface;
use App\Models\Payment;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class SslCommerzPaymentGateway implements PaymentGatewayInterface
{
    public function initiate(Payment $payment): array
    {
        $this->assertConfigured();
        $payment->loadMissing('order.items.product');
        $order = $payment->order;
        if (! $order) {
            throw new RuntimeException('Payment does not have an order.');
        }

        $existing = (array) $payment->gateway_response;
        if (! empty($existing['redirect_url'])) {
            return $existing;
        }

        $transactionId = substr((string) ($payment->payment_reference ?: $order->order_number), 0, 30);
        $customerEmail = $order->checkout_email ?: config('services.sslcommerz.fallback_email', 'payments@hajjmart.com.bd');
        $productNames = $order->items->pluck('product.name')->filter()->implode(', ');
        $baseUrl = rtrim((string) config('app.url'), '/');

        $response = Http::asForm()->timeout(20)->post($this->sessionUrl(), [
            'store_id' => config('services.sslcommerz.store_id'),
            'store_passwd' => config('services.sslcommerz.store_password'),
            'total_amount' => number_format((float) $payment->amount, 2, '.', ''),
            'currency' => (string) $payment->currency,
            'tran_id' => $transactionId,
            'success_url' => $baseUrl . '/api/v1/payments/sslcommerz/success',
            'fail_url' => $baseUrl . '/api/v1/payments/sslcommerz/fail',
            'cancel_url' => $baseUrl . '/api/v1/payments/sslcommerz/cancel',
            'ipn_url' => $baseUrl . '/api/v1/payments/callback',
            'cus_name' => (string) $order->checkout_name,
            'cus_email' => (string) $customerEmail,
            'cus_add1' => mb_substr((string) $order->checkout_full_address, 0, 50),
            'cus_city' => (string) $order->checkout_district,
            'cus_state' => (string) $order->checkout_district,
            'cus_postcode' => '1000',
            'cus_country' => 'Bangladesh',
            'cus_phone' => (string) $order->checkout_mobile_number,
            'shipping_method' => 'YES',
            'num_of_item' => max(1, (int) $order->items->sum('quantity')),
            'ship_name' => (string) $order->checkout_name,
            'ship_add1' => mb_substr((string) $order->shipping_full_address, 0, 50),
            'ship_city' => (string) $order->shipping_district,
            'ship_state' => (string) $order->shipping_district,
            'ship_postcode' => '1000',
            'ship_country' => 'Bangladesh',
            'product_name' => mb_substr($productNames ?: 'HajjMart order', 0, 255),
            'product_category' => 'Hajj and Umrah essentials',
            'product_profile' => 'physical-goods',
            'product_amount' => number_format((float) $order->net_subtotal, 2, '.', ''),
            'discount_amount' => number_format((float) $order->discount_total, 2, '.', ''),
            'value_a' => (string) $order->order_number,
        ]);

        if (! $response->successful()) {
            throw new RuntimeException('Could not connect to SSLCOMMERZ to create a payment session.');
        }

        $payload = $response->json();
        if (($payload['status'] ?? null) !== 'SUCCESS' || empty($payload['GatewayPageURL'])) {
            throw new RuntimeException((string) ($payload['failedreason'] ?? 'SSLCOMMERZ did not return a payment URL.'));
        }

        return [
            'gateway' => 'sslcommerz',
            'payment_id' => $payment->id,
            'transaction_id' => $transactionId,
            'session_key' => $payload['sessionkey'] ?? null,
            'redirect_url' => $payload['GatewayPageURL'],
            'gateway_response' => $payload,
        ];
    }

    public function verifyCallback(array $payload): array
    {
        $this->assertConfigured();
        $transactionId = (string) ($payload['tran_id'] ?? $payload['transaction_id'] ?? '');
        if ($transactionId === '') {
            return ['verified' => false, 'terminal' => false, 'status' => 'missing_transaction_id', 'raw' => $payload];
        }

        if (! empty($payload['val_id'])) {
            $response = Http::timeout(20)->get($this->validationUrl(), [
                'val_id' => $payload['val_id'],
                'store_id' => config('services.sslcommerz.store_id'),
                'store_passwd' => config('services.sslcommerz.store_password'),
                'format' => 'json',
                'v' => 1,
            ]);
            if (! $response->successful()) {
                throw new RuntimeException('Could not validate the SSLCOMMERZ payment.');
            }
            return $this->normalizedValidation((array) $response->json(), $transactionId);
        }

        $response = Http::timeout(20)->get($this->transactionQueryUrl(), [
            'tran_id' => $transactionId,
            'store_id' => config('services.sslcommerz.store_id'),
            'store_passwd' => config('services.sslcommerz.store_password'),
            'format' => 'json',
            'v' => 1,
        ]);
        if (! $response->successful()) {
            throw new RuntimeException('Could not query the SSLCOMMERZ transaction status.');
        }

        $body = (array) $response->json();
        $rows = $body['element'] ?? null;
        if (is_array($rows) && $rows !== []) {
            $matching = collect($rows)
                ->filter(fn ($row) => is_array($row) && (string) ($row['tran_id'] ?? '') === $transactionId)
                ->values();

            $successful = $matching->first(fn ($row) => in_array(strtoupper((string) ($row['status'] ?? '')), ['VALID', 'VALIDATED'], true));
            if (is_array($successful)) {
                return $this->normalizedValidation($successful, $transactionId);
            }

            $terminal = $matching->first(fn ($row) => in_array(strtoupper((string) ($row['status'] ?? '')), ['FAILED', 'CANCELLED', 'CANCELED'], true));
            if (is_array($terminal) && $matching->every(fn ($row) => in_array(strtoupper((string) ($row['status'] ?? '')), ['FAILED', 'CANCELLED', 'CANCELED'], true))) {
                return $this->normalizedValidation($terminal, $transactionId);
            }
        }

        return $this->normalizedValidation($body, $transactionId);
    }

    public function refund(Payment $payment, float $amount): array
    {
        $this->assertConfigured();
        if (! $payment->gateway_transaction_id) {
            throw new RuntimeException('SSLCOMMERZ bank transaction ID is missing; refund cannot be initiated.');
        }

        $refundTransactionId = substr('RF-' . $payment->id . '-' . now()->format('YmdHis'), 0, 30);
        $response = Http::timeout(20)->get($this->transactionQueryUrl(), [
            'refund_amount' => number_format($amount, 2, '.', ''),
            'refund_remarks' => 'HajjMart order refund',
            'refund_trans_id' => $refundTransactionId,
            'refe_id' => $payment->order?->order_number ?: $payment->payment_reference,
            'bank_tran_id' => $payment->gateway_transaction_id,
            'store_id' => config('services.sslcommerz.store_id'),
            'store_passwd' => config('services.sslcommerz.store_password'),
            'format' => 'json',
            'v' => 1,
        ]);
        if (! $response->successful()) {
            throw new RuntimeException('Could not initiate the SSLCOMMERZ refund.');
        }
        $payload = (array) $response->json();
        if (strtolower((string) ($payload['status'] ?? '')) !== 'success') {
            throw new RuntimeException((string) ($payload['errorReason'] ?? 'SSLCOMMERZ refund initiation failed.'));
        }
        return $payload;
    }

    private function normalizedValidation(array $payload, string $transactionId): array
    {
        $status = strtoupper((string) ($payload['status'] ?? ''));
        $verified = in_array($status, ['VALID', 'VALIDATED'], true);
        $terminal = $verified || in_array($status, ['FAILED', 'CANCELLED', 'CANCELED'], true);

        return [
            'verified' => $verified,
            'terminal' => $terminal,
            'status' => strtolower($status),
            'transaction_id' => (string) ($payload['tran_id'] ?? $transactionId),
            'bank_transaction_id' => $payload['bank_tran_id'] ?? null,
            'amount' => isset($payload['amount']) ? (float) $payload['amount'] : null,
            'currency' => $payload['currency'] ?? $payload['currency_type'] ?? null,
            'raw' => $payload,
        ];
    }

    private function assertConfigured(): void
    {
        if (! config('services.sslcommerz.store_id') || ! config('services.sslcommerz.store_password')) {
            throw new RuntimeException('SSLCOMMERZ credentials are not configured. Set SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD.');
        }
        if (app()->environment('production') && $this->sandbox()) {
            throw new RuntimeException('SSLCOMMERZ_SANDBOX must be false in production.');
        }
    }

    private function sessionUrl(): string
    {
        return $this->sandbox()
            ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
            : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';
    }

    private function validationUrl(): string
    {
        return $this->sandbox()
            ? 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
            : 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';
    }

    private function transactionQueryUrl(): string
    {
        return $this->sandbox()
            ? 'https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php'
            : 'https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php';
    }

    private function sandbox(): bool
    {
        return (bool) config('services.sslcommerz.sandbox', false);
    }
}
