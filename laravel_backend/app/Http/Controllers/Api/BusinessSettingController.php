<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BusinessSetting;
use App\Services\BusinessSettingService;
use App\Services\EmailService;
use App\Http\Resources\BusinessSettingResource;
use App\Traits\ApiResponse;
use App\Traits\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

class BusinessSettingController extends Controller
{
    use ApiResponse, AuditLogger;

    protected BusinessSettingService $settingService;

    public function __construct(BusinessSettingService $settingService)
    {
        $this->settingService = $settingService;
    }

    /**
     * Get all business settings
     */
    public function index(): JsonResponse
    {
        try {
            $settings = $this->settingService->getAllSettings();
            $settings['business_hours_formatted'] = $this->settingService->getFormattedBusinessHours();

            // Add flag to indicate if SMTP is configured (check for non-empty string)
            $smtpPassword = $settings['smtp_password'] ?? '';
            $settings['smtp_configured'] = !empty(trim($smtpPassword));

            // Never expose SMTP password — mask it if present, otherwise return empty string
            if (!empty(trim($smtpPassword))) {
                $settings['smtp_password'] = '••••••••';
            } else {
                $settings['smtp_password'] = '';
            }

            return $this->successResponse($settings);
        } catch (\Exception $e) {
            return $this->serverErrorResponse('Failed to fetch business settings: ' . $e->getMessage());
        }
    }

