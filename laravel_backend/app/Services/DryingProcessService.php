<?php

namespace App\Services;

use App\Models\DryingBatchProcurement;
use App\Models\DryingProcess;
use App\Models\Procurement;
use App\Models\ProcurementBatch;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Collection;

/**
 * Service class for Drying Process
 * Handles all business logic related to drying operations
 */
class DryingProcessService
{
    private const CACHE_KEY = 'drying_processes_all';
    private const CACHE_TTL = 300;

    public function __construct(private readonly ProcurementBatchService $batchService) {}

    /**
     * Get all drying processes with procurement - cached
     */
    public function getAllDryingProcesses(): Collection
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return DryingProcess::with([
                    'procurement:id,supplier_id,variety_id,quantity_kg,sacks,status',
                    'procurement.supplier:id,name',
                    'procurement.variety:id,name,color',
                    'batch:id,batch_number,variety_id,status',
                    'batch.variety:id,name,color',
                ])
                ->orderByRaw("FIELD(status, 'Drying', 'Postponed', 'Dried')")
                ->orderBy('created_at', 'desc')
                ->get();
        });
    }

    /**
     * Get a single drying process
     */
    public function getDryingProcessById(int $id): ?DryingProcess
    {
        return DryingProcess::with([
            'procurement.supplier',
            'procurement.variety',
            'batch:id,batch_number,status',
            'batchProcurements.procurement.supplier:id,name',
        ])->find($id);
    }

    /**
     * Create a new drying process.
     *
     * Supports two modes:
     *   (a) Individual  — $data['procurement_id'] is set
     *   (b) Batch       — $data['batch_id'] + $data['sacks'] are set
     */
    public function createDryingProcess(array $data): DryingProcess
    {
        return DB::transaction(function () use ($data) {
            // ── Batch mode ──────────────────────────────────────────────
            if (!empty($data['batch_id'])) {
                $batch  = ProcurementBatch::findOrFail($data['batch_id']);
                $sacks  = (int) $data['sacks'];
                $price  = (float) ($data['price'] ?? 0);

                // Proportional distribution across batch procurements
                $dist = $this->batchService->calculateDryingDistribution($batch, $sacks);

                $drying = DryingProcess::create([
                    'batch_id'    => $batch->id,
                    'quantity_kg' => (float) $dist['total_kg'],
                    'sacks'       => $sacks,
                    'quantity_out'=> 0,
                    'days'        => 0,
                    'price'       => $price,
                    'total_price' => 0,
                    'status'      => DryingProcess::STATUS_DRYING,
                ]);

                // Write pivot records & update procurement statuses
                foreach ($dist['breakdown'] as $item) {
                    DryingBatchProcurement::create([
                        'drying_process_id' => $drying->id,
                        'procurement_id'    => $item['procurement_id'],
                        'sacks_taken'       => $item['sacks_taken'],
                        'quantity_kg'       => $item['quantity_kg'],
                    ]);

                    // Update procurement status if all sacks are now in drying
                    $proc = Procurement::find($item['procurement_id']);
                    if ($proc) {
                        $usedInBatch = (int) DryingBatchProcurement::join('drying_processes', 'drying_processes.id', '=', 'drying_batch_procurements.drying_process_id')
                            ->where('drying_batch_procurements.procurement_id', $proc->id)
                            ->whereNull('drying_processes.deleted_at')
                            ->sum('drying_batch_procurements.sacks_taken');
                        $usedIndividual = (int) DryingProcess::where('procurement_id', $proc->id)
                            ->whereNull('batch_id')
                            ->whereNull('deleted_at')
                            ->sum('sacks');
                        if (($usedInBatch + $usedIndividual) >= (int) $proc->sacks) {
                            $proc->update(['status' => 'Drying']);
                        }
                    }
                }

                // Decrement batch remaining
                $this->batchService->decrementRemaining($batch, $sacks, $dist['total_kg']);

                $this->clearCache();
                $this->batchService->clearCache();
                return $drying->load(['batch', 'batchProcurements.procurement.supplier']);
            }

            // ── Individual (single procurement) mode ───────────────────
            $procurement = Procurement::findOrFail($data['procurement_id']);

            // Calculate how many sacks are already in drying (individual + batch allocations)
            $alreadyDryingSacks = (int) $procurement->dryingProcesses()->sum('sacks')
                                + (int) $procurement->dryingBatchAllocations()->sum('sacks_taken');
            $remainingSacks = max(0, (int) $procurement->sacks - $alreadyDryingSacks);

            // Determine sacks to send (user-specified or all remaining)
            $sacksToSend = isset($data['sacks']) ? (int) $data['sacks'] : $remainingSacks;

            if ($sacksToSend <= 0) {
                throw new \Exception('No remaining sacks available to send to drying.');
            }
            if ($sacksToSend > $remainingSacks) {
                throw new \Exception("Only {$remainingSacks} sacks remaining. Cannot send {$sacksToSend}.");
            }

            // Calculate proportional kg
            $totalSacks = (int) $procurement->sacks;
            $proportionalKg = $totalSacks > 0
                ? round(($sacksToSend / $totalSacks) * (float) $procurement->quantity_kg, 2)
                : 0;

            $drying = DryingProcess::create([
                'procurement_id' => $procurement->id,
                'quantity_kg'    => $proportionalKg,
                'sacks'          => $sacksToSend,
                'quantity_out'   => 0,
                'days'           => 0,
                'price'          => (float) ($data['price'] ?? 0),
                'total_price'    => 0,
                'status'         => DryingProcess::STATUS_DRYING,
            ]);

            // Update procurement status: 'Drying' if all sacks are now in drying, otherwise keep as is
            $newTotalDrying = $alreadyDryingSacks + $sacksToSend;
            if ($newTotalDrying >= $totalSacks) {
                $procurement->update(['status' => 'Drying']);
            }

            // If this procurement belongs to a batch, recalculate batch totals
            if ($procurement->batch_id) {
                $batch = ProcurementBatch::find($procurement->batch_id);
                $batch?->recalculateTotals();
                $this->batchService->clearCache();
            }

            $this->clearCache();
            return $drying->load('procurement.supplier');
        });
    }

    /**
     * Increment days by 1 (+ action)
     * Recalculates total_price = (sacks * price) * days
     */
    public function incrementDay(DryingProcess $drying): DryingProcess
    {
        if ($drying->status !== DryingProcess::STATUS_DRYING) {
            throw new \Exception('Can only add days to records that are currently drying.');
        }

        return DB::transaction(function () use ($drying) {
            $drying->days += 1;
            $drying->recalculateTotal();
            $drying->save();

            $this->clearCache();
            $this->batchService->clearCache();
            return $drying->fresh()->load('procurement.supplier');
        });
    }

    /**
     * Mark as Dried (✓ action)
     * - Sets status to Dried
     * - Sets procurement status to Dried (individual or batch procurements)
     */
    public function markAsDried(DryingProcess $drying): DryingProcess
    {
        if ($drying->status !== DryingProcess::STATUS_DRYING) {
            throw new \Exception('Can only mark drying records as dried.');
        }

        return DB::transaction(function () use ($drying) {
            $drying->update([
                'status' => DryingProcess::STATUS_DRIED,
                'dried_at' => now(),
            ]);

            // Update procurement status to Dried (individual mode)
            if ($drying->procurement_id) {
                $procurement = Procurement::find($drying->procurement_id);
                if ($procurement) {
                    $procurement->update(['status' => 'Dried']);
                }
            }

            // Update all batch procurement statuses to Dried (batch mode)
            if ($drying->batch_id) {
                $drying->load('batchProcurements.procurement');
                foreach ($drying->batchProcurements as $bp) {
                    if ($bp->procurement) {
                        $bp->procurement->update(['status' => 'Dried']);
                    }
                }
            }

            $this->clearCache();
            $this->batchService->clearCache();
            return $drying->fresh()->load('procurement.supplier');
        });
    }

    /**
     * Update a drying process (edit action)
     * Only allowed when status is Drying
     */
    public function updateDryingProcess(DryingProcess $drying, array $data): DryingProcess
    {
        if ($drying->status !== DryingProcess::STATUS_DRYING) {
            throw new \Exception('Can only edit records that are currently drying.');
        }

        return DB::transaction(function () use ($drying, $data) {
            if (isset($data['price'])) {
                $drying->price = (float) $data['price'];
            }
            $drying->recalculateTotal();
            $drying->save();

            $this->clearCache();
            $this->batchService->clearCache();
            return $drying->fresh()->load('procurement.supplier');
        });
    }

    /**
     * Postpone a drying process
     * - Sets drying status to Postponed (pauses drying)
     * - Does NOT return quantities or delete — quantities stay reserved
     * - Use delete to fully remove and return quantities to procurement
     */
    public function postponeDryingProcess(DryingProcess $drying): DryingProcess
    {
        if ($drying->status !== DryingProcess::STATUS_DRYING) {
            throw new \Exception('Can only postpone records that are currently drying.');
        }

        $drying->update(['status' => DryingProcess::STATUS_POSTPONED]);
        $this->clearCache();
        $this->batchService->clearCache();
        return $drying->fresh()->load('procurement.supplier');
    }

    /**
     * Archive a drying process (move to archives)
     * Reverts procurement status and restores batch remaining if needed
     */
    public function deleteDryingProcess(DryingProcess $drying): bool
    {
        if ($drying->status === DryingProcess::STATUS_DRIED && (float) $drying->quantity_out > 0) {
            throw new \Exception('Cannot delete: quantity has already been sent to processing.');
        }

        return DB::transaction(function () use ($drying) {
            // Restore batch remaining if batch-mode drying
            if ($drying->batch_id) {
                $batch = ProcurementBatch::find($drying->batch_id);
                if ($batch) {
                    // Revert batch procurement statuses
                    $drying->load('batchProcurements.procurement');
                    foreach ($drying->batchProcurements as $bp) {
                        if ($bp->procurement) {
                            $otherActive = DryingProcess::where('id', '!=', $drying->id)
                                ->whereHas('batchProcurements', fn($q) => $q->where('procurement_id', $bp->procurement_id))
                                ->whereIn('status', ['Drying', 'Dried', 'Postponed'])
                                ->exists();
                            $individualActive = DryingProcess::where('procurement_id', $bp->procurement_id)
                                ->whereNull('batch_id')
                                ->where('id', '!=', $drying->id)
                                ->whereIn('status', ['Drying', 'Dried', 'Postponed'])
                                ->exists();
                            if (!$otherActive && !$individualActive) {
                                $bp->procurement->update(['status' => 'Pending']);
                            }
                        }
                    }

                    // Delete pivot records
                    DryingBatchProcurement::where('drying_process_id', $drying->id)->delete();

                    // Recalculate batch totals (which recalculates remaining)
                    $batch->recalculateTotals();

                    // If batch was Completed and now has remaining, revert to Closed
                    $batch->refresh();
                    if ($batch->status === ProcurementBatch::STATUS_COMPLETED && $batch->remaining_sacks > 0) {
                        $batch->update(['status' => ProcurementBatch::STATUS_CLOSED]);
                    }

                    $this->batchService->clearCache();
                }
            }

            // Revert individual procurement status if no other active drying processes
            if ($drying->procurement_id) {
                $procurement = Procurement::find($drying->procurement_id);
                if ($procurement) {
                    $otherActive = DryingProcess::where('procurement_id', $procurement->id)
                        ->where('id', '!=', $drying->id)
                        ->whereIn('status', ['Drying', 'Dried', 'Postponed'])
                        ->exists();
                    if (!$otherActive) {
                        $procurement->update(['status' => 'Pending']);
                    }
                    // Recalculate batch if procurement belongs to one
                    if ($procurement->batch_id) {
                        $procBatch = ProcurementBatch::find($procurement->batch_id);
                        $procBatch?->recalculateTotals();
                        $this->batchService->clearCache();
                    }
                }
            }

            $deleted = $drying->archive();
            $this->clearCache();
            return $deleted;
        });
    }

    /**
     * Get statistics
     */
    public function getStatistics(): array
    {
        $all = $this->getAllDryingProcesses();

        return [
            'total' => $all->count(),
            'drying' => $all->where('status', DryingProcess::STATUS_DRYING)->count(),
            'dried' => $all->where('status', DryingProcess::STATUS_DRIED)->count(),
            'total_quantity' => $all->sum('quantity_kg'),
            'total_cost' => $all->sum('total_price'),
            'avg_days' => $all->count() > 0 ? round($all->avg('days'), 1) : 0,
        ];
    }

    /**
     * Clear caches
     */
    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
        Cache::forget('procurements_all');
        DashboardService::clearStatsCache();
    }
}
