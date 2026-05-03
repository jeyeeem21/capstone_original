<?php

namespace App\Http\Controllers;

use App\Mail\ContactMessageMail;
use App\Models\BusinessSetting;
use App\Models\ContactMessage;
use App\Services\EmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

class ContactController extends Controller
{
    protected EmailService $emailService;

    public function __construct(EmailService $emailService)
    {
        $this->emailService = $emailService;
    }
    /**
     * Store a contact message and email it to the business.
     */
    public function send(Request $request): JsonResponse
    {
        // Rate limit: 5 messages per IP per hour
        $key = 'contact-send:' . $request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json([
                'success' => false,
                'message' => 'Too many messages. Please try again later.',
            ], 429);
        }
        RateLimiter::hit($key, 3600);

        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'email'        => 'required|email|max:255',
            'phone'        => 'nullable|string|max:50',
            'company'      => 'nullable|string|max:255',
            'subject'      => 'required|string|max:255',
            'inquiry_type' => 'nullable|string|in:general,wholesale,retail,partnership,feedback',
            'message'      => 'required|string|max:5000',
        ]);

        $contactMessage = ContactMessage::create($validated);

        // Send email to business owner (fire-and-forget, non-blocking)
        $businessEmail = BusinessSetting::getValue('business_email');
        if ($businessEmail) {
            $emailService = $this->emailService;
            dispatch(function () use ($emailService, $businessEmail, $contactMessage) {
                try {
                    $emailService->sendContactEmail($businessEmail, $contactMessage);
                } catch (\Throwable $e) {
                    \Log::warning('Contact message email failed', ['error' => $e->getMessage()]);
                }
            })->afterResponse();
        }

        return response()->json([
            'success' => true,
            'message' => 'Your message has been sent successfully!',
        ]);
    }
}
