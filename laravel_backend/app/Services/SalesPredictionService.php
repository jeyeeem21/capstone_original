<?php

namespace App\Services;

use App\Models\Sale;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Carbon;

class SalesPredictionService
{
    private const CACHE_KEY = 'sales_predictions';
    private const CACHE_TTL = 600; // 10 minutes

    /**
     * Get full predictive analysis data.
     */
    public function getPredictions(string $period = 'daily'): array
    {
        $cacheKey = self::CACHE_KEY . "_{$period}";

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($period) {
            $sales = $this->getCompletedSales();

            return [
                'historical' => $this->getHistoricalData($sales, $period),
                'forecast' => $this->getForecast($sales, $period),
                'summary' => $this->getSummary($sales, $period),
                'top_products' => $this->getTopProductPredictions($sales),
                'demand_trends' => $this->getDemandTrends($sales),
                'period' => $period,
                'generated_at' => now()->toISOString(),
            ];
        });
    }

    /**
     * Get completed/delivered sales for analysis.
     */
    private function getCompletedSales()
    {
        return Sale::with('items.product.variety')
            ->whereIn('status', ['completed', 'delivered'])
            ->orderBy('created_at', 'asc')
            ->get();
    }

    /**
     * Get historical aggregated data.
     */
    private function getHistoricalData($sales, string $period): array
    {
        $grouped = $this->groupSalesByPeriod($sales, $period);
        $result = [];

        foreach ($grouped as $label => $periodSales) {
            $revenue = $periodSales->sum('total');
            $orders = $periodSales->count();
            $items = $periodSales->sum(fn ($s) => $s->items->sum('quantity'));

            $result[] = [
                'name' => $label,
                'revenue' => round((float) $revenue, 2),
                'orders' => $orders,
                'items' => $items,
                'avg_order' => $orders > 0 ? round((float) $revenue / $orders, 2) : 0,
                'type' => 'actual',
            ];
        }

        return $result;
    }

    /**
     * Generate forecast using weighted moving average + linear trend.
     */
    private function getForecast($sales, string $period): array
    {
        $historical = $this->getHistoricalData($sales, $period);

        if (count($historical) < 3) {
            return []; // Need at least 3 data points
        }

        $revenues = array_column($historical, 'revenue');
        $orders = array_column($historical, 'orders');
        $items = array_column($historical, 'items');

        // Number of forecast periods
        $forecastCount = match ($period) {
            'daily' => 14,    // 14 days ahead
            'monthly' => 6,   // 6 months ahead
            'yearly' => 3,    // 3 years ahead
            default => 7,
        };

        $forecastRevenue = $this->weightedMovingAverageForecast($revenues, $forecastCount);
        $forecastOrders = $this->weightedMovingAverageForecast($orders, $forecastCount);
        $forecastItems = $this->weightedMovingAverageForecast($items, $forecastCount);

        $labels = $this->generateForecastLabels($period, $forecastCount);

        $result = [];
        for ($i = 0; $i < $forecastCount; $i++) {
            $result[] = [
                'name' => $labels[$i],
                'revenue' => round(max(0, $forecastRevenue[$i]), 2),
                'orders' => max(0, round($forecastOrders[$i])),
                'items' => max(0, round($forecastItems[$i])),
                'avg_order' => $forecastOrders[$i] > 0
                    ? round($forecastRevenue[$i] / max(1, $forecastOrders[$i]), 2)
                    : 0,
                'type' => 'forecast',
            ];
        }

        return $result;
    }

    /**
     * Weighted Moving Average with linear trend adjustment.
     * Recent data points carry more weight.
     */
    private function weightedMovingAverageForecast(array $values, int $forecastCount): array
    {
        $n = count($values);
        if ($n === 0) return array_fill(0, $forecastCount, 0);

        // Use last N points for WMA (window size)
        $windowSize = min($n, 7);
        $window = array_slice($values, -$windowSize);

        // Generate weights (more recent = higher weight)
        $weights = [];
        for ($i = 1; $i <= count($window); $i++) {
            $weights[] = $i;
        }
        $weightSum = array_sum($weights);

        // Weighted average
        $wma = 0;
        for ($i = 0; $i < count($window); $i++) {
            $wma += $window[$i] * $weights[$i] / $weightSum;
        }

        // Calculate linear trend from the full dataset
        $trend = $this->calculateLinearTrend($values);

        // Generate forecasts: WMA base + trend adjustment
        $forecasts = [];
        for ($i = 1; $i <= $forecastCount; $i++) {
            $forecast = $wma + ($trend * $i);
            $forecasts[] = $forecast;
        }

        return $forecasts;
    }

    /**
     * Calculate linear trend (slope) using least squares regression.
     */
    private function calculateLinearTrend(array $values): float
    {
        $n = count($values);
        if ($n < 2) return 0;

        // Use last 12 data points max for trend calculation
        $recent = array_slice($values, -min($n, 12));
        $n = count($recent);

        $sumX = 0;
        $sumY = 0;
        $sumXY = 0;
        $sumX2 = 0;

        for ($i = 0; $i < $n; $i++) {
            $x = $i + 1;
            $y = $recent[$i];
            $sumX += $x;
            $sumY += $y;
            $sumXY += $x * $y;
            $sumX2 += $x * $x;
        }

        $denominator = ($n * $sumX2) - ($sumX * $sumX);
        if ($denominator == 0) return 0;

        return (($n * $sumXY) - ($sumX * $sumY)) / $denominator;
    }

    /**
     * Generate labels for forecast periods.
     */
    private function generateForecastLabels(string $period, int $count): array
    {
        $labels = [];
        $now = Carbon::now();

        for ($i = 1; $i <= $count; $i++) {
            $labels[] = match ($period) {
                'daily' => $now->copy()->addDays($i)->format('M d'),
                'monthly' => $now->copy()->addMonths($i)->format('M Y'),
                'yearly' => $now->copy()->addYears($i)->format('Y'),
                default => (string) $i,
            };
        }

        return $labels;
    }

    /**
     * Get prediction summary with confidence metrics.
     */
    private function getSummary($sales, string $period): array
    {
        $historical = $this->getHistoricalData($sales, $period);
        $forecast = $this->getForecast($sales, $period);

        if (empty($historical) || empty($forecast)) {
            return [
                'predicted_revenue' => 0,
                'predicted_orders' => 0,
                'predicted_items' => 0,
                'revenue_trend' => 'stable',
                'trend_percentage' => 0,
                'confidence' => 'low',
                'data_points' => count($historical),
                'avg_historical_revenue' => 0,
                'growth_rate' => 0,
            ];
        }

        $avgHistorical = collect($historical)->avg('revenue');
        $avgForecast = collect($forecast)->avg('revenue');

        // Calculate trend
        $trendPct = $avgHistorical > 0
            ? round((($avgForecast - $avgHistorical) / $avgHistorical) * 100, 1)
            : 0;

        $trend = match (true) {
            $trendPct > 5 => 'growing',
            $trendPct < -5 => 'declining',
            default => 'stable',
        };

        // Confidence based on data points available
        $dataPoints = count($historical);
        $confidence = match (true) {
            $dataPoints >= 30 => 'high',
            $dataPoints >= 12 => 'medium',
            default => 'low',
        };

        // Next period prediction
        $nextPeriod = $forecast[0] ?? ['revenue' => 0, 'orders' => 0, 'items' => 0];

        // Growth rate (month-over-month or period-over-period)
        $lastTwo = array_slice($historical, -2);
        $growthRate = 0;
        if (count($lastTwo) === 2 && $lastTwo[0]['revenue'] > 0) {
            $growthRate = round((($lastTwo[1]['revenue'] - $lastTwo[0]['revenue']) / $lastTwo[0]['revenue']) * 100, 1);
        }

        return [
            'predicted_revenue' => round($nextPeriod['revenue'], 2),
            'predicted_orders' => $nextPeriod['orders'],
            'predicted_items' => $nextPeriod['items'],
            'revenue_trend' => $trend,
            'trend_percentage' => $trendPct,
            'confidence' => $confidence,
            'data_points' => $dataPoints,
            'avg_historical_revenue' => round($avgHistorical, 2),
            'growth_rate' => $growthRate,
        ];
    }

    /**
     * Get top product predictions based on sales velocity.
     */
    private function getTopProductPredictions($sales): array
    {
        $productStats = [];

        foreach ($sales as $sale) {
            foreach ($sale->items as $item) {
                $pid = $item->product_id;
                if (!isset($productStats[$pid])) {
                    $productStats[$pid] = [
                        'product_id' => $pid,
                        'product_name' => $item->product?->product_name ?? 'Unknown',
                        'variety_name' => $item->product?->variety?->name ?? 'Unknown',
                        'variety_color' => $item->product?->variety?->color ?? '#6B7280',
                        'total_sold' => 0,
                        'total_revenue' => 0,
                        'sale_dates' => [],
                        'current_stock' => (int) ($item->product?->stocks ?? 0),
                    ];
                }
                $productStats[$pid]['total_sold'] += $item->quantity;
                $productStats[$pid]['total_revenue'] += (float) $item->subtotal;
                $productStats[$pid]['sale_dates'][] = $sale->created_at->toDateString();
            }
        }

        // Calculate velocity + predicted demand
        foreach ($productStats as &$stat) {
            $uniqueDates = array_unique($stat['sale_dates']);
            $daySpan = count($uniqueDates) > 1
                ? Carbon::parse(min($uniqueDates))->diffInDays(Carbon::parse(max($uniqueDates))) + 1
                : 1;

            $stat['avg_daily_sales'] = round($stat['total_sold'] / max(1, $daySpan), 2);
            $stat['predicted_weekly_demand'] = round($stat['avg_daily_sales'] * 7);
            $stat['predicted_monthly_demand'] = round($stat['avg_daily_sales'] * 30);
            $stat['days_until_stockout'] = $stat['avg_daily_sales'] > 0
                ? round($stat['current_stock'] / $stat['avg_daily_sales'])
                : null;
            $stat['stock_status'] = match (true) {
                $stat['days_until_stockout'] === null => 'no_sales',
                $stat['days_until_stockout'] <= 7 => 'critical',
                $stat['days_until_stockout'] <= 14 => 'low',
                $stat['days_until_stockout'] <= 30 => 'moderate',
                default => 'healthy',
            };

            unset($stat['sale_dates']); // Clean up
        }

        // Sort by total revenue descending
        usort($productStats, fn ($a, $b) => $b['total_revenue'] <=> $a['total_revenue']);

        return array_slice($productStats, 0, 10); // Top 10
    }

    /**
     * Get demand trend data — daily sales for last 30 days + 14-day forecast.
     */
    private function getDemandTrends($sales): array
    {
        $now = Carbon::now();
        $startDate = $now->copy()->subDays(30);

        // Last 30 days actual data
        $dailyRevenue = [];
        $dailyOrders = [];

        for ($i = 0; $i < 30; $i++) {
            $date = $startDate->copy()->addDays($i);
            $dateStr = $date->toDateString();
            $label = $date->format('M d');

            $daySales = $sales->filter(fn ($s) => $s->created_at->toDateString() === $dateStr);

            $dailyRevenue[] = [
                'name' => $label,
                'value' => round((float) $daySales->sum('total'), 2),
                'orders' => $daySales->count(),
                'type' => 'actual',
            ];
        }

        // 14-day forecast
        $revenues = array_column($dailyRevenue, 'value');
        $forecastValues = $this->weightedMovingAverageForecast($revenues, 14);

        $orderValues = array_column($dailyRevenue, 'orders');
        $forecastOrders = $this->weightedMovingAverageForecast($orderValues, 14);

        $forecastData = [];
        for ($i = 0; $i < 14; $i++) {
            $date = $now->copy()->addDays($i + 1);
            $forecastData[] = [
                'name' => $date->format('M d'),
                'value' => round(max(0, $forecastValues[$i]), 2),
                'orders' => max(0, round($forecastOrders[$i])),
                'type' => 'forecast',
            ];
        }

        return [
            'actual' => $dailyRevenue,
            'forecast' => $forecastData,
        ];
    }

    /**
     * Group sales by period.
     */
    private function groupSalesByPeriod($sales, string $period): array
    {
        $grouped = [];

        foreach ($sales as $sale) {
            $key = match ($period) {
                'daily' => $sale->created_at->format('M d'),
                'monthly' => $sale->created_at->format('M Y'),
                'yearly' => $sale->created_at->format('Y'),
                default => $sale->created_at->format('M d'),
            };

            if (!isset($grouped[$key])) {
                $grouped[$key] = collect();
            }
            $grouped[$key]->push($sale);
        }

        return $grouped;
    }

    /**
     * Clear prediction cache.
     */
    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY . '_daily');
        Cache::forget(self::CACHE_KEY . '_monthly');
        Cache::forget(self::CACHE_KEY . '_yearly');
    }
}
