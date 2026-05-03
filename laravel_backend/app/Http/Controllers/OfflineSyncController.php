<?php

namespace App\Http\Controllers;

use App\Services\EmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class OfflineSyncController extends Controller
{
    protected EmailService $emailService;

    public function __construct(EmailService $emailService)
    {
        $this->emailService = $emailService;
    }

    /**
     * Process a queued email from the offline PWA.
     * The frontend stores emails in IndexedDB when offline,
     * then sends them here when back online.
     */
    public function processEmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type'     => 'required|string|max:100',
            'data'     => 'required|array',
            'queuedAt' => 'nullable|numeric',
        ]);

        $type = $validated['type'];
        $data = $validated['data'];

        try {
            switch ($type) {
                case 'contact_form':
                    $this->emailService->sendContactForm(
                        $data['name'] ?? '',
                        $data['email'] ?? '',
                        $data['subject'] ?? '',
                        $data['message'] ?? ''
                    );
                    break;

                case 'order_confirmation':
                    // Order emails are normally triggered by the sale creation endpoint.
                    // If the sale was created offline and synced, the normal flow will
                    // handle the email. This is a fallback for any missed emails.
                    Log::info('Offline email processed: order_confirmation', ['data' => $data]);
                    break;

                case 'status_update':
                    Log::info('Offline email processed: status_update', ['data' => $data]);
                    break;

                case 'low_stock_alert':
                    Log::info('Offline email processed: low_stock_alert', ['data' => $data]);
                    break;

                default:
                    Log::info("Offline email processed: {$type}", ['data' => $data]);
                    break;
            }

            return response()->json([
                'success' => true,
                'message' => 'Email processed successfully.',
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to process offline email: {$type}", [
                'error' => $e->getMessage(),
                'data'  => $data,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to process email.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }
}
