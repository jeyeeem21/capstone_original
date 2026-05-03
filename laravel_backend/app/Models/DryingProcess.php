<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\HasArchiving;

class DryingProcess extends Model
{
    use SoftDeletes, HasArchiving;

    protected $fillable = [
        'procurement_id',
        'batch_id',
        'quantity_kg',
        'sacks',
        'quantity_out',
        'days',
        'price',
        'total_price',
        'status',
        'is_archived',
        'archived_at',
        'dried_at',
    ];

    protected $casts = [
        'quantity_kg' => 'decimal:2',
        'sacks' => 'integer',
        'quantity_out' => 'decimal:2',
        'days' => 'integer',
        'price' => 'decimal:2',
        'total_price' => 'decimal:2',
        'dried_at' => 'datetime',
    ];

    protected $attributes = [
        'quantity_kg' => 0,
        'sacks' => 0,
        'quantity_out' => 0,
        'days' => 0,
        'price' => 0,
        'total_price' => 0,
        'status' => 'Drying',
    ];

    protected $appends = ['remaining_quantity'];

    // Status constants
    const STATUS_DRYING = 'Drying';
    const STATUS_DRIED = 'Dried';
    const STATUS_POSTPONED = 'Postponed';
    const STATUS_CANCELLED = 'Cancelled';

    /**
     * Get the batch this drying record was drawn from (if any).
     */
    public function batch(): BelongsTo
    {
        return $this->belongsTo(ProcurementBatch::class, 'batch_id');
    }

    /**
     * Get the individual procurement this drying record belongs to (if any).
     */
    public function procurement(): BelongsTo
    {
        return $this->belongsTo(Procurement::class);
    }

    /**
     * Pivot rows distributing this batch drying across procurements.
     */
    public function batchProcurements(): HasMany
    {
        return $this->hasMany(DryingBatchProcurement::class, 'drying_process_id');
    }

    /**
     * Recalculate total_price = (sacks * price) * days
     */
    public function recalculateTotal(): void
    {
        $this->total_price = ($this->sacks * $this->price) * $this->days;
    }

    /**
     * Get remaining quantity (quantity_kg - quantity_out)
     */
    public function getRemainingQuantityAttribute(): float
    {
        return max(0, (float) $this->quantity_kg - (float) $this->quantity_out);
    }

    /**
     * Scope for active drying records
     */
    public function scopeDrying($query)
    {
        return $query->where('status', self::STATUS_DRYING);
    }

    /**
     * Scope for dried records
     */
    public function scopeDried($query)
    {
        return $query->where('status', self::STATUS_DRIED);
    }

    /**
     * Scope for non-cancelled records
     */
    public function scopeActive($query)
    {
        return $query->whereIn('status', [self::STATUS_DRYING, self::STATUS_DRIED]);
    }
}
