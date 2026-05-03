<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProcurementResource extends JsonResource
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
            'supplier_id' => $this->supplier_id,
            'supplier' => $this->whenLoaded('supplier', function () {
                return [
                    'id' => $this->supplier->id,
                    'name' => $this->supplier->name,
                    'contact' => $this->supplier->contact,
                    'phone' => $this->supplier->phone,
                    'email' => $this->supplier->email,
                ];
            }),
            'supplier_name' => $this->supplier?->name ?? 'Unknown',
            'variety_id' => $this->variety_id,
            'variety_name' => $this->variety?->name ?? null,
            'variety_color' => $this->variety?->color ?? null,
            'quantity_kg' => (float) $this->quantity_kg,
            'sacks' => (int) $this->sacks,
            'drying_sacks' => (int) $this->dryingProcesses->sum('sacks') + (int) $this->dryingBatchAllocations->sum('sacks_taken'),
            'drying_kg' => (float) $this->dryingProcesses->sum('quantity_kg') + (float) $this->dryingBatchAllocations->sum('quantity_kg'),
            'price_per_kg' => (float) $this->price_per_kg,
            'description' => $this->description,
            'total_cost' => (float) $this->total_cost,
            'status' => $this->status,
            // Batch info (null when standalone procurement)
            'batch_id'     => $this->batch_id,
            'batch_number' => $this->batch?->batch_number,
            'batch_status' => $this->batch?->status,
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updated_at?->format('Y-m-d H:i:s'),
        ];
    }
}
