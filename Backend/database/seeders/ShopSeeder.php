<?php

namespace Database\Seeders;

use App\Models\OrderList;
use App\Models\Shop;
use Illuminate\Database\Seeder;

class ShopSeeder extends Seeder
{
    public function run(): void
    {
        $shop = Shop::updateOrCreate(
            ['code' => 'MAIN'],
            [
                'name' => 'HajjMart Main Store',
                'slug' => 'hajjmart-main-store',
                'address' => 'Section-11, Block-B, Pallabi, Mirpur, Dhaka 1216',
                'phone' => '01720601515',
                'email' => 'hajjmartbd@gmail.com',
                'is_active' => true,
                'is_default' => true,
            ]
        );

        OrderList::firstOrCreate(['shop_id' => $shop->id]);
    }
}
