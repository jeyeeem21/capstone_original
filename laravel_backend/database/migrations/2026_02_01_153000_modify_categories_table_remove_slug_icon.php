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
        Schema::table('categories', function (Blueprint $table) {
            // Remove slug and icon columns
            $table->dropColumn(['slug', 'icon']);
            
            // Make sort_order default to 0
            $table->integer('sort_order')->default(0)->change();
            
            // Make color default
            $table->string('color', 20)->default('#22c55e')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->string('slug')->unique()->nullable()->after('name');
            $table->string('icon', 50)->nullable()->after('description');
            $table->integer('sort_order')->nullable()->change();
            $table->string('color', 20)->nullable()->change();
        });
    }
};
