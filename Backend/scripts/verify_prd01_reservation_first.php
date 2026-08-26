<?php

declare(strict_types=1);

namespace App\Enums {
    enum OrderStatus: string
    {
        case PENDING = 'pending';
        case CONFIRMED = 'confirmed';
        case PROCESSING = 'processing';
        case READY_TO_SHIP = 'ready_to_ship';
        case SHIPPED = 'shipped';
        case OUT_FOR_DELIVERY = 'out_for_delivery';
        case DELIVERED = 'delivered';
        case CANCELLED = 'cancelled';
    }

    enum PaymentStatus: string
    {
        case PAID = 'paid';
        case PENDING = 'pending';
    }
}

namespace App\Models {
    final class FakeReservationRelation
    {
        public function __construct(private readonly Order $order) {}
        public function exists(): bool { return $this->order->hasActiveReservation; }
    }

    class Order
    {
        public function __construct(
            public string $source_channel,
            public bool $hasActiveReservation,
        ) {}

        public int $refreshCount = 0;

        public function activeReservedProducts(): FakeReservationRelation
        {
            return new FakeReservationRelation($this);
        }

        public function fresh(mixed $relations = null): self { return $this; }
        public function refresh(): self { $this->refreshCount++; return $this; }
    }

    class OrderItem {}
    class OrderList {}
    class OrderStatusHistory {}
    class Payment {}
    class Shop {}
}

namespace App\Actions {
    class CommitInventoryAction
    {
        public static int $calls = 0;

        public static function run(\App\Models\Order $order): void
        {
            self::$calls++;
            $order->hasActiveReservation = false;
        }
    }

    class ReleaseInventoryAction {}
    class ReserveInventoryAction {}
}

namespace App\Services {
    class InventoryService {}
    class PromotionService {}
    class StoreAllocationService {}
}

namespace {
    $backend = dirname(__DIR__);
    require_once $backend . '/app/Services/OrderService.php';

    $failures = [];
    $checks = 0;

    $assert = static function (bool $condition, string $message) use (&$failures, &$checks): void {
        $checks++;
        if (! $condition) {
            $failures[] = $message;
        }
    };

    $read = static fn (string $relative): string => file_get_contents($backend . '/' . $relative) ?: '';

    // Exercise the actual centralized fulfilment gate from OrderService with stubs.
    $service = new \App\Services\OrderService(
        new \App\Services\InventoryService(),
        new \App\Services\PromotionService(),
        new \App\Services\StoreAllocationService(),
    );
    $method = new \ReflectionMethod($service, 'commitInventoryIfPhysicallyLeaving');
    $method->setAccessible(true);

    foreach ([
        \App\Enums\OrderStatus::CONFIRMED->value,
        \App\Enums\OrderStatus::PROCESSING->value,
        \App\Enums\OrderStatus::READY_TO_SHIP->value,
    ] as $status) {
        \App\Actions\CommitInventoryAction::$calls = 0;
        $order = new \App\Models\Order('website', true);
        $method->invoke($service, $order, $status);
        $assert(\App\Actions\CommitInventoryAction::$calls === 0, "{$status} must not commit inventory");
    }

    foreach ([
        \App\Enums\OrderStatus::SHIPPED->value,
        \App\Enums\OrderStatus::OUT_FOR_DELIVERY->value,
        \App\Enums\OrderStatus::DELIVERED->value,
    ] as $status) {
        \App\Actions\CommitInventoryAction::$calls = 0;
        $order = new \App\Models\Order('website', true);
        $method->invoke($service, $order, $status);
        $assert(\App\Actions\CommitInventoryAction::$calls === 1, "{$status} must commit one active reservation");
        $method->invoke($service, $order, $status);
        $assert(\App\Actions\CommitInventoryAction::$calls === 1, "{$status} retry must not commit twice");
    }

    \App\Actions\CommitInventoryAction::$calls = 0;
    $pos = new \App\Models\Order('pos', true);
    $method->invoke($service, $pos, \App\Enums\OrderStatus::DELIVERED->value);
    $assert(\App\Actions\CommitInventoryAction::$calls === 0, 'POS must never commit a fulfilment reservation');

