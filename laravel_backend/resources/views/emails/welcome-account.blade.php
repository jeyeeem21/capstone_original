@extends('emails.layout')

@section('title', 'Welcome to ' . \App\Models\BusinessSetting::getValue('business_name', config('app.name')))

@section('content')
<h2>Welcome, {{ $user->name }}!</h2>
<p>Your account has been successfully created at <strong>{{ \App\Models\BusinessSetting::getValue('business_name', config('app.name')) }}</strong>.</p>

<table class="info-table">
    <tr>
        <th>Name</th>
        <td>{{ $user->name }}</td>
    </tr>
    <tr>
        <th>Email</th>
        <td>{{ $user->email }}</td>
    </tr>
    <tr>
        <th>Role</th>
        <td><span class="badge badge-primary">{{ ucfirst(str_replace('_', ' ', $user->role)) }}</span></td>
    </tr>
</table>

<p>You can now log in to your account using your email and the password that was set during registration.</p>

<p>If you have any questions, feel free to contact us.</p>
@endsection
