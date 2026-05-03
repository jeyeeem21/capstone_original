# Laravel Backend — Full Architecture Documentation

> **Project:** KJP Ricemill Capstone  
> **Framework:** Laravel 11+ with Sanctum, Fortify, Inertia.js  
> **Backend Path:** `laravel_backend/`  
> **Database:** MySQL  
> **Auth:** Sanctum (API tokens) + Fortify (2FA, login views, password reset)  
> **Frontend Integration:** Inertia.js SSR (Vue/React), plus standalone REST API

---

## Table of Contents

1. [Routes](#1-routes)
2. [Controllers](#2-controllers)
3. [Services](#3-services)
4. [Models](#4-models)
5. [API Resources](#5-api-resources)
6. [Middleware](#6-middleware)
7. [Requests (Form Requests)](#7-requests-form-requests)
8. [Traits](#8-traits)
9. [Concerns](#9-concerns)
10. [Providers](#10-providers)
11. [Architecture Patterns & Cross-Cutting Concerns](#11-architecture-patterns--cross-cutting-concerns)

---

## 1. Routes

### 1.1 `routes/api.php`

The main API file (~240 lines). All routes return JSON. Grouped under `sanctum` middleware unless marked public.

#### Public Endpoints (No Auth)

| Method | URI | Controller | Action |
|--------|-----|-----------|--------|
| POST | `/auth/login` | `AuthController` | `login` |
| GET | `/products/featured` | `Api\ProductController` | `featured` |
| GET | `/products/varieties` | `Api\ProductController` | `varieties` |
| GET | `/products` | `Api\ProductController` | `index` |
| GET | `/products/{id}` | `Api\ProductController` | `show` |
| GET | `/appearance` | `Api\AppearanceSettingController` | `getAll` |
| GET | `/appearance/grouped` | `Api\AppearanceSettingController` | `getGrouped` |
| GET | `/website-content/home` | `Api\WebsiteContentController` | `getHomeContent` |
| GET | `/website-content/about` | `Api\WebsiteContentController` | `getAboutContent` |
| GET | `/website-content/all` | `Api\WebsiteContentController` | `getAllContent` |
| GET | `/business-settings` | `Api\BusinessSettingController` | `index` |

#### Authenticated Endpoints (`sanctum` middleware)

**Auth**
| Method | URI | Action |
|--------|-----|--------|
| POST | `/auth/logout` | `AuthController@logout` |
| GET | `/auth/me` | `AuthController@me` |

**Dashboard**
| Method | URI | Action |
|--------|-----|--------|
| GET | `/dashboard/stats` | `DashboardController@stats` |
| GET | `/dashboard/recent-activity` | `DashboardController@recentActivity` |
| POST | `/dashboard/refresh` | `DashboardController@refresh` |

**Products** (Admin CRUD + stock management)
| Method | URI | Action |
|--------|-----|--------|
| GET | `/products` | `ProductController@index` |
| POST | `/products` | `ProductController@store` |
| GET | `/products/{id}` | `ProductController@show` |
| PUT | `/products/{id}` | `ProductController@update` |
| DELETE | `/products/{id}` | `ProductController@destroy` |
| POST | `/products/{id}/restore` | `ProductController@restore` |
| PUT | `/products/{id}/stock` | `ProductController@updateStock` |
| PUT | `/products/{id}/toggle-status` | `ProductController@toggleStatus` |
| GET | `/products/{id}/stock-logs` | `ProductController@stockLogs` |
| GET | `/products/{id}/cost-analysis` | `ProductController@costAnalysis` |
| GET | `/products/{id}/completed-processings` | `ProductController@completedProcessingsByVariety` |
| POST | `/products/{id}/distribute-stock` | `ProductController@distributeStock` |

**Sales**
| Method | URI | Action |
|--------|-----|--------|
| GET | `/sales` | `SaleController@index` |
| POST | `/sales/order` | `SaleController@storeOrder` |
| POST | `/sales/check-reference` | `SaleController@checkReference` |
| GET | `/sales/stats` | `SaleController@stats` |
| GET | `/sales/product-growth` | `SaleController@productGrowth` |
| GET | `/sales/{id}` | `SaleController@show` |
| PUT | `/sales/{id}/status` | `SaleController@updateStatus` |
| POST | `/sales/{id}/void` | `SaleController@void` |
| POST | `/sales/{id}/return` | `SaleController@processReturn` |
| POST | `/sales/{id}/return/accept` | `SaleController@acceptReturn` |
| POST | `/sales/{id}/return/reject` | `SaleController@rejectReturn` |
| POST | `/sales/{id}/return/complete` | `SaleController@markReturned` |
| POST | `/sales/{id}/restock` | `SaleController@restockItems` |
| POST | `/sales/{id}/pay` | `SaleController@markPaid` |

**Predictions** — `GET /sales-predictions`, `POST /sales-predictions/refresh`

**Appearance Settings (Write)** — `PUT /appearance/{id}`, `POST /appearance/reset`

**Website Content (Write)** — `POST /website-content/home`, `POST /website-content/about`, `POST /website-content/hero-image`, `POST /website-content/seed-defaults`

**Business Settings (Write)** — `PUT /business-settings`, `POST /business-settings/logo`

**Database** — `GET /database/export`, `GET /database/info`, `GET /database/export-csv`, `POST /database/import-csv`

**Customers** — Full `apiResource` + `POST /customers/check-email`

**Suppliers** — Full `apiResource` + `POST /suppliers/check-email`

**Varieties** — Full `apiResource`

**Procurements** — Full `apiResource` + `GET /procurements/statistics`

**Drying Processes** — Full `apiResource` + `GET /drying-processes/statistics` + `POST /{id}/increment-day` + `POST /{id}/mark-dried` + `POST /{id}/postpone`

**Procurement Batches** — Full `apiResource` + `GET /procurement-batches/open` + `POST /{id}/assign` + `DELETE /{id}/remove/{procurementId}` + `GET /{id}/drying-distribution`

**Processings** — Full `apiResource` + `GET /processings/active` + `GET /processings/completed` + `GET /processings/statistics` + `POST /{id}/process` + `POST /{id}/complete` + `POST /{id}/return-to-processing`

**Drivers** — Full `apiResource` + `GET /drivers/statistics`

**Deliveries** — Full `apiResource` + `GET /deliveries/by-driver/{driverId}` + `PUT /{id}/status` + `GET /deliveries/statistics`

**Users** — Full `apiResource` + `GET /users/statistics`

**Archives** — `GET /archives` + `GET /archives/statistics` + `POST /archives/{module}/{id}/restore` + `DELETE /archives/{module}/{id}`

**Audit Trails** — `GET /audit-trails` + `GET /audit-trails/statistics` + `GET /audit-trails/{id}`

---

### 1.2 `routes/web.php`

Inertia SSR routes:

| Route | View | Middleware |
|-------|------|-----------|
| `GET /` | `welcome` | none |
| `GET /dashboard` | `dashboard` | `auth`, `verified` |

Requires `routes/settings.php`.

---

### 1.3 `routes/settings.php`

All under `auth` middleware:

| Method | URI | Controller | Middleware |
|--------|-----|-----------|-----------|
| GET | `/settings/profile` | `Settings\ProfileController@edit` | — |
| PUT | `/settings/profile` | `Settings\ProfileController@update` | — |
| DELETE | `/settings/profile` | `Settings\ProfileController@destroy` | — |
| GET | `/settings/password` | `Settings\PasswordController@edit` | — |
| PUT | `/settings/password` | `Settings\PasswordController@update` | `throttle:6,1` |
| GET | `/settings/appearance` | Inertia render | — |
| GET | `/settings/two-factor-authentication` | `Settings\TwoFactorAuthController@show` | `password.confirm` (optional) |

---

### 1.4 `routes/console.php`

Single artisan command: `inspire` (outputs an inspiring quote).

---

## 2. Controllers

**Location:** `app/Http/Controllers/`

### 2.1 AuthController

**File:** `AuthController.php`  
**Uses:** `User` model, `AuditLogger` trait  
**Purpose:** Sanctum token-based authentication

| Method | Description |
|--------|-------------|
| `login(Request)` | Validates email/password, checks user status (Active), revokes old tokens, creates Sanctum token with role-based abilities, logs LOGIN audit |
| `logout(Request)` | Revokes current access token, logs LOGOUT audit |
| `me(Request)` | Returns authenticated user data (id, name, first_name, last_name, email, role, position, phone, date_hired, status, 2FA enabled, timestamps) |
| `getAbilitiesForRole(string)` | Maps roles to token abilities: `super_admin` → `['*']`, `admin` → module-specific list, `staff` → limited POS/read abilities |

**Role → Abilities Map:**
- `super_admin`: `['*']` (all abilities)
- `admin`: products (CRUD, stock, distribute), sales (CRUD, void, return), customers/suppliers/varieties/procurements/drying/batches/processings/drivers/deliveries CRUD, dashboard, predictions, archives, audit-trails, appearance/website/business-settings, users (view), database
- `staff`: products (view, stock), sales (view, create, update), customers/suppliers view, deliveries (view, update-status), dashboard view

---

### 2.2 CustomerController

**File:** `CustomerController.php`  
**Uses:** `CustomerService`, `ApiResponse`, `AuditLogger`, `HasCaching` traits  
**Purpose:** Customer CRUD management

| Method | Description |
|--------|-------------|
| `index(Request)` | Lists customers via service (search, status, order_by, direction, per_page) |
| `store(Request)` | Validates name/phone (regex: `+63\|09` prefix)/email (unique), creates customer, logs CREATE |
| `show(id)` | Fetch single customer |
| `update(Request, id)` | Validates same as store (email unique ignoring current), updates, logs UPDATE |
| `destroy(id)` | Sets status=Inactive via `saveQuietly()`, then soft-deletes, logs DELETE |
| `checkEmail(Request)` | Checks email uniqueness (optionally excluding an ID) |

---

### 2.3 SupplierController

**File:** `SupplierController.php`  
**Uses:** `SupplierService`, `ApiResponse`, `AuditLogger`, `HasCaching` traits  
**Mirrors:** CustomerController pattern identically. Same phone regex, email unique check, soft-delete with status=Inactive.

---

### 2.4 VarietyController

**File:** `VarietyController.php`  
**Uses:** `VarietyService`, `ApiResponse`, `AuditLogger`, `HasCaching` traits  
**Fields:** name (required, unique), description, color (#hex, default `#22c55e`), status  
**Destroy:** Sets status=Inactive, soft-deletes, logs DELETE

---

### 2.5 ProcurementController

**File:** `ProcurementController.php`  
**Uses:** `ProcurementService`, `ProcurementBatchService`, `ApiResponse`, `AuditLogger`

| Method | Description |
|--------|-------------|
| `index(Request)` | Lists with filters (search, status, supplier_id, variety_id, batch_id, date_from/to, order_by, direction, per_page) |
| `store(Request)` | Supports inline `new_supplier` creation. If `batch_id` provided, validates variety matches batch variety. Creates procurement — if batched, calls `ProcurementBatchService->assignProcurement()` |
| `show(id)` | Single procurement with supplier, variety, batch, dryingProcesses, dryingBatchAllocations |
| `update(Request, id)` | Prevents reducing `sacks` below committed drying sacks. Blocks variety change if procurement is in a batch. Recalculates batch totals |
| `destroy(id)` | Sets status=Cancelled, soft-deletes, removes from batch, clears caches |
| `statistics()` | Via service |

---

### 2.6 DryingProcessController

**File:** `DryingProcessController.php`  
**Uses:** `DryingProcessService`, `ApiResponse`, `AuditLogger`

| Method | Description |
|--------|-------------|
| `index(Request)` | Filters: search, status, procurement_id, batch_id, date_from/to, pagination |
| `store(Request)` | Two modes: **Individual** (`procurement_id` + sacks + qty) or **Batch** (`batch_id` + sacks array per procurement). Uses `Validator::make` |
| `show(id)` | With batchProcurements loaded |
| `update(Request, id)` | Updates days/price/sacks, recalculates total |
| `incrementDay(id)` | Increments `days` by 1, recalculates total_price |
| `markAsDried(id)` | Sets status=Dried, sets dried_at timestamp, updates procurement status |
| `postpone(id)` | Sets status=Postponed |
| `destroy(id)` | Restores batch remaining, reverts procurement statuses, soft-deletes |
| `statistics()` | Via service |

---

### 2.7 ProcessingController

**File:** `ProcessingController.php`  
**Uses:** `ProcessingService`, `ApiResponse`, `AuditLogger`

| Method | Description |
|--------|-------------|
| `index(Request)` | Filters: search, status, variety_id, date_from/to |
| `active()` | Pending + Processing statuses |
| `completed()` | Completed status only |
| `statistics()` | Via service |
| `store(Request)` | Supports `drying_process_ids` array (multi-source). Validates input_kg against available dried quantity |
| `show(id)` | With dryingSources, batch, procurement relations |
| `update(Request, id)` | Updates operator_name, processing_date fields |
| `process(id)` | Transitions Pending → Processing |
| `complete(Request, id)` | Sets output_kg (≤ input_kg), calculates husk_kg and yield_percent, transitions → Completed |
| `returnToProcessing(id)` | Transitions Completed → Processing, clears output data |
| `destroy(id)` | Returns quantity_out to drying sources, soft-deletes |

---

### 2.8 ProcurementBatchController

**File:** `ProcurementBatchController.php`  
**Uses:** `ProcurementBatchService`, `ApiResponse`, `AuditLogger`

| Method | Description |
|--------|-------------|
| `index(Request)` | Filters: search, status, variety_id, date_from/to |
| `open()` | Returns only Open-status batches |
| `store(Request)` | Creates batch with auto-generated batch_number (`BATCH-YYYYMMDD-XXX`) |
| `show(id)` | With nested procurements (supplier, variety relations) |
| `update(Request, id)` | Validates total_sacks ≥ currently assigned sacks |
| `destroy(id)` | Only Open batches can be deleted. Detaches procurements, soft-deletes |
| `assignProcurement(Request, id)` | Adds procurement to batch (variety must match) |
| `removeProcurement(id, procurementId)` | Removes procurement from batch, recalculates |
| `dryingDistribution(Request, id)` | Calculates proportional sack allocation across batch's procurements for drying |

---

### 2.9 ProductController

**File:** `ProductController.php`  
**Uses:** `ProductService`, `ProcessingService`, `AuditLogger` (no `ApiResponse` — uses raw `response()->json`)

| Method | Description |
|--------|-------------|
| `index(Request)` | Filters: search, variety_id, status, stock_status, order_by |
| `featured()` | Featured products for public display |
| `store(Request)` | Creates product with product_name, variety_id, price, weight, stock_floor, status. Supports optional `image` file upload (jpeg/png/jpg/webp, max 2MB, stored to `storage/products/`) |
| `show(id)` | Single product with variety |
| `update(Request, id)` | **Prevents variety/weight change if stocks > 0.** Handles image replacement (deletes old file if new one uploaded) |
| `destroy(id)` | Custom soft-delete (sets `is_deleted = true`), logs DELETE |
| `restore(id)` | Restores soft-deleted product |
| `updateStock(Request, id)` | Manual stock adjustment (add/subtract), creates StockLog |
| `completedProcessingsByVariety(id)` | Returns completed processings matching the product's variety |
| `distributeStock(Request, id)` | Converts processing output (kg) → product units via weight. Creates StockLog with full cost breakdown |
| `costAnalysis(id)` | Aggregated cost analysis across all relevant processings |
| `toggleStatus(id)` | Toggles active/inactive |
| `stockLogs(id)` | Paginated stock movement history |

---

### 2.10 SaleController

**File:** `SaleController.php`  
**Uses:** `SaleService`, `ApiResponse`, `AuditLogger`

| Method | Description |
|--------|-------------|
| `index(Request)` | Filters: search, status, payment_method, customer_id, date_from/to |
| `storeOrder(Request)` | Generates `ORD-YYYYMMDD-NNN` transaction ID. Supports inline `new_customer` creation. Creates sale + sale items |
| `show(id)` | With customer, items, items.product |
| `updateStatus(Request, id)` | State machine: `pending→processing` deducts stock; `cancelled` restores stock |
| `void(Request, id)` | Requires `super_admin` password if caller isn't super_admin. Restores stock, sets status=voided. Tracks `voided_by` (current user) and `authorized_by` (admin who approved) |
| `processReturn(Request, id)` | Sets status to `return_requested`, records return_reason/return_notes/return_proof |
| `acceptReturn(Request, id)` | Accepts return request, assigns pickup driver/plate/date, sets status to `picking_up` |
| `rejectReturn(Request, id)` | Rejects return request, reverts status to `delivered`, clears return fields |
| `markReturned(Request, id)` | Marks order as `returned` after pickup completion |
| `restockItems(Request, id)` | Restocks selected items from returned/voided orders. Takes `items` array with `sale_item_id` and `quantity`. Marks items as `restocked` |
| `markPaid(Request, id)` | Records payment for unpaid orders. Updates `payment_status`, `paid_at`, optionally `payment_method`/`reference_number`/`payment_proof` |
| `stats()` | Via service |
| `productGrowth(Request)` | Product sales growth analytics (period: daily/weekly/monthly/yearly) |
| `checkReference(Request)` | Checks if a GCash reference number has already been used on another sale |

---

### 2.11 SalesPredictionController

**File:** `SalesPredictionController.php`  
**Uses:** `SalesPredictionService`, `ApiResponse`

| Method | Description |
|--------|-------------|
| `predictions(Request)` | Period: daily/monthly/yearly. Returns historical data, forecast, summary, top products with stock_status/days_until_stockout, demand trends |
| `refresh()` | Clears prediction cache |

---

### 2.12 DashboardController

**File:** `DashboardController.php`  
**Uses:** `DashboardService`, `ApiResponse`

| Method | Description |
|--------|-------------|
| `stats(Request)` | Period: daily/monthly/yearly. Returns overview, revenue charts, processing performance, procurement summary, inventory summary, top products, recent sales, low stock, payment breakdown, order status breakdown, pipeline summary |
| `recentActivity(Request)` | Paginated recent audit trail entries (limit param) |
| `refresh()` | Clears dashboard cache |

---

### 2.13 ArchiveController

**File:** `ArchiveController.php`  
**Uses:** `ApiResponse`, `AuditLogger`

Manages soft-deleted records across **9 modules**: products, varieties, suppliers, customers, procurements, drying_processes, processings, drivers, deliveries.

Each module maps to its Model class. Product uses custom `is_deleted` boolean; others use Laravel `SoftDeletes`.

| Method | Description |
|--------|-------------|
| `index(Request)` | Fetches all soft-deleted records across specified/all modules. Attaches "archived by" from audit trail |
| `statistics()` | Counts per module |
| `restore(module, id)` | Restores record, resets status to Active/Pending as appropriate. For Products, sets `is_deleted = false` |
| `permanentDelete(module, id)` | Force-deletes record permanently |

---

### 2.14 AuditTrailController

**File:** `AuditTrailController.php`  
**Uses:** `ApiResponse`

| Method | Description |
|--------|-------------|
| `index(Request)` | Filters: action, module, date_from/to, search (user name or description). Paginated |
| `show(id)` | Single audit entry |
| `statistics()` | Today's count, total created/updated/deleted counts |

---

### 2.15 UserController

**File:** `UserController.php`  
**Uses:** `ApiResponse`, `AuditLogger`

| Method | Description |
|--------|-------------|
| `index(Request)` | Filters: role, search. Hides `super_admin` accounts from non-super-admins. Excludes current user from list |
| `store(Request)` | Only `super_admin` can create admin users. Validates unique email. Creates user, logs CREATE |
| `show(id)` | Single user with formatted dates |
| `update(Request, id)` | Protects super_admin accounts from being modified by non-super-admins |
| `destroy(id)` | Revokes all tokens, deletes user, logs DELETE |
| `statistics()` | Counts by role, status, position |

---

### 2.16 DriverController

**File:** `DriverController.php`  
**Uses:** `DriverService`, `ApiResponse`, `AuditLogger`, `HasCaching`  
**Pattern:** Standard CRUD + statistics. Phone regex: `+63|09` prefix.

---

### 2.17 DeliveryAssignmentController

**File:** `DeliveryAssignmentController.php`  
**Uses:** `DeliveryAssignmentService`, `ApiResponse`, `AuditLogger`

| Method | Description |
|--------|-------------|
| `index(Request)` | Filters: search, status, driver_id, priority, date_from/to |
| `store(Request)` | Creates delivery with items array (product_id, product_name, quantity, unit, price) |
| `show(id)` | With driver, customer, items |
| `update(Request, id)` | Updates delivery details |
| `destroy(id)` | Soft-deletes |
| `byDriver(driverId)` | Deliveries for a specific driver |
| `updateStatus(Request, id)` | Supports file upload for proof_of_delivery. Delegates to model methods (markInTransit, markDelivered, markFailed) |
| `statistics()` | Counts by status |

---

### 2.18 CategoryController

**File:** `CategoryController.php`  
**Uses:** `CategoryService` (service file not present in Services/ — possibly legacy/unused)  
**Pattern:** Standard CRUD

---

### 2.19 Api\AppearanceSettingController

**File:** `Controllers/Api/AppearanceSettingController.php`  
**Uses:** `AppearanceSetting` model directly (no service layer)

| Method | Description |
|--------|-------------|
| `index()` | All settings as key-value pairs |
| `getGrouped()` | Settings grouped by category |
| `getAll()` | All settings (public endpoint) |
| `update(Request)` | Bulk update (array of key-value pairs) |
| `updateSingle(Request, id)` | Update single setting |
| `reset()` | Re-runs `AppearanceSettingsSeeder` to reset defaults |

---

### 2.20 Api\BusinessSettingController

**File:** `Controllers/Api/BusinessSettingController.php`  
**Uses:** `BusinessSettingService`

| Method | Description |
|--------|-------------|
| `index()` | All business settings |
| `update(Request)` | Bulk update key-value settings |
| `uploadLogo(Request)` | Handles logo file upload with old file cleanup |

---

### 2.21 Api\DatabaseBackupController

**File:** `Controllers/Api/DatabaseBackupController.php`  
**Uses:** Raw MySQL dump via `StreamedResponse`

| Method | Description |
|--------|-------------|
| `export()` | Streams full MySQL database as `.sql` file. Includes CREATE TABLE + INSERT statements for all tables |
| `info()` | Returns table names, row counts, and data sizes |

---

### 2.22 Api\WebsiteContentController

**File:** `Controllers/Api/WebsiteContentController.php`  
**Uses:** `WebsiteContent` model directly

| Method | Description |
|--------|-------------|
| `getHomeContent()` | Home page content |
| `getAboutContent()` | About page content |
| `getAllContent()` | All page content |
| `saveHomeContent(Request)` | Saves home page sections |
| `saveAboutContent(Request)` | Saves about page sections |
| `uploadHeroImage(Request)` | Hero image file upload |
| `seedDefaults()` | Seeds default website content |

---

### 2.23 Api\ProductController (Public-facing)

**File:** `Controllers/Api/ProductController.php`  
**Purpose:** Public product API for the customer-facing website

| Method | Description |
|--------|-------------|
| `index(Request)` | Search, variety filter, sorting (popular/price_low/price_high/rating/name_asc/name_desc). Returns active, in-stock products |
| `featured()` | Featured products for homepage (active + in-stock, limit 8) |
| `show(id)` | Single product detail |
| `varieties()` | List varieties with product counts |

---

### 2.24 Settings\ProfileController

**File:** `Controllers/Settings/ProfileController.php`  
**Purpose:** Inertia SSR profile management

| Method | Description |
|--------|-------------|
| `edit(Request)` | Renders `settings/profile` Inertia page |
| `update(ProfileUpdateRequest)` | Updates name/email. Nullifies email_verified_at if email changed |
| `destroy(ProfileDeleteRequest)` | Validates current password, logs out, deletes user |

---

### 2.25 Settings\PasswordController

**File:** `Controllers/Settings/PasswordController.php`

| Method | Description |
|--------|-------------|
| `edit()` | Renders `settings/password` Inertia page |
| `update(PasswordUpdateRequest)` | Updates password via validated request |

---

### 2.26 Settings\TwoFactorAuthenticationController

**File:** `Controllers/Settings/TwoFactorAuthenticationController.php`

| Method | Description |
|--------|-------------|
| `show()` | Renders `settings/two-factor-authentication` Inertia page |

---

## 3. Services

**Location:** `app/Services/`  
**Pattern:** All services follow a consistent structure:
- `Cache::remember()` with 5-minute TTL for list/read operations
- `clearCache()` called after every mutation (create/update/delete)
- `DB::transaction()` wrapping write operations
- Returns data (arrays/models), not responses — controllers handle HTTP

---

### 3.1 CustomerService

**File:** `CustomerService.php`  
**Cache Key:** `customers_all`

| Method | Description |
|--------|-------------|
| `getAllCustomers(filters)` | Paginated list with search (name/email/phone), status, sorting |
| `getCustomer(id)` | Find or fail |
| `createCustomer(data)` | Create in transaction |
| `updateCustomer(id, data)` | Update in transaction |
| `deleteCustomer(id)` | Soft-delete in transaction |
| `getStatistics()` | Active/inactive/total, recent (last 30 days) |

---

### 3.2 SupplierService

**File:** `SupplierService.php`  
**Cache Key:** `suppliers_all`  
**Pattern:** Mirrors CustomerService identically.

---

### 3.3 VarietyService

**File:** `VarietyService.php`  
**Cache Key:** `varieties_all`

| Method | Description |
|--------|-------------|
| `getAllVarieties(filters)` | Includes `withCount('products')`. Search, status, sorting |
| `getVariety(id)` | Find or fail |
| `createVariety(data)` | Default color: `#22c55e` |
| `updateVariety(id, data)` | Standard update |
| `deleteVariety(id)` | Soft-delete |
| `getStatistics()` | Active/inactive, product counts per variety |

---

### 3.4 ProcurementService

**File:** `ProcurementService.php`  
**Cache Key:** `procurements_all`

| Method | Description |
|--------|-------------|
| `getAllProcurements(filters)` | Eager loads: supplier, variety, batch, dryingProcesses, dryingBatchAllocations. Filters: search, status, supplier_id, variety_id, batch_id, date range |
| `getProcurement(id)` | With relations |
| `createProcurement(data)` | Supports inline `new_supplier` creation (also clears suppliers cache). Auto-calculates total_cost on model save |
| `updateProcurement(id, data)` | Standard update |
| `deleteProcurement(id)` | Soft-delete |
| `getStatistics()` | Total/pending/completed, total cost/kg/sacks, active suppliers |

---

### 3.5 DryingProcessService

**File:** `DryingProcessService.php`  
**Cache Key:** `drying_processes_all`

| Method | Description |
|--------|-------------|
| `getAllDryingProcesses(filters)` | Filters: search, status, procurement_id, batch_id, date range |
| `getDryingProcess(id)` | With batchProcurements |
| `createDryingProcess(data)` | **Two modes:** (1) **Batch mode** — proportional distribution via `ProcurementBatchService->calculateDryingDistribution()`, creates `DryingBatchProcurement` pivot records, decrements batch remaining; (2) **Individual mode** — proportional kg calculation from sacks, updates procurement status |
| `updateDryingProcess(id, data)` | Updates days/price/sacks, recalculates total |
| `incrementDay(id)` | `days++`, recalculates `total_price = (sacks × price) × days` |
| `markAsDried(id)` | Status → Dried, sets `dried_at`, updates source procurement status to "Dried" |
| `postponeDryingProcess(id)` | Status → Postponed |
| `deleteDryingProcess(id)` | Restores batch remaining (sacks/kg), reverts procurement statuses, soft-deletes |
| `getStatistics()` | Active/dried/postponed counts, total sacks/kg |

---

### 3.6 ProcessingService

**File:** `ProcessingService.php`  
**Cache Key:** `processings_all`

| Method | Description |
|--------|-------------|
| `getAllProcessings(filters)` | Eager loads: dryingSources (with batch.variety, procurement.supplier, batchProcurements.procurement.supplier/variety), procurement.supplier/variety |
| `createProcessing(data)` | Supports `drying_process_ids` array (multi-source). Sums input_kg from all sources. Creates pivot records in `processing_drying_sources` with per-source `quantity_kg` (proportional split). Updates each drying source's `quantity_out` |
| `completeProcessing(id, data)` | Sets output_kg, calculates `husk_kg = input_kg - output_kg`, `yield_percent = (output_kg / input_kg) × 100`. Status → Completed |
| `processProcessing(id)` | Status → Processing |
| `returnToProcessing(id)` | Status → Processing, clears output_kg/husk_kg/yield_percent/completed_date |
| `deleteProcessing(id)` | Returns `quantity_out` to each drying source (via pivot quantities), soft-deletes |
| `getStatistics()` | Pending/processing/completed counts, total input/output kg, avg yield |

---

### 3.7 ProcurementBatchService

**File:** `ProcurementBatchService.php`  
**Cache Key:** `procurement_batches_all`

| Method | Description |
|--------|-------------|
| `getAllBatches(filters)` | With procurements count, procurements sum total_cost, dryingProcesses sum total_price |
| `getOpenBatches()` | Status = Open only |
| `getBatch(id)` | With procurements (supplier, variety), dryingProcesses |
| `createBatch(data)` | Auto-generates `BATCH-YYYYMMDD-XXX` number. Initial remaining = total |
| `updateBatch(id, data)` | Validates total_sacks ≥ assigned sacks |
| `deleteBatch(id)` | Only Open batches. Detaches all procurements (nulls batch_id) |
| `assignProcurement(batchId, data)` | Validates: batch Open, variety matches, procurement not already batched. Sets procurement's batch_id, recalculates batch totals |
| `removeProcurement(batchId, procId)` | Nulls procurement.batch_id, recalculates batch |
| `calculateDryingDistribution(batchId, totalSacks)` | Proportional sack allocation across batch procurements based on each procurement's available sacks. Returns per-procurement distribution array |
| `decrementRemaining(batch, sacks, kg)` | Decrements remaining_sacks/remaining_kg. Auto-completes batch when remaining ≤ 0 |

---

### 3.8 ProductService

**File:** `ProductService.php`  
**Cache Key:** `products_all`

| Method | Description |
|--------|-------------|
| `getAllProducts(filters)` | With variety. Filters: search, variety_id, status, stock_status (in_stock/low_stock/out_of_stock) |
| `getProduct(id)` | Find via `withDeleted` scope |
| `createProduct(data)` | Standard create |
| `updateProduct(id, data)` | Standard update |
| `deleteProduct(id)` | Custom soft-delete (`is_deleted = true`) |
| `restoreProduct(id)` | Sets `is_deleted = false`, status = active |
| `updateStock(id, type, quantity, notes)` | Adjusts stock, creates StockLog |
| `distributeStockFromProcessing(productId, processingId, kgAmount)` | Converts kg → units via product weight. Creates StockLog with full cost breakdown from `computeProcessingCost()` |
| `computeProcessingCost(processing)` | Traces cost chain: drying_source → drying_process → procurement. Calculates proportional procurement_cost and drying_cost per kg, then per unit |
| `getProductCostAnalysis(id)` | Aggregates cost data across all stock logs for the product (avg, min, max costs; total units; total investment; overall profit margin) |
| `getStockLogs(id, filters)` | Paginated stock movement history |

**Cost Calculation Chain:**
```
Procurement (price_per_kg × quantity_kg) 
  → DryingProcess (total_price) 
    → Processing (proportional split by kg) 
      → Product (cost / units = cost_per_unit)
```

---

### 3.9 SaleService

**File:** `SaleService.php`  
**Cache Key:** `sales_all`

| Method | Description |
|--------|-------------|
| `getAllSales(filters)` | With customer, items (product, product.variety). Filters: search, status, payment_method, customer_id, date range |
| `createOrder(data)` | Generates `ORD-YYYYMMDD-NNN` transaction ID. Supports inline `new_customer` creation. Creates sale + sale items. Clears customers cache if new customer created |
| `updateOrderStatus(id, status)` | State machine: `pending→processing` deducts product stock; `cancelled` restores stock |
| `voidSale(id, reason, voidedBy, authorizedBy)` | Restores all item stocks, sets status=voided, records `voided_by` and `authorized_by` |
| `processReturn(id, data)` | Sets status to `return_requested`, records return_reason/notes/proof |
| `acceptReturn(id, data)` | Assigns pickup driver/plate/date, sets status to `picking_up` |
| `rejectReturn(id)` | Reverts status to `delivered`, clears return fields |
| `markReturned(id)` | Sets status to `returned`, decrements customer order count (stock is NOT auto-restored — requires manual restock) |
| `restockItems(id, items)` | Restocks selected items from returned/voided orders. Adds stock back to products, marks sale_items as `restocked` |
| `markPaid(id, data)` | Updates `payment_status` to `paid`, sets `paid_at`, optionally updates `payment_method`/`reference_number`/`payment_proof` |
| `getStatistics()` | Total sales, revenue, avg order value, by status, by payment method, recent trends |
| `getProductSalesGrowth(filters)` | Per-product sales growth comparison across periods |
| `clearCache()` | Clears sales cache |

---

### 3.10 SalesPredictionService

**File:** `SalesPredictionService.php`  
**Cache Key:** `sales_predictions_{period}`

**Algorithm:** Weighted Moving Average + Linear Trend extrapolation

| Method | Description |
|--------|-------------|
| `getPredictions(period)` | Period: daily/monthly/yearly. Returns: historical data, forecast arrays (quantity, revenue with confidence intervals), summary metrics, top_products (with stock_status, days_until_stockout), demand_trends |
| `clearCache()` | Clears all prediction caches |

**Forecasting Details:**
- Uses weighted moving average where recent periods get higher weights
- Applies linear trend component for growth/decline detection
- Calculates confidence intervals based on historical variance
- Predicts days_until_stockout per product based on forecasted demand
- Classifies demand trends as "increasing", "stable", or "decreasing"

---

### 3.11 DashboardService

**File:** `DashboardService.php`  
**Cache Key:** `dashboard_stats_{period}`, `dashboard_recent_activity`  
**Size:** ~520 lines

| Method | Description |
|--------|-------------|
| `getStats(period)` | Comprehensive dashboard. Period: daily/monthly/yearly |
| `getRecentActivity(limit)` | Recent audit trail entries |
| `clearCache()` | Clears all dashboard period caches |

**Stats Components:**
- **Overview:** Total revenue, orders, customers, products — each with period-over-period change percentage
- **Revenue Chart:** Time-series revenue data (daily dates / monthly labels / yearly)
- **Processing Performance:** Completion rate, avg yield, total input/output kg
- **Procurement Summary:** Total procurements, cost, kg, sacks, pending count, active suppliers
- **Inventory Summary:** Total stock, low stock count, out of stock count, healthy count
- **Top Products:** Top 5 by revenue (with current stock, variety)
- **Recent Sales:** Last 8 sales (transaction ID, customer, total, payment method, status)
- **Low Stock Products:** Up to 5 products at or below stock_floor
- **Payment Breakdown:** Cash/GCash/COD/Pay Later counts and totals with colors
- **Order Status Breakdown:** Pending/Processing/Shipped/Delivered/Completed/Returned/Cancelled/Voided with colors
- **Pipeline Summary:** Active counts across procurement→drying→processing→orders→deliveries

---

### 3.12 DriverService

**File:** `DriverService.php`  
**Cache Key:** `drivers_all`  
**Pattern:** Standard CRUD + statistics (active/inactive/on_leave counts)

---

### 3.13 DeliveryAssignmentService

**File:** `DeliveryAssignmentService.php`  
**Cache Key:** `delivery_assignments_all`

| Method | Description |
|--------|-------------|
| `getAllDeliveries(filters)` | With driver, customer, items. Count items. Filters: search, status, driver_id, priority, date range |
| `getDelivery(id)` | With relations |
| `createDelivery(data)` | Creates assignment + items. Auto-generates `DEL-YYYYMMDD-NNN` number |
| `updateDelivery(id, data)` | Syncs items (deletes old, inserts new) |
| `deleteDelivery(id)` | Soft-delete |
| `getByDriver(driverId)` | Filter by driver |
| `updateStatus(id, status, data)` | Delegates to model methods: `markInTransit()`, `markDelivered()`, `markFailed()`. Increments driver total_deliveries on delivery |
| `getStatistics()` | By status, by priority, by driver |

---

### 3.14 BusinessSettingService

**File:** `BusinessSettingService.php`  
**Cache Key:** `business_settings_all`

| Method | Description |
|--------|-------------|
| `getAllSettings()` | Returns all settings as key-value map with type casting (boolean/number/json/string) |
| `updateSettings(data)` | Bulk `updateOrCreate` for each key-value pair |
| `uploadLogo(file)` | Stores in `public/logos`, deletes old logo file, saves path as `business_logo` setting |

---

## 4. Models

**Location:** `app/Models/`

### 4.1 User

**File:** `User.php`  
**Traits:** `HasFactory`, `Notifiable`, `TwoFactorAuthenticatable`, `HasApiTokens`

| Field | Type | Notes |
|-------|------|-------|
| name | string | |
| first_name | string | |
| last_name | string | |
| email | string | unique |
| password | string | cast: `hashed` |
| role | string | `super_admin` / `admin` / `staff` |
| position | string | `Secretary` / `Driver` |
| phone | string | nullable |
| status | string | `Active` / `Inactive` |
| date_hired | date | nullable |
| email_verified_at | datetime | |

**Helper Methods:**
- `isSuperAdmin()`, `isAdmin()`, `isStaff()`, `isAdminOrAbove()`, `isActive()`

**Relationships:**
- `hasMany(AuditTrail)`

---

### 4.2 Product
**File:** `Product.php`  
**Custom PK:** `product_id`  
**Soft Delete:** Custom implementation — `is_deleted` boolean field + global scope `notDeleted` (does NOT use Laravel's `SoftDeletes` trait)

| Field | Type | Cast |
|-------|------|------|
| product_id | int (PK) | — |   
| product_name | string | — |
| variety_id | int (FK) | — |
| price | decimal | `decimal:2` |
| stocks | int | `integer` |
| stock_floor | int | `integer` |
| unit | string | — |
| weight | decimal | `decimal:2` |
| image | string | nullable (file path in `storage/products/`) |
| status | string | `active` / `inactive` |
| is_deleted | bool | `boolean` |
| is_archived | bool | `boolean` |
| archived_at | datetime | nullable |

**Scopes:** `active`, `inactive`, `withDeleted` (removes global scope), `onlyDeleted`  
**Relationships:** `belongsTo(Variety)`  
**Methods:** `softDelete()`, `restore()`, `isInStock()`, `isActive()`

---

### 4.3 Procurement

**File:** `Procurement.php`  
**Traits:** `SoftDeletes`, `HasFactory`

| Field | Type | Notes |
|-------|------|-------|
| supplier_id | FK | |
| variety_id | FK | |
| batch_id | FK | nullable |
| quantity_kg | decimal | |
| sacks | int | |
| price_per_kg | decimal | |
| description | text | nullable |
| total_cost | decimal | Auto-calculated on `saving` event: `quantity_kg × price_per_kg` |
| status | string | Pending/Active/Drying/Dried/Completed/Cancelled |

**Relationships:**
- `belongsTo`: batch (ProcurementBatch), supplier, variety
- `hasMany`: dryingProcesses, dryingBatchAllocations (DryingBatchProcurement)

---

### 4.4 DryingProcess

**File:** `DryingProcess.php`  
**Traits:** `SoftDeletes`, `HasFactory`

| Field | Type | Notes |
|-------|------|-------|
| procurement_id | FK | nullable (batch mode) |
| batch_id | FK | nullable (individual mode) |
| quantity_kg | decimal | |
| sacks | int | |
| quantity_out | decimal | Kg consumed by processings |
| days | int | |
| price | decimal | Per-sack per-day |
| total_price | decimal | `(sacks × price) × days` |
| status | string | Drying / Dried / Postponed / Cancelled |
| dried_at | timestamp | nullable |

**Appends:** `remaining_quantity` = `quantity_kg - quantity_out`  
**Relationships:**
- `belongsTo`: batch (ProcurementBatch), procurement
- `hasMany`: batchProcurements (DryingBatchProcurement)

**Methods:** `recalculateTotal()` — recomputes total_price  
**Scopes:** `drying`, `dried`, `active`

---

### 4.5 Processing

**File:** `Processing.php`  
**Traits:** `SoftDeletes`, `HasFactory`

| Field | Type | Notes |
|-------|------|-------|
| procurement_id | FK | nullable (legacy) |
| drying_process_id | FK | nullable (legacy) |
| input_kg | decimal | Sum from all drying sources |
| output_kg | decimal | nullable, set on completion |
| stock_out | decimal | Kg distributed to products |
| husk_kg | decimal | `input_kg - output_kg` |
| yield_percent | decimal | `(output_kg / input_kg) × 100` |
| operator_name | string | |
| status | string | Pending / Processing / Completed |
| processing_date | datetime | |
| completed_date | datetime | nullable |

**Appends:** `stock_status` (fully_distributed / partially_distributed / not_distributed), `remaining_stock` (output_kg - stock_out)  
**Relationships:**
- `belongsTo`: procurement, dryingProcess
- `belongsToMany`: dryingSources (DryingProcess via `processing_drying_sources` pivot with `quantity_kg`)

**Methods:** `calculateResults()` — computes husk_kg and yield_percent  
**Scopes:** `pending`, `processing`, `completed`, `active`

---

### 4.6 Sale

**File:** `Sale.php`  
**No SoftDeletes**

| Field | Type |
|-------|------|
| transaction_id | string (ORD-YYYYMMDD-NNN) |
| customer_id | FK, nullable |
| subtotal | decimal |
| discount | decimal |
| delivery_fee | decimal |
| total | decimal |
| amount_tendered | decimal |
| change_amount | decimal |
| payment_method | string (cash/gcash/cod/pay_later) |
| payment_status | string (paid/not_paid), default 'paid' |
| reference_number | string, nullable |
| payment_proof | text, nullable (cast: array) |
| paid_at | datetime, nullable |
| status | string (pending/processing/shipped/delivered/completed/return_requested/picking_up/returned/cancelled/voided) |
| notes | text, nullable |
| delivery_address | text, nullable |
| distance_km | decimal, nullable |
| driver_name | string, nullable |
| driver_plate_number | string, nullable |
| return_reason | text, nullable |
| return_notes | text, nullable |
| return_proof | text, nullable (cast: array) |
| return_pickup_driver | string, nullable |
| return_pickup_plate | string, nullable |
| return_pickup_date | date, nullable |
| voided_by | string, nullable |
| authorized_by | string, nullable |

**Relationships:** `belongsTo(Customer)`, `hasMany(SaleItem)`  
**Scopes:** `completed`, `voided`

---

### 4.7 SaleItem

**File:** `SaleItem.php`

| Field | Type |
|-------|------|
| sale_id | FK |
| product_id | FK → products.product_id |
| quantity | int |
| unit_price | decimal |
| subtotal | decimal |
| restocked | boolean, default false |

**Relationships:** `belongsTo(Sale)`, `belongsTo(Product, 'product_id', 'product_id')`

---

### 4.8 Customer

**File:** `Customer.php`  
**Traits:** `SoftDeletes`, `HasFactory`  
**Fields:** name, contact, phone, email, address, status, orders (count)  
**Relationships:** `hasMany(Sale)`

---

### 4.9 Supplier

**File:** `Supplier.php`  
**Traits:** `SoftDeletes`, `HasFactory`  
**Fields:** name, contact, phone, email, address, status, products (count)  
**Relationships:** `hasMany(Procurement)`

---

### 4.10 Variety

**File:** `Variety.php`  
**Table:** `varieties`  
**Traits:** `SoftDeletes`, `HasFactory`  
**Fields:** name, description, color (hex), status, products_count  
**Relationships:** `hasMany(Product)`, `hasMany(Procurement)`

---

### 4.11 Driver

**File:** `Driver.php`  
**Traits:** `SoftDeletes`, `HasFactory`  
**Fields:** name, contact, phone, email, license_number, vehicle_type, plate_number, address, status, total_deliveries  
**Relationships:** `hasMany(DeliveryAssignment)`  
**Methods:** `incrementDeliveries()`

---

### 4.12 DeliveryAssignment

**File:** `DeliveryAssignment.php`  
**Traits:** `SoftDeletes`, `HasFactory`

| Field | Type |
|-------|------|
| delivery_number | string (DEL-YYYYMMDD-NNN) |
| driver_id | FK |
| customer_id | FK, nullable |
| destination | string |
| contact_person | string |
| contact_phone | string |
| delivery_date | date |
| priority | string (low/normal/high/urgent) |
| status | string (assigned/picked_up/in_transit/delivered/failed/cancelled) |
| notes | text |
| driver_notes | text |
| proof_of_delivery | string (file path) |
| picked_up_at | datetime |
| delivered_at | datetime |

**Static:** `generateDeliveryNumber()` → `DEL-YYYYMMDD-NNN`  
**Relationships:** `belongsTo(Driver, Customer)`, `hasMany(DeliveryItem)`  
**Methods:** `markInTransit()`, `markDelivered()`, `markFailed()`

---

### 4.13 DeliveryItem

**File:** `DeliveryItem.php`  
**Fields:** delivery_assignment_id, product_id, product_name, quantity, unit, price, total  
**Relationships:** `belongsTo(DeliveryAssignment, Product)`

---

### 4.14 ProcurementBatch

**File:** `ProcurementBatch.php`  
**Table:** `procurement_batches`  
**Traits:** `SoftDeletes`, `HasFactory`

| Field | Type | Notes |
|-------|------|-------|
| batch_number | string | `BATCH-YYYYMMDD-XXX` |
| variety_id | FK | |
| season_date | date | |
| total_sacks | int | |
| total_kg | decimal | |
| remaining_sacks | int | Decrements as drying consumes |
| remaining_kg | decimal | |
| status | string | Open / Closed / Completed |
| notes | text | |

**Static:** `generateBatchNumber()`  
**Relationships:** `belongsTo(Variety)`, `hasMany(Procurement, DryingProcess)`  
**Methods:**
- `recalculateTotals()` — complex query that subtracts both batch-level and individual drying allocations from totals to compute remaining
- `avgKgPerSack()` — average kg per sack for proportional calculations

---

### 4.15 DryingBatchProcurement (Pivot)

**File:** `DryingBatchProcurement.php`  
**Table:** `drying_batch_procurements`  
**Fields:** drying_process_id, procurement_id, sacks_taken, quantity_kg  
**Relationships:** `belongsTo(DryingProcess, Procurement)`

Links a batch-mode drying process to individual procurements with the proportional allocation of sacks and kg taken from each.

---

### 4.16 StockLog

**File:** `StockLog.php`

| Field | Type | Notes |
|-------|------|-------|
| product_id | FK | |
| type | string | `in` / `out` |
| quantity_before | int | |
| quantity_change | int | |
| quantity_after | int | |
| kg_amount | decimal | nullable |
| source_type | string | e.g., `processing`, `manual` |
| source_id | int | nullable |
| source_processing_ids | json | nullable (cast: array). IDs of all processing sources when distributing multi-source stock |
| notes | text | |
| procurement_cost | decimal | Cost from procurement chain |
| drying_cost | decimal | Cost from drying chain |
| total_cost | decimal | procurement_cost + drying_cost |
| cost_per_unit | decimal | total_cost / units |
| selling_price | decimal | Product price at time of distribution |
| profit_per_unit | decimal | selling_price - cost_per_unit |
| profit_margin | decimal | (profit_per_unit / selling_price) × 100 |

**Relationships:** `belongsTo(Product)`

---

### 4.17 AuditTrail

**File:** `AuditTrail.php`  
**Fields:** user_id, action, module, description, details (cast: `array`), ip_address, user_agent  
**Relationships:** `belongsTo(User)`

---

### 4.18 AppearanceSetting

**File:** `AppearanceSetting.php`  
**Fields:** key, value, label, description, category, sort_order  
**Static Methods:**
- `getAllAsKeyValue()` — returns `[key => value]` map
- `getGroupedByCategory()` — groups by category
- `updateByKey(key, value)` — updates single setting
- `bulkUpdate(settings)` — bulk update array of key-value pairs

---

### 4.19 BusinessSetting

**File:** `BusinessSetting.php`  
**Fields:** key, value, type  
**Static Methods:**
- `getValue(key, default)` — retrieves with automatic type casting (boolean → `true`/`false`, number → float, json → decoded, string → raw)
- `setValue(key, value, type)` — `updateOrCreate`

---

### 4.20 WebsiteContent

**File:** `WebsiteContent.php`  
**Fields:** page, section, key, value, meta (cast: `array`), sort_order, is_active  
**Static Methods:**
- `getHomeContent()` — home page sections (hero, features, statistics, cta, featured_products, testimonials, newsletter, contact)
- `getAboutContent()` — about page sections
- `saveHomeContent(data)` — saves sections with `updateOrCreate` per key
- `saveAboutContent(data)` — saves about sections
- `seedDefaults()` — seeds default content for home/about pages

---

## 5. API Resources

**Location:** `app/Http/Resources/`  
**Pattern:** All extend `JsonResource`. Transform Eloquent models into standardized JSON for API responses.

### 5.1 CustomerResource
**Outputs:** id, name, contact, phone, email, address, status, orders, created_at (Y-m-d H:i:s), updated_at

### 5.2 SupplierResource
**Outputs:** id, name, contact, phone, email, address, status, products (default 0), created_at (ISO), updated_at (ISO)

### 5.3 VarietyResource
**Outputs:** id, name, description, color (default `#22c55e`), status, products_count (default 0), created_at, updated_at

### 5.4 ProcurementResource
**Outputs:** id, supplier_id, supplier (whenLoaded: id/name/contact/phone/email), supplier_name, variety_id, variety_name, variety_color, quantity_kg, sacks, **drying_sacks** (computed: sum of dryingProcesses sacks + dryingBatchAllocations sacks_taken), **drying_kg** (computed), price_per_kg, description, total_cost, status, batch_id, batch_number, batch_status, timestamps

### 5.5 DryingProcessResource
**Outputs:** id, procurement_id, procurement_info (nested: id/supplier_name/variety_name/variety_color/quantity_kg/sacks/price_per_kg/status), quantity_kg, sacks, quantity_out, remaining_quantity, days, price, total_price, status, dried_at, batch_id, batch_number, batch_variety_name, batch_variety_color, **batch_breakdown** (conditional: per-procurement allocation when batch_id present and batchProcurements loaded), timestamps

### 5.6 ProcessingResource
**Most complex resource (~120 lines).** Handles both direct-procurement and batch-mode processing chains.

**Procurement Info Logic:**
1. If direct `procurement` relation → uses it directly
2. Else, traverses `dryingSources → batchProcurements → procurement` chain
3. Falls back to legacy `dryingProcess → batchProcurements` chain
4. If multiple procurement sources, includes `sources` array

**Outputs:** id, procurement_id, drying_process_id, procurement_info, drying_process_info (nested), **drying_sources** (whenLoaded: per-source with quantity_kg_taken from pivot, batch info, variety, supplier), input_kg, output_kg, stock_out, remaining_stock, husk_kg, yield_percent, operator_name, status, stock_status, processing_date, completed_date, timestamps, **cost_breakdown** (when computed)

### 5.7 ProductResource
**Outputs:** id, product_id, product_name, variety_id, variety_name, variety_color, price, price_formatted (₱), stocks, stock_floor, unit (auto-formatted: `Xkg`), weight, weight_formatted, **image** (`/storage/<path>` or null), status, is_active, is_in_stock, **stock_status** (computed: "Out of Stock" / "Low Stock" / "In Stock"), is_deleted, timestamps, created_date (formatted)

### 5.8 SaleResource
**Outputs:** id, transaction_id, customer_id, customer_name (default "Walk-in"), subtotal, discount, delivery_fee, total, total_formatted (₱), amount_tendered, change_amount, payment_method, **payment_status** (default 'paid'), reference_number, **payment_proof** (array of `/storage/` paths), **paid_at** (ISO), **paid_at_formatted**, status, notes, **voided_by**, **authorized_by**, items_count, total_quantity, **items** (mapped: id/product_id/product_name/variety_name/variety_color/weight_formatted/quantity/unit_price/subtotal/**restocked**), delivery_address, distance_km, driver_name, driver_plate_number, return_reason, return_notes, **return_proof** (array of `/storage/` paths), **return_pickup_driver**, **return_pickup_plate**, **return_pickup_date**, **return_pickup_date_formatted**, created_at (ISO), date_formatted, date_short

### 5.9 ProcurementBatchResource
**Complex cost computation** — calculates total drying cost by summing:
1. Batch-level drying processes (`drying_processes_sum_total_price`)
2. Individual procurement-level drying processes (queries DryingProcess where procurement_id in batch procurements AND batch_id IS NULL)

**Outputs:** id, batch_number, variety_id/name/color, season_date, total_sacks/kg, remaining_sacks/kg, **used_sacks/kg** (computed), **total_cost** (sum of procurements), **total_drying_cost** (computed), status, notes, procurements_count, **procurements** (whenLoaded: per-procurement with supplier_name, quantities, costs), timestamps

### 5.10 DriverResource
**Outputs:** id, name, contact, phone, email, license_number, vehicle_type, plate_number, address, status, total_deliveries, timestamps

### 5.11 DeliveryAssignmentResource
**Outputs:** id, delivery_number, driver_id, **driver** (nested DriverResource, whenLoaded), customer_id, **customer** (nested CustomerResource, whenLoaded), destination, contact_person, contact_phone, delivery_date, priority, status, notes, driver_notes, proof_of_delivery, picked_up_at, delivered_at, **items** (DeliveryItemResource collection, whenLoaded), items_count, **total_value** (computed sum), timestamps

### 5.12 DeliveryItemResource
**Outputs:** id, delivery_assignment_id, product_id, product_name, quantity, unit, price, total

### 5.13 StockLogResource
**Outputs:** id, product_id, product_name, variety_name, variety_color, type (in/out), quantity_before, quantity_change, quantity_after, kg_amount, source_type, source_id, **source_processing_ids** (array), notes, procurement_cost, drying_cost, total_cost, cost_per_unit, selling_price, profit_per_unit, profit_margin, created_at (ISO), date_formatted, date_short

### 5.14 AuditTrailResource
**Outputs:** id, user_id, user (name, default "System"), role (default "-"), action, module, description, details, ip_address, user_agent, timestamp, created_at

### 5.15 BusinessSettingResource
**Dual mode:**
- **Single model:** Returns key, value, type
- **Settings array:** Returns structured object with all business fields (business_name, business_logo, business_email, phone, address, open_days, open_time, close_time, hours, footer fields, social media links) with sensible defaults

---

## 6. Middleware

**Location:** `app/Http/Middleware/`

### 6.1 HandleAppearance

**File:** `HandleAppearance.php`  
**Purpose:** Shares appearance settings cookie value with all Blade/Inertia views.  
**Behavior:** Reads `appearance` cookie from request, shares as `appearance` view variable.

### 6.2 HandleInertiaRequests

**File:** `HandleInertiaRequests.php`  
**Purpose:** Inertia.js middleware — configures shared data for all SSR pages.

| Shared Data | Source |
|-------------|--------|
| `name` | `config('app.name')` |
| `auth.user` | Authenticated user (deferred) |
| `sidebarOpen` | `sidebar_state` cookie (boolean, default `true`) |

**Root View:** `app` (Blade template)

---

## 7. Requests (Form Requests)

**Location:** `app/Http/Requests/Settings/`

### 7.1 ProfileUpdateRequest
**Validation (via ProfileValidationRules concern):**
- `name`: required, string, max:255
- `email`: required, string, email, max:255, unique (ignoring current user)

### 7.2 ProfileDeleteRequest
**Validation (via PasswordValidationRules concern):**
- `password`: required, string, current_password

### 7.3 PasswordUpdateRequest
**Validation:**
- `current_password`: required, string, current_password
- `password`: required, string, confirmed, `Password::default()`

### 7.4 TwoFactorAuthenticationRequest
**Authorization:** Only allows if two-factor feature is enabled in business settings (`BusinessSetting::getValue('enable_two_factor', false)`)  
**Rules:** None (no validation needed — just authorization gate)

---

## 8. Traits

**Location:** `app/Traits/`

### 8.1 ApiResponse

**File:** `ApiResponse.php`  
**Purpose:** Standardized JSON response formatting for all API controllers

| Method | HTTP Status | Response Structure |
|--------|-------------|-------------------|
| `successResponse(data, message, code)` | 200 | `{success: true, message, data}` |
| `createdResponse(data, message)` | 201 | `{success: true, message, data}` |
| `errorResponse(message, code)` | variable | `{success: false, message}` |
| `notFoundResponse(message)` | 404 | `{success: false, message}` |
| `validationErrorResponse(errors, message)` | 422 | `{success: false, message, errors}` |
| `serverErrorResponse(message)` | 500 | `{success: false, message}` |

### 8.2 AuditLogger

**File:** `AuditLogger.php`  
**Purpose:** Creates audit trail entries for all significant actions

| Method | Parameters | Behavior |
|--------|-----------|----------|
| `logAudit(action, module, description, details)` | action: CREATE/UPDATE/DELETE/LOGIN/LOGOUT/etc.; module: string; description: human-readable; details: array (nullable) | Creates `AuditTrail` record with user_id (from auth), IP address, user agent |

### 8.3 HasCaching

**File:** `HasCaching.php`  
**Purpose:** Generic caching helpers for controllers/services

| Method | Description |
|--------|-------------|
| `getCachePrefix()` | Returns class-based cache prefix |
| `cached(key, ttl, callback)` | `Cache::remember` wrapper |
| `clearCacheKey(key)` | Forgets specific cache key |
| `clearAllCache()` | Clears multiple known keys |
| `cacheValue(key, value, ttl)` | Explicit `Cache::put` |
| `getCachedValue(key)` | Explicit `Cache::get` |

---

## 9. Concerns

**Location:** `app/Concerns/`

### 9.1 PasswordValidationRules

**File:** `PasswordValidationRules.php`

| Method | Returns |
|--------|---------|
| `passwordRules()` | `['required', 'string', Password::default(), 'confirmed']` |
| `currentPasswordRules()` | `['required', 'string', 'current_password']` |

### 9.2 ProfileValidationRules

**File:** `ProfileValidationRules.php`

| Method | Returns |
|--------|---------|
| `profileRules(userId)` | name + email rules combined |
| `nameRules()` | `['required', 'string', 'max:255']` |
| `emailRules(userId)` | `['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore(userId)]` |

---

## 10. Providers

**Location:** `app/Providers/`

### 10.1 AppServiceProvider

**File:** `AppServiceProvider.php`  
**Boot behavior:**
- Uses `CarbonImmutable` for all date fields
- **Production Guards:** Prohibits destructive migration commands (`db:wipe`, `migrate:fresh`, `migrate:refresh`, `migrate:reset`)
- **Password Defaults (Production):** min 12 chars, mixed case, symbols
- **Password Defaults (Non-Production):** min 8 chars

### 10.2 FortifyServiceProvider

**File:** `FortifyServiceProvider.php`  
**Configures Laravel Fortify for authentication UI:**

**Actions Registered:**
- `CreateNewUser` (from `Actions/Fortify/`)
- `ResetUserPassword` (from `Actions/Fortify/`)

**Inertia Views:**
| Feature | View Name |
|---------|-----------|
| Login | `auth/login` |
| Register | `auth/register` |
| Reset Password | `auth/reset-password` |
| Forgot Password | `auth/forgot-password` |
| Verify Email | `auth/verify-email` |
| 2FA Challenge | `auth/two-factor-challenge` |
| Confirm Password | `auth/confirm-password` |

**Rate Limiting:**
- Login: 5 attempts per minute (by email + IP)
- 2FA: 5 attempts per minute (by session + IP)

---

## 11. Architecture Patterns & Cross-Cutting Concerns

### 11.1 Overall Architecture

```
Request → Route → Controller → Service → Model → Database
                      ↓              ↓
                  API Resource    Cache Layer
                      ↓
                  JSON Response
```

- **Controllers** handle HTTP concerns (validation, request/response formatting, audit logging)
- **Services** handle business logic, caching, and database transactions
- **Models** handle data structure, relationships, and domain methods
- **Resources** handle API response transformation

### 11.2 Authentication & Authorization

| Layer | Technology |
|-------|-----------|
| API Auth | Laravel Sanctum (token-based) |
| Token Abilities | Role-based: `super_admin` gets `['*']`, `admin` gets module-specific, `staff` gets limited |
| 2FA | Laravel Fortify `TwoFactorAuthenticatable` |
| Session Auth | Fortify (Inertia SSR pages) |
| Password Policy | Production: min 12, mixed case, symbols. Dev: min 8 |

### 11.3 Caching Strategy

- **TTL:** 5 minutes (`300 seconds`) for all service-layer caches
- **Pattern:** `Cache::remember(key, ttl, closure)` on read, `Cache::forget(key)` on write
- **Cache Keys:** `{module}_all` (e.g., `customers_all`, `products_all`)
- **Dashboard:** `dashboard_stats_{period}`, `dashboard_recent_activity`
- **Predictions:** `sales_predictions_{period}`
- **Cross-module invalidation:** Creating a procurement with a new supplier also clears `suppliers_all` cache

### 11.4 Soft Delete Strategy

| Model | Method |
|-------|--------|
| Product | Custom `is_deleted` boolean + global scope (NOT `SoftDeletes`) |
| All others | Laravel `SoftDeletes` trait (`deleted_at` timestamp) |

All soft-deletable models set status=Inactive/Cancelled before soft-deleting to maintain consistency.

### 11.5 Audit Trail System

Every significant action is logged via the `AuditLogger` trait:
- **Actions:** CREATE, UPDATE, DELETE, LOGIN, LOGOUT, RESTORE, VOID, RETURN, STATUS_CHANGE
- **Storage:** `audit_trails` table (user_id, action, module, description, details JSON, IP, user_agent)
- **Coverage:** All CRUD controllers, auth controller, archive operations

### 11.6 Cost Traceability Chain

The system tracks costs through the entire supply chain:

```
Procurement (price_per_kg × quantity_kg = total_cost)
    ↓
DryingProcess (sacks × price × days = total_price)
    ↓
Processing (proportional split of procurement + drying costs)
    ↓
Product StockLog (cost_per_unit = total_cost / units_produced)
    ↓
Sale (profit_per_unit = selling_price - cost_per_unit)
```

Cost is calculated in `ProductService::computeProcessingCost()` and stored in every `StockLog` entry for historical tracking.

### 11.7 Number Generation Patterns

| Entity | Pattern | Example |
|--------|---------|---------|
| Sale Transaction | `ORD-YYYYMMDD-NNN` | `ORD-20250101-001` |
| Procurement Batch | `BATCH-YYYYMMDD-XXX` | `BATCH-20250101-001` |
| Delivery Assignment | `DEL-YYYYMMDD-NNN` | `DEL-20250101-001` |

All use date-based sequential numbering with zero-padded sequence numbers, querying the day's existing records to determine the next sequence.

### 11.8 Inline Entity Creation

Two controllers support creating related entities inline during their own creation:
- **ProcurementController** → can create a new `Supplier` inline (via `new_supplier` field)
- **SaleController** → can create a new `Customer` inline (via `new_customer` field)

### 11.9 State Machines

**Sale Status Flow:**
```
pending → processing (stock deducted) → shipped → delivered → completed
pending → cancelled (stock restored)
any → voided (stock restored, requires super_admin password, tracks voided_by + authorized_by)
delivered/completed → return_requested (via processReturn)
return_requested → picking_up (via acceptReturn, assigns pickup driver/plate/date)
return_requested → delivered (via rejectReturn, clears return fields)
picking_up → returned (via markReturned, stock NOT auto-restored)
returned/voided → restocked items (via restockItems, selective per-item restock)
```

**Drying Process Status Flow:**
```
Drying → Dried (via markAsDried)
Drying → Postponed (via postpone)
Drying/Postponed → Cancelled (via delete)
```

**Processing Status Flow:**
```
Pending → Processing (via process)
Processing → Completed (via complete, sets output_kg)
Completed → Processing (via returnToProcessing, clears output)
```

**Delivery Status Flow:**
```
assigned → picked_up → in_transit → delivered (increments driver count)
assigned/picked_up/in_transit → failed
any → cancelled
```

---

*Generated from full codebase analysis of all files in `laravel_backend/app/`.*
