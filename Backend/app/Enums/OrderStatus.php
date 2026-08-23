<?php

namespace App\Enums;

enum OrderStatus: string
{
    case PENDING = 'pending';
    case CONFIRMED = 'confirmed';
    case SHIPPED = 'shipped';
    case DELIVERED = 'delivered';
    case RETURNED = 'returned';

    public static function allowedNext(string $status): array
    {
        return match ($status) {
            self::PENDING->value => [self::CONFIRMED->value],
            self::CONFIRMED->value => [self::SHIPPED->value],
            self::SHIPPED->value => [self::DELIVERED->value, self::RETURNED->value],
            self::DELIVERED->value => [self::RETURNED->value],
            default => [],
        };
    }
}
