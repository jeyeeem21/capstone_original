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
        Schema::create('website_contents', function (Blueprint $table) {
            $table->id();
            $table->string('page')->index(); // 'home' or 'about'
            $table->string('section'); // e.g., 'hero', 'stats', 'features', 'testimonials', 'mission', 'vision', 'values', 'timeline', 'team'
            $table->string('key'); // e.g., 'heroTitle', 'heroSubtitle', or index for array items
            $table->text('value')->nullable(); // The actual content value
            $table->json('meta')->nullable(); // Additional metadata (for items with multiple fields like features)
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Composite unique index
            $table->unique(['page', 'section', 'key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('website_contents');
    }
};
