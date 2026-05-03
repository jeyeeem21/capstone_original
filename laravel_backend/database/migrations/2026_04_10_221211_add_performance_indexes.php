<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Users: index on role for customer lookups 
        Schema::table('users', function (Blueprint $table) {
            $table->index('role', 'users_role_index');
            $table->index(['role', 'email'], 'users_role_email_index');
        });

        // Sales: driver lookups for driver portal
        Schema::table('sales', function (Blueprint $table) {
            $table->index('driver_name', 'sales_driver_name_index');
        });

        // Audit trails: composite for common filter pattern
        Schema::table('audit_trails', function (Blueprint $table) {
            $table->index(['module', 'action', 'created_at'], 'audit_trails_module_action_created_index');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_role_index');
            $table->dropIndex('users_role_email_index');
        });
        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex('sales_driver_name_index');
        });
        Schema::table('audit_trails', function (Blueprint $table) {
            $table->dropIndex('audit_trails_module_action_created_index');
        });
    }
};
