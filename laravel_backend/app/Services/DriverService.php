<?php

namespace App\Services;

use App\Models\Driver;
use Illuminate\Support\Facades\Cache;
use Illuminate\Database\Eloquent\Collection;

/**
 * Service class for Driver
 * Handles all business logic related to drivers
 */
class DriverService
{
    private const CACHE_KEY = 'drivers_all';
    private const CACHE_TTL = 300; // 5 minutes

    /**
     * Get all drivers - cached for speed
     */
    public function getAllDrivers(): Collection
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return Driver::orderBy('created_at', 'desc')->get();
        });
    }

    /**
     * Get a single driver
     */
    public function getDriverById(int $id): ?Driver
    {
        return Driver::find($id);
    }

    /**
     * Create a new driver
     */
    public function createDriver(array $data): Driver
    {
        $driver = Driver::create($data);
        $this->clearCache();
        return $driver;
    }

    /**
     * Update an existing driver
     */
    public function updateDriver(Driver $driver, array $data): Driver
    {
        $driver->update($data);
        $this->clearCache();
        return $driver->fresh();
    }

    /**
     * Archive a driver (move to archives)
     */
    public function deleteDriver(Driver $driver): bool
    {
        $result = $driver->archive();
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
     * Get driver statistics
     */
    public function getStatistics(): array
    {
        $drivers = $this->getAllDrivers();

        return [
            'total' => $drivers->count(),
            'active' => $drivers->where('status', 'Active')->count(),
            'inactive' => $drivers->where('status', 'Inactive')->count(),
            'on_leave' => $drivers->where('status', 'On Leave')->count(),
            'total_deliveries' => $drivers->sum('total_deliveries'),
        ];
    }
}
