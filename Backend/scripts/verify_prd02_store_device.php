<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$checks = 0;
$failures = [];

function check(bool $condition, string $message): void
{
    global $checks, $failures;
    $checks++;
    if (! $condition) $failures[] = $message;
}

function source(string $path): string
{
    $content = file_get_contents($path);
    if ($content === false) throw new RuntimeException("Cannot read {$path}");
    return $content;
}

$migration = source($root.'/database/migrations/2026_08_21_010000_create_store_devices_table.php');
$model = source($root.'/app/Models/StoreDevice.php');
$deviceService = source($root.'/app/Services/StoreDeviceService.php');
$connectivity = source($root.'/app/Services/StoreConnectivityService.php');
$controller = source($root.'/app/Http/Controllers/Api/V1/Admin/OfflineDeviceController.php');
$routes = source($root.'/routes/api.php');
$config = source($root.'/config/hajjmart.php');
$provider = source($root.'/app/Providers/AppServiceProvider.php');
$shop = source($root.'/app/Models/Shop.php');
$frontendRoot = dirname($root).'/frontend';
$deviceClient = source($frontendRoot.'/src/lib/offline/commerce-device.ts');
$heartbeat = source($frontendRoot.'/src/components/admin/offline-commerce-heartbeat.tsx');
$adminLayout = source($frontendRoot.'/src/app/admin/layout.tsx');
$posDb = source($frontendRoot.'/src/lib/offline/pos-db.ts');
$socialDb = source($frontendRoot.'/src/lib/offline/social-order-offline.ts');

foreach (['shop_id', 'device_uuid', 'device_token_hash', 'binding_version', 'operational_state', 'registered_by', 'last_heartbeat_at', 'last_seen_user_id', 'last_app_version', 'replaced_at', 'replaced_by'] as $column) {
    check(str_contains($migration, "'{$column}'"), "migration missing {$column}");
}
check(str_contains($migration, "foreignId('shop_id')->unique()"), 'shop binding is not DB-unique');
check(str_contains($migration, "uuid('device_uuid')->unique()"), 'device UUID is not DB-unique');
check(str_contains($model, "protected \$hidden = ['device_token_hash']"), 'token hash is not hidden');
check(str_contains($shop, 'function storeDevice(): HasOne'), 'Shop missing storeDevice relation');
check(str_contains($deviceService, "'store_device_already_bound'"), 'missing already-bound conflict');
check(str_contains($deviceService, "'store_device_invalid'"), 'missing invalid-device conflict');
check(str_contains($deviceService, 'hash_hmac'), 'device secret is not HMAC-hashed');
check(str_contains($deviceService, 'random_bytes(32)'), 'device secret is not high entropy');
check(!str_contains($deviceService, "'device_token_hash' => \$token"), 'raw token appears to be stored');
check(str_contains($deviceService, 'lockForUpdate()'), 'registration/replacement lacks locking');
check(str_contains($deviceService, "'binding_version' => \$device->binding_version + 1"), 'replacement does not increment binding version');
check(str_contains($deviceService, "'last_heartbeat_at' => now()"), 'heartbeat is not server observed');
check(str_contains($controller, 'X-HajjMart-Device-Id'), 'heartbeat missing device ID header');
check(str_contains($controller, 'X-HajjMart-Device-Token'), 'heartbeat missing device token header');
check(str_contains($controller, "'store_device_store_mismatch'"), 'cross-store heartbeat guard missing');
check(str_contains($routes, "'/offline-device/register'"), 'register route missing');
check(str_contains($routes, "'/offline-device/heartbeat'"), 'heartbeat route missing');
check(str_contains($routes, "'/offline-device/replace'"), 'replace route missing');
check(substr_count($routes, "'/pos/ping'") === 1 && substr_count($routes, "'/pos/bootstrap'") === 1 && substr_count($routes, "'/pos/sync'") === 1, 'legacy POS routes changed or duplicated');
check(str_contains($routes, 'EnsureAdmin::class') && str_contains($routes, 'throttle:offline-device-admin'), 'admin/device rate limiting missing');
check(str_contains($provider, "RateLimiter::for('offline-device-heartbeat'"), 'heartbeat limiter missing');
check(str_contains($config, "'heartbeat_interval_seconds' => (int) env('HAJJMART_OFFLINE_HEARTBEAT_INTERVAL_SECONDS', 25)"), '25s heartbeat default missing');
check(str_contains($config, "'healthy_seconds' => (int) env('HAJJMART_OFFLINE_HEALTHY_SECONDS', 60)"), '60s healthy threshold missing');
check(str_contains($config, "'offline_confirmed_seconds' => (int) env('HAJJMART_OFFLINE_CONFIRMED_SECONDS', 180)"), '180s offline threshold missing');
check(str_contains($connectivity, "ONLINE_HEALTHY = 'online_healthy'"), 'healthy state missing');
check(str_contains($connectivity, "OFFLINE_SUSPECTED = 'offline_suspected'"), 'suspected state missing');
check(str_contains($connectivity, "OFFLINE_CONFIRMED = 'offline_confirmed'"), 'offline state missing');
check(str_contains($connectivity, "RECONCILING = 'reconciling'"), 'reconciling state missing');
check(str_contains($connectivity, "RECOVERY_REQUIRED = 'recovery_required'"), 'recovery state missing');
check(str_contains($deviceClient, 'hajjmart-commerce-device-v2'), 'new common device storage key missing');
check(str_contains($deviceClient, 'registerCommerceDevice'), 'frontend register helper missing');
check(str_contains($deviceClient, 'replaceCommerceDevice'), 'frontend replace helper missing');
check(str_contains($deviceClient, 'sendCommerceDeviceHeartbeat'), 'frontend heartbeat helper missing');
check(str_contains($heartbeat, 'window.addEventListener("online"'), 'heartbeat does not resume on online event');
check(str_contains($heartbeat, 'document.addEventListener("visibilitychange"'), 'heartbeat does not resume on visibility event');
check(str_contains($adminLayout, '<OfflineCommerceHeartbeat/>'), 'single admin-level heartbeat is not mounted');
check(str_contains($posDb, 'hajjmart-pos-terminal-v1'), 'legacy POS device ID was removed prematurely');
check(str_contains($socialDb, 'hajjmart-social-device-v1'), 'legacy Social device ID was removed prematurely');

if ($failures) {
    fwrite(STDERR, "PRD-02 verification failed (".count($failures)."/{$checks}):\n - ".implode("\n - ", $failures)."\n");
    exit(1);
}

echo "PRD-02 verification passed: {$checks}/{$checks} checks.\n";
