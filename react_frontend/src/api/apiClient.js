/**
 * API Client
 * 
 * Centralized HTTP client with:
 * - Request/response interceptors
 * - Error handling
 * - Timeout support
 * - Multi-layer caching (memory + localStorage)
 * - Auth token management
 * - Stale-while-revalidate pattern
 * - PWA offline support (IndexedDB fallback + sync queue)
 */

import { API_BASE_URL, REQUEST_CONFIG, CACHE_CONFIG } from './config';
import { cacheApiResponse, offlineGet, offlineWrite } from '../pwa/offlineApi';

// Track API availability
let apiAvailable = null;

// In-memory cache for instant access (faster than localStorage)
const memoryCache = new Map();
const memoryCacheTimestamps = new Map();
const MEMORY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const STALE_TTL = 10 * 1000; // 10 seconds before considered stale

/**
 * Get auth token from storage
 */
const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

/**
 * Set auth token to storage
 */
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

/**
 * Build full URL from endpoint
 */
const buildUrl = (endpoint, params = {}) => {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value);
    }
  });
  
  return url.toString();
};

/**
 * Fetch with timeout
 */
const fetchWithTimeout = async (url, options = {}, timeout = REQUEST_CONFIG.TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    apiAvailable = true;
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      apiAvailable = false;
      throw new Error('Request timeout - server may be unavailable');
    }
    apiAvailable = false;
    throw error;
  }
};

/**
 * Cache helpers - Multi-layer: Memory (instant) + localStorage (persistent)
 */
