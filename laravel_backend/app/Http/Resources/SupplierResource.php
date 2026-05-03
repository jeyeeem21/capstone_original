<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupplierResource extends JsonResource
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
            'name' => $this->name,
            'contact' => $this->contact,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'status' => $this->status,
            'products' => $this->products ?? 0,
            'total_sacks' => (int) ($this->procurements_sum_sacks ?? ($this->whenLoaded('procurements', function () {
                return $this->procurements->sum('sacks');
            }, 0))),
            'total_kg' => (float) ($this->procurements_sum_quantity_kg ?? ($this->whenLoaded('procurements', function () {
                return $this->procurements->sum('quantity_kg');
            }, 0))),
            'total_cost' => (float) ($this->procurements_sum_total_cost ?? ($this->whenLoaded('procurements', function () {
                return $this->procurements->sum('total_cost');
            }, 0))),
            'procurement_count' => (int) ($this->procurements_count ?? ($this->whenLoaded('procurements', function () {
                return $this->procurements->count();
            }, 0))),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
