@extends('emails.layout')

@section('title', 'Daily Unpaid Orders Report')

@section('content')
<h2>Unpaid Orders Report</h2>
<p>The following <strong>{{ $unpaidOrders->count() }}</strong> order(s) remain unpaid as of {{ now()->format('M d, Y') }}:</p>

<table class="info-table">
    <thead>
        <tr>
            <th>Order #</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Payment Method</th>
            <th>Date Ordered</th>
            <th>Status</th>
        </tr>
    </thead>
    <tbody>
        @foreach($unpaidOrders as $order)
        <tr>
            <td>{{ $order->transaction_id }}</td>
            <td>{{ $order->customer?->name ?? 'Walk-in' }}</td>
            <td><strong>₱{{ number_format($order->total, 2) }}</strong></td>
            <td>{{ ucfirst(str_replace('_', ' ', $order->payment_method ?? 'N/A')) }}</td>
            <td>{{ $order->created_at->format('M d, Y') }}</td>
            <td><span class="badge badge-warning">{{ ucfirst(str_replace('_', ' ', $order->status)) }}</span></td>
        </tr>
        @endforeach
    </tbody>
</table>

<div style="margin-top: 16px; padding: 12px 16px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
    <p style="margin: 0; font-size: 16px; font-weight: 700; color: #dc2626;">
        Total Unpaid: ₱{{ number_format($totalUnpaid, 2) }}
    </p>
</div>

<p style="margin-top: 16px;">Please review and follow up on these orders to ensure timely payment collection.</p>
@endsection
