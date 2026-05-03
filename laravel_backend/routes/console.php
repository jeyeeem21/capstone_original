<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\EmailService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Send daily unpaid orders report to admins at 8:00 AM
Schedule::call(function () {
    app(EmailService::class)->sendDailyUnpaidOrdersReport();
})->daily()->at('08:00')->name('daily-unpaid-orders-report');
