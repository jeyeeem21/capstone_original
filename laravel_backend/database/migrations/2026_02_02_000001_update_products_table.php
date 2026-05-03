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
        // Drop old table and recreate with new structure
        Schema::dropIfExists('products');
        
        Schema::create('products', function (Blueprint $table) {
            $table->id('product_id');
            $table->string('product_name');
            $table->foreignId('category_id')->constrained('categories')->onDelete('cascade');
            $table->decimal('price', 10, 2)->default(0);
            $table->integer('stocks')->default(0);
            $table->string('unit')->default('kg');
            $table->decimal('weight', 10, 2)->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->boolean('is_deleted')->default(false);
            $table->timestamps();
            
            // Indexes for faster queries
            $table->index('category_id');
            $table->index('status');
            $table->index('is_deleted');
            $table->index(['is_deleted', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
