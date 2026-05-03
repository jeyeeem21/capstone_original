<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class DryingBatchProcurement extends Model
{
    protected $table = 'drying_batch_procurements';

    public $timestamps = true;

    protected $fillable = [
        'drying_process_id',
        'procurement_id',
        'sacks_taken',
        'quantity_kg',
    ];

    protected $casts = [
        'sacks_taken' => 'integer',
        'quantity_kg' => 'decimal:2',
    ];

    public function dryingProcess(): BelongsTo
    {
        return $this->belongsTo(DryingProcess::class);
    }

    public function procurement(): BelongsTo
    {
        return $this->belongsTo(Procurement::class);
    }
}
