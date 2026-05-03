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
        Schema::create('appearance_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique(); // Setting key name
            $table->string('value'); // Color hex value or setting value
            $table->string('label'); // Human readable label
            $table->string('description')->nullable(); // Description of the setting
            $table->string('category'); // Category: colors, mode, etc.
            $table->integer('sort_order')->default(0); // For ordering
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('appearance_settings');
    }
};
