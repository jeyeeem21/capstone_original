@extends('emails.layout')

@section('title', 'Email Verification')

@section('content')
<h2>Email Verification Code</h2>
<p>Hello{{ $name ? ' ' . $name : '' }},</p>
<p>Your {{ \App\Models\BusinessSetting::getValue('business_name', config('app.name')) }} email verification code is:</p>

<div style="text-align: center; margin: 24px 0;">
    <div style="display: inline-block; background: #1a5632; color: #fff; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 16px 32px; border-radius: 8px;">
        {{ $code }}
    </div>
</div>

<p>This code will expire in <strong>15 minutes</strong>.</p>
@if($name)
<p>Please enter this code to verify your email address and activate your account. You will not be able to log in until your email is verified.</p>
@else
<p>If you did not request this verification, please ignore this email.</p>
@endif
@endsection
