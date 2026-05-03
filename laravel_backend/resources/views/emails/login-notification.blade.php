@extends('emails.layout')

@section('title', 'Login Notification')

@section('content')
<h2>Account Login Detected</h2>
<p>A user has logged into the system. Here are the details:</p>

<table class="info-table">
    <tr>
        <th>User</th>
        <td>{{ $user->name }}</td>
    </tr>
    <tr>
        <th>Email</th>
        <td>{{ $user->email }}</td>
    </tr>
    <tr>
        <th>Role</th>
        <td><span class="badge badge-info">{{ ucfirst(str_replace('_', ' ', $user->role)) }}</span></td>
    </tr>
    <tr>
        <th>IP Address</th>
        <td>{{ $ipAddress }}</td>
    </tr>
    <tr>
        <th>Time</th>
        <td>{{ now()->format('M d, Y h:i A') }}</td>
    </tr>
</table>

<p>If this login was not expected, please review account security immediately.</p>
@endsection
