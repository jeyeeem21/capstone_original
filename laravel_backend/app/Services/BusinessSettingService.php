<?php

namespace App\Services;

use App\Models\BusinessSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;

/**
 * Service class for Business Settings
 * Handles all business logic related to settings
 */
class BusinessSettingService
{
    private const CACHE_KEY = 'business_settings';
    private const CACHE_TTL = 300; // 5 minutes

    /**
     * Get all business settings with caching
     */
    public function getAllSettings(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return $this->fetchAllFromDatabase();
        });
    }

    /**
     * Fetch all settings from database
     */
    private function fetchAllFromDatabase(): array
    {
        $settings = BusinessSetting::all();
        $result = [];

        foreach ($settings as $setting) {
            $result[$setting->key] = $this->castValue($setting->value, $setting->type);
        }

        return $result;
    }

    /**
     * Cast value based on type
     */
    private function castValue($value, string $type)
    {
        return match($type) {
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'number' => is_numeric($value) ? (float) $value : null,
            'json' => json_decode($value, true),
            default => $value,
        };
    }

    /**
     * Get a single setting value
     */
    public function getValue(string $key, $default = null)
    {
        $settings = $this->getAllSettings();
        return $settings[$key] ?? $default;
    }

    /**
     * Update multiple settings
     */
    public function updateSettings(array $data): array
    {
        foreach ($data as $key => $value) {
            // Allow null values to clear settings (e.g., clearing SMTP password)
            BusinessSetting::updateOrCreate(
                ['key' => $key],
                ['value' => $value !== null ? (string) $value : '', 'type' => 'string']
            );
        }

        // Clear cache and return fresh data
        $this->clearCache();
        
        return $this->getAllSettings();
    }

    /**
     * Upload and save logo
     */
    public function uploadLogo(UploadedFile $file): string
    {
        // Delete old logo if exists
        $oldLogo = $this->getValue('business_logo');
        if ($oldLogo && str_starts_with($oldLogo, '/storage/')) {
            $relativePath = str_replace('/storage/', '', $oldLogo);
            if (Storage::disk('public')->exists($relativePath)) {
                Storage::disk('public')->delete($relativePath);
            }
        }

        // Store new logo
        $filename = 'logo_' . time() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('logos', $filename, 'public');
        $logoUrl = '/storage/' . $path;

        // Update setting
        BusinessSetting::updateOrCreate(
            ['key' => 'business_logo'],
            ['value' => $logoUrl, 'type' => 'string']
        );

        $this->clearCache();

        return $logoUrl;
    }

    /**
     * Upload and save GCash QR code
     */
    public function uploadGcashQr(UploadedFile $file): string
    {
        // Delete old QR if exists
        $oldQr = $this->getValue('gcash_qr');
        if ($oldQr && str_starts_with($oldQr, '/storage/')) {
            $relativePath = str_replace('/storage/', '', $oldQr);
            if (Storage::disk('public')->exists($relativePath)) {
                Storage::disk('public')->delete($relativePath);
            }
        }

        // Store new QR code
        $filename = 'gcash_qr_' . time() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('gcash', $filename, 'public');
        $qrUrl = '/storage/' . $path;

        // Update setting
        BusinessSetting::updateOrCreate(
            ['key' => 'gcash_qr'],
            ['value' => $qrUrl, 'type' => 'string']
        );

        $this->clearCache();

        return $qrUrl;
    }

    /**
     * Get formatted business hours
     */
    public function getFormattedBusinessHours(): string
    {
        $settings = $this->getAllSettings();
        
        // Check for per-day schedule first
        if (!empty($settings['business_hours_json'])) {
            $schedule = json_decode($settings['business_hours_json'], true);
            if (is_array($schedule)) {
                $dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                $shortNames = [
                    'monday' => 'Mon', 'tuesday' => 'Tue', 'wednesday' => 'Wed',
                    'thursday' => 'Thu', 'friday' => 'Fri', 'saturday' => 'Sat', 'sunday' => 'Sun',
                ];

                // Build a signature for each day
                $groups = [];
                foreach ($dayOrder as $day) {
                    $d = $schedule[$day] ?? ['open' => '07:00', 'close' => '18:00', 'closed' => false];
                    $sig = !empty($d['closed']) ? 'closed' : ($d['open'] ?? '07:00') . '-' . ($d['close'] ?? '18:00');
                    if (!empty($groups) && end($groups)['sig'] === $sig) {
                        $groups[array_key_last($groups)]['end'] = $day;
                    } else {
                        $groups[] = ['start' => $day, 'end' => $day, 'sig' => $sig, 'data' => $d];
                    }
                }

                $lines = [];
                foreach ($groups as $g) {
                    $label = $g['start'] === $g['end']
                        ? $shortNames[$g['start']]
                        : $shortNames[$g['start']] . ' - ' . $shortNames[$g['end']];
                    if ($g['sig'] === 'closed') {
                        $lines[] = "{$label}: Closed";
                    } else {
                        $open = date('g:i A', strtotime($g['data']['open'] ?? '07:00'));
                        $close = date('g:i A', strtotime($g['data']['close'] ?? '18:00'));
                        $lines[] = "{$label}: {$open} - {$close}";
                    }
                }
                return implode("\n", $lines);
            }
        }

        // Fallback to simple format
        $openDays = $settings['business_open_days'] ?? 'Monday - Saturday';
        $openTime = $settings['business_open_time'] ?? '07:00';
        $closeTime = $settings['business_close_time'] ?? '18:00';

        $openFormatted = date('g:i A', strtotime($openTime));
        $closeFormatted = date('g:i A', strtotime($closeTime));

        return "{$openDays}: {$openFormatted} - {$closeFormatted}";
    }

    /**
     * Clear settings cache
     */
    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * Refresh cache with fresh data
     */
    public function refreshCache(): array
    {
        $this->clearCache();
        return $this->getAllSettings();
    }
}
