<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case DUE = 'due';
    case PARTIALLY_PAID = 'partially_paid';
    case PAID = 'paid';

    public static function forOrder(float|int $paidAmount, float|int $grandTotal): string
    {
        if ($paidAmount >= $grandTotal && $grandTotal > 0) {
            return self::PAID->value;
        }
        if ($paidAmount > 0) {
            return self::PARTIALLY_PAID->value;
        }
        return self::DUE->value;
    }
}
