<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        // Create Super Admin account (only one)
        User::updateOrCreate(
            ['email' => 'jmpagaran24@gmail.com'],
            [
                'name' => 'JM Pagaran',
                'first_name' => 'JM',
                'last_name' => 'Pagaran',
                'email' => 'jmpagaran24@gmail.com',
                'password' => Hash::make('superadmin123'),
                'role' => User::ROLE_SUPER_ADMIN,
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        // Create default Admin account
        User::updateOrCreate(
            ['email' => 'angelicabejer07@gmail.com'],
            [
                'name' => 'Angelica Bejer',
                'first_name' => 'Angelica',
                'last_name' => 'Bejer',
                'email' => 'angelicabejer07@gmail.com',
                'password' => Hash::make('admin123'),
                'role' => User::ROLE_ADMIN,
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

         User::updateOrCreate(
            ['email' => 'jholandgalicia123@gmail.com'],
            [
                'name' => 'Jholand Galicia',
                'first_name' => 'Jholand',
                'last_name' => 'Galicia',
                'email' => 'jholandgalicia123@gmail.com',
                'password' => Hash::make('admin123'),
                'role' => User::ROLE_ADMIN,
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        // Create default Staff account
        User::updateOrCreate(
            ['email' => 'staff@kjpricemill.com'],
            [
                'name' => 'Staff User',
                'first_name' => 'Staff',
                'last_name' => 'User',
                'email' => 'staff@kjpricemill.com',
                'password' => Hash::make('staff123'),
                'role' => User::ROLE_STAFF,
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $this->command->info('Default accounts created:');
        $this->command->table(
            ['Role', 'Email', 'Password'],
            [
                ['Super Admin', 'superadmin@kjpricemill.com', 'superadmin123'],
                ['Admin', 'admin@kjpricemill.com', 'admin123'],
                ['Staff', 'staff@kjpricemill.com', 'staff123'],
            ]
        );
    }
}
