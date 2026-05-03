/**
 * Offline Database (IndexedDB)
 * 
 * Local database mirror for full offline capability.
 * Uses the `idb` library (Google's lightweight IndexedDB wrapper).
 * 
 * Stores:
 *  - Cached API data (products, procurements, customers, etc.)
 *  - Sync queue (pending writes to send when online)
 *  - Email queue (emails to send when online)
 *  - Audit log (offline actions for audit trail)
 */

import { openDB } from 'idb';

const DB_NAME = 'kjp-ricemill-offline';
const DB_VERSION = 1;

// Store names
export const STORES = {
  // Data mirrors (cache of server data)
  PRODUCTS: 'products',
  VARIETIES: 'varieties',
  CUSTOMERS: 'customers',
  SUPPLIERS: 'suppliers',
  ORDERS: 'orders',
  SALES: 'sales',
  PROCUREMENTS: 'procurements',
  PROCUREMENT_BATCHES: 'procurement_batches',
  DRYING_PROCESSES: 'drying_processes',
  PROCESSINGS: 'processings',
  USERS: 'users',
  DRIVERS: 'drivers',
  DELIVERIES: 'deliveries',
  INVENTORY: 'inventory',
  DASHBOARD: 'dashboard',
  SETTINGS: 'settings',
  BUSINESS_SETTINGS: 'business_settings',
  APPEARANCE: 'appearance',
  WEBSITE_CONTENT: 'website_content',
  AUDIT_TRAIL: 'audit_trail',
  ARCHIVES: 'archives',
  NOTIFICATIONS: 'notifications',
  
  // Queues (offline actions waiting to sync)
  SYNC_QUEUE: 'sync_queue',
  EMAIL_QUEUE: 'email_queue',
  
  // Meta
  META: 'meta', // timestamps, sync status, etc.
};

/**
 * Initialize / open the database
 */
