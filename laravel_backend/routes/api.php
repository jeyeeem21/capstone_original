<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Api\AppearanceSettingController;
use App\Http\Controllers\Api\BusinessSettingController;
use App\Http\Controllers\Api\DatabaseBackupController;
use App\Http\Controllers\Api\WebsiteContentController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\DriverController;
use App\Http\Controllers\DriverPortalController;
use App\Http\Controllers\DeliveryAssignmentController;
use App\Http\Controllers\VarietyController;
use App\Http\Controllers\ProcurementController;
use App\Http\Controllers\DryingProcessController;
use App\Http\Controllers\ProcessingController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProcurementBatchController;
use App\Http\Controllers\SaleController;
use App\Http\Controllers\SalesPredictionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ArchiveController;
use App\Http\Controllers\AuditTrailController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\ReportController;

// ========================================
// Public Routes (no auth required)
// ========================================

// Auth Routes
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    // Self-registration (public)
    Route::post('/check-email', [AuthController::class, 'checkEmail']);
    Route::post('/register/send-verification', [AuthController::class, 'registerSendVerification']);
    Route::post('/register/verify-code', [AuthController::class, 'registerVerifyCode']);
    Route::post('/register/complete', [AuthController::class, 'registerComplete']);
    Route::post('/register/cancel', [AuthController::class, 'registerCancel']);
    // Forgot password (public - customers only)
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/forgot-password/verify-code', [AuthController::class, 'forgotPasswordVerifyCode']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

// Staff Email Verification (public - staff need to verify before they can login)
Route::prefix('staff')->group(function () {
    Route::post('/verify-email', [UserController::class, 'verifyStaffEmail']);
    Route::post('/resend-verification', [UserController::class, 'resendStaffVerification']);
});

// Public-facing data (for the public website)
Route::get('/products/featured', [ProductController::class, 'featured']);
Route::get('/products', [ProductController::class, 'index']);
Route::get('/varieties', [VarietyController::class, 'index']);

Route::prefix('appearance')->group(function () {
    Route::get('/', [AppearanceSettingController::class, 'index']);
    Route::get('/all', [AppearanceSettingController::class, 'getAll']);
    Route::get('/grouped', [AppearanceSettingController::class, 'getGrouped']);
});

Route::prefix('website-content')->group(function () {
    Route::get('/', [WebsiteContentController::class, 'getAllContent']);
    Route::get('/home', [WebsiteContentController::class, 'getHomeContent']);
    Route::get('/about', [WebsiteContentController::class, 'getAboutContent']);
    Route::get('/products', [WebsiteContentController::class, 'getProductsContent']);
    Route::get('/contact', [WebsiteContentController::class, 'getContactContent']);
    Route::get('/legal', [WebsiteContentController::class, 'getLegalContent']);
});

Route::prefix('business-settings')->group(function () {
    Route::get('/', [BusinessSettingController::class, 'index']);
});

// Contact form (public)
Route::post('/contact/send', [ContactController::class, 'send']);

