<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProductResource;
use App\Http\Resources\ProcessingResource;
use App\Http\Resources\StockLogResource;
use App\Models\StockLog;
use App\Models\Product;
use App\Models\SaleItem;
use App\Services\ProductService;
use App\Services\ProcessingService;
use App\Traits\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    use AuditLogger;
    public function __construct(
        private ProductService $productService,
        private ProcessingService $processingService
    ) {}

    /**
     * Display a listing of products.
     */
    public function index(): JsonResponse
    {
        try {
            $products = $this->productService->getAllProducts();
            
            return response()->json([
                'success' => true,
                'data' => ProductResource::collection(collect($products)->map(function ($item) {
                    return (object) $item;
                })),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch products',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get featured products (active products with stock).
     */
    public function featured(): JsonResponse
    {
        try {
            $products = $this->productService->getFeaturedProducts();
            
            return response()->json([
                'success' => true,
                'data' => ProductResource::collection(collect($products)->map(function ($item) {
                    return (object) $item;
                })),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch featured products',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created product.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'product_name' => 'required|string|max:255',
                'variety_id' => 'required|exists:varieties,id',
                'price' => 'required|numeric|min:0',
                'stocks' => 'nullable|integer|min:0',
                'stock_floor' => 'nullable|integer|min:0',
                'unit' => 'nullable|string|max:50',
                'weight' => 'required|numeric|min:0.01',
                'status' => ['nullable', Rule::in(['active', 'inactive'])],
                'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            ]);

            if ($request->hasFile('image')) {
                $validated['image'] = $request->file('image')->store('products', 'public');
            }

            $product = $this->productService->createProduct($validated);

            $this->logAudit('CREATE', 'Products', "Created product: {$product->product_name}", [
                'product_id' => $product->id,
                'name' => $product->product_name,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Product created successfully',
                'data' => new ProductResource($product),
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create product',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified product.
     */
    public function show(int $id): JsonResponse
    {
        try {
            $product = $this->productService->getProduct($id);

            if (!$product) {
                return response()->json([
                    'success' => false,
                    'message' => 'Product not found',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => new ProductResource($product),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch product',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified product.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $validated = $request->validate([
                'product_name' => 'sometimes|required|string|max:255',
                'variety_id' => 'sometimes|required|exists:varieties,id',
                'price' => 'sometimes|required|numeric|min:0',
                'stocks' => 'nullable|integer|min:0',
                'stock_floor' => 'nullable|integer|min:0',
                'unit' => 'nullable|string|max:50',
                'weight' => 'sometimes|required|numeric|min:0.01',
                'status' => ['nullable', Rule::in(['active', 'inactive'])],
                'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            ]);

            // Prevent changing variety or weight if product has existing stock
            $product = Product::findOrFail($id);

            if ($product->stocks > 0) {
                if (isset($validated['variety_id']) && (int) $validated['variety_id'] !== $product->variety_id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Cannot change variety while product has existing stock',
                        'errors' => ['variety_id' => ['Cannot change variety while product has existing stock']],
                    ], 422);
                }
                if (isset($validated['weight']) && (float) $validated['weight'] !== (float) $product->weight) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Cannot change weight while product has existing stock',
                        'errors' => ['weight' => ['Cannot change weight while product has existing stock']],
                    ], 422);
                }
            }

            if ($request->hasFile('image')) {
                if ($product->image) {
                    Storage::disk('public')->delete($product->image);
                }
                $validated['image'] = $request->file('image')->store('products', 'public');
            }

            $product = $this->productService->updateProduct($id, $validated);

            $this->logAudit('UPDATE', 'Products', "Updated product: {$product->product_name}", [
                'product_id' => $product->id,
                'changes' => $validated,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Product updated successfully',
                'data' => new ProductResource($product),
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update product',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified product (soft delete).
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $this->productService->deleteProduct($id);

            $this->logAudit('ARCHIVE', 'Products', "Archived product #{$id}", [
                'product_id' => $id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Product archived successfully',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Restore a soft-deleted product.
     */
    public function restore(int $id): JsonResponse
    {
        try {
            $product = $this->productService->restoreProduct($id);

            return response()->json([
                'success' => true,
                'message' => 'Product restored successfully',
                'data' => new ProductResource($product),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to restore product',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update product stock.
     */
    public function updateStock(Request $request, int $id): JsonResponse
    {
        try {
            $validated = $request->validate([
                'quantity' => 'required|integer',
                'operation' => ['required', Rule::in(['add', 'subtract', 'set'])],
            ]);

            $product = $this->productService->updateStock($id, $validated['quantity'], $validated['operation']);

            return response()->json([
                'success' => true,
                'message' => 'Stock updated successfully',
                'data' => new ProductResource($product),
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update stock',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get completed processings filtered by product variety (for stock distribution).
     */
    public function completedProcessingsByVariety(int $id): JsonResponse
    {
        try {
            $product = $this->productService->getProduct($id);

            if (!$product) {
                return response()->json([
                    'success' => false,
                    'message' => 'Product not found',
                ], 404);
            }

            $varietyId = $product->variety_id;
            $processings = $this->productService->getCompletedProcessingsByVariety($varietyId);

            return response()->json([
                'success' => true,
                'data' => ProcessingResource::collection($processings),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch processings',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Distribute stock from completed processings to product.
     */
    public function distributeStock(Request $request, int $id): JsonResponse
    {
        try {
            $validated = $request->validate([
                'sources' => 'required|array|min:1',
                'sources.*.processing_id' => 'required|integer|exists:processings,id',
                'sources.*.kg_to_take' => 'required|numeric|min:0.01',
            ]);

            $result = $this->productService->distributeStockFromProcessing($id, $validated['sources']);

            $this->logAudit('UPDATE', 'Products', "Distributed stock to product #{$id}", [
                'product_id' => $id,
                'sources' => $validated['sources'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Stock distributed successfully',
                'data' => $result,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Toggle product status.
     */
    public function toggleStatus(int $id): JsonResponse
    {
        try {
            $product = $this->productService->toggleStatus($id);

            $this->logAudit('UPDATE', 'Products', "Toggled product #{$id} status to {$product->status}", [
                'product_id' => $product->id,
                'status' => $product->status,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Status updated successfully',
                'data' => new ProductResource($product),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to toggle status',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get cost analysis for a product (production cost, profit margin).
     */
    public function costAnalysis(int $id): JsonResponse
    {
        try {
            $result = $this->productService->getProductCostAnalysis($id);

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to compute cost analysis',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get order history for a specific product.
     */
    public function orderHistory(int $id): JsonResponse
    {
        try {
            $product = Product::findOrFail($id);

            $saleItems = SaleItem::with(['sale.customer'])
                ->where('product_id', $id)
                ->orderByDesc('created_at')
                ->get();

            $orders = $saleItems->map(function ($item) {
                $sale = $item->sale;
                return [
                    'sale_id' => $sale->id,
                    'transaction_id' => $sale->transaction_id,
                    'customer_name' => $sale->customer?->name ?? 'Walk-in',
                    'quantity' => (int) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'subtotal' => (float) $item->subtotal,
                    'status' => $sale->status,
                    'payment_method' => $sale->payment_method,
                    'payment_status' => $sale->payment_status ?? 'paid',
                    'is_delivery' => !empty($sale->delivery_address),
                    'date' => $sale->created_at?->toISOString(),
                    'date_formatted' => $sale->created_at?->format('M d, Y h:i A'),
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $orders,
                'current_stock' => (int) $product->stocks,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found',
            ], 404);
        }
    }

    /**
     * Get all stock movement logs.
     */
    public function stockLogs(): JsonResponse
    {
        try {
            $logs = StockLog::with(['product.variety'])
                ->orderBy('created_at', 'desc')
                ->limit(500)
                ->get();

            return response()->json([
                'success' => true,
                'data' => StockLogResource::collection($logs),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch stock logs',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
