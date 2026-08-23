<?php

namespace App\Services;

use App\Exceptions\InventoryConflictException;
use App\Models\Inventory;
use App\Models\Shop;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class StoreAllocationService
{
    public function __construct(private StoreConnectivityService $connectivity) {}

    /**
     * Choose a single fulfilment store for a Website order based on candidate eligibility and preference order.
     * V1 never splits an order across stores.
     *
     * @param array $items Array of items with keys: product_id, variant_id (optional), quantity
     * @param int|null $preferredShopId Optional explicit preferred shop ID
     * @return array ['shop' => Shop, 'is_provisional' => bool]
     */
    public function chooseStoreForWebsiteOrder(array $items, ?int $preferredShopId = null): array
    {
        if (empty($items)) {
            throw new RuntimeException('Cannot allocate store for empty checkout items.');
        }

        $shops = Shop::query()
            ->where('is_active', true)
            ->with(['storeDevice'])
            ->get();

        $candidates = [];

        foreach ($shops as $shop) {
            // Check Website channel support (defaults to true unless explicitly disabled in settings)
            $settings = $shop->settings ?? [];
            if (isset($settings['support_website_channel']) && $settings['support_website_channel'] === false) {
                continue;
            }

            // Connectivity / session state check
            $state = $this->connectivity->stateFor($shop);
            if (in_array($state, [StoreConnectivityService::RECONCILING, StoreConnectivityService::RECOVERY_REQUIRED], true)) {
                continue;
            }

            // Check if store has stock for ALL items
            if (! $this->storeHasAllItemsStock($shop->id, $items)) {
                continue;
            }

            // Priority classification
            $isProvisional = in_array($state, [StoreConnectivityService::OFFLINE_SUSPECTED, StoreConnectivityService::OFFLINE_CONFIRMED], true);

            $priority = 999;
            if (! $isProvisional) {
                if ($preferredShopId && (int) $shop->id === (int) $preferredShopId) {
                    $priority = 1;
                } elseif (isset($settings['online_fulfilment_priority']) && is_numeric($settings['online_fulfilment_priority'])) {
                    $priority = (int) $settings['online_fulfilment_priority'];
                } else {
                    $priority = $shop->is_default ? 2 : 10;
                }
            } else {
                $priority = 1000 + ($shop->is_default ? 1 : 10);
            }

            $candidates[] = [
                'shop' => $shop,
                'is_provisional' => $isProvisional,
                'priority' => $priority,
            ];
        }

        if (empty($candidates)) {
            throw new InventoryConflictException('inventory_insufficient_available', 'Insufficient available stock across safe fulfilment stores for this order.');
        }

        // Sort candidates deterministically by priority asc, then shop id asc
        usort($candidates, function (array $a, array $b): int {
            if ($a['priority'] !== $b['priority']) {
                return $a['priority'] <=> $b['priority'];
            }
            return $a['shop']->id <=> $b['shop']->id;
        });

        $winner = $candidates[0];
        return [
            'shop' => $winner['shop'],
            'is_provisional' => $winner['is_provisional'],
        ];
    }

    /**
     * Compute deterministic item hash.
     */
    public function computeItemHash(array $items): string
    {
        $normalized = [];
        foreach ($items as $item) {
            $normalized[] = [
                'p' => (int) ($item['product_id'] ?? 0),
                'v' => isset($item['variant_id']) && $item['variant_id'] !== null ? (int) $item['variant_id'] : null,
                'q' => (int) ($item['quantity'] ?? 1),
            ];
        }

        usort($normalized, fn ($a, $b) => [$a['p'], $a['v']] <=> [$b['p'], $b['v']]);
        return md5(json_encode($normalized));
    }

    /**
     * Generate an opaque allocation token.
     */
    public function generateAllocationToken(Shop $shop, array $items, float $grandTotal, bool $isProvisional): string
    {
        $payload = [
            'shop_id' => $shop->id,
            'item_hash' => $this->computeItemHash($items),
            'inventory_revision' => (int) ($shop->inventory_revision ?? 0),
            'grand_total' => round($grandTotal, 2),
            'is_provisional' => $isProvisional,
            'expires_at' => now()->addMinutes(15)->timestamp,
        ];

        $json = json_encode($payload);
        $sig = hash_hmac('sha256', $json, config('app.key', 'base64:hajjmart_secret_key'));
        return base64_encode($json . '.' . $sig);
    }

    /**
     * Verify opaque allocation token.
     */
    public function verifyAllocationToken(string $token, array $items): array
    {
        $decoded = base64_decode($token, true);
        if (! $decoded || ! str_contains($decoded, '.')) {
            throw new InventoryConflictException('allocation_token_invalid', 'The allocation token is invalid or corrupted.');
        }

        $lastDot = strrpos($decoded, '.');
        $json = substr($decoded, 0, $lastDot);
        $sig = substr($decoded, $lastDot + 1);

        $expectedSig = hash_hmac('sha256', $json, config('app.key', 'base64:hajjmart_secret_key'));
        if (! hash_equals($expectedSig, $sig)) {
            throw new InventoryConflictException('allocation_token_invalid', 'The allocation token signature is invalid.');
        }

        $payload = json_decode($json, true);
        if (! is_array($payload)) {
            throw new InventoryConflictException('allocation_token_invalid', 'The allocation token payload is invalid.');
        }

        if (($payload['expires_at'] ?? 0) < now()->timestamp) {
            throw new InventoryConflictException('allocation_token_expired', 'The allocation quote token has expired. Please re-quote your order.');
        }

        $currentHash = $this->computeItemHash($items);
        if ($payload['item_hash'] !== $currentHash) {
            throw new InventoryConflictException('allocation_token_mismatch', 'Cart items do not match the allocation token. Please re-quote.');
        }

        return $payload;
    }

    /**
     * Check if a specific store is eligible to fulfill the requested items.
     */
    public function isStoreEligible(int $shopId, array $items): bool
    {
        $shop = Shop::query()->find($shopId);
        if (! $shop || ! $shop->is_active) {
            return false;
        }

        $state = $this->connectivity->stateFor($shop);
        if (in_array($state, [StoreConnectivityService::RECONCILING, StoreConnectivityService::RECOVERY_REQUIRED], true)) {
            return false;
        }

        return $this->storeHasAllItemsStock($shopId, $items);
    }

    /**
     * Check if a shop has available stock for all requested items.
     */
    private function storeHasAllItemsStock(int $shopId, array $items): bool
    {
        foreach ($items as $item) {
            $productId = (int) $item['product_id'];
            $variantId = isset($item['variant_id']) && $item['variant_id'] !== null ? (int) $item['variant_id'] : null;
            $quantity = (int) ($item['quantity'] ?? 1);

            $inv = Inventory::query()
                ->where('shop_id', $shopId)
                ->where('product_id', $productId)
                ->where('variant_id', $variantId)
                ->first();

            if (! $inv || ($inv->quantity - $inv->reserved) < $quantity) {
                return false;
            }
        }
        return true;
    }
}
