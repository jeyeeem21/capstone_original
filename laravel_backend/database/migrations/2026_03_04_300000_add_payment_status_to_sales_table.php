<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('payment_status', 20)->default('paid')->after('payment_method');
            $table->text('payment_proof')->nullable()->after('reference_number');
            $table->timestamp('paid_at')->nullable()->after('payment_proof');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['payment_status', 'payment_proof', 'paid_at']);
        });
    }
};
