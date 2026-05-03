/**
 * API Configuration
 * 
 * Auto-detects environment — no manual switching needed.
 */

const hostname = window.location.hostname;
const isProduction = hostname === 'kjpricemill.com' || hostname === 'www.kjpricemill.com';

export const API_BASE_URL = isProduction
  ? 'https://api.kjpricemill.com/api'
  : 'http://127.0.0.1:8000/api';

// Backend base URL (without /api) for resolving storage paths
export const BACKEND_URL = API_BASE_URL.replace(/\/api$/, '');

// Resolve a /storage/ path to the full backend URL
export const resolveStorageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path;
  return `${BACKEND_URL}${path}`;
};

// Default logo — bundled in frontend public folder, always accessible
export const DEFAULT_LOGO = '/KJPLogo.png';

// ============================================
// OpenRouteService API (Free - address autocomplete & distance)
// ============================================
export const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjdiYTlmZThhY2QwODQ2ZDViMDU3NDlmOWQ4NTY3N2Y2IiwiaCI6Im11cm11cjY0In0=';
export const ORS_BASE_URL = 'https://api.openrouteservice.org';

// ============================================
// API Endpoints Configuration
// ============================================
export const ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REGISTER: '/auth/register',
    FORGOT_PASSWORD: '/auth/forgot-password',
    FORGOT_PASSWORD_VERIFY_CODE: '/auth/forgot-password/verify-code',
    RESET_PASSWORD: '/auth/reset-password',
    ME: '/auth/me',
    CHECK_EMAIL: '/auth/check-email',
    REGISTER_SEND_VERIFICATION: '/auth/register/send-verification',
    REGISTER_VERIFY_CODE: '/auth/register/verify-code',
    REGISTER_COMPLETE: '/auth/register/complete',
    REGISTER_CANCEL: '/auth/register/cancel',
  },
  
  // Products
  PRODUCTS: {
    BASE: '/products',
    FEATURED: '/products/featured',
    VARIETIES: '/varieties',
    BY_ID: (id) => `/products/${id}`,
  },
  
  // Orders
  ORDERS: {
    BASE: '/orders',
    BY_ID: (id) => `/orders/${id}`,
    BY_STATUS: (status) => `/orders?status=${status}`,
  },
  
  // Inventory
  INVENTORY: {
    BASE: '/inventory',
    BY_ID: (id) => `/inventory/${id}`,
    LOW_STOCK: '/inventory/low-stock',
  },
  
  // Sales
  SALES: {
    BASE: '/sales',
    SUMMARY: '/sales/summary',
    BY_DATE: (start, end) => `/sales?start=${start}&end=${end}`,
  },
  
  // Users
  USERS: {
    BASE: '/users',
    BY_ID: (id) => `/users/${id}`,
  },
  
  // Dashboard
  DASHBOARD: {
    STATS: '/dashboard/stats',
    RECENT_ACTIVITY: '/dashboard/recent-activity',
    REFRESH: '/dashboard/refresh',
  },
  
  // Settings
  SETTINGS: {
    BASE: '/settings',
    PROFILE: '/settings/profile',
  },
  
  // Contact
  CONTACT: {
    SEND: '/contact/send',
  },
  
  // Website Content
  WEBSITE_CONTENT: {
    BASE: '/website-content',
    HOME: '/website-content/home',
    ABOUT: '/website-content/about',
    SEED: '/website-content/seed',
  },

  // Drivers
  DRIVERS: {
    BASE: '/drivers',
    STATISTICS: '/drivers/statistics',
    BY_ID: (id) => `/drivers/${id}`,
  },

  // Deliveries
  DELIVERIES: {
    BASE: '/deliveries',
    STATISTICS: '/deliveries/statistics',
    BY_DRIVER: (driverId) => `/deliveries/driver/${driverId}`,
    BY_ID: (id) => `/deliveries/${id}`,
    UPDATE_STATUS: (id) => `/deliveries/${id}/status`,
  },

  // Driver Portal (for logged-in driver)
  DRIVER_PORTAL: {
    DASHBOARD: '/driver-portal/dashboard',
    MY_DELIVERIES: '/driver-portal/my-deliveries',
    UPDATE_ORDER_STATUS: (id) => `/driver-portal/orders/${id}/status`,
    MARK_ORDER_PAID: (id) => `/driver-portal/orders/${id}/pay`,
  },
};

// ============================================
// Request Configuration
// ============================================
export const REQUEST_CONFIG = {
  TIMEOUT: 15000, // 15 seconds
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 500, // 0.5 second
};

// ============================================
// Cache Configuration
// ============================================
export const CACHE_CONFIG = {
  ENABLED: true,
  PREFIX: 'kjp-',
  TTL: 2 * 60 * 1000, // 2 minutes - balanced between freshness and performance
};
