<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Traits\ApiResponse;
use App\Traits\AuditLogger;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\Customer;
use App\Models\Procurement;
use App\Models\Processing;
use App\Models\DryingProcess;
use App\Models\Variety;
use App\Models\Driver;
use App\Models\DeliveryAssignment;
use App\Models\ProcurementBatch;
use App\Models\User;
use App\Models\AuditTrail;
use App\Services\DashboardService;
use Illuminate\Support\Facades\Cache;

class ArchiveController extends Controller
{
    use ApiResponse, AuditLogger;

    /**
     * Map of module names to their model classes and display configuration.
     */
    private function getModuleConfig(): array
    {
        return [
            'products' => [
                'model' => Product::class,
                'label' => 'Product',
                'nameField' => 'product_name',
                'idField' => 'product_id',
                'usesCustomSoftDelete' => true,
                'auditModule' => 'Products',
                'auditAction' => 'ARCHIVE',
                'auditDetailKey' => 'product_id',
            ],
            'varieties' => [
                'model' => Variety::class,
                'label' => 'Variety',
                'nameField' => 'name',
                'idField' => 'id',
                'auditModule' => 'Varieties',
                'auditAction' => 'ARCHIVE',
                'auditDetailKey' => 'variety_id',
            ],
            'suppliers' => [
                'model' => Supplier::class,
                'label' => 'Supplier',
                'nameField' => 'name',
                'idField' => 'id',
                'auditModule' => 'Supplier',
                'auditAction' => 'ARCHIVE',
                'auditDetailKey' => 'supplier_id',
            ],
            'customers' => [
                'model' => Customer::class,
                'label' => 'Customer',
                'nameField' => 'name',
                'idField' => 'id',
                'auditModule' => 'Customer',
                'auditAction' => 'ARCHIVE',
                'auditDetailKey' => 'customer_id',
            ],
            'procurements' => [
                'model' => Procurement::class,
                'label' => 'Procurement',
                'nameField' => 'supplier_name',
                'idField' => 'id',
                'auditModule' => 'Procurement',
                'auditAction' => 'ARCHIVE',
                'auditDetailKey' => 'procurement_id',
            ],
            'drying_processes' => [
                'model' => DryingProcess::class,
                'label' => 'Drying Process',
                'nameField' => null,
                'idField' => 'id',
                'auditModule' => 'Drying',
                'auditAction' => 'RETURN',
                'auditDetailKey' => 'drying_id',
            ],
            'processings' => [
                'model' => Processing::class,
                'label' => 'Processing',
                'nameField' => null,
                'idField' => 'id',
                'auditModule' => 'Processing',
                'auditAction' => 'ARCHIVE',
                'auditDetailKey' => 'processing_id',
            ],
            'drivers' => [
                'model' => Driver::class,
                'label' => 'Driver',
                'nameField' => 'name',
                'idField' => 'id',
                'auditModule' => 'Drivers',
                'auditAction' => 'ARCHIVE',
                'auditDetailKey' => 'driver_id',
            ],
            'deliveries' => [
                'model' => DeliveryAssignment::class,
                'label' => 'Delivery',
                'nameField' => null,
                'idField' => 'id',
                'auditModule' => 'Deliveries',
                'auditAction' => 'ARCHIVE',
                'auditDetailKey' => 'delivery_id',
            ],
            'users' => [
                'model' => User::class,
                'label' => 'User',
                'nameField' => 'name',
                'idField' => 'id',
                'auditModule' => 'Users',
                'auditAction' => 'ARCHIVE',
                'auditDetailKey' => 'user_id',
            ],
        ];
    }

