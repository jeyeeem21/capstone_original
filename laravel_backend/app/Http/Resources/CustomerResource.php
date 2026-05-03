<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Models\User;

class CustomerResource extends JsonResource
{
    /**
     * Per-request cache of customer user accounts (avoids N+1 queries).
     */
    private static ?array $userCache = null;

    /**
     * Pre-load all customer user accounts in a single query.
     * Call this before returning a collection of CustomerResource.
     */
    public static function preloadUsers(): void
    {
        self::$userCache = User::where('role', 'customer')
            ->whereNotNull('email')
            ->get()
            ->keyBy('email')
            ->toArray();
    }

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Build cache on first use if not preloaded
        if (self::$userCache === null) {
            self::preloadUsers();
        }

        $userAccount = $this->email ? (self::$userCache[$this->email] ?? null) : null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'contact' => $this->contact,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'address_landmark' => $this->address_landmark,
            'status' => $this->status,
            'orders' => $this->orders_count ?? $this->orders,
            'has_account' => $userAccount !== null,
            'user_id' => $userAccount['id'] ?? null,
            'email_verified_at' => $userAccount['email_verified_at'] ?? null,
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updated_at?->format('Y-m-d H:i:s'),
        ];
    }
}
