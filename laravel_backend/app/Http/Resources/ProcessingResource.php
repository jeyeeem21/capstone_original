<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProcessingResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Build procurement info - either from direct link or from drying batch chain
        $procurementInfo = null;
        if ($this->procurement) {
            $procurementInfo = [
                'id' => $this->procurement->id,
                'supplier_name' => $this->procurement->supplier->name ?? 'Unknown',
                'variety_name' => $this->procurement->variety->name ?? null,
                'variety_color' => $this->procurement->variety->color ?? null,
                'quantity_kg' => (float) $this->procurement->quantity_kg,
                'sacks' => (int) $this->procurement->sacks,
                'price_per_kg' => $this->procurement->price_per_kg ? (float) $this->procurement->price_per_kg : null,
                'total_cost' => $this->procurement->total_cost ? (float) $this->procurement->total_cost : null,
            ];
        } else {
            // Try to get procurement info from drying sources' batch procurements
            $batchProcurements = collect();
            $dryingSources = $this->relationLoaded('dryingSources') ? $this->dryingSources : collect();
            foreach ($dryingSources as $ds) {
                if ($ds->relationLoaded('batchProcurements')) {
                    foreach ($ds->batchProcurements as $bp) {
                        if ($bp->procurement) {
                            $batchProcurements->push($bp);
                        }
                    }
                }
            }
            // Also check legacy dryingProcess
            if ($batchProcurements->isEmpty() && $this->dryingProcess && $this->dryingProcess->relationLoaded('batchProcurements')) {
                foreach ($this->dryingProcess->batchProcurements as $bp) {
                    if ($bp->procurement) {
                        $batchProcurements->push($bp);
                    }
                }
            }
            if ($batchProcurements->isNotEmpty()) {
                $totalKg = $batchProcurements->sum('quantity_kg');
                $totalSacks = $batchProcurements->sum('sacks_taken');
                $firstProc = $batchProcurements->first()->procurement;
                $procurementInfo = [
                    'id' => $firstProc->id,
                    'supplier_name' => $firstProc->supplier->name ?? 'Unknown',
                    'variety_name' => $firstProc->variety->name ?? null,
                    'variety_color' => $firstProc->variety->color ?? null,
                    'quantity_kg' => (float) $totalKg,
                    'sacks' => (int) $totalSacks,
                    'price_per_kg' => $firstProc->price_per_kg ? (float) $firstProc->price_per_kg : null,
                    'total_cost' => $firstProc->total_cost ? (float) $firstProc->total_cost : null,
                    'from_batch' => true,
                ];
                // If multiple procurements, list them all
                if ($batchProcurements->count() > 1) {
                    $procurementInfo['sources'] = $batchProcurements->map(fn($bp) => [
                        'supplier_name' => $bp->procurement->supplier->name ?? 'Unknown',
                        'quantity_kg' => (float) $bp->quantity_kg,
                        'sacks_taken' => (int) $bp->sacks_taken,
                        'price_per_kg' => $bp->procurement->price_per_kg ? (float) $bp->procurement->price_per_kg : null,
                    ])->values()->toArray();
                }
            }
        }

        return [
            'id' => $this->id,
            'procurement_id' => $this->procurement_id,
            'drying_process_id' => $this->drying_process_id,
            'procurement_info' => $procurementInfo,
            'drying_process_info' => $this->dryingProcess ? [
                'id' => $this->dryingProcess->id,
                'supplier_name' => $this->dryingProcess->procurement->supplier->name ?? ($this->dryingProcess->batch_id ? 'Batch' : 'Unknown'),
                'quantity_kg' => (float) $this->dryingProcess->quantity_kg,
                'sacks' => (int) $this->dryingProcess->sacks,
                'quantity_out' => (float) $this->dryingProcess->quantity_out,
                'remaining_kg' => (float) ($this->dryingProcess->quantity_kg - $this->dryingProcess->quantity_out),
                'days' => (int) $this->dryingProcess->days,
                'status' => $this->dryingProcess->status,
                'batch_id' => $this->dryingProcess->batch_id,
                'batch_number' => $this->dryingProcess->batch?->batch_number,
                'variety_name' => $this->dryingProcess->batch?->variety?->name ?? null,
            ] : null,
            // Multi-source drying sources
            'drying_sources' => $this->whenLoaded('dryingSources', function () {
                return $this->dryingSources->map(fn($ds) => [
                    'id' => $ds->id,
                    'quantity_kg_taken' => (float) $ds->pivot->quantity_kg,
                    'total_quantity_kg' => (float) $ds->quantity_kg,
                    'quantity_out' => (float) ($ds->quantity_out ?? 0),
                    'days' => (int) ($ds->days ?? 0),
                    'sacks' => (int) ($ds->sacks ?? 0),
                    'batch_id' => $ds->batch_id,
                    'batch_number' => $ds->batch?->batch_number,
                    'variety_name' => $ds->batch?->variety?->name ?? ($ds->procurement?->variety?->name ?? null),
                    'variety_color' => $ds->batch?->variety?->color ?? ($ds->procurement?->variety?->color ?? null),
                    'supplier_name' => $ds->procurement?->supplier?->name ?? ($ds->batch_id ? 'Batch' : 'Unknown'),
                ]);
            }),
            'input_kg' => (float) $this->input_kg,
            'output_kg' => $this->output_kg ? (float) $this->output_kg : null,
            'stock_out' => (float) ($this->stock_out ?? 0),
            'remaining_stock' => $this->remaining_stock,
            'husk_kg' => $this->husk_kg ? (float) $this->husk_kg : null,
            'yield_percent' => $this->yield_percent ? (float) $this->yield_percent : null,
            'operator_name' => $this->operator_name,
            'status' => $this->status,
            'stock_status' => $this->stock_status,
            'processing_date' => $this->processing_date?->format('M d, Y h:i A'),
            'completed_date' => $this->completed_date?->format('M d, Y h:i A'),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            // Cost breakdown (computed when available - e.g. from completed-processings endpoint)
            'cost_breakdown' => $this->cost_breakdown_data ?? null,
        ];
    }
}
