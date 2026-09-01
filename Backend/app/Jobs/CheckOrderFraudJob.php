<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Services\PathaoService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class CheckOrderFraudJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 10;

    public function __construct(public int $orderId) {}

    public function handle(PathaoService $pathaoService): void
    {
        $order = Order::find($this->orderId);
        if (! $order) {
            return;
        }

        // Only evaluate ecommerce, website, and social commerce orders
        $channel = strtolower((string) $order->source_channel);
        if (! in_array($channel, ['website', 'ecommerce', 'online', 'social_commerce'], true)) {
            return;
        }

        $phone = trim((string) ($order->checkout_mobile_number ?: ($order->shipping_mobile_number ?: ($order->customer_details['phone'] ?? ''))));
        $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($cleanPhone) === 10 && str_starts_with($cleanPhone, '1')) {
            $cleanPhone = '0' . $cleanPhone;
        }

        $fraudScore = 0;
        $reasons = [];

        // 1. Internal DB Customer History & Signals Check
        $otherOrdersCount = 0;
        $deliveredDbCount = 0;
        $cancelledDbCount = 0;
        $distinctAddressesCount = 0;
        $existingDbDue = 0.0;
        $isCod = strtolower((string) $order->payment_method) === 'cod';
        $codVelocityCount = 0;

        if (strlen($cleanPhone) >= 10) {
            $phonePattern = substr($cleanPhone, -10);

            $otherOrdersQuery = Order::query()
                ->where('id', '<>', $order->id)
                ->where(function ($q) use ($phonePattern): void {
                    $q->where('checkout_mobile_number', 'LIKE', "%{$phonePattern}")
                        ->orWhere('shipping_mobile_number', 'LIKE', "%{$phonePattern}");
                });

            $otherOrdersCount = (clone $otherOrdersQuery)->count();
            $deliveredDbCount = (clone $otherOrdersQuery)->where(function ($q): void {
                $q->where('status', 'delivered')->orWhere('order_status', 'Delivered');
            })->count();
            $cancelledDbCount = (clone $otherOrdersQuery)->where(function ($q): void {
                $q->whereIn('status', ['cancelled', 'returned'])->orWhereIn('order_status', ['Cancelled', 'Returned']);
            })->count();

            // Check distinct delivery addresses across all orders for this customer (including current order)
            $allAddresses = (clone $otherOrdersQuery)
                ->whereNotNull('checkout_full_address')
                ->where('checkout_full_address', '<>', '')
                ->pluck('checkout_full_address');
            if ($order->checkout_full_address) {
                $allAddresses->push($order->checkout_full_address);
            }
            $distinctAddressesCount = $allAddresses
                ->map(fn ($addr) => trim(preg_replace('/\s+/', ' ', (string) $addr)))
                ->unique()
                ->count();

            // Check existing customer due from database
            $existingDbDue = (float) (clone $otherOrdersQuery)
                ->whereNotIn('status', ['cancelled', 'returned'])
                ->whereNotIn('order_status', ['Cancelled', 'Returned'])
                ->sum('due_amount');

            // Check COD velocity (orders in last 60 minutes)
            if ($isCod) {
                $codVelocityCount = (clone $otherOrdersQuery)
                    ->where('created_at', '>=', now()->subMinutes(60))
                    ->where('payment_method', 'cod')
                    ->count() + 1;
            }
        }

        // 2. Duplicate Payment Reference Check
        $order->loadMissing('payments');
        $references = $order->payments->pluck('payment_reference')->filter()->map(fn ($r) => trim((string) $r))->filter()->unique();
        $duplicateRef = null;
        foreach ($references as $ref) {
            if (\App\Models\Payment::query()->where('order_id', '<>', $order->id)->where('payment_reference', $ref)->exists()) {
                $duplicateRef = $ref;
                break;
            }
        }
        if ($duplicateRef) {
            $fraudScore += 40;
            $reasons[] = "Duplicate payment reference - Reference '{$duplicateRef}' is already attached to another payment";
        }

        // 3. Pathao API Customer Lookup Check
        $pathaoData = null;
        $pathaoTotal = 0;
        $pathaoSuccess = 0;
        $pathaoSuccessRate = 0.0;
        $pathaoRating = '';

        if (strlen($cleanPhone) === 11) {
            $pathaoLookup = $pathaoService->lookupCustomerHistory($cleanPhone);
            if ($pathaoLookup['success'] && ! empty($pathaoLookup['data'])) {
                $pathaoData = $pathaoLookup['data'];
                $cust = $pathaoData['customer'] ?? [];
                $pathaoTotal = (int) ($cust['total_delivery'] ?? 0);
                $pathaoSuccess = (int) ($cust['successful_delivery'] ?? 0);
                $pathaoSuccessRate = $pathaoTotal > 0 ? round(($pathaoSuccess / $pathaoTotal) * 100, 1) : 0.0;
                $pathaoRating = strtolower(trim((string) ($pathaoData['customer_rating'] ?? '')));
            }
        }

        // 4. Scoring Matrix Evaluation
        // Rule A: Brand New Phone Number (0 history in Pathao AND 0 history in DB)
        if ($pathaoTotal === 0 && $deliveredDbCount === 0) {
            $fraudScore += 50;
            $reasons[] = 'Brand new mobile number - No delivery history in Pathao or local database';
        }

        // Rule B: Pathao Delivery Success Rate
        if ($pathaoTotal >= 2) {
            if ($pathaoSuccessRate < 50.0) {
                $fraudScore += 45;
                $reasons[] = "Pathao delivery success rate is low ({$pathaoSuccessRate}% - {$pathaoSuccess}/{$pathaoTotal} delivered)";
            } elseif ($pathaoSuccessRate < 70.0) {
                $fraudScore += 20;
                $reasons[] = "Pathao delivery success rate is moderate ({$pathaoSuccessRate}% - {$pathaoSuccess}/{$pathaoTotal} delivered)";
            }
        }

        // Rule C: Pathao Rating
        if (in_array($pathaoRating, ['poor', 'bad', 'very_poor', 'very bad'], true)) {
            $fraudScore += 35;
            $reasons[] = "Pathao customer rating is flagged as '" . ucfirst($pathaoRating) . "'";
        }

        // Rule D: Internal DB History & Cancellations
        if ($cancelledDbCount >= 2) {
            $fraudScore += 35;
            $reasons[] = "COD cancellation history - Customer has {$cancelledDbCount} past cancelled or refused orders in local database";
        }
        if ($otherOrdersCount >= 2 && $cancelledDbCount > 0 && ($deliveredDbCount / $otherOrdersCount) < 0.5) {
            $internalRate = round(($deliveredDbCount / $otherOrdersCount) * 100, 1);
            $fraudScore += 30;
            $reasons[] = "Internal delivery success rate is low ({$internalRate}% - {$deliveredDbCount}/{$otherOrdersCount} delivered)";
        }

        // Rule E: High Value COD Order
        if ($isCod && (float) $order->grand_total >= 5000) {
            $fraudScore += 15;
            $reasons[] = 'High value Cash-On-Delivery order (' . number_format((float) $order->grand_total, 2) . ' BDT)';
        }

        // Rule F: COD Order Velocity
        if ($isCod && $codVelocityCount >= 3) {
            $fraudScore += 30;
            $reasons[] = "COD order velocity - Repeated COD orders ({$codVelocityCount}) from the same phone in a short window (60 minutes)";
        }

        // Rule G: Multiple Delivery Addresses
        if ($distinctAddressesCount >= 3) {
            $fraudScore += 15;
            $reasons[] = "Multiple addresses - Same phone is used across {$distinctAddressesCount} different delivery addresses";
        }

        // Rule H: Large Customer Due (all from existing database or the direct order)
        $directDue = (float) $order->due_amount;
        $totalCustomerDue = $existingDbDue + $directDue;
        if ($totalCustomerDue >= 10000) {
            $fraudScore += 20;
            $reasons[] = "Large customer due - Total unpaid balance of " . number_format($totalCustomerDue, 2) . " BDT across existing database or direct order";
        }

        // 4. Threshold Evaluation
        $threshold = 50;
        $isPotentialFraud = $fraudScore >= $threshold;

        $updateData = [
            'is_potential_fraud' => $isPotentialFraud,
            'fraud_score' => $fraudScore,
            'fraud_reasons' => $reasons,
            'fraud_checked_at' => now(),
        ];

        // If marked as Potential Fraud, set status to pending
        if ($isPotentialFraud) {
            $previousStatus = $order->status;
            $updateData['status'] = 'pending';
            $updateData['order_status'] = 'Pending';
            $order->update($updateData);

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'from_status' => $previousStatus,
                'to_status' => 'pending',
                'actor_id' => null, // System automated
                'note' => "System flagged order as Potential Fraud (Score: {$fraudScore}/100). Status changed to Pending.",
                'created_at' => now(),
            ]);

            Log::info("CheckOrderFraudJob: Order #{$order->order_number} flagged as Potential Fraud (Score: {$fraudScore}). Status changed to pending.");
        } else {
            $order->update($updateData);
            Log::info("CheckOrderFraudJob: Order #{$order->order_number} cleared fraud check (Score: {$fraudScore}). Status remains {$order->status}.");
        }
    }
}
