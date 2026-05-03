/**
 * Offline API Layer
 * 
 * Wraps the existing apiClient to add IndexedDB offline support.
 * 
 * ONLINE:  apiClient → Server → response + mirror to IndexedDB
 * OFFLINE: apiClient → fails → IndexedDB serves cached data
 *          writes → saved to IndexedDB + sync queue
 * 
 * This layer maps API endpoints to IndexedDB stores so that
 * every module works identically online and offline.
 */

import * as db from './offlineDb';
import { STORES, generateTempId, addToSyncQueue, addToEmailQueue } from './offlineDb';

// ============================================
// ENDPOINT → STORE MAPPING
// ============================================

/**
 * Maps API endpoint patterns to IndexedDB store names.
 * Used to know where to cache/read data locally.
 */
const ENDPOINT_STORE_MAP = {
  '/products': STORES.PRODUCTS,
  '/products/featured': STORES.PRODUCTS,
  '/varieties': STORES.VARIETIES,
  '/customers': STORES.CUSTOMERS,
  '/suppliers': STORES.SUPPLIERS,
  '/orders': STORES.ORDERS,
  '/sales': STORES.SALES,
  '/procurements': STORES.PROCUREMENTS,
  '/procurement-batches': STORES.PROCUREMENT_BATCHES,
  '/drying-processes': STORES.DRYING_PROCESSES,
  '/processings': STORES.PROCESSINGS,
  '/users': STORES.USERS,
  '/drivers': STORES.DRIVERS,
  '/deliveries': STORES.DELIVERIES,
  '/driver-portal/my-deliveries': STORES.DELIVERIES,
  '/inventory': STORES.INVENTORY,
  '/audit-trails': STORES.AUDIT_TRAIL,
  '/archives': STORES.ARCHIVES,
  '/notifications': STORES.NOTIFICATIONS,
};

const KV_ENDPOINT_MAP = {
  '/dashboard/stats': { store: STORES.DASHBOARD, key: 'stats' },
  '/dashboard/recent-activity': { store: STORES.DASHBOARD, key: 'recent_activity' },
  '/settings': { store: STORES.SETTINGS, key: 'settings' },
  '/settings/profile': { store: STORES.SETTINGS, key: 'profile' },
  '/business-settings': { store: STORES.BUSINESS_SETTINGS, key: 'settings' },
  '/appearance': { store: STORES.APPEARANCE, key: 'settings' },
  '/website-content': { store: STORES.WEBSITE_CONTENT, key: 'content' },
  '/website-content/home': { store: STORES.WEBSITE_CONTENT, key: 'home' },
  '/website-content/about': { store: STORES.WEBSITE_CONTENT, key: 'about' },
  '/driver-portal/dashboard': { store: STORES.DASHBOARD, key: 'driver_dashboard' },
};

/**
 * Resolve which store an endpoint maps to
 */
function resolveStore(endpoint) {
  // Check exact match first
  if (ENDPOINT_STORE_MAP[endpoint]) return { type: 'collection', store: ENDPOINT_STORE_MAP[endpoint] };
  if (KV_ENDPOINT_MAP[endpoint]) return { type: 'kv', ...KV_ENDPOINT_MAP[endpoint] };
  
  // Check parameterized endpoints (e.g., /products/123)
  for (const [pattern, store] of Object.entries(ENDPOINT_STORE_MAP)) {
    // Match /products/123, /products/123/something
    const regex = new RegExp(`^${pattern.replace(/\//g, '\\/')}\\/[^/]+$`);
    if (regex.test(endpoint)) {
      const id = endpoint.split('/')[pattern.split('/').length];
      return { type: 'single', store, id };
    }
    
    // Match sub-resource endpoints: /products/123/status, /sales/123/return, etc.
    const subRegex = new RegExp(`^${pattern.replace(/\//g, '\\/')}\\/([^/]+)\\/[^/]+$`);
    const subMatch = endpoint.match(subRegex);
    if (subMatch) {
      return { type: 'single', store, id: subMatch[1], subResource: endpoint.split('/').pop() };
    }
  }
  
  // Check KV patterns with params (e.g. /dashboard/stats?period=monthly)
  // Use the full query string as part of the storage key so each period/param
  // combination is cached separately and doesn't overwrite other periods.
  for (const [pattern, config] of Object.entries(KV_ENDPOINT_MAP)) {
    if (endpoint.startsWith(pattern)) {
      // If there are query params, derive a unique key from the base key + params
      const queryPart = endpoint.slice(pattern.length);
      const derivedKey = queryPart
        ? `${config.key}_${queryPart.replace(/^[?&]/, '').replace(/[^a-zA-Z0-9_=&-]/g, '_')}`
        : config.key;
      return { type: 'kv', store: config.store, key: derivedKey };
    }
  }
  
  return null;
}

