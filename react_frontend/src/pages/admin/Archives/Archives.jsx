import { useState, useCallback, useMemo } from 'react';
import { Archive, RotateCcw, Trash2, Package, Tag, Truck, UserCheck, ShoppingCart, Sun, Settings2, Car, MapPin, AlertTriangle, RefreshCw, User, Shield } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatsCard, ConfirmModal, Modal, useToast, SkeletonStats, SkeletonTable } from '../../../components/ui';
import ArchiveDetailView from './ArchiveDetailView';
import { apiClient } from '../../../api';
import { useDataFetch, invalidateCache } from '../../../hooks';

const CACHE_KEY = '/archives';
const STATS_CACHE_KEY = '/archives/statistics';

// Module icon mapping
const moduleIcons = {
  products: Package,
  varieties: Tag,
  suppliers: Truck,
  customers: UserCheck,
  procurements: ShoppingCart,
  drying_processes: Sun,
  processings: Settings2,
  drivers: Car,
  deliveries: MapPin,
  users: Shield,
};

// Module color mapping
const moduleColors = {
  products: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  varieties: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
  suppliers: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  customers: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
  procurements: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  drying_processes: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  processings: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  drivers: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  deliveries: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  users: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
};

const Archives = () => {
  const toast = useToast();
  const [selectedItem, setSelectedItem] = useState(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch archives – add composite unique key (module:id) to avoid React key collisions
  const { data: archivesRaw = [], loading, refetch, isRefreshing, optimisticUpdate } = useDataFetch(CACHE_KEY);
  const { data: stats = { total: 0, by_module: [] } } = useDataFetch(STATS_CACHE_KEY);

  const archives = useMemo(() =>
    archivesRaw.map(a => ({ ...a, _originalId: a.id, id: `${a.module}:${a.id}`, record_data: a.record_data || null })),
    [archivesRaw]
  );

  // Handlers
  const handleRestore = useCallback((item) => {
    setSelectedItem(item);
    setIsRestoreModalOpen(true);
  }, []);

  const handleSoftDelete = useCallback((item) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  }, []);

  const handleView = useCallback((item) => {
    setSelectedItem(item);
    setIsViewModalOpen(true);
  }, []);

  const handleRestoreConfirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiClient.post(`/archives/${selectedItem.module}/${selectedItem._originalId}/restore`);
      if (response.success) {
        const restoredId = selectedItem.id;
        setIsRestoreModalOpen(false);
        // Immediately remove from archives list (optimistic update) for instant UI
        optimisticUpdate(prev => prev.filter(a => a.id !== restoredId));
        toast.success('Restored', `${selectedItem.name} has been restored successfully.`);
        // Invalidate both archives and the module's cache, then refetch in background
        invalidateCache(CACHE_KEY);
        invalidateCache(STATS_CACHE_KEY);
        invalidateCache(`/${selectedItem.module.replace('_', '-')}`);
        refetch();
        return;
      } else {
        throw new Error(response.error || 'Failed to restore');
      }
    } catch (error) {
      console.error('Error restoring:', error);
      toast.error('Error', 'Failed to restore record');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiClient.delete(`/archives/${selectedItem.module}/${selectedItem._originalId}`);
      if (response.success) {
        const deletedId = selectedItem.id;
        setIsDeleteModalOpen(false);
        // Immediately remove from archives list (optimistic update) for instant UI
        optimisticUpdate(prev => prev.filter(a => a.id !== deletedId));
        toast.success('Soft Deleted', 'Record has been soft deleted. It still exists in the database.');
        // Refetch in background to confirm
        invalidateCache(CACHE_KEY);
        invalidateCache(STATS_CACHE_KEY);
        refetch();
        return;
      } else {
        throw new Error(response.error || 'Failed to soft delete');
      }
    } catch (error) {
      console.error('Error soft deleting:', error);
      toast.error('Error', 'Failed to soft delete record');
    } finally {
      setSaving(false);
    }
  };

  // Stats cards data
  const totalArchived = stats.total || archives.length;
  const moduleCount = stats.by_module?.length || [...new Set(archives.map(a => a.module))].length;

  // Table columns
  const columns = useMemo(() => [
    {
      header: 'Record',
      accessor: 'name',
      cell: (row) => {
        const Icon = moduleIcons[row.module] || Package;
        const colorClass = moduleColors[row.module] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
        return (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${colorClass}`}>
              <Icon size={16} />
            </div>
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-100">{row.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">ID: {row._originalId}</p>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Module',
      accessor: 'module_label',
      cell: (row) => {
        const colorClass = moduleColors[row.module] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
            {row.module_label}
          </span>
        );
      }
    },
    {
      header: 'Archived Date',
      accessor: 'deleted_at',
    },
    {
      header: 'Archived By',
      accessor: 'archived_by',
      cell: (row) => row.archived_by ? (
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-full bg-button-100 dark:bg-button-900/30">
            <User size={12} className="text-button-600 dark:text-button-400" />
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-200">{row.archived_by}</span>
        </div>
      ) : (
        <span className="text-sm text-gray-400">—</span>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleRestore(row); }}
            className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-green-500 hover:text-green-700 dark:text-green-300 transition-colors"
            title="Restore"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleSoftDelete(row); }}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 dark:text-red-400 transition-colors"
            title="Soft Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )
    },
  ], [handleRestore, handleSoftDelete]);

  return (
    <div>
      <PageHeader
        title="Archives"
        description="View and manage archived records across all modules"
        icon={Archive}
        action={isRefreshing ? (
          <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">Syncing...</span>
        ) : null}
      />

      {/* Stats Cards */}
      {loading && archives.length === 0 ? (
        <SkeletonStats count={3} className="mb-6" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatsCard
            label="Total Archived"
            value={totalArchived}
            unit="records"
            icon={Archive}
            iconBgColor="bg-gradient-to-br from-button-400 to-button-600"
          />
          <StatsCard
            label="Modules Affected"
            value={moduleCount}
            unit="modules"
            icon={Package}
            iconBgColor="bg-gradient-to-br from-button-400 to-button-600"
          />
          <StatsCard
            label="Most Recent"
            value={archives.length > 0 ? archives[0]?.module_label : 'None'}
            unit={archives.length > 0 ? archives[0]?.deleted_at : ''}
            icon={RefreshCw}
            iconBgColor="bg-gradient-to-br from-button-500 to-button-700"
          />
        </div>
      )}

      {/* Module Filter Tabs */}

      {/* Table */}
      {loading && archives.length === 0 ? (
        <SkeletonTable rows={8} columns={5} />
      ) : archives.length === 0 ? (
        <div className="bg-white dark:bg-gray-700 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Archive size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No Archived Records</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Records that are archived by admins will appear here.</p>
        </div>
      ) : (
        <DataTable
          title="Archived Records"
          subtitle="All archived records across modules"
          columns={columns}
          data={archives}
          searchPlaceholder="Search archives..."
          filterField="module_label"
          filterPlaceholder="All Modules"
          dateFilterField="deleted_at"
          onRowDoubleClick={handleView}
        />
      )}

      {/* Restore Confirmation Modal */}
      <ConfirmModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        onConfirm={handleRestoreConfirm}
        title="Restore Record"
        message={`Are you sure you want to restore "${selectedItem?.name}"? It will be returned to its original module and become active again.`}
        confirmText="Restore"
        variant="success"
        icon={RotateCcw}
        isLoading={saving}
      />

      {/* Soft Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Soft Delete Record"
        message={`Are you sure you want to soft delete "${selectedItem?.name}"? The record will be hidden from archives but will remain in the database.`}
        confirmText="Soft Delete"
        variant="danger"
        icon={Trash2}
        isLoading={saving}
      />

      {/* View Archive Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`${selectedItem?.module_label || 'Archive'} Details`}
        size="2xl"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setIsViewModalOpen(false);
                handleSoftDelete(selectedItem);
              }}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              Soft Delete
            </button>
            <button
              onClick={() => {
                setIsViewModalOpen(false);
                handleRestore(selectedItem);
              }}
              className="px-4 py-2 bg-button-500 hover:bg-button-600 text-white rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              Restore
            </button>
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedItem && <ArchiveDetailView item={selectedItem} />}
      </Modal>
    </div>
  );
};

export default Archives;
