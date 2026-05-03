<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Services\CategoryService;
use App\Http\Resources\CategoryResource;
use App\Traits\ApiResponse;
use App\Traits\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    use ApiResponse, AuditLogger;

    protected CategoryService $categoryService;

    public function __construct(CategoryService $categoryService)
    {
        $this->categoryService = $categoryService;
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $categories = $this->categoryService->getAllCategories();
        
        return $this->successResponse(
            CategoryResource::collection($categories),
            'Categories retrieved successfully'
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:20',
            'status' => 'required|in:Active,Inactive',
        ], [
            'name.required' => 'Category name is required.',
        ]);

        $category = $this->categoryService->createCategory($validated);

        $this->logAudit('CREATE', 'Categories', "Created category: {$category->name}", [
            'category_id' => $category->id,
            'name' => $category->name,
            'status' => $category->status,
        ]);

        return $this->successResponse(
            new CategoryResource($category),
            'Category created successfully',
            201
        );
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $category = $this->categoryService->getCategoryById((int) $id);
        
        if (!$category) {
            return $this->errorResponse('Category not found', 404);
        }
        
        return $this->successResponse(
            new CategoryResource($category),
            'Category retrieved successfully'
        );
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $category = Category::findOrFail($id);
        
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:20',
            'status' => 'required|in:Active,Inactive',
        ], [
            'name.required' => 'Category name is required.',
        ]);

        $oldValues = $category->only(['name', 'description', 'color', 'status']);
        $category = $this->categoryService->updateCategory($category, $validated);

        $this->logAudit('UPDATE', 'Categories', "Updated category: {$category->name}", [
            'category_id' => $category->id,
            'old_values' => $oldValues,
            'new_values' => $category->only(['name', 'description', 'color', 'status']),
        ]);

        return $this->successResponse(
            new CategoryResource($category),
            'Category updated successfully'
        );
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $category = Category::findOrFail($id);
        
        // Set status to Inactive before soft deleting
        $category->status = 'Inactive';
        $category->saveQuietly();
        
        // Now soft delete (sets deleted_at)
        $this->categoryService->deleteCategory($category);

        $this->logAudit('ARCHIVE', 'Categories', "Archived category: {$category->name}", [
            'category_id' => $category->id,
            'name' => $category->name,
        ]);

        return $this->successResponse(
            null,
            'Category archived successfully'
        );
    }
}
