<?php

namespace App\Traits;

use Illuminate\Support\Facades\Cache;

/**
 * Trait for caching functionality
 * Use this trait in models or services that need caching
 */
trait HasCaching
{
    /**
     * Get cache key prefix for this class
     */
    protected static function getCachePrefix(): string
    {
        return strtolower(class_basename(static::class)) . '_';
    }

    /**
     * Get a cached value or execute callback
     */
    protected static function cached(string $key, int $ttl, callable $callback)
    {
        $cacheKey = static::getCachePrefix() . $key;
        return Cache::remember($cacheKey, $ttl, $callback);
    }

    /**
     * Clear a specific cache key
     */
    protected static function clearCacheKey(string $key): void
    {
        $cacheKey = static::getCachePrefix() . $key;
        Cache::forget($cacheKey);
    }

    /**
     * Clear all cache for this class (by pattern)
     */
    protected static function clearAllCache(): void
    {
        // For file/array cache, we need to forget specific keys
        // For Redis, we could use pattern matching
        Cache::flush(); // Be careful with this in production
    }

    /**
     * Cache a value
     */
    protected static function cacheValue(string $key, $value, int $ttl = 300): void
    {
        $cacheKey = static::getCachePrefix() . $key;
        Cache::put($cacheKey, $value, $ttl);
    }

    /**
     * Get cached value
     */
    protected static function getCachedValue(string $key)
    {
        $cacheKey = static::getCachePrefix() . $key;
        return Cache::get($cacheKey);
    }
}
