<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add source_processing_ids column so stock logs can reference ALL
     * processing sources that contributed to a distribution (not just the first).
     */
    public function up(): void
    {
        Schema::table('stock_logs', function (Blueprint $table) {
            $table->json('source_processing_ids')->nullable()->after('source_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_logs', function (Blueprint $table) {
            $table->dropColumn('source_processing_ids');
        });
    }
};
