<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\HasArchiving;

class Supplier extends Model
{
    use SoftDeletes, HasArchiving;

    protected $fillable = [
        'name',
        'contact',
        'phone',
        'email',
        'address',
        'status',
        'is_archived',
        'archived_at',
        'products',
    ];

    protected $casts = [
        'products' => 'integer',
    ];

    /**
     * Get all procurements from this supplier.
     */
    public function procurements()
    {
        return $this->hasMany(Procurement::class);
    }
}
