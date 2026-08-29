<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Shop;
use App\Models\SiteSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

class PathaoService
{
    public const SANDBOX_BASE_URL = 'https://courier-api-sandbox.pathao.com';
    public const PRODUCTION_BASE_URL = 'https://api-hermes.pathao.com';

    public function getSettings(): array
    {
        return [
            'client_id' => SiteSetting::getValue('pathao_client_id', '7N1aMJQbWm'),
            'client_secret' => SiteSetting::getValue('pathao_client_secret', 'wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39'),
            'username' => SiteSetting::getValue('pathao_username', 'test@pathao.com'),
            'password' => SiteSetting::getValue('pathao_password', 'lovePathao'),
            'environment' => SiteSetting::getValue('pathao_environment', 'sandbox'),
            'enabled' => filter_var(SiteSetting::getValue('pathao_enabled', 'true'), FILTER_VALIDATE_BOOLEAN),
        ];
    }

    public function updateSettings(array $data): array
    {
        if (isset($data['client_id'])) SiteSetting::setValue('pathao_client_id', trim($data['client_id']));
        if (isset($data['client_secret'])) SiteSetting::setValue('pathao_client_secret', trim($data['client_secret']));
        if (isset($data['username'])) SiteSetting::setValue('pathao_username', trim($data['username']));
        if (isset($data['password'])) SiteSetting::setValue('pathao_password', trim($data['password']));
        if (isset($data['environment'])) SiteSetting::setValue('pathao_environment', trim($data['environment']));
        if (isset($data['enabled'])) SiteSetting::setValue('pathao_enabled', $data['enabled'] ? 'true' : 'false');

        Cache::forget('pathao_access_token');
        return $this->getSettings();
    }

    public function getBaseUrl(): string
    {
        $settings = $this->getSettings();
        return ($settings['environment'] ?? 'sandbox') === 'production'
            ? self::PRODUCTION_BASE_URL
            : self::SANDBOX_BASE_URL;
    }

    public function getAccessToken(): string
    {
        $settings = $this->getSettings();
        $cacheKey = 'pathao_access_token_' . md5($settings['client_id'] . '_' . $settings['environment']);

        return Cache::remember($cacheKey, now()->addMinutes(60), function () use ($settings) {
            $baseUrl = $this->getBaseUrl();
            $response = Http::asJson()->acceptJson()->post("{$baseUrl}/aladdin/api/v1/issue-token", [
                'client_id' => $settings['client_id'],
                'client_secret' => $settings['client_secret'],
                'grant_type' => 'password',
                'username' => $settings['username'],
                'password' => $settings['password'],
            ]);

            if (! $response->successful()) {
                $msg = $response->json('message') ?? $response->json('error_description') ?? 'Failed to authenticate with Pathao API.';
                throw new RuntimeException("Pathao Auth Error: {$msg}");
            }

            $token = $response->json('access_token');
            if (blank($token)) {
                throw new RuntimeException('Pathao authentication response did not contain an access token.');
            }

            return $token;
        });
    }

