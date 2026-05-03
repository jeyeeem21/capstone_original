<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\User;
use App\Models\Sale;
use App\Services\CustomerService;
use App\Services\EmailService;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\SaleResource;
use App\Traits\ApiResponse;
use App\Traits\AuditLogger;
use App\Traits\HasCaching;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;

class CustomerController extends Controller
{
    use ApiResponse, AuditLogger, HasCaching;

    protected CustomerService $customerService;
    protected EmailService $emailService;

    public function __construct(CustomerService $customerService, EmailService $emailService)
    {
        $this->customerService = $customerService;
        $this->emailService = $emailService;
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $customers = $this->customerService->getAllCustomers();
        CustomerResource::preloadUsers();
        
        return $this->successResponse(
            CustomerResource::collection($customers),
            'Customers retrieved successfully'
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        // Strip spaces from phone number before validation
        $data = $request->all();
        if (isset($data['phone'])) {
            $data['phone'] = preg_replace('/\s+/', '', $data['phone']);
        }
        $request->merge(['phone' => $data['phone'] ?? '']);
        
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'contact' => 'required|string|max:255',
            'phone' => [
                'required',
                'string',
                'regex:/^(\+63\d{10}|09\d{9})$/'
            ],
            'email' => [
                'required',
                'email',
                function ($attribute, $value, $fail) {
                    if (Customer::withTrashed()->withArchived()->where('email', $value)->exists()) {
                        $fail('This email is already registered.');
                    } elseif (User::withTrashed()->withArchived()->where('email', $value)->exists()) {
                        $fail('This email is already registered.');
                    }
                },
            ],
            'address' => 'required|string',
            'address_landmark' => 'nullable|string',
            'status' => 'required|in:Active,Inactive',
        ], [
            'email.unique' => 'This email is already registered.',
            'email.email' => 'Please enter a valid email address.',
            'phone.regex' => 'Phone must be in format: +63 followed by 10 digits (e.g., +63 912 345 6789) or 09 followed by 9 digits (e.g., 09171234567).',
        ]);

        $customer = $this->customerService->createCustomer($validated);

        $this->logAudit('CREATE', 'Customer', "Created customer: {$customer->name}", [
            'customer_id' => $customer->id,
            'name' => $customer->name,
        ]);

        return $this->successResponse(
            new CustomerResource($customer),
            'Customer created successfully',
            201
        );
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $customer = $this->customerService->getCustomerById((int) $id);
        
        if (!$customer) {
            return $this->errorResponse('Customer not found', 404);
        }
        
