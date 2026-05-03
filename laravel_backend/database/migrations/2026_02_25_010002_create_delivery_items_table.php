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
        Schema::create('delivery_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_assignment_id')->constrained('delivery_assignments')->cascadeOnDelete();
            $table->unsignedBigInteger('product_id'); // References products.product_id
            $table->string('product_name');
            $table->integer('quantity');
            $table->string('unit')->default('kg');
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);
            $table->timestamps();

            $table->foreign('product_id')->references('product_id')->on('products');
            $table->index('delivery_assignment_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('delivery_items');
    }
};
