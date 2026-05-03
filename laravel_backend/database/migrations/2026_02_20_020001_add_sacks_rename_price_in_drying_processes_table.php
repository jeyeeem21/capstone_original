<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * - Add sacks column to drying_processes
     * - Rename price_per_day to price
     */
    public function up(): void
    {
        Schema::table('drying_processes', function (Blueprint $table) {
            $table->integer('sacks')->default(0)->after('quantity_kg')->comment('Number of sacks/bags from procurement');
            $table->renameColumn('price_per_day', 'price');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('drying_processes', function (Blueprint $table) {
            $table->renameColumn('price', 'price_per_day');
            $table->dropColumn('sacks');
        });
    }
};
