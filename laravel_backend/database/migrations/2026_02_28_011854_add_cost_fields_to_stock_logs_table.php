<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('stock_logs', function (Blueprint $table) {
            $table->decimal('procurement_cost', 14, 2)->nullable()->after('notes');
            $table->decimal('drying_cost', 14, 2)->nullable()->after('procurement_cost');
            $table->decimal('total_cost', 14, 2)->nullable()->after('drying_cost');
            $table->decimal('cost_per_unit', 14, 2)->nullable()->after('total_cost');
            $table->decimal('selling_price', 14, 2)->nullable()->after('cost_per_unit');
            $table->decimal('profit_per_unit', 14, 2)->nullable()->after('selling_price');
            $table->decimal('profit_margin', 8, 2)->nullable()->after('profit_per_unit');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_logs', function (Blueprint $table) {
            $table->dropColumn([
                'procurement_cost', 'drying_cost', 'total_cost',
                'cost_per_unit', 'selling_price', 'profit_per_unit', 'profit_margin',
            ]);
        });
    }
};
