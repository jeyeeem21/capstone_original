<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pivot table: links one processing record to multiple drying sources.
     * Each row stores how much quantity_kg was taken from that drying process.
     */
    public function up(): void
    {
        Schema::create('processing_drying_sources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('processing_id')->constrained('processings')->cascadeOnDelete();
            $table->foreignId('drying_process_id')->constrained('drying_processes')->cascadeOnDelete();
            $table->decimal('quantity_kg', 12, 2); // How much was taken from this drying source
            $table->timestamps();

            $table->unique(['processing_id', 'drying_process_id'], 'proc_dry_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('processing_drying_sources');
    }
};
