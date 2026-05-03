<?php

namespace App\Http\Controllers;

use App\Models\DeliveryAssignment;
use App\Models\Driver;
use App\Models\User;
use App\Services\DeliveryAssignmentService;
use App\Services\NotificationService;
use App\Services\EmailService;
use App\Http\Resources\DeliveryAssignmentResource;
use App\Traits\ApiResponse;
use App\Traits\AuditLogger;
use App\Traits\HasCaching;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class DeliveryAssignmentController extends Controller
{
    use ApiResponse, AuditLogger, HasCaching;

    protected DeliveryAssignmentService $deliveryService;
    protected NotificationService $notificationService;
    protected EmailService $emailService;

    public function __construct(
        DeliveryAssignmentService $deliveryService,
        NotificationService $notificationService,
        EmailService $emailService
    ) {
        $this->deliveryService = $deliveryService;
        $this->notificationService = $notificationService;
        $this->emailService = $emailService;
    }

    /**
     * Display a listing of all deliveries (admin view)
     */
    public function index(): JsonResponse
    {
        $deliveries = $this->deliveryService->getAllDeliveries();

        return $this->successResponse(
            DeliveryAssignmentResource::collection($deliveries),
            'Deliveries retrieved successfully'
        );
    }

    /**
     * Get deliveries for a specific driver
     */
    public function byDriver(string $driverId): JsonResponse
    {
        $deliveries = $this->deliveryService->getDeliveriesByDriver($driverId);

        return $this->successResponse(
            DeliveryAssignmentResource::collection($deliveries),
            'Driver deliveries retrieved successfully'
        );
    }

    /**
     * Store a newly created delivery assignment
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'driver_id' => 'required|exists:drivers,id',
            'customer_id' => 'nullable|exists:customers,id',
            'destination' => 'required|string',
            'contact_person' => 'nullable|string|max:255',
            'contact_phone' => 'nullable|string|max:20',
            'delivery_date' => 'required|date',
            'priority' => 'required|in:Low,Normal,High,Urgent',
            'status' => 'sometimes|in:Pending,In Transit,Delivered,Failed,Cancelled',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|string|exists:products,product_id',
            'items.*.product_name' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit' => 'sometimes|string',
            'items.*.price' => 'sometimes|numeric|min:0',
        ]);

        $delivery = $this->deliveryService->createDelivery($validated);

        $this->logAudit('CREATE', 'Deliveries', "Created delivery assignment to {$delivery->destination}", [
            'delivery_id' => $delivery->id,
            'driver_id' => $delivery->driver_id,
            'destination' => $delivery->destination,
            'delivery_date' => $delivery->delivery_date,
            'priority' => $delivery->priority,
        ]);

        // Notify the driver user via in-app notification + email
        $driverRecord = Driver::find($delivery->driver_id);
        if ($driverRecord) {
            $driverUser = User::where('role', 'staff')
                ->where('position', 'Driver')
                ->where('status', 'active')
                ->where(function ($q) use ($driverRecord) {
                    $q->where('email', $driverRecord->email)
                      ->orWhere('truck_plate_number', $driverRecord->plate_number)
                      ->orWhere('name', $driverRecord->name);
                })
                ->first();

            if ($driverUser) {
                $this->notificationService->notifyDriver(
                    $driverUser->id,
                    'delivery_assigned',
                    'New Delivery Assigned',
                    "You have a new delivery assignment: {$delivery->delivery_number} to {$delivery->destination}.",
                    ['delivery_id' => $delivery->id, 'delivery_number' => $delivery->delivery_number]
                );

                // Send email in background
                $emailService = $this->emailService;
                $capturedDriverUser = $driverUser;
                $capturedDelivery = $delivery;
                dispatch(function () use ($emailService, $capturedDriverUser, $capturedDelivery) {
                    try {
                        $emailService->sendDeliveryAssignmentNotification($capturedDriverUser, $capturedDelivery);
                    } catch (\Throwable $e) {
                        // Silent — don't block
                    }
                })->afterResponse();
            }
        }

        return $this->successResponse(
            new DeliveryAssignmentResource($delivery),
            'Delivery assignment created successfully',
            201
        );
    }

    /**
     * Display the specified delivery
     */
    public function show(string $id): JsonResponse
    {
        $delivery = $this->deliveryService->getDeliveryById($id);

        if (!$delivery) {
            return $this->notFoundResponse('Delivery not found');
        }

        return $this->successResponse(
            new DeliveryAssignmentResource($delivery),
            'Delivery retrieved successfully'
        );
    }

    /**
     * Update the specified delivery assignment
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $delivery = $this->deliveryService->getDeliveryById($id);

        if (!$delivery) {
            return $this->notFoundResponse('Delivery not found');
        }

        $validated = $request->validate([
            'driver_id' => 'sometimes|exists:drivers,id',
            'customer_id' => 'nullable|exists:customers,id',
            'destination' => 'sometimes|string',
            'contact_person' => 'nullable|string|max:255',
            'contact_phone' => 'nullable|string|max:20',
            'delivery_date' => 'sometimes|date',
            'priority' => 'sometimes|in:Low,Normal,High,Urgent',
            'notes' => 'nullable|string',
            'items' => 'sometimes|array|min:1',
            'items.*.product_id' => 'required_with:items|string|exists:products,product_id',
            'items.*.product_name' => 'required_with:items|string',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'items.*.unit' => 'sometimes|string',
            'items.*.price' => 'sometimes|numeric|min:0',
        ]);

        $oldValues = $delivery->only(['driver_id', 'destination', 'delivery_date', 'priority', 'status']);
        $delivery = $this->deliveryService->updateDelivery($delivery, $validated);

        $this->logAudit('UPDATE', 'Deliveries', "Updated delivery assignment to {$delivery->destination}", [
            'delivery_id' => $delivery->id,
            'old_values' => $oldValues,
            'new_values' => $delivery->only(['driver_id', 'destination', 'delivery_date', 'priority', 'status']),
        ]);

        return $this->successResponse(
            new DeliveryAssignmentResource($delivery),
            'Delivery updated successfully'
        );
    }

    /**
     * Update delivery status (for driver actions)
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $delivery = $this->deliveryService->getDeliveryById($id);

        if (!$delivery) {
            return $this->notFoundResponse('Delivery not found');
        }

        $validated = $request->validate([
            'status' => 'required|in:Pending,In Transit,Delivered,Failed,Cancelled',
            'driver_notes' => 'nullable|string',
        ]);

        $proofPath = null;
        if ($request->hasFile('proof_of_delivery')) {
            $proofPath = $request->file('proof_of_delivery')->store('delivery-proofs', 'public');
        }

        $oldStatus = $delivery->status;
        $delivery = $this->deliveryService->updateStatus(
            $delivery,
            $validated['status'],
            $validated['driver_notes'] ?? null,
            $proofPath
        );

        $this->logAudit('UPDATE', 'Deliveries', "Updated delivery status: {$oldStatus} → {$validated['status']}", [
            'delivery_id' => $delivery->id,
            'old_status' => $oldStatus,
            'new_status' => $validated['status'],
            'driver_notes' => $validated['driver_notes'] ?? null,
        ]);

        return $this->successResponse(
            new DeliveryAssignmentResource($delivery),
            'Delivery status updated successfully'
        );
    }

    /**
     * Remove the specified delivery
     */
    public function destroy(string $id): JsonResponse
    {
        $delivery = $this->deliveryService->getDeliveryById($id);

        if (!$delivery) {
            return $this->notFoundResponse('Delivery not found');
        }

        $this->logAudit('ARCHIVE', 'Deliveries', "Archived delivery to {$delivery->destination}", [
            'delivery_id' => $delivery->id,
            'destination' => $delivery->destination,
            'driver_id' => $delivery->driver_id,
        ]);

        $this->deliveryService->deleteDelivery($delivery);

        return $this->successResponse(null, 'Delivery archived successfully');
    }

    /**
     * Get delivery statistics
     */
    public function statistics(Request $request): JsonResponse
    {
        $driverId = $request->query('driver_id');

        return $this->successResponse(
            $this->deliveryService->getStatistics($driverId ? (int) $driverId : null),
            'Delivery statistics retrieved successfully'
        );
    }
}
