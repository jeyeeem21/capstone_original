<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DryingProcessResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'procurement_id' => $this->procurement_id,
            'procurement_info' => $this->procurement ? [
                'id' => $this->procurement->id,
                'supplier_name' => $this->procurement->supplier->name ?? 'Unknown',
                'variety_name' => $this->procurement->variety->name ?? null,
                'variety_color' => $this->procurement->variety->color ?? null,
                'quantity_kg' => (float) $this->procurement->quantity_kg,
                'sacks' => (int) $this->procurement->sacks,
                'price_per_kg' => (float) $this->procurement->price_per_kg,
                'status' => $this->procurement->status,
            ] : null,
            'quantity_kg' => (float) $this->quantity_kg,
            'sacks' => (int) $this->sacks,
            'quantity_out' => (float) $this->quantity_out,
            'remaining_quantity' => (float) ($this->quantity_kg - $this->quantity_out),
            'days' => (int) $this->days,
            'price' => (float) $this->price,
            'total_price' => (float) $this->total_price,
            'status' => $this->status,
            'dried_at' => $this->dried_at?->toISOString(),
            // Batch info — populated when drying was started from a batch
            'batch_id'     => $this->batch_id,
            'batch_number' => $this->batch?->batch_number,
            'batch_variety_name' => $this->batch?->variety?->name,
            'batch_variety_color' => $this->batch?->variety?->color,
            'batch_breakdown' => $this->when(
                $this->batch_id && $this->relationLoaded('batchProcurements'),
                fn() => $this->batchProcurements->map(fn($bp) => [
                    'procurement_id'  => $bp->procurement_id,
                    'supplier_name'   => $bp->procurement?->supplier?->name ?? 'Unknown',
                    'sacks_taken'     => (int) $bp->sacks_taken,
                    'quantity_kg'     => (float) $bp->quantity_kg,
                ])
            ),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
