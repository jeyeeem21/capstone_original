<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use App\Traits\HasArchiving;

class Processing extends Model
{
    use SoftDeletes, HasArchiving;

    protected $fillable = [
        'procurement_id',
        'drying_process_id',
        'input_kg',
        'output_kg',
        'stock_out',
        'husk_kg',
        'yield_percent',
        'operator_name',
        'status',
        'is_archived',
        'archived_at',
        'processing_date',
        'completed_date',
    ];

    protected $casts = [
        'input_kg' => 'decimal:2',
        'output_kg' => 'decimal:2',
        'stock_out' => 'decimal:2',
        'husk_kg' => 'decimal:2',
        'yield_percent' => 'decimal:2',
        'processing_date' => 'date',
        'completed_date' => 'date',
    ];

    protected $appends = ['stock_status', 'remaining_stock'];

    // Status constants
    const STATUS_PENDING = 'Pending';
    const STATUS_PROCESSING = 'Processing';
    const STATUS_COMPLETED = 'Completed';

    /**
     * Get the procurement that this processing is from
     */
    public function procurement(): BelongsTo
    {
        return $this->belongsTo(Procurement::class);
    }

    /**
     * Get the drying process that this processing is from (legacy single source)
     */
    public function dryingProcess(): BelongsTo
    {
        return $this->belongsTo(DryingProcess::class);
    }

    /**
     * Get all drying sources for this processing (multi-source support)
     * Each pivot row stores quantity_kg taken from that source
     */
    public function dryingSources(): BelongsToMany
    {
        return $this->belongsToMany(DryingProcess::class, 'processing_drying_sources')
            ->withPivot('quantity_kg')
            ->withTimestamps();
    }

    /**
     * Calculate husk and yield when output is set
     */
    public function calculateResults(float $outputKg): void
    {
        $this->output_kg = $outputKg;
        $this->husk_kg = $this->input_kg - $outputKg;
        $this->yield_percent = $this->input_kg > 0 
            ? ($outputKg / $this->input_kg) * 100 
            : 0;
    }

    /**
     * Get stock status based on stock_out vs output_kg
     * Pending = stock_out is 0, Partial = some distributed, Distributed = all distributed
     */
    public function getStockStatusAttribute(): string
    {
        if ($this->status !== self::STATUS_COMPLETED) {
            return $this->status; // Return regular status for non-completed
        }
        
        if ($this->stock_out <= 0) {
            return 'Pending';
        }
        
        if ($this->stock_out >= $this->output_kg) {
            return 'Distributed';
        }
        
        return 'Partial';
    }

    /**
     * Get remaining stock (output_kg - stock_out)
     */
    public function getRemainingStockAttribute(): float
    {
        return max(0, (float)$this->output_kg - (float)$this->stock_out);
    }

    /**
     * Scope for pending records
     */
    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    /**
     * Scope for processing records
     */
    public function scopeProcessing($query)
    {
        return $query->where('status', self::STATUS_PROCESSING);
    }

    /**
     * Scope for completed records
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', self::STATUS_COMPLETED);
    }

    /**
     * Scope for active (non-completed) records
     */
    public function scopeActive($query)
    {
        return $query->whereIn('status', [self::STATUS_PENDING, self::STATUS_PROCESSING]);
    }
}
