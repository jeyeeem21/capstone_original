<?php

namespace App\Mail;

use App\Models\Procurement;
use App\Models\Supplier;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProcurementNotification extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Procurement $procurement, public Supplier $supplier)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: \App\Models\BusinessSetting::getValue('business_name', config('app.name')) . " — New Purchase Order #{$this->procurement->id}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.procurement-notification',
            with: [
                'procurement' => $this->procurement,
                'supplier' => $this->supplier,
            ],
        );
    }
}
