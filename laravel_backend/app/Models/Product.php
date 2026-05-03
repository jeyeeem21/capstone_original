<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use App\Traits\HasArchiving;

class Product extends Model
{
    use HasFactory, HasArchiving;

    /**
     * The primary key for the model.
     */
    protected $primaryKey = 'product_id';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'product_name',
        'variety_id',
        'price',
        'stocks',
        'stock_floor',
        'unit',
        'weight',
        'image',
        'status',
        'is_deleted',
        'is_archived',
        'archived_at',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'price' => 'decimal:2',
        'weight' => 'decimal:2',
        'stocks' => 'integer',
        'stock_floor' => 'integer',
        'is_deleted' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Default values for attributes.
     */
    protected $attributes = [
        'status' => 'active',
        'is_deleted' => false,
        'stocks' => 0,
        'stock_floor' => 0,
        'unit' => 'kg',
    ];

    /**
     * Boot the model.
     */
    protected static function boot()
    {
        parent::boot();

        // Global scope to exclude soft deleted items
        static::addGlobalScope('notDeleted', function (Builder $builder) {
            $builder->where('is_deleted', false);
        });
    }

    /**
     * Scope for active products.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope for inactive products.
     */
    public function scopeInactive(Builder $query): Builder
    {
        return $query->where('status', 'inactive');
    }

    /**
     * Scope to include deleted items.
     */
    public function scopeWithDeleted(Builder $query): Builder
    {
        return $query->withoutGlobalScope('notDeleted');
    }

    /**
     * Scope for only deleted items.
     */
    public function scopeOnlyDeleted(Builder $query): Builder
    {
        return $query->withoutGlobalScope('notDeleted')->where('is_deleted', true);
    }

    /**
     * Relationship with Variety.
     */
    public function variety()
    {
        return $this->belongsTo(\App\Models\Variety::class, 'variety_id');
    }

    /**
     * Relationship with SaleItems.
     */
    public function saleItems()
    {
        return $this->hasMany(\App\Models\SaleItem::class, 'product_id', 'product_id');
    }

    /**
     * Soft delete the product.
     */
    public function softDelete(): bool
    {
        $this->is_deleted = true;
        return $this->save();
    }

    /**
     * Restore the product.
     */
    public function restore(): bool
    {
        $this->is_deleted = false;
        return $this->save();
    }

    /**
     * Check if product is in stock.
     */
    public function isInStock(): bool
    {
        return $this->stocks > 0;
    }

    /**
     * Check if product is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
