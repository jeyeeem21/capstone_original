<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use App\Models\Customer;
use App\Models\Procurement;
use App\Models\User;
use App\Services\SupplierService;
use App\Services\EmailService;
use App\Http\Resources\SupplierResource;
use App\Http\Resources\ProcurementResource;
use App\Traits\ApiResponse;
use App\Traits\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
{
    use ApiResponse, AuditLogger;

    protected SupplierService $supplierService;
    protected EmailService $emailService;

    public function __construct(SupplierService $supplierService, EmailService $emailService)
    {
        $this->supplierService = $supplierService;
        $this->emailService = $emailService;
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $suppliers = $this->supplierService->getAllSuppliers();
        
        return $this->successResponse(
            SupplierResource::collection($suppliers),
            'Suppliers retrieved successfully'
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
                'unique:suppliers,email',
                'unique:customers,email',
                'unique:users,email',
            ],
            'address' => 'required|string',
            'status' => 'required|in:Active,Inactive',
        ], [
            'email.unique' => 'This email is already registered.',
            'email.email' => 'Please enter a valid email address.',
            'phone.regex' => 'Phone must be in format: +63 followed by 10 digits (e.g., +63 912 345 6789) or 09 followed by 9 digits (e.g., 09171234567).',
        ]);

        $supplier = $this->supplierService->createSupplier($validated);

        $this->logAudit('CREATE', 'Supplier', "Created supplier: {$supplier->name}", [
            'supplier_id' => $supplier->id,
            'name' => $supplier->name,
        ]);

        return $this->successResponse(
            new SupplierResource($supplier),
            'Supplier created successfully',
            201
        );
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $supplier = $this->supplierService->getSupplierById((int) $id);
        
        if (!$supplier) {
            return $this->errorResponse('Supplier not found', 404);
        }
        
        return $this->successResponse(
            new SupplierResource($supplier),
            'Supplier retrieved successfully'
        );
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);
        
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
                Rule::unique('suppliers', 'email')->ignore($supplier->id),
                'unique:customers,email',
                'unique:users,email',
            ],
            'address' => 'required|string',
            'status' => 'required|in:Active,Inactive',
        ], [
            'email.unique' => 'This email is already registered.',
            'email.email' => 'Please enter a valid email address.',
            'phone.regex' => 'Phone must be in format: +63 followed by 10 digits (e.g., +63 912 345 6789) or 09 followed by 9 digits (e.g., 09171234567).',
        ]);

        // Track what changed before updating
        $changes = [];
        $fieldLabels = [
            'name' => 'Business Name', 'contact' => 'Contact Person',
            'phone' => 'Phone', 'email' => 'Email',
            'address' => 'Address', 'status' => 'Status',
        ];
        foreach ($validated as $field => $newValue) {
            $oldValue = $supplier->$field;
            if ((string) $oldValue !== (string) $newValue) {
                $label = $fieldLabels[$field] ?? ucfirst($field);
                $changes[] = "{$label}: \"{$oldValue}\" → \"{$newValue}\"";
            }
        }

        $supplier = $this->supplierService->updateSupplier($supplier, $validated);

        $this->logAudit('UPDATE', 'Supplier', "Updated supplier: {$supplier->name}", [
            'supplier_id' => $supplier->id,
            'changes' => $changes,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Supplier updated successfully',
            'data' => new SupplierResource($supplier),
            '_changes' => $changes,
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);
        
        // Set status to Inactive before soft deleting
        $supplier->status = 'Inactive';
        $supplier->saveQuietly(); // Use saveQuietly to avoid double events
        
        // Now soft delete (sets deleted_at)
        $this->supplierService->deleteSupplier($supplier);

        $this->logAudit('ARCHIVE', 'Supplier', "Archived supplier: {$supplier->name}", [
            'supplier_id' => $supplier->id,
        ]);

        return $this->successResponse(
            null,
            'Supplier archived successfully'
        );
    }

    /**
     * Check if email is already taken
     */
    public function checkEmail(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'supplier_id' => 'nullable|integer', // For edit mode, to exclude current supplier
        ]);

        $email = $request->email;
        $supplierId = $request->supplier_id;

        // Check suppliers table
        $existsInSuppliers = Supplier::where('email', $email)
            ->when($supplierId, function ($query) use ($supplierId) {
                return $query->where('id', '!=', $supplierId);
            })
            ->exists();

        // Also check customers and users tables
        $existsInCustomers = Customer::where('email', $email)->exists();
        $existsInUsers = User::where('email', $email)->exists();

        $exists = $existsInSuppliers || $existsInCustomers || $existsInUsers;

        return $this->successResponse(
            ['available' => !$exists],
            $exists ? 'Email is already taken' : 'Email is available'
        );
    }

    /**
     * Get all procurements for a specific supplier
     */
    public function procurements(string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);
        
        $procurements = Procurement::with(['variety', 'batch', 'dryingProcesses', 'dryingBatchAllocations'])
            ->where('supplier_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse(
            ProcurementResource::collection($procurements),
            "Procurements for {$supplier->name} retrieved successfully"
        );
    }

    /**
     * Fire-and-forget: send store notification emails.
     */
    public function sendStoreEmail(string $id): JsonResponse
    {
        $supplier = Supplier::find($id);
        if (!$supplier) return response()->json(['success' => true]);

        $emailService = $this->emailService;
        dispatch(function () use ($emailService, $supplier) {
            try {
                $emailService->sendAdminAlert(
                    "New Supplier Added: {$supplier->name}",
                    'New Supplier Added',
                    "A new supplier \"{$supplier->name}\" ({$supplier->email}) has been added to the system."
                );

                $emailService->sendAlertTo(
                    $supplier->email,
                    'Welcome! You Have Been Added as a Supplier',
                    'Welcome to Our System',
                    "Hi {$supplier->name},\n\nYou have been added as a supplier in our system.\n\nContact: {$supplier->contact}\nEmail: {$supplier->email}\nPhone: {$supplier->phone}\n\nIf you have any questions, please don't hesitate to contact us."
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
        $supplier = Supplier::find($id);
        if (!$supplier) return response()->json(['success' => true]);

        $changes = $request->input('changes', []);
        if (empty($changes)) return response()->json(['success' => true]);

        $changesSummary = "Changes made:\n" . implode("\n", $changes);

        $emailService = $this->emailService;
        dispatch(function () use ($emailService, $supplier, $changesSummary) {
            try {
                $emailService->sendAdminAlert(
                    "Supplier Updated: {$supplier->name}",
                    'Supplier Information Updated',
                    "The supplier \"{$supplier->name}\" ({$supplier->email}) has been updated in the system.\n\n{$changesSummary}"
                );

                $emailService->sendAlertTo(
                    $supplier->email,
                    'Your Information Has Been Updated',
                    'Your Supplier Information Was Updated',
                    "Hi {$supplier->name},\n\nYour information has been updated by the administrator.\n\n{$changesSummary}\n\nIf you did not expect these changes, please contact us immediately."
                );
            } catch (\Throwable $e) { /* silent */ }
        })->afterResponse();

        return response()->json(['success' => true]);
    }
}
