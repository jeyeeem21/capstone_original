<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class ProcurementBatch extends Model
{
    use SoftDeletes;

    protected $table = 'procurement_batches';

    protected $fillable = [
        'batch_number',
        'variety_id',
        'season_date',
        'total_sacks',
        'total_kg',
        'remaining_sacks',
        'remaining_kg',
        'status',
        'notes',
    ];

    protected $casts = [
        'season_date'      => 'date',
        'total_sacks'      => 'integer',
        'total_kg'         => 'decimal:2',
        'remaining_sacks'  => 'integer',
        'remaining_kg'     => 'decimal:2',
    ];

    protected $attributes = [
        'total_sacks'     => 0,
        'total_kg'        => 0,
        'remaining_sacks' => 0,
        'remaining_kg'    => 0,
        'status'          => 'Open',
    ];

    const STATUS_OPEN      = 'Open';
    const STATUS_CLOSED    = 'Closed';
    const STATUS_COMPLETED = 'Completed';

    // ── Relationships ────────────────────────────────────────────────

    public function variety(): BelongsTo
    {
        return $this->belongsTo(Variety::class);
    }

    public function procurements(): HasMany
    {
        return $this->hasMany(Procurement::class, 'batch_id');
    }

    public function dryingProcesses(): HasMany
    {
        return $this->hasMany(DryingProcess::class, 'batch_id');
    }

    // ── Helpers ──────────────────────────────────────────────────────

    /**
     * Generate the next batch number: BATCH-YYYYMMDD-XXX
     * The sequence (XXX) increments per year and resets to 001 each new year.
     */
    public static function generateBatchNumber(): string
    {
        $now     = now();
        $dateStr = $now->format('Ymd');
        $year    = $now->format('Y');

        // Find the highest sequence number used this year (any date in the same year)
        $last = static::withTrashed()
            ->where('batch_number', 'like', "BATCH-{$year}%")
            ->orderByRaw("CAST(SUBSTRING(batch_number, -3) AS UNSIGNED) DESC")
            ->value('batch_number');

        $seq = $last ? ((int) substr($last, -3)) + 1 : 1;

        return "BATCH-{$dateStr}-" . str_pad($seq, 3, '0', STR_PAD_LEFT);
    }

    /**
     * Recalculate denormalized totals from live procurement data.
     * Call this after adding/removing a procurement from the batch.
     */
    public function recalculateTotals(): void
    {
        $agg = $this->procurements()
            ->selectRaw('COALESCE(SUM(sacks), 0) as s, COALESCE(SUM(quantity_kg), 0) as k')
            ->first();

        // remaining = total minus what drying_batch_procurements records have consumed
        $usedSacks = DB::table('drying_batch_procurements')
            ->join('drying_processes', 'drying_processes.id', '=', 'drying_batch_procurements.drying_process_id')
            ->where('drying_processes.batch_id', $this->id)
            ->whereNull('drying_processes.deleted_at')
            ->sum('drying_batch_procurements.sacks_taken');

        $usedKg = DB::table('drying_batch_procurements')
            ->join('drying_processes', 'drying_processes.id', '=', 'drying_batch_procurements.drying_process_id')
            ->where('drying_processes.batch_id', $this->id)
            ->whereNull('drying_processes.deleted_at')
            ->sum('drying_batch_procurements.quantity_kg');

        // Also subtract procurements that were individually dried (not via batch)
        $individualUsedSacks = $this->procurements()
            ->join('drying_processes', 'drying_processes.procurement_id', '=', 'procurements.id')
            ->whereNull('drying_processes.batch_id')
            ->whereNull('drying_processes.deleted_at')
            ->sum('drying_processes.sacks');

        $individualUsedKg = $this->procurements()
            ->join('drying_processes', 'drying_processes.procurement_id', '=', 'procurements.id')
            ->whereNull('drying_processes.batch_id')
            ->whereNull('drying_processes.deleted_at')
            ->sum('drying_processes.quantity_kg');

        $totalSacks = (int) $agg->s;
        $totalKg    = (float) $agg->k;

        $this->update([
            'total_sacks'     => $totalSacks,
            'total_kg'        => $totalKg,
            'remaining_sacks' => max(0, $totalSacks - (int)$usedSacks - (int)$individualUsedSacks),
            'remaining_kg'    => max(0, $totalKg - (float)$usedKg - (float)$individualUsedKg),
        ]);
    }

    /**
     * Average kg per sack across all procurements in this batch.
     */
    public function avgKgPerSack(): float
    {
        if ($this->total_sacks <= 0) return 0;
        return round($this->total_kg / $this->total_sacks, 4);
    }
}
