<?php

namespace App\Mail;

use App\Models\Sale;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DeliveryAssigned extends Mailable
{
    use Queueable, SerializesModels;

    public string $driverName;

    public function __construct(public Sale $sale, string $driverName)
    {
        $this->driverName = $driverName;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "New Delivery Assignment — Order #{$this->sale->transaction_id}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.delivery-assigned',
            with: [
                'sale' => $this->sale,
                'driverName' => $this->driverName,
            ],
        );
    }
}
