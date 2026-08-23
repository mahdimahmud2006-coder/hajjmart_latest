<?php

namespace App\Services;

use App\Exceptions\OfflineSessionException;
use App\Exceptions\StoreDeviceException;
use App\Models\Inventory;
use App\Models\OfflineInventorySession;
use App\Models\OfflineInventorySnapshotItem;
use App\Models\ReservedProduct;
use App\Models\Shop;
use App\Models\StoreDevice;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OfflineSnapshotService
{
    public function __construct(private OfflineSessionService $sessions) {}

    public function bootstrap(StoreDevice $verifiedDevice, array $client = []): array
    {
        return DB::transaction(function () use ($verifiedDevice, $client): array {
            // Keep PRD-02's lock order (shop -> device) so bootstrap cannot
            // deadlock against device registration/replacement.
            $shop = Shop::query()->whereKey($verifiedDevice->shop_id)->lockForUpdate()->firstOrFail();
            $device = StoreDevice::query()->whereKey($verifiedDevice->id)->lockForUpdate()->firstOrFail();
            if ($device->status !== 'active'
                || (int) $device->shop_id !== (int) $shop->id
                || ! hash_equals($device->device_uuid, $verifiedDevice->device_uuid)
                || (int) $device->binding_version !== (int) $verifiedDevice->binding_version) {
                throw new StoreDeviceException('store_device_invalid', 'This device binding changed. Register or replace the store device before continuing.', 401);
            }

            if (! $shop->is_active) {
                throw new StoreDeviceException('store_inactive', 'This store is inactive and cannot start offline commerce.', 422);
            }

            $existing = OfflineInventorySession::query()
                ->where('store_device_id', $device->id)
                ->where('binding_version', $device->binding_version)
                ->whereIn('status', ['open', 'reconciling', 'recovery_required'])
                ->latest('id')
                ->lockForUpdate()
                ->first();

            $refresh = (bool) ($client['refresh_snapshot'] ?? false);
            if ($refresh && (! array_key_exists('unsynced_event_count', $client) || ! array_key_exists('last_local_sequence', $client))) {
                throw new OfflineSessionException(
                    'offline_events_must_sync_before_new_snapshot',
                    'Report the current offline queue state before refreshing this store snapshot.',
                );
            }
            $unsyncedCount = max(0, (int) ($client['unsynced_event_count'] ?? 0));
            $lastLocalSequence = max(0, (int) ($client['last_local_sequence'] ?? 0));
            $lastKnownSessionId = $client['last_known_session_id'] ?? null;

            if ($existing && $existing->status !== 'open') {
                throw new OfflineSessionException(
                    'offline_session_requires_resolution',
                    'This store session must finish reconciliation or recovery before a new snapshot can be issued.',
                );
            }

            if ($existing && ! $refresh) {
                if ($unsyncedCount > 0 && $lastKnownSessionId && $lastKnownSessionId !== $existing->session_id) {
                    throw new OfflineSessionException(
                        'offline_events_must_sync_before_new_snapshot',
                        'Saved offline transactions belong to another session and must be resolved before a new snapshot is used.',
                    );
                }
                return $this->payload($device, $existing);
            }

            if ($existing && $refresh) {
                if ($unsyncedCount > 0 || $lastLocalSequence > (int) $existing->last_client_sequence) {
                    throw new OfflineSessionException(
                        'offline_events_must_sync_before_new_snapshot',
                        'Saved offline transactions must sync before this store can refresh its stock snapshot.',
                    );
                }
                $existing->update(['status' => 'closed', 'closed_at' => now()]);
            } elseif (! $existing && ($unsyncedCount > 0 || $lastLocalSequence > 0)) {
                throw new OfflineSessionException(
                    'offline_events_must_sync_before_new_snapshot',
                    'Saved offline transactions must be resolved before this store can start a new stock snapshot.',
                );
            }

            $session = OfflineInventorySession::query()->create([
                'session_id' => (string) Str::uuid(),
                'snapshot_id' => (string) Str::uuid(),
                'shop_id' => $shop->id,
                'store_device_id' => $device->id,
                'binding_version' => $device->binding_version,
                'boundary_server_at' => now(),
                'opening_inventory_revision' => (int) $shop->inventory_revision,
                'status' => 'open',
                'opened_at' => now(),
                'last_client_sequence' => 0,
            ]);

            $this->captureItems($session, $shop);
            return $this->payload($device, $session->fresh());
        }, 3);
    }

    private function captureItems(OfflineInventorySession $session, Shop $shop): void
    {
        $reservationTotals = ReservedProduct::query()
            ->active()
            ->where('shop_id', $shop->id)
            ->selectRaw('product_id, COALESCE(variant_id, 0) as variant_key, SUM(qty) as active_reserved')
            ->groupBy('product_id', 'variant_id')
            ->get()
            ->keyBy(fn ($row) => $row->product_id . ':' . $row->variant_key);

        $rows = Inventory::query()
            ->with([
                'product:id,name,sku,selling_price,retail_price,wholesale_price,sale_price,is_active,sell_on_pos,sell_on_social',
                'variant:id,product_id,sku,price,sale_price,retail_price,wholesale_price,is_active',
            ])
            ->where('shop_id', $shop->id)
            ->whereHas('product', fn ($query) => $query->where('is_active', true))
            ->orderBy('product_id')
            ->orderByRaw('COALESCE(variant_id, 0)')
            ->get();

        foreach ($rows as $inventory) {
            $product = $inventory->product;
            $variant = $inventory->variant;
            if ($inventory->variant_id && (! $variant || ! $variant->is_active)) {
                continue;
            }

            $variantKey = $inventory->variant_id ? (int) $inventory->variant_id : 0;
            $ledgerReserved = (int) ($reservationTotals->get($inventory->product_id . ':' . $variantKey)?->active_reserved ?? 0);
            if ($ledgerReserved !== (int) $inventory->reserved || $ledgerReserved > (int) $inventory->quantity) {
                throw new OfflineSessionException(
                    'reservation_counter_inconsistent',
                    'Store reservations do not match the inventory counter. Resolve the inventory discrepancy before starting offline sales.',
                );
            }

            $available = (int) $inventory->quantity - $ledgerReserved;
            OfflineInventorySnapshotItem::query()->create([
                'offline_inventory_session_id' => $session->id,
                'product_id' => $inventory->product_id,
                'variant_id' => $inventory->variant_id,
                'variant_key' => $variantKey,
                'sku_snapshot' => $variant?->sku ?: $product->sku,
                'product_name_snapshot' => $product->name,
                'opening_quantity' => (int) $inventory->quantity,
                'opening_reserved' => $ledgerReserved,
                'opening_available' => $available,
                'retail_price' => $this->retailPrice($product, $variant),
                'wholesale_price' => $this->wholesalePrice($product, $variant),
                'sell_on_pos' => true,
                'sell_on_social' => true,
                'product_active' => (bool) $product->is_active,
            ]);
        }
    }

    private function payload(StoreDevice $device, OfflineInventorySession $session): array
    {
        $session->loadMissing(['snapshotItems' => fn ($query) => $query->orderBy('id')]);

        return [
            'device' => [
                'device_uuid' => $device->device_uuid,
                'binding_version' => (int) $device->binding_version,
                'shop_id' => (int) $device->shop_id,
            ],
            'session' => $this->sessions->publicData($session),
            'catalog' => $session->snapshotItems->map(fn (OfflineInventorySnapshotItem $item) => [
                'product_id' => (int) $item->product_id,
                'variant_id' => $item->variant_id ? (int) $item->variant_id : null,
                'sku' => $item->sku_snapshot,
                'product_name' => $item->product_name_snapshot,
                'opening_quantity' => (int) $item->opening_quantity,
                'opening_reserved' => (int) $item->opening_reserved,
                'opening_available' => (int) $item->opening_available,
                'retail_price' => $item->retail_price,
                'wholesale_price' => $item->wholesale_price,
                'sell_on_pos' => (bool) $item->sell_on_pos,
                'sell_on_social' => (bool) $item->sell_on_social,
                'product_active' => (bool) $item->product_active,
            ])->values()->all(),
        ];
    }

    private function retailPrice(object $product, ?object $variant): float
    {
        return round((float) ($variant?->retail_price
            ?? $variant?->sale_price
            ?? $variant?->price
            ?? $product->retail_price
            ?? $product->sale_price
            ?? $product->selling_price
            ?? 0), 2);
    }

    private function wholesalePrice(object $product, ?object $variant): float
    {
        return round((float) ($variant?->wholesale_price
            ?? $product->wholesale_price
            ?? $variant?->retail_price
            ?? $variant?->sale_price
            ?? $variant?->price
            ?? $product->retail_price
            ?? $product->sale_price
            ?? $product->selling_price
            ?? 0), 2);
    }
}
