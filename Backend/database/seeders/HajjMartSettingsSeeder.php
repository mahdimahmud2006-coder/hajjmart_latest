<?php

namespace Database\Seeders;

use App\Models\SiteSetting;
use Illuminate\Database\Seeder;

class HajjMartSettingsSeeder extends Seeder
{
    public function run(): void
    {
        SiteSetting::setValue('country', 'Bangladesh');
        SiteSetting::setValue('currency', 'BDT');
        SiteSetting::setValue('currency_symbol', '৳');
        SiteSetting::setValue('timezone', 'Asia/Dhaka');
        SiteSetting::setValue('delivery_charge', '80.00');
        SiteSetting::setValue('delivery_charge_inside_dhaka', '80.00');
        SiteSetting::setValue('delivery_charge_outside_dhaka', '80.00');
        SiteSetting::setValue('default_payment_methods', 'cod,online');
    }
}
