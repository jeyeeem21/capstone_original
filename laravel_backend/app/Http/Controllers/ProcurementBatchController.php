<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProcurementBatchResource;
use App\Models\Procurement;
use App\Models\ProcurementBatch;
use App\Services\ProcurementBatchService;
use App\Traits\ApiResponse;
use App\Traits\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class ProcurementBatchController extends Controller
{
    use ApiResponse, AuditLogger;

    public function __construct(private readonly ProcurementBatchService $service) {}

    /** GET /api/procurement-batches */
    public function index(): JsonResponse
    {
        try {
            $batches = $this->service->getAllBatches();
            return $this->successResponse(ProcurementBatchResource::collection($batches));
        } catch (Throwable $e) {
            return $this->errorResponse('Failed to fetch batches: ' . $e->getMessage(), 500);
        }
    }

    /** GET /api/procurement-batches/open  – for dropdowns */
    public function open(): JsonResponse
    {
        try {
            $batches = $this->service->getOpenBatches();
            return $this->successResponse(ProcurementBatchResource::collection($batches));
        } catch (Throwable $e) {
            return $this->errorResponse('Failed to fetch open batches: ' . $e->getMessage(), 500);
        }
    }

    /** GET /api/procurement-batches/{id} */
    public function show(int $id): JsonResponse
    {
        try {
            $batch = $this->service->getBatchById($id);
            return $this->successResponse(new ProcurementBatchResource($batch));
        } catch (Throwable $e) {
            return $this->errorResponse('Batch not found: ' . $e->getMessage(), 404);
        }
    }

    /** POST /api/procurement-batches */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'variety_id'  => 'required|integer|exists:varieties,id',
            'season_date' => 'nullable|date',
            'notes'       => 'nullable|string|max:1000',
        ]);

        try {
            $batch = $this->service->createBatch($data);
            $batch->load('variety');

            $this->logAudit('CREATE', 'Procurement Batches', "Created procurement batch {$batch->batch_number}", [
                'batch_id'     => $batch->id,
                'batch_number' => $batch->batch_number,
                'variety_id'   => $batch->variety_id,
                'variety_name' => $batch->variety?->name,
                'season_date'  => $batch->season_date,
                'notes'        => $batch->notes,
            ]);

            return $this->createdResponse(new ProcurementBatchResource($batch), 'Batch created successfully');
        } catch (Throwable $e) {
            return $this->errorResponse('Failed to create batch: ' . $e->getMessage(), 500);
        }
    }

    /** PUT /api/procurement-batches/{id} */
    public function update(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'variety_id'  => 'sometimes|integer|exists:varieties,id',
            'season_date' => 'nullable|date',
            'notes'       => 'nullable|string|max:1000',
            'status'      => 'sometimes|in:Open,Closed,Completed',
        ]);

        try {
            $batch = ProcurementBatch::findOrFail($id);
            $oldValues = $batch->only(['variety_id', 'season_date', 'notes', 'status']);
            $batch = $this->service->updateBatch($batch, $data);

            $this->logAudit('UPDATE', 'Procurement Batches', "Updated procurement batch {$batch->batch_number}", [
                'batch_id'     => $batch->id,
                'batch_number' => $batch->batch_number,
                'old_values'   => $oldValues,
                'new_values'   => $batch->only(['variety_id', 'season_date', 'notes', 'status']),
            ]);

            return $this->successResponse(new ProcurementBatchResource($batch));
        } catch (Throwable $e) {
            return $this->errorResponse('Failed to update batch: ' . $e->getMessage(), 500);
        }
    }

    /** DELETE /api/procurement-batches/{id} */
    public function destroy(int $id): JsonResponse
    {
        try {
            $batch = ProcurementBatch::findOrFail($id);

            $this->logAudit('DELETE', 'Procurement Batches', "Deleted procurement batch {$batch->batch_number}", [
                'batch_id'     => $batch->id,
                'batch_number' => $batch->batch_number,
                'variety_id'   => $batch->variety_id,
                'status'       => $batch->status,
            ]);

            $this->service->deleteBatch($batch);
            return $this->successResponse(['message' => 'Batch deleted successfully']);
        } catch (Throwable $e) {
            return $this->errorResponse($e->getMessage(), 422);
        }
    }

    /** POST /api/procurement-batches/{batchId}/assign/{procurementId} */
    public function assignProcurement(int $batchId, int $procurementId): JsonResponse
    {
        try {
            $batch = ProcurementBatch::findOrFail($batchId);
            $procurement = Procurement::findOrFail($procurementId);
            $this->service->assignProcurement($batch, $procurement);

            $this->logAudit('UPDATE', 'Procurement Batches', "Assigned procurement #{$procurementId} to batch #{$batchId}", [
                'batch_id' => $batchId,
                'procurement_id' => $procurementId,
            ]);

            // Reload batch with relations for response
            $batch = $this->service->getBatchById($batchId);
            return $this->successResponse(new ProcurementBatchResource($batch));
        } catch (Throwable $e) {
            return $this->errorResponse($e->getMessage(), 422);
        }
    }

    /** DELETE /api/procurement-batches/remove-procurement/{procurementId} */
    public function removeProcurement(int $procurementId): JsonResponse
    {
        try {
            $procurement = Procurement::findOrFail($procurementId);
            $batchId = $procurement->batch_id;

            $this->logAudit('UPDATE', 'Procurement Batches', "Removed procurement #{$procurementId} from batch #{$batchId}", [
                'batch_id' => $batchId,
                'procurement_id' => $procurementId,
            ]);

            $this->service->removeProcurement($procurement);
            return $this->successResponse(['message' => 'Procurement removed from batch successfully']);
        } catch (Throwable $e) {
            return $this->errorResponse($e->getMessage(), 422);
        }
    }

    /**
     * GET /api/procurement-batches/{batchId}/drying-distribution?sacks=X
     * Returns proportional distribution preview before committing.
     */
    public function dryingDistribution(Request $request, int $batchId): JsonResponse
    {
        $request->validate([
            'sacks' => 'required|integer|min:1',
        ]);

        try {
            $batch = $this->service->getBatchById($batchId);
            $result = $this->service->calculateDryingDistribution($batch, (int) $request->sacks);
            return $this->successResponse($result);
        } catch (Throwable $e) {
            return $this->errorResponse($e->getMessage(), 422);
        }
    }
}
