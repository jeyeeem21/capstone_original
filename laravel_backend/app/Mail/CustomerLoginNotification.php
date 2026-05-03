<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CustomerLoginNotification extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $ipAddress,
        public string $businessName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Login Alert — ' . $this->businessName);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.customer-login-notification',
            with: [
                'user'      => $this->user,
                'ipAddress' => $this->ipAddress,
            ]
        );
    }
}
