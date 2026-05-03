# React Frontend Architecture Documentation

> **Project:** KJP Ricemill Management System  
> **Framework:** React 19.2.0 + Vite 7.2.4  
> **Styling:** Tailwind CSS 3.4.19 with CSS variable-based theming  
> **Location:** `react_frontend/`

---

## Table of Contents

1. [Entry Points & App Bootstrap](#1-entry-points--app-bootstrap)
2. [API Layer](#2-api-layer)
3. [Context (Global State)](#3-context-global-state)
4. [Hooks](#4-hooks)
5. [Layouts](#5-layouts)
6. [Pages](#6-pages)
7. [Components](#7-components)
8. [Styles & Theming](#8-styles--theming)
9. [Configuration](#9-configuration)
10. [Architecture Patterns & Conventions](#10-architecture-patterns--conventions)

---

## 1. Entry Points & App Bootstrap

### `src/main.jsx` (Entry Point)

Renders the root React tree into `#root`:

```
StrictMode
  └─ ThemeProvider        ← loads appearance settings, applies CSS variables
       └─ App
```

- `ThemeProvider` wraps everything so CSS variables are available before any rendering.

### `src/App.jsx` (213 lines)

Provides the full provider hierarchy and routing:

```
AuthProvider
  └─ BusinessSettingsProvider
       └─ ToastProvider
            └─ BrowserRouter
                 └─ AppRoutes
```

**`AppRoutes` component** defines all routes:

| Route Prefix | Layout | Allowed Roles | Guard |
|---|---|---|---|
| `/` | `PublicLayout` | Public (no auth) | None |
| `/superadmin/*` | `MainLayout` | `super_admin` | `ProtectedRoute` |
| `/admin/*` | `MainLayout` | `super_admin`, `admin` | `ProtectedRoute` |
| `/staff/*` | `StaffLayout` | `super_admin`, `admin`, `staff` | `ProtectedRoute` |
| `/client/*` | `ClientLayout` | `super_admin`, `admin`, `staff`, `client` | `ProtectedRoute` |
| `/driver/*` | `DriverLayout` | `super_admin`, `admin`, `driver` | `ProtectedRoute` |

**Key helper components in App.jsx:**

- **`RoleRedirect`** — After login, redirects users based on `user.role`:
  - `staff` → `/staff/dashboard`
  - `super_admin` → `/superadmin/dashboard`
  - default → `/admin/dashboard`
- **`PosRedirect`** — Routes POS access by role to the correct base path.

**Important:** Super Admin and Admin share **identical page components** but mount under different base paths (`/superadmin/` vs `/admin/`).

### `src/App.css`

Empty — all styling handled by Tailwind and `index.css`.

### `src/index.css` (706 lines)

- Imports Google Fonts (Inter, 300–700 weights)
- Tailwind directives (`@tailwind base/components/utilities`)
- **CSS variable definitions** (~300 lines of `:root` variables):
  - Color palette: `--color-primary-50` through `--color-primary-900`, `--color-button-*`, `--color-border-*`
  - Background colors: `--color-bg-sidebar`, `--color-bg-content`, `--color-bg-footer`
  - Text colors: `--color-text-sidebar`, `--color-text-content`, `--color-text-secondary`
  - Pagination colors: `--color-pagination-bg`, `--color-pagination-active`
  - Font sizes: `--font-size-base`, `--font-size-sidebar`
- **Dark mode overrides** (`body.dark-mode`, ~400 lines)
- **Custom animations**: `fadeIn`, `slideUp`, `slideInRight`, `slideInLeft`, `pulse`, `skeleton-shimmer`, `shake`
- **Custom scrollbar** styling (thin, translucent)
- **Sidebar hover effects** for menu items

---

## 2. API Layer

**Directory:** `src/api/` (14 files)

### `config.js` (126 lines)

Central configuration:

```js
API_BASE_URL = 'http://127.0.0.1:8000/api'
```

| Config | Value |
|---|---|
| `REQUEST_CONFIG.timeout` | 5000ms |
| `REQUEST_CONFIG.retries` | 2 |
| `CACHE_CONFIG.ttl` | 600000ms (10 min) |
| `CACHE_CONFIG.prefix` | `'kjp-'` |

**Endpoint groups defined:**

| Group | Key Endpoints |
|---|---|
| `AUTH` | login, logout, register, forgot-password, reset-password, user |
| `PRODUCTS` | list, show, featured, varieties |
| `ORDERS` | list, show, status, cancel |
| `INVENTORY` | list, show, low-stock, stock |
| `SALES` | list, summary, date-range, predictions |
| `USERS` | list, show, role |
| `DASHBOARD` | stats, recent-activity, refresh |
| `SETTINGS` | list, profile, avatar |
| `CONTACT` | send |
| `WEBSITE_CONTENT` | home, about, hero-image, seed-defaults |
| `DRIVERS` | list, show |
| `DELIVERIES` | list, show, status, assign |

### `apiClient.js` (470 lines) — Core HTTP Client

Built on native `fetch` with advanced features:

**Multi-layer caching (GET requests only):**
1. **In-memory Map** — instant retrieval within same session
2. **localStorage** — persistence across page refreshes
3. **Stale-while-revalidate** — serves cached data immediately, refreshes in background

**Key methods:**

| Method | Notes |
|---|---|
| `get(endpoint, options)` | Caching with TTL, stale-while-revalidate, skip/force-refresh options |
| `post(endpoint, data)` | JSON body, returns parsed response |
| `put(endpoint, data)` | Full update |
| `patch(endpoint, data)` | Partial update |
| `delete(endpoint)` | Delete resource |
| `upload(endpoint, formData)` | FormData handling for file uploads |

**Authentication:** Reads `auth_token` from `localStorage`, attaches as `Authorization: Bearer <token>`. On 401 responses, clears token and redirects to `/?login=true`.

**Exposed `cache` object:** `get`, `set`, `remove`, `clear` — used by API modules for manual cache invalidation.

### API Module Summary

| Module | File | Key Functions | Cache Strategy |
|---|---|---|---|
| **authApi** | `authApi.js` | `login`, `logout`, `register`, `forgotPassword`, `resetPassword`, `getCurrentUser`, `isAuthenticated`, `getToken` | Sets/clears `auth_token` in localStorage. `logout` clears all caches. |
| **businessSettingsApi** | `businessSettingsApi.js` | `getAll`, `update`, `uploadLogo` | `getAll` cached. `update`/`uploadLogo` invalidate cache. |
| **contactApi** | `contactApi.js` | `send(name, email, subject, message)` | No caching. |
| **dashboardApi** | `dashboardApi.js` | `getStats(period)`, `getRecentActivity(limit)`, `refresh` | `refresh` clears both frontend cache and calls backend refresh endpoint. |
| **inventoryApi** | `inventoryApi.js` | `getAll`, `getById`, `getLowStock`, `create`, `update`, `updateStock(id, qty, reason)`, `delete` | `updateStock` uses PATCH with quantity + reason. |
| **ordersApi** | `ordersApi.js` | `getAll`, `getById`, `create`, `updateStatus(id, status)`, `update`, `cancel`, `delete` | `updateStatus` uses PATCH. |
| **productsApi** | `productsApi.js` | `getAll`, `getFeatured`, `getVarieties`, `getById`, `create`, `update`, `delete` | `getAll`, `getFeatured`, `getVarieties`, `getById` all cached. CUD operations clear product caches. |
| **salesApi** | `salesApi.js` | `getAll`, `getSummary(period)`, `getByDateRange`, `create`, `getPredictions(period)`, `refreshPredictions` | `getSummary` and `getPredictions` cached. `create` invalidates summary caches. Also used by Orders page for return/restock/payment operations via direct `apiClient` calls. |
| **settingsApi** | `settingsApi.js` | `getAll`, `update`, `getProfile`, `updateProfile`, `uploadAvatar` | `uploadAvatar` uses FormData. |
| **usersApi** | `usersApi.js` | `getAll`, `getById`, `create`, `update`, `delete`, `updateRole(id, role)` | `updateRole` uses PATCH. |
| **websiteContentApi** | `websiteContentApi.js` | `getAll`, `getHomeContent`, `getAboutContent`, `saveHomeContent`, `saveAboutContent`, `uploadHeroImage`, `seedDefaults` | `uploadHeroImage` uses FormData. |

### `index.js`

Re-exports all API modules: `apiClient`, `authApi`, `businessSettingsApi`, `contactApi`, `dashboardApi`, `inventoryApi`, `ordersApi`, `productsApi`, `salesApi`, `settingsApi`, `usersApi`, `websiteContentApi`, plus `API_BASE_URL`, `ENDPOINTS`, `REQUEST_CONFIG`, `CACHE_CONFIG` from config.

---

## 3. Context (Global State)

**Directory:** `src/context/` (4 files)

### `AuthContext.jsx` (96 lines)

| Provided Value | Type | Description |
|---|---|---|
| `user` | object/null | Current authenticated user |
| `loading` | boolean | Auth state loading |
| `login(email, password)` | function | Calls `authApi.login`, stores token, sets user |
| `logout()` | function | Calls `authApi.logout`, clears state |
| `hasRole(role)` | function | Checks `user.role === role` |
| `isSuperAdmin` | boolean | `user.role === 'super_admin'` |
| `isAdmin` | boolean | `user.role === 'admin'` |
| `isStaff` | boolean | `user.role === 'staff'` |
| `isAdminOrAbove` | boolean | `super_admin` or `admin` |
| `isAuthenticated` | boolean | `!!user` |
| `basePath` | string | `'/superadmin'` for super_admin, `'/admin'` for others |

**On mount:** Checks localStorage for `auth_token`. If found, calls `authApi.getCurrentUser()` to restore session.

### `BusinessSettingsContext.jsx` (131 lines)

| Provided Value | Type | Description |
|---|---|---|
| `settings` | object | Business configuration (name, tagline, logo, contact, hours, footer, social) |
| `loading` | boolean | Settings loading state |
| `updateSettings(updates)` | function | Merges updates into settings, calls `businessSettingsApi.update`, updates localStorage |

**Default settings:**
```js
{
  business_name: 'KJP Ricemill',
  business_tagline: 'Inventory & Sales',
  business_logo: '/logo.svg',
  business_email: 'info@kjpricemill.com',
  business_phone: '+63 917-123-4567',
  business_address: 'Calapan City, Oriental Mindoro',
  business_hours: 'Mon-Sat: 7:00 AM - 6:00 PM',
  footer_tagline: '...',
  footer_copyright: '...',
  footer_powered_by: 'Powered by XianFire Framework. Built at Mindoro State University',
  social_facebook/twitter/instagram/linkedin: ''
}
```

**Initialization:** Loads from `localStorage('kjp-business-settings')` first, then syncs from API in background.

### `ThemeContext.jsx` (385 lines)

| Provided Value | Type | Description |
|---|---|---|
| `theme` | object | All theme properties (colors, font sizes, mode) |
| `updateTheme(updates)` | function | Merges updates, re-generates palettes, applies CSS variables |
| `saveTheme()` | function | Persists theme to API (`/api/appearance`) and localStorage |
| `resetTheme()` | function | Reverts to default theme |
| `defaultTheme` | object | Original default values |
| `loading` | boolean | Theme loading state |
| `saving` | boolean | Theme save in progress |

**Default theme colors:**

| Property | Default Value |
|---|---|
| `mode` | `'light'` |
| `primary_color` | `#22c55e` (green) |
| `button_primary` | `#7f0518` (dark red) |
| `button_secondary` | `#eab308` (yellow) |
| `border_color` | `#da2b2b` (red) |
| `hover_color` | `#16a34a` (dark green) |
| `bg_sidebar` | `#ffffff` |
| `bg_content` | `#f9fafb` |
| `text_sidebar` | `#374151` |

**Color palette generation:** Generates 50–900 shade arrays from a single hex color using HSL conversion (adjusting lightness). Applied as CSS variables (`--color-primary-50` through `--color-primary-900`).

**Lifecycle:**
1. Loads from `localStorage('kjp-theme')` on mount
2. Fetches from `/api/appearance` endpoint in background
3. Applies all values as CSS variables on `document.documentElement`
4. `saveTheme()` PUTs to API and saves to localStorage

### `index.js`

Re-exports: `AuthContext`, `useAuth`, `AuthProvider`, `BusinessSettingsContext`, `useBusinessSettings`, `BusinessSettingsProvider`, `ThemeContext`, `useTheme`, `ThemeProvider`.

---

## 4. Hooks

**Directory:** `src/hooks/` (2 files)

### `useDataFetch.js` (349 lines)

**`useDataFetch(fetchFn, options)`** — Primary data fetching hook.

| Option | Default | Description |
|---|---|---|
| `cacheKey` | null | Key for caching (enables in-memory + localStorage cache) |
| `cacheTTL` | 300000 (5min) | Time-to-live for cache entries |
| `staleTime` | 10000 (10s) | After staleTime, data is still served but refresh starts in background |
| `enabled` | true | Whether to execute the fetch |
| `dependencies` | [] | Refetch triggers |
| `onSuccess` | null | Callback after successful fetch |
| `onError` | null | Callback after failed fetch |

| Return Value | Type | Description |
|---|---|---|
| `data` | any | Fetched data |
| `loading` | boolean | Initial loading state |
| `error` | string/null | Error message |
| `isRefreshing` | boolean | Background refresh in progress |
| `refetch()` | function | Force re-fetch |
| `optimisticUpdate(updater)` | function | Optimistically mutate local data |
| `setData(data)` | function | Directly set data |

**`useMutation(mutationFn, options)`** — For POST/PUT/PATCH/DELETE operations.

| Option | Description |
|---|---|
| `onSuccess(data)` | Called after successful mutation |
| `onError(error)` | Called after failed mutation |
| `invalidateKeys` | Array of cache keys to invalidate after success |

| Return Value | Type |
|---|---|
| `mutate(args)` | Executes the mutation |
| `loading` | boolean |
| `error` | string/null |
| `data` | Response data |

**Also exports:** `invalidateCache(keyPattern)`, `clearAllCache()` utilities for manual cache control.

### `index.js`

Re-exports: `useDataFetch`, `useMutation`, `invalidateCache`, `clearAllCache`.

---

## 5. Layouts

**Directory:** `src/layouts/` (5 layouts + index)

### `MainLayout.jsx` (63 lines) — Admin/SuperAdmin

Used by `/admin/*` and `/superadmin/*` routes.

```
┌─────────────────────────────────────────┐
│ Header (mobile only, <1024px)           │
├──────┬──────────────────────────────────┤
│      │                                  │
│ Side │    Content Area                  │
│ bar  │    (bordered card container)     │
│      │                                  │
│      │                                  │
├──────┴──────────────────────────────────┤
│ Footer (desktop only, ≥1024px)          │
├─────────────────────────────────────────┤
│ BottomNav (mobile only, <768px)         │
└─────────────────────────────────────────┘
```

- **Sidebar:** Collapsible. Collapsed = 80px, Expanded = 288px. State persisted.
- **Header:** Sticky top, visible only on mobile/tablet (`<lg`). Has hamburger for tablet sidebar toggle.
- **BottomNav:** Horizontally scrollable navigation bar, visible only on mobile (`<md`).
- **Footer:** Visible only on desktop (`≥lg`).
- Content area wrapped in a bordered card with theme border color.

### `StaffLayout/` (276 lines) — Staff Portal

Self-contained layout with built-in sidebar, header, and bottom nav (not using shared components):

- **StaffSidebar** — 3 items: Dashboard, POS, Profile. Uses `NavLink` for active state.
- **StaffHeader** — Mobile header with business branding.
- **StaffBottomNav** — 3-item mobile bottom nav.
- Has its own logout confirmation modal (`ConfirmModal`).

### `PublicLayout/` (338 lines) — Public Website

- **Scroll-aware header:** Transparent at top → white with shadow after 50px scroll.
- **Responsive nav:** Desktop inline links; mobile hamburger with slide-down menu.
- **Login button** opens `LoginModal` (or triggers from URL `?login=true`).
- **Footer:** 3-column (Company, Products, Contact), social links, decorative pattern.
- **Scroll-to-top button** appears after 300px scroll.
- Nav items: Home, About, Products, Contact.

### `ClientLayout/` (328 lines) — Customer Portal

- Top header with logo, nav links (Home, Shop, Orders, Settings), profile dropdown.
- Profile dropdown shows user name, email, role with avatar.
- Mobile bottom nav with 5 items (Home, Shop, Cart, Orders, Profile).
- Uses `useTheme()` for dynamic styling.

### `DriverLayout/` (306 lines) — Driver Portal

- Similar structure to `ClientLayout`.
- Truck icon branding.
- Nav: Dashboard, Deliveries, Profile, Settings.
- Profile dropdown shows vehicle info (plate number, vehicle type).
- Mobile bottom nav with 4 items.

---

## 6. Pages

**Directory:** `src/pages/` (6 subdirectories)

### Admin Pages (`src/pages/admin/`)

These pages are shared between `/admin/*` and `/superadmin/*` routes. They use `basePath` from `AuthContext` to generate correct links.

#### `Dashboard.jsx` (517 lines)

Overview page with period toggle (daily/monthly/yearly).

| Section | Data Source | Visualization |
|---|---|---|
| Stats Cards | `dashboardApi.getStats(period)` | 4 cards: Revenue, Orders, Products, Customers with trends |
| Pipeline Flow | `dashboardApi.getStats` | Horizontal bar showing Procurement→Drying→Processing→Orders→Deliveries counts |
| Revenue Chart | `dashboardApi.getStats` | `LineChart` with period toggle |
| Top Products | `dashboardApi.getStats` | `BarChart` (horizontal) |
| Inventory Health | `dashboardApi.getStats` | `DonutChart` with stock status breakdown |
| Recent Sales | `dashboardApi.getRecentActivity` | `DataTable` |
| Low Stock Alerts | `dashboardApi.getStats` | `DataTable` with color-coded severity |
| Activity Timeline | `dashboardApi.getRecentActivity` | Vertical timeline list |

#### `Procurement.jsx` (2347 lines)

Full CRUD for rice procurement with batch management.

- **Tabs:** Records | Batches
- **SupplierCombobox:** Select existing supplier or create new inline (auto-suggestion with debounce).
- **Batch System:** Create batches from multiple procurement records; send entire batch to drying.
- **Individual Flow:** Send individual procurement record to drying.
- **Modals:** Add, Edit, View, Delete confirmation, Batch creation, Send-to-drying.
- **APIs:** `/procurements`, `/suppliers`, `/varieties`, `/procurement-batches`
- **Cache invalidation** on all mutations.

#### `DryingProcess.jsx` (1003 lines)

Manages rice drying processes.

- Supports both **individual procurement → drying** and **batch → drying** flows.
- **Actions:** Increment day counter, mark as dried, postpone.
- Dropdown selector for procurement/batch source.
- **API:** `/drying-processes` with related cache invalidation.

#### `Processing.jsx` (1439 lines)

Rice milling/processing after drying.

- **Tabs:** Active | Completed
- Multi-select drying sources grouped by batch.
- **Complete processing** form: `output_kg`, `husk_kg`, `yield_percent`.
- **Return to drying** flow for incomplete processing.
- **APIs:** `/processings/active`, `/processings/completed`

#### `Products.jsx` (625 lines)

Product CRUD with variety dropdown.

- **Form fields:** product_name, variety_id, price, weight, status, **image upload** (file picker, jpeg/png/jpg/webp, max 2MB)
- Image preview in product cards and form.
- Uses `FormData` for create/update to support file upload.
- Cost analysis fetch on edit.
- **APIs:** `/products`, `/varieties`

#### `Varieties.jsx` (497 lines)

Rice variety management.

- **Form fields:** name, description, color (with preset color picker), status
- **API:** `/varieties`

#### `Inventory.jsx` (2580 lines)

Largest page. 4-tab view:

| Tab | Content |
|---|---|
| Inventory | Product stock levels, stock floor alerts |
| In/Out | Stock movement logs (additions/deductions) |
| Growth | Stock trend charts over time |
| Costs | Cost analysis per product (procurement cost → processing → final price) |

- Add stock from completed processings.
- URL-persisted tab state.
- **APIs:** `/products`, `/varieties`, `/processings/completed`, `/stock-logs`, `/sales`

#### `Sales.jsx` (394 lines)

Revenue analytics.

- **Toggle:** Overview | Predictions
- Filter by status: Delivered, Returned, Cancelled, Voided.
- Revenue chart with period toggle.
- Embeds `PredictiveAnalytics` component.
- **API:** `/sales`

#### `PredictiveAnalytics.jsx` (367 lines)

Sales forecasting component (embedded in Sales page).

- Historical + forecast line charts.
- Demand trends visualization.
- Stock status breakdown.
- **APIs:** `salesApi.getPredictions(period)`, `salesApi.refreshPredictions`

#### `Orders.jsx` (617 lines)

Admin order management.

- **Status flow:** Pending → Processing → Shipped → Delivered
- **Return flow:** Accept return (assign pickup driver/plate/date), Reject return (revert to delivered), Mark as returned
- **Restock per-item:** Select individual items to restock from returned/voided orders with quantity inputs
- **Record Payment:** Upload payment proof for unpaid orders (Pay Later/COD)
- **Void tracking:** Shows `voided_by` and `authorized_by` in order details
- Cancel orders with confirmation.
- Status tabs with URL persistence.
- **API:** `/sales` (admin orders and sales share same API — includes `/return/accept`, `/return/reject`, `/return/complete`, `/restock`, `/pay`)

#### `Partners.jsx` (181 lines)

Hub page linking to Supplier + Customer sub-pages.

- Combined partner stats (total suppliers, customers, recent).
- Recent partners table.
- `DonutChart` breakdown of partner types.

#### `Supplier.jsx` (640 lines)

Supplier CRUD.

- Debounced email uniqueness check during create/edit.
- Calculates total kg procured per supplier.
- **APIs:** `/suppliers`, `/procurements`

#### `Customer.jsx` (615 lines)

Customer CRUD.

- Debounced email uniqueness check.
- **API:** `/customers`

#### `Settings.jsx` (2243 lines)

Massive settings page. Contains multiple sections:

- **Appearance:** Theme color pickers using custom `AppearanceColorPicker` component (uses native `<input type="color">` to avoid React re-render issues).
- **Business Info:** Name, tagline, logo upload, contact details, hours.
- **Website Content:** Hero images, home page content, about page content.
- **Audit Trail tab:** Embeds `AuditTrail` component.
- **Archives tab:** Embeds `Archives` component.
- **Admin Accounts tab:** Embeds `AdminAccounts` component.
- **Contexts used:** `ThemeContext`, `AuthContext`, `BusinessSettingsContext`
- **APIs:** `websiteContentApi`, `businessSettingsApi`

#### `AdminAccounts.jsx` (207 lines)

Admin user management. **Super Admin only.**

- CRUD for admin-role users.
- Uses `usersApi` with `role='admin'` filter.

#### `StaffManagement.jsx` (249 lines)

Staff management.

- CRUD with positions: Secretary, Driver.
- Uses `usersApi` with `role='staff'` filter.

#### `Archives.jsx` (328 lines)

Soft-deleted records viewer.

- Module-based icons and colors.
- **Actions:** Restore, Permanent Delete.
- **APIs:** `/archives`, `/archives/statistics`

#### `AuditTrail.jsx` (251 lines)

Activity log viewer.

- Stats: today's actions, create/update/delete counts.
- Detail modal for individual entries.
- **API:** `/audit-trails`

### Shared Pages

#### `PointOfSale.jsx` (1226 lines) — `src/pages/admin/PointOfSale.jsx`

Full POS system used by admin and staff roles.

- **CustomerCombobox:** Select existing or create new customer inline.
- Product grid with search and variety filter.
- **Cart management:** Add, remove, adjust quantity.
- **Payment methods:**
  - **Cash:** With change calculation.
  - **GCash:** Reference number required.
- **Void transaction:** Requires password verification.
- **APIs:** `/products`, `/sales`, `/varieties`, `/customers`

### Auth Pages (`src/pages/auth/`)

#### `Login.jsx` (270 lines)

Standalone login page (used for direct navigation, distinct from `LoginModal`).

- Field validation with color-coded borders (green = valid, red = error).
- Show/hide password toggle.
- Shake animation on submission error.
- Role-based redirect after login.
- Uses `AuthContext` + `BusinessSettingsContext`.

### Public Pages (`src/pages/public/`)

All public pages use API data with localStorage caching fallback.

#### `Home.jsx` (440 lines)

Landing page sections:
- Hero section (dynamic content from `websiteContentApi.getHomeContent`)
- Featured products grid (from `productsApi`) with **product images** and `useBusinessSettings` business logo fallback
- About preview section
- Stats counters
- Features showcase
- Testimonials

#### `About.jsx` (370 lines)

- Company story, mission/vision
- Values section
- History timeline
- Team section
- Data from `websiteContentApi.getAboutContent` with localStorage cache

#### `Products.jsx` (430 lines)

Public product catalog.
- Search, variety filter, sort options
- Grid/list view toggle
- **Normalizer function** maps API fields to display fields: `product_name`→`name`, `variety_name`→`variety`/`tags`, `weight_formatted`→`description`, `is_in_stock`→`inStock`
- **Product images** displayed from API `image` field with `useBusinessSettings` business logo fallback
- `productsApi.getAll` + `productsApi.getVarieties`

#### `Contact.jsx` (424 lines)

- Contact form with inquiry type selection
- Contact info cards (address, phone, email, hours)
- FAQ accordion
- Note: Contact form simulates API call (not fully connected)

### Client Pages (`src/pages/client/`)

> **Status:** Most client pages use **mock data** — not yet connected to the API.

#### `ClientDashboard.jsx` (397 lines)

- Summary cards (total orders, spent, pending, wishlist)
- Spending chart with period toggle (daily/monthly/yearly) using Recharts directly
- Order status breakdown
- **Mock data**

#### `Shop.jsx` (697 lines)

- Product browsing with search and variety filter
- Grid/list view toggle
- POS-style order builder (add to cart, quantity management)
- **Mock data**

#### `Cart.jsx` (423 lines)

- Shopping cart with quantity management
- Promo code input
- Order summary (subtotal, shipping, discount, total)
- Checkout flow
- **Mock data**

#### `Orders.jsx` (507 lines)

- Order list with status tabs (All, Pending, Processing, Shipped, Delivered)
- Search functionality
- Expandable order details
- Return request flow with reason selection
- **Mock data**

#### `Profile.jsx` (617 lines)

- 3 tabs: Profile, Addresses, Security
- URL-persisted tab state (`?tab=profile`)
- Profile edit form, address management, password change
- **Mock data**

#### `Settings.jsx` (365 lines)

- 3 sections: Appearance (theme mode, font size), Profile, Password
- Uses `useTheme()` for dynamic styling
- **Mock data**

### Driver Pages (`src/pages/driver/`)

> **Status:** All driver pages use **mock data** — not yet connected to the API.

#### `DriverDashboard.jsx` (396 lines)

- Stats cards (today's deliveries, pending, in transit, delivered, failed)
- Delivery activity chart with period toggle using Recharts
- Status distribution PieChart
- Today's deliveries list with status config colors
- **Mock data** (empty arrays/zero values)

#### `Deliveries.jsx` (430 lines)

- Status tabs: All, Pending, In Transit, Delivered, Failed
- URL-persisted tab state
- Search by delivery number, destination, customer
- Expandable delivery details
- Action modals (start delivery, complete, report failure) with driver notes
- **Mock data**

#### `DriverProfile.jsx` (312 lines)

- Driver info card (name, email, phone, address)
- Vehicle details (license number, vehicle type, plate number)
- Performance stats (total deliveries, successful, failed, success rate)
- Edit mode with save/cancel
- **Mock data**

#### `DriverSettings.jsx` (382 lines)

- Appearance (theme mode, font size), Profile (with vehicle fields), Password
- Similar structure to Client Settings
- **Mock data**

### Staff Pages (`src/pages/staff/`)

> **Status:** Staff pages use **mock data** — will connect to API.

#### `StaffDashboard.jsx` (247 lines)

- Uses shared UI components (`PageHeader`, `DataTable`, `StatsCard`, `DonutChart`)
- Stats: total sales, revenue, items sold, low stock count
- Low stock items table with `DataTable`
- Stock distribution `DonutChart`
- Recent activities list
- Reads CSS variables via `getCSSVariable()` and `MutationObserver` for theme reactivity
- **Mock data** (all empty)

#### `StaffProfile.jsx` (230 lines)

- Profile card with avatar initials, role badge
- Employee details: ID, department, hire date
- Login history table
- Current session info (login time, IP, device, browser)
- Read-only notice ("Profile can only be updated by an administrator")
- Uses shared UI: `PageHeader`, `Card`, `CardContent`, `StatusBadge`, `Avatar`
- **Mock data**

---

## 7. Components

**Directory:** `src/components/` (4 subdirectories)

### Auth Components (`src/components/auth/`)

#### `ProtectedRoute.jsx` (73 lines)

Route guard wrapper. Checks authentication and role-based access.

| Export | Allowed Roles |
|---|---|
| `ProtectedRoute` | Configurable via `allowedRoles` prop |
| `AdminRoute` | `super_admin`, `admin` |
| `SuperAdminRoute` | `super_admin` only |
| `StaffRoute` | `staff` only |
| `SharedRoute` | `super_admin`, `admin`, `staff` |

**Behavior:**
- If not authenticated → redirect to `/?login=true` with return location state
- If wrong role → redirect to appropriate dashboard based on user's actual role
- Shows loading spinner during auth check

### Common Components (`src/components/common/`)

#### `PageHeader.jsx` (25 lines)

Reusable page header with icon, title, and description.

```jsx
<PageHeader title="Dashboard" description="Overview of your business" icon={LayoutDashboard} />
```

- Icon displayed in gradient button-500 rounded square with shadow.
- Title uses `--color-text-content` CSS variable with scaled font size.
- Description uses `--color-text-secondary`.

#### `Header.jsx` (99 lines)

Mobile/tablet header bar (hidden on desktop `≥lg`).

- Sticky top with `border-b-2 border-primary-300`.
- Hamburger button (tablet only, `md` to `lg`).
- Business logo + name + "Management System" subtitle.
- Account dropdown: user info, "Account Settings", "Logout" button.
- Uses gradient button colors for avatar and branding elements.

#### `Footer.jsx` (152 lines)

Admin footer (shown on desktop only).

- 3-column grid: Company Info, Quick Links, Contact Info.
- Pulls data from `BusinessSettingsContext` (business name, address, phone, email, hours).
- **Role-aware Quick Links:** Uses `useAuth()` for `basePath` and `isStaff()`.
  - Admin/Super Admin: Products, POS, Orders, Procurement, Sales (using `basePath`)
  - Staff: POS, Profile (hardcoded `/staff/*` paths)
- Social media links (filtered — only shows configured ones).
- Bottom bar: copyright, "Powered by XianFire Framework. Built at Mindoro State University".
- Dark background (`--color-bg-footer`).

#### `BottomNav.jsx` (210 lines)

Mobile bottom navigation (hidden on `≥md`).

- Horizontally scrollable nav items with touch support.
- Items: Dashboard, Procurement, Processing, Products (with submenu: Varieties, Inventory), POS, Partners (with submenu: Supplier, Customer), Staff, Sales, Settings.
- Active state: gradient button background with white text and shadow.
- Submenu: Expandable panel above bottom nav with backdrop overlay.
- Uses `basePath` from `AuthContext`.

### Sidebar Components (`src/components/sidebar/`)

#### `Sidebar.jsx` (352 lines)

Main admin sidebar navigation.

- **Responsive:** Full width on mobile (slide-in with backdrop), collapsible on desktop.
- **Collapse behavior:** Collapsed shows icons only (80px), expanded shows icon + label (288px).
- **Business branding:** Logo from `BusinessSettingsContext`, fallback to wheat icon.
- **Navigation items** (using `SidebarMenuItem`):
  - Dashboard, Procurement, Drying, Processing
  - Products (submenu: Varieties, Inventory)
  - Point of Sale, Orders
  - Partners (submenu: Supplier, Customer)
  - Staff Management, Sales, Settings
- **Auto-expand** submenus based on current route.
- **User footer:** Avatar with initials, name, role label, logout button.
- **Logout:** Confirmation via `ConfirmModal`.
- Uses `basePath` from `AuthContext` for all links.

#### `SidebarMenuItem.jsx` (97 lines)

Individual sidebar navigation item.

- **Regular item:** `NavLink` with active state detection (gradient background).
- **Submenu parent:** Button that navigates + toggles submenu. Shows `ChevronRight`/`ChevronDown`.
- **Collapsed mode:** Hides labels, centers icons, shows tooltip on hover.
- Active style: `bg-gradient-to-r from-button-500 to-button-400 text-white shadow-lg`.
- Hover style: `hover:bg-button-50 hover:text-button-700`.

#### `SidebarSubMenuItem.jsx` (25 lines)

Submenu child item.

- Active: `bg-button-500/30 text-button-600 font-medium`
- Inactive: `hover:bg-button-500/20` with reduced opacity.

### UI Components (`src/components/ui/`)

#### `Button.jsx` (50 lines)

`forwardRef`-based button component.

| Prop | Options | Default |
|---|---|---|
| `variant` | `default`, `secondary`, `outline`, `ghost`, `danger`, `success`, `warning`, `info` | `default` |
| `size` | `xs`, `sm`, `md`, `lg` | `md` |
| `icon` | Lucide icon component | none |
| `iconPosition` | `left`, `right` | `left` |

- `default` and `success` both use `bg-button-500` (theme-aware).
- `outline` uses `border-primary-300`.
- All variants have focus rings, disabled states, and hover transitions.

#### `Card.jsx` (37 lines)

Card container with themed borders.

| Export | Description |
|---|---|
| `Card` | Container: white bg, `border-2 border-primary-300`, rounded-xl, shadow |
| `CardHeader` | Header section with bottom border |
| `CardContent` | Content section with padding |
| `CardFooter` | Footer section with top border |

#### `DataTable.jsx` (482 lines)

Feature-rich data table component.

| Feature | Description |
|---|---|
| **Sorting** | Click column headers to sort (asc/desc), custom sort functions |
| **Search** | Full-text search across all columns with `SearchInput` |
| **Filtering** | Dropdown filter on specified field + date range filter |
| **Pagination** | Integrated `Pagination` component, configurable items per page |
| **Selection** | Checkbox row selection with select-all |
| **Row Actions** | `onRowClick`, `onRowDoubleClick` handlers |
| **Date Filter** | Start/end date inputs with reset button (timezone-aware: `+08:00`) |
| **Card View** | Optional mobile card layout via `cardConfig` |
| **Empty State** | Configurable empty message |

Props: `columns`, `data`, `title`, `subtitle`, `onAdd`, `addLabel`, `searchable`, `pagination`, `defaultItemsPerPage`, `emptyMessage`, `selectable`, `filterField`, `filterOptions`, `dateFilterField`, `cardConfig`.

#### `SearchInput.jsx` (26 lines)

Simple search input with Lucide Search icon. Themed with `border-primary-200` and `focus:ring-primary-500`.

#### `Pagination.jsx` (115 lines)

Page navigation component.

- Shows "Showing X to Y of Z entries".
- Items per page dropdown (5, 10, 20, 50).
- Page number buttons with ellipsis for large page counts.
- First/prev/next/last navigation buttons.
- Active page: `bg-button-500 text-white`.

#### `StatusBadge.jsx` (36 lines)

Status pill badge with auto-detected colors.

| Status Keywords | Color |
|---|---|
| active, completed, dried, in stock, paid, approved, delivered | Green (success) |
| pending, low stock, drying, warning, postponed, return requested, picking up | Yellow (warning) |
| inactive, cancelled, voided, out of stock, rejected, failed, returned | Red (danger) |
| info, new, draft, shipped, processing | Blue (info) |

All variants include `dark:` mode overrides (e.g., `dark:bg-green-500/15 dark:text-green-400`).

Override auto-detection with explicit `variant` prop.

#### `StatsCard.jsx` (35 lines)

Metric card with icon, value, unit, and trend indicator.

- Gradient background from `primary-50`.
- Value displayed in `text-button-600`.
- Optional trend: positive (green, +X%), negative (red, -X%).
- Icon in colored rounded square.

#### `ActionButtons.jsx` (42 lines)

Row action buttons group.

| Action | Icon | Color |
|---|---|---|
| View | Eye | Blue |
| Edit | Edit | Button (theme) |
| Archive | Archive | Amber |
| Delete | Trash2 | Red |

Each button calls its handler with `e.stopPropagation()` to prevent row click.

#### `Avatar.jsx` (42 lines)

User avatar component.

- **With image:** Renders `<img>` with circular clip.
- **Without image:** Gradient circle (`from-button-500 to-button-600`) with initials.
- Sizes: `sm` (32px), `md` (40px), `lg` (48px), `xl` (64px).

#### `LineChart.jsx` (281 lines)

Recharts-based line/area chart wrapper.

- **Theme-aware:** Reads CSS variables via `getCSSVariable()` + `MutationObserver`.
- **Dark mode detection:** `useIsDarkMode()` hook watches `body.dark-mode` class.
- **Custom tooltip** with period-over-period % change calculation.
- **Clickable legend** to toggle line visibility (can't hide all lines).
- **Support for:** Line chart or Area chart (`areaChart` prop).
- **Tab switching:** Built-in period tabs (daily/monthly/yearly).
- **Summary stats** row above chart.
- **Y-axis formatting:** Supports currency (₱) and unit suffixes.
- **Clickable dots** with `onDotClick` callback and `activePoint` highlighting.

#### `BarChart.jsx` (145 lines)

Recharts-based bar chart wrapper.

- Theme-aware (same CSS variable pattern as LineChart).
- Supports `vertical` and `horizontal` layouts.
- Clickable legend to toggle bar visibility.
- Dark mode tooltip styling.
- Multiple bars with theme-generated colors.

#### `DonutChart.jsx` (243 lines)

Recharts PieChart wrapper for donut-style charts.

- **Layouts:** Standard (chart above legend) or horizontal (chart beside legend).
- **Center label:** Custom value + label displayed in donut hole.
- **Compact mode:** Auto-detected when `height ≤ 120` or explicitly set.
- **Legend:** Full or compact, supports 2-column grid for many items.
- **Value display:** With unit suffix and percentage calculation.
- Theme-aware, dark mode support.

#### `DateFilter.jsx` (85 lines)

Period toggle with optional custom date range.

- Period buttons: Daily | Monthly | Yearly (in rounded border group).
- Custom date toggle: Opens start/end date inputs.
- Calls `onChange({ type, start?, end? })`.

#### `FormElements.jsx` (241 lines)

Form input components with validation UX.

| Export | Type | Features |
|---|---|---|
| `FormInput` | Text/email/number input | Required/optional labels, validation status (✓/✗ icons), shake animation on submit error, loading state ("Checking availability..."), hint text, auto-touching on blur |
| `FormSelect` | Dropdown select | Same validation UX as FormInput, dropdown arrow, required indicator |
| `FormTextarea` | Textarea | Same validation UX, configurable rows |

**Validation pattern:**
- On blur: marks field as "touched"
- If required + touched + empty → shows red border + "This field is required"
- If required + has value + no error → shows green border + check icon
- On form submit: all empty required fields shake

#### `Modal.jsx` (248 lines)

Three modal components:

| Export | Description |
|---|---|
| `Modal` | Base modal with overlay, escape key handling, body scroll lock (preserves scroll position), portal rendering. Sizes: sm, md, lg, xl, 2xl, full. |
| `ConfirmModal` | Centered confirmation dialog with icon, message, confirm/cancel buttons. Variants: danger, warning, info, success, primary. |
| `FormModal` | Form wrapper modal with submit/cancel footer. Built-in required field validation with shake animation. Prevents double submission. |

**Modal features:**
- Renders via `createPortal` to `document.body` (z-index: 9999).
- `backdrop-blur-sm` overlay.
- Body scroll lock using `position: fixed` technique (preserves scroll position).
- Escape key closes modal.
- Click overlay to close (configurable).

#### `LoginModal.jsx` (254 lines)

Login modal used by `PublicLayout`.

- Email + password fields with Lucide icons.
- Validation mimics `FormInput` pattern (green/red borders, check/alert icons).
- Show/hide password toggle.
- Shake animation on empty fields.
- Role-based redirect after successful login.
- Reset form state on close.

#### `Skeleton.jsx` (218 lines)

Skeleton loading components.

| Export | Description |
|---|---|
| `Skeleton` | Base skeleton element. Variants: text, title, avatar, button, card, image, input, circle, custom. Configurable width, height, count, rounded corners. Uses `animate-skeleton-pulse`. |
| `SkeletonCard` | Pre-built card loading state (avatar + title + text lines) |
| `SkeletonTable` | Table loading state (header row + data rows) |
| `SkeletonForm` | Form loading state (input fields) |
| `SkeletonStats` | Stats cards loading state |
| `SkeletonList` | List items loading state |
| `SkeletonSettings` | Settings page loading state |
| `SkeletonDashboard` | Full dashboard loading state |

#### `Tabs.jsx` (42 lines)

Simple tab component with icons.

- Tab headers with active state (bottom border highlight, primary-colored).
- Renders active tab's `content` property.
- `onChange` callback with tab index.

#### `Toast.jsx` (124 lines)

Toast notification system.

| Export | Description |
|---|---|
| `ToastProvider` | Context provider + toast container (fixed top-right, z-index: 99999) |
| `useToast()` | Returns `{ addToast, success, error, warning, info }` |

**Toast types:** success (primary colors), error (red), warning (yellow), info (primary).

- Auto-dismiss: 2 seconds default.
- Left border accent color.
- Slide-in-right animation.
- Manual dismiss via X button.

#### `index.js`

Re-exports all 20 UI components:
`Button`, `Avatar`, `Card`/`CardHeader`/`CardContent`/`CardFooter`, `SearchInput`, `Pagination`, `DataTable`, `StatusBadge`, `ActionButtons`, `StatsCard`, `LineChart`, `DonutChart`, `BarChart`, `Tabs`, `DateFilter`, `Modal`/`ConfirmModal`/`FormModal`, `LoginModal`, `ToastProvider`/`useToast`, `FormInput`/`FormSelect`/`FormTextarea`, `Skeleton`/`SkeletonCard`/`SkeletonTable`/`SkeletonForm`/`SkeletonStats`/`SkeletonList`/`SkeletonSettings`/`SkeletonDashboard`.

---

## 8. Styles & Theming

### Theming Architecture

The application uses a **3-layer theming system:**

```
Layer 1: CSS Variables (index.css)
    ↓ overridden by
Layer 2: ThemeContext (runtime JS → document.documentElement.style)
    ↓ persisted to
Layer 3: API (/api/appearance) + localStorage
```

### CSS Variable Namespace

| Namespace | Examples | Used For |
|---|---|---|
| `--color-primary-*` | 50, 100, 200, ..., 900 | General brand colors, borders, backgrounds |
| `--color-button-*` | 50, 100, 200, ..., 900 | Action buttons, active states, CTAs |
| `--color-border-*` | 50, 100, 200, ..., 900 | Border colors throughout the app |
| `--color-bg-*` | sidebar, content, footer, card | Background colors |
| `--color-text-*` | sidebar, content, secondary | Text colors |
| `--color-pagination-*` | bg, active, text, inactive-text | Pagination component colors |
| `--font-size-*` | base, sidebar | Font sizing |

### Tailwind Integration

`tailwind.config.js` extends the default theme with CSS variable references:

```js
colors: {
  primary: { 50-900: 'var(--color-primary-X)' },
  button:  { 50-900: 'var(--color-button-X)' },
  border:  { 50-900: 'var(--color-border-X)' },
  secondary: { 50-900: 'var(--color-secondary-X)' },
}
```

This enables Tailwind classes like `bg-primary-500`, `border-button-300`, `text-primary-900` that automatically respond to theme changes.

**Safelist patterns:** `button-*`, `primary-*`, `border-*` (bg, text, border, from, to, via, shadow, ring, outline, divide) — ensures dynamic class names aren't purged.

### Dark Mode

- Strategy: `darkMode: 'class'`
- Applied via `body.dark-mode` CSS class
- ~400 lines of dark mode CSS variable overrides in `index.css`
- Components use Tailwind's `dark:` prefix utilities

### `src/styles/borders.js` (28 lines)

Reusable border style constants:

```js
borderStyles = {
  card: 'border-2 border-primary-300 rounded-xl shadow-lg shadow-primary-100/50',
  table: 'border-2 border-primary-400',
  input: 'border-2 border-primary-300 rounded-xl focus:border-primary-500 focus:ring-primary-500',
  active: 'border-2 border-button-400',
  hover: 'hover:border-primary-400',
  stats: 'border-2 border-primary-400 rounded-xl shadow-lg shadow-primary-100/50',
}
```

Also exports combined class presets: `cardBorder`, `tableBorder`, `inputBorder`, `activeBorder`.

### Custom Animations (defined in index.css)

| Animation | Usage |
|---|---|
| `fadeIn` | Modal overlay appearance |
| `slideUp` | Modal content entrance |
| `slideInRight` | Toast notifications |
| `slideInLeft` | Page transitions |
| `pulse` | Loading indicators |
| `skeleton-shimmer` / `skeleton-pulse` | Skeleton loading states |
| `shake` | Form validation error |

---

## 9. Configuration

### `package.json`

| Dependency | Version | Purpose |
|---|---|---|
| `react` | 19.2.0 | UI framework |
| `react-dom` | 19.2.0 | DOM rendering |
| `react-router-dom` | 7.13.0 | Client-side routing |
| `recharts` | 3.7.0 | Charts (Line, Bar, Pie/Donut) |
| `lucide-react` | 0.563.0 | Icon library |
| `tailwindcss` | 3.4.19 | Utility-first CSS |
| `autoprefixer` | 10.4.21 | CSS vendor prefixes |
| `postcss` | 8.5.4 | CSS processing |

| Dev Dependency | Version | Purpose |
|---|---|---|
| `vite` | 7.2.4 | Build tool & dev server |
| `@vitejs/plugin-react` | 4.7.0 | React HMR & JSX transform |
| `@eslint/js` | 9.28.0 | ESLint core |
| `eslint-plugin-react-hooks` | 5.2.0 | React hooks linting |
| `eslint-plugin-react-refresh` | 0.4.20 | React Refresh linting |
| `globals` | 15.15.0 | Global variable definitions |

**Scripts:**
- `dev` → `vite` (dev server)
- `build` → `vite build` (production build)
- `lint` → `eslint .`
- `preview` → `vite preview`

### `vite.config.js`

Minimal configuration:
```js
export default defineConfig({
  plugins: [react()],
})
```

No path aliases, no proxy config, no special build settings.

### `tailwind.config.js`

- **Content paths:** `./index.html`, `./src/**/*.{js,ts,jsx,tsx}`
- **Dark mode:** `class` strategy
- **Theme extensions:** CSS variable-based color system (primary, button, border, secondary)
- **Safelist:** Dynamic button/primary/border patterns to prevent class purging
- **Plugins:** None

### `postcss.config.js`

Standard: `tailwindcss` + `autoprefixer`.

### `eslint.config.js`

Flat config format with:
- Browser globals
- React Hooks plugin (recommended)
- React Refresh plugin (warn on non-component exports)
- Parses JSX

---

## 10. Architecture Patterns & Conventions

### Data Flow Pattern

```
User Action → Page Component → API Module → apiClient → Laravel Backend
                                    ↓
                              Cache Layer (memory + localStorage)
                                    ↓
                              State Update → Re-render
```

### Caching Strategy

| Layer | TTL | Scope | Implementation |
|---|---|---|---|
| `apiClient` memory cache | 10 min | GET requests with `useCache: true` | In-memory Map |
| `apiClient` localStorage | 10 min | GET requests with `useCache: true` | `kjp-` prefixed keys |
| `useDataFetch` hook cache | 5 min | Per-hook instance | In-memory Map + localStorage |
| Page-level localStorage | varies | Individual pages (Home, About) | Manual `localStorage.setItem` |

### State Management Approach

- **Global state:** React Context (Auth, BusinessSettings, Theme, Toast)
- **Server state:** `useDataFetch` hook with caching
- **Local state:** `useState` within components
- **URL state:** `useSearchParams` for tab persistence

### File Organization Conventions

- Pages: `src/pages/{role}/{PageName}/{PageName}.jsx` with `index.js` barrel exports
- Components: `src/components/{category}/{ComponentName}.jsx` with `index.js` barrel
- API: `src/api/{resource}Api.js` with central `index.js`
- One component per file (except `FormElements.jsx` and `Modal.jsx`)

### Styling Conventions

- Tailwind utility classes as primary styling method
- CSS variables for theme-dynamic values
- Inline `style={}` for values that must reference theme object properties directly
- Gradient patterns: `bg-gradient-to-br from-button-500 to-button-600` for highlights
- Consistent border style: `border-2 border-primary-300` (or 400 for emphasis)
- Shadow pattern: `shadow-lg shadow-primary-100/50`

### Date/Time Handling

- All dates formatted with `Asia/Manila` timezone (`en-PH` locale)
- Date filter inputs use `+08:00` timezone offset for accurate comparison
- `toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', ... })` pattern used consistently

### Responsive Breakpoints

| Breakpoint | Usage |
|---|---|
| `<md` (< 768px) | Mobile: BottomNav visible, Header visible, Sidebar hidden |
| `md` to `lg` | Tablet: Header with hamburger, Sidebar slide-in |
| `≥lg` (≥ 1024px) | Desktop: Sidebar always visible (collapsible), Footer visible |

### Mock Data Flag

Pages using mock data (not yet API-connected):
- All Client pages (Dashboard, Shop, Cart, Orders, Profile, Settings)
- All Driver pages (Dashboard, Deliveries, Profile, Settings)
- All Staff pages (Dashboard, Profile)

Pages fully API-connected:
- All Admin pages (Dashboard, Procurement, DryingProcess, Processing, Products, Varieties, Inventory, Sales, PredictiveAnalytics, Orders, Partners, Supplier, Customer, Settings, AdminAccounts, StaffManagement, Archives, AuditTrail, PointOfSale)
- All Public pages (Home, About, Products)
- Login/Auth pages

---

## File Count Summary

| Category | Files | Total Lines (approx) |
|---|---|---|
| Entry Points | 4 | ~930 |
| API Layer | 14 | ~1,400 |
| Context | 4 | ~620 |
| Hooks | 2 | ~360 |
| Layouts | 6 | ~1,310 |
| Admin Pages | 19 | ~17,800 |
| Public Pages | 5 | ~1,670 |
| Client Pages | 7 | ~3,010 |
| Driver Pages | 5 | ~1,520 |
| Staff Pages | 3 | ~480 |
| Auth Pages | 2 | ~275 |
| Auth Components | 2 | ~75 |
| Common Components | 5 | ~490 |
| Sidebar Components | 4 | ~475 |
| UI Components | 20 | ~2,850 |
| Styles | 1 | ~28 |
| Config | 5 | ~100 |
| **Total** | **~108 files** | **~33,400 lines** |
