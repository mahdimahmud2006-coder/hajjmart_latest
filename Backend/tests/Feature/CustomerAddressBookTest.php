<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerAddressBookTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_save_addresses_and_switch_the_default_address(): void
    {
        $user = User::factory()->create();

        $first = $this->actingAs($user, 'sanctum')->postJson('/api/v1/addresses', [
            'label' => 'Home',
            'recipient_name' => 'Rahim',
            'phone' => '01714049448',
            'district' => 'Dhaka',
            'upazila' => 'Uttara West',
            'full_address' => 'House 08 Sector 3 Road 8',
            'is_default' => false,
        ])->assertCreated()->json('data');

        $this->assertTrue((bool) $first['is_default']);
        $this->assertDatabaseHas('user_addresses', [
            'id' => $first['id'],
            'address_line_1' => 'House 08 Sector 3 Road 8',
            'upazila' => 'Uttara West',
            'is_default' => true,
        ]);
        $this->assertSame($first['id'], $user->fresh()->address_default_id);

        $this->actingAs($user, 'sanctum')->postJson('/api/v1/addresses', [
            'label' => 'Office',
            'recipient_name' => 'Rahim',
            'phone' => '01714049448',
            'district' => 'Dhaka',
            'full_address' => 'Office road',
        ])->assertUnprocessable()->assertJsonValidationErrors(['upazila']);

        $second = $this->actingAs($user, 'sanctum')->postJson('/api/v1/addresses', [
            'label' => 'Office',
            'recipient_name' => 'Rahim',
            'phone' => '01714049448',
            'district' => 'Dhaka',
            'upazila' => 'Banani',
            'full_address' => 'Office road',
        ])->assertCreated()->json('data');

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/v1/addresses/'.$second['id'], ['is_default' => true])
            ->assertOk()
            ->assertJsonPath('data.is_default', true);

        $this->assertDatabaseHas('user_addresses', ['id' => $first['id'], 'is_default' => false]);
        $this->assertDatabaseHas('user_addresses', ['id' => $second['id'], 'is_default' => true]);
        $this->assertSame($second['id'], $user->fresh()->address_default_id);
    }
}
