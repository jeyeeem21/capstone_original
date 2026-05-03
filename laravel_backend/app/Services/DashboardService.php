<?php

namespace App\Services;

use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Product;
use App\Models\Customer;
use App\Models\Supplier;
use App\Models\Procurement;
use App\Models\Processing;
use App\Models\DryingProcess;
use App\Models\StockLog;
use App\Models\AuditTrail;
use App\Models\DeliveryAssignment;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Carbon;

class DashboardService
{
    private const CACHE_KEY = 'dashboard_stats';
    private const CACHE_TTL = 300; // 5 minutes

    /**
     * Get all dashboard statistics in a single call
     */
    public function getStats(string $period = 'monthly', array $chartParams = []): array
    {
        $paramKey = md5(json_encode($chartParams));
        $cacheKey = self::CACHE_KEY . "_{$period}_{$paramKey}";

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($period, $chartParams) {
            $point = $chartParams['point'] ?? null;
            $pointRange = $point ? $this->getPointDateRange($period, $chartParams, $point) : null;

            return [
                'overview' => $pointRange
                    ? $this->getOverviewStatsForRange($pointRange['start'], $pointRange['end'], $pointRange['label'])
                    : $this->getOverviewStats($period, $chartParams),
                'revenue' => $this->getRevenueData($period, $chartParams),
                'processing' => $this->getProcessingData($period, $chartParams),
                'procurement' => $this->getProcurementSummary(),
                'inventory' => $this->getInventorySummary(),
                'top_products' => $pointRange
                    ? $this->getTopProducts($pointRange['start'], $pointRange['end'])
                    : $this->getTopProducts(),
                'recent_sales' => $pointRange
                    ? $this->getRecentSales($pointRange['start'], $pointRange['end'])
                    : $this->getRecentSales(),
                'low_stock' => $this->getLowStockProducts(),
                'payment_breakdown' => $pointRange
                    ? $this->getPaymentBreakdownForRange($pointRange['start'], $pointRange['end'])
                    : $this->getPaymentBreakdown($period, $chartParams),
                'status_breakdown' => $pointRange
                    ? $this->getOrderStatusBreakdownForRange($pointRange['start'], $pointRange['end'])
                    : $this->getOrderStatusBreakdown($period, $chartParams),
                'pipeline' => $pointRange
                    ? $this->getPipelineSummaryForRange($pointRange['start'], $pointRange['end'])
                    : $this->getPipelineSummary($period, $chartParams),
                'period' => $period,
                'point' => $point,
                'point_label' => $pointRange['label'] ?? null,
                'generated_at' => now()->toISOString(),
            ];
        });
    }

    /**
     * Get recent activity from audit trail
     */
    public function getRecentActivity(int $limit = 15): array
    {
        return Cache::remember('dashboard_recent_activity', 120, function () use ($limit) {
            return AuditTrail::with('user:id,name,first_name,last_name')
                ->orderBy('created_at', 'desc')
                ->limit($limit)
                ->get()
                ->map(function ($audit) {
                    return [
                        'id' => $audit->id,
                        'action' => $audit->action,
                        'module' => $audit->module,
                        'description' => $audit->description,
                        'user' => $audit->user?->name ?? $audit->user?->first_name . ' ' . $audit->user?->last_name ?? 'System',
                        'time' => $audit->created_at->diffForHumans(),
                        'created_at' => $audit->created_at->toISOString(),
                    ];
                })
                ->toArray();
        });
    }

    /**
     * Overview cards: revenue, orders, customers, products
     * Now respects the same period/chartParams as the charts.
     */
    private function getOverviewStats(string $period = 'monthly', array $chartParams = []): array
    {
        $now = Carbon::now();
        $completedStatuses = ['delivered', 'completed'];

        // Determine date range based on the selected period (same logic as charts)
        $dateRange = $this->getDateRangeForPeriod($period, $chartParams);
        $start = $dateRange['start'];
        $end = $dateRange['end'];
        $previousStart = $dateRange['previous_start'];
        $previousEnd = $dateRange['previous_end'];
        $periodLabel = $dateRange['label'];

        // SALES — delivered/completed only, filtered by period
        $currentStats = Sale::selectRaw('COUNT(*) as order_count, COALESCE(SUM(total), 0) as revenue')
            ->whereIn('status', $completedStatuses)
            ->whereBetween('created_at', [$start, $end])
            ->first();
        $previousStats = Sale::selectRaw('COUNT(*) as order_count, COALESCE(SUM(total), 0) as revenue')
            ->whereIn('status', $completedStatuses)
            ->whereBetween('created_at', [$previousStart, $previousEnd])
            ->first();

        $currentRevenue = (float) $currentStats->revenue;
        $previousRevenue = (float) $previousStats->revenue;
        $revenueTrend = $previousRevenue > 0
            ? round((($currentRevenue - $previousRevenue) / $previousRevenue) * 100, 1)
            : ($currentRevenue > 0 ? 100 : 0);

        $currentOrders = (int) $currentStats->order_count;
        $previousOrders = (int) $previousStats->order_count;
        $ordersTrend = $previousOrders > 0
            ? round((($currentOrders - $previousOrders) / $previousOrders) * 100, 1)
            : ($currentOrders > 0 ? 100 : 0);

        // CUSTOMERS within the period
        $customersInPeriod = Customer::whereBetween('created_at', [$start, $end])->count();
        $customersInPrevious = Customer::whereBetween('created_at', [$previousStart, $previousEnd])->count();
        $totalCustomers = Customer::count();
        $customersTrend = $customersInPrevious > 0
            ? round((($customersInPeriod - $customersInPrevious) / $customersInPrevious) * 100, 1)
            : ($customersInPeriod > 0 ? 100 : 0);

        // PRODUCTS (not time-dependent, always show current state)
        $totalProducts = Product::count();
        $activeProducts = Product::where('status', 'active')->count();
        $totalStock = (int) Product::sum('stocks');

        // ITEMS SOLD within the period
        $totalItemsSold = (int) SaleItem::whereHas('sale', function ($q) use ($completedStatuses, $start, $end) {
            $q->whereIn('status', $completedStatuses)->whereBetween('created_at', [$start, $end]);
        })->sum('quantity');

        return [
            'total_revenue' => $currentRevenue,
            'total_orders' => $currentOrders,
            'revenue_trend' => $revenueTrend,
            'orders_trend' => $ordersTrend,
            'total_customers' => $totalCustomers,
            'new_customers' => $customersInPeriod,
            'customers_trend' => $customersTrend,
            'total_products' => $totalProducts,
            'active_products' => $activeProducts,
            'total_stock' => $totalStock,
            'total_items_sold' => $totalItemsSold,
            'avg_order_value' => $currentOrders > 0 ? round($currentRevenue / $currentOrders, 2) : 0,
            'period_label' => $periodLabel,
            'trend_label' => $dateRange['trend_label'],
        ];
    }

    /**
     * Determine date range + previous period for comparison based on period/chartParams.
     */
    private function getDateRangeForPeriod(string $period, array $chartParams = []): array
    {
        $now = Carbon::now();

        switch ($period) {
            case 'daily':
            case 'weekly':
                $targetYear = $now->year;
                $targetMonth = $now->month;
                if (!empty($chartParams['month'])) {
                    $parts = explode('-', $chartParams['month']);
                    if (count($parts) === 2) {
                        $targetYear = (int) $parts[0];
                        $targetMonth = (int) $parts[1];
                    }
                }
                $start = Carbon::create($targetYear, $targetMonth, 1)->startOfDay();
                $end = $start->copy()->endOfMonth()->endOfDay();
                $previousStart = $start->copy()->subMonth()->startOfMonth()->startOfDay();
                $previousEnd = $start->copy()->subMonth()->endOfMonth()->endOfDay();
                $monthName = $start->format('M Y');
                return [
                    'start' => $start,
                    'end' => $end,
                    'previous_start' => $previousStart,
                    'previous_end' => $previousEnd,
                    'label' => $monthName,
                    'trend_label' => 'vs prev month',
                ];

            case 'monthly':
            case 'bi-annually':
                $targetYear = $chartParams['year'] ?? $now->year;
                $start = Carbon::create($targetYear, 1, 1)->startOfDay();
                $end = Carbon::create($targetYear, 12, 31)->endOfDay();
                $previousStart = Carbon::create($targetYear - 1, 1, 1)->startOfDay();
                $previousEnd = Carbon::create($targetYear - 1, 12, 31)->endOfDay();
                return [
                    'start' => $start,
                    'end' => $end,
                    'previous_start' => $previousStart,
                    'previous_end' => $previousEnd,
                    'label' => (string) $targetYear,
                    'trend_label' => 'vs prev year',
                ];

            case 'annually':
                $yearFrom = $chartParams['year_from'] ?? ($now->year - 4);
                $yearTo = $chartParams['year_to'] ?? $now->year;
                $start = Carbon::create($yearFrom, 1, 1)->startOfDay();
                $end = Carbon::create($yearTo, 12, 31)->endOfDay();
                $rangeSpan = $yearTo - $yearFrom + 1;
                $previousStart = Carbon::create($yearFrom - $rangeSpan, 1, 1)->startOfDay();
                $previousEnd = Carbon::create($yearFrom - 1, 12, 31)->endOfDay();
                return [
                    'start' => $start,
                    'end' => $end,
                    'previous_start' => $previousStart,
                    'previous_end' => $previousEnd,
                    'label' => "{$yearFrom} - {$yearTo}",
                    'trend_label' => 'vs prev range',
                ];

            default:
                $start = Carbon::create($now->year, 1, 1)->startOfDay();
                $end = Carbon::create($now->year, 12, 31)->endOfDay();
                $previousStart = Carbon::create($now->year - 1, 1, 1)->startOfDay();
                $previousEnd = Carbon::create($now->year - 1, 12, 31)->endOfDay();
                return [
                    'start' => $start,
                    'end' => $end,
                    'previous_start' => $previousStart,
                    'previous_end' => $previousEnd,
                    'label' => (string) $now->year,
                    'trend_label' => 'vs prev year',
                ];
        }
    }

    /**
     * Revenue chart data — daily/weekly/monthly/bi-annually/annually
     * Uses database-level aggregation instead of loading all sales into memory.
     */
    private function getRevenueData(string $period, array $chartParams = []): array
    {
        $completedStatuses = ['delivered', 'completed'];
        $now = Carbon::now();
        $result = [];
        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        if ($period === 'daily') {
            $targetYear = $now->year;
            $targetMonth = $now->month;
            if (!empty($chartParams['month'])) {
                $parts = explode('-', $chartParams['month']);
                if (count($parts) === 2) {
                    $targetYear = (int) $parts[0];
                    $targetMonth = (int) $parts[1];
                }
            }
            $daysInMonth = Carbon::create($targetYear, $targetMonth, 1)->daysInMonth;
            $start = Carbon::create($targetYear, $targetMonth, 1)->startOfDay();
            $end = $start->copy()->endOfMonth()->endOfDay();

            $salesByDay = Sale::selectRaw('DAY(created_at) as day_num, COUNT(*) as order_count, COALESCE(SUM(total), 0) as revenue')
                ->whereIn('status', $completedStatuses)
                ->whereBetween('created_at', [$start, $end])
                ->groupByRaw('DAY(created_at)')
                ->pluck('revenue', 'day_num')
                ->toArray();
            $ordersByDay = Sale::selectRaw('DAY(created_at) as day_num, COUNT(*) as order_count')
                ->whereIn('status', $completedStatuses)
                ->whereBetween('created_at', [$start, $end])
                ->groupByRaw('DAY(created_at)')
                ->pluck('order_count', 'day_num')
                ->toArray();
            $itemsByDay = SaleItem::selectRaw('DAY(sales.created_at) as day_num, COALESCE(SUM(sale_items.quantity), 0) as items')
                ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
                ->whereIn('sales.status', $completedStatuses)
                ->whereBetween('sales.created_at', [$start, $end])
                ->groupByRaw('DAY(sales.created_at)')
                ->pluck('items', 'day_num')
                ->toArray();

            for ($day = 1; $day <= $daysInMonth; $day++) {
                $result[] = [
                    'name' => (string) $day,
                    'revenue' => round((float) ($salesByDay[$day] ?? 0), 2),
                    'orders' => (int) ($ordersByDay[$day] ?? 0),
                    'items' => (int) ($itemsByDay[$day] ?? 0),
                ];
            }
        } elseif ($period === 'weekly') {
            $targetYear = $now->year;
            $targetMonth = $now->month;
            if (!empty($chartParams['month'])) {
                $parts = explode('-', $chartParams['month']);
                if (count($parts) === 2) {
                    $targetYear = (int) $parts[0];
                    $targetMonth = (int) $parts[1];
                }
            }
            $weeks = $this->getWeeksInMonth($targetYear, $targetMonth);
            foreach ($weeks as $week) {
                $weekRevenue = Sale::whereIn('status', $completedStatuses)
                    ->whereBetween('created_at', [$week['start'], $week['end']])
                    ->selectRaw('COUNT(*) as order_count, COALESCE(SUM(total), 0) as revenue')
                    ->first();
                $weekItems = SaleItem::join('sales', 'sales.id', '=', 'sale_items.sale_id')
                    ->whereIn('sales.status', $completedStatuses)
                    ->whereBetween('sales.created_at', [$week['start'], $week['end']])
                    ->sum('sale_items.quantity');
                $result[] = [
                    'name' => $week['label'],
                    'revenue' => round((float) $weekRevenue->revenue, 2),
                    'orders' => (int) $weekRevenue->order_count,
                    'items' => (int) $weekItems,
                ];
            }
        } elseif ($period === 'monthly') {
            $targetYear = $chartParams['year'] ?? $now->year;
            $start = Carbon::create($targetYear, 1, 1)->startOfDay();
            $end = Carbon::create($targetYear, 12, 31)->endOfDay();

            $salesByMonth = Sale::selectRaw('MONTH(created_at) as month_num, COUNT(*) as order_count, COALESCE(SUM(total), 0) as revenue')
                ->whereIn('status', $completedStatuses)
                ->whereBetween('created_at', [$start, $end])
                ->groupByRaw('MONTH(created_at)')
                ->get()
                ->keyBy('month_num');
            $itemsByMonth = SaleItem::selectRaw('MONTH(sales.created_at) as month_num, COALESCE(SUM(sale_items.quantity), 0) as items')
                ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
                ->whereIn('sales.status', $completedStatuses)
                ->whereBetween('sales.created_at', [$start, $end])
                ->groupByRaw('MONTH(sales.created_at)')
                ->pluck('items', 'month_num')
                ->toArray();

            foreach ($months as $idx => $monthName) {
                $m = $idx + 1;
                $row = $salesByMonth->get($m);
                $result[] = [
                    'name' => $monthName,
                    'revenue' => round((float) ($row->revenue ?? 0), 2),
                    'orders' => (int) ($row->order_count ?? 0),
                    'items' => (int) ($itemsByMonth[$m] ?? 0),
                ];
            }
        } elseif ($period === 'bi-annually') {
            $targetYear = $chartParams['year'] ?? $now->year;
            $start = Carbon::create($targetYear, 1, 1)->startOfDay();
            $mid = Carbon::create($targetYear, 7, 1)->startOfDay();
            $end = Carbon::create($targetYear, 12, 31)->endOfDay();

            $h1 = Sale::selectRaw('COUNT(*) as order_count, COALESCE(SUM(total), 0) as revenue')
                ->whereIn('status', $completedStatuses)
                ->whereBetween('created_at', [$start, $mid->copy()->subSecond()])
                ->first();
            $h2 = Sale::selectRaw('COUNT(*) as order_count, COALESCE(SUM(total), 0) as revenue')
                ->whereIn('status', $completedStatuses)
                ->whereBetween('created_at', [$mid, $end])
                ->first();
            $h1Items = SaleItem::join('sales', 'sales.id', '=', 'sale_items.sale_id')
                ->whereIn('sales.status', $completedStatuses)
                ->whereBetween('sales.created_at', [$start, $mid->copy()->subSecond()])
                ->sum('sale_items.quantity');
            $h2Items = SaleItem::join('sales', 'sales.id', '=', 'sale_items.sale_id')
                ->whereIn('sales.status', $completedStatuses)
                ->whereBetween('sales.created_at', [$mid, $end])
                ->sum('sale_items.quantity');

            $result = [
                ['name' => 'H1', 'fullName' => "Jan - Jun {$targetYear}", 'revenue' => round((float) $h1->revenue, 2), 'orders' => (int) $h1->order_count, 'items' => (int) $h1Items],
                ['name' => 'H2', 'fullName' => "Jul - Dec {$targetYear}", 'revenue' => round((float) $h2->revenue, 2), 'orders' => (int) $h2->order_count, 'items' => (int) $h2Items],
            ];
        } else { // annually
            $yearFrom = $chartParams['year_from'] ?? ($now->year - 4);
            $yearTo = $chartParams['year_to'] ?? $now->year;
            $start = Carbon::create($yearFrom, 1, 1)->startOfDay();
            $end = Carbon::create($yearTo, 12, 31)->endOfDay();

            $salesByYear = Sale::selectRaw('YEAR(created_at) as year_num, COUNT(*) as order_count, COALESCE(SUM(total), 0) as revenue')
                ->whereIn('status', $completedStatuses)
                ->whereBetween('created_at', [$start, $end])
                ->groupByRaw('YEAR(created_at)')
                ->get()
                ->keyBy('year_num');
            $itemsByYear = SaleItem::selectRaw('YEAR(sales.created_at) as year_num, COALESCE(SUM(sale_items.quantity), 0) as items')
                ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
                ->whereIn('sales.status', $completedStatuses)
                ->whereBetween('sales.created_at', [$start, $end])
                ->groupByRaw('YEAR(sales.created_at)')
                ->pluck('items', 'year_num')
                ->toArray();

            for ($year = $yearFrom; $year <= $yearTo; $year++) {
                $row = $salesByYear->get($year);
                $result[] = [
                    'name' => (string) $year,
                    'revenue' => round((float) ($row->revenue ?? 0), 2),
                    'orders' => (int) ($row->order_count ?? 0),
                    'items' => (int) ($itemsByYear[$year] ?? 0),
                ];
            }
        }

        return $result;
    }

    /**
     * Processing performance data (milling operations)
     * Uses database-level aggregation instead of loading all records into memory.
     */
    private function getProcessingData(string $period, array $chartParams = []): array
    {
        $now = Carbon::now();
        $result = [];
        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        $completedStatus = Processing::STATUS_COMPLETED;

        if ($period === 'daily') {
            $targetYear = $now->year;
            $targetMonth = $now->month;
            if (!empty($chartParams['month'])) {
                $parts = explode('-', $chartParams['month']);
                if (count($parts) === 2) {
                    $targetYear = (int) $parts[0];
                    $targetMonth = (int) $parts[1];
                }
            }
            $daysInMonth = Carbon::create($targetYear, $targetMonth, 1)->daysInMonth;
            $start = Carbon::create($targetYear, $targetMonth, 1)->startOfDay();
            $end = $start->copy()->endOfMonth()->endOfDay();

            $byDay = Processing::selectRaw('DAY(completed_date) as day_num, COALESCE(SUM(input_kg), 0) as total_input, COALESCE(SUM(output_kg), 0) as total_output')
                ->where('status', $completedStatus)
                ->whereBetween('completed_date', [$start, $end])
                ->groupByRaw('DAY(completed_date)')
                ->get()
                ->keyBy('day_num');

            for ($day = 1; $day <= $daysInMonth; $day++) {
                $row = $byDay->get($day);
                $result[] = [
                    'name' => (string) $day,
                    'input' => round((float) ($row->total_input ?? 0), 2),
                    'output' => round((float) ($row->total_output ?? 0), 2),
                ];
            }
        } elseif ($period === 'weekly') {
            $targetYear = $now->year;
            $targetMonth = $now->month;
            if (!empty($chartParams['month'])) {
                $parts = explode('-', $chartParams['month']);
                if (count($parts) === 2) {
                    $targetYear = (int) $parts[0];
                    $targetMonth = (int) $parts[1];
                }
            }
            $weeks = $this->getWeeksInMonth($targetYear, $targetMonth);
            foreach ($weeks as $week) {
                $agg = Processing::selectRaw('COALESCE(SUM(input_kg), 0) as total_input, COALESCE(SUM(output_kg), 0) as total_output')
                    ->where('status', $completedStatus)
                    ->whereBetween('completed_date', [$week['start'], $week['end']])
                    ->first();
                $result[] = [
                    'name' => $week['label'],
                    'input' => round((float) $agg->total_input, 2),
                    'output' => round((float) $agg->total_output, 2),
                ];
            }
        } elseif ($period === 'monthly') {
            $targetYear = $chartParams['year'] ?? $now->year;
            $start = Carbon::create($targetYear, 1, 1)->startOfDay();
            $end = Carbon::create($targetYear, 12, 31)->endOfDay();

            $byMonth = Processing::selectRaw('MONTH(completed_date) as month_num, COALESCE(SUM(input_kg), 0) as total_input, COALESCE(SUM(output_kg), 0) as total_output')
                ->where('status', $completedStatus)
                ->whereBetween('completed_date', [$start, $end])
                ->groupByRaw('MONTH(completed_date)')
                ->get()
                ->keyBy('month_num');

            foreach ($months as $idx => $monthName) {
                $m = $idx + 1;
                $row = $byMonth->get($m);
                $result[] = [
                    'name' => $monthName,
                    'input' => round((float) ($row->total_input ?? 0), 2),
                    'output' => round((float) ($row->total_output ?? 0), 2),
                ];
            }
        } elseif ($period === 'bi-annually') {
            $targetYear = $chartParams['year'] ?? $now->year;
            $start = Carbon::create($targetYear, 1, 1)->startOfDay();
            $mid = Carbon::create($targetYear, 7, 1)->startOfDay();
            $end = Carbon::create($targetYear, 12, 31)->endOfDay();

            $h1 = Processing::selectRaw('COALESCE(SUM(input_kg), 0) as total_input, COALESCE(SUM(output_kg), 0) as total_output')
                ->where('status', $completedStatus)
                ->whereBetween('completed_date', [$start, $mid->copy()->subSecond()])
                ->first();
            $h2 = Processing::selectRaw('COALESCE(SUM(input_kg), 0) as total_input, COALESCE(SUM(output_kg), 0) as total_output')
                ->where('status', $completedStatus)
                ->whereBetween('completed_date', [$mid, $end])
                ->first();

            $result = [
                ['name' => 'H1', 'fullName' => "Jan - Jun {$targetYear}", 'input' => round((float) $h1->total_input, 2), 'output' => round((float) $h1->total_output, 2)],
                ['name' => 'H2', 'fullName' => "Jul - Dec {$targetYear}", 'input' => round((float) $h2->total_input, 2), 'output' => round((float) $h2->total_output, 2)],
            ];
        } else { // annually
            $yearFrom = $chartParams['year_from'] ?? ($now->year - 4);
            $yearTo = $chartParams['year_to'] ?? $now->year;
            $start = Carbon::create($yearFrom, 1, 1)->startOfDay();
            $end = Carbon::create($yearTo, 12, 31)->endOfDay();

            $byYear = Processing::selectRaw('YEAR(completed_date) as year_num, COALESCE(SUM(input_kg), 0) as total_input, COALESCE(SUM(output_kg), 0) as total_output')
                ->where('status', $completedStatus)
                ->whereBetween('completed_date', [$start, $end])
                ->groupByRaw('YEAR(completed_date)')
                ->get()
                ->keyBy('year_num');

            for ($year = $yearFrom; $year <= $yearTo; $year++) {
                $row = $byYear->get($year);
                $result[] = [
                    'name' => (string) $year,
                    'input' => round((float) ($row->total_input ?? 0), 2),
                    'output' => round((float) ($row->total_output ?? 0), 2),
                ];
            }
        }

        // Summary stats — single aggregate queries instead of loading all records
        $totalInput = (float) Processing::sum('input_kg');
        $totalOutput = (float) Processing::where('status', $completedStatus)->sum('output_kg');
        $avgYield = Processing::where('status', $completedStatus)->count() > 0
            ? round(Processing::where('status', $completedStatus)->avg('yield_percent'), 2)
            : 0;

        return [
            'chart' => $result,
            'total_input' => $totalInput,
            'total_output' => $totalOutput,
            'avg_yield' => $avgYield,
            'total_records' => Processing::count(),
        ];
    }

    /**
     * Resolve a chart point to a specific date range within the period scope.
     */
    private function getPointDateRange(string $period, array $chartParams, string $point): ?array
    {
        $now = Carbon::now();
        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        if ($period === 'daily') {
            $targetYear = $now->year;
            $targetMonth = $now->month;
            if (!empty($chartParams['month'])) {
                $parts = explode('-', $chartParams['month']);
                if (count($parts) === 2) {
                    $targetYear = (int) $parts[0];
                    $targetMonth = (int) $parts[1];
                }
            }
            $day = (int) $point;
            $daysInMonth = Carbon::create($targetYear, $targetMonth, 1)->daysInMonth;
            if ($day < 1 || $day > $daysInMonth) return null;
            $date = Carbon::create($targetYear, $targetMonth, $day);
            $monthName = $months[$targetMonth - 1];
            return [
                'start' => $date->copy()->startOfDay(),
                'end' => $date->copy()->endOfDay(),
                'label' => "{$monthName} {$day}, {$targetYear}",
            ];
        }

        if ($period === 'weekly') {
            $targetYear = $now->year;
            $targetMonth = $now->month;
            if (!empty($chartParams['month'])) {
                $parts = explode('-', $chartParams['month']);
                if (count($parts) === 2) {
                    $targetYear = (int) $parts[0];
                    $targetMonth = (int) $parts[1];
                }
            }
            $weeks = $this->getWeeksInMonth($targetYear, $targetMonth);
            foreach ($weeks as $week) {
                if ($week['label'] === $point) {
                    return [
                        'start' => $week['start'],
                        'end' => $week['end'],
                        'label' => $point,
                    ];
                }
            }
            return null;
        }

        if ($period === 'monthly') {
            $targetYear = $chartParams['year'] ?? $now->year;
            $monthIdx = array_search($point, $months);
            if ($monthIdx === false) return null;
            $month = $monthIdx + 1;
            $start = Carbon::create($targetYear, $month, 1)->startOfDay();
            return [
                'start' => $start,
                'end' => $start->copy()->endOfMonth()->endOfDay(),
                'label' => "{$point} {$targetYear}",
            ];
        }

        if ($period === 'bi-annually') {
            $targetYear = $chartParams['year'] ?? $now->year;
            if ($point === 'H1') {
                return [
                    'start' => Carbon::create($targetYear, 1, 1)->startOfDay(),
                    'end' => Carbon::create($targetYear, 6, 30)->endOfDay(),
                    'label' => "Jan - Jun {$targetYear}",
                ];
            }
            if ($point === 'H2') {
                return [
                    'start' => Carbon::create($targetYear, 7, 1)->startOfDay(),
                    'end' => Carbon::create($targetYear, 12, 31)->endOfDay(),
                    'label' => "Jul - Dec {$targetYear}",
                ];
            }
            return null;
        }

        if ($period === 'annually') {
            $year = (int) $point;
            if ($year < 1900 || $year > 2100) return null;
            return [
                'start' => Carbon::create($year, 1, 1)->startOfDay(),
                'end' => Carbon::create($year, 12, 31)->endOfDay(),
                'label' => (string) $year,
            ];
        }

        return null;
    }

    /**
     * Overview stats for a specific date range (when chart point is selected).
     */
    private function getOverviewStatsForRange(Carbon $start, Carbon $end, string $label): array
    {
        $completedStatuses = ['delivered', 'completed'];

        $currentStats = Sale::selectRaw('COUNT(*) as order_count, COALESCE(SUM(total), 0) as revenue')
            ->whereIn('status', $completedStatuses)
            ->whereBetween('created_at', [$start, $end])
            ->first();

        $currentRevenue = (float) $currentStats->revenue;
        $currentOrders = (int) $currentStats->order_count;

        $customersInRange = Customer::whereBetween('created_at', [$start, $end])->count();
        $totalCustomers = Customer::count();
        $totalProducts = Product::count();
        $activeProducts = Product::where('status', 'active')->count();
        $totalStock = (int) Product::sum('stocks');

        $totalItemsSold = (int) SaleItem::whereHas('sale', function ($q) use ($completedStatuses, $start, $end) {
            $q->whereIn('status', $completedStatuses)->whereBetween('created_at', [$start, $end]);
        })->sum('quantity');

        return [
            'total_revenue' => $currentRevenue,
            'total_orders' => $currentOrders,
            'revenue_trend' => null,
            'orders_trend' => null,
            'total_customers' => $totalCustomers,
            'new_customers' => $customersInRange,
            'customers_trend' => null,
            'total_products' => $totalProducts,
            'active_products' => $activeProducts,
            'total_stock' => $totalStock,
            'total_items_sold' => $totalItemsSold,
            'avg_order_value' => $currentOrders > 0 ? round($currentRevenue / $currentOrders, 2) : 0,
            'period_label' => $label,
            'trend_label' => null,
        ];
    }

    /**
     * Payment breakdown for a specific date range.
     */
    private function getPaymentBreakdownForRange(Carbon $start, Carbon $end): array
    {
        $completedStatuses = ['delivered', 'completed'];

        return Sale::selectRaw("payment_method, COUNT(*) as count, SUM(total) as total_amount")
            ->whereIn('status', $completedStatuses)
            ->whereBetween('created_at', [$start, $end])
            ->groupBy('payment_method')
            ->get()
            ->map(function ($row) {
                $label = match ($row->payment_method) {
                    'cash' => 'Cash',
                    'gcash' => 'GCash',
                    'cod' => 'COD',
                    'pay_later' => 'Pay Later',
                    default => ucfirst($row->payment_method ?? 'Cash'),
                };
                $color = match ($row->payment_method) {
                    'cash' => '#22c55e',
                    'gcash' => '#3b82f6',
                    'cod' => '#f59e0b',
                    'pay_later' => '#8b5cf6',
                    default => '#6b7280',
                };
                return [
                    'name' => $label,
                    'value' => (int) $row->count,
                    'amount' => round((float) $row->total_amount, 2),
                    'color' => $color,
                ];
            })
            ->toArray();
    }

    /**
     * Order status breakdown for a specific date range.
     */
    private function getOrderStatusBreakdownForRange(Carbon $start, Carbon $end): array
    {
        $statuses = [
            'pending' => ['label' => 'Pending', 'color' => '#f59e0b'],
            'processing' => ['label' => 'Processing', 'color' => '#3b82f6'],
            'shipped' => ['label' => 'Shipped', 'color' => '#8b5cf6'],
            'delivered' => ['label' => 'Delivered', 'color' => '#22c55e'],
            'completed' => ['label' => 'Completed', 'color' => '#10b981'],
            'returned' => ['label' => 'Returned', 'color' => '#f97316'],
            'cancelled' => ['label' => 'Cancelled', 'color' => '#ef4444'],
            'voided' => ['label' => 'Voided', 'color' => '#6b7280'],
        ];

        $counts = Sale::selectRaw("status, COUNT(*) as count")
            ->whereBetween('created_at', [$start, $end])
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $result = [];
        foreach ($statuses as $key => $meta) {
            if (isset($counts[$key]) && $counts[$key] > 0) {
                $result[] = [
                    'name' => $meta['label'],
                    'value' => (int) $counts[$key],
                    'color' => $meta['color'],
                ];
            }
        }

        return $result;
    }

    /**
     * Helper: scope a query builder by period + chartParams on created_at
     */
    private function scopeQueryByPeriod($query, string $period, array $chartParams)
    {
        $now = Carbon::now();

        if ($period === 'daily' || $period === 'weekly') {
            $targetYear = $now->year;
            $targetMonth = $now->month;
            if (!empty($chartParams['month'])) {
                $parts = explode('-', $chartParams['month']);
                if (count($parts) === 2) {
                    $targetYear = (int) $parts[0];
                    $targetMonth = (int) $parts[1];
                }
            }
            if ($period === 'daily') {
                $start = Carbon::create($targetYear, $targetMonth, 1)->startOfDay();
                $end = $start->copy()->endOfMonth()->endOfDay();
                $query->whereBetween('created_at', [$start, $end]);
            } else {
                // weekly — scope to the full week range of that month
                $weeks = $this->getWeeksInMonth($targetYear, $targetMonth);
                if (!empty($weeks)) {
                    $query->whereBetween('created_at', [$weeks[0]['start'], end($weeks)['end']]);
                }
            }
        } elseif ($period === 'monthly' || $period === 'bi-annually') {
            $year = $chartParams['year'] ?? $now->year;
            $start = Carbon::create($year, 1, 1)->startOfDay();
            $end = Carbon::create($year, 12, 31)->endOfDay();
            $query->whereBetween('created_at', [$start, $end]);
        } elseif ($period === 'annually') {
            $yearFrom = $chartParams['year_from'] ?? ($now->year - 4);
            $yearTo = $chartParams['year_to'] ?? $now->year;
            $start = Carbon::create($yearFrom, 1, 1)->startOfDay();
            $end = Carbon::create($yearTo, 12, 31)->endOfDay();
            $query->whereBetween('created_at', [$start, $end]);
        }

        return $query;
    }

    /**
     * Helper: get week ranges in a month (matches frontend getWeeksInMonth)
     */
    private function getWeeksInMonth(int $year, int $month): array
    {
        $weeks = [];
        $monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        $firstDay = Carbon::create($year, $month, 1)->startOfDay();
        $start = $firstDay->copy();
        $dayOfWeek = $start->dayOfWeek; // 0=Sunday
        $diff = $dayOfWeek === 0 ? -6 : 1 - $dayOfWeek;
        $start->addDays($diff);

        while ($start->month <= $month || ($start->month > $month && $start->year < $year) || count($weeks) === 0) {
            $end = $start->copy()->addDays(6);
            $label = $monthNames[$start->month - 1] . ' ' . $start->day . ' - ' . $monthNames[$end->month - 1] . ' ' . $end->day;
            $weeks[] = [
                'start' => $start->copy()->startOfDay(),
                'end' => $end->copy()->endOfDay(),
                'label' => $label,
            ];
            $start->addDays(7);
            if ($start->month > $month && $start->year === $year) break;
            if ($start->year > $year) break;
            if (count($weeks) >= 6) break;
        }

        return $weeks;
    }

    /**
     * Procurement summary
     */
    private function getProcurementSummary(): array
    {
        $total = Procurement::count();
        $totalCost = (float) Procurement::sum('total_cost');
        $totalKg = (float) Procurement::sum('quantity_kg');
        $totalSacks = (int) Procurement::sum('sacks');
        $pending = Procurement::where('status', 'Pending')->count();
        $suppliers = Supplier::where('status', 'active')->count();

        return [
            'total' => $total,
            'total_cost' => round($totalCost, 2),
            'total_kg' => round($totalKg, 2),
            'total_sacks' => $totalSacks,
            'pending' => $pending,
            'active_suppliers' => $suppliers,
        ];
    }

    /**
     * Inventory summary — stock health
     */
    private function getInventorySummary(): array
    {
        $products = Product::where('status', 'active')->get();

        $totalStock = $products->sum('stocks');
        $lowStock = $products->filter(fn($p) => $p->stocks > 0 && $p->stocks <= $p->stock_floor)->count();
        $outOfStock = $products->filter(fn($p) => $p->stocks <= 0)->count();
        $healthy = $products->filter(fn($p) => $p->stocks > $p->stock_floor)->count();

        return [
            'total_stock' => (int) $totalStock,
            'low_stock' => $lowStock,
            'out_of_stock' => $outOfStock,
            'healthy' => $healthy,
            'total_products' => $products->count(),
        ];
    }

    /**
     * Top selling products
     */
    private function getTopProducts(?Carbon $start = null, ?Carbon $end = null): array
    {
        $completedStatuses = ['delivered', 'completed'];

        return SaleItem::selectRaw('product_id, SUM(quantity) as total_qty, SUM(subtotal) as total_revenue')
            ->whereHas('sale', function ($q) use ($completedStatuses, $start, $end) {
                $q->whereIn('status', $completedStatuses);
                if ($start && $end) {
                    $q->whereBetween('created_at', [$start, $end]);
                }
            })
            ->groupBy('product_id')
            ->orderByDesc('total_revenue')
            ->limit(5)
            ->get()
            ->map(function ($item) {
                $product = Product::find($item->product_id);
                return [
                    'product_id' => $item->product_id,
                    'product_name' => $product?->product_name ?? 'Unknown',
                    'variety' => $product?->variety?->name ?? '—',
                    'variety_color' => $product?->variety?->color ?? '#6B7280',
                    'total_qty' => (int) $item->total_qty,
                    'total_revenue' => round((float) $item->total_revenue, 2),
                    'current_stock' => (int) ($product?->stocks ?? 0),
                    'price' => (float) ($product?->price ?? 0),
                ];
            })
            ->toArray();
    }

    /**
     * Most recent sales
     */
    private function getRecentSales(?Carbon $start = null, ?Carbon $end = null): array
    {
        $query = Sale::with(['customer:id,name', 'items']);
        if ($start && $end) {
            $query->whereBetween('created_at', [$start, $end]);
        }
        return $query->orderBy('created_at', 'desc')
            ->limit($start && $end ? 20 : 8)
            ->get()
            ->map(function ($sale) {
                return [
                    'id' => $sale->id,
                    'transaction_id' => $sale->transaction_id,
                    'customer' => $sale->customer?->name ?? 'Walk-in',
                    'total' => round((float) $sale->total, 2),
                    'items_count' => $sale->items->count(),
                    'payment_method' => $sale->payment_method === 'gcash' ? 'GCash'
                        : ($sale->payment_method === 'cod' ? 'COD'
                        : ($sale->payment_method === 'pay_later' ? 'Pay Later'
                        : 'Cash')),
                    'status' => $sale->status,
                    'date' => $sale->created_at->format('M d, Y'),
                    'time' => $sale->created_at->format('h:i A'),
                    'created_at' => $sale->created_at->toISOString(),
                ];
            })
            ->toArray();
    }

    /**
     * Products with low stock
     */
    private function getLowStockProducts(): array
    {
        return Product::with('variety')->where('status', 'active')
            ->where(function ($q) {
                $q->where('stocks', '<=', 0)
                    ->orWhereColumn('stocks', '<=', 'stock_floor');
            })
            ->orderBy('stocks')
            ->limit(5)
            ->get()
            ->map(function ($p) {
                return [
                    'product_id' => $p->product_id,
                    'product_name' => $p->product_name,
                    'variety' => $p->variety?->name ?? '—',
                    'variety_color' => $p->variety?->color ?? '#6B7280',
                    'stocks' => (int) $p->stocks,
                    'stock_floor' => (int) $p->stock_floor,
                    'price' => (float) $p->price,
                    'status' => $p->stocks <= 0 ? 'Out of Stock' : 'Low Stock',
                ];
            })
            ->toArray();
    }

    /**
     * Payment method breakdown
     */
    private function getPaymentBreakdown(string $period = 'monthly', array $chartParams = []): array
    {
        $completedStatuses = ['delivered', 'completed'];

        $query = Sale::selectRaw("payment_method, COUNT(*) as count, SUM(total) as total_amount")
            ->whereIn('status', $completedStatuses);
        $this->scopeQueryByPeriod($query, $period, $chartParams);

        return $query->groupBy('payment_method')
            ->get()
            ->map(function ($row) {
                $label = match ($row->payment_method) {
                    'cash' => 'Cash',
                    'gcash' => 'GCash',
                    'cod' => 'COD',
                    'pay_later' => 'Pay Later',
                    default => ucfirst($row->payment_method ?? 'Cash'),
                };
                $color = match ($row->payment_method) {
                    'cash' => '#22c55e',
                    'gcash' => '#3b82f6',
                    'cod' => '#f59e0b',
                    'pay_later' => '#8b5cf6',
                    default => '#6b7280',
                };
                return [
                    'name' => $label,
                    'value' => (int) $row->count,
                    'amount' => round((float) $row->total_amount, 2),
                    'color' => $color,
                ];
            })
            ->toArray();
    }

    /**
     * Order status breakdown
     */
    private function getOrderStatusBreakdown(string $period = 'monthly', array $chartParams = []): array
    {
        $statuses = [
            'pending' => ['label' => 'Pending', 'color' => '#f59e0b'],
            'processing' => ['label' => 'Processing', 'color' => '#3b82f6'],
            'shipped' => ['label' => 'Shipped', 'color' => '#8b5cf6'],
            'delivered' => ['label' => 'Delivered', 'color' => '#22c55e'],
            'completed' => ['label' => 'Completed', 'color' => '#10b981'],
            'returned' => ['label' => 'Returned', 'color' => '#f97316'],
            'cancelled' => ['label' => 'Cancelled', 'color' => '#ef4444'],
            'voided' => ['label' => 'Voided', 'color' => '#6b7280'],
        ];

        $query = Sale::selectRaw("status, COUNT(*) as count");
        $this->scopeQueryByPeriod($query, $period, $chartParams);

        $counts = $query->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $result = [];
        foreach ($statuses as $key => $meta) {
            if (isset($counts[$key]) && $counts[$key] > 0) {
                $result[] = [
                    'name' => $meta['label'],
                    'value' => (int) $counts[$key],
                    'color' => $meta['color'],
                ];
            }
        }

        return $result;
    }

    /**
     * Pipeline summary — active work across all stages, filtered by period
     */
    private function getPipelineSummary(string $period = 'monthly', array $chartParams = []): array
    {
        $dateRange = $this->getDateRangeForPeriod($period, $chartParams);
        $start = $dateRange['start'];
        $end = $dateRange['end'];

        $procurementPending = Procurement::where('status', 'Pending')
            ->whereBetween('created_at', [$start, $end])->count();
        $dryingActive = DryingProcess::whereIn('status', ['Drying', 'Postponed'])
            ->whereBetween('created_at', [$start, $end])->count();
        $processingActive = Processing::whereIn('status', ['Pending', 'Processing'])
            ->whereBetween('created_at', [$start, $end])->count();
        $ordersPending = Sale::whereIn('status', ['pending', 'processing'])
            ->whereBetween('created_at', [$start, $end])->count();
        $shipped = Sale::where('status', 'shipped')
            ->whereBetween('created_at', [$start, $end])->count();

        return [
            'procurement_pending' => $procurementPending,
            'drying_active' => $dryingActive,
            'processing_active' => $processingActive,
            'orders_pending' => $ordersPending,
            'shipped' => $shipped,
        ];
    }

    /**
     * Pipeline summary for a specific date range (when a chart point is clicked)
     */
    private function getPipelineSummaryForRange(Carbon $start, Carbon $end): array
    {
        $procurementPending = Procurement::where('status', 'Pending')
            ->whereBetween('created_at', [$start, $end])->count();
        $dryingActive = DryingProcess::whereIn('status', ['Drying', 'Postponed'])
            ->whereBetween('created_at', [$start, $end])->count();
        $processingActive = Processing::whereIn('status', ['Pending', 'Processing'])
            ->whereBetween('created_at', [$start, $end])->count();
        $ordersPending = Sale::whereIn('status', ['pending', 'processing'])
            ->whereBetween('created_at', [$start, $end])->count();
        $shipped = Sale::where('status', 'shipped')
            ->whereBetween('created_at', [$start, $end])->count();

        return [
            'procurement_pending' => $procurementPending,
            'drying_active' => $dryingActive,
            'processing_active' => $processingActive,
            'orders_pending' => $ordersPending,
            'shipped' => $shipped,
        ];
    }

    /**
     * Clear all dashboard caches
     */
    public function clearCache(): void
    {
        static::clearStatsCache();
    }

    /**
     * Static helper to clear all dashboard stats cache.
     * Can be called from any service or controller without needing an instance.
     */
    public static function clearStatsCache(): void
    {
        $cacheKey = 'dashboard_stats';

        // Clear known base keys
        $periods = ['daily', 'weekly', 'monthly', 'bi-annually', 'annually'];
        $emptyParamKey = md5(json_encode(['month' => null, 'year' => null, 'year_from' => null, 'year_to' => null]));
        foreach ($periods as $p) {
            Cache::forget("{$cacheKey}_{$p}_{$emptyParamKey}");
        }
        // Also clear legacy keys
        Cache::forget("{$cacheKey}_daily");
        Cache::forget("{$cacheKey}_monthly");
        Cache::forget("{$cacheKey}_yearly");
        Cache::forget("{$cacheKey}_pipeline");
        Cache::forget('dashboard_recent_activity');

        // For file cache driver: clear ALL dashboard_stats keys by scanning cache directory
        try {
            $cachePath = storage_path('framework/cache/data');
            if (is_dir($cachePath)) {
                $iterator = new \RecursiveIteratorIterator(
                    new \RecursiveDirectoryIterator($cachePath, \RecursiveDirectoryIterator::SKIP_DOTS)
                );
                foreach ($iterator as $file) {
                    if ($file->isFile()) {
                        $contents = @file_get_contents($file->getPathname());
                        if ($contents && str_contains($contents, $cacheKey)) {
                            @unlink($file->getPathname());
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            // Ignore — fallback keys above should handle most cases
        }
    }
}
