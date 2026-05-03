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
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Business/Company name
            $table->string('contact'); // Contact person
            $table->string('phone'); // Same format as customer: +63XXXXXXXXXX or 09XXXXXXXXX
            $table->string('email')->unique(); // Same validation as customer
            $table->text('address');
            $table->enum('status', ['Active', 'Inactive'])->default('Active');
            $table->integer('products')->default(0); // Number of products supplied
            $table->timestamps();
            $table->softDeletes(); // deleted_at column for soft delete
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
