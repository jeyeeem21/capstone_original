<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DriverResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'contact' => $this->contact,
            'phone' => $this->phone,
            'email' => $this->email,
            'license_number' => $this->license_number,
            'vehicle_type' => $this->vehicle_type,
            'plate_number' => $this->plate_number,
            'address' => $this->address,
            'status' => $this->status,
            'total_deliveries' => $this->total_deliveries,
            'created_at' => $this->created_at?->toDateTimeString(),
            'updated_at' => $this->updated_at?->toDateTimeString(),
        ];
    }
}
