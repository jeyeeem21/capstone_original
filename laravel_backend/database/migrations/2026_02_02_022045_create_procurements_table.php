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
        // Drop old table if exists (it uses different column names)
        Schema::dropIfExists('procurement');
        
        Schema::create('procurements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_id')->constrained('suppliers')->onDelete('cascade');
            $table->decimal('quantity_kg', 12, 2)->default(0);
            $table->decimal('quantity_out', 12, 2)->default(0)->comment('Quantity sent to processing (raw material used)');
            $table->decimal('price_per_kg', 12, 2)->default(0);
            $table->text('description')->nullable();
            $table->decimal('total_cost', 14, 2)->default(0);
            $table->enum('status', ['Pending', 'Completed', 'Cancelled'])->default('Pending');
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes for optimization
            $table->index('supplier_id');
            $table->index('status');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('procurements');
    }
};
