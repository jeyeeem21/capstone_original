<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drying_processes', function (Blueprint $table) {
            // batch_id is mutually exclusive with procurement_id:
            //   procurement_id SET  → single-procurement drying
            //   batch_id SET        → batch drying (procurement_id becomes nullable-allow)
            $table->unsignedBigInteger('batch_id')->nullable()->after('procurement_id');
            $table->foreign('batch_id')->references('id')->on('procurement_batches')->nullOnDelete();
            $table->index('batch_id');

            // Make procurement_id nullable so batch-only rows are valid
            $table->unsignedBigInteger('procurement_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('drying_processes', function (Blueprint $table) {
            $table->dropForeign(['batch_id']);
            $table->dropIndex(['batch_id']);
            $table->dropColumn('batch_id');
            $table->unsignedBigInteger('procurement_id')->nullable(false)->change();
        });
    }
};
