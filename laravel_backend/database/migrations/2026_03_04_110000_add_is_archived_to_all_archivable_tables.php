<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tables that participate in the two-tier archive system.
     */
    private array $tables = [
        'products',
        'varieties',
        'suppliers',
        'customers',
        'procurements',
        'drying_processes',
        'processings',
        'drivers',
        'delivery_assignments',
        'users',
    ];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            if (Schema::hasTable($table) && !Schema::hasColumn($table, 'is_archived')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->boolean('is_archived')->default(false)->after('status');
                    $t->timestamp('archived_at')->nullable()->after('is_archived');
                    $t->index('is_archived');
                });
            }
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'is_archived')) {
                Schema::table($table, function (Blueprint $t) use ($table) {
                    $t->dropIndex(["{$table}_is_archived_index"]);
                    $t->dropColumn(['is_archived', 'archived_at']);
                });
            }
        }
    }
};
