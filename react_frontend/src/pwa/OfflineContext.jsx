/**
 * Offline Context & Hook
 * 
 * Provides online/offline status, pending sync count,
 * and sync controls to the entire application.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { processSyncQueue, onSyncEvent, getSyncStatus } from './syncEngine';
import { getPendingSyncCount, getPendingEmailCount, clearAllData } from './offlineDb';

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const wasOffline = useRef(!navigator.onLine);

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    try {
      const syncCount = await getPendingSyncCount();
      const emailCount = await getPendingEmailCount();
      setPendingCount(syncCount + emailCount);
    } catch {
      // IndexedDB not ready yet
    }
  }, []);

  // Listen to online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // If we were offline and now back online, trigger sync
      if (wasOffline.current) {
        wasOffline.current = false;
        // Small delay to let network stabilize
        setTimeout(() => {
          processSyncQueue();
        }, 1000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOffline.current = true;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to sync queue changes (from offlineApi writes)
  useEffect(() => {
    const handler = () => refreshPendingCount();
    window.addEventListener('sync-queue-changed', handler);
    return () => window.removeEventListener('sync-queue-changed', handler);
  }, [refreshPendingCount]);

  // Listen to sync engine events
  useEffect(() => {
    const unsubscribe = onSyncEvent((event) => {
      switch (event.type) {
        case 'start':
          setIsSyncing(true);
          setSyncProgress({ current: 0, total: event.total });
          break;
        case 'progress':
          setSyncProgress({
            current: event.current,
            total: event.total,
            action: event.action,
          });
          break;
        case 'complete':
          setIsSyncing(false);
          setSyncProgress(null);
          setLastSyncResult(event);
          refreshPendingCount();
          // Auto-dismiss success after 5 seconds
          setTimeout(() => setLastSyncResult(null), 5000);
          break;
        case 'conflict':
          setConflicts(prev => [...prev, {
            action: event.action,
            error: event.error,
            timestamp: Date.now(),
          }]);
          break;
        case 'error':
          refreshPendingCount();
          break;
      }
    });

    return unsubscribe;
  }, [refreshPendingCount]);

  // Initial count load + auto-sync if online with pending items
  useEffect(() => {
    refreshPendingCount().then(async () => {
      // If we're online and have pending items, auto-sync on app load
      if (navigator.onLine) {
        try {
          const count = await getPendingSyncCount();
          const emailCount = await getPendingEmailCount();
          if (count + emailCount > 0) {
            setTimeout(() => processSyncQueue(), 1500);
          }
        } catch { /* ignore */ }
      }
    });

    // Periodic retry: check every 30s if there are still pending items to sync
    const retryInterval = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        const count = await getPendingSyncCount();
        const emailCount = await getPendingEmailCount();
        if (count + emailCount > 0) {
          processSyncQueue();
        }
      } catch { /* ignore */ }
    }, 30000);

    return () => clearInterval(retryInterval);
  }, [refreshPendingCount]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    return processSyncQueue();
  }, [isSyncing]);

  // Dismiss a conflict
  const dismissConflict = useCallback((index) => {
    setConflicts(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all offline data (call on logout)
  const clearOfflineData = useCallback(async () => {
    await clearAllData();
    setPendingCount(0);
    setConflicts([]);
    setSyncProgress(null);
    setLastSyncResult(null);
  }, []);

  const value = {
    isOnline,
    pendingCount,
    isSyncing,
    syncProgress,
    lastSyncResult,
    conflicts,
    triggerSync,
    dismissConflict,
    clearOfflineData,
    refreshPendingCount,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

/**
 * Hook to access offline status & sync controls
 */
export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
