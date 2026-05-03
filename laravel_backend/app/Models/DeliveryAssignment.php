<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\HasArchiving;
use Carbon\Carbon;

class DeliveryAssignment extends Model
{
    use SoftDeletes, HasArchiving;

    protected $fillable = [
        'delivery_number',
        'driver_id',
        'customer_id',
        'destination',
        'contact_person',
        'contact_phone',
        'delivery_date',
        'priority',
        'status',
        'is_archived',
        'archived_at',
        'notes',
        'driver_notes',
        'proof_of_delivery',
        'picked_up_at',
        'delivered_at',
    ];

    protected $casts = [
        'delivery_date' => 'date',
        'picked_up_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    /**
     * Generate a unique delivery number
     */
    public static function generateDeliveryNumber(): string
    {
        $date = Carbon::now()->format('Ymd');
        $lastDelivery = static::withTrashed()
            ->where('delivery_number', 'like', "DEL-{$date}-%")
            ->orderBy('delivery_number', 'desc')
            ->first();

        if ($lastDelivery) {
            $lastNumber = (int) substr($lastDelivery->delivery_number, -3);
            $nextNumber = str_pad($lastNumber + 1, 3, '0', STR_PAD_LEFT);
        } else {
            $nextNumber = '001';
        }

        return "DEL-{$date}-{$nextNumber}";
    }

    /**
     * Get the driver for this assignment
     */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    /**
     * Get the customer for this assignment
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * Get the items for this delivery
     */
    public function items(): HasMany
    {
        return $this->hasMany(DeliveryItem::class);
    }

    /**
     * Mark delivery as picked up / in transit
     */
    public function markInTransit(): void
    {
        $this->update([
            'status' => 'In Transit',
            'picked_up_at' => Carbon::now(),
        ]);
    }

    /**
     * Mark delivery as delivered
     */
    public function markDelivered(?string $driverNotes = null, ?string $proofPath = null): void
    {
        $data = [
            'status' => 'Delivered',
            'delivered_at' => Carbon::now(),
        ];

        if ($driverNotes) {
            $data['driver_notes'] = $driverNotes;
        }

        if ($proofPath) {
            $data['proof_of_delivery'] = $proofPath;
        }

        $this->update($data);
        $this->driver->incrementDeliveries();
    }

    /**
     * Mark delivery as failed
     */
    public function markFailed(?string $driverNotes = null): void
    {
        $this->update([
            'status' => 'Failed',
            'driver_notes' => $driverNotes,
        ]);
    }
}
