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
        Schema::table('processings', function (Blueprint $table) {
            // Stock out tracks how much of the output has been distributed
            $table->decimal('stock_out', 10, 2)->default(0)->after('output_kg');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('processings', function (Blueprint $table) {
            $table->dropColumn('stock_out');
        });
    }
};
