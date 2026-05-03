<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Product;

class ProductSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get variety IDs by name
        $varieties = \App\Models\Variety::pluck('id', 'name');

        $products = [
            [
                'product_name' => 'Sinandomeng Premium',
                'variety_id' => $varieties['Sinandomeng'] ?? 1,
                'price' => 850.00,
                'stocks' => 100,
                'stock_floor' => 10,
                'unit' => '25kg',
                'weight' => 25.00,
                'status' => 'active',
                'is_deleted' => false,
            ],
            [
                'product_name' => 'IR64 Long Grain',
                'variety_id' => $varieties['IR64'] ?? 2,
                'price' => 650.00,
                'stocks' => 80,
                'stock_floor' => 8,
                'unit' => '25kg',
                'weight' => 25.00,
                'status' => 'active',
                'is_deleted' => false,
            ],
            [
                'product_name' => 'Dinorado Special',
                'variety_id' => $varieties['Dinorado'] ?? 3,
                'price' => 750.00,
                'stocks' => 60,
                'stock_floor' => 6,
                'unit' => '25kg',
                'weight' => 25.00,
                'status' => 'active',
                'is_deleted' => false,
            ],
        ];

        foreach ($products as $product) {
            Product::create($product);
        }
    }
}
