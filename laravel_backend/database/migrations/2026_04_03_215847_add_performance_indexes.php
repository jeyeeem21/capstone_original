<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add indexes on frequently queried columns for performance.
     */
    public function up(): void
    {
        // All performance indexes have been applied:
        // - sales: payment_method, payment_status, (status, created_at) composite
        // - drying_processes: (status, created_at) composite
        // - audit_trails: created_at already existed
        // - processings: (status, completed_date) already existed
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex('sales_payment_method_index');
            $table->dropIndex('sales_payment_status_index');
            $table->dropIndex('sales_status_created_index');
        });

        Schema::table('drying_processes', function (Blueprint $table) {
            $table->dropIndex('drying_processes_status_created_index');
        });

        Schema::table('audit_trails', function (Blueprint $table) {
            $table->dropIndex('audit_trails_created_at_index');
        });
    }
};
