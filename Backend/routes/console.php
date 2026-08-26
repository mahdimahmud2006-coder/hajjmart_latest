<?php

use App\Jobs\ExpirePendingOrders;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Schedule::call(function () {
    ExpirePendingOrders::dispatch();
})->everyFifteenMinutes();

Schedule::job(new \App\Jobs\GenerateDailySalesSummary())->dailyAt('00:05');

Schedule::command('pathao:sync-statuses')->everyFourHours();


Artisan::command('hajjmart:verify-seed', function (): int {
    $jsonPath = database_path('seeders/data/hajjmart_endpoint_seed_data.json');
    $fixture = file_exists($jsonPath)
        ? json_decode(file_get_contents($jsonPath), true, 512, JSON_THROW_ON_ERROR)
        : [];
    $endpointScenarios = $fixture['endpoint_scenarios'] ?? [];
    $minimumEndpointRows = $endpointScenarios === []
        ? 0
        : min(array_map('count', $endpointScenarios));
    $uniqueEndpointRows = $endpointScenarios === []
        ? 0
        : min(array_map(fn (array $rows): int => count(array_unique(array_map(
            fn (array $row): string => json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $rows
        ))), $endpointScenarios));

    $activeStores = \App\Models\Shop::where('is_active', true)->count();
    $sellableSkuCount = \App\Models\Product::query()
        ->where('is_active', true)
        ->get()
        ->sum(fn (\App\Models\Product $product): int => max(1, $product->productVariants()->where('is_active', true)->count()));
    $expectedInventory = $activeStores * $sellableSkuCount;

    $inventoryStoreIndexValid = 1;
    if (\Illuminate\Support\Facades\DB::connection()->getDriverName() === 'mysql') {
        $indexes = [];
        foreach (\Illuminate\Support\Facades\DB::select('SHOW INDEX FROM `inventory`') as $row) {
            $row = (array) $row;
            $name = (string) ($row['Key_name'] ?? $row['key_name'] ?? '');
            $column = (string) ($row['Column_name'] ?? $row['column_name'] ?? '');
            $sequence = (int) ($row['Seq_in_index'] ?? $row['seq_in_index'] ?? 0);
            $nonUnique = (int) ($row['Non_unique'] ?? $row['non_unique'] ?? 1);
            if ($name === '' || $column === '' || $sequence < 1) continue;
            $indexes[$name] ??= ['unique' => $nonUnique === 0, 'columns' => []];
            $indexes[$name]['unique'] = $nonUnique === 0;
            $indexes[$name]['columns'][$sequence - 1] = $column;
        }
        foreach ($indexes as &$definition) {
            ksort($definition['columns']);
            $definition['columns'] = array_values($definition['columns']);
        }
        unset($definition);

        $target = $indexes['inventory_product_variant_shop_unique'] ?? null;
        $hasLegacy = collect($indexes)->contains(fn (array $definition): bool =>
            $definition['unique'] && $definition['columns'] === ['product_id', 'variant_id']
        );
        $inventoryStoreIndexValid = ! $hasLegacy
            && $target !== null
            && $target['unique']
            && $target['columns'] === ['product_id', 'variant_id', 'shop_id']
                ? 1
                : 0;
    }

    $checks = [
        ['Endpoint fixture definitions', count($endpointScenarios), (int) ($fixture['meta']['endpoint_count'] ?? 0)],
        ['Minimum rows per endpoint fixture', $minimumEndpointRows, 100],
        ['Minimum unique rows per endpoint fixture', $uniqueEndpointRows, 100],
        ['All orders', \App\Models\Order::where('order_number', 'like', 'HM-SEED-%')->count(), 900],
        ['Website orders', \App\Models\Order::where('order_number', 'like', 'HM-SEED-%')->where('source_channel', 'website')->count(), 300],
        ['Social-commerce orders', \App\Models\Order::where('order_number', 'like', 'HM-SEED-%')->where('source_channel', 'social_commerce')->count(), 300],
        ['POS orders', \App\Models\Order::where('order_number', 'like', 'HM-SEED-%')->where('source_channel', 'pos')->count(), 300],
        ['Order coverage days', \App\Models\Order::where('order_number', 'like', 'HM-SEED-%')->selectRaw('DATE(order_date) as day')->distinct()->count('day'), 30],
        ['Return/exchange/refund requests', \App\Models\ReturnRequest::where('rr_number', 'like', 'RR-HM-%')->count(), 120],
        ['Generated employees', \App\Models\User::where('email', 'like', 'employee%@hajjmart.local')->count(), 30],
        ['Generated customers', \App\Models\User::where('email', 'like', 'customer%@example.com')->count(), 200],
        ['Active administrators', \App\Models\User::where('is_employee', true)->where('is_admin', true)->where('is_active', true)->count(), 1],
        ['Seeded direct batches', \App\Models\ProductBatch::where('batch_reference', 'like', 'SEED-%')->distinct('batch_reference')->count('batch_reference'), $expectedInventory],
        ['Seeded promotions/coupons', \App\Models\Coupon::where('code', 'like', 'HAJJSALE%')->count(), 20],
        ['Product reviews', \App\Models\ProductReview::count(), 300],
        ['Product questions', \App\Models\ProductQuestion::count(), 150],
        ['Contact messages', \App\Models\ContactMessage::count(), 150],
        ['Stock transfers', \App\Models\StockTransfer::where('transfer_number', 'like', 'TRF-HM-%')->count(), 120],
        ['Daily summaries', \App\Models\DailySalesSummary::count(), 30],
        ['Store-scoped inventory unique index', $inventoryStoreIndexValid, 1],
        ['Complete sellable inventory matrix', \App\Models\Inventory::count(), $expectedInventory],
        ['Variable-product parent stock rows', \App\Models\Inventory::whereNull('variant_id')->whereHas('product.productVariants')->count(), 0],
        ['Zero/negative sellable stock rows', \App\Models\Inventory::whereRaw('quantity - reserved <= 0')->count(), 0],
        ['Order status history table', \Illuminate\Support\Facades\Schema::hasTable('order_status_histories') ? 1 : 0, 1],
        ['Products with stored image paths', \App\Models\ProductImage::whereNotNull('path')->distinct('product_id')->count('product_id'), \App\Models\Product::whereHas('productImages', fn ($q) => $q->whereNotNull('path'))->count()],
    ];

    $rows = collect($checks)->map(fn (array $check) => [
        'Check' => $check[0],
        'Actual' => $check[1],
        'Expected' => $check[2],
        'Result' => (int) $check[1] === (int) $check[2] ? 'PASS' : 'FAIL',
    ])->all();
    $this->table(['Check', 'Actual', 'Expected', 'Result'], $rows);

    $failed = collect($rows)->contains(fn (array $row) => $row['Result'] === 'FAIL');
    $failed
        ? $this->error('Realistic seed verification failed. Review the failed rows above.')
        : $this->info('HajjMart realistic 30-day seed is complete and internally consistent.');

    return $failed
        ? \Symfony\Component\Console\Command\Command::FAILURE
        : \Symfony\Component\Console\Command\Command::SUCCESS;
})->purpose('Verify HajjMart realistic endpoint fixtures, 30-day operations and complete stock coverage.');
