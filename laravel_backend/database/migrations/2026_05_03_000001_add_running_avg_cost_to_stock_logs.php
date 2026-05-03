<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_logs', function (Blueprint $table) {
            $table->decimal('running_avg_cost', 14, 4)->nullable()->after('cost_per_unit');
        });

        // Backfill PWAC for existing IN logs with cost data, in chronological order per product
        $productIds = DB::table('stock_logs')
            ->where('type', 'in')
            ->whereNotNull('total_cost')
            ->where('total_cost', '>', 0)
            ->distinct()
            ->pluck('product_id');

        foreach ($productIds as $productId) {
            $logs = DB::table('stock_logs')
                ->where('product_id', $productId)
                ->where('type', 'in')
                ->whereNotNull('total_cost')
                ->where('total_cost', '>', 0)
                ->orderBy('created_at')
                ->select('id', 'quantity_before', 'quantity_change', 'total_cost')
                ->get();

            $prevAvg = 0;
            foreach ($logs as $log) {
                $stockBefore = (int) $log->quantity_before;
                $newUnits    = (int) $log->quantity_change;
                $totalCost   = (float) $log->total_cost;
                $totalUnits  = $stockBefore + $newUnits;

                $runningAvg = $totalUnits > 0
                    ? round(($stockBefore * $prevAvg + $totalCost) / $totalUnits, 4)
                    : 0;

                DB::table('stock_logs')
                    ->where('id', $log->id)
                    ->update(['running_avg_cost' => $runningAvg]);

                $prevAvg = $runningAvg;
            }
        }
    }

    public function down(): void
    {
        Schema::table('stock_logs', function (Blueprint $table) {
            $table->dropColumn('running_avg_cost');
        });
    }
};
