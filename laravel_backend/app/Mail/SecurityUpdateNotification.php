<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SecurityUpdateNotification extends Mailable
{
    use Queueable, SerializesModels;

    public $userName;
    public $updateType;
    public $ipAddress;

    public function __construct($userName, $updateType, $ipAddress)
    {
        $this->userName = $userName;
        $this->updateType = $updateType;
        $this->ipAddress = $ipAddress;
    }

    public function build()
    {
        return $this->subject('Security Update: ' . $this->updateType)
                    ->view('emails.security-update-notification');
    }
}
