<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@hajjmart.local'],
            [
                'name' => 'HajjMart Admin',
                'phone' => '01700000000',
                'password' => Hash::make('ChangeMe123!'),
                'role' => 'admin',
                'is_active' => true,
            ]
        );

        User::updateOrCreate(
            ['email' => 'customer@hajjmart.local'],
            [
                'name' => 'Demo Customer',
                'phone' => '01700000002',
                'password' => Hash::make('ChangeMe123!'),
                'role' => 'customer',
                'is_active' => true,
            ]
        );
    }
}
