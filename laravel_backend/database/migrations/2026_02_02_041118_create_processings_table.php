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
        Schema::create('processings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('procurement_id')->nullable()->constrained('procurements')->nullOnDelete();
            $table->decimal('input_kg', 12, 2); // Raw material input
            $table->decimal('output_kg', 12, 2)->nullable(); // Finished rice output (filled when completed)
            $table->decimal('husk_kg', 12, 2)->nullable(); // Husk/waste (auto-calculated: input - output)
            $table->decimal('yield_percent', 5, 2)->nullable(); // Yield percentage (auto-calculated: output/input * 100)
            $table->string('operator_name')->nullable();
            $table->enum('status', ['Pending', 'Processing', 'Completed'])->default('Pending');
            $table->date('processing_date'); // Start date of processing
            $table->date('completed_date')->nullable(); // Date when completed
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('processings');
    }
};
