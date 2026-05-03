<?php

namespace App\Http\Controllers;

use App\Models\AuditTrail;
use App\Http\Resources\AuditTrailResource;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditTrailController extends Controller
{
    use ApiResponse;

    /**
     * Get paginated audit trail logs with optional filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditTrail::with('user:id,name,role')
            ->orderBy('created_at', 'desc');

        // Filter by action
        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        // Filter by module
        if ($request->filled('module')) {
            $query->where('module', $request->module);
        }

        // Filter by date range
        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->to);
        }

        // Search
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('module', 'like', "%{$search}%")
                  ->orWhereHas('user', fn($u) => $u->where('name', 'like', "%{$search}%"));
            });
        }

        $logs = $query->limit(min((int) $request->input('limit', 500), 1000))->get();

        return $this->successResponse(
            AuditTrailResource::collection($logs),
            'Audit trail retrieved successfully'
        );
    }

    /**
     * Get a single audit trail entry.
     */
    public function show(AuditTrail $auditTrail): JsonResponse
    {
        $auditTrail->load('user:id,name,role');

        return $this->successResponse(
            new AuditTrailResource($auditTrail),
            'Audit trail entry retrieved successfully'
        );
    }

    /**
     * Get audit trail statistics.
     */
    public function statistics(): JsonResponse
    {
        $today = now()->toDateString();

        // Single query with conditional aggregates instead of 7 separate COUNT queries
        $stats = AuditTrail::selectRaw("
            COUNT(CASE WHEN DATE(created_at) = ? THEN 1 END) as today,
            COUNT(CASE WHEN action = 'CREATE' THEN 1 END) as created,
            COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) as updated,
            COUNT(CASE WHEN action = 'DELETE' THEN 1 END) as deleted,
            COUNT(CASE WHEN action = 'ARCHIVE' THEN 1 END) as archived,
            COUNT(CASE WHEN action = 'RESTORE' THEN 1 END) as restored,
            COUNT(CASE WHEN action IN ('SOFT_DELETE', 'SOFT_DELETE_ALL') THEN 1 END) as soft_deleted
        ", [$today])->first();

        return $this->successResponse($stats, 'Statistics retrieved successfully');
    }
}
