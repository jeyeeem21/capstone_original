<?php

namespace App\Services;

use App\Models\ProcurementBatch;
use App\Models\Procurement;
use App\Models\DryingProcess;
use App\Models\DryingBatchProcurement;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Collection;

class ProcurementBatchService
{
    private const CACHE_KEY     = 'procurement_batches_all';
    private const CACHE_KEY_OPEN = 'procurement_batches_open';
    private const CACHE_TTL     = 300;

    // ── Read ─────────────────────────────────────────────────────────

    public function getAllBatches(): Collection
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return ProcurementBatch::with(['variety:id,name,color'])
                ->withCount('procurements')
                ->withSum('procurements', 'total_cost')
                ->withSum('dryingProcesses', 'total_price')
                ->orderBy('created_at', 'desc')
                ->get();
        });
    }

    public function getOpenBatches(): Collection
    {
        return Cache::remember(self::CACHE_KEY_OPEN, self::CACHE_TTL, function () {
            return ProcurementBatch::with(['variety:id,name,color'])
                ->where('status', ProcurementBatch::STATUS_OPEN)
                ->withCount('procurements')
                ->orderBy('created_at', 'desc')
                ->get();
        });
    }

    public function getBatchById(int $id): ?ProcurementBatch
    {
        return ProcurementBatch::with([
                'variety:id,name,color',
                'procurements:id,batch_id,supplier_id,variety_id,sacks,quantity_kg,price_per_kg,total_cost,status',
                'procurements.supplier:id,name',
                'dryingProcesses:id,batch_id,sacks,quantity_kg,quantity_out,days,price,total_price,status',
            ])
            ->find($id);
    }

    // ── Create ───────────────────────────────────────────────────────

    public function createBatch(array $data): ProcurementBatch
    {
        return DB::transaction(function () use ($data) {
            $batch = ProcurementBatch::create([
                'batch_number' => ProcurementBatch::generateBatchNumber(),
                'variety_id'   => $data['variety_id'],
                'season_date'  => $data['season_date'] ?? now()->toDateString(),
                'notes'        => $data['notes'] ?? null,
                'status'       => ProcurementBatch::STATUS_OPEN,
            ]);

            $this->clearCache();
            return $batch;
        });
    }

    // ── Assign / Remove Procurement ──────────────────────────────────

    /**
     * Assign a procurement to a batch.
     * Validates variety match and batch-open status.
     */
    public function assignProcurement(ProcurementBatch $batch, Procurement $procurement): void
    {
        if ($batch->status !== ProcurementBatch::STATUS_OPEN) {
            throw new \Exception("Batch {$batch->batch_number} is {$batch->status}. Cannot add procurements.");
        }

        if ((int)$procurement->variety_id !== (int)$batch->variety_id) {
            throw new \Exception('Procurement variety does not match batch variety.');
        }

        DB::transaction(function () use ($batch, $procurement) {
            // Remove from old batch if any
            if ($procurement->batch_id && $procurement->batch_id !== $batch->id) {
                $oldBatch = ProcurementBatch::find($procurement->batch_id);
                $procurement->update(['batch_id' => $batch->id]);
                $oldBatch?->recalculateTotals();
            } else {
                $procurement->update(['batch_id' => $batch->id]);
            }

            $batch->recalculateTotals();
            $this->clearCache();
            Cache::forget('procurements_all');
        });
    }

    /**
     * Remove a procurement from its batch (revert to standalone).
     * Only allowed when batch is Open.
     */
    public function removeProcurement(Procurement $procurement): void
    {
        $batchId = $procurement->batch_id;
        if (!$batchId) return;

        $batch = ProcurementBatch::find($batchId);

        if ($batch && $batch->status !== ProcurementBatch::STATUS_OPEN) {
            throw new \Exception("Cannot remove procurement from a {$batch->status} batch. Batch is locked.");
        }

        DB::transaction(function () use ($procurement, $batch) {
            $procurement->update(['batch_id' => null]);
            $batch?->recalculateTotals();
            $this->clearCache();
            Cache::forget('procurements_all');
        });
    }

    // ── Update / Delete ──────────────────────────────────────────────

    public function updateBatch(ProcurementBatch $batch, array $data): ProcurementBatch
    {
        $batch->update($data);
        $this->clearCache();
        return $batch->fresh()->load('variety:id,name,color');
    }

    public function deleteBatch(ProcurementBatch $batch): bool
    {
        if ($batch->procurements()->count() > 0) {
            throw new \Exception('Cannot delete a batch that still has procurements. Remove them first.');
        }
        $deleted = $batch->delete();
        $this->clearCache();
        return $deleted;
    }

    // ── Batch Drying Distribution ────────────────────────────────────

    /**
     * Given a batch and a number of sacks to dry, proportionally distribute
     * those sacks across the batch's procurements and return the breakdown.
     *
     * @return array [
     *   'total_kg' => float,
     *   'breakdown' => [['procurement_id', 'sacks_taken', 'quantity_kg'], ...]
     * ]
     */
    public function calculateDryingDistribution(ProcurementBatch $batch, int $sacksRequested): array
    {
        if ($sacksRequested <= 0) {
            throw new \Exception('Sacks requested must be greater than 0.');
        }

        if ($sacksRequested > $batch->remaining_sacks) {
            throw new \Exception(
                "Requested {$sacksRequested} sacks but only {$batch->remaining_sacks} remaining in batch."
            );
        }

        // Load procurements with their already-used sacks (in batch drying + individual)
        $procurements = $batch->procurements()
            ->select('id', 'sacks', 'quantity_kg')
            ->get();

        // Calculate available sacks per procurement
        $available = $procurements->map(function ($proc) {
            $usedInBatch = DryingBatchProcurement::join('drying_processes', 'drying_processes.id', '=', 'drying_batch_procurements.drying_process_id')
                ->where('drying_batch_procurements.procurement_id', $proc->id)
                ->whereNotNull('drying_processes.batch_id')
                ->whereNull('drying_processes.deleted_at')
                ->sum('drying_batch_procurements.sacks_taken');

            $usedIndividual = DryingProcess::where('procurement_id', $proc->id)
                ->whereNull('batch_id')
                ->whereNull('deleted_at')
                ->sum('sacks');

            $availSacks = max(0, $proc->sacks - (int)$usedInBatch - (int)$usedIndividual);
            $kgPerSack  = $proc->sacks > 0 ? (float)$proc->quantity_kg / $proc->sacks : 0;

            return [
                'procurement_id' => $proc->id,
                'available_sacks' => $availSacks,
                'kg_per_sack'     => $kgPerSack,
            ];
        })->filter(fn($p) => $p['available_sacks'] > 0)->values();

        $totalAvailable = $available->sum('available_sacks');
        if ($totalAvailable < $sacksRequested) {
            throw new \Exception(
                "Only {$totalAvailable} sacks actually available across procurements."
            );
        }

        // Proportional distribution — last procurement absorbs rounding remainder
        $breakdown  = [];
        $remaining  = $sacksRequested;
        $totalKg    = 0.0;

        // Calculate the actual total kg available across all procurements being used
        $actualTotalKg = $available->sum(fn($p) => $p['available_sacks'] * $p['kg_per_sack']);

        foreach ($available as $idx => $proc) {
            $isLast     = ($idx === count($available) - 1);
            $sacks      = $isLast ? $remaining : (int) round($sacksRequested * $proc['available_sacks'] / $totalAvailable);
            $sacks      = min($sacks, $proc['available_sacks'], $remaining);
            if ($sacks <= 0 && !$isLast) continue;

            $kg = round($sacks * $proc['kg_per_sack'], 2);

            $breakdown[] = [
                'procurement_id' => $proc['procurement_id'],
                'sacks_taken'    => $sacks,
                'quantity_kg'    => $kg,
            ];
            $remaining -= $sacks;
            $totalKg   += $kg;
        }

        // If requesting all available sacks, use exact batch remaining_kg to avoid rounding drift
        if ($sacksRequested === $totalAvailable && count($breakdown) > 0) {
            $exactTotalKg = (float) $batch->remaining_kg;
            $diff = round($exactTotalKg - $totalKg, 2);
            if (abs($diff) > 0 && abs($diff) < 100) {
                $breakdown[count($breakdown) - 1]['quantity_kg'] = round($breakdown[count($breakdown) - 1]['quantity_kg'] + $diff, 2);
                $totalKg = $exactTotalKg;
            }
        }

        return [
            'total_kg'  => round($totalKg, 2),
            'breakdown' => $breakdown,
        ];
    }

    /**
     * Decrement batch remaining after drying has been committed.
     */
    public function decrementRemaining(ProcurementBatch $batch, int $sacks, float $kg): void
    {
        $batch->update([
            'remaining_sacks' => max(0, $batch->remaining_sacks - $sacks),
            'remaining_kg'    => max(0, (float)$batch->remaining_kg - $kg),
        ]);

        // Auto-complete batch when no remaining sacks
        if ($batch->fresh()->remaining_sacks <= 0) {
            $batch->update(['status' => ProcurementBatch::STATUS_COMPLETED]);
        }

        $this->clearCache();
    }

    // ── Cache ────────────────────────────────────────────────────────

    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
        Cache::forget(self::CACHE_KEY_OPEN);
        DashboardService::clearStatsCache();
    }
}
