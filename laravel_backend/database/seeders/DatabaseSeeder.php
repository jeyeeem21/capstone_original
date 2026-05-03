<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Seed default user accounts (Super Admin, Admin, Staff)
        $this->call(SuperAdminSeeder::class);

        // Seed appearance settings with defaults
        $this->call(AppearanceSettingSeeder::class);
        
        // Seed varieties (rice types)
        $this->call(VarietySeeder::class);

         // Seed procurements
        $this->call(ProcurementSeeder::class);

        // Seed business settings (name, contact, SMTP, GCash, shipping, etc.)
        $this->call(BusinessSettingSeeder::class);

        // Seed default website content (Home & About pages)
        $this->call(WebsiteContentSeeder::class);
    }
}
