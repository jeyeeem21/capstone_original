import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi, dashboardApi } from '../api';
import apiClient from '../api/apiClient';
import { clearAllData, cacheLoginCredentials, getOfflineUser, clearOfflineAuth, getValue, STORES, getPendingSyncCount } from '../pwa/offlineDb';
import { processSyncQueue } from '../pwa/syncEngine';

/**
 * Pre-populate IndexedDB with critical data after a successful online login.
 * Uses dashboardApi.getStats() directly so the URL + cacheKey match exactly
 * what the Dashboard component will use when loading offline.
 * Runs fire-and-forget — never blocks the login flow.
 */
async function prefetchCriticalData() {
  const year = new Date().getFullYear();

  // Fetch in parallel — dashboard stats first because they're the heaviest
  const tasks = [
    // Dashboard: use dashboardApi so cacheKey + endpoint match Dashboard component exactly
    dashboardApi.getStats('monthly', { year }),
    dashboardApi.getRecentActivity(15),
    // Other module data
    apiClient.get('/procurement-batches'),
    apiClient.get('/procurements'),
    apiClient.get('/suppliers'),
    apiClient.get('/varieties'),
    apiClient.get('/inventory'),
  ];

  await Promise.allSettled(tasks); // allSettled so one failure doesn't stop others
}

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionKicked, setSessionKicked] = useState(false);
  const sessionPollRef = useRef(null);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) { setLoading(false); return; }

      // Auto-logout on tab/browser close:
      // sessionStorage is cleared when the tab closes.
      // If we have a token in localStorage but no session marker,
      // the user closed the tab/browser → clear auth and force re-login.
      const sessionAlive = sessionStorage.getItem('session_alive');
      if (!sessionAlive && token !== 'offline_session') {
        // Browser/tab was closed and reopened — log out
        localStorage.removeItem('auth_token');
        localStorage.removeItem('session_token');
        localStorage.removeItem('offline_last_email');
        try { await authApi.logout(); } catch { /* ignore */ }
        setLoading(false);
        return;
      }

      // Special case: token is a placeholder set during offline-only login.
      // If online now, clear it so the login screen shows (user must do a real login).
      // If still offline, restore from IndexedDB cache.
      if (token === 'offline_session') {
        if (navigator.onLine) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('session_token');
          setLoading(false);
          return;
        }
        // Offline — restore cached user
        try {
          const lastEmail = localStorage.getItem('offline_last_email');
          if (lastEmail) {
            const record = await getValue(STORES.META, 'offline_auth_' + lastEmail);
            if (record?.user) {
              setUser(record.user);
              sessionStorage.setItem('session_alive', '1');
            }
          }
        } catch { /* ignore */ }
        setLoading(false);
        return;
      }

      // Normal real token flow
      try {
        const response = await authApi.getCurrentUser();
        if (response.success && response.user) {
          setUser(response.user);
          sessionStorage.setItem('session_alive', '1');
          if (response.session_token) {
            localStorage.setItem('session_token', response.session_token);
          }
        } else {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('session_token');
        }
      } catch {
        // Network error — restore from IndexedDB cache
        // Don't rely on navigator.onLine (unreliable on mobile)
        try {
          const lastEmail = localStorage.getItem('offline_last_email');
          if (lastEmail) {
            const record = await getValue(STORES.META, 'offline_auth_' + lastEmail);
            if (record?.user) {
              setUser(record.user);
              sessionStorage.setItem('session_alive', '1');
            }
          }
        } catch { /* ignore */ }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  // Listen for forced logout from apiClient (401 responses)
  useEffect(() => {
    const handleForcedLogout = (e) => {
      // If it's a session kick (token revoked by new login), show notification
      if (e.detail?.reason === 'session_kicked') {
        setSessionKicked(true);
      }
      setUser(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('session_token');
    };
    window.addEventListener('auth:logout', handleForcedLogout);
    return () => window.removeEventListener('auth:logout', handleForcedLogout);
  }, []);

  // Poll session-check for admin/super_admin to detect login from another device
  useEffect(() => {
    if (sessionPollRef.current) {
      clearInterval(sessionPollRef.current);
      sessionPollRef.current = null;
    }

    if (!user || !['super_admin', 'admin'].includes(user.role)) return;

    const checkSession = async () => {
      const token = localStorage.getItem('auth_token');
      const storedSession = localStorage.getItem('session_token');
      if (!token || !storedSession) return;

      try {
        const res = await apiClient.get('/auth/session-check');
        if (res.session_token && res.session_token !== storedSession) {
          // Another device logged in — this session is stale
          setSessionKicked(true);
          setUser(null);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('session_token');
          if (sessionPollRef.current) clearInterval(sessionPollRef.current);
        }
      } catch {
        // 401 will be handled by apiClient's handle401
      }
    };

    // Check every 60 seconds
    sessionPollRef.current = setInterval(checkSession, 60000);
    return () => {
      if (sessionPollRef.current) clearInterval(sessionPollRef.current);
    };
  }, [user]);

  // Login function — tries online API first, falls back to offline cached credentials
  const login = useCallback(async (email, password) => {
    setSessionKicked(false);

    // Try online login first
    try {
      const response = await authApi.login({ email, password });
      if (response.success && response.user) {
        setUser(response.user);
        sessionStorage.setItem('session_alive', '1');

        // Cache credentials for offline login (hashed, never plain text)
        try {
          await cacheLoginCredentials(email, password, response.user);
          localStorage.setItem('offline_last_email', email.toLowerCase());
        } catch (cacheErr) {
          console.warn('[Auth] Failed to cache credentials for offline use:', cacheErr);
        }

        // Fire-and-forget: send login notification email AFTER dashboard data loads
        setTimeout(() => {
          apiClient.post('/auth/login-email').catch(() => {});
        }, 5000);

        // Pre-fetch critical data into IndexedDB so offline mode works immediately
        // after login (background, non-blocking, runs after a short delay so the
        // main UI has a chance to load first)
        setTimeout(() => {
          prefetchCriticalData().catch(() => {});
        }, 3000);

        // Sync any pending offline actions now that we have a real token
        setTimeout(async () => {
          try {
            const count = await getPendingSyncCount();
            if (count > 0) processSyncQueue();
          } catch { /* ignore */ }
        }, 2000);

        return response;
      }
      throw new Error(response.error || 'Login failed');
    } catch (err) {
      // Check if this is a network error (fetch failed, timeout, etc.)
      // navigator.onLine is unreliable on mobile — WiFi can be on but no internet
      const isNetworkError = err instanceof TypeError
        || err.message?.includes('fetch')
        || err.message?.includes('Failed to fetch')
        || err.message?.includes('Network')
        || err.message?.includes('network')
        || err.message?.includes('timeout')
        || err.message?.includes('INTERNET_DISCONNECTED')
        || err.message?.includes('ERR_')
        || err.message?.includes('server may be unavailable')
        || err.code === 'ERR_NETWORK';

      // If it's a real server error (e.g. wrong password, 422), don't fall through
      if (!isNetworkError) throw err;
      // Otherwise fall through to offline login below
    }

    // Offline login — verify password hash against cached credentials
    try {
      const cachedUser = await getOfflineUser(email, password);
      if (cachedUser) {
        setUser(cachedUser);
        sessionStorage.setItem('session_alive', '1');
        // Keep any existing token so initAuth works on reconnect
        if (!localStorage.getItem('auth_token')) {
          localStorage.setItem('auth_token', 'offline_session');
        }
        localStorage.setItem('offline_last_email', email.toLowerCase());
        return { success: true, user: cachedUser, offline: true };
      }
    } catch (offlineErr) {
      console.error('[Auth] Offline login error:', offlineErr);
    }

    throw new Error(
      navigator.onLine
        ? 'Login failed'
        : 'You are offline. Please login online at least once first so your credentials are cached.'
    );
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if API call fails, clear local state
    }
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('session_token');
    localStorage.removeItem('offline_last_email');
    sessionStorage.removeItem('session_alive');
    // Clear all offline/IndexedDB data on logout
    try {
      await clearAllData();
    } catch {
      // Ignore IndexedDB errors during logout
    }
  }, []);

  // Dismiss session kicked notification
  const dismissSessionKicked = useCallback(() => {
    setSessionKicked(false);
  }, []);

  // Check if user has a specific role
  const hasRole = useCallback((role) => {
    return user?.role === role;
  }, [user]);

  // Role checks
  const isSuperAdmin = useCallback(() => user?.role === 'super_admin', [user]);
  const isAdmin = useCallback(() => user?.role === 'admin', [user]);
  const isStaff = useCallback(() => user?.role === 'staff', [user]);
  const isAdminOrAbove = useCallback(() => ['super_admin', 'admin'].includes(user?.role), [user]);

  // Refresh user data from API
  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.getCurrentUser();
      if (response.success && response.user) {
        setUser(response.user);
      }
    } catch {
      // Ignore errors — user stays as-is
    }
  }, []);

  // Base path for admin panel based on role
  const basePath = user?.role === 'super_admin' ? '/superadmin' : '/admin';

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    hasRole,
    isSuperAdmin,
    isAdmin,
    isAdminOrAbove,
    isStaff,
    isAuthenticated: !!user,
    basePath,
    sessionKicked,
    dismissSessionKicked,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
