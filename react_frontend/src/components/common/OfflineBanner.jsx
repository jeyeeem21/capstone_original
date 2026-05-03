/**
 * Offline Banner
 *
 * Persistent banner shown at the top of every page when offline.
 * Shows sync progress when reconnecting.
 * "N pending" badge is tappable — opens a modal listing queued actions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, Wifi, RefreshCw, CheckCircle, AlertTriangle, X, ClipboardList, Clock, LogIn } from 'lucide-react';
import { useOffline } from '../../pwa/OfflineContext';
import { getPendingSyncActions } from '../../pwa/offlineDb';

// Human-readable labels for queued actions
function describeAction(action) {
  // Use pre-built description if available
  if (action.description) return action.description;

  const method = action.method?.toUpperCase();
  const url = action.endpoint || action.url || '';
  const resource = url.includes('orders') ? 'Order'
    : url.includes('procurement-batches') ? 'Batch'
    : url.includes('procurement') ? 'Procurement'
    : url.includes('products') ? 'Product'
    : url.includes('customers') ? 'Customer'
    : url.includes('suppliers') ? 'Supplier'
    : url.includes('sales') ? 'Sale'
    : url.includes('drying') ? 'Drying Process'
    : url.includes('processing') ? 'Processing'
    : url.includes('delivery') ? 'Delivery'
    : url.includes('users') ? 'User'
    : url.includes('varieties') ? 'Variety'
    : url.includes('inventory') ? 'Inventory'
    : url.includes('settings') ? 'Settings'
    : url.includes('appearance') ? 'Appearance'
    : url.includes('website') ? 'Website Content'
    : url.includes('notifications') ? 'Notification'
    : url.split('/').filter(Boolean).pop() || 'item';
  if (method === 'POST')   return `Create ${resource}`;
  if (method === 'PUT')    return `Update ${resource}`;
  if (method === 'PATCH')  return `Update ${resource}`;
  if (method === 'DELETE') return `Delete ${resource}`;
  return `${method} ${resource}`;
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function PendingModal({ onClose }) {
  const [actions, setActions] = useState(null);

  useEffect(() => {
    getPendingSyncActions().then(setActions).catch(() => setActions([]));
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)] animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl border-t-2 sm:border-2 border-amber-300 dark:border-amber-700 overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-500 to-amber-600">
          <div className="flex items-center gap-2.5 text-white">
            <ClipboardList size={18} />
            <span className="font-bold text-sm">Pending Changes</span>
            {actions !== null && (
              <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {actions.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto max-h-72">
          {actions === null ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <RefreshCw size={18} className="animate-spin mr-2" /> Loading...
            </div>
          ) : actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2">
              <CheckCircle size={24} className="text-green-400" />
              <span className="text-sm">No pending changes</span>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {actions.map((action, i) => (
                <li key={action.id ?? i} className="flex items-center gap-3 px-5 py-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    action.method === 'DELETE' ? 'bg-red-400' :
                    action.method === 'POST'   ? 'bg-green-500' : 'bg-blue-500'
                  }`}>
                    {action.method === 'DELETE' ? '–' : action.method === 'POST' ? '+' : '~'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                      {describeAction(action)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {timeAgo(action.createdAt)}
                      {action.attempts > 0 && (
                        <span className="ml-1 text-amber-500">• {action.attempts} attempt{action.attempts > 1 ? 's' : ''}</span>
                      )}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    action.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                    'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  }`}>
                    {action.status ?? 'pending'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 text-xs text-gray-500 dark:text-gray-400 text-center">
          These will sync automatically when internet is restored.
        </div>
      </div>
    </div>
  );
}

export default function OfflineBanner() {
  const {
    isOnline,
    pendingCount,
    isSyncing,
    syncProgress,
    lastSyncResult,
    conflicts,
    triggerSync,
    dismissConflict,
  } = useOffline();

  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [backOnline, setBackOnline] = useState(false);
  const wasOfflineRef = useRef(false);
  const openModal = useCallback(() => setShowModal(true), []);
  const closeModal = useCallback(() => setShowModal(false), []);

  // Check if we have a real auth token (not offline placeholder)
  const hasRealToken = !!localStorage.getItem('auth_token') &&
    localStorage.getItem('auth_token') !== 'offline_session';

  // Track offline→online transition to show "Back Online" toast
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setBackOnline(true);
      const timer = setTimeout(() => setBackOnline(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (isOnline && pendingCount === 0 && !isSyncing && !lastSyncResult && !backOnline && conflicts.length === 0) {
    return null;
  }

  return (
    <>
      <div className="w-full z-[100] relative">
        {/* OFFLINE BANNER */}
        {!isOnline && (
          <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <WifiOff size={18} className="flex-shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold text-sm">You are currently OFFLINE</span>
                <span className="text-amber-100 text-xs ml-2 hidden sm:inline">
                  Changes are saved locally and will sync when internet is restored.
                </span>
              </div>
            </div>
            {pendingCount > 0 && (
              <button
                onClick={openModal}
                className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 flex items-center gap-1 transition-colors"
              >
                {pendingCount} pending
                <ClipboardList size={11} />
              </button>
            )}
          </div>
        )}

        {/* BACK ONLINE NOTIFICATION */}
        {isOnline && backOnline && !isSyncing && !lastSyncResult && pendingCount === 0 && (
          <div className="bg-green-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md animate-slideDown">
            <div className="flex items-center gap-2.5">
              <Wifi size={18} className="flex-shrink-0" />
              <span className="font-semibold text-sm">You're back online!</span>
            </div>
            <button onClick={() => setBackOnline(false)} className="text-white/80 hover:text-white flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        )}

        {/* SYNCING BANNER */}
        {isOnline && isSyncing && syncProgress && (
          <div className="bg-blue-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <RefreshCw size={18} className="flex-shrink-0 animate-spin" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm">
                  Syncing {syncProgress.current}/{syncProgress.total} changes...
                </span>
                {syncProgress.action && (
                  <span className="text-blue-100 text-xs ml-2 hidden sm:inline">
                    {syncProgress.action}
                  </span>
                )}
              </div>
            </div>
            <div className="w-24 bg-blue-600 rounded-full h-2 flex-shrink-0 hidden sm:block">
              <div
                className="bg-white rounded-full h-2 transition-all duration-300"
                style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* SYNC COMPLETE BANNER */}
        {isOnline && !isSyncing && lastSyncResult && (
          <div className="bg-green-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <CheckCircle size={18} className="flex-shrink-0" />
              <span className="font-semibold text-sm">
                All changes synced!
                {lastSyncResult.synced > 0 && ` (${lastSyncResult.synced} synced)`}
              </span>
            </div>
          </div>
        )}

        {/* PENDING — online but unsynced */}
        {isOnline && !isSyncing && !lastSyncResult && pendingCount > 0 && (
          <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <RefreshCw size={18} className="flex-shrink-0" />
              <button onClick={openModal} className="font-semibold text-sm underline underline-offset-2 hover:text-amber-100 transition-colors">
                {pendingCount} changes pending sync
              </button>
            </div>
            {hasRealToken ? (
              <button
                onClick={triggerSync}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1 rounded transition-colors"
              >
                Sync Now
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1 rounded transition-colors flex items-center gap-1.5"
              >
                <LogIn size={13} />
                Login to Sync
              </button>
            )}
          </div>
        )}

        {/* CONFLICT BANNERS */}
        {conflicts.map((conflict, index) => (
          <div key={index} className="bg-red-500 text-white px-4 py-2 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={18} className="flex-shrink-0" />
              <span className="text-sm">
                <span className="font-semibold">Sync conflict:</span> {conflict.action} — {conflict.error}
              </span>
            </div>
            <button onClick={() => dismissConflict(index)} className="text-white/80 hover:text-white flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Pending Actions Modal */}
      {showModal && <PendingModal onClose={closeModal} />}
    </>
  );
}

