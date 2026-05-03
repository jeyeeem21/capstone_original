<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetCode extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public string $code, public string $name)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: \App\Models\BusinessSetting::getValue('business_name', config('app.name')) . ' — Password Reset Code',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.password-reset-code',
            with: [
                'code' => $this->code,
                'name' => $this->name,
            ],
        );
    }
}
