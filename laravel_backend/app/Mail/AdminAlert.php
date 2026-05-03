<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AdminAlert extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $heading,
        public string $body,
        public string $businessName = '',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subject ?: $this->heading);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.admin-alert',
            with: [
                'heading' => $this->heading,
                'body'    => $this->body,
            ]
        );
    }
}
