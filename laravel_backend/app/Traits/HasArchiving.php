<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

/**
 * Provides two-tier archiving for Eloquent models.
 *
 * Tier 1 – Archive:  is_archived = true   (record moves to Archive page)
 * Tier 2 – Soft-Delete: deleted_at / is_deleted  (record hidden everywhere, stays in DB)
 *
 * Usage: add `use HasArchiving;` to the model and include
 *        'is_archived' and 'archived_at' in $fillable.
 */
trait HasArchiving
{
    /**
     * Boot the trait — add a global scope that hides archived records
     * from normal queries.
     */
    public static function bootHasArchiving(): void
    {
        static::addGlobalScope('notArchived', function (Builder $builder) {
            $table = (new static)->getTable();
            $builder->where("{$table}.is_archived", false);
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Scopes                                                            */
    /* ------------------------------------------------------------------ */

    /**
     * Include archived records in the query (bypass the global scope).
     */
    public function scopeWithArchived(Builder $query): Builder
    {
        return $query->withoutGlobalScope('notArchived');
    }

    /**
     * Return ONLY archived records.
     */
    public function scopeOnlyArchived(Builder $query): Builder
    {
        return $query->withoutGlobalScope('notArchived')
                     ->where($this->getTable() . '.is_archived', true);
    }

    /* ------------------------------------------------------------------ */
    /*  Actions                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * Archive the record (Tier 1).
     */
    public function archive(): bool
    {
        $this->is_archived = true;
        $this->archived_at = now();
        return $this->save();
    }

    /**
     * Un-archive (restore from archive page back to main page).
     */
    public function unarchive(): bool
    {
        $this->is_archived = false;
        $this->archived_at = null;
        return $this->save();
    }
}
