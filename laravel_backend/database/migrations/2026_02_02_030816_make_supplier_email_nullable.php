<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            // Make email nullable to allow suppliers without email
            $table->string('email')->nullable()->change();
            // Make other optional fields nullable too
            $table->string('contact')->nullable()->change();
            $table->string('phone')->nullable()->change();
            $table->text('address')->nullable()->change();
        });

        // Update existing empty strings to null
        DB::table('suppliers')->where('email', '')->update(['email' => null]);
        DB::table('suppliers')->where('contact', '')->update(['contact' => null]);
        DB::table('suppliers')->where('phone', '')->update(['phone' => null]);
        DB::table('suppliers')->where('address', '')->update(['address' => null]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('email')->nullable(false)->change();
            $table->string('contact')->nullable(false)->change();
            $table->string('phone')->nullable(false)->change();
            $table->text('address')->nullable(false)->change();
        });
    }
};
