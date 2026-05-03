<?php

namespace App\Http\Controllers;

use App\Models\DryingProcess;
use App\Services\DryingProcessService;
use App\Http\Resources\DryingProcessResource;
use App\Traits\ApiResponse;
use App\Traits\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class DryingProcessController extends Controller
{
    use ApiResponse, AuditLogger;

    public function __construct(
        private DryingProcessService $dryingProcessService
    ) {}

    /**
     * Get all drying processes
     */
    public function index(): JsonResponse
    {
        $dryingProcesses = $this->dryingProcessService->getAllDryingProcesses();

        return $this->successResponse(
            DryingProcessResource::collection($dryingProcesses),
            'Drying processes retrieved successfully'
        );
    }

    /**
     * Get statistics
     */
    public function statistics(): JsonResponse
    {
        $stats = $this->dryingProcessService->getStatistics();

        return $this->successResponse($stats, 'Statistics retrieved successfully');
    }

    /**
     * Store a new drying process.
     * Accepts EITHER (a) procurement_id + price  OR  (b) batch_id + sacks + price
     */
    public function store(Request $request): JsonResponse
    {
        $isBatch = $request->filled('batch_id');

        if ($isBatch) {
            $batch = \App\Models\ProcurementBatch::find($request->input('batch_id'));
            $maxSacks = $batch ? $batch->remaining_sacks : 99999;
            $validator = Validator::make($request->all(), [
                'batch_id' => 'required|integer|exists:procurement_batches,id',
                'sacks'    => "required|integer|min:1|max:{$maxSacks}",
                'price'    => 'required|numeric|min:0',
            ], [
                'sacks.max' => "Cannot exceed {$maxSacks} available sacks in this batch.",
            ]);
        } else {
            $validator = Validator::make($request->all(), [
                'procurement_id' => 'required|exists:procurements,id',
                'sacks'          => 'nullable|integer|min:1',
                'price'          => 'required|numeric|min:0',
            ]);
        }

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        try {
            $drying = $this->dryingProcessService->createDryingProcess($validator->validated());

            $this->logAudit('CREATE', 'Drying', "Created drying process #{$drying->id} — {$drying->sacks} sacks / {$drying->quantity_kg} kg", [
                'drying_id' => $drying->id,
                'procurement_id' => $drying->procurement_id,
                'batch_id' => $drying->batch_id,
                'sacks' => $drying->sacks,
                'quantity_kg' => $drying->quantity_kg,
            ]);

            return $this->createdResponse(
                new DryingProcessResource($drying),
                'Drying process created successfully'
            );
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to create drying process: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Show a single drying process
     */
    public function show(DryingProcess $dryingProcess): JsonResponse
    {
        $dryingProcess->load([
            'procurement.supplier',
            'procurement.variety',
            'batch:id,batch_number,status',
            'batchProcurements.procurement.supplier:id,name',
        ]);

        return $this->successResponse(
            new DryingProcessResource($dryingProcess),
            'Drying process retrieved successfully'
        );
    }

    /**
     * Update a drying process
     */
    public function update(Request $request, DryingProcess $dryingProcess): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'price' => 'sometimes|required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        try {
            $drying = $this->dryingProcessService->updateDryingProcess($dryingProcess, $validator->validated());

            $this->logAudit('UPDATE', 'Drying', "Updated drying process #{$drying->id}", [
                'drying_id' => $drying->id,
                'changes' => $validator->validated(),
            ]);

            return $this->successResponse(
                new DryingProcessResource($drying),
                'Drying process updated successfully'
            );
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to update drying process: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Increment day (+1)
     */
    public function incrementDay(DryingProcess $dryingProcess): JsonResponse
    {
        try {
            $drying = $this->dryingProcessService->incrementDay($dryingProcess);

            $this->logAudit('UPDATE', 'Drying', "Incremented day on drying #{$drying->id} to day {$drying->days}", [
                'drying_id' => $drying->id,
                'days' => $drying->days,
            ]);

            return $this->successResponse(
                new DryingProcessResource($drying),
                'Day incremented successfully'
            );
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to increment day: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Mark as dried (✓ action)
     */
    public function markAsDried(DryingProcess $dryingProcess): JsonResponse
    {
        try {
            $drying = $this->dryingProcessService->markAsDried($dryingProcess);

            $this->logAudit('UPDATE', 'Drying', "Marked drying #{$drying->id} as dried — {$drying->sacks} sacks", [
                'drying_id' => $drying->id,
                'status' => 'Dried',
            ]);

            return $this->successResponse(
                new DryingProcessResource($drying),
                'Marked as dried successfully'
            );
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to mark as dried: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Postpone a drying process
     */
    public function postpone(DryingProcess $dryingProcess): JsonResponse
    {
        try {
            $drying = $this->dryingProcessService->postponeDryingProcess($dryingProcess);

            $this->logAudit('UPDATE', 'Drying', "Postponed drying #{$drying->id}", [
                'drying_id' => $drying->id,
                'status' => 'Postponed',
            ]);

            return $this->successResponse(
                new DryingProcessResource($drying),
                'Drying process postponed successfully'
            );
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to postpone drying process: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Delete a drying process (soft delete)
     */
    public function destroy(DryingProcess $dryingProcess): JsonResponse
    {
        try {
            $dryingId = $dryingProcess->id;
            $dryingSacks = $dryingProcess->sacks;
            $dryingKg = $dryingProcess->quantity_kg;

            $this->dryingProcessService->deleteDryingProcess($dryingProcess);

            $this->logAudit('RETURN', 'Drying', "Returned drying #{$dryingId} to procurement — {$dryingSacks} sacks / {$dryingKg} kg", [
                'drying_id' => $dryingId,
                'sacks' => $dryingSacks,
                'quantity_kg' => $dryingKg,
            ]);

            return $this->successResponse(null, 'Drying process returned to procurement successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to return drying process: ' . $e->getMessage(), 500);
        }
    }
}
