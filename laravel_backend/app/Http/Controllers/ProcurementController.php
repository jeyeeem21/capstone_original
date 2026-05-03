<?php

namespace App\Http\Controllers;

use App\Models\Procurement;
use App\Models\ProcurementBatch;
use App\Services\ProcurementService;
use App\Services\ProcurementBatchService;
use App\Services\EmailService;
use App\Http\Resources\ProcurementResource;
use App\Traits\ApiResponse;
use App\Traits\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class ProcurementController extends Controller
{
    use ApiResponse, AuditLogger;

    protected ProcurementService $procurementService;
    protected ProcurementBatchService $batchService;
    protected EmailService $emailService;

    public function __construct(ProcurementService $procurementService, ProcurementBatchService $batchService, EmailService $emailService)
    {
        $this->procurementService = $procurementService;
        $this->batchService = $batchService;
        $this->emailService = $emailService;
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $procurements = $this->procurementService->getAllProcurements();
        
        return $this->successResponse(
            ProcurementResource::collection($procurements),
            'Procurements retrieved successfully'
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => 'nullable|exists:suppliers,id',
            'new_supplier_name' => 'nullable|string|max:255',
            'new_supplier_contact' => 'nullable|string|max:255',
            'new_supplier_phone' => 'nullable|string|max:255',
            'new_supplier_email' => 'nullable|email|max:255',
            'new_supplier_address' => 'nullable|string|max:500',
            'variety_id' => 'required|exists:varieties,id',
            'quantity_kg' => 'required|numeric|min:0',
            'sacks' => 'required|integer|min:0',
            'price_per_kg' => 'required|numeric|min:0',
            'description' => 'required|string',
            'status' => 'required|in:Pending,Drying,Dried,Completed,Cancelled',
            'batch_id' => 'nullable|integer|exists:procurement_batches,id',
        ], [
            'quantity_kg.required' => 'Quantity is required.',
            'price_per_kg.required' => 'Price per kg is required.',
        ]);

        // Must have either supplier_id or new_supplier_name
        if (empty($validated['supplier_id']) && empty($validated['new_supplier_name'])) {
            return $this->errorResponse('Please select a supplier or enter a new supplier name.', 422);
        }

        $newSupplierName = $validated['new_supplier_name'] ?? null;
        $newSupplierData = [
            'contact' => $validated['new_supplier_contact'] ?? null,
            'phone' => $validated['new_supplier_phone'] ?? null,
            'email' => $validated['new_supplier_email'] ?? null,
            'address' => $validated['new_supplier_address'] ?? null,
        ];
        unset($validated['new_supplier_name'], $validated['new_supplier_contact'], $validated['new_supplier_phone'], $validated['new_supplier_email'], $validated['new_supplier_address']);

        $procurement = $this->procurementService->createProcurement($validated, $newSupplierName, $newSupplierData);

        // Log audit for inline supplier creation
        if ($newSupplierName && $procurement->supplier_id) {
            $this->logAudit('CREATE', 'Supplier', "Created supplier (via Procurement): {$newSupplierName}", [
                'supplier_id' => $procurement->supplier_id,
                'name' => $newSupplierName,
                'source' => 'inline_procurement',
            ]);
        }

        // If batch_id is set, validate variety match + batch status and recalculate totals
        if (!empty($validated['batch_id'])) {
            $batch = ProcurementBatch::findOrFail($validated['batch_id']);

            if ($batch->status === ProcurementBatch::STATUS_COMPLETED) {
                return $this->errorResponse("Batch {$batch->batch_number} is Completed. Cannot add procurements.", 422);
            }

            if ((int) $validated['variety_id'] !== (int) $batch->variety_id) {
                // Rollback: remove batch_id from the just-created procurement
                $procurement->update(['batch_id' => null]);
                return $this->errorResponse('Procurement variety does not match batch variety.', 422);
            }

            $batch->recalculateTotals();
            $this->batchService->clearCache();
        }

        $this->logAudit('CREATE', 'Procurement', "Created procurement #{$procurement->id} — {$procurement->sacks} sacks / {$procurement->quantity_kg} kg", [
            'procurement_id' => $procurement->id,
            'supplier_id' => $procurement->supplier_id,
            'quantity_kg' => $procurement->quantity_kg,
            'sacks' => $procurement->sacks,
        ]);

        return $this->successResponse(
            new ProcurementResource($procurement),
            'Procurement created successfully',
            201
        );
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $procurement = $this->procurementService->getProcurementById((int) $id);
        
        if (!$procurement) {
            return $this->errorResponse('Procurement not found', 404);
        }
        
        return $this->successResponse(
            new ProcurementResource($procurement),
            'Procurement retrieved successfully'
        );
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $procurement = Procurement::findOrFail($id);
        
        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'variety_id' => 'required|exists:varieties,id',
            'quantity_kg' => 'required|numeric|min:0',
            'sacks' => 'required|integer|min:0',
            'price_per_kg' => 'required|numeric|min:0',
            'description' => 'required|string',
            'status' => 'required|in:Pending,Drying,Dried,Completed,Cancelled',
            'batch_id' => 'nullable|integer|exists:procurement_batches,id',
        ], [
            'supplier_id.required' => 'Supplier is required.',
            'quantity_kg.required' => 'Quantity is required.',
            'price_per_kg.required' => 'Price per kg is required.',
        ]);

        // Prevent reducing quantity_kg / sacks below what's committed to drying
        $dryingSacks = $procurement->dryingProcesses()->whereIn('status', ['Drying', 'Dried', 'Postponed'])->sum('sacks')
            + $procurement->dryingBatchAllocations()->sum('sacks_taken');
        $dryingKg = $procurement->dryingProcesses()->whereIn('status', ['Drying', 'Dried', 'Postponed'])->sum('quantity_kg')
            + $procurement->dryingBatchAllocations()->sum('quantity_kg');

        if ($dryingSacks > 0) {
            if (isset($validated['sacks']) && (int) $validated['sacks'] < $dryingSacks) {
                return $this->validationErrorResponse(collect(['sacks' => ["Cannot set sacks below {$dryingSacks} — already committed to drying."]]));
            }
            if (isset($validated['quantity_kg']) && (float) $validated['quantity_kg'] < $dryingKg) {
                return $this->validationErrorResponse(collect(['quantity_kg' => ["Cannot set quantity below " . number_format($dryingKg, 2) . " kg — already committed to drying."]]));
            }
        }

        // Block variety change if procurement belongs to a batch
        if ($procurement->batch_id && isset($validated['variety_id'])) {
            $batch = ProcurementBatch::find($procurement->batch_id);
            if ($batch && (int) $validated['variety_id'] !== (int) $batch->variety_id) {
                return $this->errorResponse('Cannot change variety — procurement is assigned to batch ' . $batch->batch_number . ' which requires variety match.', 422);
            }
        }

        // If batch_id is changing, validate the new batch
        if (isset($validated['batch_id']) && $validated['batch_id'] != $procurement->batch_id) {
            if ($validated['batch_id']) {
                $newBatch = ProcurementBatch::findOrFail($validated['batch_id']);
                if ($newBatch->status !== ProcurementBatch::STATUS_OPEN) {
                    return $this->errorResponse("Batch {$newBatch->batch_number} is {$newBatch->status}. Cannot add procurements.", 422);
                }
                if ((int) ($validated['variety_id'] ?? $procurement->variety_id) !== (int) $newBatch->variety_id) {
                    return $this->errorResponse('Procurement variety does not match target batch variety.', 422);
                }
            }
        }

        $oldBatchId = $procurement->batch_id;

        $procurement = $this->procurementService->updateProcurement($procurement, $validated);

        // Recalculate batch totals if batch changed
        if (isset($validated['batch_id'])) {
            if ($oldBatchId && $oldBatchId != ($validated['batch_id'] ?? null)) {
                $oldBatch = ProcurementBatch::find($oldBatchId);
                $oldBatch?->recalculateTotals();
            }
            if ($validated['batch_id']) {
                $newBatch = ProcurementBatch::find($validated['batch_id']);
                $newBatch?->recalculateTotals();
            }
            $this->batchService->clearCache();
        } elseif ($procurement->batch_id) {
            // Quantity/sacks may have changed, recalculate batch
            $batch = ProcurementBatch::find($procurement->batch_id);
            $batch?->recalculateTotals();
            $this->batchService->clearCache();
        }

        $this->logAudit('UPDATE', 'Procurement', "Updated procurement #{$procurement->id}", [
            'procurement_id' => $procurement->id,
            'changes' => $validated,
        ]);

        return $this->successResponse(
            new ProcurementResource($procurement),
            'Procurement updated successfully'
        );
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $procurement = Procurement::findOrFail($id);
        $batchId = $procurement->batch_id;
        
        // Set status to Cancelled before soft deleting
        $procurement->status = 'Cancelled';
        $procurement->saveQuietly();
        
        // Now archive (sets is_archived=true)
        $this->procurementService->deleteProcurement($procurement);

        // Recalculate batch totals so sack counts reflect the removal immediately
        if ($batchId) {
            $batch = \App\Models\ProcurementBatch::find($batchId);
            if ($batch) {
                $batch->recalculateTotals();
                // Clear batch cache AFTER recalculation so the next fetch gets fresh data
                Cache::forget('procurement_batches_all');
                Cache::forget('procurement_batches_open');
            }
        }

        $this->logAudit('ARCHIVE', 'Procurement', "Archived procurement #{$id} — {$procurement->sacks} sacks / {$procurement->quantity_kg} kg", [
            'procurement_id' => (int) $id,
        ]);

        return $this->successResponse(
            null,
            'Procurement archived successfully'
        );
    }

    /**
     * Fire-and-forget: send procurement store emails (called from frontend after success).
     */
    public function sendStoreEmail(string $id): JsonResponse
    {
        $procurement = Procurement::with(['supplier', 'variety'])->find($id);
        if (!$procurement) return response()->json(['success' => true]);

        $emailService = $this->emailService;
        dispatch(function () use ($emailService, $procurement) {
            try {
                $emailService->sendProcurementToSupplier($procurement);
                $emailService->sendProcurementToAdmin($procurement);
            } catch (\Throwable $e) { /* silent */ }
        })->afterResponse();

        return response()->json(['success' => true]);
    }

    /**
     * Get procurement statistics
     */
    public function statistics(): JsonResponse
    {
        $stats = $this->procurementService->getStatistics();
        
        return $this->successResponse($stats, 'Statistics retrieved successfully');
    }
}
