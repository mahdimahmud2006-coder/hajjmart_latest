<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HajjMartApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_product_list_uses_standard_response(): void
    {
        Product::factory()->create(['name' => 'Demo Product', 'slug' => 'demo-product', 'selling_price' => 100, 'is_active' => true]);

        $this->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['success', 'message', 'data', 'meta']);
    }

    public function test_admin_can_access_reports(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/reports/sales')
            ->assertOk()
            ->assertJsonPath('success', true);
    }


    public function test_customer_registration_does_not_require_a_separate_bangla_name_field(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Mofiz Rahman',
            'email' => 'mofiz@example.com',
            'phone' => '01619090909',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.name', 'Mofiz Rahman');

        $this->assertDatabaseHas('users', [
            'email' => 'mofiz@example.com',
            'name' => 'Mofiz Rahman',
        ]);
    }

    public function test_customer_registration_rejects_mismatched_password_confirmation(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Mofiz Rahman',
            'email' => 'mofiz-mismatch@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Different123!',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    }

}
