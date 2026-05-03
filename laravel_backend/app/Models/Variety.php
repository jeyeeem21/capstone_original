<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\HasArchiving;

class Variety extends Model
{
    use SoftDeletes, HasArchiving;

    protected $table = 'varieties';

    protected $fillable = [
        'name',
        'description',
        'color',
        'status',
        'is_archived',
        'archived_at',
        'products_count',
    ];

    protected $casts = [
        'products_count' => 'integer',
    ];

    protected $attributes = [
        'color' => '#22c55e',
        'status' => 'Active',
    ];

    /**
     * Get the products that belong to this variety.
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'variety_id');
    }

    /**
     * Get the procurements that use this variety.
     */
    public function procurements(): HasMany
    {
        return $this->hasMany(Procurement::class);
    }
}