    public function sendOrderToPathao(Order $order): array
    {
        if ($order->pathao_consignment_id) {
            return [
                'success' => true,
                'already_sent' => true,
                'consignment_id' => $order->pathao_consignment_id,
                'message' => "Order #{$order->order_number} already has a consignment ID ({$order->pathao_consignment_id}).",
            ];
        }

        if (strtolower((string) $order->status) !== 'shipped') {
            throw new RuntimeException("Order #{$order->order_number} must be marked Shipped after packing before it can be sent to Pathao.");
        }

        $shop = $order->shop ?? Shop::find($order->shop_id);
        $pathaoStoreId = $shop?->settings['pathao_store_id'] ?? null;

        if (blank($pathaoStoreId)) {
            $storeName = $shop?->name ?? "Store #{$order->shop_id}";
            throw new RuntimeException("Store '{$storeName}' is missing Pathao Store ID. Configure Pathao Store ID in Store Settings.");
        }

        $recipientName = trim($order->checkout_name ?: ($order->customer_details['name'] ?? ($order->customer?->name ?? 'Valued Customer')));
        if (strlen($recipientName) < 3) {
            $recipientName = str_pad($recipientName, 3, ' ');
        }
        if (strlen($recipientName) > 100) {
            $recipientName = substr($recipientName, 0, 100);
        }

        $recipientPhone = preg_replace('/[^0-9]/', '', $order->checkout_mobile_number ?: ($order->customer_details['phone'] ?? ($order->shipping_mobile_number ?? '')));
        if (strlen($recipientPhone) === 10) {
            $recipientPhone = str_starts_with($recipientPhone, '1') ? '0' . $recipientPhone : $recipientPhone . '0';
        }
        if (strlen($recipientPhone) < 11) {
            $recipientPhone = str_pad($recipientPhone, 11, '0', STR_PAD_RIGHT);
        }
        if (strlen($recipientPhone) > 11) {
            $recipientPhone = substr($recipientPhone, 0, 11);
        }

        $recipientAddress = trim($order->shipping_full_address ?: ($order->checkout_full_address ?: ($order->address['street'] ?? '')));
        if (strlen($recipientAddress) < 10) {
            $recipientAddress = $recipientAddress . ', ' . ($order->checkout_district ?: 'Dhaka') . ', Bangladesh';
        }
        if (strlen($recipientAddress) < 10) {
            $recipientAddress = str_pad($recipientAddress, 10, ' ');
        }
        if (strlen($recipientAddress) > 220) {
            $recipientAddress = substr($recipientAddress, 0, 220);
        }

        $isPaid = strtolower($order->payment_status ?? '') === 'paid' || (float) $order->due_amount <= 0 && (float) $order->paid_amount >= (float) $order->grand_total;
        $amountToCollect = $isPaid ? 0 : (int) round(max(0, (float) ($order->due_amount ?: ((float) $order->grand_total - (float) $order->paid_amount))));

        $itemQuantity = max(1, (int) ($order->items()->sum('quantity') ?: 1));

        $payload = [
            'store_id' => (int) $pathaoStoreId,
            'merchant_order_id' => (string) ($order->order_number ?: $order->id),
            'recipient_name' => $recipientName,
            'recipient_phone' => $recipientPhone,
            'recipient_address' => $recipientAddress,
            'delivery_type' => 48,
            'item_type' => 2,
            'item_quantity' => $itemQuantity,
            'item_weight' => 0.5,
            'amount_to_collect' => $amountToCollect,
            'item_description' => "Order #" . ($order->order_number ?: $order->id),
        ];

        if (! empty($order->customer_note)) {
            $payload['special_instruction'] = substr($order->customer_note, 0, 250);
        }

        $token = $this->getAccessToken();
        $baseUrl = $this->getBaseUrl();

        $response = Http::withToken($token)->asJson()->acceptJson()->post("{$baseUrl}/aladdin/api/v1/orders", $payload);

        if (! $response->successful()) {
            $errData = $response->json();
            $errorMsg = $errData['message'] ?? $errData['error'] ?? 'Failed to create order in Pathao.';
            if (! empty($errData['errors']) && is_array($errData['errors'])) {
                $flat = [];
                foreach ($errData['errors'] as $field => $errs) {
                    $flat[] = is_array($errs) ? implode(', ', $errs) : (string) $errs;
                }
                $errorMsg .= ' (' . implode('; ', $flat) . ')';
            }
            throw new RuntimeException("Pathao API Error: {$errorMsg}");
        }

        $consignmentId = $response->json('data.consignment_id');
        if (blank($consignmentId)) {
            throw new RuntimeException('Pathao response did not return a consignment_id.');
        }

        $order->update([
            'pathao_consignment_id' => $consignmentId,
            'delivery_status' => 'shipped_pathao',
        ]);

        return [
            'success' => true,
            'already_sent' => false,
            'consignment_id' => $consignmentId,
            'message' => "Order #{$order->order_number} successfully sent to Pathao. Consignment ID: {$consignmentId}",
        ];
    }

    public function getOrderInfo(string $consignmentId): array
    {
        if (blank($consignmentId)) {
            throw new RuntimeException('Consignment ID is required.');
        }

        $token = $this->getAccessToken();
        $baseUrl = $this->getBaseUrl();

        $response = Http::withToken($token)
            ->acceptJson()
            ->get("{$baseUrl}/aladdin/api/v1/orders/{$consignmentId}/info");

        if (! $response->successful()) {
            $msg = $response->json('message') ?? 'Failed to fetch Pathao order status.';
            throw new RuntimeException("Pathao API Error: {$msg}");
        }

        return $response->json('data') ?? [];
    }

    public function lookupCustomerHistory(string $phone): array
    {
        $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($cleanPhone) === 10 && str_starts_with($cleanPhone, '1')) {
            $cleanPhone = '0' . $cleanPhone;
        }

        if (strlen($cleanPhone) !== 11) {
            return [
                'success' => false,
                'message' => 'Invalid phone number format for Pathao lookup.',
                'data' => null,
            ];
        }

        try {
            $token = $this->getAccessToken();
            $baseUrl = $this->getBaseUrl();

            $response = Http::withToken($token)
                ->asJson()
                ->acceptJson()
                ->post("{$baseUrl}/aladdin/api/v1/user/success", [
                    'phone' => $cleanPhone,
                ]);

            if (! $response->successful()) {
                return [
                    'success' => false,
                    'message' => $response->json('message') ?? 'Failed to lookup customer history on Pathao.',
                    'data' => null,
                ];
            }

            return [
                'success' => true,
                'data' => $response->json('data') ?? null,
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => $e->getMessage(),
                'data' => null,
            ];
        }
    }
}

