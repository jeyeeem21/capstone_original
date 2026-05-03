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
        Schema::create('drying_processes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('procurement_id')->constrained('procurements')->onDelete('cascade');
            $table->decimal('quantity_kg', 12, 2)->default(0)->comment('Quantity taken from procurement');
            $table->decimal('quantity_out', 12, 2)->default(0)->comment('Quantity sent to processing');
            $table->integer('days')->default(0)->comment('Number of drying days');
            $table->decimal('price_per_day', 12, 2)->default(0)->comment('Drying cost per day');
            $table->decimal('total_price', 14, 2)->default(0)->comment('price_per_day * days');
            $table->enum('status', ['Drying', 'Dried', 'Cancelled'])->default('Drying');
            $table->timestamps();
            $table->softDeletes();

            $table->index('procurement_id');
            $table->index('status');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('drying_processes');
    }
};
