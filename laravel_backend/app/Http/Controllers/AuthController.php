<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\User;
use App\Services\EmailService;
use App\Traits\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use AuditLogger;

    public function __construct(private EmailService $emailService)
    {
    }

    /**
     * Login and return token + user data
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'error' => 'The provided credentials are incorrect.',
            ], 401);
        }

        if ($user->status !== 'active') {
            return response()->json([
                'success' => false,
                'error' => 'Your account has been deactivated. Please contact an administrator.',
            ], 403);
        }

        // Check email verification for staff and admin accounts (super_admin exempt)
        if (!$user->isSuperAdmin() && !$user->email_verified_at) {
            return response()->json([
                'success' => false,
                'error' => 'Please verify your email address before logging in. Check your email for the verification code.',
                'requires_verification' => true,
                'email' => $user->email,
            ], 403);
        }

        // Revoke all existing tokens for this user
        $user->tokens()->delete();

        // Generate a unique session token for single-session enforcement
        $sessionToken = bin2hex(random_bytes(32));
        $user->update(['session_token' => $sessionToken]);

        // Create new token with role-based abilities
        $abilities = $this->getAbilitiesForRole($user->role);
        $token = $user->createToken('auth-token', $abilities)->plainTextToken;

        // Log the login (manually set user_id since Auth::id() may not be set yet)
        \App\Models\AuditTrail::create([
            'user_id'    => $user->id,
            'action'     => 'LOGIN',
            'module'     => 'Authentication',
            'description'=> "User {$user->name} logged in",
            'details'    => ['role' => $user->role],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'success' => true,
            'token' => $token,
            'session_token' => $sessionToken,
            'user' => $this->formatUser($user),
            'message' => 'Login successful',
        ]);
    }

    /**
     * Send login notification emails — called fire-and-forget from frontend after login.
     */
    public function sendLoginEmail(Request $request)
    {
        $user = $request->user();
        $ip = $request->ip();
        $emailService = $this->emailService;
        $role = $user->role;

        dispatch(function () use ($emailService, $user, $ip, $role) {
            try {
                $emailService->sendLoginNotification($user, $ip);
                if ($role === 'customer') {
                    $emailService->sendCustomerLoginNotification($user, $ip);
                }
            } catch (\Throwable $e) {
                // Silent
            }
        })->afterResponse();

        return response()->json(['success' => true]);
    }

    /**
     * Logout (revoke current token)
     */
    public function logout(Request $request)
    {
        $user = $request->user();

        $this->logAudit('LOGOUT', 'Authentication', "User {$user->name} logged out", [
            'role' => $user->role,
        ]);

        $user->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully',
        ]);
    }

    /**
     * Get current authenticated user
     */
    public function me(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'success' => true,
            'user' => $this->formatUser($user),
            'session_token' => $user->session_token,
        ]);
    }

    /**
     * Lightweight session check — returns only the current session_token.
     * Used by the frontend to detect if another device has logged in.
     */
    public function sessionCheck(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'session_token' => $user->session_token,
        ]);
    }

    /**
     * Format user data for frontend
     */
    private function formatUser(User $user): array
    {
        $data = [
            'id' => $user->id,
            'name' => $user->name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'email_verified_at' => $user->email_verified_at,
            'phone' => $user->phone,
            'role' => $user->role,
            'position' => $user->position,
            'status' => $user->status,
            'email_change_pending' => $user->email_change_pending ?? false,
            'email_changed_at' => $user->email_changed_at,
            'created_at' => $user->created_at,
        ];

        // Include customer address for customer-role users
        if ($user->role === 'customer') {
            $customer = $user->customer;
            $data['address'] = $customer?->address;
        }

        // Include truck plate number for driver staff
        if ($user->role === 'staff' && $user->position === 'Driver') {
            $data['truck_plate_number'] = $user->truck_plate_number;
            $data['date_hired'] = $user->date_hired;
        }

        return $data;
    }

    /**
     * Update own profile
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'first_name' => 'sometimes|string|max:255',
            'last_name'  => 'sometimes|string|max:255',
            'email'      => [
                'sometimes',
                'email',
                Rule::unique('users')->ignore($user->id),
                function ($attribute, $value, $fail) use ($user) {
                    // Check customers table but allow the linked customer record
                    $query = \App\Models\Customer::where('email', $value);
                    if ($user->role === 'customer') {
                        $query->where('email', '!=', $user->email);
                    }
                    if ($query->exists()) {
                        $fail('This email is already registered.');
                    }
                    // Check suppliers table
                    if (\App\Models\Supplier::where('email', $value)->exists()) {
                        $fail('This email is already registered.');
                    }
                },
            ],
            'phone'      => 'nullable|string|max:50',
            'address'    => 'nullable|string|max:500',
            'current_password' => 'sometimes|string', // Required when changing email
        ]);

        $oldEmail = $user->email;
        $emailChanging = isset($validated['email']) && $validated['email'] !== $oldEmail;

        // If email is changing, require password verification
        if ($emailChanging) {
            if (!isset($validated['current_password'])) {
                throw ValidationException::withMessages([
                    'current_password' => ['Password verification is required to change your email address.'],
                ]);
            }

            if (!Hash::check($validated['current_password'], $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['The password is incorrect.'],
                ]);
            }

            // Generate verification code and cache it
            $newEmail = strtolower(trim($validated['email']));
            $cacheKey = 'email_change_' . $user->id;

            // Reuse existing code if same email change is already pending (prevents double-submit race condition)
            $existing = Cache::get($cacheKey);
            if ($existing && $existing['new_email'] === $newEmail && $existing['attempts'] < 3) {
                $code = $existing['code'];
            } else {
                $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            }

            // Remove current_password before caching profile data
            $profileDataForCache = $validated;
            unset($profileDataForCache['current_password']);

            Cache::put($cacheKey, [
                'user_id' => $user->id,
                'old_email' => $oldEmail,
                'new_email' => $newEmail,
                'code' => $code,
                'attempts' => $existing['attempts'] ?? 0,
                'profile_data' => $profileDataForCache,
            ], now()->addMinutes(15));

            // Send verification code to NEW email
            try {
                // Check if SMTP is configured
                $smtpPassword = \App\Models\BusinessSetting::getValue('smtp_password');
                $businessEmail = \App\Models\BusinessSetting::getValue('business_email');
                
                if (!$smtpPassword || !$businessEmail) {
                    return response()->json([
                        'success' => false,
                        'requires_smtp_setup' => true,
                        'error' => 'Email verification cannot be sent because SMTP is not configured. Please set up your Gmail App Password in Business Settings → Email Notifications first.',
                    ], 422);
                }

                $emailService = $this->emailService;
                $userName = $user->name;
                dispatch(function () use ($emailService, $newEmail, $code, $userName) {
                    $emailService->sendEmailChangeVerification($newEmail, $code, $userName);
                })->afterResponse();
            } catch (\Exception $e) {
                \Log::error('Failed to send email verification', [
                    'error' => $e->getMessage(),
                    'to' => $newEmail,
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'Failed to send verification email: ' . $e->getMessage(),
                ], 500);
            }

            return response()->json([
                'success' => true,
                'requires_verification' => true,
                'message' => 'Verification code sent to ' . $newEmail . '. Please check your email.',
            ]);
        }

        // Build the name from first_name + last_name
        if (isset($validated['first_name']) || isset($validated['last_name'])) {
            $firstName = $validated['first_name'] ?? $user->first_name ?? '';
            $lastName  = $validated['last_name'] ?? $user->last_name ?? '';
            $validated['name'] = trim("$firstName $lastName");
        }

        // Handle address for customer users
        $address = $validated['address'] ?? null;
        unset($validated['address']);
        unset($validated['current_password']);

        // Track changes for notification
        $changes = [];
        foreach ($validated as $key => $value) {
            if ($user->$key != $value) {
                $changes[$key] = $value;
            }
        }

        $user->update($validated);

        // Sync all changed fields to linked customer record
        if ($user->role === 'customer') {
            $customer = \App\Models\Customer::where('email', $oldEmail)->first();
            if ($customer) {
                $customerUpdates = [
                    'name'    => $user->name,
                    'email'   => $user->email,
                    'phone'   => $validated['phone'] ?? $customer->phone,
                    'contact' => trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? '')),
                ];
                if ($address !== null) {
                    $customerUpdates['address'] = $address;
                }
                $customer->update($customerUpdates);
            }
        }

        // Send notification email about profile changes (non-blocking)
        if (!empty($changes)) {
            $emailService = $this->emailService;
            $userCopy = $user->replicate();
            $userCopy->id = $user->id;
            $userCopy->email = $user->email;
            $changesSnapshot = $changes;
            $ip = $request->ip();
            dispatch(function () use ($emailService, $userCopy, $changesSnapshot, $ip) {
                try {
                    $emailService->sendProfileUpdateNotification($userCopy, $changesSnapshot, $ip);
                } catch (\Exception $e) {
                    // Silent fail
                }
            })->afterResponse();

            $this->logAudit('UPDATE', 'Profile', 'User updated their profile', [
                'changes' => $changes,
            ]);
        }

        return response()->json([
            'success' => true,
            'user'    => $this->formatUser($user->fresh()),
            'message' => 'Profile updated successfully',
        ]);
    }

    /**
     * Verify email change code and complete the email change
     */
    public function verifyEmailChange(Request $request)
    {
        $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $user = $request->user();
        $cacheKey = 'email_change_' . $user->id;
        $cached = Cache::get($cacheKey);

        if (!$cached) {
            return response()->json([
                'success' => false,
                'error' => 'Verification code has expired. Please start over.',
            ], 422);
        }

        if ($cached['attempts'] >= 5) {
            Cache::forget($cacheKey);
            return response()->json([
                'success' => false,
                'error' => 'Too many failed attempts. Please start over.',
            ], 429);
        }

        if ($cached['code'] !== $request->code) {
            $cached['attempts']++;
            Cache::put($cacheKey, $cached, now()->addMinutes(15));
            $remaining = 5 - $cached['attempts'];
            return response()->json([
                'success' => false,
                'error' => "Invalid code. {$remaining} attempt(s) remaining.",
            ], 422);
        }

        // Code is valid - update email and all profile data
        $oldEmail = $cached['old_email'];
        $newEmail = $cached['new_email'];
        $profileData = $cached['profile_data'];

        // Build the name from first_name + last_name
        if (isset($profileData['first_name']) || isset($profileData['last_name'])) {
            $firstName = $profileData['first_name'] ?? $user->first_name ?? '';
            $lastName  = $profileData['last_name'] ?? $user->last_name ?? '';
            $profileData['name'] = trim("$firstName $lastName");
        }

        // Handle address for customer users
        $address = $profileData['address'] ?? null;
        unset($profileData['address']);
        unset($profileData['current_password']);

        // Set email_change_pending flag for super admin
        if ($user->role === 'super_admin') {
            $profileData['email_change_pending'] = true;
            $profileData['email_changed_at'] = now();
        }

        $user->update($profileData);

        // If super admin updates their email, also update the business email
        if ($user->role === 'super_admin') {
            $businessEmailSetting = \App\Models\BusinessSetting::where('key', 'business_email')->first();
            if ($businessEmailSetting) {
                $businessEmailSetting->update(['value' => $newEmail]);
            } else {
                \App\Models\BusinessSetting::create([
                    'key' => 'business_email',
                    'value' => $newEmail,
                ]);
            }

            // SMTP password is NOT cleared here — it stays in DB until the user
            // configures a new App Password via the mandatory SMTP modal.
            // If the user cancels the email change, the email reverts and the
            // existing SMTP password still works with the original email.
            
            // Clear the business settings cache so fresh data is returned
            \Illuminate\Support\Facades\Cache::forget('business_settings');

            \App\Models\AuditTrail::create([
                'user_id'     => $user->id,
                'action'      => 'UPDATE',
                'module'      => 'Business Settings',
                'description' => 'Business email updated to match super admin email',
                'details'     => [
                    'old_email' => $oldEmail,
                    'new_email' => $newEmail,
                ],
                'ip_address'  => $request->ip(),
                'user_agent'  => $request->userAgent(),
            ]);
        }

        // Sync to linked customer record
        if ($user->role === 'customer') {
            $customer = \App\Models\Customer::where('email', $oldEmail)->first();
            if ($customer) {
                $customerUpdates = [
                    'name'    => $user->name,
                    'email'   => $newEmail,
                    'phone'   => $profileData['phone'] ?? $customer->phone,
                    'contact' => trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? '')),
                ];
                if ($address !== null) {
                    $customerUpdates['address'] = $address;
                }
                $customer->update($customerUpdates);
            }
        }

        // Send notification to OLD email (non-blocking)
        $emailService = $this->emailService;
        $userName = $user->name;
        $ip = $request->ip();
        dispatch(function () use ($emailService, $oldEmail, $newEmail, $userName, $ip) {
            try {
                $emailService->sendEmailChangeNotification($oldEmail, $newEmail, $userName, $ip);
            } catch (\Exception $e) {
                // Silent fail
            }
        })->afterResponse();

        // Log audit trail
        $this->logAudit('UPDATE', 'Profile', 'User changed their email address', [
            'old_email' => $oldEmail,
            'new_email' => $newEmail,
        ]);

        Cache::forget($cacheKey);

        $message = 'Email address changed successfully';
        if ($user->role === 'super_admin') {
            $message .= '. Please reconfigure your Gmail App Password for the new email address.';
        }

        return response()->json([
            'success' => true,
            'user' => $this->formatUser($user->fresh()),
            'message' => $message,
        ]);
    }

    /**
     * Clear email change pending flag (after completing email change flow)
     */
    public function clearEmailChangePending(Request $request)
    {
        $user = $request->user();
        
        $user->update([
            'email_change_pending' => false,
        ]);

        $this->logAudit('UPDATE', 'Profile', 'Email change flow completed', [
            'email' => $user->email,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Email change flow completed',
        ]);
    }

    /**
     * Revert a completed email change (cancel flow — only super_admin with email_change_pending).
     * The frontend passes the old email so we can restore it.
     */
    public function revertEmailChange(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'error' => 'Unauthorized.',
            ], 403);
        }

        $request->validate([
            'old_email' => 'required|email',
        ]);

        $oldEmail  = strtolower(trim($request->old_email));
        $newEmail  = $user->email;

        // Revert user record
        $user->update([
            'email'               => $oldEmail,
            'email_change_pending' => false,
            'email_changed_at'    => null,
        ]);

        // Revert business_email setting
        $setting = \App\Models\BusinessSetting::where('key', 'business_email')->first();
        if ($setting) {
            $setting->update(['value' => $oldEmail]);
        }

        // SMTP password was never cleared, so no restore needed.
        // The original SMTP password still works with the reverted email.

        // Clear business settings cache
        \Illuminate\Support\Facades\Cache::forget('business_settings');

        $this->logAudit('UPDATE', 'Profile', 'Email change cancelled and reverted', [
            'reverted_from' => $newEmail,
            'reverted_to'   => $oldEmail,
        ]);

        return response()->json([
            'success' => true,
            'user'    => $this->formatUser($user->fresh()),
            'message' => 'Email change cancelled. Your email and SMTP configuration have been restored.',
        ]);
    }

    /**
     * Change own password
     */
    public function updatePassword(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'current_password' => 'required|string',
            'new_password'     => 'required|string|min:8|confirmed',
        ]);

        if (!Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->update(['password' => Hash::make($request->new_password)]);

        // Send security notification email (non-blocking)
        $emailService = $this->emailService;
        $userCopy = $user->replicate();
        $userCopy->id = $user->id;
        $userCopy->email = $user->email;
        $ip = $request->ip();
        dispatch(function () use ($emailService, $userCopy, $ip) {
            try {
                $emailService->sendSecurityUpdateNotification($userCopy, 'Password Changed', $ip);
            } catch (\Exception $e) {
                // Silent fail
            }
        })->afterResponse();

        // Log audit trail
        $this->logAudit('UPDATE', 'Security', 'User changed their password', [
            'role' => $user->role,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully',
        ]);
    }

    /**
     * Get token abilities based on role
     */
    private function getAbilitiesForRole(string $role): array
    {
        return match ($role) {
            User::ROLE_SUPER_ADMIN => ['*'],
            User::ROLE_ADMIN => [
                'products:*', 'varieties:*',
                'suppliers:*', 'customers:*',
                'procurements:*', 'processings:*', 'drying:*',
                'sales:*', 'orders:*', 'drivers:*', 'deliveries:*',
                'staff:*', 'settings:*', 'pos:*',
            ],
            User::ROLE_STAFF => [
                'products:read', 'sales:create', 'pos:*',
                'orders:read',
            ],
            default => [],
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Self-registration flow (public – no auth required)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Check if an email is already taken (public).
     */
    public function checkEmail(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        $email = strtolower(trim($request->email));

        // Check users table (including soft-deleted AND archived)
        $taken = User::withTrashed()->withArchived()->where('email', $email)->exists()
               || Customer::withTrashed()->withArchived()->where('email', $email)->exists();
        
        // Also check if it's the business email
        if (!$taken) {
            $businessEmail = \App\Models\BusinessSetting::where('key', 'business_email')->value('value');
            if ($businessEmail && strtolower(trim($businessEmail)) === $email) {
                $taken = true;
            }
        }

        return response()->json(['success' => true, 'taken' => $taken]);
    }

    /**
     * Check if profile email is available (authenticated users only)
     */
    public function checkProfileEmail(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = $request->user();
        $email = strtolower(trim($request->email));

        // Check if email is taken by another user (including soft-deleted AND archived)
        $takenByUser = User::withTrashed()->withArchived()
            ->where('email', $email)
            ->where('id', '!=', $user->id)
            ->exists();

        // Check if email is taken by a customer (but allow if it's the user's own linked customer)
        $takenByCustomer = false;
        if ($user->role !== 'customer') {
            $takenByCustomer = Customer::where('email', $email)->exists();
        } else {
            // For customer users, allow their own customer email
            $takenByCustomer = Customer::where('email', $email)
                ->where('email', '!=', $user->email)
                ->exists();
        }

        // Check if email is taken by a supplier
        $takenBySupplier = \App\Models\Supplier::where('email', $email)->exists();

        // Check if it's the business email (only block if user is not super admin)
        $isBusinessEmail = false;
        if ($user->role !== 'super_admin') {
            $businessEmail = \App\Models\BusinessSetting::where('key', 'business_email')->value('value');
            if ($businessEmail && strtolower(trim($businessEmail)) === $email) {
                $isBusinessEmail = true;
            }
        }

        $taken = $takenByUser || $takenByCustomer || $takenBySupplier || $isBusinessEmail;

        return response()->json([
            'success' => true,
            'available' => !$taken,
            'message' => $taken ? 'This email is already registered.' : 'Email is available.'
        ]);
    }

    /**
     * Step 1: validate form, store pending data in cache, send verification code.
     */
    public function registerSendVerification(Request $request)
    {
        $validated = $request->validate([
            'business_name'  => 'required|string|max:255',
            'contact_person' => 'required|string|max:255',
            'phone'          => [
                'required',
                'string',
                'regex:/^(\+63\d{10}|09\d{9})$/',
            ],
            'email' => [
                'required',
                'email',
                function ($attribute, $value, $fail) {
                    $email = strtolower(trim($value));
                    
                    // Check if email is already used by a user or customer
                    if (User::where('email', $email)->exists() || Customer::where('email', $email)->exists()) {
                        $fail('This email is already registered.');
                    }
                    
                    // Check if email is the business email
                    $businessEmail = \App\Models\BusinessSetting::where('key', 'business_email')->value('value');
                    if ($businessEmail && strtolower(trim($businessEmail)) === $email) {
                        $fail('This email is reserved for business use and cannot be used for registration.');
                    }
                },
            ],
            'address'          => 'required|string|max:500',
            'address_landmark' => 'nullable|string|max:500',
        ], [
            'phone.regex' => 'Phone must be in format: +63XXXXXXXXXX or 09XXXXXXXXX',
        ]);

        $email    = strtolower(trim($validated['email']));
        $code     = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $cacheKey = 'self_register_' . md5($email);

        Cache::put($cacheKey, [
            'business_name'  => $validated['business_name'],
            'contact_person' => $validated['contact_person'],
            'phone'          => preg_replace('/\s+/', '', $validated['phone']),
            'email'          => $email,
            'address'        => $validated['address'],
            'address_landmark' => $validated['address_landmark'] ?? null,
            'code'           => $code,
            'attempts'       => 0,
        ], now()->addMinutes(15));

        $emailService = $this->emailService;
        dispatch(function () use ($emailService, $email, $code) {
            try {
                $emailService->sendVerificationCode($email, $code);
            } catch (\Exception $e) {
                \Log::warning("Failed to send registration verification code to {$email}: " . $e->getMessage());
            }
        })->afterResponse();

        \App\Models\AuditTrail::create([
            'user_id'     => null,
            'action'      => 'REGISTER_STARTED',
            'module'      => 'Authentication',
            'description' => "Self-registration started for email: {$email}",
            'details'     => ['email' => $email],
            'ip_address'  => $request->ip(),
            'user_agent'  => $request->userAgent(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Verification code sent to ' . $email . '. It expires in 15 minutes.',
        ]);
    }

    /**
     * Step 2: Verify the 6-digit code.
     */
    public function registerVerifyCode(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'code'  => 'required|string|size:6',
        ]);

        $email    = strtolower(trim($request->email));
        $cacheKey = 'self_register_' . md5($email);
        $cached   = Cache::get($cacheKey);

        if (! $cached) {
            return response()->json([
                'success' => false,
                'error'   => 'Verification code has expired. Please start over.',
            ], 422);
        }

        if ($cached['attempts'] >= 5) {
            Cache::forget($cacheKey);
            \App\Models\AuditTrail::create([
                'user_id'     => null,
                'action'      => 'REGISTER_CANCELLED',
                'module'      => 'Authentication',
                'description' => "Self-registration auto-cancelled (too many attempts) for: {$email}",
                'details'     => ['email' => $email, 'reason' => 'too_many_attempts'],
                'ip_address'  => $request->ip(),
                'user_agent'  => $request->userAgent(),
            ]);
            return response()->json([
                'success' => false,
                'error'   => 'Too many failed attempts. Please start over.',
            ], 429);
        }

        if ($cached['code'] !== $request->code) {
            $cached['attempts']++;
            Cache::put($cacheKey, $cached, now()->addMinutes(15));
            $remaining = 5 - $cached['attempts'];
            return response()->json([
                'success' => false,
                'error'   => "Invalid code. {$remaining} attempt(s) remaining.",
            ], 422);
        }

        $cached['verified'] = true;
        Cache::put($cacheKey, $cached, now()->addMinutes(15));

        return response()->json([
            'success' => true,
            'message' => 'Email verified successfully.',
        ]);
    }

    /**
     * Step 3: Finalise registration — create Customer + User records, return token.
     */
    public function registerComplete(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $email    = strtolower(trim($request->email));
        $cacheKey = 'self_register_' . md5($email);
        $cached   = Cache::get($cacheKey);

        if (! $cached || empty($cached['verified'])) {
            return response()->json([
                'success' => false,
                'error'   => 'Email not verified or session expired. Please start over.',
            ], 422);
        }

        if (User::where('email', $email)->exists() || Customer::where('email', $email)->exists()) {
            Cache::forget($cacheKey);
            return response()->json([
                'success' => false,
                'error'   => 'This email has already been registered.',
            ], 422);
        }

        $customer = Customer::create([
            'name'             => $cached['business_name'],
            'contact'          => $cached['contact_person'],
            'phone'            => $cached['phone'],
            'email'            => $email,
            'address'          => $cached['address'],
            'address_landmark' => $cached['address_landmark'] ?? null,
            'status'           => 'Active',
            'orders'           => 0,
        ]);

        $nameParts = explode(' ', trim($cached['contact_person']));
        $firstName = $nameParts[0] ?? null;
        $lastName  = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : null;

        $user = User::create([
            'name'       => $cached['business_name'],
            'first_name' => $firstName,
            'last_name'  => $lastName,
            'email'      => $email,
            'password'   => Hash::make($request->password),
            'role'       => 'customer',
            'phone'      => $cached['phone'],
            'status'     => 'active',
            'email_verified_at' => now(),
        ]);

        Cache::forget($cacheKey);

        $abilities = $this->getAbilitiesForRole($user->role);
        $token     = $user->createToken('auth-token', $abilities)->plainTextToken;

        \App\Models\AuditTrail::create([
            'user_id'     => $user->id,
            'action'      => 'REGISTER',
            'module'      => 'Authentication',
            'description' => "New customer self-registered: {$user->name} ({$email})",
            'details'     => ['customer_id' => $customer->id, 'user_id' => $user->id],
            'ip_address'  => $request->ip(),
            'user_agent'  => $request->userAgent(),
        ]);

        return response()->json([
            'success' => true,
            'token'   => $token,
            'user'    => $this->formatUser($user),
            'message' => 'Registration successful. Welcome!',
        ]);
    }

    /**
     * Cancel a pending registration — discard cached data and audit-log it.
     */
    public function registerCancel(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $email    = strtolower(trim($request->email));
        $cacheKey = 'self_register_' . md5($email);

        if (Cache::has($cacheKey)) {
            Cache::forget($cacheKey);
            \App\Models\AuditTrail::create([
                'user_id'     => null,
                'action'      => 'REGISTER_CANCELLED',
                'module'      => 'Authentication',
                'description' => "Self-registration cancelled by user for email: {$email}",
                'details'     => ['email' => $email, 'reason' => 'user_cancelled'],
                'ip_address'  => $request->ip(),
                'user_agent'  => $request->userAgent(),
            ]);
        }

        return response()->json(['success' => true, 'message' => 'Registration cancelled.']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Forgot Password flow (public – no auth required)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Step 1: Send a 6-digit reset code to the customer's email.
     */
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $email = strtolower(trim($request->email));

        // If the email belongs to a non-customer account (admin/staff/driver/etc.), reject explicitly
        $nonCustomerExists = User::where('email', $email)
            ->where('role', '!=', 'customer')
            ->exists();

        if ($nonCustomerExists) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid email address.',
            ], 422);
        }

        // Only allow active customers to use public forgot password
        $user = User::where('email', $email)
            ->where('role', 'customer')
            ->where('status', 'active')
            ->first();

        if (!$user) {
            // Return success even if not found to prevent email enumeration for non-existent emails
            return response()->json([
                'success' => true,
                'message' => 'If an account with that email exists, a reset code has been sent.',
            ]);
        }

        // Throttle: max 1 request per 60 seconds per email
        $throttleKey = 'password_reset_throttle_' . md5($email);
        if (Cache::has($throttleKey)) {
            return response()->json([
                'success' => false,
                'error' => 'Please wait before requesting another reset code.',
            ], 429);
        }

        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $cacheKey = 'password_reset_' . md5($email);

        Cache::put($cacheKey, [
            'email' => $email,
            'code' => $code,
            'attempts' => 0,
            'verified' => false,
        ], now()->addMinutes(15));

        // Set throttle for 60 seconds
        Cache::put($throttleKey, true, now()->addSeconds(60));

        $this->emailService->sendPasswordResetCode($email, $code, $user->name);

        \App\Models\AuditTrail::create([
            'user_id' => $user->id,
            'action' => 'PASSWORD_RESET_REQUESTED',
            'module' => 'Authentication',
            'description' => "Password reset requested for: {$email}",
            'details' => ['email' => $email],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'If an account with that email exists, a reset code has been sent.',
        ]);
    }

    /**
     * Step 2: Verify the 6-digit code for password reset.
     */
    public function forgotPasswordVerifyCode(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'code' => 'required|string|size:6',
        ]);

        $email = strtolower(trim($request->email));
        $cacheKey = 'password_reset_' . md5($email);
        $cached = Cache::get($cacheKey);

        if (!$cached) {
            return response()->json([
                'success' => false,
                'error' => 'Reset code has expired. Please request a new one.',
            ], 422);
        }

        if ($cached['attempts'] >= 5) {
            Cache::forget($cacheKey);

            \App\Models\AuditTrail::create([
                'user_id' => null,
                'action' => 'PASSWORD_RESET_FAILED',
                'module' => 'Authentication',
                'description' => "Password reset code verification failed (too many attempts) for: {$email}",
                'details' => ['email' => $email, 'reason' => 'too_many_attempts'],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Too many failed attempts. Please request a new reset code.',
            ], 429);
        }

        if ($cached['code'] !== $request->code) {
            $cached['attempts']++;
            Cache::put($cacheKey, $cached, now()->addMinutes(15));
            $remaining = 5 - $cached['attempts'];
            return response()->json([
                'success' => false,
                'error' => "Invalid code. {$remaining} attempt(s) remaining.",
            ], 422);
        }

        // Mark as verified
        $cached['verified'] = true;
        Cache::put($cacheKey, $cached, now()->addMinutes(15));

        return response()->json([
            'success' => true,
            'message' => 'Code verified. You can now set a new password.',
        ]);
    }

    /**
     * Step 3: Reset the password after code verification.
     */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $email = strtolower(trim($request->email));
        $cacheKey = 'password_reset_' . md5($email);
        $cached = Cache::get($cacheKey);

        if (!$cached || empty($cached['verified'])) {
            return response()->json([
                'success' => false,
                'error' => 'Reset code not verified or session expired. Please start over.',
            ], 422);
        }

        $user = User::where('email', $email)
            ->where('role', 'customer')
            ->where('status', 'active')
            ->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'Account not found.',
            ], 404);
        }

        $user->update(['password' => Hash::make($request->password)]);

        Cache::forget($cacheKey);

        // Send security notification
        $emailService = $this->emailService;
        $userCopy = $user->replicate();
        $userCopy->id = $user->id;
        $userCopy->email = $user->email;
        $ip = $request->ip();
        dispatch(function () use ($emailService, $userCopy, $ip) {
            try {
                $emailService->sendSecurityUpdateNotification($userCopy, 'Password Reset', $ip);
            } catch (\Exception $e) {
                // Silent fail
            }
        })->afterResponse();

        \App\Models\AuditTrail::create([
            'user_id' => $user->id,
            'action' => 'PASSWORD_RESET',
            'module' => 'Authentication',
            'description' => "Password reset completed for: {$email}",
            'details' => ['email' => $email],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Password has been reset successfully. You can now log in with your new password.',
        ]);
    }
}
