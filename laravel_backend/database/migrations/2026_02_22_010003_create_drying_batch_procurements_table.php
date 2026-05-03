<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drying_batch_procurements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drying_process_id')->constrained('drying_processes')->onDelete('cascade');
            $table->foreignId('procurement_id')->constrained('procurements')->onDelete('cascade');
            // Proportional share of this procurement allocated to this drying record
            $table->decimal('sacks_taken', 10, 0)->default(0);
            $table->decimal('quantity_kg', 14, 2)->default(0);
            $table->timestamps();

            // Unique: a procurement can only appear once per drying record
            $table->unique(['drying_process_id', 'procurement_id'], 'dbp_drying_proc_unique');
            $table->index('drying_process_id');
            $table->index('procurement_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drying_batch_procurements');
    }
};
