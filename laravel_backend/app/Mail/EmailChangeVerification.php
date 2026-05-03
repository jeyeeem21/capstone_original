<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class EmailChangeVerification extends Mailable
{
    use Queueable, SerializesModels;

    public $code;
    public $newEmail;
    public $userName;

    public function __construct($code, $newEmail, $userName)
    {
        $this->code = $code;
        $this->newEmail = $newEmail;
        $this->userName = $userName;
    }

    public function build()
    {
        return $this->subject('Verify Your New Email Address')
                    ->view('emails.email-change-verification');
    }
}
