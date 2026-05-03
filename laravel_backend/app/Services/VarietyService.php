<?php

namespace App\Services;

use App\Models\Variety;
use Illuminate\Support\Facades\Cache;
use Illuminate\Database\Eloquent\Collection;

/**
 * Service class for Variety
 * Handles all business logic related to varieties
 * Fast caching with proper invalidation for instant loading
 */
class VarietyService
{
    private const CACHE_KEY = 'varieties_all';
    private const CACHE_TTL = 300; // 5 minutes

    /**
     * Get all varieties - cached for speed, invalidated on changes
     */
    public function getAllVarieties(): Collection
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return Variety::withCount('products')->orderBy('name')->get();
        });
    }

    /**
     * Get a single variety
     */
    public function getVarietyById(int $id): ?Variety
    {
        return Variety::find($id);
    }

    /**
     * Create a new variety
     */
    public function createVariety(array $data): Variety
    {
        $data['color'] = $data['color'] ?? '#22c55e';

        $variety = Variety::create($data);
        $this->clearCache();
        return $variety;
    }

    /**
     * Update an existing variety
     */
    public function updateVariety(Variety $variety, array $data): Variety
    {
        $variety->update($data);
        $this->clearCache();
        return $variety->fresh();
    }

    /**
     * Archive a variety (move to archives)
     */
    public function deleteVariety(Variety $variety): bool
    {
        $result = $variety->archive();
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
     * Get variety statistics
     */
    public function getStatistics(): array
    {
        $varieties = $this->getAllVarieties();

        return [
            'total'          => $varieties->count(),
            'active'         => $varieties->where('status', 'Active')->count(),
            'inactive'       => $varieties->where('status', 'Inactive')->count(),
            'total_products' => $varieties->sum('products_count'),
        ];
    }
}
