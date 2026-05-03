<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WelcomeAccount extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public User $user)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Welcome to ' . \App\Models\BusinessSetting::getValue('business_name', config('app.name')) . '!',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.welcome-account',
            with: ['user' => $this->user],
        );
    }
}
