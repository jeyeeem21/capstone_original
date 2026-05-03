@extends('emails.layout')

@section('title', $heading)

@section('content')
<h2>{{ $heading }}</h2>
{!! nl2br(e($body)) !!}
@endsection
