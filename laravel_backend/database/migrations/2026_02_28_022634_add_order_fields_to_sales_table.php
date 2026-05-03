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
        Schema::table('sales', function (Blueprint $table) {
            $table->string('delivery_address')->nullable()->after('notes');
            $table->string('return_reason')->nullable()->after('delivery_address');
            $table->text('return_notes')->nullable()->after('return_reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['delivery_address', 'return_reason', 'return_notes']);
        });
    }
};