        return $this->successResponse(
            new CustomerResource($customer),
            'Customer retrieved successfully'
        );
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);
        
        // Strip spaces from phone number before validation
        $data = $request->all();
        if (isset($data['phone'])) {
            $data['phone'] = preg_replace('/\s+/', '', $data['phone']);
        }
        $request->merge(['phone' => $data['phone'] ?? '']);
        
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'contact' => 'required|string|max:255',
            'phone' => [
                'required',
                'string',
                'regex:/^(\+63\d{10}|09\d{9})$/'
            ],
            'email' => [
                'required',
                'email',
                function ($attribute, $value, $fail) use ($customer) {
                    // Check customers table including soft-deleted & archived, excluding self
                    if (Customer::withTrashed()->withArchived()->where('email', $value)->where('id', '!=', $customer->id)->exists()) {
                        $fail('This email is already registered.');
                        return;
                    }
                    // Check users table (including soft-deleted & archived) but allow the linked customer account
                    $existsInUsers = User::withTrashed()->withArchived()->where('email', $value)
                        ->where(function ($q) use ($customer) {
                            $q->where('email', '!=', $customer->email)
                              ->orWhere('role', '!=', 'customer');
                        })
                        ->exists();
                    if ($existsInUsers) {
                        $fail('This email is already registered.');
                    }
                },
            ],
            'address' => 'required|string',
            'address_landmark' => 'nullable|string',
            'status' => 'required|in:Active,Inactive',
        ], [
            'email.unique' => 'This email is already registered.',
            'email.email' => 'Please enter a valid email address.',
            'phone.regex' => 'Phone must be in format: +63 followed by 10 digits (e.g., +63 912 345 6789) or 09 followed by 9 digits (e.g., 09171234567).',
        ]);

        // Track what changed before updating
        $oldEmail = $customer->email;
        $changes = [];
        $fieldLabels = [
            'name' => 'Business Name', 'contact' => 'Contact Person',
            'phone' => 'Phone', 'email' => 'Email',
            'address' => 'Address', 'status' => 'Status',
        ];
        foreach ($validated as $field => $newValue) {
            $oldValue = $customer->$field;
            if ((string) $oldValue !== (string) $newValue) {
                $label = $fieldLabels[$field] ?? ucfirst($field);
                $changes[] = "{$label}: \"{$oldValue}\" → \"{$newValue}\"";
            }
        }

        $customer = $this->customerService->updateCustomer($customer, $validated);

        // Sync linked User account if it exists
        $linkedUser = User::where('email', $oldEmail)->where('role', 'customer')->first();
        if ($linkedUser) {
            $userUpdates = ['email' => $customer->email, 'name' => $customer->name, 'phone' => $customer->phone];
            if ($customer->contact) {
                $parts = explode(' ', $customer->contact, 2);
                $userUpdates['first_name'] = $parts[0];
                $userUpdates['last_name'] = $parts[1] ?? '';
            }
            $linkedUser->update($userUpdates);
        }

        $this->logAudit('UPDATE', 'Customer', "Updated customer: {$customer->name}", [
            'customer_id' => $customer->id,
            'changes' => $changes,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Customer updated successfully',
            'data' => new CustomerResource($customer),
            '_changes' => $changes,
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);
        
        // Set status to Inactive before soft deleting
        $customer->status = 'Inactive';
        $customer->save();
        
        // Now soft delete (sets deleted_at)
        $this->customerService->deleteCustomer($customer);

        $this->logAudit('ARCHIVE', 'Customer', "Archived customer: {$customer->name}", [
            'customer_id' => $customer->id,
            'name' => $customer->name,
            'email' => $customer->email,
            'status_changed' => 'Active → Inactive',
        ]);

        return $this->successResponse(
            null,
            'Customer archived successfully'
        );
    }

    /**
     * Check if email is already taken
     */
    public function checkEmail(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'customer_id' => 'nullable|integer', // For edit mode, to exclude current customer
        ]);

        $email = $request->email;
        $customerId = $request->customer_id;

        // Check customers table (including soft-deleted and archived)
        $existsInCustomers = Customer::withTrashed()->withArchived()->where('email', $email)
            ->when($customerId, function ($query) use ($customerId) {
                return $query->where('id', '!=', $customerId);
            })
            ->exists();

        // Also check users table including soft-deleted & archived (exclude linked customer account)
        $userQuery = User::withTrashed()->withArchived()->where('email', $email);
        if ($customerId) {
            $customer = Customer::find($customerId);
            if ($customer) {
                $userQuery->where(function ($q) use ($customer) {
                    $q->where('email', '!=', $customer->email)
                      ->orWhere('role', '!=', 'customer');
                });
            }
        }
        $existsInUsers = $userQuery->exists();

        $exists = $existsInCustomers || $existsInUsers;

        return $this->successResponse(
            ['available' => !$exists],
            $exists ? 'Email is already taken' : 'Email is available'
        );
    }

    /**
     * Get all orders/sales for a specific customer
     */
    public function orders(string $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);

        $sales = Sale::where('customer_id', $customer->id)
            ->with(['items.product.variety'])
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse(
            SaleResource::collection($sales),
            'Customer orders retrieved successfully'
        );
    }

    /**
     * Send email verification code to customer's email
     */
    public function sendVerificationCode(Request $request, string $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);

        if (!$customer->email) {
            return $this->errorResponse('Customer has no email address.', 422);
        }

        // Generate 6-digit code
        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Store in cache for 10 minutes
        $cacheKey = "email_verify_{$customer->id}";
        Cache::put($cacheKey, [
            'code' => $code,
            'email' => $customer->email,
            'attempts' => 0,
        ], now()->addMinutes(10));

        // Send email after response
        $emailService = $this->emailService;
        $customerEmail = $customer->email;
        dispatch(function () use ($emailService, $customerEmail, $code) {
            try {
                $emailService->sendVerificationCode($customerEmail, $code);
            } catch (\Exception $e) {
                \Log::warning("Failed to send customer verification code to {$customerEmail}: " . $e->getMessage());
            }
        })->afterResponse();

        $this->logAudit('VERIFY_EMAIL', 'Customer', "Sent verification code to {$customer->email}", [
            'customer_id' => $customer->id,
            'email' => $customer->email,
        ]);

        return $this->successResponse(
            ['sent' => true],
            'Verification code sent to ' . $customer->email
        );
    }

    /**
     * Verify the code entered by admin
     */
    public function verifyCode(Request $request, string $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);

        $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $cacheKey = "email_verify_{$customer->id}";
        $cached = Cache::get($cacheKey);

        if (!$cached) {
            return $this->errorResponse('Verification code has expired. Please request a new one.', 422);
        }

        if ($cached['attempts'] >= 5) {
            Cache::forget($cacheKey);
            return $this->errorResponse('Too many failed attempts. Please request a new code.', 429);
        }

        if ($cached['code'] !== $request->code) {
            // Increment attempts
            $cached['attempts']++;
            Cache::put($cacheKey, $cached, now()->addMinutes(10));
            $remaining = 5 - $cached['attempts'];
            return $this->errorResponse("Invalid verification code. {$remaining} attempts remaining.", 422);
        }

        // Code is valid — clear it
        Cache::forget($cacheKey);

        $this->logAudit('EMAIL_VERIFIED', 'Customer', "Email verified for {$customer->email}", [
            'customer_id' => $customer->id,
            'email' => $customer->email,
        ]);

        return $this->successResponse(
            ['verified' => true, 'email' => $customer->email],
            'Email verified successfully'
        );
    }

    /**
     * Create a user account for a customer
     */
    public function createAccount(Request $request, string $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);

        // Check if account already exists
        $existingUser = User::where('email', $customer->email)->first();
        if ($existingUser) {
            return $this->errorResponse('An account with this email already exists.', 422);
        }

        $validated = $request->validate([
            'password' => 'required|string|min:8|confirmed',
        ], [
            'password.min' => 'Password must be at least 8 characters.',
            'password.confirmed' => 'Password confirmation does not match.',
        ]);

        $user = User::create([
            'name' => $customer->name,
            'first_name' => $customer->contact ? explode(' ', $customer->contact)[0] : null,
            'last_name' => $customer->contact ? (count(explode(' ', $customer->contact)) > 1 ? implode(' ', array_slice(explode(' ', $customer->contact), 1)) : null) : null,
            'email' => $customer->email,
            'password' => Hash::make($validated['password']),
            'role' => 'customer',
            'phone' => $customer->phone,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $this->logAudit('CREATE_ACCOUNT', 'Customer', "Created customer account for {$customer->name} ({$customer->email})", [
            'customer_id' => $customer->id,
            'user_id' => $user->id,
            'email' => $customer->email,
        ]);

        // Send welcome email after response to avoid blocking
        $emailService = $this->emailService;
        dispatch(function () use ($emailService, $user) {
            $emailService->sendWelcomeEmail($user);
        })->afterResponse();

        return $this->successResponse(
            [
                'user_id' => $user->id,
                'email' => $user->email,
                'role' => $user->role,
            ],
            'Customer account created successfully'
        );
    }

    /**
     * Fire-and-forget: send store notification emails.
     */
    public function sendStoreEmail(string $id): JsonResponse
    {
        $customer = Customer::find($id);
        if (!$customer) return response()->json(['success' => true]);

        $emailService = $this->emailService;
        dispatch(function () use ($emailService, $customer) {
            try {
                $emailService->sendAdminAlert(
                    "New Customer Added: {$customer->name}",
                    'New Customer Added',
                    "A new customer \"{$customer->name}\" ({$customer->email}) has been added to the system."
                );

                $emailService->sendAlertTo(
                    $customer->email,
                    'Welcome! You Have Been Added as a Customer',
                    'Welcome to Our System',
                    "Hi {$customer->name},\n\nYou have been added as a customer in our system.\n\nContact: {$customer->contact}\nEmail: {$customer->email}\nPhone: {$customer->phone}\n\nIf you have any questions, please don't hesitate to contact us."
                );
            } catch (\Throwable $e) { /* silent */ }
        })->afterResponse();

        return response()->json(['success' => true]);
    }

    /**
     * Fire-and-forget: send update notification emails.
     */
    public function sendUpdateEmail(string $id, Request $request): JsonResponse
    {
        $customer = Customer::find($id);
        if (!$customer) return response()->json(['success' => true]);

        $changes = $request->input('changes', []);
        if (empty($changes)) return response()->json(['success' => true]);

        $changesSummary = "Changes made:\n" . implode("\n", $changes);
        $emailService = $this->emailService;

        dispatch(function () use ($emailService, $customer, $changesSummary) {
            try {
                $emailService->sendAdminAlert(
                    "Customer Updated: {$customer->name}",
                    'Customer Information Updated',
                    "The customer \"{$customer->name}\" ({$customer->email}) has been updated in the system.\n\n{$changesSummary}"
                );

                $emailService->sendAlertTo(
                    $customer->email,
                    'Your Information Has Been Updated',
                    'Your Account Information Was Updated',
                    "Hi {$customer->name},\n\nYour information has been updated by the administrator.\n\n{$changesSummary}\n\nIf you did not expect these changes, please contact us immediately."
                );
            } catch (\Throwable $e) { /* silent */ }
        })->afterResponse();

        return response()->json(['success' => true]);
    }
}
