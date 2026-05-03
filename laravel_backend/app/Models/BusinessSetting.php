<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Business Setting Model
 * Simple model for key-value storage
 */
class BusinessSetting extends Model
{
    protected $fillable = ['key', 'value', 'type'];

    /**
     * Per-request cache of all settings (avoids repeated DB queries).
     */
    private static ?array $cachedSettings = null;

    /**
     * Get a setting value by key (cached — single DB query per request)
     */
    public static function getValue(string $key, $default = null)
    {
        if (self::$cachedSettings === null) {
            self::$cachedSettings = self::all()->keyBy('key')->toArray();
        }

        $setting = self::$cachedSettings[$key] ?? null;

        if (!$setting) {
            return $default;
        }

        return match($setting['type'] ?? 'string') {
            'boolean' => filter_var($setting['value'], FILTER_VALIDATE_BOOLEAN),
            'number' => is_numeric($setting['value']) ? (float) $setting['value'] : $default,
            'json' => json_decode($setting['value'], true) ?? $default,
            default => $setting['value'],
        };
    }

    /**
     * Clear the settings cache (call after setValue)
     */
    public static function clearCache(): void
    {
        self::$cachedSettings = null;
    }

    /**
     * Set a setting value
     */
    public static function setValue(string $key, $value, string $type = 'string'): void
    {
        $storedValue = match($type) {
            'json' => is_string($value) ? $value : json_encode($value),
            'boolean' => $value ? '1' : '0',
            default => (string) $value,
        };

        self::updateOrCreate(
            ['key' => $key],
            ['value' => $storedValue, 'type' => $type]
        );

        self::clearCache();
    }
}
