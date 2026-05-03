@extends('emails.layout')

@section('title', 'Delivery Assignment')

@section('content')
<h2>New Delivery Assigned</h2>
<p>Hello {{ $driverName }},</p>
<p>You have been assigned a new delivery. Here are the details:</p>

<table class="info-table">
    <tr>
        <th>Delivery #</th>
        <td>{{ $delivery->delivery_number }}</td>
    </tr>
    <tr>
        <th>Destination</th>
        <td>{{ $delivery->destination }}</td>
    </tr>
    @if($delivery->contact_person)
    <tr>
        <th>Contact Person</th>
        <td>{{ $delivery->contact_person }}</td>
    </tr>
    @endif
    @if($delivery->contact_phone)
    <tr>
        <th>Contact Phone</th>
        <td>{{ $delivery->contact_phone }}</td>
    </tr>
    @endif
    <tr>
        <th>Delivery Date</th>
        <td>{{ $delivery->delivery_date ? $delivery->delivery_date->format('M d, Y') : 'TBD' }}</td>
    </tr>
    <tr>
        <th>Priority</th>
        <td>{{ $delivery->priority }}</td>
    </tr>
    @if($delivery->customer)
    <tr>
        <th>Customer</th>
        <td>{{ $delivery->customer->name }}</td>
    </tr>
    @endif
    <tr>
        <th>Assigned At</th>
        <td>{{ now()->format('M d, Y h:i A') }}</td>
    </tr>
</table>

@if($delivery->items && $delivery->items->count() > 0)
<h3 style="margin-top: 20px;">Items</h3>
<table class="info-table">
    <thead>
        <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit</th>
        </tr>
    </thead>
    <tbody>
        @foreach($delivery->items as $item)
        <tr>
            <td>{{ $item->product_name ?? 'Product' }}</td>
            <td>{{ $item->quantity }}</td>
            <td>{{ $item->unit }}</td>
        </tr>
        @endforeach
    </tbody>
</table>
@endif

@if($delivery->notes)
<p><strong>Notes:</strong> {{ $delivery->notes }}</p>
@endif

<p>Please make sure to deliver promptly. You can view your deliveries in your driver portal.</p>
@endsection
