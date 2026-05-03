import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, Package, Truck, ArrowLeftRight, RotateCcw, ShoppingCart, X } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { useToast } from '../ui';
import { isNotifToastSuppressed } from '../../utils/notifToastGuard';

const NOTIFICATION_ICONS = {
  new_order: ShoppingCart,
  order_processing: Package,
  order_shipped: Truck,
  order_delivered: Check,
  order_cancelled: X,
  return_requested: ArrowLeftRight,
  picking_up: Truck,
  order_picked_up: Truck,
  order_returned: RotateCcw,
  order_restocked: Package,
  delivery_assigned: Truck,
  pickup_assigned: Truck,
};

const NOTIFICATION_COLORS = {
  new_order: 'text-blue-500',
  order_processing: 'text-amber-500',
  order_shipped: 'text-indigo-500',
  order_delivered: 'text-green-500',
  order_cancelled: 'text-red-500',
  return_requested: 'text-orange-500',
  picking_up: 'text-purple-500',
  order_picked_up: 'text-amber-600',
  order_returned: 'text-rose-500',
  order_restocked: 'text-emerald-500',
  delivery_assigned: 'text-blue-500',
  pickup_assigned: 'text-purple-500',
};

// Module-level singleton to prevent duplicate toasts across multiple NotificationBell instances
const _shownNotifIds = new Set();
let _lastToastTime = 0;
let _loginToastShown = false;

// Reset on logout so next login shows the toast again
if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    _shownNotifIds.clear();
    _lastToastTime = 0;
    _loginToastShown = false;
  });
}

const NotificationBell = ({ className = '' }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const intervalRef = useRef(null);
  const prevUnreadCountRef = useRef(null);
  const toast = useToast();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications/unread-count');
      let count = 0;
      if (res?.data?.data?.count !== undefined) {
        count = res.data.data.count;
      } else if (res?.data?.count !== undefined) {
        count = res.data.count;
      }
      setUnreadCount(count);

      // Detect new notifications and show toasts (debounce across instances)
      const now = Date.now();
      const isFirstPoll = prevUnreadCountRef.current === null;
      const hasNewNotifs = !isFirstPoll && count > prevUnreadCountRef.current;

      if (isFirstPoll || hasNewNotifs) {
        try {
          const notifRes = await apiClient.get('/notifications');
          const data = notifRes?.data?.data || notifRes?.data || [];
          const allNotifs = Array.isArray(data) ? data : [];

          if (isFirstPoll) {
            // First poll after mount (login): seed shown IDs and show summary toast
            allNotifs.forEach(n => _shownNotifIds.add(n.id));
            if (count > 0 && !_loginToastShown) {
              _loginToastShown = true;
              toast.addToast({
                type: 'info',
                title: 'New Notifications',
                message: `You have ${count} unread notification${count > 1 ? 's' : ''}`,
                duration: 4000,
              });
            }
          } else if (hasNewNotifs && now - _lastToastTime > 3000 && !isNotifToastSuppressed()) {
            _lastToastTime = now;
            // Only toast truly new notifications (max 2 to avoid flooding)
            const newUnread = allNotifs
              .filter(n => !n.read_at && !_shownNotifIds.has(n.id))
              .slice(0, 2);
            // Mark all fetched as shown regardless
            allNotifs.forEach(n => _shownNotifIds.add(n.id));
            newUnread.forEach(n => {
              const type = n.type || 'info';
              const toastType = type.includes('cancel') || type.includes('return') ? 'warning' : 'info';
              toast.addToast({ type: toastType, title: n.title || 'New Notification', message: n.message || '', duration: 3000 });
            });
          }
        } catch {
          // Silently fail
        }
      }
      prevUnreadCountRef.current = count;
    } catch {
      // Silently fail
    }
  }, [toast]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/notifications');
      const data = res?.data?.data || res?.data || [];
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id) => {
    try {
      await apiClient.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  // Poll for unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    intervalRef.current = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(intervalRef.current);
  }, [fetchUnreadCount]);

  // Fetch all notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/20 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-xl z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-primary-100 dark:border-primary-700 bg-gradient-to-r from-primary-50 to-white dark:from-gray-700 dark:to-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                <Bell size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const IconComponent = NOTIFICATION_ICONS[notif.type] || Bell;
                const iconColor = NOTIFICATION_COLORS[notif.type] || 'text-gray-500';
                const isUnread = !notif.read_at;

                return (
                  <div
                    key={notif.id}
                    onClick={() => isUnread && markAsRead(notif.id)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 transition-colors cursor-pointer ${
                      isUnread 
                        ? 'bg-primary-50/50 dark:bg-primary-900/10 hover:bg-primary-50 dark:hover:bg-primary-900/20' 
                        : 'hover:bg-button-500/10 dark:hover:bg-button-500/20'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
                      <IconComponent size={18} />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${isUnread ? 'font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
                          {notif.title}
                        </p>
                        {isUnread && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        {formatTime(notif.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
