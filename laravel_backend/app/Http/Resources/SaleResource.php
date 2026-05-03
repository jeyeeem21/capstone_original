<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Models\StockLog;

class SaleResource extends JsonResource
{
    /**
     * Per-request PWAC snapshot cache: product_id => [['created_at' => Carbon, 'running_avg_cost' => float], ...]
     * Ordered chronologically so we can find the last snapshot before any given sale date.
     */
    private static ?array $pwacLogs = null;

    /**
     * Pre-load PWAC running_avg_cost snapshots for all products in a single query.
     */
    public static function preloadAvgCosts(): void
    {
        $rows = StockLog::where('type', 'in')
            ->whereNotNull('running_avg_cost')
            ->where('running_avg_cost', '>', 0)
            ->orderBy('created_at')
            ->select('product_id', 'created_at', 'running_avg_cost')
            ->get();

        self::$pwacLogs = [];
        foreach ($rows as $row) {
            self::$pwacLogs[$row->product_id][] = [
                'created_at'      => $row->created_at,
                'running_avg_cost' => (float) $row->running_avg_cost,
            ];
        }
    }

    /**
     * Get the PWAC cost per unit for a product at the time of a given sale date.
     * Returns the running_avg_cost from the most recent distribution on or before $saleDate.
     */
    private static function getPwacCostForSale(int $productId, $saleDate): float
    {
        $logs = self::$pwacLogs[$productId] ?? [];
        $matched = null;
        foreach ($logs as $log) {
            if ($log['created_at'] <= $saleDate) {
                $matched = $log;
            } else {
                break; // logs are ordered chronologically
            }
        }
        return $matched ? $matched['running_avg_cost'] : 0;
    }

    public function toArray(Request $request): array
    {
        // Build cache on first use if not preloaded
        if (self::$pwacLogs === null) {
            self::preloadAvgCosts();
        }

        $saleDate = $this->created_at;

        $items = $this->items->map(function ($item) use ($saleDate) {
            $product = $item->product;
            $weight = $product?->weight;
            $weightFormatted = $weight
                ? (intval($weight) == $weight ? intval($weight) . ' kg' : number_format($weight, 2) . ' kg')
                : null;

            // Use PWAC: cost per unit at the time this sale was created
            $avgCostPerUnit = 0;
            if ($product) {
                $avgCostPerUnit = self::getPwacCostForSale($product->getKey(), $saleDate);
            }
            $totalCost = round($avgCostPerUnit * $item->quantity, 2);
            $profit = round($item->subtotal - $totalCost, 2);

            return [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $product?->product_name ?? 'Unknown',
                'variety_name' => $product?->variety?->name ?? 'Unknown',
                'variety_color' => $product?->variety?->color ?? '#6B7280',
                'weight_formatted' => $weightFormatted,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'subtotal' => (float) $item->subtotal,
                'restocked' => (bool) $item->restocked,
                'cost_per_unit' => $avgCostPerUnit,
                'total_cost' => $totalCost,
                'profit' => $profit,
            ];
        });

        $totalCost = $items->sum('total_cost');
        $totalProfit = $items->sum('profit');

        return [
            'id' => $this->id,
            'transaction_id' => $this->transaction_id,
            'customer_id' => $this->customer_id,
            'customer_name' => $this->customer?->name ?? 'Walk-in',
            'subtotal' => (float) $this->subtotal,
            'discount' => (float) $this->discount,
            'delivery_fee' => (float) ($this->delivery_fee ?? 0),
            'total' => (float) $this->total,
            'total_formatted' => '₱' . number_format($this->total, 2),
            'amount_tendered' => (float) $this->amount_tendered,
            'change_amount' => (float) $this->change_amount,
            'payment_method' => $this->payment_method,
            'payment_status' => $this->payment_status ?? 'paid',
            'reference_number' => $this->reference_number,
            'payment_proof' => $this->payment_proof
                ? collect($this->payment_proof)->map(fn($path) => url('/storage/' . $path))->values()->toArray()
                : [],
            'paid_at' => $this->paid_at?->toISOString(),
            'paid_at_formatted' => $this->paid_at?->format('M d, Y h:i A'),
            'status' => $this->status,
            'notes' => $this->notes,
            'voided_by' => $this->voided_by,
            'authorized_by' => $this->authorized_by,
            'items_count' => $this->items_count ?? $this->items->count(),
            'total_quantity' => $this->items->sum('quantity'),
            'total_cost' => round($totalCost, 2),
            'total_profit' => round($totalProfit, 2),
            'profit_margin' => (float) $this->total > 0 ? round(($totalProfit / (float) $this->total) * 100, 1) : 0,
            'items' => $items,
            'delivery_address' => $this->delivery_address,
            'distance_km' => $this->distance_km ? (float) $this->distance_km : null,
            'driver_name' => $this->driver_name,
            'driver_plate_number' => $this->driver_plate_number,
            'delivery_proof' => $this->delivery_proof
                ? collect($this->delivery_proof)->map(fn($path) => url('/storage/' . $path))->values()->toArray()
                : [],
            'return_reason' => $this->return_reason,
            'return_notes' => $this->return_notes,
            'return_proof' => $this->return_proof
                ? collect($this->return_proof)->map(fn($path) => url('/storage/' . $path))->values()->toArray()
                : [],
            'return_pickup_driver' => $this->return_pickup_driver,
            'return_pickup_plate' => $this->return_pickup_plate,
            'return_pickup_date' => $this->return_pickup_date?->format('Y-m-d'),
            'return_pickup_date_formatted' => $this->return_pickup_date?->format('M d, Y'),
            'created_at' => $this->created_at?->toISOString(),
            'date_formatted' => $this->created_at?->format('M d, Y h:i A'),
            'date_short' => $this->created_at?->format('Y-m-d'),
        ];
    }
}
