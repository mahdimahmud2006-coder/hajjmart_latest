<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

class DeliveryCharge extends Model
{
    public const INSIDE_DHAKA = 'inside_dhaka';
    public const OUTSIDE_DHAKA = 'outside_dhaka';

    protected $fillable = [];

    public static function rates(): array
    {
        $fallback = (float) SiteSetting::getValue(
            'delivery_charge',
            config('hajjmart.default_delivery_charge', 80.00)
        );

        return [
            self::INSIDE_DHAKA => round(max(1, (float) SiteSetting::getValue('delivery_charge_inside_dhaka', $fallback)), 2),
            self::OUTSIDE_DHAKA => round(max(1, (float) SiteSetting::getValue('delivery_charge_outside_dhaka', $fallback)), 2),
        ];
    }

    public static function calculate(?string $area = null): float
    {
        $area = $area ?: self::INSIDE_DHAKA;
        $rates = self::rates();
        if (! array_key_exists($area, $rates)) {
            throw new InvalidArgumentException('Invalid delivery area.');
        }

        return $rates[$area];
    }


    public static function areaForDistrict(?string $district): string
    {
        return strcasecmp(trim((string) $district), 'Dhaka') === 0
            ? self::INSIDE_DHAKA
            : self::OUTSIDE_DHAKA;
    }

    public static function calculateForDistrict(?string $district): float
    {
        return self::calculate(self::areaForDistrict($district));
    }

    public static function updateRates(float $insideDhaka, float $outsideDhaka): array
    {
        SiteSetting::setValue('delivery_charge_inside_dhaka', number_format($insideDhaka, 2, '.', ''));
        SiteSetting::setValue('delivery_charge_outside_dhaka', number_format($outsideDhaka, 2, '.', ''));

        return self::rates();
    }
}
