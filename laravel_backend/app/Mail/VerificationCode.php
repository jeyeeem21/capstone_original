<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class VerificationCode extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public string $code, public ?string $name = null)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: \App\Models\BusinessSetting::getValue('business_name', config('app.name')) . ' — Email Verification Code',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.verification-code',
            with: [
                'code' => $this->code,
                'name' => $this->name,
            ],
        );
    }
}