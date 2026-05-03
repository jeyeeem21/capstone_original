@extends('emails.layout')

@section('title', 'Delivery Assignment')

@section('content')
@php
    $isReturn = in_array($sale->status, ['picking_up', 'picked_up', 'returned', 'return_requested']);
@endphp

<h2>{{ $isReturn ? 'Return Pickup Assigned' : 'New Delivery Assigned' }}</h2>
<p>Hello {{ $driverName }},</p>
<p>{{ $isReturn ? 'You have been assigned a return pickup.' : 'You have been assigned a new delivery.' }} Here are the details:</p>

<table class="info-table">
    <tr>
        <th>Order #</th>
        <td>{{ $sale->transaction_id }}</td>
    </tr>
    <tr>
        <th>Customer</th>
        <td>{{ $sale->customer?->name ?? 'N/A' }}</td>
    </tr>
    @if($sale->delivery_address)
    <tr>
        <th>{{ $isReturn ? 'Pickup Address' : 'Delivery Address' }}</th>
        <td>{{ $sale->delivery_address }}</td>
    </tr>
    @endif
    @if($isReturn && $sale->return_pickup_date)
    <tr>
        <th>Pickup Date</th>
        <td>{{ \Carbon\Carbon::parse($sale->return_pickup_date)->format('M d, Y') }}</td>
    </tr>
    @endif
    @if(!$isReturn && $sale->payment_method === 'cod')
    <tr>
        <th>Payment Method</th>
        <td>Cash on Delivery</td>
    </tr>
    @endif
    <tr>
        <th>Assigned At</th>
        <td>{{ now()->format('M d, Y h:i A') }}</td>
    </tr>
</table>

@if($sale->items && $sale->items->count() > 0)
<h3 style="margin-top: 20px;">Products</h3>
<table class="info-table">
    <thead>
        <tr>
            <th>Product</th>
            <th>Variety</th>
            <th>Weight</th>
            <th>Qty</th>
        </tr>
    </thead>
    <tbody>
        @foreach($sale->items as $item)
        <tr>
            <td>{{ $item->product?->product_name ?? 'Product' }}</td>
            <td>{{ $item->product?->variety?->name ?? '—' }}</td>
            <td>{{ $item->product?->weight ? $item->product->weight . ' kg' : '—' }}</td>
            <td>{{ $item->quantity }} {{ $item->product?->unit ?? 'sack' }}</td>
        </tr>
        @endforeach
    </tbody>
</table>
@endif

<p>{{ $isReturn ? 'Please pick up the return order promptly.' : 'Please make sure to deliver the order promptly.' }}</p>
@endsection
