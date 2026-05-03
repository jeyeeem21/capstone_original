<?php

namespace App\Services;

use App\Models\Supplier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Database\Eloquent\Collection;

/**
 * Service class for Supplier
 * Handles all business logic related to suppliers
 * Fast caching with proper invalidation for instant loading
 */
class SupplierService
{
    private const CACHE_KEY = 'suppliers_all';
    private const CACHE_TTL = 300; // 5 minutes

    /**
     * Get all suppliers - cached for speed, invalidated on changes
     */
    public function getAllSuppliers(): Collection
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return Supplier::withSum('procurements', 'sacks')
                ->withSum('procurements', 'quantity_kg')
                ->withSum('procurements', 'total_cost')
                ->withCount('procurements')
                ->orderBy('created_at', 'desc')
                ->get();
        });
    }

    /**
     * Get a single supplier
     */
    public function getSupplierById(int $id): ?Supplier
    {
        return Supplier::find($id);
    }

    /**
     * Create a new supplier
     */
    public function createSupplier(array $data): Supplier
    {
        $supplier = Supplier::create($data);
        $this->clearCache();
        return $supplier;
    }

    /**
     * Update an existing supplier
     */
    public function updateSupplier(Supplier $supplier, array $data): Supplier
    {
        $supplier->update($data);
        $this->clearCache();
        return $supplier->fresh();
    }

    /**
     * Archive a supplier (move to archives)
     */
    public function deleteSupplier(Supplier $supplier): bool
    {
        $result = $supplier->archive();
        $this->clearCache();
        return $result;
    }

    /**
     * Clear cache - called after any data modification
     */
    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
        DashboardService::clearStatsCache();
    }

    /**
     * Get supplier statistics
     */
    public function getStatistics(): array
    {
        $suppliers = $this->getAllSuppliers();
        
        return [
            'total' => $suppliers->count(),
            'active' => $suppliers->where('status', 'Active')->count(),
            'inactive' => $suppliers->where('status', 'Inactive')->count(),
            'total_products' => $suppliers->sum('products'),
        ];
    }
}
