<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$checks = 0;
$failures = [];

function check03(bool $condition, string $message): void
{
    global $checks, $failures;
    $checks++;
    if (! $condition) $failures[] = $message;
}

function source03(string $path): string
{
    $content = file_get_contents($path);
    if ($content === false) throw new RuntimeException("Cannot read {$path}");
    return $content;
}

$migration = source03($root.'/database/migrations/2026_08_21_020000_create_offline_inventory_epoch_foundation.php');
$inventory = source03($root.'/app/Services/InventoryService.php');
$snapshot = source03($root.'/app/Services/OfflineSnapshotService.php');
$sessions = source03($root.'/app/Services/OfflineSessionService.php');
$sessionModel = source03($root.'/app/Models/OfflineInventorySession.php');
$itemModel = source03($root.'/app/Models/OfflineInventorySnapshotItem.php');
$controller = source03($root.'/app/Http/Controllers/Api/V1/Admin/OfflineSessionController.php');
$deviceController = source03($root.'/app/Http/Controllers/Api/V1/Admin/OfflineDeviceController.php');
$deviceService = source03($root.'/app/Services/StoreDeviceService.php');
$shop = source03($root.'/app/Models/Shop.php');
$routes = source03($root.'/routes/api.php');
$config = source03($root.'/config/hajjmart.php');
$commit = source03($root.'/app/Actions/CommitInventoryAction.php');
$release = source03($root.'/app/Actions/ReleaseInventoryAction.php');
$frontendRoot = dirname($root).'/frontend';
$deviceClient = source03($frontendRoot.'/src/lib/offline/commerce-device.ts');
$sessionClient = source03($frontendRoot.'/src/lib/offline/commerce-session.ts');
$posDb = source03($frontendRoot.'/src/lib/offline/pos-db.ts');
$socialDb = source03($frontendRoot.'/src/lib/offline/social-order-offline.ts');

check03(str_contains($migration, "'inventory_revision'"), 'shops inventory_revision migration missing');
check03(str_contains($migration, "create('offline_inventory_sessions'"), 'offline_inventory_sessions table missing');
check03(str_contains($migration, "create('offline_inventory_snapshot_items'"), 'offline_inventory_snapshot_items table missing');
foreach (['session_id', 'snapshot_id', 'shop_id', 'store_device_id', 'binding_version', 'boundary_server_at', 'opening_inventory_revision', 'last_client_sequence', 'recovery_reason_code'] as $column) {
    check03(str_contains($migration, "'{$column}'"), "session migration missing {$column}");
}
foreach (['offline_inventory_session_id', 'product_id', 'variant_id', 'variant_key', 'sku_snapshot', 'product_name_snapshot', 'opening_quantity', 'opening_reserved', 'opening_available', 'retail_price', 'wholesale_price', 'sell_on_pos', 'sell_on_social', 'product_active'] as $column) {
    check03(str_contains($migration, "'{$column}'"), "snapshot item migration missing {$column}");
}
check03(str_contains($migration, 'offline_snapshot_item_sku_unique'), 'snapshot item store/product/variant uniqueness missing');
check03(str_contains($sessionModel, 'class OfflineInventorySession'), 'session model missing');
check03(str_contains($itemModel, 'class OfflineInventorySnapshotItem'), 'snapshot item model missing');
check03(str_contains($shop, "'inventory_revision' => 'integer'"), 'Shop inventory revision cast missing');
check03(str_contains($shop, 'offlineInventorySessions(): HasMany'), 'Shop session relation missing');

check03(substr_count($inventory, 'bumpShopRevision((int) $row->shop_id)') >= 5, 'reserve/release/commit/decrement/increment do not all bump store revision');
check03(str_contains($inventory, 'if ($quantityChange !== 0)') && str_contains($inventory, 'bumpShopRevision((int) $inventory->shop_id)'), 'manual adjustment does not bump revision');
check03(str_contains($inventory, 'public function reconcileReservedCounter'), 'counter repair not centralized in InventoryService');
check03(substr_count($inventory, 'lockForUpdate()->firstOrFail()') >= 7, 'stock-changing InventoryService paths are not consistently row-locked');
check03(str_contains($inventory, "increment('inventory_revision')"), 'store revision is not incremented atomically through InventoryService');
check03(!str_contains($commit, "forceFill(['reserved'"), 'Commit action still mutates reserved counter outside InventoryService');
check03(!str_contains($release, "forceFill(['reserved'"), 'Release action still mutates reserved counter outside InventoryService');
check03(str_contains($commit, 'reconcileReservedCounter') && str_contains($release, 'reconcileReservedCounter'), 'legacy reservation repair does not use InventoryService');

