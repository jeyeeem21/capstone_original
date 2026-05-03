import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ClipboardList, User, Calendar, Clock, Filter, FileText, Package, ShoppingCart, UserCog, Settings, TrendingUp, Monitor, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatsCard, FormModal, useToast, Skeleton, SkeletonStats, SkeletonTable } from '../../../components/ui';
import { apiClient } from '../../../api';
import { useDataFetch, invalidateCache } from '../../../hooks';

const CACHE_KEY = '/audit-trails';
const POLL_INTERVAL = 10 * 1000; // 10 s — audit trail should feel real-time

const AuditTrail = () => {
  const toast = useToast();
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Fetch audit trail data — poll every 10 s for near-realtime updates
  const {
    data: auditLogs,
    loading,
    isRefreshing,
    refetch,
  } = useDataFetch('/audit-trails', {
    cacheKey: CACHE_KEY,
    initialData: [],
    pollInterval: POLL_INTERVAL,
  });

  // Force a fresh network fetch on every mount so we never show stale cache
  useEffect(() => {
    invalidateCache(CACHE_KEY);
    refetch().then(() => setLastUpdated(Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track last-updated timestamp whenever data arrives
  useEffect(() => {
    if (!loading && !isRefreshing) setLastUpdated(Date.now());
  }, [auditLogs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick "X seconds ago" counter
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsAgo(lastUpdated ? Math.floor((Date.now() - lastUpdated) / 1000) : 0);
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const handleManualRefresh = useCallback(async () => {
    await refetch();
    setLastUpdated(Date.now());
  }, [refetch]);

  // Stats calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = useMemo(() => auditLogs.filter(log => log.timestamp?.startsWith(todayStr)).length, [auditLogs, todayStr]);
  const createActions = useMemo(() => auditLogs.filter(log => log.action === 'CREATE').length, [auditLogs]);
  const updateActions = useMemo(() => auditLogs.filter(log => log.action === 'UPDATE').length, [auditLogs]);
  const archiveActions = useMemo(() => auditLogs.filter(log => ['ARCHIVE', 'RESTORE', 'SOFT_DELETE', 'SOFT_DELETE_ALL'].includes(log.action)).length, [auditLogs]);

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setIsDetailModalOpen(true);
  };

  const getActionBadge = (action) => {
    const actionStyles = {
      'CREATE': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'UPDATE': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'DELETE': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      'ARCHIVE': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'RESTORE': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      'SOFT_DELETE': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'SOFT_DELETE_ALL': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'RETURN': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
      'LOGIN': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'LOGOUT': 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 dark:bg-gray-700 dark:text-gray-300',
    };
    return actionStyles[action] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
  };

  const getModuleIcon = (module) => {
    const icons = {
      'Products': Package,
      'Inventory': Package,
      'Partners': User,
      'Sales': TrendingUp,
      'Staff': UserCog,
      'Settings': Settings,
      'Procurement': ShoppingCart,
      'Procurement Batches': ShoppingCart,
      'Processing': Settings,
      'Authentication': User,
    };
    return icons[module] || FileText;
  };

  const columns = [
    { 
      header: 'Timestamp', 
      accessor: 'timestamp',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-gray-400" />
          <span className="text-sm">{row.timestamp ? new Date(row.timestamp).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
        </div>
      )
    },
    { 
      header: 'Action', 
      accessor: 'action',
      cell: (row) => (
        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${getActionBadge(row.action)}`}>
          {row.action}
        </span>
      )
    },
    { 
      header: 'Module', 
      accessor: 'module',
      cell: (row) => {
        const ModuleIcon = getModuleIcon(row.module);
        return (
          <div className="flex items-center gap-2">
            <ModuleIcon size={16} className="text-primary-500" />
            <span>{row.module}</span>
          </div>
        );
      }
    },
    { header: 'Description', accessor: 'description' },
    { 
      header: 'User', 
      accessor: 'user',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.user}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.role}</p>
        </div>
      )
    },
    { header: 'IP Address', accessor: 'ip_address' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        subtitle="Track and monitor all system activities and changes"
        icon={ClipboardList}
      />

      {/* Stats */}
      {loading ? (
        <SkeletonStats count={4} className="mb-2" />
      ) : (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Today's Activities"
          value={todayLogs}
          unit="activities today"
          icon={Calendar}
          iconBgColor="bg-gradient-to-br from-button-400 to-button-600"
        />
        <StatsCard
          label="Created Records"
          value={createActions}
          unit="records created"
          icon={FileText}
          iconBgColor="bg-gradient-to-br from-green-400 to-green-600"
        />
        <StatsCard
          label="Updated Records"
          value={updateActions}
          unit="records updated"
          icon={Filter}
          iconBgColor="bg-gradient-to-br from-blue-400 to-blue-600"
        />
        <StatsCard
          label="Archive Actions"
          value={archiveActions}
          unit="archive activities"
          icon={ClipboardList}
          iconBgColor="bg-gradient-to-br from-yellow-400 to-yellow-600"
        />
      </div>
      )}

      {/* Audit Logs Table */}
      {loading ? (
        <SkeletonTable rows={8} columns={7} />
      ) : (
      <>
        {/* Realtime status bar */}
        <div className="flex items-center justify-between px-1 -mb-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Live &mdash; auto-refreshes every {POLL_INTERVAL / 1000}s
            {lastUpdated && (
              <span className="ml-1 text-gray-400 dark:text-gray-500">
                &bull; updated {secondsAgo}s ago
              </span>
            )}
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      <DataTable
        title="Activity Logs"
        subtitle="Complete history of system activities"
        columns={columns}
        data={auditLogs}
        searchable
        searchPlaceholder="Search logs..."
        pagination
        defaultItemsPerPage={10}
        filterField="action"
        filterOptions={['CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE', 'SOFT_DELETE', 'SOFT_DELETE_ALL', 'RETURN', 'LOGIN', 'LOGOUT']}
        filterPlaceholder="All Actions"
        dateFilterField="timestamp"
        onRowDoubleClick={handleViewDetails}
      />
      </>
      )}

      {/* Detail Modal */}
      <FormModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Activity Details"
        size="md"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Action</p>
                  <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${getActionBadge(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Module</p>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{selectedLog.module}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Timestamp</p>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{selectedLog.timestamp}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">IP Address</p>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{selectedLog.ip_address}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</p>
              <p className="text-gray-800 dark:text-gray-100">{selectedLog.description}</p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Performed By</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="w-10 h-10 bg-gradient-to-br from-button-500 to-button-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {selectedLog.user.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{selectedLog.user}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selectedLog.role}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Additional Details</p>
              <div className="p-4 bg-gray-900 dark:bg-gray-800 rounded-xl">
                <pre className="text-xs text-green-400 font-mono overflow-x-auto">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </FormModal>
    </div>
  );
};

export default AuditTrail;