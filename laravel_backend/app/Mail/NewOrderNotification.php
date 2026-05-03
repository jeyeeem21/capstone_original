<?php

namespace App\Mail;

use App\Models\Sale;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NewOrderNotification extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Sale $sale)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "New Order #{$this->sale->transaction_id} — ₱" . number_format($this->sale->total, 2),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.new-order',
            with: ['sale' => $this->sale],
        );
    }
}