const cache = {
  // Get from memory cache first (instant), then localStorage
  get: (key) => {
    // Try memory cache first (fastest)
    if (memoryCache.has(key)) {
      const timestamp = memoryCacheTimestamps.get(key) || 0;
      const age = Date.now() - timestamp;
      
      if (age < MEMORY_CACHE_TTL) {
        return {
          data: memoryCache.get(key),
          isStale: age > STALE_TTL,
          fromMemory: true,
        };
      }
    }
    
    // Fall back to localStorage
    if (!CACHE_CONFIG.ENABLED) return null;
    
    const cacheKey = `${CACHE_CONFIG.PREFIX}${key}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;
    
    try {
      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      const isExpired = age > CACHE_CONFIG.TTL;
      
      if (isExpired) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      // Restore to memory cache for next access
      memoryCache.set(key, data);
      memoryCacheTimestamps.set(key, timestamp);
      
      return {
        data,
        isStale: age > STALE_TTL,
        fromMemory: false,
      };
    } catch {
      localStorage.removeItem(cacheKey);
      return null;
    }
  },
  
  // Set to both memory and localStorage
  set: (key, data) => {
    const now = Date.now();
    
    // Always set memory cache
    memoryCache.set(key, data);
    memoryCacheTimestamps.set(key, now);
    
    // Set localStorage if enabled
    if (!CACHE_CONFIG.ENABLED) return;
    
    const cacheKey = `${CACHE_CONFIG.PREFIX}${key}`;
    const cacheData = {
      data,
      timestamp: now,
    };
    
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      // Storage full, clear old cache
      console.warn('Cache storage full, clearing old entries');
      Object.keys(localStorage)
        .filter(k => k.startsWith(CACHE_CONFIG.PREFIX))
        .forEach(k => localStorage.removeItem(k));
    }
  },
  
  remove: (key) => {
    // Clear from memory
    memoryCache.delete(key);
    memoryCacheTimestamps.delete(key);
    
    // Clear from localStorage
    const cacheKey = `${CACHE_CONFIG.PREFIX}${key}`;
    localStorage.removeItem(cacheKey);
  },

  /**
   * Remove all cache entries whose key starts with the given prefix.
   * Useful for clearing dashboard-stats-* or any group of related keys.
   */
  removeByPrefix: (prefix) => {
    // Clear from memory cache
    for (const key of [...memoryCache.keys()]) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
        memoryCacheTimestamps.delete(key);
      }
    }
    // Clear from localStorage
    const lsPrefix = `${CACHE_CONFIG.PREFIX}${prefix}`;
    Object.keys(localStorage)
      .filter(k => k.startsWith(lsPrefix))
      .forEach(k => localStorage.removeItem(k));
  },
  
  clear: () => {
    // Clear memory cache
    memoryCache.clear();
    memoryCacheTimestamps.clear();
    
    // Clear localStorage cache
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_CONFIG.PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },
};

/**
 * Handle 401 Unauthenticated responses
 */
const handle401 = (response) => {
  if (response.status === 401) {
    const hadToken = !!localStorage.getItem('auth_token');
    // Clear token and dispatch event for React to handle navigation
    localStorage.removeItem('auth_token');
    localStorage.removeItem('session_token');
    cache.clear();
    // If the user had a token that just became invalid, they were kicked by another login
    const reason = hadToken ? 'session_kicked' : 'unauthenticated';
    if (window.location.pathname !== '/') {
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason } }));
    }
  }
  return response;
};

/**
 * Main API client
 */
const apiClient = {
  /**
   * Check if API is available
   */
  isAvailable: () => apiAvailable !== false,
  
  /**
   * GET request with stale-while-revalidate pattern
   */
  get: async (endpoint, { params = {}, useCache = false, cacheKey = null } = {}) => {
    const effectiveCacheKey = cacheKey || endpoint;
    
    // Try cache first if enabled (returns instantly if cached)
    if (useCache) {
      const cached = cache.get(effectiveCacheKey);
      if (cached?.data) {
        // If offline and cache is stale, skip to IndexedDB which has fresh mutations
        if (!navigator.onLine && cached.isStale) {
          const offlineData = await offlineGet(endpoint, params);
          if (offlineData?.success) return offlineData;
        }
        return { 
          success: true, 
          data: cached.data, 
          fromCache: true,
          isStale: cached.isStale,
        };
      }
    }
    
    // Skip network if API is known to be unavailable or browser is offline
    // Always try IndexedDB first (has fresh offline mutations), then memory cache
    if (apiAvailable === false || !navigator.onLine) {
      const offlineData = await offlineGet(endpoint, params);
      if (offlineData?.success) return offlineData;
      // Fall back to memory cache only if IndexedDB has nothing
      if (useCache) {
        const cached = cache.get(effectiveCacheKey);
        if (cached?.data) return { success: true, data: cached.data, fromCache: true };
      }
      if (!navigator.onLine) {
        return { success: false, error: 'You are offline and no cached data is available.' };
      }
    }

    // If clearly offline (confirmed by browser), don't even try network
    if (!navigator.onLine) {
      const offlineData = await offlineGet(endpoint, params);
      if (offlineData) return offlineData;
      return { success: false, error: 'You are offline and no cached data is available.' };
    }
    
    try {
      const url = buildUrl(endpoint, params);
      const token = getAuthToken();
      
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });
      
      handle401(response);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Something went wrong. Please try again.');
      }
      
      // Cache the response (to both memory and localStorage)
      if (useCache && data.success !== false) {
        cache.set(effectiveCacheKey, data.data || data);
      }

      // Mirror to IndexedDB for offline access
      try {
        await cacheApiResponse(endpoint, data);
      } catch (_) {
        // Non-critical — don't block the response
      }
      
      return data;
    } catch (error) {
      // On network error: always prefer IndexedDB over stale memory cache.
      // IndexedDB contains freshly written offline mutations; memory cache is stale.
      const offlineData = await offlineGet(endpoint, params);
      if (offlineData?.success) return offlineData;

      // Fall back to memory/localStorage cache if IndexedDB has nothing
      if (useCache) {
        const cached = cache.get(effectiveCacheKey);
        if (cached?.data) {
          return { success: true, data: cached.data, fromCache: true, error: error.message };
        }
      }

      return { success: false, error: error.message };
    }
  },
  
  /**
   * POST request
   */
  post: async (endpoint, body = {}, options = {}) => {
    // Never queue auth endpoints for offline sync (security: don't store passwords)
    const isAuthEndpoint = endpoint.includes('/auth/');

    // If offline, save to IndexedDB + sync queue (skip auth endpoints)
    if (!navigator.onLine && !isAuthEndpoint) {
      return offlineWrite('POST', endpoint, body);
    }

    try {
      const url = buildUrl(endpoint);
      const token = getAuthToken();
      
      // Check if body is FormData (for file uploads)
      const isFormData = body instanceof FormData;
      
      const headers = {
        'Accept': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };
      
      // Don't set Content-Type for FormData - browser sets it automatically with boundary
      if (!isFormData) {
        headers['Content-Type'] = 'application/json';
      }
      
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: isFormData ? body : JSON.stringify(body),
      });
      
      // Don't handle 401 for login endpoint
      if (!endpoint.includes('/auth/login')) {
        handle401(response);
      }
      const data = await response.json();
      
      if (!response.ok) {
        // Preserve validation errors for proper error handling
        const error = new Error(data.error || data.message || 'Something went wrong. Please try again.');
        error.response = { data }; // Attach the response data including validation errors
        throw error;
      }

      // Mirror created record to IndexedDB
      try { await cacheApiResponse(endpoint, data); } catch (_) {}
      
      return data;
    } catch (error) {
      // Detect network errors (navigator.onLine is unreliable on mobile)
      const isNetworkError = !navigator.onLine
        || error instanceof TypeError
        || error.message?.includes('fetch')
        || error.message?.includes('Failed to fetch')
        || error.message?.includes('timeout');

      // Queue for offline sync if it's a network error (but never queue auth requests)
      if (isNetworkError && !isAuthEndpoint) {
        return offlineWrite('POST', endpoint, body);
      }
      // Re-throw to preserve error structure including validation errors
      throw error;
    }
  },
  
  /**
   * PUT request
   */
  put: async (endpoint, body = {}) => {
    // If offline, save to IndexedDB + sync queue
    if (!navigator.onLine) {
      return offlineWrite('PUT', endpoint, body);
    }

    try {
      const url = buildUrl(endpoint);
      const token = getAuthToken();
      
      const response = await fetchWithTimeout(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(body),
      });
      
      handle401(response);
      const data = await response.json();
      
      if (!response.ok) {
        // Preserve validation errors for proper error handling
        const error = new Error(data.error || data.message || 'Something went wrong. Please try again.');
        error.response = { data }; // Attach the response data including validation errors
        throw error;
      }

      // Mirror updated record to IndexedDB
      try { await cacheApiResponse(endpoint, data); } catch (_) {}
      
      return data;
    } catch (error) {
      if (!navigator.onLine && error.message?.includes('fetch')) {
        return offlineWrite('PUT', endpoint, body);
      }
      // Re-throw to preserve error structure including validation errors
      throw error;
    }
  },
  
  /**
   * PATCH request
   */
  patch: async (endpoint, body = {}) => {
    // If offline, save to IndexedDB + sync queue
    if (!navigator.onLine) {
      return offlineWrite('PATCH', endpoint, body);
    }

    try {
      const url = buildUrl(endpoint);
      const token = getAuthToken();
      
      const response = await fetchWithTimeout(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(body),
      });
      
      handle401(response);
      const data = await response.json();
      
      if (!response.ok) {
        // Preserve validation errors for proper error handling
        const error = new Error(data.error || data.message || 'Something went wrong. Please try again.');
        error.response = { data }; // Attach the response data including validation errors
        throw error;
      }

      // Mirror updated record to IndexedDB
      try { await cacheApiResponse(endpoint, data); } catch (_) {}
      
      return data;
    } catch (error) {
      if (!navigator.onLine && error.message?.includes('fetch')) {
        return offlineWrite('PATCH', endpoint, body);
      }
      // Re-throw to preserve error structure including validation errors
      throw error;
    }
  },
  
  /**
   * DELETE request
   */
  delete: async (endpoint) => {
    // If offline, save to IndexedDB + sync queue
    if (!navigator.onLine) {
      return offlineWrite('DELETE', endpoint);
    }

    try {
      const url = buildUrl(endpoint);
      const token = getAuthToken();
      
      const response = await fetchWithTimeout(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });
      
      handle401(response);
      const data = await response.json();
      
      if (!response.ok) {
        // Preserve validation errors for proper error handling
        const error = new Error(data.error || data.message || 'Something went wrong. Please try again.');
        error.response = { data }; // Attach the response data including validation errors
        throw error;
      }
      
      return data;
    } catch (error) {
      if (!navigator.onLine && error.message?.includes('fetch')) {
        return offlineWrite('DELETE', endpoint);
      }
      // Re-throw to preserve error structure including validation errors
      throw error;
    }
  },
  
  /**
   * Upload file (multipart/form-data)
   */
  upload: async (endpoint, formData) => {
    // If offline, queue the upload
    if (!navigator.onLine) {
      return offlineWrite('POST', endpoint, formData);
    }

    try {
      const url = buildUrl(endpoint);
      const token = getAuthToken();
      
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          // Don't set Content-Type, let browser set it with boundary
        },
        body: formData,
      });
      
      handle401(response);
      const data = await response.json();
      
      if (!response.ok) {
        // Preserve validation errors for proper error handling
        const error = new Error(data.error || data.message || 'Something went wrong. Please try again.');
        error.response = { data }; // Attach the response data including validation errors
        throw error;
      }

      // Mirror to IndexedDB
      try { await cacheApiResponse(endpoint, data); } catch (_) {}
      
      return data;
    } catch (error) {
      if (!navigator.onLine && error.message?.includes('fetch')) {
        return offlineWrite('POST', endpoint, formData);
      }
      // Re-throw to preserve error structure including validation errors
      throw error;
    }
  },
  
  // Expose cache methods
  cache,
  
  /**
   * Clear a specific cache key
   */
  clearCache: (key) => cache.remove(key),
};

export default apiClient;
