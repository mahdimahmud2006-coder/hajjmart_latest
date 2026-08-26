<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Shop;
use App\Services\PathaoService;

echo "=== PATHAO 40-ORDER TEST SCRIPT ===" . PHP_EOL;

// 1. Assign valid Pathao Sandbox Store IDs to all 4 stores
$pathaoStoreIds = [
    1 => '148063', // HajjMart Mirpur Main Store
    2 => '148339', // HajjMart Hajj Camp Outlet
    3 => '148330', // HajjMart Online Fulfilment Hub
    4 => '148327', // Test Store
];

$shops = Shop::all();
foreach ($shops as $shop) {
    $settings = $shop->settings ?? [];
    $pathaoId = $pathaoStoreIds[$shop->id] ?? '148063';
    $settings['pathao_store_id'] = $pathaoId;
    $shop->update(['settings' => $settings]);
    echo "Configured Store #{$shop->id} ({$shop->name}) with Pathao Store ID: {$pathaoId}" . PHP_EOL;
}

echo PHP_EOL . "Creating 40 orders across the 4 stores..." . PHP_EOL;

$sampleNames = [
    'Rahim Ahmed', 'Fatema Begum', 'Tanvir Hossain', 'Nusrat Jahan', 'Kamrul Islam',
    'Sharmin Sultana', 'Mahmudur Rahman', 'Sadia Afrin', 'Mehedi Hasan', 'Sabrina Akter',
    'Ariful Islam', 'Tasnim Kawsar', 'Zahid Hasan', 'Anika Tabassum', 'Fahim Shahriar',
    'Roxana Parvin', 'Imran Hossain', 'Naimur Rahman', 'Lamia Islam', 'Kazi Shahed',
    'Mizanur Rahman', 'Farhana Yasmin', 'Ashraful Alam', 'Farzana Akter', 'Syed Mahmud',
    'Riffat Sultana', 'Tariqul Islam', 'Nadia Chowdhury', 'Habibur Rahman', 'Shamima Nasrin',
    'Saiful Islam', 'Sumaiya Rahman', 'Nazmul Huda', 'Israt Jahan', 'Babul Hossain',
    'Rozina Begum', 'Asif Iqbal', 'Tasmia Haque', 'Monirul Islam', 'Tahmina Akter'
];

$sampleAddresses = [
    'House 12, Road 5, Sector 3, Uttara, Dhaka-1230',
    '142 Green Road, Farmgate, Dhaka-1215',
    'Plot 45, Block C, Bashundhara R/A, Dhaka-1229',
    'House 8, Road 14, Dhanmondi, Dhaka-1205',
    '55 Mirpur Road, Kalabagan, Dhaka-1209',
    'House 77, Road 11, Banani, Dhaka-1213',
    '23 Lake Circus, Kalabagan, Dhaka-1205',
    'House 10, Road 2, Sector 9, Uttara, Dhaka-1230',
    '88 Elephant Road, New Market, Dhaka-1205',
    'House 3, Road 1, Block A, Mirpur 10, Dhaka-1216',
];

$product = Product::first();
$createdOrders = [];
$shopList = $shops->values()->all();

use App\Models\OrderList;

for ($i = 0; $i < 40; $i++) {
    $shop = $shopList[$i % count($shopList)];
    $orderList = OrderList::firstOrCreate(['shop_id' => $shop->id], ['title' => 'Orders List']);
    $orderNumber = 'HM-TEST-' . sprintf('%04d', rand(1000, 9999)) . '-' . ($i + 1);
    $name = $sampleNames[$i % count($sampleNames)];
    $phone = '017' . sprintf('%08d', 10000000 + $i);
    $address = $sampleAddresses[$i % count($sampleAddresses)];
    $isPaid = ($i % 2 === 0);
    $grandTotal = rand(500, 3500);
    $paidAmount = $isPaid ? $grandTotal : 0;
    $dueAmount = $isPaid ? 0 : $grandTotal;
    $channel = ($i % 3 === 0) ? 'social_commerce' : 'website';

    $order = Order::create([
        'order_list_id' => $orderList->id,
        'order_number' => $orderNumber,
        'order_id' => Order::generateUniqueId(),
        'source_channel' => $channel,
        'status' => 'shipped',
        'order_status' => 'Shipped',
        'payment_status' => $isPaid ? 'paid' : 'due',
        'payment_method' => 'cod',
        'checkout_name' => $name,
        'checkout_mobile_number' => $phone,
        'checkout_full_address' => $address,
        'checkout_district' => 'Dhaka',
        'shipping_full_address' => $address,
        'shipping_district' => 'Dhaka',
        'shipping_mobile_number' => $phone,
        'grand_total' => $grandTotal,
        'paid_amount' => $paidAmount,
        'due_amount' => $dueAmount,
        'shipping_total' => 80,
        'subtotal' => $grandTotal - 80,
        'shop_id' => $shop->id,
        'customer_details' => ['name' => $name, 'phone' => $phone],
        'order_date' => now(),
    ]);

    if ($product) {
        $price = rand(200, 1000);
        $qty = rand(1, 3);
        $total = $price * $qty;
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => $qty,
            'unit_price' => $price,
            'line_total' => $total,
            'line_grand_total' => $total,
        ]);
    }

    $createdOrders[] = $order;
}