    /**
     * Update business settings
     */
    public function update(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'business_name' => 'nullable|string|max:255',
                'business_tagline' => 'nullable|string|max:100',
                'business_start_year' => 'nullable|integer|min:1900|max:2100',
                'business_email' => 'nullable|email|max:255',
                'business_phone' => 'nullable|string|max:50',
                'business_address' => 'nullable|string|max:500',
                'business_open_days' => 'nullable|string|max:100',
                'business_open_time' => 'nullable|string|max:10',
                'business_close_time' => 'nullable|string|max:10',
                'business_hours_json' => 'nullable|string|max:5000',
                'footer_tagline' => 'nullable|string|max:500',
                'footer_copyright' => 'nullable|string|max:255',
                'footer_powered_by' => 'nullable|string|max:255',
                'footer_badge1' => 'nullable|string|max:100',
                'footer_badge2' => 'nullable|string|max:100',
                'social_facebook' => 'nullable|string|max:500',
                'social_twitter' => 'nullable|string|max:500',
                'social_instagram' => 'nullable|string|max:500',
                'social_linkedin' => 'nullable|string|max:500',
                // Shipping fee settings
                'shipping_rate_per_sack' => 'nullable|numeric|min:0',
                'shipping_rate_per_km' => 'nullable|numeric|min:0',
                'shipping_base_km' => 'nullable|numeric|min:0',
                'warehouse_address' => 'nullable|string|max:500',
                'google_maps_embed' => 'nullable|string|max:2000',
                // SMTP / Email settings
                'smtp_password' => 'nullable|string|max:255',
                'current_password' => 'nullable|string', // Required when changing business_email
                // GCash Payment settings
                'gcash_name' => 'nullable|string|max:100',
                'gcash_number' => 'nullable|string|max:20',
            ]);

            // Don't overwrite smtp_password if user sent the masked placeholder
            if (isset($validated['smtp_password']) && $validated['smtp_password'] === '••••••••') {
                unset($validated['smtp_password']);
            }

            $oldBusinessEmail = BusinessSetting::getValue('business_email') ?? '';
            $emailChanging = isset($validated['business_email']) && 
                            strtolower(trim($validated['business_email'])) !== strtolower(trim($oldBusinessEmail ?? ''));

            // If business_email is being updated, require password verification and send verification code
            if ($emailChanging) {
                $user = $request->user();
                
                if (!isset($validated['current_password'])) {
                    return $this->errorResponse('Password verification is required to change the business email address.', 422);
                }

                if (!\Illuminate\Support\Facades\Hash::check($validated['current_password'], $user->password)) {
                    return $this->errorResponse('The password is incorrect.', 422);
                }

                $newBusinessEmail = strtolower(trim($validated['business_email']));
                
                // Generate verification code and cache it
                $cacheKey = 'business_email_change_' . $user->id;

                // Reuse existing code if same email change is already pending (prevents double-submit race condition)
                $existing = Cache::get($cacheKey);
                if ($existing && $existing['new_email'] === $newBusinessEmail && $existing['attempts'] < 3) {
                    $code = $existing['code'];
                } else {
                    $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                }

                // Remove current_password before caching settings data
                $settingsDataForCache = $validated;
                unset($settingsDataForCache['current_password']);

                Cache::put($cacheKey, [
                    'user_id' => $user->id,
                    'old_email' => $oldBusinessEmail,
                    'new_email' => $newBusinessEmail,
                    'code' => $code,
                    'attempts' => $existing['attempts'] ?? 0,
                    'settings_data' => $settingsDataForCache,
                ], now()->addMinutes(15));

                // Send verification code to NEW email
                try {
                    // Check if SMTP is configured
                    $smtpPassword = BusinessSetting::getValue('smtp_password');
                    $businessEmail = BusinessSetting::getValue('business_email');
                    
                    if (!$smtpPassword || !$businessEmail) {
                        return response()->json([
                            'success' => false,
                            'requires_smtp_setup' => true,
                            'error' => 'Email verification cannot be sent because SMTP is not configured. Please set up your Gmail App Password in Business Settings → Email Notifications first.',
                        ], 422);
                    }

                    $emailService = app(EmailService::class);
                    $userName = $user->name;
                    dispatch(function () use ($emailService, $newBusinessEmail, $code, $userName) {
                        $emailService->sendEmailChangeVerification($newBusinessEmail, $code, $userName);
                    })->afterResponse();
                } catch (\Exception $e) {
                    \Log::error('Failed to send business email verification', [
                        'error' => $e->getMessage(),
                        'to' => $newBusinessEmail,
                    ]);
                    return response()->json([
                        'success' => false,
                        'error' => 'Failed to send verification email: ' . $e->getMessage(),
                    ], 500);
                }

                return response()->json([
                    'success' => true,
                    'requires_verification' => true,
                    'message' => 'Verification code sent to ' . $newBusinessEmail . '. Please check your email.',
                ]);
            }

            unset($validated['current_password']);

            $settings = $this->settingService->updateSettings($validated);
            $settings['business_hours_formatted'] = $this->settingService->getFormattedBusinessHours();

            // Mask smtp_password in the response
            if (!empty($settings['smtp_password'])) {
                $settings['smtp_password'] = '••••••••';
            }

            $this->logAudit('UPDATE', 'Business Settings', 'Updated business settings', [
                'updated_fields' => array_keys($validated),
            ]);

            return $this->successResponse($settings, 'Business settings updated successfully');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->validationErrorResponse($e->errors());
        } catch (\Exception $e) {
            return $this->serverErrorResponse('Failed to update business settings: ' . $e->getMessage());
        }
    }

    /**
     * Verify business email change code and complete the change
     */
    public function verifyBusinessEmailChange(Request $request): JsonResponse
    {
        $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $user = $request->user();
        $cacheKey = 'business_email_change_' . $user->id;
        $cached = Cache::get($cacheKey);

        if (!$cached) {
            return $this->errorResponse('Verification code has expired. Please start over.', 422);
        }

        if ($cached['attempts'] >= 5) {
            Cache::forget($cacheKey);
            return $this->errorResponse('Too many failed attempts. Please start over.', 429);
        }

        if ($cached['code'] !== $request->code) {
            $cached['attempts']++;
            Cache::put($cacheKey, $cached, now()->addMinutes(15));
            $remaining = 5 - $cached['attempts'];
            return $this->errorResponse("Invalid code. {$remaining} attempt(s) remaining.", 422);
        }

        // Code is valid - update business settings
        $oldEmail = $cached['old_email'];
        $newEmail = $cached['new_email'];
        $settingsData = $cached['settings_data'];

        unset($settingsData['current_password']);

        // SMTP password is NOT cleared here — it stays in DB until the user
        // configures a new App Password via the mandatory SMTP modal.
        // If the user cancels the email change, the email reverts and the
        // existing SMTP password still works with the original email.
        unset($settingsData['smtp_password']);

        $settings = $this->settingService->updateSettings($settingsData);
        $settings['business_hours_formatted'] = $this->settingService->getFormattedBusinessHours();

        // Mask smtp_password in the response
        if (!empty($settings['smtp_password'])) {
            $settings['smtp_password'] = '••••••••';
        }

        // Find the super admin user and update their email
        $superAdmin = \App\Models\User::where('role', 'super_admin')->first();
        
        if ($superAdmin) {
            $superAdmin->update([
                'email' => $newEmail,
                'email_change_pending' => true,
                'email_changed_at' => now(),
            ]);
            
            $this->logAudit('UPDATE', 'User', 'Super admin email updated to match business email', [
                'user_id' => $superAdmin->id,
                'old_email' => $oldEmail,
                'new_email' => $newEmail,
            ]);
        }

        // Send notification to old email (non-blocking)
        $userName = $user->name;
        $ip = $request->ip();
        dispatch(function () use ($oldEmail, $newEmail, $userName, $ip) {
            try {
                $emailService = app(EmailService::class);
                $emailService->sendEmailChangeNotification($oldEmail, $newEmail, $userName, $ip);
            } catch (\Exception $e) {
                // Silent fail
            }
        })->afterResponse();

        $this->logAudit('UPDATE', 'Business Settings', 'Business email changed', [
            'old_email' => $oldEmail,
            'new_email' => $newEmail,
        ]);

        Cache::forget($cacheKey);

        return $this->successResponse($settings, 'Business email changed successfully. Please reconfigure your Gmail App Password for the new email address.');
    }

    /**
     * Upload business logo
     */
    public function uploadLogo(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'logo' => 'required|file|mimes:png,jpg,jpeg,svg,webp|max:10240',
            ]);

            if (!$request->hasFile('logo')) {
                return $this->errorResponse('No file uploaded', 400);
            }

            $logoUrl = $this->settingService->uploadLogo($request->file('logo'));

            $this->logAudit('UPDATE', 'Business Settings', 'Uploaded new business logo', [
                'logo_url' => $logoUrl,
            ]);

            return $this->successResponse(['logo_url' => $logoUrl], 'Logo uploaded successfully');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->validationErrorResponse($e->errors());
        } catch (\Exception $e) {
            return $this->serverErrorResponse('Failed to upload logo: ' . $e->getMessage());
        }
    }

    /**
     * Upload GCash QR code image
     */
    public function uploadGcashQr(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'gcash_qr' => 'required|file|mimes:png,jpg,jpeg,webp|max:5120',
            ]);

            if (!$request->hasFile('gcash_qr')) {
                return $this->errorResponse('No file uploaded', 400);
            }

            $qrUrl = $this->settingService->uploadGcashQr($request->file('gcash_qr'));

            $this->logAudit('UPDATE', 'Business Settings', 'Uploaded GCash QR code', [
                'qr_url' => $qrUrl,
            ]);

            return $this->successResponse(['qr_url' => $qrUrl], 'GCash QR code uploaded successfully');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->validationErrorResponse($e->errors());
        } catch (\Exception $e) {
            return $this->serverErrorResponse('Failed to upload GCash QR code: ' . $e->getMessage());
        }
    }

    /**
     * Send a test email to verify SMTP configuration
     */
    public function testEmail(Request $request): JsonResponse
    {
        try {
            $email = BusinessSetting::getValue('business_email');
            $businessName = BusinessSetting::getValue('business_name', 'KJP Ricemill');

            // Accept password from request (unsaved form value) or fall back to DB
            $password = $request->input('smtp_password');
            if (!$password || $password === '••••••••') {
                $password = BusinessSetting::getValue('smtp_password');
            } else {
                // Save the password to DB so future emails also work
                BusinessSetting::updateOrCreate(
                    ['key' => 'smtp_password'],
                    ['value' => $password, 'type' => 'text']
                );
            }

            if (!$email || !$password) {
                return $this->errorResponse('SMTP is not configured. Please set your Business Email and App Password first.', 422);
            }

            // Configure mailer with DB settings
            config([
                'mail.default' => 'smtp',
                'mail.mailers.smtp.host' => 'smtp.gmail.com',
                'mail.mailers.smtp.port' => 587,
                'mail.mailers.smtp.username' => $email,
                'mail.mailers.smtp.password' => $password,
                'mail.mailers.smtp.encryption' => 'tls',
            ]);
            Mail::purge('smtp');

            Mail::raw("This is a test email from {$businessName}. Your email configuration is working correctly!", function ($message) use ($email, $businessName) {
                $message->to($email)
                        ->from($email, $businessName)
                        ->subject("{$businessName} - Test Email");
            });

            return $this->successResponse(null, 'Test email sent successfully to ' . $email);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to send test email: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Check if business email is available
     */
    public function checkBusinessEmail(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $email = strtolower(trim($request->email));
        $currentBusinessEmail = BusinessSetting::getValue('business_email');

        \Log::info('Checking business email', [
            'email' => $email,
            'currentBusinessEmail' => $currentBusinessEmail,
        ]);

        // If it's the current business email, it's available (not taken)
        if ($currentBusinessEmail && strtolower(trim($currentBusinessEmail)) === $email) {
            \Log::info('Email matches current business email - available');
            return $this->successResponse(
                ['available' => true],
                'Email is available'
            );
        }

        // Check if email is taken by any user EXCEPT super admin
        // (because super admin email is synced with business email)
        $takenByUser = \App\Models\User::where('email', $email)
            ->where('role', '!=', 'super_admin')
            ->exists();

        \Log::info('User check', ['takenByUser' => $takenByUser]);

        // Check if email is taken by any customer
        $takenByCustomer = \App\Models\Customer::where('email', $email)->exists();
        
        \Log::info('Customer check', ['takenByCustomer' => $takenByCustomer]);

        // Check if email is taken by any supplier
        $takenBySupplier = \App\Models\Supplier::where('email', $email)->exists();
        
        \Log::info('Supplier check', ['takenBySupplier' => $takenBySupplier]);

        $taken = $takenByUser || $takenByCustomer || $takenBySupplier;

        \Log::info('Final result', ['taken' => $taken, 'available' => !$taken]);

        return $this->successResponse(
            ['available' => !$taken],
            $taken ? 'This email is already registered.' : 'Email is available.'
        );
    }
}
