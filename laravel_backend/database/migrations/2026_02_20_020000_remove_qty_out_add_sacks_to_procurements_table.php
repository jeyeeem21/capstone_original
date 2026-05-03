<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * - Remove quantity_out column from procurements
     * - Add sacks (bags) column to procurements
     */
    public function up(): void
    {
        Schema::table('procurements', function (Blueprint $table) {
            $table->dropColumn('quantity_out');
            $table->integer('sacks')->default(0)->after('quantity_kg')->comment('Number of sacks/bags');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('procurements', function (Blueprint $table) {
            $table->dropColumn('sacks');
            $table->decimal('quantity_out', 12, 2)->default(0)->after('quantity_kg')->comment('Quantity sent to processing');
        });
    }
};
