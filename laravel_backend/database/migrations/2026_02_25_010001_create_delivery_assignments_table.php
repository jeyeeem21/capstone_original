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
        Schema::create('delivery_assignments', function (Blueprint $table) {
            $table->id();
            $table->string('delivery_number')->unique(); // DEL-YYYYMMDD-NNN
            $table->foreignId('driver_id')->constrained('drivers')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('destination'); // Full delivery address
            $table->string('contact_person')->nullable();
            $table->string('contact_phone')->nullable();
            $table->date('delivery_date');
            $table->enum('priority', ['Low', 'Normal', 'High', 'Urgent'])->default('Normal');
            $table->enum('status', ['Pending', 'In Transit', 'Delivered', 'Failed', 'Cancelled'])->default('Pending');
            $table->text('notes')->nullable(); // Admin notes
            $table->text('driver_notes')->nullable(); // Driver's notes on delivery
            $table->string('proof_of_delivery')->nullable(); // File path for proof image
            $table->timestamp('picked_up_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('delivery_date');
            $table->index('driver_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('delivery_assignments');
    }
};
