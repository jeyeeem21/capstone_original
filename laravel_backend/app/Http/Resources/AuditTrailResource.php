<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditTrailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'user_id'     => $this->user_id,
            'user'        => $this->user?->name ?? 'System',
            'role'        => $this->user?->role ?? '-',
            'action'      => $this->action,
            'module'      => $this->module,
            'description' => $this->description,
            'details'     => $this->details,
            'ip_address'  => $this->ip_address,
            'user_agent'  => $this->user_agent,
            'timestamp'   => $this->created_at?->toDateTimeString(),
            'created_at'  => $this->created_at?->toDateTimeString(),
        ];
    }
}
