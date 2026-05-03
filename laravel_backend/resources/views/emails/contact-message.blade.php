@extends('emails.layout')

@section('title', 'New Contact Message')

@section('content')
<h2 style="margin:0 0 16px;font-size:20px;">New Contact Message</h2>

<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
        <td style="padding:8px 12px;font-weight:600;color:#6b7280;width:120px;">Name</td>
        <td style="padding:8px 12px;">{{ $msg->name }}</td>
    </tr>
    <tr>
        <td style="padding:8px 12px;font-weight:600;color:#6b7280;">Email</td>
        <td style="padding:8px 12px;"><a href="mailto:{{ $msg->email }}">{{ $msg->email }}</a></td>
    </tr>
    @if($msg->phone)
    <tr>
        <td style="padding:8px 12px;font-weight:600;color:#6b7280;">Phone</td>
        <td style="padding:8px 12px;">{{ $msg->phone }}</td>
    </tr>
    @endif
    @if($msg->company)
    <tr>
        <td style="padding:8px 12px;font-weight:600;color:#6b7280;">Company</td>
        <td style="padding:8px 12px;">{{ $msg->company }}</td>
    </tr>
    @endif
    <tr>
        <td style="padding:8px 12px;font-weight:600;color:#6b7280;">Subject</td>
        <td style="padding:8px 12px;">{{ $msg->subject }}</td>
    </tr>
    <tr>
        <td style="padding:8px 12px;font-weight:600;color:#6b7280;">Inquiry Type</td>
        <td style="padding:8px 12px;">{{ ucfirst(str_replace('_', ' ', $msg->inquiry_type)) }}</td>
    </tr>
</table>

<div style="background:#f9fafb;border-radius:8px;padding:16px;border:1px solid #e5e7eb;">
    <p style="margin:0 0 8px;font-weight:600;color:#6b7280;font-size:13px;">Message</p>
    <p style="margin:0;white-space:pre-wrap;">{{ $msg->message }}</p>
</div>

<p style="margin-top:24px;font-size:13px;color:#9ca3af;">
    You can reply directly to this email to respond to the sender.
</p>
@endsection
