<?php

declare(strict_types=1);

namespace {
    final class FakeMoment03
    {
        public function __construct(public int $seconds) {}
        public function diffInSeconds(FakeMoment03 $other): int { return abs($other->seconds - $this->seconds); }
    }

    $GLOBALS['prd03_now'] = 200000;
    function now(): FakeMoment03 { return new FakeMoment03($GLOBALS['prd03_now']); }
    function config(string $key, mixed $default = null): mixed
    {
        return $key === 'hajjmart.offline_commerce.offline_snapshot_startup_max_age_hours' ? 24 : $default;
    }
}

namespace App\Models {
    final class OfflineInventorySession
    {
        public function __construct(public mixed $boundary_server_at) {}
    }
    final class StoreDevice {}
}

namespace {
    require dirname(__DIR__).'/app/Services/OfflineSessionService.php';

    use App\Models\OfflineInventorySession;
    use App\Services\OfflineSessionService;

    $service = new OfflineSessionService();
    $checks = 0;

    $assert = function (bool $condition, string $label) use (&$checks): void {
        $checks++;
        if (! $condition) {
            fwrite(STDERR, "FAIL {$label}\n");
            exit(1);
        }
    };

    $fresh = $service->startupState(new OfflineInventorySession(new FakeMoment03($GLOBALS['prd03_now'] - 60)), false);
    $assert($fresh['startup_allowed'] && ! $fresh['is_stale'] && $fresh['reason_code'] === null, 'fresh snapshot startup');

    $boundary = $service->startupState(new OfflineInventorySession(new FakeMoment03($GLOBALS['prd03_now'] - 24 * 3600)), false);
    $assert($boundary['startup_allowed'] && ! $boundary['is_stale'], '24h boundary remains valid');

    $stale = $service->startupState(new OfflineInventorySession(new FakeMoment03($GLOBALS['prd03_now'] - (24 * 3600 + 1))), false);
    $assert(! $stale['startup_allowed'] && $stale['is_stale'], '24h plus one second is stale');
    $assert($stale['reason_code'] === 'offline_snapshot_too_old', 'stale reason code');

    $continuous = $service->startupState(new OfflineInventorySession(new FakeMoment03($GLOBALS['prd03_now'] - (48 * 3600))), true);
    $assert($continuous['startup_allowed'] && $continuous['is_stale'] && $continuous['reason_code'] === null, 'continuous durable session may continue');

    echo "PRD-03 stale policy behavior passed: {$checks}/{$checks} checks.\n";
}
