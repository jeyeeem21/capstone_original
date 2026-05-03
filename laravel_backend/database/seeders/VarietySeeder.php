<?php

namespace Database\Seeders;

use App\Models\Variety;
use Illuminate\Database\Seeder;

class VarietySeeder extends Seeder
{
    /**
     * Seed 3 common rice varieties.
     */
    public function run(): void
    {
        $varieties = [
            [
                'name'        => 'Sinandomeng',
                'description' => 'Premium aromatic rice variety known for its soft texture and distinct aroma. Highly preferred for everyday consumption.',
                'color'       => '#22c55e',
                'status'      => 'Active',
            ],
            [
                'name'        => 'IR64',
                'description' => 'High-yielding, medium-grain rice variety. Widely cultivated for its consistent quality and good milling recovery.',
                'color'       => '#3b82f6',
                'status'      => 'Active',
            ],
            [
                'name'        => 'Dinorado',
                'description' => 'Premium fragrant long-grain white rice with a slightly sweet flavor. Popular as a premium table rice.',
                'color'       => '#eab308',
                'status'      => 'Active',
            ],
        ];

        foreach ($varieties as $variety) {
            Variety::firstOrCreate(
                ['name' => $variety['name']],
                $variety
            );
        }
    }
}