// ========================================
// Authenticated Routes (require auth:sanctum)
// ========================================
Route::middleware('auth:sanctum')->group(function () {

    // Offline Sync Routes (PWA)
    Route::prefix('offline')->group(function () {
        Route::post('/process-email', [\App\Http\Controllers\OfflineSyncController::class, 'processEmail']);
    });

    // Dashboard Routes
    Route::prefix('dashboard')->group(function () {
        Route::get('/stats', [DashboardController::class, 'stats']);
        Route::get('/recent-activity', [DashboardController::class, 'recentActivity']);
        Route::post('/refresh', [DashboardController::class, 'refresh']);
    });

    // Auth - authenticated user actions
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/login-email', [AuthController::class, 'sendLoginEmail']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::get('/session-check', [AuthController::class, 'sessionCheck']);
        Route::post('/check-profile-email', [AuthController::class, 'checkProfileEmail']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::post('/verify-email-change', [AuthController::class, 'verifyEmailChange']);
        Route::post('/clear-email-change-pending', [AuthController::class, 'clearEmailChangePending']);
        Route::post('/revert-email-change', [AuthController::class, 'revertEmailChange']);
        Route::put('/password', [AuthController::class, 'updatePassword']);
    });

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Notification Routes
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/read-all', [NotificationController::class, 'markAllAsRead']);
    });

    // Product Routes (GET index is public, defined above)
    Route::prefix('products')->group(function () {
        Route::post('/', [ProductController::class, 'store']);
        Route::get('/{id}', [ProductController::class, 'show']);
        Route::put('/{id}', [ProductController::class, 'update']);
        Route::delete('/{id}', [ProductController::class, 'destroy']);
        Route::post('/{id}/restore', [ProductController::class, 'restore']);
        Route::post('/{id}/stock', [ProductController::class, 'updateStock']);
        Route::get('/{id}/completed-processings', [ProductController::class, 'completedProcessingsByVariety']);
        Route::post('/{id}/distribute-stock', [ProductController::class, 'distributeStock']);
        Route::get('/{id}/cost-analysis', [ProductController::class, 'costAnalysis']);
        Route::get('/{id}/order-history', [ProductController::class, 'orderHistory']);
        Route::post('/{id}/toggle-status', [ProductController::class, 'toggleStatus']);
    });

    Route::get('/stock-logs', [ProductController::class, 'stockLogs']);

    // Sales / POS / Orders Routes
    Route::prefix('sales')->group(function () {
        Route::get('/', [SaleController::class, 'index']);
        Route::get('/my-orders', [SaleController::class, 'myOrders']);
        Route::post('/order', [SaleController::class, 'storeOrder']);
        Route::post('/check-reference', [SaleController::class, 'checkReference']);
        Route::get('/stats', [SaleController::class, 'stats']);
        Route::get('/product-growth', [SaleController::class, 'productGrowth']);
        Route::get('/{id}', [SaleController::class, 'show']);
        Route::post('/{id}/void', [SaleController::class, 'void']);
        Route::put('/{id}/status', [SaleController::class, 'updateStatus']);
        Route::post('/{id}/notify', [SaleController::class, 'sendOrderEmail']);
        Route::post('/{id}/status-email', [SaleController::class, 'sendStatusEmail']);
        Route::post('/{id}/payment-email', [SaleController::class, 'sendPaymentEmail']);
        Route::post('/{id}/return', [SaleController::class, 'processReturn']);
        Route::post('/{id}/return/accept', [SaleController::class, 'acceptReturn']);
        Route::post('/{id}/return/reject', [SaleController::class, 'rejectReturn']);
        Route::post('/{id}/return/complete', [SaleController::class, 'markReturned']);
        Route::post('/{id}/restock', [SaleController::class, 'restockItems']);
        Route::post('/{id}/pay', [SaleController::class, 'markPaid']);
    });

    // Sales Predictive Analysis Routes
    Route::prefix('sales-predictions')->group(function () {
        Route::get('/', [SalesPredictionController::class, 'predictions']);
        Route::post('/refresh', [SalesPredictionController::class, 'refresh']);
    });

    // ========================================
    // Admin + Super Admin Routes
    // ========================================

    // Appearance Settings (write operations) - Admin and Super Admin
    Route::middleware('role:super_admin,admin')->group(function () {
        Route::prefix('appearance')->group(function () {
            Route::put('/', [AppearanceSettingController::class, 'update']);
            Route::put('/{key}', [AppearanceSettingController::class, 'updateSingle']);
            Route::post('/reset', [AppearanceSettingController::class, 'reset']);
        });
    });

    // ========================================
    // Super Admin Only Routes
    // ========================================
    Route::middleware('role:super_admin')->group(function () {

        // Website Content (write operations)
        Route::prefix('website-content')->group(function () {
            Route::post('/home', [WebsiteContentController::class, 'saveHomeContent']);
            Route::post('/about', [WebsiteContentController::class, 'saveAboutContent']);
            Route::post('/products', [WebsiteContentController::class, 'saveProductsContent']);
            Route::post('/contact', [WebsiteContentController::class, 'saveContactContent']);
            // Note: GET /legal is public (defined outside auth middleware)
            Route::post('/legal', [WebsiteContentController::class, 'saveLegalContent']);
            Route::post('/hero-image', [WebsiteContentController::class, 'uploadHeroImage']);
            Route::post('/seed', [WebsiteContentController::class, 'seedDefaults']);
        });

        // Business Settings (write operations)
        Route::prefix('business-settings')->group(function () {
            Route::put('/', [BusinessSettingController::class, 'update']);
            Route::post('/verify-business-email-change', [BusinessSettingController::class, 'verifyBusinessEmailChange']);
            Route::post('/logo', [BusinessSettingController::class, 'uploadLogo']);
            Route::post('/gcash-qr', [BusinessSettingController::class, 'uploadGcashQr']);
            Route::post('/test-email', [BusinessSettingController::class, 'testEmail']);
            Route::post('/check-business-email', [BusinessSettingController::class, 'checkBusinessEmail']);
        });

        // Database Backup Routes
        Route::prefix('database')->group(function () {
            Route::get('/export', [DatabaseBackupController::class, 'export']);
            Route::get('/info', [DatabaseBackupController::class, 'info']);
            Route::get('/export-csv', [DatabaseBackupController::class, 'exportCsv']);
            Route::post('/import-csv', [DatabaseBackupController::class, 'importCsv']);
        });

        // Archive Routes
        Route::prefix('archives')->group(function () {
            Route::get('/', [ArchiveController::class, 'index']);
            Route::get('/statistics', [ArchiveController::class, 'statistics']);
            Route::post('/{module}/{id}/restore', [ArchiveController::class, 'restore']);
            Route::delete('/{module}/{id}', [ArchiveController::class, 'softDelete']);
            Route::delete('/{module}/all/soft-delete', [ArchiveController::class, 'softDeleteAll']);
        });

        // Audit Trail Routes
        Route::prefix('audit-trails')->group(function () {
            Route::get('/', [AuditTrailController::class, 'index']);
            Route::get('/statistics', [AuditTrailController::class, 'statistics']);
            Route::get('/{auditTrail}', [AuditTrailController::class, 'show']);
        });
    });
    Route::prefix('customers')->group(function () {
        Route::get('/', [CustomerController::class, 'index']);
        Route::post('/', [CustomerController::class, 'store']);
        Route::post('/check-email', [CustomerController::class, 'checkEmail']);
        Route::get('/{id}', [CustomerController::class, 'show']);
        Route::put('/{id}', [CustomerController::class, 'update']);
        Route::delete('/{id}', [CustomerController::class, 'destroy']);
        Route::get('/{id}/orders', [CustomerController::class, 'orders']);
        Route::post('/{id}/send-verification', [CustomerController::class, 'sendVerificationCode']);
        Route::post('/{id}/verify-code', [CustomerController::class, 'verifyCode']);
        Route::post('/{id}/create-account', [CustomerController::class, 'createAccount']);
        Route::post('/{id}/store-email', [CustomerController::class, 'sendStoreEmail']);
        Route::post('/{id}/update-email', [CustomerController::class, 'sendUpdateEmail']);
    });

    // Supplier Routes
    Route::prefix('suppliers')->group(function () {
        Route::get('/', [SupplierController::class, 'index']);
        Route::post('/', [SupplierController::class, 'store']);
        Route::post('/check-email', [SupplierController::class, 'checkEmail']);
        Route::get('/{id}', [SupplierController::class, 'show']);
        Route::put('/{id}', [SupplierController::class, 'update']);
        Route::delete('/{id}', [SupplierController::class, 'destroy']);
        Route::get('/{id}/procurements', [SupplierController::class, 'procurements']);
        Route::post('/{id}/store-email', [SupplierController::class, 'sendStoreEmail']);
        Route::post('/{id}/update-email', [SupplierController::class, 'sendUpdateEmail']);
    });

    // Variety Routes (GET index is public, defined above)
    Route::prefix('varieties')->group(function () {
        Route::post('/', [VarietyController::class, 'store']);
        Route::get('/{id}', [VarietyController::class, 'show']);
        Route::put('/{id}', [VarietyController::class, 'update']);
        Route::delete('/{id}', [VarietyController::class, 'destroy']);
    });

    // Procurement Routes
    Route::prefix('procurements')->group(function () {
        Route::get('/', [ProcurementController::class, 'index']);
        Route::get('/statistics', [ProcurementController::class, 'statistics']);
        Route::post('/', [ProcurementController::class, 'store']);
        Route::get('/{id}', [ProcurementController::class, 'show']);
        Route::put('/{id}', [ProcurementController::class, 'update']);
        Route::delete('/{id}', [ProcurementController::class, 'destroy']);
        Route::post('/{id}/store-email', [ProcurementController::class, 'sendStoreEmail']);
    });

    // Drying Process Routes
    Route::prefix('drying-processes')->group(function () {
        Route::get('/', [DryingProcessController::class, 'index']);
        Route::get('/statistics', [DryingProcessController::class, 'statistics']);
        Route::post('/', [DryingProcessController::class, 'store']);
        Route::get('/{dryingProcess}', [DryingProcessController::class, 'show']);
        Route::put('/{dryingProcess}', [DryingProcessController::class, 'update']);
        Route::post('/{dryingProcess}/increment-day', [DryingProcessController::class, 'incrementDay']);
        Route::post('/{dryingProcess}/mark-dried', [DryingProcessController::class, 'markAsDried']);
        Route::post('/{dryingProcess}/postpone', [DryingProcessController::class, 'postpone']);
        Route::delete('/{dryingProcess}', [DryingProcessController::class, 'destroy']);
    });

    // Procurement Batch Routes
    Route::prefix('procurement-batches')->group(function () {
        Route::get('/', [ProcurementBatchController::class, 'index']);
        Route::get('/open', [ProcurementBatchController::class, 'open']);
        Route::post('/', [ProcurementBatchController::class, 'store']);
        Route::get('/{id}', [ProcurementBatchController::class, 'show']);
        Route::put('/{id}', [ProcurementBatchController::class, 'update']);
        Route::delete('/{id}', [ProcurementBatchController::class, 'destroy']);
        Route::post('/{batchId}/assign/{procurementId}', [ProcurementBatchController::class, 'assignProcurement']);
        Route::delete('/remove-procurement/{procurementId}', [ProcurementBatchController::class, 'removeProcurement']);
        Route::get('/{batchId}/drying-distribution', [ProcurementBatchController::class, 'dryingDistribution']);
    });

    // Processing Routes
    Route::prefix('processings')->group(function () {
        Route::get('/', [ProcessingController::class, 'index']);
        Route::get('/active', [ProcessingController::class, 'active']);
        Route::get('/completed', [ProcessingController::class, 'completed']);
        Route::get('/statistics', [ProcessingController::class, 'statistics']);
        Route::post('/', [ProcessingController::class, 'store']);
        Route::get('/{processing}', [ProcessingController::class, 'show']);
        Route::put('/{processing}', [ProcessingController::class, 'update']);
        Route::post('/{processing}/process', [ProcessingController::class, 'process']);
        Route::post('/{processing}/complete', [ProcessingController::class, 'complete']);
        Route::post('/{processing}/return-to-processing', [ProcessingController::class, 'returnToProcessing']);
        Route::delete('/{processing}', [ProcessingController::class, 'destroy']);
    });

    // Driver Portal Routes (for logged-in driver users)
    Route::prefix('driver-portal')->group(function () {
        Route::get('/dashboard', [DriverPortalController::class, 'dashboard']);
        Route::get('/my-deliveries', [DriverPortalController::class, 'myDeliveries']);
        Route::post('/orders/{id}/status', [DriverPortalController::class, 'updateOrderStatus']);
        Route::post('/orders/{id}/pay', [DriverPortalController::class, 'markOrderPaid']);
    });

    // Driver Routes
    Route::prefix('drivers')->group(function () {
        Route::get('/', [DriverController::class, 'index']);
        Route::get('/statistics', [DriverController::class, 'statistics']);
        Route::post('/', [DriverController::class, 'store']);
        Route::get('/{id}', [DriverController::class, 'show']);
        Route::put('/{id}', [DriverController::class, 'update']);
        Route::delete('/{id}', [DriverController::class, 'destroy']);
    });

    // Delivery Assignment Routes
    Route::prefix('deliveries')->group(function () {
        Route::get('/', [DeliveryAssignmentController::class, 'index']);
        Route::get('/statistics', [DeliveryAssignmentController::class, 'statistics']);
        Route::post('/', [DeliveryAssignmentController::class, 'store']);
        Route::get('/driver/{driverId}', [DeliveryAssignmentController::class, 'byDriver']);
        Route::get('/{id}', [DeliveryAssignmentController::class, 'show']);
        Route::put('/{id}', [DeliveryAssignmentController::class, 'update']);
        Route::post('/{id}/status', [DeliveryAssignmentController::class, 'updateStatus']);
        Route::delete('/{id}', [DeliveryAssignmentController::class, 'destroy']);
    });

    // User Management Routes
    Route::prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index']);
        Route::get('/statistics', [UserController::class, 'statistics']);
        Route::post('/check-email', [UserController::class, 'checkEmail']);
        Route::post('/send-verification', [UserController::class, 'sendVerificationCode']);
        Route::post('/verify-code', [UserController::class, 'verifyEmailCode']);
        Route::post('/staff/{id}/verify-email', [UserController::class, 'verifyStaffEmailByAdmin']);
        Route::post('/staff/{id}/resend-verification', [UserController::class, 'resendStaffVerificationByAdmin']);
        Route::post('/', [UserController::class, 'store']);
        Route::get('/{id}', [UserController::class, 'show']);
        Route::put('/{id}', [UserController::class, 'update']);
        Route::delete('/{id}', [UserController::class, 'destroy']);
        Route::post('/{id}/welcome-email', [UserController::class, 'sendWelcomeEmailEndpoint']);
        Route::post('/{id}/update-email', [UserController::class, 'sendUpdateEmail']);
    });

    // Reports Routes (admin + super_admin)
    Route::prefix('reports')->group(function () {
        Route::get('/profit-loss', [ReportController::class, 'profitLoss']);
        Route::get('/sales-summary', [ReportController::class, 'salesSummary']);
        Route::get('/procurement-cost', [ReportController::class, 'procurementCost']);
        Route::get('/drying-cost', [ReportController::class, 'dryingCost']);
        Route::get('/processing-yield', [ReportController::class, 'processingYield']);
        Route::get('/inventory-valuation', [ReportController::class, 'inventoryValuation']);
    });
});
