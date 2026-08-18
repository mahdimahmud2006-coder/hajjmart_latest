<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Order;
use App\Models\RiskEvent;
use App\Services\RiskEngine;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            ShopSeeder::class,
            AdminAccessSeeder::class,
            AccountingSeeder::class,
            RiskControlSeeder::class,
            HajjMartSettingsSeeder::class,
            HajjMartProductSeeder::class,
            HajjMartRealisticDatabaseSeeder::class,
            AccountingOperationalBackfillSeeder::class,
        ]);

        // Backfill only orders that were inserted directly by data seeders.
        $scoredOrderIds = RiskEvent::query()->where('subject_type', Order::class)->pluck('subject_id');
        $engine = app(RiskEngine::class);
        Order::query()->whereNotIn('id', $scoredOrderIds)->latest()->limit(150)->get()
            ->each(fn (Order $order) => $engine->evaluateOrder($order));
    }
}