    /**
     * Get all archived records across all modules.
     * Tier 1: is_archived = true (visible in archive page).
     */
    public function index(): JsonResponse
    {
        try {
        $modules = $this->getModuleConfig();
        $archives = [];

        // Relations to eager-load per module for the detailed view
        $moduleRelations = [
            'procurements' => ['supplier', 'variety', 'batch'],
            'products' => ['variety'],
            'processings' => ['procurement', 'dryingProcess', 'dryingSources'],
            'drying_processes' => ['procurement', 'batch'],
            'deliveries' => ['driver', 'customer', 'items'],
        ];

        foreach ($modules as $key => $config) {
            try {
                $modelClass = $config['model'];

            // Use onlyArchived scope (bypasses notArchived global scope,
            // but SoftDeletes / notDeleted scopes still apply so
            // tier-2-deleted records are excluded automatically).
            $query = $modelClass::onlyArchived();

            // Eager-load relations if configured
            if (isset($moduleRelations[$key])) {
                $query->with($moduleRelations[$key]);
            }

            $records = $query->get();

            foreach ($records as $record) {
                $idField = $config['idField'];
                $nameField = $config['nameField'];
                $name = $nameField ? ($record->{$nameField} ?? null) : null;

                // Generate a display name for records without a name field
                if (!$name) {
                    $name = $config['label'] . ' #' . str_pad($record->{$idField}, 4, '0', STR_PAD_LEFT);
                }

                $deletedAt = $record->archived_at
                    ? \Carbon\Carbon::parse($record->archived_at)
                    : $record->updated_at;

                // Build record data with relationship names resolved
                $recordData = $record->toArray();
                // Add resolved names for related models
                if ($key === 'procurements') {
                    $recordData['supplier_name'] = $record->supplier?->name ?? '—';
                    $recordData['variety_name'] = $record->variety?->name ?? '—';
                    $recordData['batch_number'] = $record->batch?->batch_number ?? null;
                    $recordData['batch_status'] = $record->batch?->status ?? null;
                } elseif ($key === 'products') {
                    $recordData['variety_name'] = $record->variety?->name ?? '—';
                    $recordData['price_formatted'] = '₱' . number_format((float)$record->price, 2);
                    $recordData['weight_formatted'] = $record->weight ? $record->weight . ' kg' : '—';
                } elseif ($key === 'processings') {
                    $recordData['supplier_name'] = $record->procurement?->supplier?->name ?? '—';
                    $recordData['procurement_batch'] = $record->procurement?->batch?->batch_number ?? null;
                } elseif ($key === 'drying_processes') {
                    $recordData['supplier_name'] = $record->procurement?->supplier?->name ?? '—';
                    $recordData['batch_number'] = $record->batch?->batch_number ?? null;
                } elseif ($key === 'deliveries') {
                    $recordData['driver_name'] = $record->driver?->name ?? '—';
                    $recordData['customer_name'] = $record->customer?->name ?? '—';
                    $recordData['items_count'] = $record->items?->count() ?? 0;
                } elseif ($key === 'users') {
                    $recordData['role_label'] = ucwords(str_replace('_', ' ', $record->role ?? ''));
                    $recordData['position'] = $record->position;
                    $recordData['email'] = $record->email;
                    // Hide sensitive fields
                    unset($recordData['password'], $recordData['remember_token'], $recordData['two_factor_secret'], $recordData['two_factor_recovery_codes']);
                }

                $archives[] = [
                    'id' => $record->{$idField},
                    'module' => $key,
                    'module_label' => $config['label'],
                    'name' => $name,
                    'deleted_at' => $deletedAt?->format('M d, Y h:i A'),
                    'deleted_at_raw' => $deletedAt?->toISOString(),
                    'archived_by' => null, // Filled from audit trail below
                    'record_data' => $recordData,
                ];
            }
            } catch (\Exception $e) {
                // Skip modules that error (e.g. missing table)
                continue;
            }
        }

        // Attach "archived by" from audit trail
        $archivedByLookup = $this->buildArchivedByLookup($modules);
        foreach ($archives as &$archive) {
            $lookupKey = $archive['module'] . ':' . $archive['id'];
            $archive['archived_by'] = $archivedByLookup[$lookupKey] ?? null;
        }
        unset($archive);

        // Sort by deleted_at descending (most recent first)
        usort($archives, function ($a, $b) {
            return strcmp($b['deleted_at_raw'] ?? '', $a['deleted_at_raw'] ?? '');
        });

        return $this->successResponse($archives, 'Archives retrieved successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to fetch archives: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get archive statistics (count per module).
     */
    public function statistics(): JsonResponse
    {
        try {
        $modules = $this->getModuleConfig();
        $stats = [];
        $total = 0;

        foreach ($modules as $key => $config) {
            try {
            $modelClass = $config['model'];

            $count = $modelClass::onlyArchived()->count();

            if ($count > 0) {
                $stats[] = [
                    'module' => $key,
                    'label' => $config['label'],
                    'count' => $count,
                ];
            }

            $total += $count;
            } catch (\Exception $e) {
                continue;
            }
        }

        return $this->successResponse([
            'total' => $total,
            'by_module' => $stats,
        ], 'Archive statistics retrieved successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to fetch archive statistics: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Restore an archived record (move back to main page).
     */
    public function restore(string $module, string $id): JsonResponse
    {
        $modules = $this->getModuleConfig();

        if (!isset($modules[$module])) {
            return $this->errorResponse('Invalid module', 404);
        }

        $config = $modules[$module];
        $modelClass = $config['model'];
        $idField = $config['idField'];

        try {
            $record = $modelClass::onlyArchived()->where($idField, $id)->firstOrFail();

            // Restore status to Active for models that set it to Inactive on archive
            if (in_array($module, ['varieties', 'suppliers', 'customers', 'users'])) {
                $record->status = 'active';
                if (in_array($module, ['varieties', 'suppliers', 'customers'])) {
                    $record->status = 'Active';
                }
            }
            if ($module === 'procurements') {
                $record->status = 'Pending';
            }

            $record->unarchive();

            // Recalculate batch totals when restoring a procurement
            if ($module === 'procurements' && $record->batch_id) {
                $batch = \App\Models\ProcurementBatch::find($record->batch_id);
                if ($batch) {
                    $batch->recalculateTotals();
                }
            }

            // Clear relevant caches
            $this->clearModuleCache($module);

            $nameField = $config['nameField'];
            $name = $nameField ? ($record->{$nameField} ?? $config['label']) : $config['label'] . ' #' . str_pad($id, 4, '0', STR_PAD_LEFT);

            $this->logAudit('RESTORE', 'Archives', "Restored {$config['label']}: {$name}", [
                'module' => $module,
                'record_id' => $id,
            ]);

            return $this->successResponse(null, "{$name} has been restored successfully");
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Archived record not found', 404);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to restore: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Soft-delete an archived record (Tier 2).
     * The record disappears from the archive page but remains in the database.
     */
    public function softDelete(string $module, string $id): JsonResponse
    {
        $modules = $this->getModuleConfig();

        if (!isset($modules[$module])) {
            return $this->errorResponse('Invalid module', 404);
        }

        $config = $modules[$module];
        $modelClass = $config['model'];
        $usesCustom = $config['usesCustomSoftDelete'] ?? false;
        $idField = $config['idField'];

        try {
            $record = $modelClass::onlyArchived()->where($idField, $id)->firstOrFail();

            $nameField = $config['nameField'];
            $name = $nameField ? ($record->{$nameField} ?? $config['label']) : $config['label'] . ' #' . str_pad($id, 4, '0', STR_PAD_LEFT);

            // Capture batch_id before deleting (for procurement batch recalc)
            $batchId = ($module === 'procurements') ? $record->batch_id : null;

            if ($usesCustom) {
                $record->softDelete(); // Product's custom method — sets is_deleted = true
            } else {
                $record->delete(); // SoftDeletes — sets deleted_at
            }

            // Recalculate batch totals when soft-deleting a procurement
            if ($batchId) {
                $batch = \App\Models\ProcurementBatch::find($batchId);
                if ($batch) {
                    $batch->recalculateTotals();
                }
            }

            // Clear relevant caches
            $this->clearModuleCache($module);

            $this->logAudit('SOFT_DELETE', 'Archives', "Soft deleted {$config['label']}: {$name}", [
                'module' => $module,
                'record_id' => $id,
            ]);

            return $this->successResponse(null, "{$name} has been soft deleted. It remains in the database.");
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Archived record not found', 404);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to soft delete: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Soft-delete ALL archived records for a given module (Tier 2).
     */
    public function softDeleteAll(string $module): JsonResponse
    {
        $modules = $this->getModuleConfig();

        if (!isset($modules[$module])) {
            return $this->errorResponse('Invalid module', 404);
        }

        $config = $modules[$module];
        $modelClass = $config['model'];
        $usesCustom = $config['usesCustomSoftDelete'] ?? false;

        try {
            $records = $modelClass::onlyArchived()->get();
            $count = $records->count();

            if ($count === 0) {
                return $this->errorResponse('No archived records to delete', 404);
            }

            // Collect batch IDs that need recalculation (for procurements)
            $batchIds = [];
            if ($module === 'procurements') {
                $batchIds = $records->pluck('batch_id')->filter()->unique()->toArray();
            }

            foreach ($records as $record) {
                if ($usesCustom) {
                    $record->softDelete();
                } else {
                    $record->delete();
                }
            }

            // Recalculate batch totals for any affected batches
            if (!empty($batchIds)) {
                foreach ($batchIds as $batchId) {
                    $batch = \App\Models\ProcurementBatch::find($batchId);
                    if ($batch) {
                        $batch->recalculateTotals();
                    }
                }
            }

            $this->clearModuleCache($module);

            $this->logAudit('SOFT_DELETE_ALL', 'Archives', "Soft deleted all {$count} archived {$config['label']} records", [
                'module' => $module,
                'count' => $count,
            ]);

            return $this->successResponse(null, "{$count} archived {$config['label']} record(s) soft deleted.");
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to soft delete: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Build a lookup of "archived by" user names from the audit trail.
     * Returns an array keyed by "moduleKey:recordId" => userName.
     */
    private function buildArchivedByLookup(array $modules): array
    {
        // Map audit module names to archive module keys and detail keys
        $auditModuleMap = [];
        $auditActions = [];

        foreach ($modules as $key => $config) {
            $auditModule = $config['auditModule'] ?? null;
            if ($auditModule) {
                $auditModuleMap[$auditModule] = [
                    'moduleKey' => $key,
                    'detailKey' => $config['auditDetailKey'],
                ];
                $auditActions[] = $config['auditAction'];
            }
        }

        // Single query: get all relevant audit entries with user (limited)
        $entries = AuditTrail::with('user:id,name')
            ->whereIn('module', array_keys($auditModuleMap))
            ->whereIn('action', array_unique($auditActions))
            ->orderBy('created_at', 'desc')
            ->limit(2000)
            ->get();

        $lookup = [];
        foreach ($entries as $entry) {
            $mapping = $auditModuleMap[$entry->module] ?? null;
            if (!$mapping || !$entry->details) continue;

            $recordId = $entry->details[$mapping['detailKey']] ?? null;
            if (!$recordId) continue;

            $lookupKey = $mapping['moduleKey'] . ':' . $recordId;
            // Only keep the most recent (first encountered due to desc order)
            if (!isset($lookup[$lookupKey])) {
                $lookup[$lookupKey] = $entry->user?->name ?? 'Unknown';
            }
        }

        return $lookup;
    }

    /**
     * Clear cache for a specific module.
     */
    private function clearModuleCache(string $module): void
    {
        $cacheKeys = [
            'products' => 'products_all',
            'varieties' => 'varieties_all',
            'suppliers' => 'suppliers_all',
            'customers' => 'customers_all',
            'procurements' => 'procurements_all',
            'drying_processes' => 'drying_processes_all',
            'processings' => 'processings_all',
            'drivers' => 'drivers_all',
            'deliveries' => 'delivery_assignments_all',
            'users' => 'users_all',
        ];

        if (isset($cacheKeys[$module])) {
            Cache::forget($cacheKeys[$module]);
        }

        // Also clear related caches for modules with cross-dependencies
        if (in_array($module, ['procurements', 'drying_processes'])) {
            Cache::forget('procurement_batches_all');
            Cache::forget('procurement_batches_open');
        }
        if ($module === 'processings') {
            Cache::forget('procurements_all');
            Cache::forget('drying_processes_all');
        }
        if ($module === 'products') {
            Cache::forget('products_featured');
            Cache::forget('varieties_all');
        }

        // Always clear dashboard stats cache so counts/sums update immediately
        DashboardService::clearStatsCache();
    }
}
