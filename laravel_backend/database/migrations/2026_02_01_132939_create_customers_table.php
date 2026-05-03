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
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Business name
            $table->string('contact'); // Contact person
            $table->string('phone');
            $table->string('email')->unique(); // Unique email validation
            $table->text('address');
            $table->enum('status', ['Active', 'Inactive'])->default('Active');
            $table->integer('orders')->default(0); // Track total orders
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
