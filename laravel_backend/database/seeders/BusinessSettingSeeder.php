<?php

namespace Database\Seeders;

use App\Models\BusinessSetting;
use Illuminate\Database\Seeder;

class BusinessSettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            ['key' => 'business_name',        'value' => 'KJP Ricemill',                          'type' => 'string'],
            ['key' => 'business_tagline',      'value' => 'Your trusted partner in quality rice processing and distribution.', 'type' => 'string'],
            ['key' => 'business_email',        'value' => 'jmpagaran24@gmail.com',                 'type' => 'string'],
            ['key' => 'business_phone',        'value' => '+63 917-123-4567',                      'type' => 'string'],
            ['key' => 'business_address',      'value' => 'Calapan City, Oriental Mindoro, Philippines', 'type' => 'string'],
            ['key' => 'business_open_days',    'value' => 'Mon - Sat',                             'type' => 'string'],
            ['key' => 'business_open_time',    'value' => '07:00',                                 'type' => 'string'],
            ['key' => 'business_close_time',   'value' => '18:00',                                 'type' => 'string'],
            ['key' => 'business_start_year',   'value' => '2010',                                  'type' => 'number'],

            // SMTP / Gmail App Password
            ['key' => 'smtp_password',         'value' => 'yhivrkjzedsyjirn',                      'type' => 'string'],

            // Footer
            ['key' => 'footer_tagline',        'value' => 'Your trusted partner in quality rice processing and distribution.', 'type' => 'string'],
            ['key' => 'footer_copyright',      'value' => '© ' . date('Y') . ' KJP Ricemill. All rights reserved.', 'type' => 'string'],
            ['key' => 'footer_powered_by',     'value' => 'Powered by XianFire Framework. Built at Mindoro State University', 'type' => 'string'],
            ['key' => 'footer_badge1',         'value' => 'Premium Quality',                       'type' => 'string'],
            ['key' => 'footer_badge2',         'value' => 'ISO Certified',                         'type' => 'string'],

            // GCash
            ['key' => 'gcash_name',            'value' => 'KJP Ricemill',                          'type' => 'string'],
            ['key' => 'gcash_number',          'value' => '09278067324',                           'type' => 'string'],

            // Shipping
            ['key' => 'shipping_rate_per_sack','value' => '0',                                     'type' => 'number'],
            ['key' => 'shipping_rate_per_km',  'value' => '0',                                     'type' => 'number'],
            ['key' => 'shipping_base_km',      'value' => '0',                                     'type' => 'number'],
        ];

        foreach ($settings as $setting) {
            BusinessSetting::updateOrCreate(
                ['key' => $setting['key']],
                ['value' => $setting['value'], 'type' => $setting['type']]
            );
        }

        $this->command->info('Business settings seeded (email: jmpagaran24@gmail.com, SMTP configured).');
    }
}

