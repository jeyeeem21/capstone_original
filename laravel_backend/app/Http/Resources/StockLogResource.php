<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StockLogResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product_name' => $this->product?->product_name ?? 'Unknown',
            'variety_name' => $this->product?->variety?->name ?? 'Unknown',
            'variety_color' => $this->product?->variety?->color ?? '#6B7280',
            'type' => $this->type, // 'in' or 'out'
            'quantity_before' => (int) $this->quantity_before,
            'quantity_change' => (int) $this->quantity_change,
            'quantity_after' => (int) $this->quantity_after,
            'kg_amount' => $this->kg_amount ? (float) $this->kg_amount : null,
            'source_type' => $this->source_type,
            'source_id' => $this->source_id,
            'source_processing_ids' => $this->source_processing_ids,
            'notes' => $this->notes,
            'procurement_cost' => $this->procurement_cost ? (float) $this->procurement_cost : null,
            'drying_cost' => $this->drying_cost ? (float) $this->drying_cost : null,
            'total_cost' => $this->total_cost ? (float) $this->total_cost : null,
            'cost_per_unit' => $this->cost_per_unit ? (float) $this->cost_per_unit : null,
            'selling_price' => $this->selling_price ? (float) $this->selling_price : null,
            'profit_per_unit' => $this->profit_per_unit !== null ? (float) $this->profit_per_unit : null,
            'profit_margin' => $this->profit_margin !== null ? (float) $this->profit_margin : null,
            'created_at' => $this->created_at?->toISOString(),
            'date_formatted' => $this->created_at?->format('M d, Y h:i A'),
            'date_short' => $this->created_at?->format('Y-m-d'),
        ];
    }
}
