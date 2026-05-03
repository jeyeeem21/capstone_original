@extends('emails.layout')

@section('title', 'Login Alert')

@section('content')
<h2>Login Alert</h2>
<p>Hi <strong>{{ $user->name }}</strong>,</p>
<p>We detected a new login to your account. If this was you, no action is needed.</p>

<table class="info-table">
    <tr>
        <th>Account</th>
        <td>{{ $user->email }}</td>
    </tr>
    <tr>
        <th>IP Address</th>
        <td>{{ $ipAddress }}</td>
    </tr>
    <tr>
        <th>Date &amp; Time</th>
        <td>{{ now()->setTimezone('Asia/Manila')->format('M d, Y h:i A') }} (PHT)</td>
    </tr>
</table>

<p>If you did <strong>not</strong> log in, please contact us immediately so we can secure your account.</p>
@endsection
