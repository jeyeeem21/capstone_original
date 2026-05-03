<?php

namespace App\Jobs;

use App\Models\BusinessSetting;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Number of times the job may be attempted.
     */
    public int $tries = 2;

    /**
     * Seconds to wait before retrying.
     */
    public int $backoff = 10;

    /**
     * Seconds before the job times out.
     */
    public int $timeout = 30;

    public function __construct(
        public string $to,
        public Mailable $mailable,
    ) {}

    public function handle(): void
    {
        try {
            $password = BusinessSetting::getValue('smtp_password');
            $email    = BusinessSetting::getValue('business_email');

            if (!$email || !$password) {
                Log::info("SendEmail job skipped (SMTP not configured): {$this->to}");
                return;
            }

            config([
                'mail.default'                    => 'smtp',
                'mail.mailers.smtp.host'          => 'smtp.gmail.com',
                'mail.mailers.smtp.port'          => 587,
                'mail.mailers.smtp.username'      => $email,
                'mail.mailers.smtp.password'      => $password,
                'mail.mailers.smtp.encryption'    => 'tls',
            ]);

            Mail::purge('smtp');

            $fromName = BusinessSetting::getValue('business_name', config('app.name'));
            $this->mailable->from($email, $fromName);

            Mail::to($this->to)->send($this->mailable);

            Log::info("Email sent to {$this->to}");
        } catch (\Exception $e) {
            Log::warning("SendEmail job failed for {$this->to}: " . $e->getMessage());
            throw $e; // Re-throw so the queue can retry
        }
    }

    /**
     * Dispatch a SendEmail job and automatically trigger a background queue worker.
     * This ensures emails are processed without running a separate queue:work terminal.
     */
    public static function dispatchAndProcess(string $to, Mailable $mailable): void
    {
        // Save to database queue instantly (no blocking)
        static::dispatch($to, $mailable)->onQueue('emails');

        // Spawn a background PHP process to work the queue — completely non-blocking
        static::triggerQueueWorker();
    }

    /**
     * Fire a detached background process to process one batch of queued emails.
     */
    private static function triggerQueueWorker(): void
    {
        try {
            $php = PHP_BINARY ?: 'php';
            $artisan = base_path('artisan');

            if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                // Windows: start /B runs a detached background process
                pclose(popen("start /B \"\" \"{$php}\" \"{$artisan}\" queue:work --queue=emails --stop-when-empty --tries=2 --timeout=30 > NUL 2>&1", 'r'));
            } else {
                // Linux/Mac: & runs in background, nohup keeps it alive
                exec("nohup \"{$php}\" \"{$artisan}\" queue:work --queue=emails --stop-when-empty --tries=2 --timeout=30 > /dev/null 2>&1 &");
            }
        } catch (\Exception $e) {
            Log::warning('Failed to spawn queue worker: ' . $e->getMessage());
        }
    }
}
