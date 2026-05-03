<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Processing;
use App\Models\StockLog;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ProductService
{
    /**
     * Cache key for products.
     */
    private const CACHE_KEY = 'products_all';
    private const CACHE_TTL = 300; // 5 minutes

    /**
     * Get all products with caching.
     */
    public function getAllProducts()
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            $activeStatuses = ['pending', 'processing', 'shipped', 'picking_up', 'picked_up', 'return_requested'];
            return Product::with('variety')
                ->withExists(['saleItems as has_pending_orders' => function ($query) use ($activeStatuses) {
                    $query->whereHas('sale', fn($q) => $q->whereIn('status', $activeStatuses));
                }])
                ->orderBy('created_at', 'desc')
                ->get();
        });
    }

    /**
     * Get featured products (active with stock).
     */
    public function getFeaturedProducts()
    {
        return Cache::remember('products_featured', self::CACHE_TTL, function () {
            return Product::with('variety')
                ->where('status', 'active')
                ->where('stocks', '>', 0)
                ->orderBy('created_at', 'desc')
                ->limit(12)
                ->get();
        });
    }

    /**
     * Get products with stats.
     */
    public function getProductsWithStats(): array
    {
        $products = $this->getAllProducts();
        
        return [
            'products' => $products,
            'stats' => [
                'total' => count($products),
                'active' => count(array_filter($products, fn($p) => $p['status'] === 'active')),
                'inactive' => count(array_filter($products, fn($p) => $p['status'] === 'inactive')),
                'in_stock' => count(array_filter($products, fn($p) => ($p['stocks'] ?? 0) > 0)),
                'out_of_stock' => count(array_filter($products, fn($p) => ($p['stocks'] ?? 0) <= 0)),
            ]
        ];
    }

    /**
     * Get a single product by ID.
     */
    public function getProduct(int $id): ?Product
    {
        return Product::with('variety')->find($id);
    }

    /**
     * Create a new product.
     */
    public function createProduct(array $data): Product
    {
        return DB::transaction(function () use ($data) {
            $weight = $data['weight'] ?? null;
            $unit = $weight ? (intval($weight) == $weight ? intval($weight) . 'kg' : number_format((float) $weight, 2) . 'kg') : 'kg';

            $product = Product::create([
                'product_name' => $data['product_name'],
                'variety_id' => $data['variety_id'],
                'price' => $data['price'] ?? 0,
                'stocks' => $data['stocks'] ?? 0,
                'stock_floor' => $data['stock_floor'] ?? 0,
                'unit' => $unit,
                'weight' => $weight,
                'status' => $data['status'] ?? 'active',
                'image' => $data['image'] ?? null,
            ]);

            // Refresh to get timestamps as Carbon instances
            $product->refresh();
            
            // Load the variety relationship
            $product->load('variety');
            
            $this->clearCache();
            
            return $product;
        });
    }

    /**
     * Update a product.
     */
    public function updateProduct(int $id, array $data): Product
    {
        return DB::transaction(function () use ($id, $data) {
            $product = Product::findOrFail($id);
            
            $weight = $data['weight'] ?? $product->weight;
            $unit = $weight ? (intval($weight) == $weight ? intval($weight) . 'kg' : number_format((float) $weight, 2) . 'kg') : 'kg';

            $product->update([
                'product_name' => $data['product_name'] ?? $product->product_name,
                'variety_id' => $data['variety_id'] ?? $product->variety_id,
                'price' => $data['price'] ?? $product->price,
                'stocks' => $data['stocks'] ?? $product->stocks,
                'stock_floor' => $data['stock_floor'] ?? $product->stock_floor,
                'unit' => $unit,
                'weight' => $weight,
                'status' => $data['status'] ?? $product->status,
                'image' => array_key_exists('image', $data) ? $data['image'] : $product->image,
            ]);

            $product->load('variety');
            
            $this->clearCache();
            
            return $product;
        });
    }

    /**
     * Archive a product (move to archives).
     */
    public function deleteProduct(int $id): bool
    {
        return DB::transaction(function () use ($id) {
            $product = Product::findOrFail($id);

            // Block archive if product has active/pending orders
            $activeStatuses = ['pending', 'processing', 'shipped', 'picking_up', 'picked_up', 'return_requested'];
            $hasPendingOrders = \App\Models\SaleItem::where('product_id', $product->product_id)
                ->whereHas('sale', fn($q) => $q->whereIn('status', $activeStatuses))
                ->exists();

            if ($hasPendingOrders) {
                throw new \Exception('Cannot archive this product. It has active or pending orders.');
            }

            $result = $product->archive();
            
            $this->clearCache();
            
            return $result;
        });
    }

    /**
     * Restore a deleted product.
     */
    public function restoreProduct(int $id): Product
    {
        return DB::transaction(function () use ($id) {
            $product = Product::withDeleted()->findOrFail($id);
            $product->restore();
            $product->load('variety');
            
            $this->clearCache();
            
            return $product;
        });
    }

    /**
     * Update product stock.
     */
    public function updateStock(int $id, int $quantity, string $operation = 'add'): Product
    {
        return DB::transaction(function () use ($id, $quantity, $operation) {
            $product = Product::findOrFail($id);
            
            if ($operation === 'add') {
                $product->stocks += $quantity;
            } elseif ($operation === 'subtract') {
                $product->stocks = max(0, $product->stocks - $quantity);
            } else {
                $product->stocks = $quantity;
            }
            
            $product->save();
            $product->load('variety');
            
            $this->clearCache();
            
            return $product;
        });
    }

    /**
     * Toggle product status.
     */
    public function toggleStatus(int $id): Product
    {
        return DB::transaction(function () use ($id) {
            $product = Product::findOrFail($id);
            $product->status = $product->status === 'active' ? 'inactive' : 'active';
            $product->save();
            $product->load('variety');
            
            $this->clearCache();
            
            return $product;
        });
    }

    /**
     * Compute cost breakdown for a processing record by tracing back
     * through drying sources to procurement.
     *
     * Returns: procurement_cost, drying_cost, total_cost, cost_per_kg
     */
    public function computeProcessingCost(Processing $processing): array
    {
        $totalProcurementCost = 0;
        $totalDryingCost = 0;

        // Ensure dryingSources is loaded with cost-related data
        if (!$processing->relationLoaded('dryingSources')) {
            $processing->load([
                'dryingSources',
                'dryingSources.procurement:id,quantity_kg,price_per_kg',
                'dryingSources.batchProcurements.procurement:id,quantity_kg,price_per_kg',
            ]);
        }

        foreach ($processing->dryingSources as $dryingSource) {
            $quantityKgTaken = (float) $dryingSource->pivot->quantity_kg;
            $dryingTotalKg = (float) $dryingSource->quantity_kg;

            if ($dryingTotalKg <= 0) continue;

            $fraction = $quantityKgTaken / $dryingTotalKg;

            // Drying cost share (proportional to kg taken)
            $dryingCostShare = $fraction * (float) $dryingSource->total_price;
            $totalDryingCost += $dryingCostShare;

            // Procurement cost share
            if ($dryingSource->batch_id && $dryingSource->relationLoaded('batchProcurements') && $dryingSource->batchProcurements->count() > 0) {
                // Batch drying: sum procurement costs from batch allocations
                $procurementCostForDrying = 0;
                foreach ($dryingSource->batchProcurements as $bp) {
                    $procurementCostForDrying += (float) $bp->quantity_kg * (float) ($bp->procurement->price_per_kg ?? 0);
                }
                $totalProcurementCost += $fraction * $procurementCostForDrying;
            } elseif ($dryingSource->procurement) {
                // Individual drying: cost of raw rice that went into drying
                $procurementCostForDrying = $dryingTotalKg * (float) $dryingSource->procurement->price_per_kg;
                $totalProcurementCost += $fraction * $procurementCostForDrying;
            }
        }

        $totalCost = $totalProcurementCost + $totalDryingCost;
        $outputKg = (float) ($processing->output_kg ?? 0);
        $costPerOutputKg = $outputKg > 0 ? $totalCost / $outputKg : 0;

        return [
            'procurement_cost' => round($totalProcurementCost, 2),
            'drying_cost' => round($totalDryingCost, 2),
            'total_cost' => round($totalCost, 2),
            'cost_per_kg' => round($costPerOutputKg, 2),
        ];
    }

    /**
     * Get cost analysis for a product (average cost per unit, profit margin, etc.)
     */
    public function getProductCostAnalysis(int $productId): array
    {
        $product = Product::with('variety')->findOrFail($productId);
        $weight = (float) ($product->weight ?? 0);
        $sellingPrice = (float) $product->price;

        // Use stock logs as the primary source — they track costs per product distribution
        $stockLogs = StockLog::where('product_id', $productId)
            ->where('type', 'in')
            ->whereNotNull('total_cost')
            ->where('total_cost', '>', 0)
            ->get();

        if ($stockLogs->isNotEmpty()) {
            $totalCost = $stockLogs->sum('total_cost');
            $totalUnits = $stockLogs->sum('quantity_change');
            $avgCostPerUnit = $totalUnits > 0 ? $totalCost / $totalUnits : 0;
            $avgCostPerKg = $weight > 0 ? $avgCostPerUnit / $weight : $avgCostPerUnit;
            $profitPerUnit = $sellingPrice - $avgCostPerUnit;
            $profitMargin = $sellingPrice > 0 ? ($profitPerUnit / $sellingPrice) * 100 : 0;

            return [
                'has_data' => true,
                'avg_cost_per_kg' => round($avgCostPerKg, 2),
                'avg_cost_per_unit' => round($avgCostPerUnit, 2),
                'selling_price' => round($sellingPrice, 2),
                'profit_per_unit' => round($profitPerUnit, 2),
                'profit_margin' => round($profitMargin, 2),
                'total_procurement_cost' => round((float) $stockLogs->sum('procurement_cost'), 2),
                'total_drying_cost' => round((float) $stockLogs->sum('drying_cost'), 2),
                'total_production_cost' => round($totalCost, 2),
                'total_distributed_kg' => round((float) $stockLogs->sum('kg_amount'), 2),
                'processings_count' => $stockLogs->count(),
            ];
        }

        // Fallback: compute from processings if no stock logs exist yet
        $varietyId = $product->variety_id;
        $processings = Processing::with([
                'dryingSources:id,procurement_id,batch_id,quantity_kg,price,total_price',
                'dryingSources.procurement:id,quantity_kg,price_per_kg',
                'dryingSources.batchProcurements',
                'dryingSources.batchProcurements.procurement:id,quantity_kg,price_per_kg',
            ])
            ->completed()
            ->where('stock_out', '>', 0)
            ->where(function ($query) use ($varietyId) {
                $query->whereHas('dryingSources.batch', fn($q) => $q->where('variety_id', $varietyId))
                    ->orWhereHas('dryingSources.procurement', fn($q) => $q->where('variety_id', $varietyId));
            })
            ->get();

        if ($processings->isEmpty()) {
            return [
                'has_data' => false,
                'avg_cost_per_kg' => 0,
                'avg_cost_per_unit' => 0,
                'selling_price' => $sellingPrice,
                'profit_per_unit' => 0,
                'profit_margin' => 0,
                'total_procurement_cost' => 0,
                'total_drying_cost' => 0,
                'total_production_cost' => 0,
                'total_distributed_kg' => 0,
                'processings_count' => 0,
            ];
        }

        $totalProcurementCost = 0;
        $totalDryingCost = 0;
        $totalDistributedKg = 0;

        foreach ($processings as $processing) {
            $cost = $this->computeProcessingCost($processing);
            $distributedFraction = (float) $processing->stock_out / max(0.01, (float) $processing->output_kg);
            $totalProcurementCost += $cost['procurement_cost'] * $distributedFraction;
            $totalDryingCost += $cost['drying_cost'] * $distributedFraction;
            $totalDistributedKg += (float) $processing->stock_out;
        }

        $totalCost = $totalProcurementCost + $totalDryingCost;
        $avgCostPerKg = $totalDistributedKg > 0 ? $totalCost / $totalDistributedKg : 0;
        $avgCostPerUnit = $weight > 0 ? $avgCostPerKg * $weight : $avgCostPerKg;
        $profitPerUnit = $sellingPrice - $avgCostPerUnit;
        $profitMargin = $sellingPrice > 0 ? ($profitPerUnit / $sellingPrice) * 100 : 0;

        return [
            'has_data' => true,
            'avg_cost_per_kg' => round($avgCostPerKg, 2),
            'avg_cost_per_unit' => round($avgCostPerUnit, 2),
            'selling_price' => round($sellingPrice, 2),
            'profit_per_unit' => round($profitPerUnit, 2),
            'profit_margin' => round($profitMargin, 2),
            'total_procurement_cost' => round($totalProcurementCost, 2),
            'total_drying_cost' => round($totalDryingCost, 2),
            'total_production_cost' => round($totalCost, 2),
            'total_distributed_kg' => round($totalDistributedKg, 2),
            'processings_count' => $processings->count(),
        ];
    }

    /**
     * Get completed processings by variety ID (with remaining stock > 0).
     */
    public function getCompletedProcessingsByVariety(int $varietyId)
    {
        $processings = Processing::with([
                'procurement:id,supplier_id,quantity_kg,sacks',
                'procurement.supplier:id,name',
                'dryingProcess:id,procurement_id,batch_id,quantity_kg,sacks,quantity_out,days,status',
                'dryingProcess.procurement:id,supplier_id',
                'dryingProcess.procurement.supplier:id,name',
                'dryingProcess.batch:id,batch_number',
                'dryingSources:id,procurement_id,batch_id,quantity_kg,sacks,quantity_out,days,status,price,total_price',
                'dryingSources.procurement:id,supplier_id,variety_id,quantity_kg,price_per_kg',
                'dryingSources.procurement.supplier:id,name',
                'dryingSources.batch:id,batch_number,variety_id',
                'dryingSources.batch.variety:id,name,color',
                'dryingSources.procurement.variety:id,name,color',
                'dryingSources.batchProcurements',
                'dryingSources.batchProcurements.procurement:id,quantity_kg,price_per_kg',
            ])
            ->select(['id', 'procurement_id', 'drying_process_id', 'input_kg', 'output_kg', 'stock_out', 'husk_kg', 'yield_percent', 'operator_name', 'status', 'processing_date', 'completed_date', 'created_at'])
            ->completed()
            ->whereRaw('output_kg > stock_out')
            ->where(function ($query) use ($varietyId) {
                // Path A: drying source has a batch with this variety
                $query->whereHas('dryingSources.batch', function ($q) use ($varietyId) {
                    $q->where('variety_id', $varietyId);
                })
                // Path B: drying source has no batch, but its procurement has this variety
                ->orWhereHas('dryingSources.procurement', function ($q) use ($varietyId) {
                    $q->where('variety_id', $varietyId);
                });
            })
            ->orderBy('completed_date', 'desc')
            ->get();

        // Compute cost breakdown for each processing (trace procurement → drying → processing)
        $processings->each(function ($processing) {
            $processing->cost_breakdown_data = $this->computeProcessingCost($processing);
        });

        return $processings;
    }

    /**
     * Distribute stock from completed processings to a product.
     * Deducts from processing remaining stock, adds units to product.
     */
    public function distributeStockFromProcessing(int $productId, array $sources): array
    {
        return DB::transaction(function () use ($productId, $sources) {
            $product = Product::with('variety')->findOrFail($productId);
            $weight = (float) ($product->weight ?? 0);

            if ($weight <= 0) {
                throw new \Exception('Product has no weight set. Cannot calculate units from kg.');
            }

            $totalKgTaken = 0;
            $processingUpdates = [];

            // Validate and prepare all sources
            foreach ($sources as $source) {
                $processing = Processing::findOrFail($source['processing_id']);

                if ($processing->status !== Processing::STATUS_COMPLETED) {
                    throw new \Exception("Processing #{$processing->id} is not completed.");
                }

                $remainingStock = (float) $processing->remaining_stock;
                $kgToTake = (float) $source['kg_to_take'];

                if ($kgToTake > $remainingStock) {
                    throw new \Exception("Processing #{$processing->id} only has {$remainingStock} kg remaining. Cannot take {$kgToTake} kg.");
                }

                // Verify this processing belongs to the right variety (batch OR procurement path)
                $hasMatchingVariety = $processing->dryingSources()
                    ->where(function ($q) use ($product) {
                        $q->whereHas('batch', function ($bq) use ($product) {
                            $bq->where('variety_id', $product->variety_id);
                        })
                        ->orWhereHas('procurement', function ($pq) use ($product) {
                            $pq->where('variety_id', $product->variety_id);
                        });
                    })
                    ->exists();

                if (!$hasMatchingVariety) {
                    throw new \Exception("Processing #{$processing->id} does not match the product variety.");
                }

                $totalKgTaken += $kgToTake;
                $processingUpdates[] = [
                    'processing' => $processing,
                    'kg_to_take' => $kgToTake,
                ];
            }

            // Calculate units to add
            $totalUnits = (int) floor($totalKgTaken / $weight);
            $excessKg = round($totalKgTaken - ($totalUnits * $weight), 2);

            if ($totalUnits <= 0 && $excessKg > 0) {
                throw new \Exception("Total kg ({$totalKgTaken} kg) is not enough to make even 1 unit ({$weight} kg/unit).");
            }

            // The actual kg we consume (without excess)
            $actualKgConsumed = $totalKgTaken - $excessKg;

            // Distribute the excess back: deduct excess from the last source
            $adjustedSources = $processingUpdates;
            if ($excessKg > 0) {
                // Reduce from the last processing source
                $lastIdx = count($adjustedSources) - 1;
                $adjustedSources[$lastIdx]['kg_to_take'] -= $excessKg;
            }

            // Apply updates to processings
            foreach ($adjustedSources as $update) {
                $processing = $update['processing'];
                $processing->stock_out = (float) $processing->stock_out + $update['kg_to_take'];
                $processing->save();
            }

            // Add stock to product
            $stockBefore = (int) $product->stocks;
            $product->stocks += $totalUnits;
            $product->save();
            $product->load('variety');

            // Compute cost breakdown for each processing source
            $totalProcurementCost = 0;
            $totalDryingCost = 0;
            foreach ($adjustedSources as $update) {
                $proc = $update['processing'];
                // Load cost-related relationships
                $proc->load([
                    'dryingSources:id,procurement_id,batch_id,quantity_kg,price,total_price',
                    'dryingSources.procurement:id,quantity_kg,price_per_kg',
                    'dryingSources.batchProcurements',
                    'dryingSources.batchProcurements.procurement:id,quantity_kg,price_per_kg',
                ]);
                $cost = $this->computeProcessingCost($proc);
                // Scale cost proportionally to the kg taken from this processing
                $outputKg = (float) ($proc->output_kg ?? 1);
                $fraction = $update['kg_to_take'] / max(0.01, $outputKg);
                $totalProcurementCost += $cost['procurement_cost'] * $fraction;
                $totalDryingCost += $cost['drying_cost'] * $fraction;
            }
            $totalCost = round($totalProcurementCost + $totalDryingCost, 2);
            $costPerUnit = $totalUnits > 0 ? round($totalCost / $totalUnits, 2) : 0;
            $sellingPrice = (float) $product->price;
            $profitPerUnit = round($sellingPrice - $costPerUnit, 2);
            $profitMargin = $sellingPrice > 0 ? round(($profitPerUnit / $sellingPrice) * 100, 2) : 0;

            // Compute Perpetual Weighted Average Cost (PWAC):
            // new_avg = ((units_on_hand_before * prev_running_avg) + total_cost_of_new_batch)
            //           / (units_on_hand_before + new_units)
            $prevLog = StockLog::where('product_id', $product->product_id)
                ->where('type', 'in')
                ->whereNotNull('running_avg_cost')
                ->orderByDesc('created_at')
                ->first();
            $prevRunningAvg = $prevLog ? (float) $prevLog->running_avg_cost : 0;
            $totalUnitsAfter = $stockBefore + $totalUnits;
            $runningAvgCost = $totalUnitsAfter > 0
                ? round(($stockBefore * $prevRunningAvg + $totalCost) / $totalUnitsAfter, 4)
                : 0;

            // Log the stock movement with cost data
            StockLog::create([
                'product_id' => $product->product_id,
                'type' => 'in',
                'quantity_before' => $stockBefore,
                'quantity_change' => $totalUnits,
                'quantity_after' => (int) $product->stocks,
                'kg_amount' => $actualKgConsumed,
                'source_type' => 'processing_distribution',
                'source_id' => $processingUpdates[0]['processing']->id,
                'source_processing_ids' => array_map(fn($u) => ['processing_id' => $u['processing']->id, 'kg_taken' => $u['kg_to_take']], $adjustedSources),
                'notes' => "Distributed from " . count($processingUpdates) . " processing source(s)",
                'procurement_cost' => round($totalProcurementCost, 2),
                'drying_cost' => round($totalDryingCost, 2),
                'total_cost' => $totalCost,
                'cost_per_unit' => $costPerUnit,
                'running_avg_cost' => $runningAvgCost,
                'selling_price' => $sellingPrice,
                'profit_per_unit' => $profitPerUnit,
                'profit_margin' => $profitMargin,
            ]);

            // Clear caches
            $this->clearCache();
            Cache::forget('processings_all');
            Cache::forget('processings_active');
            Cache::forget('processings_completed');
            Cache::forget('stock_logs_all');

            return [
                'product' => new \App\Http\Resources\ProductResource($product),
                'total_kg_taken' => $actualKgConsumed,
                'total_units_added' => $totalUnits,
                'excess_kg' => $excessKg,
                'new_stock' => $product->stocks,
            ];
        });
    }

    /**
     * Clear the products cache.
     */
    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
        Cache::forget('products_featured');
        // Also clear varieties cache since they might show product counts
        Cache::forget('varieties_all');
        DashboardService::clearStatsCache();
    }
}
