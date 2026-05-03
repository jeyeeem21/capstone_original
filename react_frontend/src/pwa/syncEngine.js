/**
 * Sync Engine
 * 
 * Processes the IndexedDB sync queue when internet connection is restored.
 * Sends queued actions to the Laravel backend in FIFO order.
 * Handles conflicts, retries, and temp-ID replacement.
 */

import {
  getPendingSyncActions,
  updateSyncAction,
  removeSyncAction,
  clearSyncedActions,
  getPendingEmails,
  removeEmail,
  getPendingSyncCount,
  getPendingEmailCount,
  put,
  remove as removeFromStore,
  getAll,
} from './offlineDb';
import { API_BASE_URL } from '../api/config';

// Sync state
let isSyncing = false;
let syncListeners = [];

/**
 * Subscribe to sync events
 * 
 * @param {Function} listener - Called with { type, data }
 *   type: 'start' | 'progress' | 'complete' | 'error' | 'conflict'
 */
export function onSyncEvent(listener) {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter(l => l !== listener);
  };
}

function emitSyncEvent(type, data = {}) {
  for (const listener of syncListeners) {
    try {
      listener({ type, ...data });
    } catch (e) {
      console.error('Sync listener error:', e);
    }
  }
}

/**
 * Check if currently syncing
 */
export function getIsSyncing() {
  return isSyncing;
}

/**
 * Get the auth token for API requests
 */
function getAuthToken() {
  return localStorage.getItem('auth_token');
}

/**
 * Send a single API request
 */
async function sendRequest(method, endpoint, body = null) {
  const token = getAuthToken();
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Accept': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
  
  const isFormData = body instanceof FormData;
  if (!isFormData && body) {
    headers['Content-Type'] = 'application/json';
  }
  
  const options = { method, headers };
  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) {
    const error = new Error(data.error || data.message || 'Sync request failed');
    error.status = response.status;
    error.responseData = data;
    throw error;
  }
  
  return data;
}

/**
 * Process all pending sync actions (FIFO)
 * 
 * Called automatically when internet is restored.
 */
export async function processSyncQueue() {
  if (isSyncing) return { synced: 0, failed: 0, conflicts: 0 };
  
  // Don't sync if we don't have a real auth token
  const token = getAuthToken();
  if (!token || token === 'offline_session') {
    return { synced: 0, failed: 0, conflicts: 0 };
  }

  // Double-check we're actually online
  if (!navigator.onLine) {
    return { synced: 0, failed: 0, conflicts: 0 };
  }

  const pending = await getPendingSyncActions();
  if (pending.length === 0) return { synced: 0, failed: 0, conflicts: 0 };
  
  isSyncing = true;
  const results = { synced: 0, failed: 0, conflicts: 0, total: pending.length };
  
  emitSyncEvent('start', { total: pending.length });
  
  for (let i = 0; i < pending.length; i++) {
    const action = pending[i];
    
    try {
      // Mark as syncing
      await updateSyncAction(action.id, { status: 'syncing' });
      
      // Inject the original offline timestamp so the server records the actual action time
      let body = action.body;
      if (body && typeof body === 'object' && !(body instanceof FormData) && action.createdAt) {
        body = { ...body, _offline_performed_at: new Date(action.createdAt).toISOString() };
      }
      
      // Send the request
      const response = await sendRequest(action.method, action.endpoint, body);
      
      // If this was a CREATE with a temp ID, update the local record with the real ID
      if (action.tempId && action.store && response.data?.id) {
        // Remove the record with temp ID
        await removeFromStore(action.store, action.tempId);
        // Store with real server ID
        await put(action.store, response.data);
        
        // Update any other queued actions that reference this temp ID
        await updateTempIdReferences(action.tempId, response.data.id, pending.slice(i + 1));
      } else if (action.store && response.data) {
        // Update the local record with server response
        await put(action.store, response.data);
      }
      
      // Remove from queue
      await removeSyncAction(action.id);
      results.synced++;
      
      emitSyncEvent('progress', {
        current: i + 1,
        total: pending.length,
        action: action.description,
        synced: results.synced,
        failed: results.failed,
      });
      
    } catch (error) {
      const attempts = (action.attempts || 0) + 1;
      
      if (error.status === 409 || error.status === 422) {
        // Conflict or validation error — flag for manual review
        await updateSyncAction(action.id, {
          status: 'failed',
          lastError: error.message,
          attempts,
          conflictData: error.responseData,
        });
        results.conflicts++;
        
        emitSyncEvent('conflict', {
          action: action.description,
          error: error.message,
        });
      } else if (attempts >= 3) {
        // Max retries reached — mark as failed
        await updateSyncAction(action.id, {
          status: 'failed',
          lastError: error.message,
          attempts,
        });
        results.failed++;
        
        emitSyncEvent('error', {
          action: action.description,
          error: error.message,
        });
      } else {
        // Retry later — keep as pending
        await updateSyncAction(action.id, {
          status: 'pending',
          lastError: error.message,
          attempts,
        });
        results.failed++;
      }
    }
  }
  
  // Process email queue
  await processEmailQueue();
  
  // Cleanup
  await clearSyncedActions();
  isSyncing = false;
  
  emitSyncEvent('complete', results);
  
  return results;
}

/**
 * Update temp ID references in remaining queued actions
 * (e.g., if we created a customer with temp_123, and later orders reference temp_123)
 */
async function updateTempIdReferences(tempId, realId, remainingActions) {
  for (const action of remainingActions) {
    if (!action.body) continue;
    
    let bodyStr = JSON.stringify(action.body);
    if (bodyStr.includes(tempId)) {
      bodyStr = bodyStr.replaceAll(tempId, String(realId));
      await updateSyncAction(action.id, { body: JSON.parse(bodyStr) });
      // Also update the in-memory reference for this loop
      action.body = JSON.parse(bodyStr);
    }
  }
}

/**
 * Process the email queue — send all pending emails
 */
async function processEmailQueue() {
  const emails = await getPendingEmails();
  if (emails.length === 0) return;
  
  for (const email of emails) {
    try {
      await sendRequest('POST', '/offline/process-email', {
        type: email.type,
        data: email.data,
        queuedAt: email.createdAt,
      });
      await removeEmail(email.id);
    } catch (error) {
      console.error('Failed to send queued email:', error);
      // Keep in queue for next sync attempt
    }
  }
}

/**
 * Get sync status summary
 */
export async function getSyncStatus() {
  const pendingSync = await getPendingSyncCount();
  const pendingEmails = await getPendingEmailCount();
  
  return {
    pendingSync,
    pendingEmails,
    totalPending: pendingSync + pendingEmails,
    isSyncing,
  };
}
