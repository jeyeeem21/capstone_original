@extends('emails.layout')

@section('title', 'Password Reset')

@section('content')
<h2>Password Reset Code</h2>
<p>Hello {{ $name }},</p>
<p>We received a request to reset your password for your {{ \App\Models\BusinessSetting::getValue('business_name', config('app.name')) }} account.</p>

<div style="text-align: center; margin: 24px 0;">
    <div style="display: inline-block; background: #1a5632; color: #fff; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 16px 32px; border-radius: 8px;">
        {{ $code }}
    </div>
</div>

<p>This code will expire in <strong>15 minutes</strong>.</p>
<p>If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>

<div style="margin-top: 24px; padding: 12px 16px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
    <p style="margin: 0; font-size: 13px; color: #856404;">
        <strong>Security Tip:</strong> Never share this code with anyone. Our team will never ask you for this code.
    </p>
</div>
@endsection
