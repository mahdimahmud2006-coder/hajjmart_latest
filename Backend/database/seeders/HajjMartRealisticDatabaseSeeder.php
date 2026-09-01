<?php

namespace Database\Seeders;

use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;

class HajjMartRealisticDatabaseSeeder extends Seeder
{
    private array $columns = [];
    private array $data = [];
    private CarbonImmutable $anchor;
    private array $shops = [];
    private array $employees = [];
    private array $customers = [];
    private array $coupons = [];
    private array $products = [];
    private array $variantsByProduct = [];
    private array $orders = [];
    private string $customerPasswordHash;

    public function run(): void
    {
        $path = database_path('seeders/data/hajjmart_endpoint_seed_data.json');
        if (! file_exists($path)) {
            throw new RuntimeException("Required seed fixture is missing: {$path}");
        }

        $this->data = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR)['datasets'] ?? [];
        $this->anchor = CarbonImmutable::now(config('app.timezone', 'Asia/Dhaka'));
        $this->customerPasswordHash = Hash::make('Customer123!');

        DB::disableQueryLog();
        $this->assertStoreScopedInventoryIndex();

        $this->command?->line('Loading realistic development data. Progress is shown for every stage:');
        DB::transaction(function (): void {
            $stages = [
                'Stores' => fn () => $this->seedStores(),
                'Admin attribution' => fn () => $this->seedEmployees(),
                'Customers and addresses' => fn () => $this->seedCustomers(),
                'Promotions reset (empty)' => fn () => $this->seedCoupons(),
                'Product catalogue' => fn () => $this->loadProducts(),
                'Store inventory and batches' => fn () => $this->seedCompleteInventory(),
                'Homepage and contact messages' => fn () => $this->seedHomepageAndMessages(),
                'Orders, items and payments' => fn () => $this->seedOrders(),
                'Returns and exchanges' => fn () => $this->seedReturns(),
                'Stock transfers' => fn () => $this->seedStockTransfers(),
                'Wishlists and social shares' => fn () => $this->seedEngagement(),
                'Cancellation requests' => fn () => $this->seedCancellations(),
                'Notifications' => fn () => $this->seedNotifications(),
                'Daily summaries' => fn () => $this->seedDailySummaries(),
                'Product metrics' => fn () => $this->refreshProductMetrics(),
                'Audit logs' => fn () => $this->writeAuditLogs(),
            ];

            foreach ($stages as $label => $stage) {
                $startedAt = microtime(true);
                $this->command?->line("  - {$label}...");
                $stage();
                $elapsed = microtime(true) - $startedAt;
                $this->command?->line(sprintf('    completed in %.1fs', $elapsed));
            }
        }, 3);

