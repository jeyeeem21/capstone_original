<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class LoginNotification extends Mailable
{
    use Queueable, SerializesModels;

    public string $ipAddress;

    public function __construct(public User $user, string $ipAddress)
    {
        $this->ipAddress = $ipAddress;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Login Alert: {$this->user->name} ({$this->user->role})",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.login-notification',
            with: [
                'user' => $this->user,
                'ipAddress' => $this->ipAddress,
            ],
        );
    }
}
