<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ProfileUpdateNotification extends Mailable
{
    use Queueable, SerializesModels;

    public $userName;
    public $changes;
    public $ipAddress;

    public function __construct($userName, $changes, $ipAddress)
    {
        $this->userName = $userName;
        $this->changes = $changes;
        $this->ipAddress = $ipAddress;
    }

    public function build()
    {
        return $this->subject('Profile Updated')
                    ->view('emails.profile-update-notification');
    }
}
