<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeliveryAssignmentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'delivery_number' => $this->delivery_number,
            'driver_id' => $this->driver_id,
            'driver' => new DriverResource($this->whenLoaded('driver')),
            'customer_id' => $this->customer_id,
            'customer' => new CustomerResource($this->whenLoaded('customer')),
            'destination' => $this->destination,
            'contact_person' => $this->contact_person,
            'contact_phone' => $this->contact_phone,
            'delivery_date' => $this->delivery_date?->toDateString(),
            'priority' => $this->priority,
            'status' => $this->status,
            'notes' => $this->notes,
            'driver_notes' => $this->driver_notes,
            'proof_of_delivery' => $this->proof_of_delivery,
            'picked_up_at' => $this->picked_up_at?->toDateTimeString(),
            'delivered_at' => $this->delivered_at?->toDateTimeString(),
            'items' => DeliveryItemResource::collection($this->whenLoaded('items')),
            'items_count' => $this->whenCounted('items'),
            'total_value' => $this->whenLoaded('items', fn () => $this->items->sum('total')),
            'created_at' => $this->created_at?->toDateTimeString(),
            'updated_at' => $this->updated_at?->toDateTimeString(),
        ];
    }
}
