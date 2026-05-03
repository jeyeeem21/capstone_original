<?php

namespace Database\Seeders;

use App\Models\Procurement;
use App\Models\ProcurementBatch;
use App\Models\Supplier;
use App\Models\Variety;
use Illuminate\Database\Seeder;

class ProcurementSeeder extends Seeder
{
    public function run(): void
    {
        // --- Get varieties (seeded by VarietySeeder) ---
        $sinandomeng = Variety::where('name', 'Sinandomeng')->first();
        $ir64        = Variety::where('name', 'IR64')->first();
        $dinorado    = Variety::where('name', 'Dinorado')->first();

        if (!$sinandomeng || !$ir64 || !$dinorado) {
            $this->command->error('Varieties not found. Run VarietySeeder first.');
            return;
        }

        // --- Create Suppliers ---
        $suppliers = [];
        $supplierData = [
            ['name' => 'Em Company',       'contact' => 'Emily Santos',      'phone' => '09171234567', 'email' => 'em@company.com',       'address' => 'Brgy. San Jose, Nueva Ecija'],
            ['name' => 'Gel Company',       'contact' => 'Angelo Cruz',       'phone' => '09181234567', 'email' => 'gel@company.com',      'address' => 'Brgy. Sta. Rosa, Tarlac'],
            ['name' => 'Jho Company',       'contact' => 'John Reyes',        'phone' => '09191234567', 'email' => 'jho@company.com',      'address' => 'Brgy. Poblacion, Pangasinan'],
            ['name' => 'Rico Trading',      'contact' => 'Ricardo Mendoza',   'phone' => '09201234567', 'email' => 'rico@trading.com',     'address' => 'Brgy. Macabebe, Pampanga'],
            ['name' => 'Santos Farm',       'contact' => 'Maria Santos',      'phone' => '09211234567', 'email' => 'santos@farm.com',      'address' => 'Brgy. Cabanatuan, Nueva Ecija'],
            ['name' => 'Dela Cruz Agri',    'contact' => 'Pedro Dela Cruz',   'phone' => '09221234567', 'email' => 'delacruz@agri.com',    'address' => 'Brgy. San Fernando, Pampanga'],
            ['name' => 'Villanueva Palay',  'contact' => 'Jose Villanueva',   'phone' => '09231234567', 'email' => 'villanueva@palay.com', 'address' => 'Brgy. Urdaneta, Pangasinan'],
        ];

        foreach ($supplierData as $s) {
            $suppliers[] = Supplier::firstOrCreate(['email' => $s['email']], array_merge($s, ['status' => 'Active']));
        }

        // =============================================
        // BATCH 1 — Dinorado (3 procurements)
        // =============================================
        $batch1 = ProcurementBatch::create([
            'batch_number' => ProcurementBatch::generateBatchNumber(),
            'variety_id'   => $dinorado->id,
            'season_date'  => now(),
            'status'       => ProcurementBatch::STATUS_OPEN,
            'notes'        => 'Dinorado harvest batch - March 2026',
        ]);

        $batch1Procurements = [
            ['supplier' => $suppliers[0], 'sacks' => 80,  'quantity_kg' => 4000,  'price_per_kg' => 10, 'description' => 'Paid'],
            ['supplier' => $suppliers[1], 'sacks' => 800, 'quantity_kg' => 38400, 'price_per_kg' => 10, 'description' => 'Paid'],
            ['supplier' => $suppliers[2], 'sacks' => 376, 'quantity_kg' => 14820, 'price_per_kg' => 10, 'description' => 'Paid'],
        ];

        foreach ($batch1Procurements as $p) {
            Procurement::create([
                'supplier_id'  => $p['supplier']->id,
                'variety_id'   => $dinorado->id,
                'batch_id'     => $batch1->id,
                'sacks'        => $p['sacks'],
                'quantity_kg'  => $p['quantity_kg'],
                'price_per_kg' => $p['price_per_kg'],
                'total_cost'   => $p['quantity_kg'] * $p['price_per_kg'],
                'description'  => $p['description'],
                'status'       => 'Pending',
            ]);
        }
        $batch1->recalculateTotals();

        // =============================================
        // BATCH 2 — Sinandomeng (3 procurements)
        // =============================================
        $batch2 = ProcurementBatch::create([
            'batch_number' => ProcurementBatch::generateBatchNumber(),
            'variety_id'   => $sinandomeng->id,
            'season_date'  => now(),
            'status'       => ProcurementBatch::STATUS_OPEN,
            'notes'        => 'Sinandomeng harvest batch - March 2026',
        ]);

        $batch2Procurements = [
            ['supplier' => $suppliers[3], 'sacks' => 120, 'quantity_kg' => 6000,  'price_per_kg' => 9, 'description' => 'Paid - COD'],
            ['supplier' => $suppliers[4], 'sacks' => 500, 'quantity_kg' => 25000, 'price_per_kg' => 9, 'description' => 'Paid'],
            ['supplier' => $suppliers[5], 'sacks' => 250, 'quantity_kg' => 12500, 'price_per_kg' => 9, 'description' => 'Not paid'],
        ];

        foreach ($batch2Procurements as $p) {
            Procurement::create([
                'supplier_id'  => $p['supplier']->id,
                'variety_id'   => $sinandomeng->id,
                'batch_id'     => $batch2->id,
                'sacks'        => $p['sacks'],
                'quantity_kg'  => $p['quantity_kg'],
                'price_per_kg' => $p['price_per_kg'],
                'total_cost'   => $p['quantity_kg'] * $p['price_per_kg'],
                'description'  => $p['description'],
                'status'       => 'Pending',
            ]);
        }
        $batch2->recalculateTotals();

        // =============================================
        // BATCH 3 — IR64 (3 procurements)
        // =============================================
        $batch3 = ProcurementBatch::create([
            'batch_number' => ProcurementBatch::generateBatchNumber(),
            'variety_id'   => $ir64->id,
            'season_date'  => now(),
            'status'       => ProcurementBatch::STATUS_OPEN,
            'notes'        => 'IR64 harvest batch - March 2026',
        ]);

        $batch3Procurements = [
            ['supplier' => $suppliers[6], 'sacks' => 200, 'quantity_kg' => 10000, 'price_per_kg' => 9,   'description' => 'Paid'],
            ['supplier' => $suppliers[0], 'sacks' => 640, 'quantity_kg' => 32000, 'price_per_kg' => 9, 'description' => 'Paid - GCash'],
            ['supplier' => $suppliers[3], 'sacks' => 300, 'quantity_kg' => 15000, 'price_per_kg' => 9,   'description' => 'Not paid'],
        ];

        foreach ($batch3Procurements as $p) {
            Procurement::create([
                'supplier_id'  => $p['supplier']->id,
                'variety_id'   => $ir64->id,
                'batch_id'     => $batch3->id,
                'sacks'        => $p['sacks'],
                'quantity_kg'  => $p['quantity_kg'],
                'price_per_kg' => $p['price_per_kg'],
                'total_cost'   => $p['quantity_kg'] * $p['price_per_kg'],
                'description'  => $p['description'],
                'status'       => 'Pending',
            ]);
        }
        $batch3->recalculateTotals();

        // =============================================
        // STANDALONE (no batch) — 3 procurements
        // =============================================
        $standaloneProcurements = [
            ['supplier' => $suppliers[4], 'variety' => $dinorado,    'sacks' => 900, 'quantity_kg' => 42000, 'price_per_kg' => 9,  'description' => 'Paid'],
            ['supplier' => $suppliers[5], 'variety' => $sinandomeng, 'sacks' => 150, 'quantity_kg' => 7500,  'price_per_kg' => 9, 'description' => 'Paid - COD'],
            ['supplier' => $suppliers[6], 'variety' => $ir64,        'sacks' => 350, 'quantity_kg' => 17500, 'price_per_kg' => 9,   'description' => 'Not paid'],
        ];

        foreach ($standaloneProcurements as $p) {
            Procurement::create([
                'supplier_id'  => $p['supplier']->id,
                'variety_id'   => $p['variety']->id,
                'batch_id'     => null,
                'sacks'        => $p['sacks'],
                'quantity_kg'  => $p['quantity_kg'],
                'price_per_kg' => $p['price_per_kg'],
                'total_cost'   => $p['quantity_kg'] * $p['price_per_kg'],
                'description'  => $p['description'],
                'status'       => 'Pending',
            ]);
        }

        // --- Summary ---
        $this->command->info('Procurement data seeded:');
        $this->command->table(
            ['Type', 'Batch #', 'Variety', 'Procurements', 'Total Sacks', 'Total Kg'],
            [
                ['Batch 1', $batch1->batch_number, 'Dinorado',    '3', '1,256',  '57,220 kg'],
                ['Batch 2', $batch2->batch_number, 'Sinandomeng', '3', '870',    '43,500 kg'],
                ['Batch 3', $batch3->batch_number, 'IR64',        '3', '1,140',  '57,000 kg'],
                ['Standalone', '—',                'Mixed',       '3', '1,400',  '67,000 kg'],
            ]
        );
        $this->command->info('Total: 12 procurements, 7 suppliers, 3 batches + 3 standalone');
    }
}
