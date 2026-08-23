<?php

declare(strict_types=1);

namespace {
    final class FakeMoment
    {
        public function __construct(public int $seconds) {}
        public function diffInSeconds(FakeMoment $other): int { return abs($other->seconds - $this->seconds); }
    }

    $GLOBALS['prd02_now'] = 1000;
    function now(): FakeMoment { return new FakeMoment($GLOBALS['prd02_now']); }
    function config(string $key, mixed $default = null): mixed
    {
        return match ($key) {
            'hajjmart.offline_commerce.healthy_seconds' => 60,
            'hajjmart.offline_commerce.offline_confirmed_seconds' => 180,
            default => $default,
        };
    }
}

namespace App\Models {
    final class Shop
    {
        public mixed $storeDevice;
        public function __construct(mixed $device) { $this->storeDevice = $device; }
        public function relationLoaded(string $relation): bool { return $relation === 'storeDevice'; }
        public function storeDevice(): object { return new class($this->storeDevice) { public function __construct(private mixed $device) {} public function first(): mixed { return $this->device; } }; }
    }
}

namespace {
    require dirname(__DIR__).'/app/Services/StoreConnectivityService.php';

    use App\Models\Shop;
    use App\Services\StoreConnectivityService;

    function device(int $age, string $state = 'normal', string $status = 'active'): object
    {
        return (object) [
            'status' => $status,
            'operational_state' => $state,
            'last_heartbeat_at' => new FakeMoment($GLOBALS['prd02_now'] - $age),
            'registered_at' => new FakeMoment($GLOBALS['prd02_now'] - $age),
        ];
    }

    $service = new StoreConnectivityService();
    $cases = [
        [new Shop(null), StoreConnectivityService::ONLINE_HEALTHY, 'unregistered store remains online-only compatible'],
        [new Shop(device(0)), StoreConnectivityService::ONLINE_HEALTHY, 'fresh heartbeat'],
        [new Shop(device(60)), StoreConnectivityService::ONLINE_HEALTHY, 'healthy inclusive boundary'],
        [new Shop(device(61)), StoreConnectivityService::OFFLINE_SUSPECTED, 'suspected lower boundary'],
        [new Shop(device(180)), StoreConnectivityService::OFFLINE_SUSPECTED, 'suspected inclusive upper boundary'],
        [new Shop(device(181)), StoreConnectivityService::OFFLINE_CONFIRMED, 'confirmed offline boundary'],
        [new Shop(device(0, 'reconciling')), StoreConnectivityService::RECONCILING, 'reconciling overrides fresh heartbeat'],
        [new Shop(device(0, 'recovery_required')), StoreConnectivityService::RECOVERY_REQUIRED, 'recovery overrides fresh heartbeat'],
        [new Shop(device(500, 'normal', 'revoked')), StoreConnectivityService::ONLINE_HEALTHY, 'revoked binding cannot create offline risk'],
    ];

    foreach ($cases as [$shop, $expected, $label]) {
        $actual = $service->stateFor($shop);
        if ($actual !== $expected) {
            fwrite(STDERR, "FAIL {$label}: expected {$expected}, got {$actual}\n");
            exit(1);
        }
    }

    $suspected = new Shop(device(61));
    if (! $service->isSuspectedOrOffline($suspected) || ! $service->blocksOutboundStock($suspected) || $service->allowsOnlineFulfilment($suspected)) {
        fwrite(STDERR, "FAIL connectivity predicates for suspected store\n");
        exit(1);
    }

    echo 'PRD-02 connectivity behavior passed: '.(count($cases) + 1)."/".(count($cases) + 1)." checks.\n";
}
