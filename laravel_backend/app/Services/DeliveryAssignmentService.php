<?php

namespace App\Services;

use App\Models\DeliveryAssignment;
use App\Models\DeliveryItem;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Collection;

/**
 * Service class for Delivery Assignments
 * Handles all business logic related to deliveries
 */
class DeliveryAssignmentService
{
    private const CACHE_KEY = 'deliveries_all';
    private const CACHE_TTL = 300; // 5 minutes

    /**
     * Get all delivery assignments with relations
     */
    public function getAllDeliveries(): Collection
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return DeliveryAssignment::with(['driver', 'customer:id,name', 'items'])
                ->orderBy('delivery_date', 'desc')
                ->orderBy('created_at', 'desc')
                ->get();
        });
    }

    /**
     * Get deliveries for a specific driver
     */
    public function getDeliveriesByDriver(int $driverId): Collection
    {
        return DeliveryAssignment::with(['customer', 'items'])
            ->where('driver_id', $driverId)
            ->orderBy('delivery_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Get a single delivery
     */
    public function getDeliveryById(int $id): ?DeliveryAssignment
    {
        return DeliveryAssignment::with(['driver', 'customer', 'items'])->find($id);
    }

    /**
     * Create a new delivery assignment with items
     */
    public function createDelivery(array $data): DeliveryAssignment
    {
        return DB::transaction(function () use ($data) {
            $items = $data['items'] ?? [];
            unset($data['items']);

            $data['delivery_number'] = DeliveryAssignment::generateDeliveryNumber();

            $delivery = DeliveryAssignment::create($data);

            foreach ($items as $item) {
                $item['delivery_assignment_id'] = $delivery->id;
                $item['total'] = ($item['quantity'] ?? 0) * ($item['price'] ?? 0);
                DeliveryItem::create($item);
            }

            $this->clearCache();
            return $delivery->load(['driver', 'customer', 'items']);
        });
    }

    /**
     * Update a delivery assignment
     */
    public function updateDelivery(DeliveryAssignment $delivery, array $data): DeliveryAssignment
    {
        return DB::transaction(function () use ($delivery, $data) {
            $items = $data['items'] ?? null;
            unset($data['items']);

            $delivery->update($data);

            if ($items !== null) {
                // Replace items
                $delivery->items()->delete();
                foreach ($items as $item) {
                    $item['delivery_assignment_id'] = $delivery->id;
                    $item['total'] = ($item['quantity'] ?? 0) * ($item['price'] ?? 0);
                    DeliveryItem::create($item);
                }
            }

            $this->clearCache();
            return $delivery->fresh()->load(['driver', 'customer', 'items']);
        });
    }

    /**
     * Update delivery status (driver action)
     */
    public function updateStatus(DeliveryAssignment $delivery, string $status, ?string $driverNotes = null, ?string $proofPath = null): DeliveryAssignment
    {
        switch ($status) {
            case 'In Transit':
                $delivery->markInTransit();
                break;
            case 'Delivered':
                $delivery->markDelivered($driverNotes, $proofPath);
                break;
            case 'Failed':
                $delivery->markFailed($driverNotes);
                break;
            default:
                $delivery->update(['status' => $status]);
                break;
        }

        $this->clearCache();
        return $delivery->fresh()->load(['driver', 'customer', 'items']);
    }

    /**
     * Archive a delivery assignment (move to archives)
     */
    public function deleteDelivery(DeliveryAssignment $delivery): bool
    {
        $result = $delivery->archive();
        $this->clearCache();
        return $result;
    }

    /**
     * Clear cache
     */
    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
        DashboardService::clearStatsCache();
    }

    /**
     * Get delivery statistics
     */
    public function getStatistics(?int $driverId = null): array
    {
        $query = $driverId
            ? DeliveryAssignment::where('driver_id', $driverId)
            : DeliveryAssignment::query();

        $all = $query->get();

        return [
            'total' => $all->count(),
            'pending' => $all->where('status', 'Pending')->count(),
            'in_transit' => $all->where('status', 'In Transit')->count(),
            'delivered' => $all->where('status', 'Delivered')->count(),
            'failed' => $all->where('status', 'Failed')->count(),
            'cancelled' => $all->where('status', 'Cancelled')->count(),
        ];
    }
}