let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create data stores with 'id' as keyPath
        const dataStores = [
          STORES.PRODUCTS,
          STORES.VARIETIES,
          STORES.CUSTOMERS,
          STORES.SUPPLIERS,
          STORES.ORDERS,
          STORES.SALES,
          STORES.PROCUREMENTS,
          STORES.PROCUREMENT_BATCHES,
          STORES.DRYING_PROCESSES,
          STORES.PROCESSINGS,
          STORES.USERS,
          STORES.DRIVERS,
          STORES.DELIVERIES,
          STORES.INVENTORY,
          STORES.NOTIFICATIONS,
          STORES.AUDIT_TRAIL,
          STORES.ARCHIVES,
        ];
        
        for (const storeName of dataStores) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
        
        // Key-value stores (single record stores for settings/dashboard)
        const kvStores = [
          STORES.DASHBOARD,
          STORES.SETTINGS,
          STORES.BUSINESS_SETTINGS,
          STORES.APPEARANCE,
          STORES.WEBSITE_CONTENT,
          STORES.META,
        ];
        
        for (const storeName of kvStores) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'key' });
          }
        }
        
        // Sync queue — auto-increment ID to preserve FIFO order
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        // Email queue — auto-increment ID
        if (!db.objectStoreNames.contains(STORES.EMAIL_QUEUE)) {
          const emailStore = db.createObjectStore(STORES.EMAIL_QUEUE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          emailStore.createIndex('status', 'status', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

// ============================================
// DATA STORE OPERATIONS (Read/Write cached data)
// ============================================

/**
 * Get all records from a store
 */
export async function getAll(storeName) {
  const db = await getDb();
  return db.getAll(storeName);
}

/**
 * Get a single record by ID
 */
export async function getById(storeName, id) {
  const db = await getDb();
  return db.get(storeName, id);
}

/**
 * Put a single record (upsert)
 */
export async function put(storeName, data) {
  const db = await getDb();
  return db.put(storeName, data);
}

/**
 * Put multiple records at once (bulk upsert)
 */
export async function putAll(storeName, items) {
  const db = await getDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const item of items) {
    store.put(item);
  }
  await tx.done;
}

/**
 * Delete a record by ID
 */
export async function remove(storeName, id) {
  const db = await getDb();
  return db.delete(storeName, id);
}

/**
 * Clear all records from a store
 */
export async function clearStore(storeName) {
  const db = await getDb();
  return db.clear(storeName);
}

/**
 * Replace all data in a store (clear + putAll)
 * Used when syncing full dataset from server
 */
export async function replaceAll(storeName, items) {
  const db = await getDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await store.clear();
  for (const item of items) {
    store.put(item);
  }
  await tx.done;
}

// ============================================
// KEY-VALUE STORE OPERATIONS (settings, dashboard, etc.)
// ============================================

/**
 * Get a value from a key-value store
 */
export async function getValue(storeName, key) {
  const db = await getDb();
  const record = await db.get(storeName, key);
  return record?.value ?? null;
}

/**
 * Set a value in a key-value store
 */
export async function setValue(storeName, key, value) {
  const db = await getDb();
  return db.put(storeName, { key, value, updatedAt: Date.now() });
}

// ============================================
// OFFLINE AUTH (cached login for offline use)
// ============================================

/**
 * Hash a password using SHA-256 via Web Crypto API.
 * We never store the actual password — only a one-way hash.
 */
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + ':' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cache login credentials after a successful online login.
 * Stores: user object + password hash (NOT the real password).
 */
export async function cacheLoginCredentials(email, password, user) {
  const salt = 'kjp-offline-' + email.toLowerCase();
  const passwordHash = await hashPassword(password, salt);
  const db = await getDb();
  await db.put(STORES.META, {
    key: 'offline_auth_' + email.toLowerCase(),
    value: {
      user,
      passwordHash,
      email: email.toLowerCase(),
      cachedAt: Date.now(),
    },
    updatedAt: Date.now(),
  });
}

/**
 * Attempt offline login: compare entered password hash with cached hash.
 * Returns the cached user object if credentials match, or null.
 */
export async function getOfflineUser(email, password) {
  const db = await getDb();
  const record = await db.get(STORES.META, 'offline_auth_' + email.toLowerCase());
  if (!record?.value) return null;

  const salt = 'kjp-offline-' + email.toLowerCase();
  const enteredHash = await hashPassword(password, salt);
  if (enteredHash !== record.value.passwordHash) return null;

  return record.value.user;
}

/**
 * Clear cached credentials for a specific user (called on logout).
 */
export async function clearOfflineAuth() {
  const db = await getDb();
  const tx = db.transaction(STORES.META, 'readwrite');
  const store = tx.objectStore(STORES.META);
  const allKeys = await store.getAllKeys();
  for (const key of allKeys) {
    if (typeof key === 'string' && key.startsWith('offline_auth_')) {
      store.delete(key);
    }
  }
  await tx.done;
}

// ============================================
// SYNC QUEUE OPERATIONS
// ============================================

/**
 * Add an action to the sync queue.
 * 
 * @param {Object} action
 * @param {string} action.method - HTTP method: POST, PUT, PATCH, DELETE
 * @param {string} action.endpoint - API endpoint (e.g., '/products')
 * @param {Object} action.body - Request body (JSON-serializable)
 * @param {string} action.store - Which IndexedDB store this affects
 * @param {string|number} action.tempId - Temporary local ID (for creates)
 * @param {string} action.description - Human-readable description
 */
export async function addToSyncQueue(action) {
  const db = await getDb();
  return db.add(STORES.SYNC_QUEUE, {
    ...action,
    status: 'pending',       // pending | syncing | synced | failed
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  });
}

/**
 * Get all pending sync actions (FIFO order)
 */
export async function getPendingSyncActions() {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORES.SYNC_QUEUE, 'status', 'pending');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Get count of pending sync actions
 */
export async function getPendingSyncCount() {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORES.SYNC_QUEUE, 'status', 'pending');
  return all.length;
}

/**
 * Update a sync queue item
 */
export async function updateSyncAction(id, updates) {
  const db = await getDb();
  const item = await db.get(STORES.SYNC_QUEUE, id);
  if (item) {
    Object.assign(item, updates);
    return db.put(STORES.SYNC_QUEUE, item);
  }
}

/**
 * Remove a synced action from the queue
 */
export async function removeSyncAction(id) {
  const db = await getDb();
  return db.delete(STORES.SYNC_QUEUE, id);
}

/**
 * Clear all completed/synced actions
 */
export async function clearSyncedActions() {
  const db = await getDb();
  const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
  const store = tx.objectStore(STORES.SYNC_QUEUE);
  const all = await store.getAll();
  for (const item of all) {
    if (item.status === 'synced') {
      store.delete(item.id);
    }
  }
  await tx.done;
}

// ============================================
// EMAIL QUEUE OPERATIONS
// ============================================

/**
 * Add an email to the offline email queue
 * 
 * @param {Object} email
 * @param {string} email.type - Email type (order_confirmation, status_update, etc.)
 * @param {Object} email.data - Email data (to, subject, body, template vars, etc.)
 */
export async function addToEmailQueue(email) {
  const db = await getDb();
  return db.add(STORES.EMAIL_QUEUE, {
    ...email,
    status: 'pending',
    createdAt: Date.now(),
  });
}

/**
 * Get all pending emails
 */
export async function getPendingEmails() {
  const db = await getDb();
  return db.getAllFromIndex(STORES.EMAIL_QUEUE, 'status', 'pending');
}

/**
 * Remove a sent email from queue
 */
export async function removeEmail(id) {
  const db = await getDb();
  return db.delete(STORES.EMAIL_QUEUE, id);
}

/**
 * Get pending email count
 */
export async function getPendingEmailCount() {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORES.EMAIL_QUEUE, 'status', 'pending');
  return all.length;
}

// ============================================
// META OPERATIONS (sync timestamps, etc.)
// ============================================

/**
 * Record the last sync time for a store
 */
export async function setLastSyncTime(storeName) {
  return setValue(STORES.META, `lastSync_${storeName}`, Date.now());
}

/**
 * Get the last sync time for a store
 */
export async function getLastSyncTime(storeName) {
  return getValue(STORES.META, `lastSync_${storeName}`);
}

// ============================================
// CLEANUP
// ============================================

/**
 * Clear ONLY the sync/email queues on logout.
 * Preserves all cached data stores and offline_auth credentials so that:
 *  1. The user can log back in offline after going offline.
 *  2. Pages load with cached data while fresh data is fetched in the background.
 * Stale cached data is overwritten when the user is back online and pages reload.
 */
export async function clearAllData() {
  const db = await getDb();
  // Only wipe the queues — keep all data mirrors and auth credentials intact
  const queueStores = [STORES.SYNC_QUEUE, STORES.EMAIL_QUEUE];
  const tx = db.transaction(queueStores, 'readwrite');
  for (const name of queueStores) {
    tx.objectStore(name).clear();
  }
  await tx.done;
}

/**
 * Generate a temporary UUID for offline-created records
 */
export function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