/**
 * Extract a human-readable description for the sync queue
 */
function describeAction(method, endpoint, body) {
  const RESOURCE_NAMES = {
    'products': 'Product',
    'varieties': 'Variety',
    'customers': 'Customer',
    'suppliers': 'Supplier',
    'orders': 'Order',
    'sales': 'Sale',
    'procurements': 'Procurement',
    'procurement-batches': 'Batch',
    'drying-processes': 'Drying Process',
    'processings': 'Processing',
    'users': 'User',
    'drivers': 'Driver',
    'deliveries': 'Delivery',
    'inventory': 'Inventory',
    'settings': 'Settings',
    'business-settings': 'Business Settings',
    'appearance': 'Appearance',
    'website-content': 'Website Content',
    'notifications': 'Notification',
    'archives': 'Archive',
  };

  const parts = endpoint.split('/').filter(Boolean);
  const resource = RESOURCE_NAMES[parts[0]] || parts[0] || 'record';
  const verb = method === 'POST' ? 'Create'
    : method === 'DELETE' ? 'Delete'
    : 'Update';

  return `${verb} ${resource}`;
}

// ============================================
// CACHE ON SUCCESSFUL API RESPONSE
// ============================================

/**
 * Mirror API response data to IndexedDB (called after successful online requests)
 */
export async function cacheApiResponse(endpoint, responseData) {
  if (!responseData) return;
  
  const mapping = resolveStore(endpoint);
  if (!mapping) return;
  
  try {
    if (mapping.type === 'collection') {
      // Array of records
      const items = Array.isArray(responseData)
        ? responseData
        : responseData.data || responseData;
      
      if (Array.isArray(items)) {
        await db.putAll(mapping.store, items.filter(item => item && item.id));
        await db.setLastSyncTime(mapping.store);
      }
    } else if (mapping.type === 'single') {
      // Single record
      const item = responseData.data || responseData;
      if (item && item.id) {
        await db.put(mapping.store, item);
      }
    } else if (mapping.type === 'kv') {
      // Key-value data (dashboard, settings, etc.)
      await db.setValue(mapping.store, mapping.key, responseData.data || responseData);
      await db.setLastSyncTime(mapping.store);
    }
  } catch (error) {
    console.warn('Failed to cache API response:', error);
  }
}

// ============================================
// OFFLINE READ (GET) — serve from IndexedDB
// ============================================

/**
 * Read data from IndexedDB when offline
 * 
 * @returns {Object|null} - { success, data, fromOfflineCache, lastSynced }
 */
export async function offlineGet(endpoint, params = {}) {
  const mapping = resolveStore(endpoint);
  if (!mapping) return null;
  
  try {
    let data = null;
    let lastSynced = await db.getLastSyncTime(mapping.store);
    
    if (mapping.type === 'collection') {
      data = await db.getAll(mapping.store);
      
      // Apply basic client-side filtering if params exist
      if (params.search && data.length > 0) {
        const search = params.search.toLowerCase();
        data = data.filter(item => {
          return Object.values(item).some(val =>
            typeof val === 'string' && val.toLowerCase().includes(search)
          );
        });
      }
      
      if (params.status) {
        data = data.filter(item => item.status === params.status);
      }
      
    } else if (mapping.type === 'single') {
      const id = isNaN(mapping.id) ? mapping.id : Number(mapping.id);
      data = await db.getById(mapping.store, id);
    } else if (mapping.type === 'kv') {
      data = await db.getValue(mapping.store, mapping.key);
    }
    
    if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
      return null;
    }
    
    return {
      success: true,
      data,
      fromOfflineCache: true,
      lastSynced,
    };
  } catch (error) {
    console.warn('Offline read failed:', error);
    return null;
  }
}

