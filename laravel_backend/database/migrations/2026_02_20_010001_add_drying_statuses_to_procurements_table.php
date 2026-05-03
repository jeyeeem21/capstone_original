<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Add 'Drying' and 'Dried' to procurement status enum
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE procurements MODIFY COLUMN status ENUM('Pending', 'Drying', 'Dried', 'Completed', 'Cancelled') DEFAULT 'Pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE procurements MODIFY COLUMN status ENUM('Pending', 'Completed', 'Cancelled') DEFAULT 'Pending'");
    }
};
