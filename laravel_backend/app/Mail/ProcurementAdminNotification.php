<?php

namespace App\Mail;

use App\Models\Procurement;
use App\Models\BusinessSetting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProcurementAdminNotification extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Procurement $procurement)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: BusinessSetting::getValue('business_name', config('app.name')) . " — New Palay Purchase #{$this->procurement->id}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.procurement-admin-notification',
            with: [
                'procurement' => $this->procurement,
            ],
        );
    }
}
