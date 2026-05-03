<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;

class SetEmailChangePending extends Command
{
    protected $signature = 'user:set-email-pending';
    protected $description = 'Set email_change_pending flag for super admin';

    public function handle()
    {
        $superAdmin = User::where('role', 'super_admin')->first();
        
        if ($superAdmin) {
            $superAdmin->update([
                'email_change_pending' => true,
                'email_changed_at' => now(),
            ]);
            $this->info('Email change pending flag set for super admin: ' . $superAdmin->email);
        } else {
            $this->warn('Super admin not found.');
        }

        return 0;
    }
}
