<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('procurement_batches', function (Blueprint $table) {
            $table->id();
            $table->string('batch_number', 30)->unique()->comment('e.g. BATCH-20260222-001');
            $table->foreignId('variety_id')->constrained('varieties')->onDelete('restrict');
            $table->date('season_date')->comment('Harvest/collection date, defaults to creation date');
            // Denormalized totals — updated whenever a procurement joins or leaves
            $table->decimal('total_sacks', 10, 0)->default(0);
            $table->decimal('total_kg', 14, 2)->default(0);
            // Remaining = total minus what has already been sent to drying (batch or individual)
            $table->decimal('remaining_sacks', 10, 0)->default(0);
            $table->decimal('remaining_kg', 14, 2)->default(0);
            $table->enum('status', ['Open', 'Closed', 'Completed'])->default('Open')
                ->comment('Open=accepting procurements, Closed=drying started, Completed=all processed');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('variety_id');
            $table->index('status');
            $table->index('season_date');
            $table->index('batch_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_batches');
    }
};
