<?php

namespace App\Http\Controllers;

use App\Http\Resources\SaleResource;
use App\Services\SaleService;
use App\Services\NotificationService;
use App\Services\EmailService;
use App\Models\Customer;
use App\Models\Sale;
use App\Models\User;
use App\Traits\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    use AuditLogger;
    public function __construct(
        private SaleService $saleService,
        private NotificationService $notificationService,
        private EmailService $emailService
    ) {}

    /**
     * Find the User account linked to a sale's customer (by email).
     */
    private function findCustomerUser($sale): ?User
    {
        if (!$sale->customer || !$sale->customer->email) {
            return null;
        }
        return User::where('email', $sale->customer->email)
            ->where('role', 'customer')
            ->where('status', 'active')
            ->first();
    }

    /**
     * Send order notification to admins and optionally to the customer.
     */
    private function sendOrderNotification($sale, string $type, string $adminTitle, string $adminMessage, ?string $customerTitle = null, ?string $customerMessage = null): void
    {
        $data = [
            'sale_id' => $sale->id,
            'transaction_id' => $sale->transaction_id,
            'status' => $sale->status,
        ];

        // Notify admins
        $this->notificationService->notifyAdmins($type, $adminTitle, $adminMessage, $data);

        // Notify customer if applicable
        if ($customerTitle && $customerMessage) {
            $customerUser = $this->findCustomerUser($sale);
            if ($customerUser) {
                $this->notificationService->notifyCustomerUser($customerUser->id, $type, $customerTitle, $customerMessage, $data);
            }
        }
    }

    /**
     * Get all sales.
     */
    public function index(): JsonResponse
    {
        try {
            $sales = $this->saleService->getAllSales();
            return response()->json([
                'success' => true,
                'data' => SaleResource::collection($sales),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch sales',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get orders for the currently authenticated customer.
     */
    public function myOrders(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $customer = Customer::where('email', $user->email)->first();

            if (!$customer) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                ]);
            }

            $sales = Sale::where('customer_id', $customer->id)
                ->with(['items.product.variety'])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => SaleResource::collection($sales),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch orders',
            ], 500);
        }
    }

    /**
     * Create a new order (POS — pending, no stock deduction).
     */
    public function storeOrder(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'items' => 'required|array|min:1',
                'items.*.product_id' => 'required|integer|exists:products,product_id',
                'items.*.quantity' => 'required|integer|min:1',
                'items.*.unit_price' => 'required|numeric|min:0.01',
                'customer_id' => 'nullable|integer|exists:customers,id',
                'new_customer_name' => 'nullable|string|max:255',
                'new_customer_contact' => 'nullable|string|max:255',
                'new_customer_email' => 'nullable|email|max:255',
                'new_customer_address' => 'nullable|string|max:500',
                'new_customer_landmark' => 'nullable|string|max:500',
                'discount' => 'nullable|numeric|min:0',
                'amount_tendered' => 'nullable|numeric|min:0',
                'payment_method' => 'nullable|string|in:cash,gcash,cod,pay_later',
                'reference_number' => 'nullable|string',
                'payment_proof' => 'nullable|array',
                'payment_proof.*' => 'image|mimes:jpeg,png,jpg,gif,webp|max:5120',
                'notes' => 'nullable|string|max:500',
                'delivery_address' => 'nullable|string|max:500',
                'delivery_fee' => 'nullable|numeric|min:0',
                'distance_km' => 'nullable|numeric|min:0',
            ]);

            // Handle payment proof file uploads (GCash screenshots)
            if ($request->hasFile('payment_proof')) {
                $proofPaths = [];
                foreach ($request->file('payment_proof') as $file) {
                    $proofPaths[] = $file->store('payment_proofs', 'public');
                }
                $validated['payment_proof'] = $proofPaths;
            }

            // Auto-resolve customer_id for authenticated customer users
            if (empty($validated['customer_id'])) {
                $authUser = $request->user();
                if ($authUser && $authUser->role === 'customer') {
                    $resolvedCustomer = Customer::where('email', $authUser->email)->first();
                    if ($resolvedCustomer) {
                        $validated['customer_id'] = $resolvedCustomer->id;
                    }
                }
            }

            $newCustomerName = $validated['new_customer_name'] ?? null;
            $newCustomerContact = $validated['new_customer_contact'] ?? null;
            $newCustomerEmail = $validated['new_customer_email'] ?? null;
            $newCustomerAddress = $validated['new_customer_address'] ?? null;
            $newCustomerLandmark = $validated['new_customer_landmark'] ?? null;
            unset($validated['new_customer_name'], $validated['new_customer_contact'], $validated['new_customer_email'], $validated['new_customer_address'], $validated['new_customer_landmark']);

            $sale = $this->saleService->createOrder($validated, $newCustomerName, $newCustomerContact, $newCustomerEmail, $newCustomerAddress, $newCustomerLandmark);

            // Log audit for inline customer creation
            if ($newCustomerName && $sale->customer_id) {
                $this->logAudit('CREATE', 'Customer', "Created customer (via POS): {$newCustomerName}", [
                    'customer_id' => $sale->customer_id,
                    'name' => $newCustomerName,
                    'source' => 'inline_pos',
                ]);
            }

            $this->logAudit('CREATE', 'Orders', "Created order #{$sale->transaction_id} — ₱" . number_format($sale->total, 2), [
                'sale_id' => $sale->id,
                'total' => $sale->total,
                'items_count' => count($validated['items']),
            ]);

            // Notify admins + customer of new order (in-app)
            $customerName = $sale->customer?->name ?? 'Walk-in';
            $this->sendOrderNotification(
                $sale,
                'new_order',
                'New Order',
                "New order #{$sale->transaction_id} from {$customerName} — ₱" . number_format($sale->total, 2),
                'Order Placed',
                "Your order #{$sale->transaction_id} has been placed successfully."
            );

            // Build response
            return response()->json([
                'success' => true,
                'message' => 'Order created successfully',
                'sale_id' => $sale->id,
                'transaction_id' => $sale->transaction_id,
                'data' => new SaleResource($sale),
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Update order status.
     */
    public function updateStatus(int $id, Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'status' => 'required|string|in:pending,processing,shipped,delivered,completed,return_requested,picking_up,picked_up,returned,cancelled',
                'driver_name' => 'nullable|string|max:255',
                'driver_plate_number' => 'nullable|string|max:20',
                'delivery_proof' => 'nullable|array|min:1',
                'delivery_proof.*' => 'image|mimes:jpg,jpeg,png,webp|max:5120',
            ]);

            // Require delivery proof when marking as delivered
            if ($validated['status'] === 'delivered' && !$request->hasFile('delivery_proof')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Proof of delivery is required.',
                ], 422);
            }

            $sale = $this->saleService->updateOrderStatus($id, $validated['status']);

            // Save driver info when shipping
            if ($validated['status'] === 'shipped') {
                $sale->update([
                    'driver_name' => $validated['driver_name'] ?? null,
                    'driver_plate_number' => $validated['driver_plate_number'] ?? null,
                ]);
            }

            // Save delivery proof when marking as delivered
            if ($validated['status'] === 'delivered' && $request->hasFile('delivery_proof')) {
                $proofPaths = [];
                foreach ($request->file('delivery_proof') as $file) {
                    $proofPaths[] = $file->store('delivery-proofs', 'public');
                }
                $sale->update(['delivery_proof' => $proofPaths]);
            }

            $this->logAudit('UPDATE', 'Orders', "Updated order #{$sale->transaction_id} status to {$validated['status']}", [
                'sale_id' => $sale->id,
                'new_status' => $validated['status'],
            ]);

            // Send notifications based on new status
            $statusNotifications = [
                'processing' => [
                    'admin' => ['Order Processing', "Order #{$sale->transaction_id} is now being processed."],
                    'customer' => ['Order Processing', "Your order #{$sale->transaction_id} is now being processed."],
                ],
                'shipped' => [
                    'admin' => ['Order Shipped', "Order #{$sale->transaction_id} has been shipped."],
                    'customer' => ['Order Shipped', "Your order #{$sale->transaction_id} has been shipped and is on its way!"],
                ],
                'delivered' => [
                    'admin' => ['Order Delivered', "Order #{$sale->transaction_id} has been delivered."],
                    'customer' => ['Order Delivered', "Your order #{$sale->transaction_id} has been delivered. Enjoy!"],
                ],
                'cancelled' => [
                    'admin' => ['Order Cancelled', "Order #{$sale->transaction_id} has been cancelled."],
                    'customer' => ['Order Cancelled', "Your order #{$sale->transaction_id} has been cancelled."],
                ],
                'return_requested' => [
                    'admin' => ['Return Requested', "A return has been requested for order #{$sale->transaction_id}."],
                    'customer' => ['Return Requested', "Your return request for order #{$sale->transaction_id} has been submitted."],
                ],
                'picking_up' => [
                    'admin' => ['Picking Up', "Order #{$sale->transaction_id} is being picked up for return."],
                    'customer' => ['Picking Up', "Your order #{$sale->transaction_id} is being picked up for return."],
                ],
                'picked_up' => [
                    'admin' => ['Return Picked Up', "Order #{$sale->transaction_id} has been picked up by the driver. Awaiting verification."],
                    'customer' => ['Return Picked Up', "Your order #{$sale->transaction_id} has been picked up. We'll process your return shortly."],
                ],
                'returned' => [
                    'admin' => ['Order Returned', "Order #{$sale->transaction_id} has been returned."],
                    'customer' => ['Order Returned', "Your order #{$sale->transaction_id} has been returned successfully."],
                ],
            ];

            $status = $validated['status'];
            if (isset($statusNotifications[$status])) {
                $notif = $statusNotifications[$status];
                $this->sendOrderNotification(
                    $sale,
                    'order_' . $status,
                    $notif['admin'][0],
                    $notif['admin'][1],
                    $notif['customer'][0],
                    $notif['customer'][1]
                );

            }

            // Notify driver when order is shipped (delivery assigned)
            if ($status === 'shipped' && !empty($validated['driver_name'])) {
                $driverUser = User::where('role', 'staff')
                    ->where('position', 'Driver')
                    ->where('status', 'active')
                    ->where(function ($q) use ($validated) {
                        $q->where('name', $validated['driver_name'])
                          ->orWhere('truck_plate_number', $validated['driver_plate_number'] ?? '');
                    })
                    ->first();

                if ($driverUser) {
                    $this->notificationService->notifyDriver(
                        $driverUser->id,
                        'delivery_assigned',
                        'New Delivery Assigned',
                        "You have a new delivery: Order #{$sale->transaction_id}.",
                        ['sale_id' => $sale->id, 'transaction_id' => $sale->transaction_id, 'status' => $sale->status]
                    );
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Order status updated successfully',
                'data' => new SaleResource($sale),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Request a return (sets status to return_requested).
     */
    public function processReturn(int $id, Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'return_reason' => 'required|string|max:255',
                'return_notes' => 'nullable|string|max:500',
                'return_proof' => 'required|array|min:1',
                'return_proof.*' => 'image|mimes:jpg,jpeg,png,webp|max:5120',
            ]);

            $proofPaths = [];
            if ($request->hasFile('return_proof')) {
                foreach ($request->file('return_proof') as $file) {
                    $proofPaths[] = $file->store('return-proofs', 'public');
                }
            }

            $sale = $this->saleService->processReturn($id, $validated['return_reason'], $validated['return_notes'] ?? null, $proofPaths ?: null);

            $this->logAudit('UPDATE', 'Orders', "Return requested for order #{$sale->transaction_id}", [
                'sale_id' => $sale->id,
                'reason' => $validated['return_reason'],
            ]);

            // Notify admins of return request
            $customerName = $sale->customer?->name ?? 'Customer';
            $this->sendOrderNotification(
                $sale,
                'return_requested',
                'Return Requested',
                "Return requested for order #{$sale->transaction_id} by {$customerName}. Reason: {$validated['return_reason']}",
            );

            return response()->json([
                'success' => true,
                'message' => 'Return request submitted successfully',
                'data' => new SaleResource($sale),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Accept a return — assign pickup driver, restore stock, mark returned.
     */
    public function acceptReturn(int $id, Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'pickup_driver' => 'nullable|string|max:255',
                'pickup_plate' => 'nullable|string|max:20',
                'pickup_date' => 'nullable|date',
            ]);

            $sale = $this->saleService->acceptReturn(
                $id,
                $validated['pickup_driver'] ?? null,
                $validated['pickup_plate'] ?? null,
                $validated['pickup_date'] ?? null
            );

            $this->logAudit('UPDATE', 'Orders', "Return accepted for order #{$sale->transaction_id}. Pickup assigned.", [
                'sale_id' => $sale->id,
                'pickup_driver' => $validated['pickup_driver'] ?? null,
            ]);

            // Notify customer and admins about pickup
            $this->sendOrderNotification(
                $sale,
                'picking_up',
                'Pickup Assigned',
                "Pickup assigned for return order #{$sale->transaction_id}.",
                'Return Pickup Scheduled',
                "Your return for order #{$sale->transaction_id} has been accepted. Pickup is on the way!"
            );

            // Notify pickup driver (in-band notification, not email)
            $capturedDriverUser = null;
            if (!empty($validated['pickup_driver'])) {
                $driverUser = User::where('role', 'staff')
                    ->where('position', 'Driver')
                    ->where('status', 'active')
                    ->where(function ($q) use ($validated) {
                        $q->where('name', $validated['pickup_driver'])
                          ->orWhere('truck_plate_number', $validated['pickup_plate'] ?? '');
                    })
                    ->first();

                if ($driverUser) {
                    $capturedDriverUser = $driverUser;
                    $this->notificationService->notifyDriver(
                        $driverUser->id,
                        'pickup_assigned',
                        'New Pickup Assigned',
                        "You have a new pickup: Return order #{$sale->transaction_id}.",
                        ['sale_id' => $sale->id, 'transaction_id' => $sale->transaction_id, 'status' => $sale->status]
                    );
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Return accepted. Pickup driver assigned.',
                'data' => new SaleResource($sale),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Reject a return — revert to delivered.
     */
    public function rejectReturn(int $id): JsonResponse
    {
        try {
            $sale = $this->saleService->rejectReturn($id);

            $this->logAudit('UPDATE', 'Orders', "Return rejected for order #{$sale->transaction_id}. Reverted to delivered.", [
                'sale_id' => $sale->id,
            ]);

            // Send rejection emails non-blocking
            $emailService = $this->emailService;
            $saleCopy = $sale;
            $txnId = $sale->transaction_id;
            dispatch(function () use ($emailService, $saleCopy, $txnId) {
                try {
                    $emailService->sendOrderStatusToAdmin(
                        $saleCopy,
                        'Return Rejected',
                        "Return request for order #{$txnId} has been rejected. Order reverted to delivered."
                    );
                    $emailService->sendOrderStatusToCustomer(
                        $saleCopy,
                        'Return Request Rejected',
                        "Your return request for order #{$txnId} has been rejected. The order remains as delivered."
                    );
                } catch (\Throwable $e) {
                    // Silent
                }
            })->afterResponse();

            return response()->json([
                'success' => true,
                'message' => 'Return rejected. Order reverted to delivered.',
                'data' => new SaleResource($sale),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Get a single sale.
     */
    public function markReturned(int $id): JsonResponse
    {
        try {
            $sale = $this->saleService->markReturned($id);

            $this->logAudit('UPDATE', 'Orders', "Order #{$sale->transaction_id} marked as returned. Stock not yet restored — awaiting manual restock.", [
                'sale_id' => $sale->id,
            ]);

            // Notify admins of returned order
            $this->sendOrderNotification(
                $sale,
                'order_returned',
                'Order Returned',
                "Order #{$sale->transaction_id} has been returned. Ready for restocking.",
            );

            return response()->json([
                'success' => true,
                'message' => 'Order marked as returned. Use "Restock Items" to restore stock for items in good condition.',
                'data' => new SaleResource($sale),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Restock selected items from a returned order.
     */
    public function restockItems(Request $request, int $id): JsonResponse
    {
        try {
            $validated = $request->validate([
                'items' => 'required|array|min:1',
                'items.*.id' => 'required|integer|exists:sale_items,id',
                'items.*.quantity' => 'required|integer|min:1',
                'notes' => 'nullable|string|max:500',
            ]);

            $sale = $this->saleService->restockItems($id, $validated['items'], $request->input('notes'));

            $this->logAudit('UPDATE', 'Orders', "Restocked " . count($validated['items']) . " item(s) from returned order #{$sale->transaction_id}.", [
                'sale_id' => $sale->id,
                'items' => $validated['items'],
            ]);

            // Notify admins of restocked items
            $itemCount = count($validated['items']);
            $this->sendOrderNotification(
                $sale,
                'order_restocked',
                'Items Restocked',
                "Restocked {$itemCount} item(s) from returned order #{$sale->transaction_id}.",
            );

            return response()->json([
                'success' => true,
                'message' => 'Selected items have been restocked.',
                'data' => new SaleResource($sale),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Get a single sale.
     */
    public function show(int $id): JsonResponse
    {
        try {
            $sale = \App\Models\Sale::with(['customer', 'items.product.variety'])->findOrFail($id);
            return response()->json([
                'success' => true,
                'data' => new SaleResource($sale),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Sale not found',
            ], 404);
        }
    }

    /**
     * Mark an order as paid.
     */
    public function markPaid(int $id, Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'payment_method' => 'required|string|in:cash,gcash',
                'reference_number' => 'nullable|string|unique:sales,reference_number',
                'amount_tendered' => 'nullable|numeric|min:0',
                'payment_proof' => 'nullable|array',
                'payment_proof.*' => 'image|mimes:jpeg,png,jpg,gif,webp|max:5120',
            ]);

            $data = [
                'payment_method' => $validated['payment_method'],
                'reference_number' => $validated['reference_number'] ?? null,
                'amount_tendered' => $validated['amount_tendered'] ?? null,
            ];

            // Handle payment proof file uploads
            if ($request->hasFile('payment_proof')) {
                $proofPaths = [];
                foreach ($request->file('payment_proof') as $file) {
                    $proofPaths[] = $file->store('payment_proofs', 'public');
                }
                $data['payment_proof'] = $proofPaths;
            }

            $sale = $this->saleService->markPaid($id, $data);

            $this->logAudit('UPDATE', 'Orders', "Marked order #{$sale->transaction_id} as paid via {$validated['payment_method']}", [
                'sale_id' => $sale->id,
                'payment_method' => $validated['payment_method'],
            ]);

            $payMethod = strtoupper($validated['payment_method']);
            $this->sendOrderNotification(
                $sale,
                'order_paid',
                'Payment Received',
                "Payment received for order #{$sale->transaction_id} via {$payMethod}.",
                'Payment Confirmed',
                "Your payment for order #{$sale->transaction_id} via {$payMethod} has been confirmed."
            );

            return response()->json([
                'success' => true,
                'message' => 'Payment recorded successfully',
                'data' => new SaleResource($sale),
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Void a sale.
     */
    public function void(int $id, Request $request): JsonResponse
    {
        try {
            $user = auth()->user();

            // Super Admin & Admin can use their own password; Secretary needs admin/super_admin password
            if ($user->role === 'super_admin' || $user->role === 'admin') {
                // Admin or Super Admin must confirm with their own password
                $request->validate([
                    'admin_password' => 'required|string',
                ]);

                if (!\Illuminate\Support\Facades\Hash::check($request->admin_password, $user->password)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Incorrect password.',
                    ], 403);
                }
            } else {
                // Staff/Secretary must provide an admin or super_admin password
                $request->validate([
                    'admin_password' => 'required|string',
                ]);

                // Try to match against any super_admin or admin user
                $authorizedUser = \App\Models\User::whereIn('role', ['super_admin', 'admin'])
                    ->where('status', 'active')
                    ->get()
                    ->first(function ($admin) use ($request) {
                        return \Illuminate\Support\Facades\Hash::check($request->admin_password, $admin->password);
                    });

                if (!$authorizedUser) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Invalid Admin/Super Admin password.',
                    ], 403);
                }
            }

            $voidedBy = $user->name;
            $authorizedBy = isset($authorizedUser) ? $authorizedUser->name : $user->name;

            $sale = $this->saleService->voidSale($id, $request->reason, $voidedBy, $authorizedBy);

            $this->logAudit('DELETE', 'Sales', "Voided order #{$sale->transaction_id}" . ($request->reason ? " — Reason: {$request->reason}" : ''), [
                'sale_id' => $sale->id,
                'transaction_id' => $sale->transaction_id,
                'reason' => $request->reason,
                'voided_by' => $voidedBy,
                'authorized_by' => $authorizedBy,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Sale voided successfully',
                'data' => new SaleResource($sale),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Get sales statistics.
     */
    public function stats(): JsonResponse
    {
        try {
            $stats = $this->saleService->getStats();
            return response()->json([
                'success' => true,
                'data' => $stats,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch stats',
            ], 500);
        }
    }

    /**
     * Get per-product sales for growth analysis.
     */
    public function productGrowth(Request $request): JsonResponse
    {
        try {
            $period = $request->query('period', 'monthly');
            $customStart = $request->query('custom_start');
            $customEnd = $request->query('custom_end');
            $month = $request->query('month');       // YYYY-MM for daily/weekly
            $year = $request->query('year');          // int for monthly/bi-annually
            $yearFrom = $request->query('year_from'); // int for annually
            $yearTo = $request->query('year_to');     // int for annually
            $data = $this->saleService->getProductSalesGrowth($period, $customStart, $customEnd, $month, $year ? (int)$year : null, $yearFrom ? (int)$yearFrom : null, $yearTo ? (int)$yearTo : null);
            return response()->json([
                'success' => true,
                'data' => $data,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch product growth data',
            ], 500);
        }
    }

    /**
     * Check if a GCash reference number is already used.
     */
    public function checkReference(Request $request): JsonResponse
    {
        $request->validate(['reference_number' => 'required|string']);
        $exists = \App\Models\Sale::where('reference_number', $request->reference_number)->exists();
        return response()->json([
            'success' => true,
            'data' => ['available' => !$exists],
        ]);
    }

    /**
     * Send order confirmation emails — called from frontend after user closes success modal.
     */
    public function sendOrderEmail(int $id): JsonResponse
    {
        $sale = \App\Models\Sale::with(['customer', 'items.product.variety'])->find($id);
        if ($sale) {
            $emailService = $this->emailService;
            dispatch(function () use ($emailService, $sale) {
                try {
                    $emailService->sendNewOrderToAdmin($sale);
                    $emailService->sendOrderPlacedToCustomer($sale);
                } catch (\Throwable $e) {
                    // Silent
                }
            })->afterResponse();
        }
        return response()->json(['success' => true]);
    }

    /**
     * Send status-related emails — called fire-and-forget from frontend after status update.
     * Keeps email sending separate from the status update so the UI isn't blocked.
     */
    public function sendStatusEmail(int $id): JsonResponse
    {
        $sale = \App\Models\Sale::with(['customer', 'items.product.variety'])->find($id);
        if (!$sale) {
            return response()->json(['success' => true]);
        }

        $statusNotifications = [
            'processing' => [
                'admin' => ['Order Processing', "Order #{$sale->transaction_id} is now being processed."],
                'customer' => ['Order Processing', "Your order #{$sale->transaction_id} is now being processed."],
            ],
            'shipped' => [
                'admin' => ['Order Shipped', "Order #{$sale->transaction_id} has been shipped."],
                'customer' => ['Order Shipped', "Your order #{$sale->transaction_id} has been shipped and is on its way!"],
            ],
            'delivered' => [
                'admin' => ['Order Delivered', "Order #{$sale->transaction_id} has been delivered."],
                'customer' => ['Order Delivered', "Your order #{$sale->transaction_id} has been delivered. Enjoy!"],
            ],
            'cancelled' => [
                'admin' => ['Order Cancelled', "Order #{$sale->transaction_id} has been cancelled."],
                'customer' => ['Order Cancelled', "Your order #{$sale->transaction_id} has been cancelled."],
            ],
            'return_requested' => [
                'admin' => ['Return Requested', "A return has been requested for order #{$sale->transaction_id}."],
                'customer' => ['Return Requested', "Your return request for order #{$sale->transaction_id} has been submitted."],
            ],
            'picking_up' => [
                'admin' => ['Picking Up', "Order #{$sale->transaction_id} is being picked up for return."],
                'customer' => ['Picking Up', "Your order #{$sale->transaction_id} is being picked up for return."],
            ],
            'picked_up' => [
                'admin' => ['Return Picked Up', "Order #{$sale->transaction_id} has been picked up by the driver. Awaiting verification."],
                'customer' => ['Return Picked Up', "Your order #{$sale->transaction_id} has been picked up. We'll process your return shortly."],
            ],
            'returned' => [
                'admin' => ['Order Returned', "Order #{$sale->transaction_id} has been returned."],
                'customer' => ['Order Returned', "Your order #{$sale->transaction_id} has been returned successfully."],
            ],
        ];

        $status = $sale->status;
        $notif = $statusNotifications[$status] ?? null;

        $emailService = $this->emailService;
        dispatch(function () use ($emailService, $sale, $status, $notif) {
            try {
                if ($notif) {
                    $emailService->sendOrderStatusToAdmin($sale, $notif['admin'][0], $notif['admin'][1]);
                    $emailService->sendOrderStatusToCustomer($sale, $notif['customer'][0], $notif['customer'][1]);
                }

                // Send driver delivery email if shipped
                if ($status === 'shipped' && $sale->driver_name) {
                    $driverUser = \App\Models\User::where('role', 'staff')
                        ->where('position', 'Driver')
                        ->where('status', 'active')
                        ->where(function ($q) use ($sale) {
                            $q->where('name', $sale->driver_name)
                              ->orWhere('truck_plate_number', $sale->driver_plate_number ?? '');
                        })
                        ->first();

                    if ($driverUser) {
                        $emailService->sendDeliveryAssigned($sale, $driverUser);
                    }
                }

                // Send driver pickup email if picking_up (return)
                if ($status === 'picking_up' && $sale->return_pickup_driver) {
                    $driverUser = \App\Models\User::where('role', 'staff')
                        ->where('position', 'Driver')
                        ->where('status', 'active')
                        ->where(function ($q) use ($sale) {
                            $q->where('name', $sale->return_pickup_driver)
                              ->orWhere('truck_plate_number', $sale->return_pickup_plate ?? '');
                        })
                        ->first();

                    if ($driverUser) {
                        $emailService->sendDeliveryAssigned($sale, $driverUser);
                    }
                }
            } catch (\Throwable $e) {
                \Log::warning("sendStatusEmail failed for sale #{$sale->id} (status: {$status}): " . $e->getMessage());
            }
        })->afterResponse();

        return response()->json(['success' => true]);
    }

    /**
     * Send payment-related emails — called fire-and-forget from frontend after payment.
     */
    public function sendPaymentEmail(int $id): JsonResponse
    {
        $sale = \App\Models\Sale::with(['customer'])->find($id);
        if (!$sale) {
            return response()->json(['success' => true]);
        }

        $payMethod = strtoupper($sale->payment_method ?? 'UNKNOWN');
        $emailService = $this->emailService;

        dispatch(function () use ($emailService, $sale, $payMethod) {
            try {
                $emailService->sendOrderStatusToAdmin($sale, 'Payment Received', "Payment received for order #{$sale->transaction_id} via {$payMethod}.");
                $emailService->sendOrderStatusToCustomer($sale, 'Payment Confirmed', "Your payment for order #{$sale->transaction_id} via {$payMethod} has been confirmed.");
            } catch (\Throwable $e) {
                // Silent
            }
        })->afterResponse();

        return response()->json(['success' => true]);
    }
}
