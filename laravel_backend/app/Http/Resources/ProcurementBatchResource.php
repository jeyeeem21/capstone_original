<?php

namespace App\Http\Resources;

use App\Models\DryingProcess;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

class ProcurementBatchResource extends JsonResource
{
    private static ?array $individualDryingCosts = null;

    /**
     * Preload individual drying costs for all batches in a single query.
     * Call before using ::collection().
     */
    public static function preloadIndividualDryingCosts(): void
    {
        // Sum drying_processes.total_price for procurements IN a batch,
        // where the drying_process itself is NOT batch-level (batch_id IS NULL).
        self::$individualDryingCosts = DB::table('drying_processes')
            ->join('procurements', 'drying_processes.procurement_id', '=', 'procurements.id')
            ->whereNotNull('procurements.batch_id')
            ->whereNull('drying_processes.batch_id')
            ->whereNull('drying_processes.deleted_at')
            ->groupBy('procurements.batch_id')
            ->pluck(DB::raw('SUM(drying_processes.total_price)'), 'procurements.batch_id')
            ->map(fn($v) => (float) $v)
            ->toArray();
    }

    public static function resetPreload(): void
    {
        self::$individualDryingCosts = null;
    }

    public function toArray(Request $request): array
    {
        $batchDryingCost = (float) ($this->drying_processes_sum_total_price ?? $this->dryingProcesses?->sum('total_price') ?? 0);

        // Use preloaded data instead of per-resource query
        if (self::$individualDryingCosts === null) {
            self::preloadIndividualDryingCosts();
        }
        $individualDryingCost = (float) (self::$individualDryingCosts[$this->id] ?? 0);

        $totalDryingCost = $batchDryingCost + $individualDryingCost;

        return [
            'id'               => $this->id,
            'batch_number'     => $this->batch_number,
            'variety_id'       => $this->variety_id,
            'variety_name'     => $this->variety?->name,
            'variety_color'    => $this->variety?->color,
            'season_date'      => $this->season_date?->format('Y-m-d'),
            'total_sacks'      => (int) $this->total_sacks,
            'total_kg'         => (float) $this->total_kg,
            'remaining_sacks'  => (int) $this->remaining_sacks,
            'remaining_kg'     => (float) $this->remaining_kg,
            'used_sacks'       => (int) $this->total_sacks - (int) $this->remaining_sacks,
            'used_kg'          => (float) $this->total_kg - (float) $this->remaining_kg,
            'total_cost'       => (float) ($this->procurements_sum_total_cost ?? $this->procurements->sum('total_cost')),
            'total_drying_cost' => $totalDryingCost,
            'status'           => $this->status,
            'notes'            => $this->notes,
            'procurements_count' => $this->whenCounted('procurements'),
            // Full procurement list — only when loaded (detail view)
            'procurements'     => $this->when(
                $this->relationLoaded('procurements'),
                fn() => $this->procurements->map(fn($p) => [
                    'id'           => $p->id,
                    'supplier_id'  => $p->supplier_id,
                    'supplier_name'=> $p->supplier?->name ?? 'Unknown',
                    'sacks'        => (int) $p->sacks,
                    'quantity_kg'  => (float) $p->quantity_kg,
                    'price_per_kg' => (float) $p->price_per_kg,
                    'total_cost'   => (float) $p->total_cost,
                    'status'       => $p->status,
                ])
            ),
            'created_at'  => $this->created_at?->toISOString(),
            'updated_at'  => $this->updated_at?->toISOString(),
        ];
    }
}
