<?php

namespace App\Http\Controllers;

use App\Models\Processing;
use App\Services\ProcessingService;
use App\Http\Resources\ProcessingResource;
use App\Traits\ApiResponse;
use App\Traits\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class ProcessingController extends Controller
{
    use ApiResponse, AuditLogger;

    public function __construct(
        private ProcessingService $processingService
    ) {}

    /**
     * Get all processings
     */
    public function index(): JsonResponse
    {
        $processings = $this->processingService->getAllProcessings();
        
        return $this->successResponse(
            ProcessingResource::collection($processings),
            'Processings retrieved successfully'
        );
    }

    /**
     * Get active processings (Pending + Processing)
     */
    public function active(): JsonResponse
    {
        $processings = $this->processingService->getActiveProcessings();
        
        return $this->successResponse(
            ProcessingResource::collection($processings),
            'Active processings retrieved successfully'
        );
    }

    /**
     * Get completed processings
     */
    public function completed(): JsonResponse
    {
        $processings = $this->processingService->getCompletedProcessings();
        
        return $this->successResponse(
            ProcessingResource::collection($processings),
            'Completed processings retrieved successfully'
        );
    }

    /**
     * Get processing statistics
     */
    public function statistics(): JsonResponse
    {
        $stats = $this->processingService->getStatistics();
        
        return $this->successResponse($stats, 'Statistics retrieved successfully');
    }

    /**
     * Store a new processing
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'drying_process_id' => 'nullable|exists:drying_processes,id',
            'drying_process_ids' => 'nullable|array',
            'drying_process_ids.*' => 'exists:drying_processes,id',
            'procurement_id' => 'nullable|exists:procurements,id',
            'input_kg' => 'required|numeric|min:0.01',
            'operator_name' => 'nullable|string|max:255',
            'processing_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        // Validate input_kg against available drying stock
        $validated = $validator->validated();
        $dryingIds = $validated['drying_process_ids'] ?? [];
        if (empty($dryingIds) && !empty($validated['drying_process_id'])) {
            $dryingIds = [$validated['drying_process_id']];
        }
        if (!empty($dryingIds)) {
            $totalAvailable = \App\Models\DryingProcess::whereIn('id', $dryingIds)
                ->get()
                ->sum(fn($s) => max(0, (float)$s->quantity_kg - (float)$s->quantity_out));
            $inputKg = (float) ($validated['input_kg'] ?? 0);
            if ($inputKg > $totalAvailable) {
                return $this->validationErrorResponse(collect([
                    'input_kg' => ["Input ({$inputKg} kg) exceeds available stock ({$totalAvailable} kg) from selected drying sources."]
                ]));
            }
        }

        try {
            $processing = $this->processingService->createProcessing($validated);

            $this->logAudit('CREATE', 'Processing', "Created processing #{$processing->id} — {$processing->input_kg} kg", [
                'processing_id' => $processing->id,
                'input_kg' => $processing->input_kg,
            ]);

            return $this->createdResponse(
                new ProcessingResource($processing),
                'Processing record created successfully'
            );
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to create processing record: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Show a single processing
     */
    public function show(Processing $processing): JsonResponse
    {
        $processing->load([
            'procurement:id,supplier_id,variety_id,quantity_kg,sacks,price_per_kg,total_cost',
            'procurement.supplier:id,name',
            'procurement.variety:id,name,color',
            'dryingProcess',
            'dryingProcess.procurement.supplier',
            'dryingProcess.batch.variety',
            'dryingProcess.batchProcurements.procurement.supplier',
            'dryingProcess.batchProcurements.procurement.variety',
            'dryingSources',
            'dryingSources.batch.variety',
            'dryingSources.procurement.supplier',
            'dryingSources.procurement.variety',
            'dryingSources.batchProcurements.procurement.supplier',
            'dryingSources.batchProcurements.procurement.variety',
        ]);
        
        return $this->successResponse(
            new ProcessingResource($processing),
            'Processing retrieved successfully'
        );
    }

    /**
     * Update a processing
     */
    public function update(Request $request, Processing $processing): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'drying_process_id' => 'nullable|exists:drying_processes,id',
            'procurement_id' => 'nullable|exists:procurements,id',
            'input_kg' => 'sometimes|required|numeric|min:0.01',
            'operator_name' => 'nullable|string|max:255',
            'processing_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        try {
            $processing = $this->processingService->updateProcessing($processing, $validator->validated());

            $this->logAudit('UPDATE', 'Processing', "Updated processing #{$processing->id}", [
                'processing_id' => $processing->id,
                'changes' => $validator->validated(),
            ]);

            return $this->successResponse(
                new ProcessingResource($processing),
                'Processing record updated successfully'
            );
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to update processing record: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Start processing - change status to Processing
     */
    public function process(Processing $processing): JsonResponse
    {
        if ($processing->status !== Processing::STATUS_PENDING) {
            return $this->errorResponse('Only pending records can be started', 422);
        }

        try {
            $processing = $this->processingService->startProcessing($processing);

            $this->logAudit('UPDATE', 'Processing', "Started processing #{$processing->id}", [
                'processing_id' => $processing->id,
                'status' => 'Processing',
            ]);

            return $this->successResponse(
                new ProcessingResource($processing),
                'Processing started'
            );
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to start processing: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Complete processing - set output and finalize
     */
    public function complete(Request $request, Processing $processing): JsonResponse
    {
        if ($processing->status !== Processing::STATUS_PROCESSING) {
            return $this->errorResponse('Only processing records can be completed', 422);
        }

        $validator = Validator::make($request->all(), [
            'output_kg' => 'required|numeric|min:0.01|max:' . $processing->input_kg,
        ], [
            'output_kg.max' => 'Output quantity cannot exceed the input quantity of ' . number_format($processing->input_kg, 2) . ' kg.',
            'output_kg.min' => 'Output quantity must be greater than 0.',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        try {
            $processing = $this->processingService->completeProcessing(
                $processing, 
                (float) $request->output_kg
            );

            $this->logAudit('UPDATE', 'Processing', "Completed processing #{$processing->id} — output {$processing->output_kg} kg", [
                'processing_id' => $processing->id,
                'output_kg' => $processing->output_kg,
                'status' => 'Completed',
            ]);

            return $this->successResponse(
                new ProcessingResource($processing),
                'Processing completed'
            );
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to complete processing: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Return a completed batch back to processing status
     * Only allowed when stock_out is 0 (no stock has been distributed)
     */
    public function returnToProcessing(Processing $processing): JsonResponse
    {
        if ($processing->status !== Processing::STATUS_COMPLETED) {
            return $this->errorResponse('Only completed batches can be returned to processing', 422);
        }

        if ((float)$processing->stock_out > 0) {
            return $this->errorResponse('Cannot return to processing: stock has already been distributed', 422);
        }

        try {
            $processing = $this->processingService->returnToProcessing($processing);

            $this->logAudit('UPDATE', 'Processing', "Returned processing #{$processing->id} back to processing status", [
                'processing_id' => $processing->id,
                'status' => 'Processing',
            ]);

            return $this->successResponse(
                new ProcessingResource($processing),
                'Batch returned to processing'
            );
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to return to processing: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Return processing to drying (soft delete + restore quantity)
     */
    public function destroy(Processing $processing): JsonResponse
    {
        try {
            $processingId = $processing->id;
            $inputKg = $processing->input_kg;
            $this->processingService->deleteProcessing($processing);

            $this->logAudit('RETURN', 'Processing', "Returned processing #{$processingId} to drying — {$inputKg} kg", [
                'processing_id' => $processingId,
                'input_kg' => $inputKg,
            ]);

            return $this->successResponse(null, 'Processing record returned to drying successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to return processing record to drying: ' . $e->getMessage(), 500);
        }
    }
}
