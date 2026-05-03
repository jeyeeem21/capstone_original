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
        Schema::create('drivers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('contact')->nullable();
            $table->string('phone');
            $table->string('email')->unique();
            $table->string('license_number')->unique();
            $table->string('vehicle_type')->nullable(); // Truck, Van, Motorcycle
            $table->string('plate_number')->nullable();
            $table->string('address')->nullable();
            $table->enum('status', ['Active', 'Inactive', 'On Leave'])->default('Active');
            $table->integer('total_deliveries')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('email');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('drivers');
    }
};
