<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppearanceSetting;
use App\Traits\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AppearanceSettingController extends Controller
{
    use AuditLogger;

    /**
     * Get all appearance settings as key-value pairs (for frontend theme)
     */
    public function index(): JsonResponse
    {
        $settings = AppearanceSetting::getAllAsKeyValue();
        
        return response()->json([
            'success' => true,
            'data' => $settings,
        ]);
    }

    /**
     * Get all settings with full details grouped by category
     */
    public function getGrouped(): JsonResponse
    {
        $settings = AppearanceSetting::getGroupedByCategory();
        
        return response()->json([
            'success' => true,
            'data' => $settings,
        ]);
    }

    /**
     * Get all settings with full details
     */
    public function getAll(): JsonResponse
    {
        $settings = AppearanceSetting::orderBy('sort_order')->get();
        
        return response()->json([
            'success' => true,
            'data' => $settings,
        ]);
    }

    /**
     * Update multiple settings at once
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string',
            'settings.*.value' => 'required|string',
        ]);

        foreach ($validated['settings'] as $setting) {
            AppearanceSetting::updateByKey($setting['key'], $setting['value']);
        }

        $this->logAudit('UPDATE', 'Appearance Settings', 'Updated appearance settings', [
            'updated_keys' => array_column($validated['settings'], 'key'),
        ]);

        // Return updated settings
        $settings = AppearanceSetting::getAllAsKeyValue();

        return response()->json([
            'success' => true,
            'message' => 'Appearance settings updated successfully',
            'data' => $settings,
        ]);
    }

    /**
     * Update a single setting
     */
    public function updateSingle(Request $request, string $key): JsonResponse
    {
        $validated = $request->validate([
            'value' => 'required|string',
        ]);

        $setting = AppearanceSetting::where('key', $key)->first();

        if (!$setting) {
            return response()->json([
                'success' => false,
                'message' => 'Setting not found',
            ], 404);
        }

        $oldValue = $setting->value;
        $setting->update(['value' => $validated['value']]);

        $this->logAudit('UPDATE', 'Appearance Settings', "Updated appearance setting: {$key}", [
            'key' => $key,
            'old_value' => $oldValue,
            'new_value' => $validated['value'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Setting updated successfully',
            'data' => $setting,
        ]);
    }

    /**
     * Reset all settings to defaults
     */
    public function reset(): JsonResponse
    {
        // Re-run the seeder to reset to defaults
        $seeder = new \Database\Seeders\AppearanceSettingSeeder();
        $seeder->run();

        $this->logAudit('UPDATE', 'Appearance Settings', 'Reset all appearance settings to defaults');

        $settings = AppearanceSetting::getAllAsKeyValue();

        return response()->json([
            'success' => true,
            'message' => 'Settings reset to defaults',
            'data' => $settings,
        ]);
    }
}