    // Source contracts for the paths that cannot be booted in this source-only bundle.
    $orderService = $read('app/Services/OrderService.php');
    $assert(str_contains($orderService, "\$physicalSale = \$sourceChannel === 'pos';"), 'OrderService must define POS as the physical-sale path');
    $assert(str_contains($orderService, 'if (! $physicalSale) {'), 'Non-POS orders must enter reservation-first path');
    $assert(! str_contains($orderService, 'reservePendingWebsiteOrder'), 'Old pending-unpaid-website-only reservation rule must be removed');

    $paymentService = $read('app/Services/PaymentService.php');
    $assert(! str_contains($paymentService, 'CommitInventoryAction'), 'PaymentService must not commit stock');

    $orderModel = $read('app/Models/Order.php');
    $confirmBody = substr($orderModel, strpos($orderModel, 'public function confirm()') ?: 0);
    $confirmBody = substr($confirmBody, 0, strpos($confirmBody, 'public static function findByOrderId') ?: strlen($confirmBody));
    $assert(! str_contains($confirmBody, 'CommitInventoryAction'), 'Order::confirm must not commit stock');
    $assert(str_contains($orderModel, 'activeReservedProducts'), 'Order must expose active reservation relation');

    $commit = $read('app/Actions/CommitInventoryAction.php');
    $release = $read('app/Actions/ReleaseInventoryAction.php');
    $reserve = $read('app/Actions/ReserveInventoryAction.php');
    $assert(str_contains($commit, 'activeReservedProducts()'), 'Commit action must query active reservations only');
    $assert(str_contains($release, 'activeReservedProducts()'), 'Release action must query active reservations only');
    $assert(! str_contains($commit, '$item->delete()'), 'Commit action must retain reservation history');
    $assert(! str_contains($release, '$item->delete()'), 'Release action must retain reservation history');
    $assert(str_contains($commit, "'status' => 'committed'"), 'Commit action must mark ledger committed');
    $assert(str_contains($release, "'status' => 'released'"), 'Release action must mark ledger released');
    $assert(str_contains($reserve, "'order_item_id' => \$item->id"), 'New reservations must link to order item');
    $assert(str_contains($reserve, "ReservationPolicyService") && str_contains($reserve, "'reservation_class' => \$reservationClass"), 'New reservations must use centralized PRD-06 classification while preserving protected historical defaults');

    $product = $read('app/Models/Product.php');
    $variation = $read('app/Models/Variation.php');
    $assert(str_contains($product, 'reservedProducts()->active()'), 'Product legacy availability must ignore historical reservations');
    $assert(str_contains($variation, 'reservedProducts()->active()'), 'Variation legacy availability must ignore historical reservations');

    $legacyCreate = $read('app/Actions/CreateOrderAction.php');
    $assert(str_contains($legacyCreate, 'ReserveInventoryAction::run($order->fresh())'), 'Legacy website creation must reserve regardless of payment method');
    $assert(! str_contains($legacyCreate, 'sellProduct($item'), 'Legacy COD creation must not physically sell stock');

    $stripe = $read('app/Http/Controllers/StripeWebhookController.php');
    $assert(! str_contains($stripe, 'CommitInventoryAction'), 'Stripe payment completion must not commit stock');

    $migration = $read('database/migrations/2026_08_21_000000_modernize_reserved_products_for_offline_priority.php');
    foreach (['order_item_id', 'status', 'reservation_class', 'source_channel', 'reserved_at', 'committed_at', 'released_at', 'release_reason', 'metadata'] as $column) {
        $assert(str_contains($migration, "'{$column}'"), "Migration must include {$column}");
    }
    $assert(str_contains($migration, "'status' => 'active'"), 'Migration must backfill surviving rows as active');
    $assert(str_contains($migration, "'reservation_class' => 'protected'"), 'Migration must backfill surviving rows as protected');

    $apiResponse = $read('app/Support/ApiResponse.php');
    $assert(str_contains($apiResponse, "\$payload['code'] = \$code"), 'API errors must support a stable reason code');

    if ($failures !== []) {
        fwrite(STDERR, "PRD-01 verification FAILED ({$checks} checks):\n - " . implode("\n - ", $failures) . "\n");
        exit(1);
    }

    fwrite(STDOUT, "PRD-01 verification PASS ({$checks} checks).\n");
}
