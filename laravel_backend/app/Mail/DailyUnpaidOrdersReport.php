<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

class DailyUnpaidOrdersReport extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Collection $unpaidOrders,
        public float $totalUnpaid
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Daily Report: ' . $this->unpaidOrders->count() . ' Unpaid Order(s) — ₱' . number_format($this->totalUnpaid, 2),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.daily-unpaid-orders',
            with: [
                'unpaidOrders' => $this->unpaidOrders,
                'totalUnpaid' => $this->totalUnpaid,
            ],
        );
    }
}
