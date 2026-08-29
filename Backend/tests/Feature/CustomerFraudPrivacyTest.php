<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderList;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerFraudPrivacyTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_order_detail_does_not_expose_internal_fraud_fields(): void
    {
        $shop = Shop::create([
            'name' => 'Main Store',
            'code' => 'MAIN01',
            'is_active' => true,
            'is_default' => true,
        ]);
        $customer = User::factory()->create(['is_employee' => false, 'is_active' => true]);
        $list = OrderList::create();
        $order = Order::create([
            'order_list_id' => $list->id,
            'order_number' => 'ORD-PRIVATE-FRAUD',
            'order_id' => '9876543',
            'customer_id' => $customer->id,
            'shop_id' => $shop->id,
            'source_channel' => 'website',
            'status' => 'pending',
            'order_status' => 'Pending',
            'payment_method' => 'cod',
            'grand_total' => 500,
            'paid_amount' => 0,
            'due_amount' => 500,
            'is_potential_fraud' => true,
            'fraud_score' => 75,
            'fraud_reasons' => ['Internal risk reason'],
            'fraud_checked_at' => now(),
        ]);

        $response = $this->actingAs($customer, 'sanctum')
            ->getJson('/api/v1/orders/'.$order->order_number)
            ->assertOk();

        $this->assertArrayNotHasKey('is_potential_fraud', $response->json('data'));
        $this->assertArrayNotHasKey('fraud_score', $response->json('data'));
        $this->assertArrayNotHasKey('fraud_reasons', $response->json('data'));
        $this->assertArrayNotHasKey('fraud_checked_at', $response->json('data'));
    }
}
