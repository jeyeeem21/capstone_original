<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Procurement;
use App\Models\DryingProcess;
use App\Models\Processing;
use App\Models\Product;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ReportController extends Controller
{
    use ApiResponse;

    /** Completed sale statuses that count as actual revenue */
    private const COMPLETED = ['delivered', 'completed'];

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Helpers
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Resolve a date range from ?date_from= and ?date_to= query params.
     * Defaults to the current calendar month if omitted.
     */
    private function dateRange(Request $request): array
    {
        $from = $request->query('date_from')
            ? Carbon::parse($request->query('date_from'))->startOfDay()
            : Carbon::now()->startOfMonth();

        $to = $request->query('date_to')
            ? Carbon::parse($request->query('date_to'))->endOfDay()
            : Carbon::now()->endOfDay();

        return [$from, $to];
    }

    /**
     * Resolve supplier + variety label for a DryingProcess,
     * handling both individual-procurement drying and batch drying.
     */
    private function resolveDryingLabels(DryingProcess $d): array
    {
        if ($d->batch_id) {
            // Prefer the pivot records (DryingBatchProcurement); fall back to batch.procurements
            $bp = $d->batchProcurements;

            if ($bp->isNotEmpty()) {
                $suppliers = $bp
                    ->map(fn($b) => $b->procurement?->supplier?->name)
                    ->filter()->unique()->sort()->values();
                $batchVariety = $d->batch?->variety?->name;
                $varieties = $batchVariety
                    ? collect([$batchVariety])
                    : $bp->map(fn($b) => $b->procurement?->variety?->name)->filter()->unique()->sort()->values();
            } else {
                // No pivot rows — pull from all procurements belonging to the batch
                $batchProcs = $d->batch?->procurements ?? collect();
                $suppliers  = $batchProcs->map(fn($p) => $p->supplier?->name)->filter()->unique()->sort()->values();
                $batchVariety = $d->batch?->variety?->name;
                $varieties = $batchVariety
                    ? collect([$batchVariety])
                    : $batchProcs->map(fn($p) => $p->variety?->name)->filter()->unique()->sort()->values();
            }

            $batchFallback = $d->batch?->batch_number ?? 'Batch';

            $supplierLabel = match (true) {
                $suppliers->count() === 1 => $suppliers->first(),
                $suppliers->count() > 1  => $suppliers->join(', '),
                default                   => $batchFallback,
            };

            $varietyLabel = match (true) {
                $varieties->count() === 1 => $varieties->first(),
                $varieties->count() > 1  => $varieties->join(', '),
                default                   => $batchFallback,
            };

            return [$supplierLabel, $varietyLabel];
        }

        return [
            $d->procurement?->supplier?->name ?? 'N/A',
            $d->procurement?->variety?->name  ?? 'N/A',
        ];
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // 1. Profit & Loss Statement
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public function profitLoss(Request $request): JsonResponse
    {
        try {
            [$from, $to] = $this->dateRange($request);

            // Revenue summary
            $salesData = Sale::selectRaw('
                    COUNT(*) as order_count,
                    COALESCE(SUM(total), 0) as revenue,
                    COALESCE(SUM(subtotal), 0) as gross_sales,
                    COALESCE(SUM(discount), 0) as total_discounts,
                    COALESCE(SUM(delivery_fee), 0) as total_delivery_fees
                ')
                ->whereIn('status', self::COMPLETED)
                ->whereBetween('created_at', [$from, $to])
                ->first();

            // Procurement cost for materials purchased in the period
            $procurementCost = Procurement::whereBetween('created_at', [$from, $to])
                ->sum('total_cost');

            // Drying cost for work done in the period
            $dryingCost = DryingProcess::whereBetween('created_at', [$from, $to])
                ->sum('total_price');

            $revenue       = (float) $salesData->revenue;
            $grossSales    = (float) $salesData->gross_sales;
            $deliveryFees  = (float) $salesData->total_delivery_fees;
            $discounts     = (float) $salesData->total_discounts;
            $procCost      = (float) $procurementCost;
            $dryCost       = (float) $dryingCost;
            $totalExpenses = $procCost + $dryCost;
            $grossProfit   = $revenue - $totalExpenses;
            $margin        = $revenue > 0 ? round(($grossProfit / $revenue) * 100, 2) : 0;

            // Daily revenue series
            $dailyRevenue = Sale::selectRaw('DATE(created_at) as date, COALESCE(SUM(total), 0) as revenue')
                ->whereIn('status', self::COMPLETED)
                ->whereBetween('created_at', [$from, $to])
                ->groupBy('date')
                ->orderBy('date')
                ->get()
                ->map(fn($r) => ['date' => $r->date, 'revenue' => (float) $r->revenue]);

            // â”€â”€ Supporting detail lists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

            // Individual completed sales
            $salesList = Sale::with(['customer:id,name'])
                ->whereIn('status', self::COMPLETED)
                ->whereBetween('created_at', [$from, $to])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(fn($s) => [
                    'date'           => $s->created_at->toDateString(),
                    'transaction_id' => $s->transaction_id,
                    'customer'       => $s->customer?->name ?? 'Walk-in',
                    'gross_sales'    => (float) $s->subtotal,
                    'discount'       => (float) $s->discount,
                    'delivery_fee'   => (float) $s->delivery_fee,
                    'total'          => (float) $s->total,
                    'payment_method' => $s->payment_method,
                    'status'         => $s->status,
                ]);

            // Procurement records in the period
            $procList = Procurement::with(['supplier:id,name', 'variety:id,name'])
                ->whereBetween('created_at', [$from, $to])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(fn($p) => [
                    'date'         => $p->created_at?->toDateString(),
                    'supplier'     => $p->supplier?->name ?? 'N/A',
                    'variety'      => $p->variety?->name ?? 'N/A',
                    'quantity_kg'  => (float) $p->quantity_kg,
                    'price_per_kg' => (float) $p->price_per_kg,
                    'total_cost'   => (float) $p->total_cost,
                ]);

            // Drying records in the period
            $dryList = DryingProcess::with([
                    'procurement.supplier:id,name',
                    'procurement.variety:id,name',
                    'batch:id,batch_number,variety_id',
                    'batch.variety:id,name',
                    'batch.procurements.supplier:id,name',
                    'batch.procurements.variety:id,name',
                    'batchProcurements.procurement.supplier:id,name',
                    'batchProcurements.procurement.variety:id,name',
                ])
                ->whereBetween('created_at', [$from, $to])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(function ($d) {
                    [$supplier, $variety] = $this->resolveDryingLabels($d);
                    return [
                        'date'        => $d->created_at?->toDateString(),
                        'supplier'    => $supplier,
                        'variety'     => $variety,
                        'sacks'       => $d->sacks,
                        'quantity_kg' => (float) $d->quantity_kg,
                        'days'        => $d->days,
                        'price'       => (float) $d->price,
                        'total_price' => (float) $d->total_price,
                        'status'      => $d->status,
                    ];
                });

            return $this->successResponse([
                'period'             => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'gross_sales'        => $grossSales,
                'revenue'            => $revenue,
                'delivery_fees'      => $deliveryFees,
                'discounts'          => $discounts,
                'procurement_cost'   => $procCost,
                'drying_cost'        => $dryCost,
                'total_expenses'     => $totalExpenses,
                'gross_profit'       => $grossProfit,
                'profit_margin'      => $margin,
                'order_count'        => (int) $salesData->order_count,
                'is_profitable'      => $grossProfit >= 0,
                'daily_revenue'      => $dailyRevenue,
                'sales_list'         => $salesList,
                'procurement_list'   => $procList,
                'drying_list'        => $dryList,
            ], 'Profit & Loss report generated');
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to generate P&L report: ' . $e->getMessage(), 500);
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // 2. Sales Summary
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public function salesSummary(Request $request): JsonResponse
    {
        try {
            [$from, $to] = $this->dateRange($request);

            $totals = Sale::selectRaw('
                    COUNT(*) as order_count,
                    COALESCE(SUM(total), 0) as revenue,
                    COALESCE(SUM(discount), 0) as total_discounts,
                    COALESCE(SUM(delivery_fee), 0) as delivery_fees
                ')
                ->whereIn('status', self::COMPLETED)
                ->whereBetween('created_at', [$from, $to])
                ->first();

            // Payment method breakdown
            $byPayment = Sale::selectRaw('payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as total')
                ->whereIn('status', self::COMPLETED)
                ->whereBetween('created_at', [$from, $to])
                ->groupBy('payment_method')
                ->get()
                ->map(fn($r) => [
                    'method' => $r->payment_method,
                    'count'  => (int) $r->count,
                    'total'  => (float) $r->total,
                ]);

            // Top products by revenue
            $topProducts = SaleItem::selectRaw('
                    si.product_id,
                    p.product_name,
                    SUM(si.quantity) as total_qty,
                    SUM(si.subtotal) as total_revenue
                ')
                ->from('sale_items as si')
                ->join('sales as s', 's.id', '=', 'si.sale_id')
                ->join('products as p', 'p.product_id', '=', 'si.product_id')
                ->whereIn('s.status', self::COMPLETED)
                ->whereBetween('s.created_at', [$from, $to])
                ->groupBy('si.product_id', 'p.product_name')
                ->orderByDesc('total_revenue')
                ->limit(10)
                ->get()
                ->map(fn($r) => [
                    'product_name'  => $r->product_name,
                    'total_qty'     => (float) $r->total_qty,
                    'total_revenue' => (float) $r->total_revenue,
                ]);

            // Order status breakdown (all statuses in period)
            $byStatus = Sale::selectRaw('status, COUNT(*) as count')
                ->whereBetween('created_at', [$from, $to])
                ->groupBy('status')
                ->get()
                ->map(fn($r) => ['status' => $r->status, 'count' => (int) $r->count]);

            return $this->successResponse([
                'period'          => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'order_count'     => (int) $totals->order_count,
                'revenue'         => (float) $totals->revenue,
                'total_discounts' => (float) $totals->total_discounts,
                'delivery_fees'   => (float) $totals->delivery_fees,
                'by_payment'      => $byPayment,
                'top_products'    => $topProducts,
                'by_status'       => $byStatus,
            ], 'Sales summary generated');
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to generate sales summary: ' . $e->getMessage(), 500);
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // 3. Procurement Cost Report
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public function procurementCost(Request $request): JsonResponse
    {
        try {
            [$from, $to] = $this->dateRange($request);

            $procurements = Procurement::with(['supplier:id,name', 'variety:id,name'])
                ->whereBetween('created_at', [$from, $to])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(fn($p) => [
                    'id'           => $p->id,
                    'date'         => $p->created_at?->toDateString(),
                    'supplier'     => $p->supplier?->name ?? 'N/A',
                    'variety'      => $p->variety?->name ?? 'N/A',
                    'quantity_kg'  => (float) $p->quantity_kg,
                    'sacks'        => $p->sacks,
                    'price_per_kg' => (float) $p->price_per_kg,
                    'total_cost'   => (float) $p->total_cost,
                    'status'       => $p->status,
                ]);

            // Supplier breakdown
            $bySupplier = Procurement::selectRaw('
                    supplier_id,
                    COALESCE(SUM(quantity_kg), 0) as total_kg,
                    COALESCE(SUM(total_cost), 0) as total_cost
                ')
                ->with('supplier:id,name')
                ->whereBetween('created_at', [$from, $to])
                ->groupBy('supplier_id')
                ->get()
                ->map(fn($r) => [
                    'supplier'   => $r->supplier?->name ?? 'N/A',
                    'total_kg'   => (float) $r->total_kg,
                    'total_cost' => (float) $r->total_cost,
                ]);

            return $this->successResponse([
                'period'       => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'total_cost'   => (float) $procurements->sum('total_cost'),
                'total_kg'     => (float) $procurements->sum('quantity_kg'),
                'record_count' => $procurements->count(),
                'by_supplier'  => $bySupplier,
                'records'      => $procurements->values(),
            ], 'Procurement cost report generated');
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to generate procurement report: ' . $e->getMessage(), 500);
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // 4. Drying Cost Report
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public function dryingCost(Request $request): JsonResponse
    {
        try {
            [$from, $to] = $this->dateRange($request);

            $records = DryingProcess::with([
                    'procurement.supplier:id,name',
                    'procurement.variety:id,name',
                    'batch:id,batch_number,variety_id',
                    'batch.variety:id,name',
                    'batch.procurements.supplier:id,name',
                    'batch.procurements.variety:id,name',
                    'batchProcurements.procurement.supplier:id,name',
                    'batchProcurements.procurement.variety:id,name',
                ])
                ->whereBetween('created_at', [$from, $to])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(function ($d) {
                    [$supplier, $variety] = $this->resolveDryingLabels($d);
                    return [
                        'id'           => $d->id,
                        'date'         => $d->created_at?->toDateString(),
                        'dried_at'     => $d->dried_at?->toDateString(),
                        'is_batch'     => !is_null($d->batch_id),
                        'batch_number' => $d->batch?->batch_number,
                        'supplier'     => $supplier,
                        'variety'      => $variety,
                        'quantity_kg'  => (float) $d->quantity_kg,
                        'quantity_out' => (float) $d->quantity_out,
                        'sacks'        => $d->sacks,
                        'days'         => $d->days,
                        'price'        => (float) $d->price,
                        'total_price'  => (float) $d->total_price,
                        'status'       => $d->status,
                    ];
                });

            return $this->successResponse([
                'period'        => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'total_cost'    => (float) $records->sum('total_price'),
                'total_kg_in'   => (float) $records->sum('quantity_kg'),
                'total_kg_out'  => (float) $records->sum('quantity_out'),
                'record_count'  => $records->count(),
                'records'       => $records->values(),
            ], 'Drying cost report generated');
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to generate drying report: ' . $e->getMessage(), 500);
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // 5. Processing Yield Report
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public function processingYield(Request $request): JsonResponse
    {
        try {
            [$from, $to] = $this->dateRange($request);

            $records = Processing::with(['procurement.variety:id,name'])
                ->whereBetween('created_at', [$from, $to])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(fn($p) => [
                    'id'             => $p->id,
                    'date'           => $p->processing_date?->toDateString() ?? $p->created_at?->toDateString(),
                    'completed_date' => $p->completed_date?->toDateString(),
                    'variety'        => $p->procurement?->variety?->name ?? 'Mixed',
                    'operator'       => $p->operator_name ?? 'N/A',
                    'input_kg'       => (float) $p->input_kg,
                    'output_kg'      => (float) $p->output_kg,
                    'husk_kg'        => (float) $p->husk_kg,
                    'stock_out'      => (float) $p->stock_out,
                    'yield_percent'  => (float) $p->yield_percent,
                    'status'         => $p->status,
                ]);

            $totalInput  = $records->sum('input_kg');
            $totalOutput = $records->sum('output_kg');
            $totalHusk   = $records->sum('husk_kg');
            $avgYield    = $totalInput > 0 ? round(($totalOutput / $totalInput) * 100, 2) : 0;
            $wastePercent = $totalInput > 0 ? round(($totalHusk / $totalInput) * 100, 2) : 0;

            return $this->successResponse([
                'period'             => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'total_input_kg'     => (float) $totalInput,
                'total_output_kg'    => (float) $totalOutput,
                'total_husk_kg'      => (float) $totalHusk,
                'avg_yield_percent'  => $avgYield,
                'avg_waste_percent'  => $wastePercent,
                'record_count'       => $records->count(),
                'records'            => $records->values(),
            ], 'Processing yield report generated');
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to generate processing yield report: ' . $e->getMessage(), 500);
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // 6. Inventory Valuation
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public function inventoryValuation(Request $request): JsonResponse
    {
        try {
            $products = Product::with('variety:id,name')
                ->where('is_deleted', false)
                ->orderBy('product_name')
                ->get()
                ->map(fn($p) => [
                    'product_id'   => $p->product_id,
                    'product_name' => $p->product_name,
                    'variety'      => $p->variety?->name ?? 'N/A',
                    'stocks'       => $p->stocks,
                    'unit'         => $p->unit,
                    'price'        => (float) $p->price,
                    'stock_value'  => round($p->stocks * $p->price, 2),
                    'status'       => $p->status,
                    'stock_floor'  => $p->stock_floor,
                    'is_low_stock' => $p->stocks <= $p->stock_floor,
                ]);

            $totalValue    = $products->sum('stock_value');
            $totalUnits    = $products->sum('stocks');
            $activeCount   = $products->where('status', 'active')->count();
            $lowStockCount = $products->where('is_low_stock', true)->count();

            return $this->successResponse([
                'generated_at'    => now()->toISOString(),
                'total_value'     => round($totalValue, 2),
                'total_units'     => (int) $totalUnits,
                'product_count'   => $products->count(),
                'active_count'    => $activeCount,
                'low_stock_count' => $lowStockCount,
                'products'        => $products->values(),
            ], 'Inventory valuation generated');
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to generate inventory valuation: ' . $e->getMessage(), 500);
        }
    }
}