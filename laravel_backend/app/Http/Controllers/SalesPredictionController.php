<?php

namespace App\Http\Controllers;

use App\Services\SalesPredictionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalesPredictionController extends Controller
{
    public function __construct(
        private SalesPredictionService $predictionService
    ) {}

    /**
     * Get predictive analysis data.
     */
    public function predictions(Request $request): JsonResponse
    {
        try {
            $period = $request->query('period', 'daily');

            if (!in_array($period, ['daily', 'monthly', 'yearly'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid period. Use: daily, monthly, yearly',
                ], 422);
            }

            $data = $this->predictionService->getPredictions($period);

            return response()->json([
                'success' => true,
                'data' => $data,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate predictions',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Refresh prediction cache.
     */
    public function refresh(): JsonResponse
    {
        try {
            $this->predictionService->clearCache();

            return response()->json([
                'success' => true,
                'message' => 'Prediction cache cleared. Next request will regenerate.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to refresh predictions',
            ], 500);
        }
    }
}
