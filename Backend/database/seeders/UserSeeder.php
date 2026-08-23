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
                'is_employee' => true,
                'is_admin' => true,
                'is_active' => true,
                'employee_code' => 'HM-ADMIN',
                'designation' => 'Administrator',
            ]
        );
    }
}
