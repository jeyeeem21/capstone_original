<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Stores per-user preferences for both clients and staff.
     * Each user can set their own dark/light mode, font family, and font size.
     */
    public function up(): void
    {
        Schema::create('user_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('theme_mode', ['light', 'dark'])->default('light');
            $table->string('font_family', 100)->default('Inter');
            $table->unsignedTinyInteger('font_size')->default(14); // base font size in px
            $table->timestamps();

            $table->unique('user_id'); // one preference record per user
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_preferences');
    }
};
