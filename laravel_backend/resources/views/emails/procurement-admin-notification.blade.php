@extends('emails.layout')

@section('title', 'New Palay Purchase')

@section('content')
<h2>New Palay Purchase</h2>
<p>A new palay purchase has been created. Here are the details:</p>

<table class="info-table">
    <tr>
        <th>Procurement #</th>
        <td>{{ $procurement->id }}</td>
    </tr>
    <tr>
        <th>Supplier</th>
        <td>{{ $procurement->supplier?->name ?? 'N/A' }}</td>
    </tr>
    <tr>
        <th>Variety</th>
        <td>{{ $procurement->variety?->name ?? 'N/A' }}</td>
    </tr>
    <tr>
        <th>Quantity</th>
        <td>{{ number_format($procurement->quantity_kg, 2) }} kg ({{ $procurement->sacks }} sacks)</td>
    </tr>
    <tr>
        <th>Price per KG</th>
        <td>₱{{ number_format($procurement->price_per_kg, 2) }}</td>
    </tr>
    <tr>
        <th>Total Cost</th>
        <td><strong>₱{{ number_format($procurement->total_cost, 2) }}</strong></td>
    </tr>
    <tr>
        <th>Status</th>
        <td><span class="badge badge-info">{{ $procurement->status }}</span></td>
    </tr>
    @if($procurement->description)
    <tr>
        <th>Description</th>
        <td>{{ $procurement->description }}</td>
    </tr>
    @endif
    <tr>
        <th>Date</th>
        <td>{{ $procurement->created_at->format('M d, Y h:i A') }}</td>
    </tr>
</table>

<p>Please review this purchase in the system.</p>
@endsection
