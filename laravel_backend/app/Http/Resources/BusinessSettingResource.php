<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Business Settings Resource
 * Transforms business settings data for API responses
 */
class BusinessSettingResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        // When used with a collection/array of settings
        if (is_array($this->resource)) {
            return $this->transformSettings($this->resource);
        }

        // When used with a single setting model
        return [
            'key' => $this->key,
            'value' => $this->value,
            'type' => $this->type,
        ];
    }

    /**
     * Transform settings array
     */
    private function transformSettings(array $settings): array
    {
        return [
            'business_name' => $settings['business_name'] ?? 'KJP Ricemill',
            'business_tagline' => $settings['business_tagline'] ?? 'Inventory & Sales',
            'business_start_year' => $settings['business_start_year'] ?? '2010',
            'business_logo' => $this->resolveUrl($settings['business_logo'] ?? '/storage/logos/KJPLogo.png'),
            'business_email' => $settings['business_email'] ?? '',
            'business_phone' => $settings['business_phone'] ?? '',
            'business_address' => $settings['business_address'] ?? '',
            'business_open_days' => $settings['business_open_days'] ?? 'Monday - Saturday',
            'business_open_time' => $settings['business_open_time'] ?? '07:00',
            'business_close_time' => $settings['business_close_time'] ?? '18:00',
            'business_hours_json' => $settings['business_hours_json'] ?? '',
            'business_hours' => $settings['business_hours'] ?? '',
            'business_hours_formatted' => $settings['business_hours_formatted'] ?? '',
            'footer_tagline' => $settings['footer_tagline'] ?? 'Your trusted partner in quality rice processing and distribution.',
            'footer_copyright' => $settings['footer_copyright'] ?? 'Management System. All rights reserved.',
            'footer_powered_by' => $settings['footer_powered_by'] ?? 'Powered by XianFire Framework. Built at Mindoro State University',
            'footer_badge1' => $settings['footer_badge1'] ?? 'Premium Quality',
            'footer_badge2' => $settings['footer_badge2'] ?? 'ISO Certified',
            'social_facebook' => $settings['social_facebook'] ?? '',
            'social_twitter' => $settings['social_twitter'] ?? '',
            'social_instagram' => $settings['social_instagram'] ?? '',
            'social_linkedin' => $settings['social_linkedin'] ?? '',
            'shipping_rate_per_sack' => $settings['shipping_rate_per_sack'] ?? '',
            'shipping_rate_per_km' => $settings['shipping_rate_per_km'] ?? '',
            'shipping_base_km' => $settings['shipping_base_km'] ?? '',
            'warehouse_address' => $settings['warehouse_address'] ?? '',
            'google_maps_embed' => $settings['google_maps_embed'] ?? '',
        ];
    }

    /**
     * Create a new resource instance with additional data
     */
    public static function make($resource)
    {
        return new static($resource);
    }

    /**
     * Resolve a storage path to a full URL
     */
    private function resolveUrl(?string $path): ?string
    {
        if (!$path) return null;
        if (str_starts_with($path, 'http')) return $path;
        return url($path);
    }
}
