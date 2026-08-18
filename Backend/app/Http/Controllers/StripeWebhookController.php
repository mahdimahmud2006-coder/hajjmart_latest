<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Order;
use App\Models\StripeId;
use App\Actions\CommitInventoryAction;
use App\Actions\ReleaseInventoryAction;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Stripe\Webhook;
use Stripe\Exception\SignatureVerificationException;
use UnexpectedValueException;
use Exception;

class StripeWebhookController extends Controller
{
    /**
     * Handle incoming Stripe webhooks.
     */
    public function handle(Request $request): Response
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $webhookSecret = config('services.stripe.webhook_secret');

        try {
            $event = Webhook::constructEvent($payload, $sigHeader, $webhookSecret);
        } catch (UnexpectedValueException $e) {
            Log::error('Invalid Stripe webhook payload', ['error' => $e->getMessage()]);
            return response('Invalid payload', Response::HTTP_BAD_REQUEST);
        } catch (SignatureVerificationException $e) {
            Log::error('Invalid Stripe webhook signature', ['error' => $e->getMessage()]);
            return response('Invalid signature', Response::HTTP_BAD_REQUEST);
        }

        try {
            switch ($event->type) {
                case 'checkout.session.completed':
                    $this->handleCheckoutSessionCompleted($event->data->object);
                    break;

                case 'checkout.session.expired':
                case 'payment_intent.payment_failed':
                    $this->handlePaymentFailure($event->data->object);
                    break;

                default:
                    Log::info('Received unhandled Stripe event type: ' . $event->type);
            }
        } catch (Exception $e) {
            Log::error('Stripe webhook processing error', [
                'event_type' => $event->type,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'type' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        return response('Webhook handled', Response::HTTP_OK);
    }

    /**
     * Handle successful checkout session.
     */
    protected function handleCheckoutSessionCompleted($session): void
    {
        $orderId = $session->metadata->order_id ?? null;

        if (!$orderId) {
            Log::warning('Stripe checkout.session.completed missing order_id in metadata.');
            return;
        }

        $order = Order::find($orderId);

        if (!$order) {
            Log::error("Order not found for Stripe checkout session: {$orderId}");
            return;
        }

        if ($order->payment_status === 'Paid') {
            Log::info("Order {$orderId} already marked as Paid, skipping.");
            return;
        }

        // Commit inventory and update order status
        CommitInventoryAction::run($order);

        $order->update([
            'order_status' => 'Confirmed',
            'payment_status' => 'Paid',
        ]);

        // Record Stripe transaction details
        StripeId::create([
            'order_id' => $order->id,
            'stripe_checkout_session_id' => $session->id,
            'stripe_payment_intent_id' => $session->payment_intent ?? null,
        ]);

        Log::info("Order {$orderId} confirmed via Stripe webhook.");
    }

    /**
     * Handle payment failures or expired sessions.
     */
    protected function handlePaymentFailure($session): void
    {
        $orderId = $session->metadata->order_id ?? null;

        if (!$orderId) {
            return;
        }

        $order = Order::find($orderId);

        if ($order && $order->payment_status !== 'Paid') {
            // Release reserved inventory
            ReleaseInventoryAction::run($order);

            $order->update([
                'order_status' => 'Cancelled',
                'payment_status' => 'Failed',
            ]);

            Log::info("Order {$orderId} cancelled due to payment failure or expiration.");
        }
    }
}

/*
    stripe listen --forward-to http://funsite.test/api/stripe/webhook
*/