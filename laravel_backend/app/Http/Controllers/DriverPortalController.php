<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\DeliveryAssignment;
use App\Models\Sale;
use App\Models\User;
use App\Http\Resources\DeliveryAssignmentResource;
use App\Services\NotificationService;
use App\Services\EmailService;
use App\Traits\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DriverPortalController extends Controller
{
    use AuditLogger;

    protected NotificationService $notificationService;
    protected EmailService $emailService;

    public function __construct(NotificationService $notificationService, EmailService $emailService)
    {
        $this->notificationService = $notificationService;
        $this->emailService = $emailService;
    }
    /**
     * Find the Driver record linked to the authenticated user.
     * Matches by email first, then by name+plate number.
     */
    private function findLinkedDriver(Request $request): ?Driver
    {
        $user = $request->user();

        // Match by email first
        $driver = Driver::where('email', $user->email)->first();

        if (!$driver && $user->truck_plate_number) {
            $driver = Driver::where('plate_number', $user->truck_plate_number)->first();
        }

        if (!$driver) {
            $driver = Driver::where('name', $user->name)->first();
        }

        return $driver;
    }

    /**
     * Get the driver's dashboard data: stats, today's deliveries, chart data.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $driver = $this->findLinkedDriver($request);

        $deliveryAssignments = collect();
        $driverId = null;

        if ($driver) {
            $driverId = $driver->id;
            $deliveryAssignments = DeliveryAssignment::with(['customer:id,name', 'items'])
                ->where('driver_id', $driver->id)
                ->orderBy('delivery_date', 'desc')
                ->get();
        }

        // Also get sales assigned to this driver (by name/plate text match)
        $salesQuery = Sale::with(['customer:id,name,address,phone', 'items'])
            ->where(function ($q) use ($user) {
                $q->where('driver_name', $user->name);
                if ($user->truck_plate_number) {
                    $q->orWhere('driver_plate_number', $user->truck_plate_number);
                }
            });
        $sales = $salesQuery->orderBy('created_at', 'desc')->get();

        // Stats from delivery assignments
        $today = now()->toDateString();
        $todayDeliveries = $deliveryAssignments->filter(fn($d) => $d->delivery_date?->toDateString() === $today);

        $stats = [
            'total_assignments' => $deliveryAssignments->count(),
            'today_deliveries' => $todayDeliveries->count(),
            'pending' => $deliveryAssignments->where('status', 'Pending')->count(),
            'in_transit' => $deliveryAssignments->where('status', 'In Transit')->count(),
            'delivered' => $deliveryAssignments->where('status', 'Delivered')->count(),
            'failed' => $deliveryAssignments->where('status', 'Failed')->count(),
            'cancelled' => $deliveryAssignments->where('status', 'Cancelled')->count(),
            // Sales-based stats
            'total_orders' => $sales->count(),
            'orders_shipped' => $sales->where('status', 'shipped')->count(),
            'orders_delivered' => $sales->where('status', 'delivered')->count(),
            'orders_completed' => $sales->where('status', 'completed')->count(),
            'orders_returned' => $sales->whereIn('status', ['return_requested', 'picking_up', 'picked_up', 'returned'])->count(),
        ];

        // Chart data: deliveries per month for current year
        $currentYear = now()->year;
        $monthlyData = [];
        for ($m = 1; $m <= 12; $m++) {
            $monthDeliveries = $deliveryAssignments->filter(function ($d) use ($currentYear, $m) {
                return $d->delivery_date && $d->delivery_date->year === $currentYear && $d->delivery_date->month === $m;
            })->count();
            $monthSales = $sales->filter(function ($s) use ($currentYear, $m) {
                return $s->created_at->year === $currentYear && $s->created_at->month === $m;
            })->count();
            $monthlyData[] = [
                'label' => now()->setMonth($m)->format('M'),
                'deliveries' => $monthDeliveries + $monthSales,
            ];
        }

        // Daily data for current month
        $currentMonth = now()->month;
        $daysInMonth = now()->daysInMonth;
        $dailyData = [];
        for ($d = 1; $d <= $daysInMonth; $d++) {
            $dayDeliveries = $deliveryAssignments->filter(function ($del) use ($currentYear, $currentMonth, $d) {
                return $del->delivery_date && $del->delivery_date->year === $currentYear
                    && $del->delivery_date->month === $currentMonth && $del->delivery_date->day === $d;
            })->count();
            $daySales = $sales->filter(function ($s) use ($currentYear, $currentMonth, $d) {
                return $s->created_at->year === $currentYear
                    && $s->created_at->month === $currentMonth && $s->created_at->day === $d;
            })->count();
            $dailyData[] = [
                'label' => (string) $d,
                'deliveries' => $dayDeliveries + $daySales,
            ];
        }

        // Yearly data (last 3 years)
        $yearlyData = [];
        for ($y = $currentYear - 2; $y <= $currentYear; $y++) {
            $yearDeliveries = $deliveryAssignments->filter(fn($del) => $del->delivery_date && $del->delivery_date->year === $y)->count();
            $yearSales = $sales->filter(fn($s) => $s->created_at->year === $y)->count();
            $yearlyData[] = [
                'label' => (string) $y,
                'deliveries' => $yearDeliveries + $yearSales,
            ];
        }

        // Status breakdown for donut chart
        $statusBreakdown = [
            ['name' => 'Pending', 'value' => $stats['pending'] + $sales->where('status', 'pending')->count(), 'color' => '#f59e0b'],
            ['name' => 'Shipped', 'value' => $stats['in_transit'] + $stats['orders_shipped'], 'color' => '#3b82f6'],
            ['name' => 'Delivered', 'value' => $stats['delivered'] + $stats['orders_delivered'] + $stats['orders_completed'], 'color' => '#22c55e'],
            ['name' => 'Failed/Returned', 'value' => $stats['failed'] + $stats['orders_returned'], 'color' => '#ef4444'],
        ];
        // Filter out zero-value entries
        $statusBreakdown = array_values(array_filter($statusBreakdown, fn($s) => $s['value'] > 0));

        // Today's deliveries detail (for delivery assignments)
        $todayDetail = $todayDeliveries->map(function ($d) {
            return [
                'id' => $d->id,
                'delivery_number' => $d->delivery_number,
                'destination' => $d->destination,
                'status' => $d->status,
                'priority' => $d->priority,
                'customer' => $d->customer?->name ?? $d->contact_person ?? 'N/A',
                'items_count' => $d->items->count(),
                'total' => $d->items->sum('total'),
                'time' => $d->delivery_date?->format('M d, Y'),
                'contact_person' => $d->contact_person,
                'contact_phone' => $d->contact_phone,
            ];
        })->values();

        // Also add today's sales that are shipped/to be delivered
        $todaySales = $sales->filter(function ($s) use ($today) {
            return in_array($s->status, ['shipped', 'processing', 'pending'])
                && $s->created_at->toDateString() <= $today;
        })->take(10)->map(function ($s) {
            return [
                'id' => 'sale-' . $s->id,
                'delivery_number' => $s->transaction_id,
                'destination' => $s->delivery_address ?: ($s->customer?->address ?? 'N/A'),
                'status' => $this->mapSaleStatusToDelivery($s->status),
                'priority' => 'Normal',
                'customer' => $s->customer?->name ?? 'Walk-in',
                'items_count' => $s->items->count(),
                'total' => (float) $s->total,
                'time' => $s->created_at->format('M d, Y'),
                'contact_person' => $s->customer?->name ?? 'N/A',
                'contact_phone' => $s->customer?->phone ?? 'N/A',
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => [
                'driver_id' => $driverId,
                'driver_name' => $user->name,
                'stats' => $stats,
                'today_deliveries' => $todayDetail->merge($todaySales)->values(),
                'chart' => [
                    'daily' => $dailyData,
                    'monthly' => $monthlyData,
                    'yearly' => $yearlyData,
                ],
                'status_breakdown' => $statusBreakdown,
            ],
        ]);
    }

    /**
     * Get all deliveries for the logged-in driver (both systems).
     */
    public function myDeliveries(Request $request): JsonResponse
    {
        $user = $request->user();
        $driver = $this->findLinkedDriver($request);

        $result = collect();

        // 1. Delivery Assignments
        if ($driver) {
            $assignments = DeliveryAssignment::with(['customer:id,name', 'items'])
                ->where('driver_id', $driver->id)
                ->orderBy('delivery_date', 'desc')
                ->get();
            foreach ($assignments as $a) {
                $result->push([
                    'id' => $a->id,
                    'source' => 'assignment',
                    'delivery_number' => $a->delivery_number,
                    'destination' => $a->destination,
                    'contact_person' => $a->contact_person,
                    'contact_phone' => $a->contact_phone,
                    'delivery_date' => $a->delivery_date?->toDateString(),
                    'priority' => $a->priority,
                    'status' => $a->status,
                    'notes' => $a->notes,
                    'driver_notes' => $a->driver_notes,
                    'proof_of_delivery' => $a->proof_of_delivery,
                    'picked_up_at' => $a->picked_up_at?->toDateTimeString(),
                    'delivered_at' => $a->delivered_at?->toDateTimeString(),
                    'customer' => $a->customer?->name ?? $a->contact_person ?? 'N/A',
                    'items' => $a->items->map(fn($i) => [
                        'product_name' => $i->product_name,
                        'quantity' => $i->quantity,
                        'unit' => $i->unit,
                        'price' => (float) $i->price,
                        'total' => (float) $i->total,
                    ])->toArray(),
                    'total_value' => (float) $a->items->sum('total'),
                    'created_at' => $a->created_at?->toDateTimeString(),
                ]);
            }
        }

        // 2. Sales assigned to this driver (delivery OR return pickup)
        $sales = Sale::with(['customer:id,name,address,phone', 'items.product.variety'])
            ->where(function ($q) use ($user) {
                $q->where('driver_name', $user->name)
                  ->orWhere('return_pickup_driver', $user->name);
                if ($user->truck_plate_number) {
                    $q->orWhere('driver_plate_number', $user->truck_plate_number)
                      ->orWhere('return_pickup_plate', $user->truck_plate_number);
                }
            })
            ->orderBy('created_at', 'desc')
            ->get();

        foreach ($sales as $s) {
            // Determine if this driver is the return pickup driver (not the original delivery driver)
            $isReturnPickup = in_array($s->status, ['picking_up', 'picked_up', 'returned'])
                && ($s->return_pickup_driver === $user->name
                    || ($user->truck_plate_number && $s->return_pickup_plate === $user->truck_plate_number));

            $result->push([
                'id' => 'sale-' . $s->id,
                'source' => 'order',
                'is_return_pickup' => $isReturnPickup,
                'delivery_number' => $s->transaction_id,
                'destination' => $s->delivery_address ?: ($s->customer?->address ?? 'N/A'),
                'contact_person' => $s->customer?->name ?? 'Walk-in',
                'contact_phone' => $s->customer?->phone ?? 'N/A',
                'delivery_date' => $isReturnPickup
                    ? ($s->return_pickup_date ?? $s->updated_at?->toDateString())
                    : $s->created_at?->toDateString(),
                'priority' => 'Normal',
                'status' => $this->mapSaleStatusToDelivery($s->status),
                'notes' => $s->notes,
                'driver_notes' => null,
                'proof_of_delivery' => $s->delivery_proof,
                'picked_up_at' => null,
                'delivered_at' => $s->status === 'delivered' || $s->status === 'completed' || $s->status === 'returned' || $s->status === 'picked_up'
                    ? $s->updated_at?->toDateTimeString() : null,
                'customer' => $s->customer?->name ?? 'Walk-in',
                'items' => $s->items->map(fn($i) => [
                    'product_name' => $i->product?->product_name ?? 'Product',
                    'variety' => $i->product?->variety?->name ?? null,
                    'weight' => $i->product?->weight ? (float) $i->product->weight : null,
                    'quantity' => $i->quantity,
                    'unit' => $i->product?->unit ?? 'sack',
                    'price' => (float) $i->unit_price,
                    'total' => (float) $i->subtotal,
                ])->toArray(),
                'total_value' => (float) $s->total,
                'delivery_fee' => (float) ($s->delivery_fee ?? 0),
                'payment_method' => $s->payment_method,
                'payment_status' => $s->payment_status,
                'created_at' => $s->created_at?->toDateTimeString(),
            ]);
        }

        // Sort by date descending
        $sorted = $result->sortByDesc('delivery_date')->values();

        return response()->json([
            'success' => true,
            'data' => $sorted,
        ]);
    }

    /**
     * Map sale status to delivery-like status for consistent frontend display.
     */
    private function mapSaleStatusToDelivery(string $saleStatus): string
    {
        return match ($saleStatus) {
            'pending', 'processing' => 'Pending',
            'shipped' => 'Shipped',
            'delivered', 'completed' => 'Delivered',
            'picking_up' => 'Picking Up',
            'picked_up' => 'Picked Up',
            'returned' => 'Returned',
            'return_requested' => 'Return Requested',
            'cancelled', 'voided' => 'Cancelled',
            default => 'Pending',
        };
    }

    /**
     * Update a Sale (order) status from the driver portal.
     * Allows drivers to mark orders as delivered (with proof) or in transit.
     */
    public function updateOrderStatus(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        // Verify this sale belongs to this driver (delivery or return pickup)
        $sale = Sale::with(['customer', 'items'])
            ->where('id', $id)
            ->where(function ($q) use ($user) {
                $q->where('driver_name', $user->name)
                  ->orWhere('return_pickup_driver', $user->name);
                if ($user->truck_plate_number) {
                    $q->orWhere('driver_plate_number', $user->truck_plate_number)
                      ->orWhere('return_pickup_plate', $user->truck_plate_number);
                }
            })
            ->first();

        if (!$sale) {
            return response()->json([
                'success' => false,
                'message' => 'Order not found or not assigned to you.',
            ], 404);
        }

        $validated = $request->validate([
            'status' => 'required|string|in:delivered,failed,picked_up',
            'driver_notes' => 'nullable|string|max:1000',
            'delivery_proof' => 'nullable|array|min:1',
            'delivery_proof.*' => 'image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        // Require proof when marking as delivered (not for return pickups)
        if ($validated['status'] === 'delivered' && !$request->hasFile('delivery_proof')) {
            return response()->json([
                'success' => false,
                'message' => 'Proof of delivery is required.',
            ], 422);
        }

        $oldStatus = $sale->status;

        if ($validated['status'] === 'picked_up' && $sale->status === 'picking_up') {
            // Driver confirms return pickup complete — admin still needs to verify
            $saleService = app(\App\Services\SaleService::class);
            $saleService->updateOrderStatus($sale->id, 'picked_up');
            $sale->refresh();

            if ($validated['driver_notes'] ?? null) {
                $sale->notes = ($sale->notes ? $sale->notes . "\n" : '') . "Driver (Pickup): " . $validated['driver_notes'];
                $sale->save();
            }

            $this->sendDriverOrderNotifications($sale, 'picked_up', $user->name);

            // Send email after response to avoid blocking
            $emailService = $this->emailService;
            $saleSnapshot = $sale;
            $driverName = $user->name;
            dispatch(function () use ($emailService, $saleSnapshot, $driverName) {
                try {
                    $emailService->sendOrderStatusToAdmin(
                        $saleSnapshot,
                        'Return Picked Up',
                        "Order #{$saleSnapshot->transaction_id} has been picked up by {$driverName}. Awaiting admin/super admin verification before marking as returned."
                    );
                    $emailService->sendOrderStatusToCustomer(
                        $saleSnapshot,
                        'Return Picked Up',
                        "Your order #{$saleSnapshot->transaction_id} has been picked up by the driver. We'll verify and process your return shortly."
                    );
                } catch (\Throwable $e) {
                    \Log::warning("Picked up email failed for sale #{$saleSnapshot->id}: " . $e->getMessage());
                }
            })->afterResponse();

        } elseif ($validated['status'] === 'delivered') {
            $sale->status = 'delivered';

            // Store proof images
            $proofPaths = [];
            foreach ($request->file('delivery_proof') as $file) {
                $proofPaths[] = $file->store('delivery-proofs', 'public');
            }
            $sale->delivery_proof = $proofPaths;

            if ($validated['driver_notes'] ?? null) {
                $sale->notes = ($sale->notes ? $sale->notes . "\n" : '') . "Driver: " . $validated['driver_notes'];
            }

            $sale->save();

            // Notify admin + customer
            $this->sendDriverOrderNotifications($sale, 'delivered', $user->name);

        } elseif ($validated['status'] === 'failed') {
            $sale->status = 'return_requested';

            if ($validated['driver_notes'] ?? null) {
                $sale->notes = ($sale->notes ? $sale->notes . "\n" : '') . "Driver (Failed): " . $validated['driver_notes'];
            }

            $sale->save();

            $this->sendDriverOrderNotifications($sale, 'failed', $user->name);
        }

        $this->logAudit('UPDATE', 'Orders', "Driver updated order #{$sale->transaction_id} status: {$oldStatus} → {$sale->status}", [
            'sale_id' => $sale->id,
            'old_status' => $oldStatus,
            'new_status' => $sale->status,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Order status updated successfully.',
        ]);
    }

    /**
     * Mark a COD order as paid (driver collected payment on delivery).
     */
    public function markOrderPaid(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $sale = Sale::with('customer')
            ->where('id', $id)
            ->where(function ($q) use ($user) {
                $q->where('driver_name', $user->name);
                if ($user->truck_plate_number) {
                    $q->orWhere('driver_plate_number', $user->truck_plate_number);
                }
            })
            ->first();

        if (!$sale) {
            return response()->json([
                'success' => false,
                'message' => 'Order not found or not assigned to you.',
            ], 404);
        }

        if ($sale->payment_status === 'paid') {
            return response()->json([
                'success' => false,
                'message' => 'This order is already marked as paid.',
            ], 422);
        }

        $validated = $request->validate([
            'amount_tendered' => 'required|numeric|min:0',
        ]);

        $sale->update([
            'payment_status' => 'paid',
            'payment_method' => 'cash',
            'paid_at' => now(),
            'amount_tendered' => (float) $validated['amount_tendered'],
            'change_amount' => max(0, (float) $validated['amount_tendered'] - (float) $sale->total),
        ]);

        $this->logAudit('UPDATE', 'Orders', "Driver collected COD payment for order #{$sale->transaction_id}", [
            'sale_id' => $sale->id,
            'amount_tendered' => $validated['amount_tendered'],
        ]);

        // Notify admins
        $this->notificationService->notifyAdmins(
            'payment_collected',
            'COD Payment Collected',
            "Driver {$user->name} collected ₱" . number_format($sale->total, 2) . " for order #{$sale->transaction_id}.",
            ['sale_id' => $sale->id, 'transaction_id' => $sale->transaction_id]
        );

        return response()->json([
            'success' => true,
            'message' => 'Payment recorded successfully.',
            'data' => [
                'change_amount' => max(0, (float) $validated['amount_tendered'] - (float) $sale->total),
            ],
        ]);
    }

    /**
     * Send notifications when driver updates an order status.
     */
    private function sendDriverOrderNotifications(Sale $sale, string $action, string $driverName): void
    {
        $sale->load('customer');

        if ($action === 'delivered') {
            // Notify admins
            $this->notificationService->notifyAdmins(
                'order_delivered',
                'Order Delivered',
                "Order #{$sale->transaction_id} has been delivered by {$driverName}.",
                ['sale_id' => $sale->id, 'transaction_id' => $sale->transaction_id]
            );

            // Notify customer
            if ($sale->customer_id) {
                $customerUser = User::where('email', $sale->customer?->email)->first();
                if ($customerUser) {
                    $this->notificationService->notifyCustomerUser(
                        $customerUser->id,
                        'order_delivered',
                        'Order Delivered',
                        "Your order #{$sale->transaction_id} has been delivered. Enjoy!",
                        ['sale_id' => $sale->id, 'transaction_id' => $sale->transaction_id]
                    );
                }
            }

            // Email will be sent via separate fire-and-forget request from frontend

        } elseif ($action === 'failed') {
            $this->notificationService->notifyAdmins(
                'delivery_failed',
                'Delivery Failed',
                "Delivery failed for order #{$sale->transaction_id} by {$driverName}.",
                ['sale_id' => $sale->id, 'transaction_id' => $sale->transaction_id]
            );

        } elseif ($action === 'picked_up') {
            // Notify admins that driver has picked up the return — awaiting admin verification
            $this->notificationService->notifyAdmins(
                'order_picked_up',
                'Return Picked Up by Driver',
                "Order #{$sale->transaction_id} has been picked up by {$driverName}. Awaiting admin verification to mark as returned.",
                ['sale_id' => $sale->id, 'transaction_id' => $sale->transaction_id]
            );

            // Notify customer
            if ($sale->customer_id) {
                $customerUser = User::where('email', $sale->customer?->email)->first();
                if ($customerUser) {
                    $this->notificationService->notifyCustomerUser(
                        $customerUser->id,
                        'order_picked_up',
                        'Return Picked Up',
                        "Your order #{$sale->transaction_id} has been picked up by the driver. We'll process your return shortly.",
                        ['sale_id' => $sale->id, 'transaction_id' => $sale->transaction_id]
                    );
                }
            }
        }
    }
}
