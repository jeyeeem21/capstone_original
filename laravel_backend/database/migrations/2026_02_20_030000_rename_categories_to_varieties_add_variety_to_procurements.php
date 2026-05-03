<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Rename categories table to varieties.
     * Also add variety_id to procurements.
     */
    public function up(): void
    {
        // 1. Rename categories → varieties
        Schema::rename('categories', 'varieties');

        // 2. Add variety_id to procurements (nullable so existing records are not broken)
        Schema::table('procurements', function (Blueprint $table) {
            $table->unsignedBigInteger('variety_id')->nullable()->after('supplier_id');
            $table->foreign('variety_id')->references('id')->on('varieties')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('procurements', function (Blueprint $table) {
            $table->dropForeign(['variety_id']);
            $table->dropColumn('variety_id');
        });

        Schema::rename('varieties', 'categories');
    }
};
