<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->product_id,
            'product_id' => $this->product_id,
            'product_name' => $this->product_name,
            'variety_id' => $this->variety_id,
            'variety_name' => $this->variety?->name ?? 'Unclassified',
            'variety_color' => $this->variety?->color ?? '#6B7280',
            'price' => (float) $this->price,
            'price_formatted' => '₱' . number_format($this->price, 2),
            'stocks' => (int) $this->stocks,
            'stock_floor' => (int) ($this->stock_floor ?? 0),
            'unit' => $this->weight ? (intval($this->weight) == $this->weight ? intval($this->weight) . 'kg' : number_format($this->weight, 2) . 'kg') : 'kg',
            'weight' => $this->weight ? (float) $this->weight : null,
            'weight_formatted' => $this->weight ? (intval($this->weight) == $this->weight ? intval($this->weight) . ' kg' : number_format($this->weight, 2) . ' kg') : null,
            'image' => $this->image ? url('/storage/' . $this->image) : null,
            'status' => $this->status,
            'is_active' => $this->status === 'active',
            'is_in_stock' => $this->stocks > 0,
            'stock_status' => $this->stocks <= 0
                ? 'Out of Stock'
                : (($this->stock_floor ?? 0) > 0 && $this->stocks <= $this->stock_floor
                    ? 'Low Stock'
                    : 'In Stock'),
            'has_pending_orders' => (bool) $this->has_pending_orders,
            'is_deleted' => (bool) $this->is_deleted,
            'created_at' => $this->created_at ? $this->created_at->format('Y-m-d H:i:s') : null,
            'updated_at' => $this->updated_at ? $this->updated_at->format('Y-m-d H:i:s') : null,
            'created_date' => $this->created_at ? $this->created_at->format('M d, Y') : null,
        ];
    }
}
