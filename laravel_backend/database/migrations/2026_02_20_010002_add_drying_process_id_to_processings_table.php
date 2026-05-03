<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Add drying_process_id to processings table so Processing sources from Drying instead of Procurement
     */
    public function up(): void
    {
        Schema::table('processings', function (Blueprint $table) {
            $table->foreignId('drying_process_id')->nullable()->after('procurement_id')
                  ->constrained('drying_processes')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('processings', function (Blueprint $table) {
            $table->dropForeign(['drying_process_id']);
            $table->dropColumn('drying_process_id');
        });
    }
};
