<?php

namespace App\Mail;

use App\Models\Sale;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OrderStatusUpdate extends Mailable
{
    use Queueable, SerializesModels;

    public string $heading;
    public string $body;
    public string $statusBadge;

    public function __construct(public Sale $sale, string $heading, string $body)
    {
        $this->heading = $heading;
        $this->body = $body;
        $this->statusBadge = match ($sale->status) {
            'processing' => 'badge-info',
            'shipped' => 'badge-primary',
            'delivered', 'completed' => 'badge-success',
            'cancelled' => 'badge-danger',
            default => 'badge-warning',
        };
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Order #{$this->sale->transaction_id} — " . ucfirst(str_replace('_', ' ', $this->sale->status)),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.order-status',
            with: [
                'sale' => $this->sale,
                'heading' => $this->heading,
                'body' => $this->body,
                'statusBadge' => $this->statusBadge,
            ],
        );
    }
}