$shopLock = strpos($snapshot, 'Shop::query()->whereKey($verifiedDevice->shop_id)->lockForUpdate()');
$deviceLock = strpos($snapshot, 'StoreDevice::query()->whereKey($verifiedDevice->id)->lockForUpdate()');
check03($shopLock !== false && $deviceLock !== false && $shopLock < $deviceLock, 'snapshot lock order must remain shop -> device');
check03(str_contains($snapshot, "whereIn('status', ['open', 'reconciling', 'recovery_required'])"), 'unresolved session lookup missing');
check03(str_contains($snapshot, "'refresh_snapshot'"), 'explicit snapshot refresh contract missing');
check03(str_contains($snapshot, "array_key_exists('unsynced_event_count', \$client)") && str_contains($snapshot, "array_key_exists('last_local_sequence', \$client)"), 'snapshot refresh does not require explicit local queue state');
check03(str_contains($snapshot, "'offline_events_must_sync_before_new_snapshot'"), 'unsynced event rotation guard missing');
check03(str_contains($snapshot, 'return $this->payload($device, $existing);'), 'same open session is not re-read idempotently');
check03(str_contains($snapshot, "'status' => 'closed'"), 'safe snapshot rotation does not close old session');
check03(str_contains($snapshot, "'opening_inventory_revision' => (int) \$shop->inventory_revision"), 'snapshot does not capture store revision');
check03(str_contains($snapshot, "->active()") && str_contains($snapshot, 'SUM(qty) as active_reserved'), 'snapshot does not derive protected opening reserve from active ledger');
check03(str_contains($snapshot, '$ledgerReserved !== (int) $inventory->reserved'), 'snapshot does not fail closed on reservation counter mismatch');
check03(str_contains($snapshot, '$available = (int) $inventory->quantity - $ledgerReserved'), 'opening available formula incorrect/missing');
check03(str_contains($snapshot, "'retail_price' => \$this->retailPrice"), 'retail snapshot price missing');
check03(str_contains($snapshot, "'wholesale_price' => \$this->wholesalePrice"), 'wholesale snapshot price missing');
check03(str_contains($snapshot, "'sell_on_pos' => (bool) \$product->sell_on_pos"), 'POS eligibility snapshot missing');
check03(str_contains($snapshot, "'sell_on_social' => (bool) \$product->sell_on_social"), 'Social eligibility snapshot missing');

check03(str_contains($sessions, "'offline_snapshot_too_old'"), 'stale snapshot reason code missing');
check03(str_contains($sessions, 'offline_snapshot_startup_max_age_hours'), 'stale policy not centralized');
check03(str_contains($sessions, "['open', 'reconciling', 'recovery_required']"), 'device replacement unresolved-state set missing');
check03(str_contains($deviceService, 'assertDeviceReplacementAllowed($device)'), 'device replacement does not block unresolved session');
check03(str_contains($config, "HAJJMART_OFFLINE_SNAPSHOT_STARTUP_MAX_AGE_HOURS', 24"), '24h startup age default missing');

check03(str_contains($controller, "X-HajjMart-Device-Id") && str_contains($controller, "X-HajjMart-Device-Token"), 'snapshot APIs do not verify PRD-02 device credentials');
check03(str_contains($controller, "'shop_id' => ['nullable', 'integer']"), 'shop consistency assertion field missing');
check03(str_contains($controller, "'unsynced_event_count'"), 'bootstrap unsynced event count missing');
check03(str_contains($controller, "'last_known_session_id'"), 'bootstrap last known session field missing');
check03(str_contains($controller, "'last_local_sequence'"), 'bootstrap last local sequence field missing');
check03(str_contains($routes, "'/offline/bootstrap'"), 'offline bootstrap route missing');
check03(str_contains($routes, "'/offline/session/{sessionId}/status'"), 'offline session status route missing');
check03(str_contains($deviceController, "'server_inventory_revision'"), 'heartbeat missing server inventory revision');
check03(str_contains($deviceController, "'active_session_id'"), 'heartbeat missing active session id');
check03(str_contains($deviceController, "'snapshot_inventory_revision'"), 'heartbeat missing snapshot revision');
check03(str_contains($deviceController, "'snapshot_refresh_recommended'"), 'heartbeat missing refresh recommendation');

check03(str_contains($sessionClient, 'bootstrapOfflineCommerce'), 'frontend typed bootstrap helper missing');
check03(str_contains($sessionClient, 'getOfflineSessionStatus'), 'frontend typed session status helper missing');
check03(str_contains($sessionClient, 'opening_available'), 'frontend snapshot opening fields missing');
check03(str_contains($deviceClient, 'serverInventoryRevision'), 'frontend heartbeat revision state missing');
check03(str_contains($deviceClient, 'snapshotRefreshRecommended'), 'frontend heartbeat refresh state missing');
check03(str_contains($posDb, 'hajjmart-pos-terminal-v1'), 'legacy POS identity removed prematurely');
check03(str_contains($socialDb, 'hajjmart-social-device-v1'), 'legacy Social identity removed prematurely');
check03(substr_count($routes, "'/pos/ping'") === 1 && substr_count($routes, "'/pos/bootstrap'") === 1 && substr_count($routes, "'/pos/sync'") === 1, 'legacy POS routes changed or duplicated');

if ($failures) {
    fwrite(STDERR, "PRD-03 verification failed (".count($failures)."/{$checks}):\n - ".implode("\n - ", $failures)."\n");
    exit(1);
}

echo "PRD-03 verification passed: {$checks}/{$checks} checks.\n";
