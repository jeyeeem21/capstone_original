@extends('emails.layout')

@section('title', 'Your Order Has Been Placed')

@section('content')
<h2>Order Confirmation</h2>
<p>Hello {{ $sale->customer?->name ?? 'Valued Customer' }},</p>
<p>Your order has been placed successfully! Here are the details:</p>

<table class="info-table">
    <tr>
        <th>Order #</th>
        <td>{{ $sale->transaction_id }}</td>
    </tr>
    <tr>
        <th>Total Amount</th>
        <td><strong>₱{{ number_format($sale->total, 2) }}</strong></td>
    </tr>
    <tr>
        <th>Payment Method</th>
        <td>{{ ucfirst(str_replace('_', ' ', $sale->payment_method ?? 'N/A')) }}</td>
    </tr>
    <tr>
        <th>Payment Status</th>
        <td>
            @if($sale->payment_status === 'paid')
                <span class="badge badge-success">Paid</span>
            @else
                <span class="badge badge-warning">{{ ucfirst(str_replace('_', ' ', $sale->payment_status ?? 'Not Paid')) }}</span>
            @endif
        </td>
    </tr>
    @if($sale->delivery_address)
    <tr>
        <th>Delivery Address</th>
        <td>{{ $sale->delivery_address }}</td>
    </tr>
    @endif
    <tr>
        <th>Status</th>
        <td><span class="badge badge-warning">{{ ucfirst($sale->status) }}</span></td>
    </tr>
    <tr>
        <th>Date</th>
        <td>{{ $sale->created_at->format('M d, Y h:i A') }}</td>
    </tr>
</table>

@if(!empty($sale->payment_proof) && is_array($sale->payment_proof))
<h3 style="margin-top: 20px;">Payment Proof</h3>
<div>
    @foreach($sale->payment_proof as $proof)
        @php $proofPath = storage_path('app/public/' . $proof); @endphp
        @if(file_exists($proofPath))
            <img src="{{ $message->embed($proofPath) }}" alt="Payment Proof" style="max-width: 300px; max-height: 200px; border-radius: 8px; margin: 5px 0; border: 1px solid #ddd;" />
        @endif
    @endforeach
</div>
@endif

<p>We will notify you when your order status is updated. Thank you for choosing {{ \App\Models\BusinessSetting::getValue('business_name', config('app.name')) }}!</p>
@endsection
