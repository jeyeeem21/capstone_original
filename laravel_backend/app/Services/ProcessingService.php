<?php

namespace App\Services;

use App\Models\Processing;
use App\Models\Procurement;
use App\Models\DryingProcess;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Collection;

/**
 * Service class for Processing
 * Handles all business logic related to rice processing
 * Ultra-fast caching with proper invalidation for instant loading
 */
class ProcessingService
{
    private const CACHE_KEY = 'processings_all';
    private const CACHE_KEY_ACTIVE = 'processings_active';
    private const CACHE_KEY_COMPLETED = 'processings_completed';
    private const CACHE_TTL = 300; // 5 minutes

    /**
     * Get all processings with procurement - cached for speed
     */
    public function getAllProcessings(): Collection
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return Processing::with([
                    'procurement:id,supplier_id,quantity_kg,sacks', 
                    'procurement.supplier:id,name',
                    'dryingProcess:id,procurement_id,batch_id,quantity_kg,sacks,quantity_out,days,status',
                    'dryingProcess.procurement:id,supplier_id',
                    'dryingProcess.procurement.supplier:id,name',
                    'dryingProcess.batch:id,batch_number',
                    'dryingSources:id,procurement_id,batch_id,quantity_kg,sacks,quantity_out,days,status',
                    'dryingSources.procurement:id,supplier_id',
                    'dryingSources.procurement.supplier:id,name',
                    'dryingSources.batch:id,batch_number,variety_id',
                    'dryingSources.batch.variety:id,name,color',
                ])
                ->select(['id', 'procurement_id', 'drying_process_id', 'input_kg', 'output_kg', 'stock_out', 'husk_kg', 'yield_percent', 'operator_name', 'status', 'processing_date', 'completed_date', 'created_at'])
                ->orderBy('created_at', 'desc')
                ->get();
        });
    }

    /**
     * Get active processings (Pending + Processing status) - cached
     */
    public function getActiveProcessings(): Collection
    {
        return Cache::remember(self::CACHE_KEY_ACTIVE, self::CACHE_TTL, function () {
            return Processing::with([
                    'procurement:id,supplier_id,quantity_kg,sacks', 
                    'procurement.supplier:id,name',
                    'dryingProcess:id,procurement_id,batch_id,quantity_kg,sacks,quantity_out,days,status',
                    'dryingProcess.procurement:id,supplier_id',
                    'dryingProcess.procurement.supplier:id,name',
                    'dryingProcess.batch:id,batch_number',
                    'dryingSources:id,procurement_id,batch_id,quantity_kg,sacks,quantity_out,days,status',
                    'dryingSources.procurement:id,supplier_id',
                    'dryingSources.procurement.supplier:id,name',
                    'dryingSources.batch:id,batch_number,variety_id',
                    'dryingSources.batch.variety:id,name,color',
                ])
                ->select(['id', 'procurement_id', 'drying_process_id', 'input_kg', 'output_kg', 'stock_out', 'husk_kg', 'yield_percent', 'operator_name', 'status', 'processing_date', 'completed_date', 'created_at'])
                ->active()
                ->orderBy('created_at', 'desc')
                ->get();
        });
    }

    /**
     * Get completed processings - cached
     */
    public function getCompletedProcessings(): Collection
    {
        return Cache::remember(self::CACHE_KEY_COMPLETED, self::CACHE_TTL, function () {
            return Processing::with([
                    'procurement:id,supplier_id,quantity_kg,sacks', 
                    'procurement.supplier:id,name',
                    'dryingProcess:id,procurement_id,batch_id,quantity_kg,sacks,quantity_out,days,status',
                    'dryingProcess.procurement:id,supplier_id',
                    'dryingProcess.procurement.supplier:id,name',
                    'dryingProcess.batch:id,batch_number',
                    'dryingSources:id,procurement_id,batch_id,quantity_kg,sacks,quantity_out,days,status',
                    'dryingSources.procurement:id,supplier_id',
                    'dryingSources.procurement.supplier:id,name',
                    'dryingSources.batch:id,batch_number,variety_id',
                    'dryingSources.batch.variety:id,name,color',
                ])
                ->select(['id', 'procurement_id', 'drying_process_id', 'input_kg', 'output_kg', 'stock_out', 'husk_kg', 'yield_percent', 'operator_name', 'status', 'processing_date', 'completed_date', 'created_at'])
                ->completed()
                ->orderBy('completed_date', 'desc')
                ->get();
        });
    }

    /**
     * Get a single processing with procurement
     */
    public function getProcessingById(int $id): ?Processing
    {
        return Processing::with('procurement.supplier')->find($id);
    }

    /**
     * Create a new processing record
     * Supports multiple drying sources via drying_process_ids array
     * Input kg is split proportionally across sources
     */
    public function createProcessing(array $data): Processing
    {
        return DB::transaction(function () use ($data) {
            $dryingProcessIds = $data['drying_process_ids'] ?? [];
            $singleDryingId = $data['drying_process_id'] ?? null;
            $procurementId = $data['procurement_id'] ?? null;
            $inputKg = (float) $data['input_kg'];

            // Legacy: if single drying_process_id provided but no array
            if (empty($dryingProcessIds) && $singleDryingId) {
                $dryingProcessIds = [$singleDryingId];
            }

            // Get procurement_id from first drying source
            $primaryDryingId = $dryingProcessIds[0] ?? null;
            if ($primaryDryingId) {
                $drying = DryingProcess::find($primaryDryingId);
                if ($drying) {
                    $procurementId = $drying->procurement_id;
                }
            }

            $processing = Processing::create([
                'procurement_id' => $procurementId,
                'drying_process_id' => $primaryDryingId, // Keep first source for backward compat
                'input_kg' => $inputKg,
                'operator_name' => $data['operator_name'] ?? null,
                'status' => Processing::STATUS_PENDING,
                'processing_date' => $data['processing_date'] ?? now()->toDateString(),
            ]);

            // Calculate proportional split across sources and populate pivot
            if (!empty($dryingProcessIds)) {
                $sources = DryingProcess::whereIn('id', $dryingProcessIds)->lockForUpdate()->get();
                $totalAvailable = $sources->sum(fn($s) => max(0, (float)$s->quantity_kg - (float)$s->quantity_out));

                // VALIDATE: input_kg must not exceed total available from selected drying sources
                if ($inputKg > $totalAvailable) {
                    throw new \Exception(
                        "Input quantity ({$inputKg} kg) exceeds total available from selected drying sources ({$totalAvailable} kg). "
                        . "Please reduce the input quantity."
                    );
                }

                $pivotData = [];
                $allocatedSoFar = 0;

                foreach ($sources as $i => $source) {
                    $remaining = max(0, (float)$source->quantity_kg - (float)$source->quantity_out);
                    
                    // Last source gets the remainder to avoid rounding issues
                    if ($i === $sources->count() - 1) {
                        $share = round($inputKg - $allocatedSoFar, 2);
                    } else {
                        $proportion = $totalAvailable > 0 ? $remaining / $totalAvailable : 1 / $sources->count();
                        $share = round($inputKg * $proportion, 2);
                    }

                    // Clamp share to source's remaining — never exceed what's available
                    $share = min($share, $remaining);
                    $allocatedSoFar += $share;

                    $pivotData[$source->id] = ['quantity_kg' => $share];
                    $source->increment('quantity_out', $share);
                }

                $processing->dryingSources()->attach($pivotData);
            }

            $this->clearCache();
            return $processing->load(['procurement.supplier', 'dryingProcess', 'dryingSources.batch.variety', 'dryingSources.procurement.supplier']);
        });
    }

    /**
     * Update an existing processing
     */
    public function updateProcessing(Processing $processing, array $data): Processing
    {
        return DB::transaction(function () use ($processing, $data) {
            $oldInputKg = (float)$processing->input_kg;
            $newInputKg = isset($data['input_kg']) ? (float)$data['input_kg'] : $oldInputKg;
            
            // If input_kg changed, update quantity_out on all linked drying sources
            if ($oldInputKg !== $newInputKg) {
                $pivotSources = $processing->dryingSources;
                if ($pivotSources->isNotEmpty()) {
                    // Recalculate proportional splits
                    $totalAvailable = $pivotSources->sum(fn($s) => (float)$s->quantity_kg - (float)$s->quantity_out + (float)$s->pivot->quantity_kg);

                    // VALIDATE: new input_kg must not exceed total available
                    if ($newInputKg > $totalAvailable) {
                        throw new \Exception(
                            "Input quantity ({$newInputKg} kg) exceeds total available from drying sources ({$totalAvailable} kg)."
                        );
                    }

                    $allocatedSoFar = 0;
                    $pivotData = [];

                    foreach ($pivotSources as $i => $source) {
                        $oldShare = (float) $source->pivot->quantity_kg;
                        // Reverse old share
                        $source->decrement('quantity_out', $oldShare);
                        $remaining = (float)$source->quantity_kg - (float)$source->quantity_out;
                        
                        if ($i === $pivotSources->count() - 1) {
                            $newShare = round($newInputKg - $allocatedSoFar, 2);
                        } else {
                            $proportion = $totalAvailable > 0 ? $remaining / $totalAvailable : 1 / $pivotSources->count();
                            $newShare = round($newInputKg * $proportion, 2);
                        }
                        // Clamp share to source's remaining
                        $newShare = min($newShare, $remaining);
                        $allocatedSoFar += $newShare;

                        $source->increment('quantity_out', $newShare);
                        $pivotData[$source->id] = ['quantity_kg' => $newShare];
                    }
                    $processing->dryingSources()->sync($pivotData);
                } elseif ($processing->drying_process_id) {
                    // Legacy single source
                    $difference = $newInputKg - $oldInputKg;
                    $drying = DryingProcess::find($processing->drying_process_id);
                    if ($drying) {
                        $availableForLegacy = (float)$drying->quantity_kg - (float)$drying->quantity_out + $oldInputKg;
                        if ($newInputKg > $availableForLegacy) {
                            throw new \Exception(
                                "Input quantity ({$newInputKg} kg) exceeds available from drying source ({$availableForLegacy} kg)."
                            );
                        }
                        $drying->increment('quantity_out', $difference);
                    }
                }
            }
            
            $processing->update($data);
            $this->clearCache();
            return $processing->fresh()->load(['procurement.supplier', 'dryingProcess', 'dryingSources.batch.variety', 'dryingSources.procurement.supplier']);
        });
    }

    /**
     * Start processing - change status to Processing
     */
    public function startProcessing(Processing $processing): Processing
    {
        $processing->update([
            'status' => Processing::STATUS_PROCESSING,
        ]);
        $this->clearCache();
        return $processing->fresh()->load('procurement.supplier');
    }

    /**
     * Complete processing - set output, calculate husk & yield, change status
     */
    public function completeProcessing(Processing $processing, float $outputKg): Processing
    {
        return DB::transaction(function () use ($processing, $outputKg) {
            $processing->calculateResults($outputKg);
            $processing->status = Processing::STATUS_COMPLETED;
            $processing->completed_date = now()->toDateString();
            $processing->stock_out = 0; // Reset stock_out when completing
            $processing->save();
            
            $this->clearCache();
            return $processing->fresh()->load('procurement.supplier');
        });
    }

    /**
     * Return a completed processing back to processing status
     * Only allowed when stock_out is 0
     */
    public function returnToProcessing(Processing $processing): Processing
    {
        if ($processing->status !== Processing::STATUS_COMPLETED) {
            throw new \Exception('Only completed batches can be returned to processing.');
        }
        
        if ((float)$processing->stock_out > 0) {
            throw new \Exception('Cannot return to processing: stock has already been distributed.');
        }
        
        return DB::transaction(function () use ($processing) {
            $processing->update([
                'status' => Processing::STATUS_PROCESSING,
                'completed_date' => null,
                'output_kg' => null,
                'husk_kg' => null,
                'yield_percent' => null,
            ]);
            
            $this->clearCache();
            return $processing->fresh()->load('procurement.supplier');
        });
    }

    /**
     * Archive a processing (move to archives)
     * Returns the input_kg back to all linked drying sources
     */
    public function deleteProcessing(Processing $processing): bool
    {
        return DB::transaction(function () use ($processing) {
            // Return quantity to all pivot drying sources
            $pivotSources = $processing->dryingSources;
            if ($pivotSources->isNotEmpty()) {
                foreach ($pivotSources as $source) {
                    $source->decrement('quantity_out', (float)$source->pivot->quantity_kg);
                }
                $processing->dryingSources()->detach();
            } elseif ($processing->drying_process_id) {
                // Legacy single source
                $drying = DryingProcess::find($processing->drying_process_id);
                if ($drying) {
                    $drying->decrement('quantity_out', (float)$processing->input_kg);
                }
            }
            
            $deleted = $processing->archive();
            $this->clearCache();
            return $deleted;
        });
    }

    /**
     * Clear all processing caches AND procurement cache (since processing affects quantity_out)
     */
    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
        Cache::forget(self::CACHE_KEY_ACTIVE);
        Cache::forget(self::CACHE_KEY_COMPLETED);
        // Also clear related caches since processing affects quantity_out
        Cache::forget('procurements_all');
        Cache::forget('drying_processes_all');
        DashboardService::clearStatsCache();
    }

    /**
     * Get statistics for dashboard
     */
    public function getStatistics(): array
    {
        $all = $this->getAllProcessings();
        $completed = $all->where('status', Processing::STATUS_COMPLETED);
        
        return [
            'total' => $all->count(),
            'pending' => $all->where('status', Processing::STATUS_PENDING)->count(),
            'processing' => $all->where('status', Processing::STATUS_PROCESSING)->count(),
            'completed' => $completed->count(),
            'total_input' => $all->sum('input_kg'),
            'total_output' => $completed->sum('output_kg'),
            'total_husk' => $completed->sum('husk_kg'),
            'total_stock_out' => $completed->sum('stock_out'),
            'avg_yield' => $completed->count() > 0 ? round($completed->avg('yield_percent'), 2) : 0,
        ];
    }
}
