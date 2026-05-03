<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\BusinessSetting;

class SyncSuperAdminEmail extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'admin:sync-email';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync super admin email with business email';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $businessEmail = BusinessSetting::getValue('business_email');
        $superAdmin = User::where('role', 'super_admin')->first();

        if (!$superAdmin) {
            $this->error('Super admin user not found!');
            return 1;
        }

        if (!$businessEmail) {
            $this->error('Business email not set!');
            return 1;
        }

        $oldEmail = $superAdmin->email;
        
        if ($oldEmail === $businessEmail) {
            $this->info('Super admin email is already synced with business email: ' . $businessEmail);
            return 0;
        }

        $superAdmin->update(['email' => $businessEmail]);

        $this->info('✓ Super admin email updated successfully!');
        $this->line('  Old email: ' . $oldEmail);
        $this->line('  New email: ' . $businessEmail);

        return 0;
    }
}
