<?php

namespace App\Enums;

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
    case RETURN_REQUESTED = 'return_requested';
    case RETURNED = 'returned';
    case REFUNDED = 'refunded';

    public static function allowedNext(string $status): array
    {
        return match ($status) {
            self::PENDING->value => [self::CONFIRMED->value, self::CANCELLED->value],
            self::CONFIRMED->value => [self::PROCESSING->value, self::CANCELLED->value],
            self::PROCESSING->value => [self::READY_TO_SHIP->value, self::CANCELLED->value],
            self::READY_TO_SHIP->value => [self::SHIPPED->value],
            self::SHIPPED->value => [self::OUT_FOR_DELIVERY->value, self::DELIVERED->value],
            self::OUT_FOR_DELIVERY->value => [self::DELIVERED->value],
            self::DELIVERED->value => [self::RETURN_REQUESTED->value],
            self::RETURN_REQUESTED->value => [self::RETURNED->value, self::REFUNDED->value],
            self::RETURNED->value => [self::REFUNDED->value],
            default => [],
        };
    }
}
