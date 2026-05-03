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
        Schema::create('stock_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('type', 10); // 'in' or 'out'
            $table->integer('quantity_before')->default(0);
            $table->integer('quantity_change')->default(0);
            $table->integer('quantity_after')->default(0);
            $table->decimal('kg_amount', 12, 2)->nullable(); // kg involved in the transaction
            $table->string('source_type')->nullable(); // e.g. 'processing_distribution', 'order', 'manual_adjustment'
            $table->unsignedBigInteger('source_id')->nullable(); // e.g. processing_id, order_id
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->foreign('product_id')->references('product_id')->on('products')->onDelete('cascade');
            $table->index(['product_id', 'created_at']);
            $table->index('type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_logs');
    }
};
