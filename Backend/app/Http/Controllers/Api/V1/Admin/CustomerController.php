<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\CustomerDirectoryService;
use App\Services\PathaoService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    use ApiResponse;

    public function __construct(
        private CustomerDirectoryService $customers,
        private PathaoService $pathaoService
    ) {}

    public function index(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:150'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'shop_id' => ['nullable', 'integer', 'exists:shops,id'],
        ]);

        return $this->success($this->customers->paginate($filters), 'Customers retrieved.');
    }

    public function show(Request $request, string $customerKey)
    {
        $filters = $request->validate([
            'shop_id' => ['nullable', 'integer', 'exists:shops,id'],
        ]);
        $customer = $this->customers->detail($customerKey, isset($filters['shop_id']) ? (int) $filters['shop_id'] : null);
        if (! $customer) {
            return $this->error('Customer not found.', 404);
        }

        return $this->success($customer, 'Customer retrieved.');
    }

    public function checkFraud(Request $request, string $customerKey)
    {
        $filters = $request->validate([
            'shop_id' => ['nullable', 'integer', 'exists:shops,id'],
        ]);
        $shopId = isset($filters['shop_id']) ? (int) $filters['shop_id'] : null;
        $customer = $this->customers->detail($customerKey, $shopId);

        if (! $customer) {
            return $this->error('Customer not found.', 404);
        }

        $phone = trim((string) ($customer['phone'] ?? ''));
        $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($cleanPhone) === 10 && str_starts_with($cleanPhone, '1')) {
            $cleanPhone = '0' . $cleanPhone;
        }

        $fraudScore = 0;
        $reasons = [];
        $pathaoSummary = [
            'total_delivery' => 0,
            'successful_delivery' => 0,
            'success_rate' => 0.0,
            'rating' => 'N/A',
        ];

        // 1. Pathao Lookup
        if (strlen($cleanPhone) === 11) {
            $pathaoLookup = $this->pathaoService->lookupCustomerHistory($cleanPhone);
            if ($pathaoLookup['success'] && ! empty($pathaoLookup['data'])) {
                $pData = $pathaoLookup['data'];
                $cust = $pData['customer'] ?? [];
                $total = (int) ($cust['total_delivery'] ?? 0);
                $succ = (int) ($cust['successful_delivery'] ?? 0);
                $rate = $total > 0 ? round(($succ / $total) * 100, 1) : 0.0;
                $rating = strtolower(trim((string) ($pData['customer_rating'] ?? '')));

                $pathaoSummary = [
                    'total_delivery' => $total,
                    'successful_delivery' => $succ,
                    'success_rate' => $rate,
                    'rating' => $rating !== '' ? ucfirst($rating) : 'N/A',
                ];

                if ($total >= 2) {
                    if ($rate < 50.0) {
                        $fraudScore += 45;
                        $reasons[] = "Pathao delivery success rate is low ({$rate}% - {$succ}/{$total} delivered)";
                    } elseif ($rate < 70.0) {
                        $fraudScore += 20;
                        $reasons[] = "Pathao delivery success rate is moderate ({$rate}% - {$succ}/{$total} delivered)";
                    }
                }

                if (in_array($rating, ['poor', 'bad', 'very_poor', 'very bad'], true)) {
                    $fraudScore += 35;
                    $reasons[] = "Pathao customer rating is flagged as '" . ucfirst($rating) . "'";
                }
            }
        }

        // 2. Internal Database History Checks
        $otherOrdersCount = 0;
        $deliveredDbCount = 0;
        $cancelledDbCount = 0;
        $distinctAddressesCount = 0;
        $existingDbDue = 0.0;

        if (strlen($cleanPhone) >= 10) {
            $phonePattern = substr($cleanPhone, -10);

            $ordersQuery = Order::query()
                ->where(function ($q) use ($phonePattern): void {
                    $q->where('checkout_mobile_number', 'LIKE', "%{$phonePattern}")
                        ->orWhere('shipping_mobile_number', 'LIKE', "%{$phonePattern}");
                });

            $otherOrdersCount = (clone $ordersQuery)->count();
            $deliveredDbCount = (clone $ordersQuery)->where(function ($q): void {
                $q->where('status', 'delivered')->orWhere('order_status', 'Delivered');
            })->count();
            $cancelledDbCount = (clone $ordersQuery)->where(function ($q): void {
                $q->whereIn('status', ['cancelled', 'returned'])->orWhereIn('order_status', ['Cancelled', 'Returned']);
            })->count();

            $distinctAddressesCount = (clone $ordersQuery)
                ->whereNotNull('checkout_full_address')
                ->where('checkout_full_address', '<>', '')
                ->distinct()
                ->count('checkout_full_address');

            $existingDbDue = (float) (clone $ordersQuery)
                ->whereNotIn('status', ['cancelled', 'returned'])
                ->whereNotIn('order_status', ['Cancelled', 'Returned'])
                ->sum('due_amount');
        }

        if ($pathaoSummary['total_delivery'] === 0 && $deliveredDbCount === 0) {
            $fraudScore += 50;
            $reasons[] = 'Brand new mobile number - No delivery history in Pathao or local database';
        }

        if ($cancelledDbCount >= 2) {
            $fraudScore += 35;
            $reasons[] = "COD cancellation history - Customer has {$cancelledDbCount} past cancelled or refused orders in local database";
        }

        if ($otherOrdersCount >= 2 && $cancelledDbCount > 0 && ($deliveredDbCount / $otherOrdersCount) < 0.5) {
            $internalRate = round(($deliveredDbCount / $otherOrdersCount) * 100, 1);
            $fraudScore += 30;
            $reasons[] = "Internal delivery success rate is low ({$internalRate}% - {$deliveredDbCount}/{$otherOrdersCount} delivered)";
        }

        if ($distinctAddressesCount >= 3) {
            $fraudScore += 15;
            $reasons[] = "Multiple addresses - Same phone is used across {$distinctAddressesCount} different delivery addresses";
        }

        if ($existingDbDue >= 10000) {
            $fraudScore += 20;
            $reasons[] = "Large customer due - Total unpaid balance of " . number_format($existingDbDue, 2) . " BDT in database";
        }

        $isPotentialFraud = $fraudScore >= 50;
        $checkedAt = now()->toIso8601String();

        // Update recent order if present
        $latestOrderPayload = $customer['recent_orders'][0] ?? null;
        if ($latestOrderPayload && isset($latestOrderPayload['id'])) {
            $order = Order::find($latestOrderPayload['id']);
            if ($order) {
                $order->update([
                    'is_potential_fraud' => $isPotentialFraud,
                    'fraud_score' => $fraudScore,
                    'fraud_reasons' => $reasons,
                    'fraud_checked_at' => now(),
                ]);
            }
        }

        $result = [
            'customer_key' => $customerKey,
            'phone' => $phone,
            'is_potential_fraud' => $isPotentialFraud,
            'fraud_score' => $fraudScore,
            'fraud_reasons' => $reasons,
            'fraud_checked_at' => $checkedAt,
            'pathao_summary' => $pathaoSummary,
        ];

        return $this->success($result, 'Fraud check evaluated.');
    }
}