echo "Created " . count($createdOrders) . " test orders successfully!" . PHP_EOL . PHP_EOL;

$pathaoService = app(PathaoService::class);

// PART 1: Send 20 orders 1 by 1
echo "==========================================" . PHP_EOL;
echo "PART 1: SENDING 20 ORDERS INDIVIDUALLY (1 BY 1)" . PHP_EOL;
echo "==========================================" . PHP_EOL;

$part1Orders = array_slice($createdOrders, 0, 20);
$success1 = 0;
$fail1 = 0;

foreach ($part1Orders as $idx => $order) {
    echo sprintf("[%02d/20] Order #%s (Store: %s, Recipient: %s, COD: %d Tk) ... ", 
        $idx + 1, 
        $order->order_number, 
        $order->shop->name, 
        $order->checkout_name, 
        $order->due_amount
    );

    try {
        $res = $pathaoService->sendOrderToPathao($order);
        echo "SUCCESS! CID: " . $res['consignment_id'] . PHP_EOL;
        $success1++;
    } catch (\Throwable $e) {
        echo "FAILED! Error: " . $e->getMessage() . PHP_EOL;
        $fail1++;
    }
    
    // 3.2s pacing delay (19 requests / min) to prevent Pathao API rate limiting
    usleep(3200000);
}

echo PHP_EOL . "Part 1 Result: {$success1} Succeeded, {$fail1} Failed." . PHP_EOL . PHP_EOL;

// PART 2: Send remaining 20 orders via Bulk Send
echo "==========================================" . PHP_EOL;
echo "PART 2: SENDING 20 ORDERS VIA BULK DISPATCH" . PHP_EOL;
echo "==========================================" . PHP_EOL;

$part2Orders = array_slice($createdOrders, 20, 20);
$part2OrderIds = array_map(fn($o) => $o->id, $part2Orders);

$orderController = app(\App\Http\Controllers\Api\V1\Admin\OrderController::class);
$request = \Illuminate\Http\Request::create('/api/v1/admin/orders/bulk-send-pathao', 'POST', [
    'order_ids' => $part2OrderIds,
]);

$bulkResponse = $orderController->bulkSendToPathao($request, $pathaoService);
$data = $bulkResponse->getData(true);

$success2 = 0;
$fail2 = 0;

if (isset($data['data']) && is_array($data['data'])) {
    foreach ($data['data'] as $idx => $res) {
        echo sprintf("[%02d/20] Order #%s ... ", $idx + 1, $res['order_number']);
        if ($res['success']) {
            echo "SUCCESS! CID: " . $res['consignment_id'] . PHP_EOL;
            $success2++;
        } else {
            echo "FAILED! Error: " . ($res['error'] ?? 'Unknown error') . PHP_EOL;
            $fail2++;
        }
    }
} else {
    echo "Bulk send response: " . json_encode($data) . PHP_EOL;
}

echo PHP_EOL . "Part 2 Result: {$success2} Succeeded, {$fail2} Failed." . PHP_EOL;
echo PHP_EOL . "==========================================" . PHP_EOL;
echo "TOTAL SUMMARY: " . ($success1 + $success2) . " / 40 Orders Dispatched Successfully to Pathao Sandbox!" . PHP_EOL;
echo "==========================================" . PHP_EOL;
