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
        Schema::table('processings', function (Blueprint $table) {
            // Add indexes for faster queries
            $table->index('status'); // For filtering by status
            $table->index('processing_date'); // For date filtering
            $table->index('completed_date'); // For date filtering
            $table->index('created_at'); // For sorting
            $table->index(['status', 'created_at']); // Composite for active queries
            $table->index(['status', 'completed_date']); // Composite for completed queries
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('processings', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['processing_date']);
            $table->dropIndex(['completed_date']);
            $table->dropIndex(['created_at']);
            $table->dropIndex(['status', 'created_at']);
            $table->dropIndex(['status', 'completed_date']);
        });
    }
};
