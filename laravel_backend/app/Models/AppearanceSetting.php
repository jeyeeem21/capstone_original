<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppearanceSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'label',
        'description',
        'category',
        'sort_order',
    ];

    /**
     * Get all settings as key-value pairs
     */
    public static function getAllAsKeyValue(): array
    {
        return self::orderBy('sort_order')
            ->pluck('value', 'key')
            ->toArray();
    }

    /**
     * Get settings grouped by category
     */
    public static function getGroupedByCategory(): array
    {
        return self::orderBy('sort_order')
            ->get()
            ->groupBy('category')
            ->toArray();
    }

    /**
     * Update a setting by key (creates if not exists)
     */
    public static function updateByKey(string $key, string $value): bool
    {
        $setting = self::where('key', $key)->first();

        if ($setting) {
            return $setting->update(['value' => $value]);
        }

        // Create the setting if it doesn't exist
        self::create([
            'key' => $key,
            'value' => $value,
            'label' => ucwords(str_replace('_', ' ', $key)),
            'description' => '',
            'category' => 'general',
            'sort_order' => 99,
        ]);

        return true;
    }

    /**
     * Bulk update settings
     */
    public static function bulkUpdate(array $settings): void
    {
        foreach ($settings as $key => $value) {
            self::updateByKey($key, $value);
        }
    }
}