        $this->command?->info('HajjMart realistic 30-day database seed completed.');
        $this->command?->line('Products use the original hajjmart_products.json catalogue and local storage image paths.');
        $this->command?->line('Orders: '.DB::table('orders')->count().' | Inventory rows: '.DB::table('inventory')->count().' | Customers: '.DB::table('users')->where('is_employee', false)->count());
    }

    private function seedStores(): void
    {
        foreach ($this->data['stores'] ?? [] as $index => $row) {
            $id = $this->upsert('shops', ['code' => $row['code']], [
                'name' => $row['name'], 'code' => $row['code'], 'slug' => $row['slug'],
                'address' => $row['address'], 'phone' => $row['phone'], 'email' => $row['email'],
                'is_default' => (bool) $row['is_default'], 'is_active' => true,
                'settings' => $this->json($row['settings'] ?? []),
                'created_at' => $this->anchor->subDays(180 + $index), 'updated_at' => $this->anchor,
            ]);
            $this->shops[$row['code']] = $id;
        }

        if (! isset($this->shops['MAIN'])) {
            $this->shops['MAIN'] = (int) DB::table('shops')->value('id');
        }
        DB::table('shops')->where('id', '!=', $this->shops['MAIN'])->update($this->filter('shops', ['is_default' => false]));
        DB::table('shops')->where('id', $this->shops['MAIN'])->update($this->filter('shops', ['is_default' => true]));

        $adminId = DB::table('users')->where('email', 'admin@hajjmart.local')->value('id');
        if ($adminId) {
            DB::table('users')->where('id', $adminId)->update($this->filter('users', [
                'shop_id' => $this->shops['MAIN'], 'is_employee' => true, 'is_admin' => true, 'is_active' => true,
                'designation' => 'System Administrator', 'employee_code' => 'HM-ADMIN', 'updated_at' => $this->anchor,
            ]));
        }
    }

    private function seedEmployees(): void
    {
        $adminId = DB::table('users')->where('email', 'admin@hajjmart.local')->value('id');
        if (! $adminId) {
            throw new RuntimeException('The seeded HajjMart admin account is required before realistic data can be loaded.');
        }

        $this->employees = [(int) $adminId];
    }

    private function seedCustomers(): void
    {
        foreach ($this->data['customers'] ?? [] as $row) {
            $created = $this->at($row['created_days_ago'] ?? 1, 600);
            $id = $this->upsert('users', ['email' => $row['email']], [
                'name' => $row['name'], 'email' => $row['email'], 'phone' => $row['phone'],
                'password' => $this->customerPasswordHash, 'is_employee' => false, 'is_admin' => false, 'is_active' => true,
                'email_verified_at' => $created, 'created_at' => $created, 'updated_at' => $created,
            ]);
            $this->customers[] = $id;
            if (Schema::hasTable('user_addresses')) {
                $addressId = $this->upsert('user_addresses', ['user_id' => $id, 'label' => 'Home'], [
                    'user_id' => $id, 'label' => 'Home', 'recipient_name' => $row['name'], 'phone' => $row['phone'],
                    'address_line_1' => $row['address'], 'city' => $row['district'], 'district' => $row['district'],
                    'division' => $row['division'], 'postal_code' => $row['postal_code'], 'is_default' => true,
                    'created_at' => $created, 'updated_at' => $created,
                ]);
                DB::table('users')->where('id', $id)->update($this->filter('users', ['address_default_id' => $addressId]));
            }
        }
    }

    private function seedCoupons(): void
    {
        // Promotions are intentionally not seeded. Admin creates/removes them during testing.
        if (Schema::hasTable('coupon_applications')) DB::table('coupon_applications')->delete();
        if (Schema::hasTable('coupon_usages')) DB::table('coupon_usages')->delete();
        if (Schema::hasTable('coupons')) DB::table('coupons')->delete();
        $this->coupons = [];
    }

    private function loadProducts(): void
    {
        $this->products = DB::table('products')->whereNull('deleted_at')->orderBy('id')->get()->map(fn ($r) => (array) $r)->all();
        if ($this->products === []) {
            throw new RuntimeException('No products were imported. HajjMartProductSeeder must run first.');
        }
        foreach (DB::table('product_variants')->where('is_active', true)->orderBy('id')->get() as $variant) {
            $this->variantsByProduct[(int) $variant->product_id][] = (array) $variant;
        }
    }

    private function seedCompleteInventory(): void
    {
        DB::table('stock_movements')->delete();
        if (Schema::hasTable('product_batches')) {
            DB::table('product_batches')->delete();
        }
        foreach ($this->products as $pIndex => $product) {
            $productId = (int) $product['id'];
            $variants = $this->variantsByProduct[$productId] ?? [];
            if ($variants !== []) {
                DB::table('inventory')->where('product_id', $productId)->whereNull('variant_id')->delete();
            }
            foreach ($this->shops as $storeIndex => $shopId) {
                if ($variants === []) {
                    $this->putInventory($productId, null, $shopId, 90 + (($pIndex * 7 + $shopId) % 91), $pIndex, (string) $storeIndex);
                    continue;
                }
                foreach ($variants as $vIndex => $variant) {
                    $this->putInventory($productId, (int) $variant['id'], $shopId, 72 + (($pIndex * 11 + $vIndex * 5 + $shopId) % 109), $pIndex + $vIndex, (string) $storeIndex);
                }
            }
        }
    }

    private function putInventory(int $productId, ?int $variantId, int $shopId, int $quantity, int $seed, string $storeCode): void
    {
        $match = ['product_id' => $productId, 'variant_id' => $variantId, 'shop_id' => $shopId];
        $id = $this->upsert('inventory', $match, [
            ...$match, 'quantity' => $quantity, 'reserved' => 0, 'low_stock_threshold' => 10,
            'location_note' => 'Seeded sellable stock', 'bin_location' => strtoupper(substr($storeCode, 0, 2)).'-'.str_pad((string) (($seed % 40) + 1), 3, '0', STR_PAD_LEFT),
            'last_counted_at' => $this->anchor->subDays($seed % 5), 'updated_at' => $this->anchor,
        ]);
        if (Schema::hasTable('product_batches')) {
            $product = DB::table('products')->where('id', $productId)->first();
            $variant = $variantId ? DB::table('product_variants')->where('id', $variantId)->first() : null;
            $this->insert('product_batches', [
                'batch_reference' => 'SEED-' . $shopId . '-' . $productId . '-' . ($variantId ?: 0),
                'product_id' => $productId,
                'variation_id' => null,
                'variant_id' => $variantId,
                'shop_id' => $shopId,
                'count' => $quantity,
                'initial_quantity' => $quantity,
                'cost_price' => $variant?->cost_price ?? $product?->cost_price ?? 0,
                'selling_price' => $variant?->sale_price ?? $variant?->price ?? $product?->sale_price ?? $product?->selling_price ?? 0,
                'created_by' => $this->employees[$seed % max(1, count($this->employees))] ?? null,
                'note' => 'Opening direct batch generated by the realistic 30-day seeder.',
                'received_at' => $this->anchor->subDays(30),
                'created_at' => $this->anchor->subDays(30),
                'updated_at' => $this->anchor,
            ]);
        }
        if (Schema::hasTable('stock_movements')) {
            $this->insert('stock_movements', [
                'inventory_id' => $id, 'shop_id' => $shopId, 'type' => 'opening_stock', 'quantity_change' => $quantity,
                'balance_after' => $quantity, 'reason_code' => 'realistic_seed', 'reference_type' => self::class,
                'note' => 'Opening stock generated by the realistic 30-day seeder.',
                'created_by' => $this->employees[$seed % max(1, count($this->employees))] ?? null, 'created_at' => $this->anchor->subDays(30),
            ]);
        }
    }

    private function seedHomepageAndMessages(): void
    {
        if (Schema::hasTable('homepage_sections')) {
            DB::table('homepage_sections')->delete();
            foreach ($this->data['homepage_sections'] ?? [] as $row) {
                $row['metadata'] = $this->json($row['metadata'] ?? []);
                $row['created_at'] = $this->anchor->subDays(20);
                $row['updated_at'] = $this->anchor;
                $this->insert('homepage_sections', $row);
            }
        }
        if (Schema::hasTable('contact_messages')) {
            foreach ($this->data['contact_messages'] ?? [] as $row) {
                $at = $this->at($row['days_ago'], $row['minute']);
                $this->insert('contact_messages', [...$row, 'created_at' => $at, 'updated_at' => $at]);
            }
        }
    }

    private function seedOrders(): void
    {
        foreach ($this->data['orders'] ?? [] as $index => $blueprint) {
            $productLines = [];
            $subtotal = $cogs = 0.0;
            foreach ($blueprint['items'] as $slot) {
                $product = $this->product($slot['product_slot']);
                $variant = $this->variant($product, $slot['variant_slot']);
                $qty = max(1, (int) $slot['quantity']);
                $price = $this->price($product, $variant);
                $cost = $this->cost($product, $variant, $price);
                $line = round($price * $qty, 2);
                $productLines[] = compact('product', 'variant', 'qty', 'price', 'cost', 'line');
                $subtotal += $line;
                $cogs += $cost * $qty;
            }

            $discount = min($subtotal * 0.15, (float) ($blueprint['manual_discount'] ?? 0));
            $couponId = null; $couponCode = null;
            if ($blueprint['coupon_slot'] !== null && $this->coupons !== []) {
                $couponId = $this->coupons[(int) $blueprint['coupon_slot'] % count($this->coupons)];
                $coupon = DB::table('coupons')->find($couponId);
                if ($coupon) {
                    $couponCode = $coupon->code;
                    $discount += $coupon->type === 'percentage'
                        ? min($subtotal * ((float) $coupon->value / 100), (float) ($coupon->max_discount_amount ?: PHP_FLOAT_MAX))
                        : (float) $coupon->value;
                }
            }
            $discount = round(min($subtotal, $discount), 2);
            $shipping = (float) $blueprint['shipping_total'];
            $grand = round(max(0, $subtotal - $discount + $shipping), 2);
            $paymentState = $blueprint['payment_state'];
            $paid = $paymentState === 'paid' ? $grand : ($paymentState === 'partial' ? round($grand * 0.55, 2) : 0.0);
            $due = round($grand - $paid, 2);
            $at = $this->at($blueprint['days_ago'], $blueprint['minute']);
            $customerId = $this->customer($blueprint['customer_slot']);
            $customer = DB::table('users')->find($customerId);
            $employeeId = $this->employee($blueprint['employee_slot']);
            $shopId = $this->shops[$blueprint['store_code']] ?? $this->shops['MAIN'];
            $status = $blueprint['status'];
            $address = ['name' => $customer?->name, 'phone' => $customer?->phone, 'email' => $customer?->email, 'country' => 'Bangladesh', 'district' => $blueprint['district'], 'address' => 'House '.(($index % 80) + 1).', Road '.(($index % 20) + 1).', '.$blueprint['district']];

            $orderListId = $this->insert('order_lists', ['shop_id' => $shopId, 'created_at' => $at, 'updated_at' => $at]);
            $orderId = $this->insert('orders', [
                'order_list_id' => $orderListId, 'order_id' => 'S'.str_pad((string) ($index + 1), 6, '0', STR_PAD_LEFT),
                'order_number' => $blueprint['order_number'], 'customer_id' => $customerId, 'shop_id' => $shopId,
                'created_by' => $employeeId, 'assigned_to' => $employeeId, 'order_date' => $at,
                'checkout_name' => $customer?->name, 'checkout_country' => 'Bangladesh', 'checkout_full_address' => $address['address'],
                'checkout_district' => $blueprint['district'], 'checkout_mobile_number' => $customer?->phone, 'checkout_email' => $customer?->email,
                'create_account_requested' => false, 'ship_to_different_address' => false, 'shipping_full_address' => $address['address'],
                'shipping_district' => $blueprint['district'], 'shipping_mobile_number' => $customer?->phone, 'shipping_email' => $customer?->email,
                'checkout_note' => 'Realistic seeded order for operational testing.', 'status' => $status, 'order_status' => $status,
                'payment_status' => $paymentState === 'unpaid' ? 'pending' : $paymentState, 'payment_method' => $blueprint['payment_method'],
                'payment_channel' => $blueprint['payment_method'], 'terms_accepted' => true, 'source_channel' => $blueprint['source_channel'],
                'source_reference' => $blueprint['source_reference'],
                'delivery_status' => in_array($status, ['delivered', 'completed'], true) ? 'delivered' : $status,
                'subtotal' => round($subtotal, 2), 'net_subtotal' => round($subtotal - $discount, 2), 'tax_total' => 0,
                'shipping_total' => $shipping, 'delivery_charge' => $shipping, 'delivery_method' => $blueprint['source_channel'] === 'pos' ? 'counter_pickup' : 'home_delivery',
                'discount_total' => $discount, 'item_discount_total' => $discount, 'shipping_discount_total' => 0,
                'coupon_code' => $couponCode, 'coupon_codes' => $this->json($couponCode ? [$couponCode] : []),
                'promotion_snapshot' => $this->json(['seeded' => true, 'coupon_code' => $couponCode, 'discount_total' => $discount]),
                'grand_total' => $grand, 'total_price' => $grand, 'paid_amount' => $paid, 'due_amount' => $due,
                'total_cogs' => round($cogs, 2), 'gross_profit' => round($grand - $shipping - $cogs, 2), 'currency' => 'BDT',
                'shipping_address_snapshot' => $this->json($address), 'billing_address_snapshot' => $this->json($address),
                'customer_note' => null, 'admin_note' => 'Generated from hajjmart_endpoint_seed_data.json',
                'placed_at' => $at, 'confirmed_at' => $status !== 'pending' ? $at->addMinutes(5) : null,
                'shipped_at' => in_array($status, ['shipped', 'delivered', 'completed'], true) ? $at->addHours(8) : null,
                'delivered_at' => in_array($status, ['delivered', 'completed'], true) ? $at->addDay() : null,
                'cancelled_at' => $status === 'cancelled' ? $at->addHours(2) : null,
                'ordered_products' => $this->json(array_map(fn ($x) => ['product_id' => $x['product']['id'], 'variant_id' => $x['variant']['id'] ?? null, 'quantity' => $x['qty']], $productLines)),
                'customer_details' => $this->json(['name' => $customer?->name, 'email' => $customer?->email, 'phone' => $customer?->phone]),
                'address' => $this->json($address), 'created_at' => $at, 'updated_at' => $at,
            ]);

            $orderItemIds = [];
            foreach ($productLines as $lineIndex => $line) {
                $lineDiscount = $subtotal > 0 ? round($discount * ($line['line'] / $subtotal), 2) : 0;
                $lineGrand = round($line['line'] - $lineDiscount, 2);
                $image = DB::table('product_images')->where('product_id', $line['product']['id'])->orderByDesc('is_primary')->orderBy('sort_order')->first();
                $snapshot = ['id' => $line['product']['id'], 'name' => $line['product']['name'], 'sku' => $line['variant']['sku'] ?? $line['product']['sku'] ?? null, 'slug' => $line['product']['slug'] ?? null, 'image' => $image?->path, 'variation' => $line['variant']['attribute_labels'] ?? null];
                $itemId = $this->insert('order_items', [
                    'order_id' => $orderId, 'product_id' => $line['product']['id'], 'variant_id' => $line['variant']['id'] ?? null,
                    'category_id' => $line['product']['category_id'] ?? null, 'product_snapshot' => $this->json($snapshot), 'quantity' => $line['qty'],
                    'unit_price' => $line['price'], 'unit_cost' => $line['cost'], 'tax_rate' => 0, 'discount_amount' => $lineDiscount,
                    'line_subtotal' => $line['line'], 'line_discount_total' => $lineDiscount, 'line_tax_total' => 0,
                    'line_total' => $lineGrand, 'line_grand_total' => $lineGrand, 'discount_snapshot' => $this->json($lineDiscount ? [['code' => $couponCode ?: 'MANUAL', 'amount' => $lineDiscount]] : []),
                    'cogs_total' => round($line['cost'] * $line['qty'], 2), 'gross_profit' => round($lineGrand - ($line['cost'] * $line['qty']), 2),
                    'item_status' => $status, 'refunded_quantity' => 0, 'refunded_amount' => 0, 'exchanged_quantity' => 0,
                    'created_at' => $at, 'updated_at' => $at,
                ]);
                $orderItemIds[] = $itemId;
                $this->insert('order_item_status_histories', ['order_item_id' => $itemId, 'from_status' => null, 'to_status' => $status, 'changed_by' => $employeeId, 'note' => 'Seeded item lifecycle', 'created_at' => $at]);
            }

            if ($paid > 0 || ($blueprint['source_channel'] === 'website' && $blueprint['payment_method'] !== 'cod')) {
                $this->insert('payments', [
                    'order_id' => $orderId, 'payment_method' => $blueprint['payment_method'],
                    'gateway' => in_array($blueprint['payment_method'], ['cash', 'cod'], true) ? null : $blueprint['payment_method'],
                    'gateway_transaction_id' => 'PAY-HM-'.str_pad((string) ($index + 1), 6, '0', STR_PAD_LEFT),
                    'gateway_response' => $this->json(['seeded' => true, 'approved' => $paid > 0]),
                    'amount' => $paid > 0 ? $paid : $grand, 'currency' => 'BDT', 'status' => $paid > 0 ? 'paid' : 'pending',
                    'paid_at' => $paid > 0 ? $at->addMinutes(10) : null, 'received_by' => $employeeId,
                    'payment_reference' => 'REF-'.str_pad((string) ($index + 1), 7, '0', STR_PAD_LEFT),
                    'refunded_amount' => 0, 'refund_status' => null, 'created_at' => $at, 'updated_at' => $at,
                ]);
            }
            $this->insert('order_status_histories', ['order_id' => $orderId, 'from_status' => null, 'to_status' => $status, 'changed_by' => $employeeId, 'note' => 'Realistic seeded order lifecycle', 'created_at' => $at]);
            if ($couponId) {
                $this->insert('coupon_usages', ['coupon_id' => $couponId, 'user_id' => $customerId, 'order_id' => $orderId, 'created_at' => $at]);
                if (Schema::hasTable('coupon_applications')) {
                    $this->insert('coupon_applications', ['coupon_id' => $couponId, 'order_id' => $orderId, 'user_id' => $customerId, 'code' => $couponCode, 'discount_amount' => $discount, 'snapshot' => $this->json(['seeded' => true]), 'created_at' => $at, 'updated_at' => $at]);
                }
            }
            $this->orders[] = ['id' => $orderId, 'item_ids' => $orderItemIds, 'customer_id' => $customerId, 'shop_id' => $shopId, 'grand_total' => $grand, 'status' => $status, 'at' => $at];
        }
        foreach ($this->coupons as $couponId) {
            $used = DB::table('coupon_usages')->where('coupon_id', $couponId)->count();
            DB::table('coupons')->where('id', $couponId)->update($this->filter('coupons', ['used_count' => $used]));
        }
    }

    private function seedReturns(): void
    {
        foreach ($this->data['return_requests'] ?? [] as $index => $row) {
            if ($this->orders === []) break;
            $order = $this->orders[(int) $row['order_slot'] % count($this->orders)];
            $itemId = $order['item_ids'][0] ?? null;
            if (! $itemId) continue;
            $item = DB::table('order_items')->find($itemId);
            $at = $this->at($row['days_ago'], 700 + ($index % 300));
            $type = $row['type'] === 'exchange' ? 'exchange' : 'return';
            $resolution = $row['type'] === 'refund' ? 'refund' : $type;
            $refund = $type === 'return' ? round((float) $item->line_grand_total * min(1, (int) $row['quantity'] / max(1, (int) $item->quantity)), 2) : 0;
            $exchangeProduct = $this->product($row['exchange_product_slot']);
            $exchangeVariant = $this->variant($exchangeProduct, $index);
            $exchangePrice = $this->price($exchangeProduct, $exchangeVariant);
            $credit = $type === 'exchange' ? round((float) $item->line_grand_total / max(1, (int) $item->quantity), 2) : 0;
            $difference = $type === 'exchange' ? round($exchangePrice - $credit, 2) : 0;
            $employeeId = $this->employee($index);
            $rrId = $this->upsert('return_requests', ['rr_number' => $row['rr_number']], [
                'rr_number' => $row['rr_number'], 'order_id' => $order['id'], 'customer_id' => $order['customer_id'], 'shop_id' => $order['shop_id'],
                'created_by' => $employeeId, 'type' => $type, 'status' => $row['status'], 'reason' => $row['reason'],
                'customer_note' => 'Realistic seeded return/exchange request.', 'admin_note' => 'Quality and finance workflow test record.',
                'approved_by' => in_array($row['status'], ['approved', 'received', 'completed'], true) ? $employeeId : null,
                'approved_at' => in_array($row['status'], ['approved', 'received', 'completed'], true) ? $at->addHour() : null,
                'resolution_type' => $resolution, 'refund_method' => $row['refund_method'], 'restock_strategy' => $row['restock_strategy'],
                'refund_total' => $refund, 'exchange_credit_total' => $credit, 'exchange_due_total' => max(0, $difference),
                'promotion_adjustment_total' => 0, 'resolved_at' => $row['status'] === 'completed' ? $at->addDays(2) : null,
                'created_at' => $at, 'updated_at' => $at,
            ]);
            $this->insert('return_request_items', [
                'return_request_id' => $rrId, 'order_item_id' => $itemId, 'quantity' => min((int) $row['quantity'], (int) $item->quantity),
                'reason' => $row['reason'], 'condition_note' => 'Inspected and classified as '.$row['restock_strategy'],
                'exchange_product_id' => $type === 'exchange' ? $exchangeProduct['id'] : null,
                'exchange_variant_id' => $type === 'exchange' ? ($exchangeVariant['id'] ?? null) : null,
                'unit_price' => $item->unit_price, 'line_subtotal' => $item->line_subtotal ?: $item->line_total,
                'prorated_discount_amount' => $item->discount_amount, 'refundable_amount' => $refund,
                'exchange_unit_price' => $type === 'exchange' ? $exchangePrice : 0, 'exchange_line_total' => $type === 'exchange' ? $exchangePrice : 0,
                'exchange_price_difference' => $difference, 'exchange_amount_due' => max(0, $difference), 'exchange_refund_due' => max(0, -$difference),
            ]);
            $this->insert('return_status_histories', ['return_request_id' => $rrId, 'from_status' => null, 'to_status' => $row['status'], 'changed_by' => $employeeId, 'note' => 'Seeded return lifecycle', 'created_at' => $at]);
            if ($row['status'] === 'completed') {
                DB::table('order_items')->where('id', $itemId)->update($this->filter('order_items', [
                    'refunded_quantity' => $type === 'return' ? min((int) $row['quantity'], (int) $item->quantity) : 0,
                    'refunded_amount' => $refund, 'exchanged_quantity' => $type === 'exchange' ? 1 : 0,
                ]));
                DB::table('orders')->where('id', $order['id'])->increment('refund_total', $refund);
                if ($refund > 0) {
                    $payment = DB::table('payments')->where('order_id', $order['id'])->first();
                    if ($payment) DB::table('payments')->where('id', $payment->id)->update($this->filter('payments', ['refunded_amount' => $refund, 'refund_status' => 'partial_refund']));
                }
            }
        }
    }

    private function seedStockTransfers(): void
    {
        if (! Schema::hasTable('stock_transfers')) return;
        foreach ($this->data['stock_transfers'] ?? [] as $index => $row) {
            $at = $this->at($row['days_ago'], 570); $employeeId = $this->employee($row['employee_slot']);
            $product = $this->product($row['product_slot']); $variant = $this->variant($product, $row['variant_slot']);
            $id = $this->upsert('stock_transfers', ['transfer_number' => $row['transfer_number']], [
                'transfer_number' => $row['transfer_number'], 'from_shop_id' => $this->shops[$row['from_store_code']], 'to_shop_id' => $this->shops[$row['to_store_code']],
                'status' => $row['status'], 'created_by' => $employeeId, 'approved_by' => $row['status'] !== 'draft' ? $employeeId : null,
                'received_by' => in_array($row['status'], ['received', 'completed'], true) ? $employeeId : null, 'note' => $row['note'],
                'approved_at' => $row['status'] !== 'draft' ? $at->addHour() : null, 'received_at' => in_array($row['status'], ['received', 'completed'], true) ? $at->addDay() : null,
                'created_at' => $at, 'updated_at' => $at,
            ]);
            $this->insert('stock_transfer_items', ['stock_transfer_id' => $id, 'product_id' => $product['id'], 'variant_id' => $variant['id'] ?? null, 'quantity_requested' => $row['quantity'], 'quantity_received' => in_array($row['status'], ['received', 'completed'], true) ? $row['quantity'] : 0, 'created_at' => $at, 'updated_at' => $at]);
        }
    }

    private function seedEngagement(): void
    {
        foreach ($this->data['wishlists'] ?? [] as $row) {
            $product = $this->product($row['product_slot']); $variant = $this->variant($product, $row['variant_slot']);
            $this->upsert('wishlists', ['user_id' => $this->customer($row['customer_slot']), 'product_id' => $product['id'], 'variant_id' => $variant['id'] ?? null], ['user_id' => $this->customer($row['customer_slot']), 'product_id' => $product['id'], 'variant_id' => $variant['id'] ?? null, 'created_at' => $this->at($row['days_ago'], 650)]);
        }
        foreach ($this->data['social_shares'] ?? [] as $row) {
            $product = $this->product($row['product_slot']);
            $this->insert('social_shares', ['user_id' => $this->customer($row['customer_slot']), 'product_id' => $product['id'], 'platform' => $row['platform'], 'created_at' => $this->at($row['days_ago'], 660)]);
        }
    }

    private function seedCancellations(): void
    {
        foreach ($this->data['cancellation_requests'] ?? [] as $index => $row) {
            if ($this->orders === []) break; $order = $this->orders[$row['order_slot'] % count($this->orders)]; $at = $this->at($row['days_ago'], 680);
            $this->insert('cancellation_requests', ['order_id' => $order['id'], 'order_item_id' => $order['item_ids'][0] ?? null, 'requested_by' => $this->customer($row['customer_slot']), 'reason' => $row['reason'], 'note' => 'Realistic cancellation request', 'status' => $row['status'], 'processed_by' => $this->employee($index), 'processed_at' => $row['status'] === 'pending' ? null : $at->addHour(), 'created_at' => $at, 'updated_at' => $at]);
        }
    }

    private function seedNotifications(): void
    {
        if (! Schema::hasTable('notifications')) return;
        foreach ($this->data['notifications'] ?? [] as $index => $row) {
            $at = $this->at($row['days_ago'], 700);
            $payload = ['title' => $row['title'], 'message' => $row['message'], 'seeded' => true];
            $this->insert('notifications', ['id' => (string) Str::uuid(), 'type' => $row['type'], 'notifiable_type' => 'App\\Models\\User', 'notifiable_id' => $this->customer($row['customer_slot']), 'data' => $this->json($payload), 'read_at' => $row['read'] ? $at->addHour() : null, 'created_at' => $at, 'updated_at' => $at]);
        }
    }

    private function seedDailySummaries(): void
    {
        if (! Schema::hasTable('daily_sales_summaries')) return;
        for ($day = 29; $day >= 0; $day--) {
            $date = $this->anchor->subDays($day)->toDateString();
            $query = DB::table('orders')->whereDate('order_date', $date)->whereNotIn('status', ['cancelled']);
            $this->upsert('daily_sales_summaries', ['date' => $date], [
                'date' => $date, 'total_orders' => (clone $query)->count(), 'total_revenue' => (clone $query)->sum('grand_total'),
                'total_refunds' => (clone $query)->sum('refund_total'),
                'total_items_sold' => DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')->whereDate('orders.order_date', $date)->whereNotIn('orders.status', ['cancelled'])->sum('order_items.quantity'),
                'created_at' => $this->anchor, 'updated_at' => $this->anchor,
            ]);
        }
    }

    private function refreshProductMetrics(): void
    {
        foreach ($this->products as $product) {
            $id = (int) $product['id'];
            $sold = (int) DB::table('order_items')->where('product_id', $id)->sum('quantity');
            DB::table('products')->where('id', $id)->update($this->filter('products', ['sold_count' => $sold, 'stock_status' => 'in_stock', 'purchasable' => true, 'is_active' => true, 'updated_at' => $this->anchor]));
        }
    }

    private function writeAuditLogs(): void
    {
        if (! Schema::hasTable('activity_logs')) return;
        $modules = ['orders', 'inventory', 'product_batches', 'returns', 'promotions', 'employees', 'products'];
        for ($i = 0; $i < 400; $i++) {
            $at = $this->at($i % 30, 500 + ($i % 500));
            $this->insert('activity_logs', ['user_id' => $this->employee($i), 'shop_id' => array_values($this->shops)[$i % count($this->shops)], 'module' => $modules[$i % count($modules)], 'action' => ['created', 'updated', 'approved', 'received'][$i % 4], 'subject_type' => 'SeededRecord', 'subject_id' => $i + 1, 'description' => 'Realistic seeded activity log #'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT), 'before' => $this->json(null), 'after' => $this->json(['seeded' => true]), 'ip_address' => '127.0.0.1', 'user_agent' => 'HajjMart realistic seeder', 'created_at' => $at, 'updated_at' => $at]);
        }
    }

    private function assertStoreScopedInventoryIndex(): void
    {
        if (! Schema::hasTable('inventory') || DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        $indexes = [];
        foreach (DB::select('SHOW INDEX FROM `inventory`') as $row) {
            $row = (array) $row;
            $name = (string) ($row['Key_name'] ?? $row['key_name'] ?? '');
            $column = (string) ($row['Column_name'] ?? $row['column_name'] ?? '');
            $sequence = (int) ($row['Seq_in_index'] ?? $row['seq_in_index'] ?? 0);
            $nonUnique = (int) ($row['Non_unique'] ?? $row['non_unique'] ?? 1);

            if ($name === '' || $column === '' || $sequence < 1) {
                continue;
            }

            $indexes[$name] ??= ['unique' => $nonUnique === 0, 'columns' => []];
            $indexes[$name]['unique'] = $nonUnique === 0;
            $indexes[$name]['columns'][$sequence - 1] = $column;
        }

        foreach ($indexes as &$definition) {
            ksort($definition['columns']);
            $definition['columns'] = array_values($definition['columns']);
        }
        unset($definition);

        foreach ($indexes as $definition) {
            if ($definition['unique']
                && $definition['columns'] === ['product_id', 'variant_id']) {
                throw new RuntimeException(
                    'Inventory still has the legacy UNIQUE(product_id, variant_id) index. '
                    .'Run php artisan migrate (or migrate:fresh --seed) so the '
                    .'2026_07_23_000000 inventory index repair migration can run.'
                );
            }
        }

        $target = $indexes['inventory_product_variant_shop_unique'] ?? null;
        if ($target === null
            || ! $target['unique']
            || $target['columns'] !== ['product_id', 'variant_id', 'shop_id']) {
            throw new RuntimeException(
                'The store-scoped inventory index is missing. Run php artisan migrate '
                .'before starting HajjMartRealisticDatabaseSeeder.'
            );
        }
    }

    private function product(int $slot): array { return $this->products[$slot % count($this->products)]; }
    private function variant(array $product, int $slot): ?array { $rows = $this->variantsByProduct[(int) $product['id']] ?? []; return $rows === [] ? null : $rows[$slot % count($rows)]; }
    private function customer(?int $slot): ?int { return $slot === null ? null : $this->customers[$slot % count($this->customers)]; }
    private function employee(int $slot): int { return $this->employees[$slot % count($this->employees)]; }
    private function price(array $product, ?array $variant): float { return max(1, (float) ($variant['sale_price'] ?? $variant['price'] ?? $product['sale_price'] ?? $product['base_price'] ?? $product['regular_price'] ?? 100)); }
    private function cost(array $product, ?array $variant, float $price): float { $cost = (float) ($variant['cost_price'] ?? $product['cost_price'] ?? 0); return $cost > 0 ? $cost : round($price * .62, 2); }
    private function at(int $daysAgo, int $minute): CarbonImmutable { return $this->anchor->subDays($daysAgo)->startOfDay()->addMinutes($minute % 1440); }
    private function json(mixed $value): ?string { return $value === null ? null : json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }

    private function insert(string $table, array $data): int
    {
        if (! Schema::hasTable($table)) return 0;
        $filtered = $this->filter($table, $data);
        if (array_key_exists('id', $filtered) && ! is_int($filtered['id']) && ! ctype_digit((string) $filtered['id'])) {
            DB::table($table)->insert($filtered);
            return 0;
        }
        return (int) DB::table($table)->insertGetId($filtered);
    }

    private function upsert(string $table, array $match, array $data): int
    {
        if (! Schema::hasTable($table)) return 0;
        $match = $this->filter($table, $match); $data = $this->filter($table, $data);
        $existing = DB::table($table)->where($match)->value('id');
        if ($existing) { DB::table($table)->where('id', $existing)->update($data); return (int) $existing; }
        return (int) DB::table($table)->insertGetId(array_merge($match, $data));
    }

    private function filter(string $table, array $data): array
    {
        $this->columns[$table] ??= array_flip(Schema::getColumnListing($table));
        return array_intersect_key($data, $this->columns[$table]);
    }
}
