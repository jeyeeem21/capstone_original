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
        Schema::table('customers', function (Blueprint $table) {
            // Make optional fields nullable to allow quick-add from POS
            $table->string('contact')->nullable()->change();
            $table->string('phone')->nullable()->change();
            $table->string('email')->nullable()->change();
            $table->text('address')->nullable()->change();
        });

        // Update existing empty strings to null
        DB::table('customers')->where('email', '')->update(['email' => null]);
        DB::table('customers')->where('contact', '')->update(['contact' => null]);
        DB::table('customers')->where('phone', '')->update(['phone' => null]);
        DB::table('customers')->where('address', '')->update(['address' => null]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Update nulls back to empty strings first
        DB::table('customers')->whereNull('email')->update(['email' => '']);
        DB::table('customers')->whereNull('contact')->update(['contact' => '']);
        DB::table('customers')->whereNull('phone')->update(['phone' => '']);
        DB::table('customers')->whereNull('address')->update(['address' => '']);

        Schema::table('customers', function (Blueprint $table) {
            $table->string('contact')->nullable(false)->change();
            $table->string('phone')->nullable(false)->change();
            $table->string('email')->nullable(false)->change();
            $table->text('address')->nullable(false)->change();
        });
    }
};
