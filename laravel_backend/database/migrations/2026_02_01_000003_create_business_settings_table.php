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
        Schema::create('business_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->string('type')->default('string'); // string, json, boolean, number
            $table->timestamps();
        });

        // Insert default values
        $defaults = [
            ['key' => 'business_name', 'value' => 'KJP Ricemill', 'type' => 'string'],
            ['key' => 'business_logo', 'value' => '/storage/logos/KJPLogo.png', 'type' => 'string'],
            ['key' => 'business_email', 'value' => 'info@kjpricemill.com', 'type' => 'string'],
            ['key' => 'business_phone', 'value' => '+63 917-123-4567', 'type' => 'string'],
            ['key' => 'business_address', 'value' => 'Calapan City, Oriental Mindoro, Philippines', 'type' => 'string'],
            ['key' => 'business_hours', 'value' => 'Mon-Sat: 7:00 AM - 6:00 PM', 'type' => 'string'],
            ['key' => 'business_open_days', 'value' => 'Monday - Saturday', 'type' => 'string'],
            ['key' => 'business_open_time', 'value' => '07:00', 'type' => 'string'],
            ['key' => 'business_close_time', 'value' => '18:00', 'type' => 'string'],
        ];

        foreach ($defaults as $setting) {
            \DB::table('business_settings')->insert([
                'key' => $setting['key'],
                'value' => $setting['value'],
                'type' => $setting['type'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('business_settings');
    }
};
