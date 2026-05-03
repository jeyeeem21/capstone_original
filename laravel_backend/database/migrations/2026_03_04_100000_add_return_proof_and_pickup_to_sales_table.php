<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->text('return_proof')->nullable()->after('return_notes');
            $table->string('return_pickup_driver')->nullable()->after('return_proof');
            $table->string('return_pickup_plate', 20)->nullable()->after('return_pickup_driver');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['return_proof', 'return_pickup_driver', 'return_pickup_plate']);
        });
    }
};
