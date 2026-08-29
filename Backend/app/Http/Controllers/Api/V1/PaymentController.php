<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Services\PaymentService;
use App\Support\ApiResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Throwable;

class PaymentController extends Controller
{
    use ApiResponse;

    public function __construct(private PaymentService $payments) {}

    public function initiate(Request $request, string $order)
    {
        $resolved = $this->ownedOrder($request, $order);
        return $this->success($this->payments->initiate($resolved), 'Payment initiated.');
    }

    public function callback(Request $request)
    {
        return $this->success($this->payments->verifyCallback($request->all()), 'Payment verified.');
    }

    public function sslCommerzSuccess(Request $request): RedirectResponse
    {
        return $this->gatewayReturn($request, 'paid');
    }

    public function sslCommerzFail(Request $request): RedirectResponse
    {
        return $this->gatewayReturn($request, 'failed');
    }

    public function sslCommerzCancel(Request $request): RedirectResponse
    {
        return $this->gatewayReturn($request, 'cancelled');
    }

    public function mock(Payment $payment): RedirectResponse
    {
        abort_unless(app()->environment(['local', 'testing']), 404);
        if ($payment->payment_method === 'cod') {
            throw new RuntimeException('COD payments do not use the mock gateway.');
        }

        $verified = $this->payments->verifyCallback([
            'payment_id' => $payment->id,
            'tran_id' => $payment->payment_reference,
            'status' => 'VALID',
            'amount' => (float) $payment->amount,
            'currency' => $payment->currency,
        ]);

        return $this->frontendRedirect($verified, 'paid');
    }

    public function status(Request $request, string $order)
    {
        $resolved = $this->ownedOrder($request, $order);
        $payment = $resolved->payments()->latest()->first();

        return $this->success([
            'order_number' => $resolved->order_number,
            'payment_status' => $resolved->payment_status,
            'gateway_transaction_id' => $payment?->gateway_transaction_id ?? $payment?->payment_reference,
            'amount_paid' => (float) $resolved->paid_amount,
            'paid_at' => $payment?->paid_at?->toISOString(),
        ], 'Payment status retrieved.');
    }

    public function refund(Request $request, Payment $payment)
    {
        $data = $request->validate(['amount' => ['required', 'numeric', 'min:1']]);
        return $this->success($this->payments->refund($payment, (float) $data['amount'], $request->user()?->id), 'Payment refunded.');
    }

    private function ownedOrder(Request $request, string $identifier): Order
    {
        $order = Order::query()
            ->where(function ($query) use ($identifier): void {
                $query->where('order_number', $identifier)
                    ->orWhere('order_id', $identifier);
                if (ctype_digit($identifier)) {
                    $query->orWhere('id', (int) $identifier);
                }
            })
            ->firstOrFail();

        abort_unless(
            $request->user()?->is_employee || (int) $order->customer_id === (int) $request->user()?->id,
            403
        );

        return $order;
    }

    private function gatewayReturn(Request $request, string $failureStatus): RedirectResponse
    {
        try {
            $payment = $this->payments->verifyCallback($request->all());
            return $this->frontendRedirect($payment, $payment->status === 'paid' ? 'paid' : $failureStatus);
        } catch (Throwable) {
            $payment = $this->paymentFromReturnPayload($request->all());
            if ($payment) {
                return $this->frontendRedirect($payment, 'pending');
            }

            return redirect()->away($this->frontendUrl('/order-success?payment=online&status=pending'));
        }
    }

    private function paymentFromReturnPayload(array $payload): ?Payment
    {
        $transactionId = $payload['tran_id'] ?? $payload['transaction_id'] ?? null;
        if (! $transactionId) {
            return null;
        }

        return Payment::where('payment_reference', $transactionId)->first();
    }

    private function frontendRedirect(Payment $payment, string $status): RedirectResponse
    {
        $payment->loadMissing('order');
        $orderNumber = $payment->order?->order_number;
        $query = http_build_query(array_filter([
            'order' => $orderNumber,
            'payment' => 'online',
            'status' => $status,
        ]));

        return redirect()->away($this->frontendUrl('/order-success?' . $query));
    }

    private function frontendUrl(string $path): string
    {
        return rtrim((string) config('app.frontend_url'), '/') . $path;
    }
}
