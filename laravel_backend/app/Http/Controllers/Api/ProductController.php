<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Traits\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class ProductController extends Controller
{
    use AuditLogger;
    /**
     * Get all products (public API)
     */
    public function index(Request $request): JsonResponse
    {
        $query = Product::query();

        // Apply search filter
        if ($request->has('search') && $request->search) {
            $query->search($request->search);
        }

        // Apply variety filter
        if ($request->has('variety') && $request->variety !== 'all') {
            $query->byVariety($request->variety);
        }

        // Apply stock filter (default: only in-stock for public)
        if (!$request->has('include_out_of_stock')) {
            $query->where('in_stock', true);
        }

        // Sorting
        $sortBy = $request->get('sort', 'popular');
        switch ($sortBy) {
            case 'price-low':
                $query->orderBy('price', 'asc');
                break;
            case 'price-high':
                $query->orderBy('price', 'desc');
                break;
            case 'rating':
                $query->orderBy('rating', 'desc');
                break;
            case 'name':
                $query->orderBy('name', 'asc');
                break;
            case 'popular':
            default:
                $query->orderBy('reviews_count', 'desc');
                break;
        }

        // Secondary sort by sort_order
        $query->orderBy('sort_order', 'asc');

        $products = $query->get();

        return response()->json([
            'success' => true,
            'data' => $products,
            'count' => $products->count(),
        ]);
    }

    /**
     * Get featured products for homepage
     */
    public function featured(): JsonResponse
    {
        $products = Cache::remember('products-featured', 300, function () {
            return Product::featured()
                ->public()
                ->orderBy('sort_order', 'asc')
                ->limit(4)
                ->get();
        });

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }

    /**
     * Get product varieties with counts
     */
    public function varieties(): JsonResponse
    {
        $varieties = Product::where('in_stock', true)
            ->selectRaw('variety_id, COUNT(*) as count')
            ->groupBy('variety_id')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->variety_id,
                    'name' => $item->variety?->name ?? 'Unknown',
                    'count' => $item->count,
                ];
            });

        // Add "All Products" variety
        $total = Product::where('in_stock', true)->count();
        $allVarieties = collect([
            ['id' => 'all', 'name' => 'All Products', 'count' => $total]
        ])->concat($varieties);

        return response()->json([
            'success' => true,
            'data' => $allVarieties,
        ]);
    }

    /**
     * Get single product by ID
     */
    public function show(Product $product): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $product,
        ]);
    }

    /**
     * Store new product (Admin only)
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'variety' => 'required|string|max:50',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'unit' => 'nullable|string|max:50',
            'image' => 'nullable|string|url',
            'rating' => 'nullable|numeric|min:0|max:5',
            'reviews_count' => 'nullable|integer|min:0',
            'tags' => 'nullable|array',
            'in_stock' => 'nullable|boolean',
            'is_featured' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $product = Product::create($validated);
        Cache::forget('products-featured');

        $this->logAudit('CREATE', 'Products', "Created product: {$product->name}", [
            'product_id' => $product->id,
            'name' => $product->name,
            'variety' => $product->variety,
            'price' => $product->price,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Product created successfully',
            'data' => $product,
        ], 201);
    }

    /**
     * Update product (Admin only)
     */
    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'variety' => 'sometimes|string|max:50',
            'description' => 'nullable|string',
            'price' => 'sometimes|numeric|min:0',
            'unit' => 'nullable|string|max:50',
            'image' => 'nullable|string',
            'rating' => 'nullable|numeric|min:0|max:5',
            'reviews_count' => 'nullable|integer|min:0',
            'tags' => 'nullable|array',
            'in_stock' => 'nullable|boolean',
            'is_featured' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $product->update($validated);
        Cache::forget('products-featured');

        $this->logAudit('UPDATE', 'Products', "Updated product: {$product->name}", [
            'product_id' => $product->id,
            'changes' => $validated,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Product updated successfully',
            'data' => $product,
        ]);
    }

    /**
     * Delete product (Admin only)
     */
    public function destroy(Product $product): JsonResponse
    {
        $productName = $product->name;
        $productId = $product->id;
        $product->delete();
        Cache::forget('products-featured');

        $this->logAudit('DELETE', 'Products', "Deleted product: {$productName}", [
            'product_id' => $productId,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Product deleted successfully',
        ]);
    }
}
