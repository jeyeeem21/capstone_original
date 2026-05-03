<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\BusinessSetting;

class ClearSmtpPassword extends Command
{
    protected $signature = 'smtp:clear';
    protected $description = 'Clear SMTP password from business settings';

    public function handle()
    {
        $setting = BusinessSetting::where('key', 'smtp_password')->first();
        
        if ($setting) {
            $setting->update(['value' => '']);
            $this->info('SMTP password cleared successfully.');
        } else {
            $this->warn('SMTP password setting not found.');
        }

        return 0;
    }
}
