<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Services\DriverService;
use App\Http\Resources\DriverResource;
use App\Traits\ApiResponse;
use App\Traits\AuditLogger;
use App\Traits\HasCaching;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class DriverController extends Controller
{
    use ApiResponse, AuditLogger, HasCaching;

    protected DriverService $driverService;

    public function __construct(DriverService $driverService)
    {
        $this->driverService = $driverService;
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $drivers = $this->driverService->getAllDrivers();

        return $this->successResponse(
            DriverResource::collection($drivers),
            'Drivers retrieved successfully'
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->all();
        if (isset($data['phone'])) {
            $data['phone'] = preg_replace('/\s+/', '', $data['phone']);
        }
        $request->merge(['phone' => $data['phone'] ?? '']);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact' => 'nullable|string|max:255',
            'phone' => [
                'required',
                'string',
                'regex:/^(\+63\d{10}|09\d{9})$/'
            ],
            'email' => 'required|email|unique:drivers,email',
            'license_number' => 'required|string|unique:drivers,license_number',
            'vehicle_type' => 'nullable|string|max:100',
            'plate_number' => 'nullable|string|max:20',
            'address' => 'nullable|string',
            'status' => 'required|in:Active,Inactive,On Leave',
        ], [
            'email.unique' => 'This email is already registered.',
            'license_number.unique' => 'This license number is already registered.',
            'phone.regex' => 'Phone must be in format: +63 followed by 10 digits or 09 followed by 9 digits.',
        ]);

        $driver = $this->driverService->createDriver($validated);

        $this->logAudit('CREATE', 'Drivers', "Created driver: {$driver->name}", [
            'driver_id' => $driver->id,
            'name' => $driver->name,
            'email' => $driver->email,
            'license_number' => $driver->license_number,
            'status' => $driver->status,
        ]);

        return $this->successResponse(
            new DriverResource($driver),
            'Driver created successfully',
            201
        );
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $driver = $this->driverService->getDriverById($id);

        if (!$driver) {
            return $this->notFoundResponse('Driver not found');
        }

        return $this->successResponse(
            new DriverResource($driver),
            'Driver retrieved successfully'
        );
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $driver = $this->driverService->getDriverById($id);

        if (!$driver) {
            return $this->notFoundResponse('Driver not found');
        }

        $data = $request->all();
        if (isset($data['phone'])) {
            $data['phone'] = preg_replace('/\s+/', '', $data['phone']);
        }
        $request->merge(['phone' => $data['phone'] ?? '']);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'contact' => 'nullable|string|max:255',
            'phone' => [
                'sometimes',
                'required',
                'string',
                'regex:/^(\+63\d{10}|09\d{9})$/'
            ],
            'email' => ['sometimes', 'required', 'email', Rule::unique('drivers')->ignore($driver->id)],
            'license_number' => ['sometimes', 'required', 'string', Rule::unique('drivers')->ignore($driver->id)],
            'vehicle_type' => 'nullable|string|max:100',
            'plate_number' => 'nullable|string|max:20',
            'address' => 'nullable|string',
            'status' => 'sometimes|required|in:Active,Inactive,On Leave',
        ]);

        $oldValues = $driver->only(['name', 'email', 'phone', 'status', 'license_number', 'vehicle_type', 'plate_number']);
        $driver = $this->driverService->updateDriver($driver, $validated);

        $this->logAudit('UPDATE', 'Drivers', "Updated driver: {$driver->name}", [
            'driver_id' => $driver->id,
            'old_values' => $oldValues,
            'new_values' => $driver->only(['name', 'email', 'phone', 'status', 'license_number', 'vehicle_type', 'plate_number']),
        ]);

        return $this->successResponse(
            new DriverResource($driver),
            'Driver updated successfully'
        );
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $driver = $this->driverService->getDriverById($id);

        if (!$driver) {
            return $this->notFoundResponse('Driver not found');
        }

        $this->logAudit('ARCHIVE', 'Drivers', "Archived driver: {$driver->name}", [
            'driver_id' => $driver->id,
            'name' => $driver->name,
            'email' => $driver->email,
        ]);

        $this->driverService->deleteDriver($driver);

        return $this->successResponse(null, 'Driver archived successfully');
    }

    /**
     * Get driver statistics
     */
    public function statistics(): JsonResponse
    {
        return $this->successResponse(
            $this->driverService->getStatistics(),
            'Driver statistics retrieved successfully'
        );
    }
}
