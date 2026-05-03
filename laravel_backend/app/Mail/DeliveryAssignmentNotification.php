<?php

namespace App\Mail;

use App\Models\DeliveryAssignment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DeliveryAssignmentNotification extends Mailable
{
    use Queueable, SerializesModels;

    public string $driverName;

    public function __construct(public DeliveryAssignment $delivery, string $driverName)
    {
        $this->driverName = $driverName;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "New Delivery Assignment — {$this->delivery->delivery_number}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.delivery-assignment-notification',
            with: [
                'delivery' => $this->delivery,
                'driverName' => $this->driverName,
            ],
        );
    }
}