// ============================================
// OFFLINE WRITE (POST/PUT/PATCH/DELETE)
// ============================================

/**
 * Handle a write operation while offline.
 * Saves to IndexedDB + adds to sync queue.
 * 
 * @returns {Object} - { success, data, offlineQueued }
 */
export async function offlineWrite(method, endpoint, body = {}) {
  const mapping = resolveStore(endpoint);
  const storeName = mapping?.store;
  
  try {
    let localData = { ...body };
    let tempId = null;
    
    if (method === 'POST' && storeName) {
      // CREATE — generate temp ID
      tempId = generateTempId();
      localData.id = tempId;
      localData._offlineCreated = true;
      localData._pendingSync = true;
      localData.created_at = new Date().toISOString();
      localData.updated_at = new Date().toISOString();
      
      await db.put(storeName, localData);
    } else if ((method === 'PUT' || method === 'PATCH') && storeName && mapping.type === 'single') {
      // UPDATE — update local record
      const id = isNaN(mapping.id) ? mapping.id : Number(mapping.id);
      const existing = await db.getById(storeName, id);
      if (existing) {
        localData = { ...existing, ...body, _pendingSync: true, updated_at: new Date().toISOString() };
      } else {
        localData.id = id;
        localData._pendingSync = true;
      }
      await db.put(storeName, localData);
    } else if (method === 'DELETE' && storeName && mapping.type === 'single') {
      // DELETE — remove from local store
      const id = isNaN(mapping.id) ? mapping.id : Number(mapping.id);
      await db.remove(storeName, id);
      localData = { id };
    } else if (mapping?.type === 'kv' && (method === 'PUT' || method === 'PATCH' || method === 'POST')) {
      // KV update (settings, etc.)
      await db.setValue(mapping.store, mapping.key, body);
      localData = body;
    }
    
    // Add to sync queue
    await addToSyncQueue({
      method,
      endpoint,
      body: body instanceof FormData ? serializeFormData(body) : body,
      store: storeName,
      tempId,
      description: describeAction(method, endpoint, body),
    });
    
    // Dispatch event so UI updates pending count
    window.dispatchEvent(new CustomEvent('sync-queue-changed'));
    
    return {
      success: true,
      data: localData,
      offlineQueued: true,
      message: 'Saved offline. Will sync when internet is restored.',
    };
  } catch (error) {
    console.error('Offline write failed:', error);
    return {
      success: false,
      error: error.message,
      offlineQueued: false,
    };
  }
}

/**
 * Queue an email for later sending
 */
export async function queueEmail(type, data) {
  await addToEmailQueue({ type, data });
  window.dispatchEvent(new CustomEvent('sync-queue-changed'));
}

/**
 * Serialize FormData to a plain object for IndexedDB storage
 * (FormData can't be stored in IndexedDB directly)
 */
function serializeFormData(formData) {
  const obj = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      // Store file metadata — actual file upload will require re-selection
      // or we store as base64 (for small files like images)
      obj[key] = {
        _isFile: true,
        name: value.name,
        type: value.type,
        size: value.size,
      };
      
      // For images, we could convert to base64 for offline storage
      // but skip for large files to conserve IndexedDB space
      if (value.type.startsWith('image/') && value.size < 5 * 1024 * 1024) {
        // Will be handled as blob separately if needed
        obj[`${key}_blob`] = value;
      }
    } else {
      obj[key] = value;
    }
  }
  return obj;
}
