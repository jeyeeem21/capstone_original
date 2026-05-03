<?php

namespace App\Traits;

use App\Models\AuditTrail;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;
use Carbon\Carbon;

trait AuditLogger
{
    /**
     * Log an audit trail entry.
     *
     * @param string      $action      CREATE, UPDATE, DELETE, LOGIN, LOGOUT, RETURN, etc.
     * @param string      $module      Module name (Procurement, Drying, Products, etc.)
     * @param string      $description Human-readable description
     * @param array|null  $details     Extra context (old/new values, etc.)
     */
    protected function logAudit(string $action, string $module, string $description, ?array $details = null): AuditTrail
    {
        // If the request came from offline sync, use the original action timestamp
        $performedAt = Request::input('_offline_performed_at');
        $createdAt = null;
        if ($performedAt) {
            try {
                $createdAt = Carbon::parse($performedAt);
            } catch (\Exception $e) {
                $createdAt = null;
            }
        }

        $audit = AuditTrail::create([
            'user_id'    => Auth::id(),
            'action'     => strtoupper($action),
            'module'     => $module,
            'description'=> $description,
            'details'    => $details,
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
        ]);

        // Override created_at with the actual offline action time
        if ($createdAt) {
            $audit->update(['created_at' => $createdAt]);
        }

        return $audit;
    }
}
