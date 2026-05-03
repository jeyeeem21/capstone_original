<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Product;
use Illuminate\Support\Carbon;

class SaleSeeder extends Seeder
{
    /**
     * Seed the database with sample sales data for Growth Analysis.
     * Creates sales over the past 3 months with realistic patterns.
     */
    public function run(): void
    {
        $products = Product::where('status', 'active')->get();

        if ($products->isEmpty()) {
            $this->command->warn('No active products found — skipping SaleSeeder.');
            return;
        }

        $now = Carbon::now();
        $counter = 1;

        // Generate sales for the past 3 months
        for ($monthsAgo = 2; $monthsAgo >= 0; $monthsAgo--) {
            $month = $now->copy()->subMonths($monthsAgo);
            $daysInMonth = $month->daysInMonth;

            // More sales as we get closer to current month (growth trend)
            $salesPerDay = $monthsAgo === 2 ? [1, 3] : ($monthsAgo === 1 ? [2, 5] : [3, 7]);

            for ($day = 1; $day <= $daysInMonth; $day++) {
                $date = $month->copy()->day($day);

                // Skip future dates
                if ($date->isAfter($now)) break;

                // Random number of sales this day
                $numSales = rand($salesPerDay[0], $salesPerDay[1]);

                for ($s = 0; $s < $numSales; $s++) {
                    $hour = rand(7, 18);
                    $minute = rand(0, 59);
                    $saleDate = $date->copy()->setTime($hour, $minute, rand(0, 59));

                    // Pick 1-3 random products for this sale
                    $numItems = rand(1, min(3, $products->count()));
                    $selectedProducts = $products->random($numItems);

                    $subtotal = 0;
                    $items = [];

                    foreach ($selectedProducts as $product) {
                        $qty = rand(1, 5);
                        $unitPrice = (float) $product->price;
                        $itemSubtotal = $qty * $unitPrice;
                        $subtotal += $itemSubtotal;

                        $items[] = [
                            'product_id' => $product->product_id,
                            'quantity' => $qty,
                            'unit_price' => $unitPrice,
                            'subtotal' => $itemSubtotal,
                        ];
                    }

                    $paymentMethod = rand(1, 10) <= 7 ? 'cash' : 'gcash';
                    $total = $subtotal; // No discount for seed data
                    $amountTendered = $paymentMethod === 'cash'
                        ? ceil($total / 100) * 100
                        : $total;
                    $change = $amountTendered - $total;

                    $transactionId = sprintf(
                        'ORD-%s-%03d',
                        $saleDate->format('Ymd'),
                        $counter
                    );

                    $sale = Sale::create([
                        'transaction_id' => $transactionId,
                        'customer_id' => null,
                        'subtotal' => $subtotal,
                        'discount' => 0,
                        'total' => $total,
                        'amount_tendered' => $amountTendered,
                        'change_amount' => $change,
                        'payment_method' => $paymentMethod,
                        'reference_number' => $paymentMethod === 'gcash'
                            ? rand(1000000000, 9999999999)
                            : null,
                        'status' => 'completed',
                        'notes' => null,
                        'created_at' => $saleDate,
                        'updated_at' => $saleDate,
                    ]);

                    foreach ($items as $item) {
                        SaleItem::create([
                            'sale_id' => $sale->id,
                            'product_id' => $item['product_id'],
                            'quantity' => $item['quantity'],
                            'unit_price' => $item['unit_price'],
                            'subtotal' => $item['subtotal'],
                            'created_at' => $saleDate,
                            'updated_at' => $saleDate,
                        ]);
                    }

                    $counter++;
                }
            }
        }

        $totalSales = Sale::count();
        $this->command->info("Seeded {$totalSales} sales transactions.");
    }
}
