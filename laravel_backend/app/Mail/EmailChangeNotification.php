<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class EmailChangeNotification extends Mailable
{
    use Queueable, SerializesModels;

    public $oldEmail;
    public $newEmail;
    public $userName;
    public $ipAddress;

    public function __construct($oldEmail, $newEmail, $userName, $ipAddress)
    {
        $this->oldEmail = $oldEmail;
        $this->newEmail = $newEmail;
        $this->userName = $userName;
        $this->ipAddress = $ipAddress;
    }

    public function build()
    {
        return $this->subject('Email Address Changed')
                    ->view('emails.email-change-notification');
    }
}
