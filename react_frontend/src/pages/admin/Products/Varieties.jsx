import { useState, useCallback, useMemo } from 'react';
import { Tag, Layers, Package, CheckCircle, XCircle, Archive, Palette } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatusBadge, ActionButtons, StatsCard, FormModal, ConfirmModal, FormInput, FormSelect, FormTextarea, Modal, useToast, SkeletonStats, SkeletonTable } from '../../../components/ui';
import { apiClient } from '../../../api';
import { useDataFetch, invalidateCache } from '../../../hooks';

const CACHE_KEY = '/varieties';

// Color presets for quick selection
const colorPresets = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const Varieties = () => {
  const toast = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    color: '#22c55e', 
    status: 'Active'
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Super-fast data fetching with cache
  const { 
    data: varieties, 
    loading, 
    isRefreshing,
    refetch,
    optimisticUpdate,
  } = useDataFetch('/varieties', {
    cacheKey: CACHE_KEY,
    initialData: [],
  });

  const statusOptions = useMemo(() => [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ], []);

  const handleAdd = useCallback(() => {
    setFormData({ 
      name: '', 
      description: '', 
      color: '#22c55e', 
      status: 'Active'
    });
    setErrors({});
    setIsAddModalOpen(true);
  }, []);

  const handleView = useCallback((item) => {
    setSelectedItem(item);
    setIsViewModalOpen(true);
  }, []);

  const handleEdit = useCallback((item) => {
    setSelectedItem(item);
    setFormData({ 
      name: item.name, 
      description: item.description || '', 
      color: item.color || '#22c55e', 
      status: item.status
    });
    setErrors({});
    setIsEditModalOpen(true);
  }, []);

  const handleDelete = useCallback((item) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  }, []);

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleColorChange = useCallback((color) => {
    setFormData(prev => ({ ...prev, color }));
  }, []);

  const handleAddSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      setErrors({});
      const response = await apiClient.post('/varieties', formData);
      
      if (response.success && response.data) {
        const varietyName = formData.name;
        setIsAddModalOpen(false);
        toast.success('Variety Added', `${varietyName} has been added successfully.`);
        // Refetch in background
        invalidateCache(CACHE_KEY);
        refetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error adding variety:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        const fieldNames = Object.keys(backendErrors).map(f => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ');
        toast.error('Validation Error', `Please fix the following: ${fieldNames}`);
        throw error;
      } else {
        toast.error('Error', error.response?.data?.message || error.message || 'Failed to add variety');
        throw error;
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      setErrors({});
      const response = await apiClient.put(`/varieties/${selectedItem.id}`, formData);
      
      if (response.success && response.data) {
        const varietyName = formData.name;
        setIsEditModalOpen(false);
        toast.success('Variety Updated', `${varietyName} has been updated.`);
        // Refetch in background
        invalidateCache(CACHE_KEY);
        refetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error updating variety:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        const fieldNames = Object.keys(backendErrors).map(f => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ');
        toast.error('Validation Error', `Please fix the following: ${fieldNames}`);
        throw error;
      } else {
        toast.error('Error', error.response?.data?.message || error.message || 'Failed to update variety');
        throw error;
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiClient.delete(`/varieties/${selectedItem.id}`);
      
      if (response.success) {
        const varietyName = selectedItem.name;
        const archivedId = selectedItem.id;
        setIsDeleteModalOpen(false);
        // Immediately remove from local data (optimistic update) for instant UI
        optimisticUpdate(prev => prev.filter(v => v.id !== archivedId));
        toast.success('Variety Archived', `${varietyName} has been archived.`);
        // Refetch in background to confirm
        invalidateCache(CACHE_KEY);
        refetch();
        return;
      } else {
        throw new Error(response.error || 'Failed to archive');
      }
    } catch (error) {
      console.error('Error archiving variety:', error);
      toast.error('Error', 'Failed to archive variety');
      refetch();
    } finally {
      setSaving(false);
    }
  };

  // Stats
  const totalVarieties = varieties.length;
  const activeVarieties = varieties.filter(v => v.status === 'Active').length;
  const inactiveVarieties = varieties.filter(v => v.status === 'Inactive').length;
  const totalProducts = varieties.reduce((sum, v) => sum + (v.products_count || 0), 0);

  // Color preview component
  const ColorPreview = ({ color }) => (
    <div 
      className="w-6 h-6 rounded-full border-2 border-white shadow-sm" 
      style={{ backgroundColor: color }}
    />
  );

  // Color picker component
  const ColorPicker = ({ value, onChange, label }) => (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700 p-4">
      <div className="flex items-start gap-2 mb-3">
        <div className="p-2 rounded-lg bg-white dark:bg-gray-700 shadow-sm text-button-500">
          <Palette size={18} />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{label}</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">Used for card border in mobile view</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-12 rounded-lg cursor-pointer border-2 border-primary-200 dark:border-primary-700 hover:border-button-400 transition-colors"
            style={{ padding: 0 }}
          />
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={value.toUpperCase()}
            onChange={(e) => {
              const val = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) onChange(val);
            }}
            className="w-full px-3 py-2 font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-primary-200 dark:border-primary-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-button-500 focus:border-button-500"
            placeholder="#000000"
          />
        </div>
      </div>
      <div className="flex gap-1.5 mt-3">
        {colorPresets.map((preset, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(preset)}
            className={`w-8 h-8 rounded-lg border-2 hover:scale-110 transition-all shadow-sm ${value === preset ? 'border-button-500 ring-2 ring-button-300' : 'border-gray-200 dark:border-gray-600 hover:border-button-400'}`}
            style={{ backgroundColor: preset }}
            title={preset}
          />
        ))}
      </div>
      {errors.color && <p className="text-red-500 text-xs mt-2">{errors.color[0]}</p>}
    </div>
  );

  const columns = useMemo(() => [
    { 
      header: 'Variety', 
      accessor: 'name',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <ColorPreview color={row.color || '#22c55e'} />
          <p className="font-medium text-gray-800 dark:text-gray-100">{row.name}</p>
        </div>
      )
    },
    { 
      header: 'Description', 
      accessor: 'description',
      cell: (row) => (
        <p className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-xs">
          {row.description || '-'}
        </p>
      )
    },
    { header: 'Products', accessor: 'products_count', cell: (row) => row.products_count || 0 },
    { header: 'Status', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
    { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
      <ActionButtons onEdit={() => handleEdit(row)} onArchive={(row.products_count || 0) === 0 ? () => handleDelete(row) : undefined} />
    )},
  ], [handleView, handleEdit, handleDelete]);

  return (
    <div>
      <PageHeader 
        title="Varieties" 
        description="Manage rice varieties used in procurement and production" 
        icon={Tag}
        action={isRefreshing ? (
          <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">Syncing...</span>
        ) : null}
      />

      {/* Stats Cards */}
      {loading && varieties.length === 0 ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Varieties" value={totalVarieties} unit="varieties" icon={Layers} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <StatsCard label="Active" value={activeVarieties} unit="varieties" icon={CheckCircle} iconBgColor="bg-gradient-to-br from-button-500 to-button-700" />
          <StatsCard label="Inactive" value={inactiveVarieties} unit="varieties" icon={XCircle} iconBgColor="bg-gradient-to-br from-red-400 to-red-600" />
          <StatsCard label="Total Products" value={totalProducts} unit="products" icon={Package} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
        </div>
      )}

      {/* Table */}
      {loading && varieties.length === 0 ? (
        <SkeletonTable rows={5} columns={5} />
      ) : (
        <DataTable 
          title="Variety List" 
          subtitle="Manage all rice varieties" 
          columns={columns} 
          data={varieties} 
          searchPlaceholder="Search varieties..." 
          filterField="status" 
          filterPlaceholder="All Status" 
          onAdd={handleAdd} 
          addLabel="Add Variety"
          onRowDoubleClick={handleView}
        />
      )}

      {/* View Modal */}
      <Modal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)} 
        title="Variety Details" 
        size="2xl"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setIsViewModalOpen(false);
                handleEdit(selectedItem);
              }}
              className="px-4 py-2 bg-button-500 hover:bg-button-600 text-white rounded-lg transition-colors"
            >
              Edit Variety
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
        {selectedItem && (
          <div className="space-y-4">
            {/* Variety Name with Color */}
            <div 
              className="p-4 rounded-lg border-l-4"
              style={{ 
                borderLeftColor: selectedItem.color || '#22c55e',
                backgroundColor: `${selectedItem.color || '#22c55e'}10`
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="p-3 text-white rounded-lg"
                  style={{ backgroundColor: selectedItem.color || '#22c55e' }}
                >
                  <Tag size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{selectedItem.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{selectedItem.description || 'No description'}</p>
                </div>
                <StatusBadge status={selectedItem.status} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Color */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                  <Palette size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">Border Color</p>
                  <div className="flex items-center gap-2">
                    <ColorPreview color={selectedItem.color || '#22c55e'} />
                    <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{selectedItem.color || '#22c55e'}</span>
                  </div>
                </div>
              </div>

              {/* Products Count */}
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-button-50 dark:from-gray-700 to-primary-50 dark:to-gray-700 rounded-lg border-2 border-button-200 dark:border-gray-600">
                <div className="p-2 bg-button-500 text-white rounded-lg">
                  <Package size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">Products</p>
                  <p className="text-xl font-bold text-button-600 dark:text-button-400">{selectedItem.products_count || 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Modal */}
      <FormModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSubmit={handleAddSubmit} title="Add New Variety" submitText="Add Variety" size="md" loading={saving}>
        {({ submitted }) => (
          <>
            <FormInput 
              label="Variety Name" 
              name="name" 
              value={formData.name} 
              onChange={handleFormChange} 
              required 
              placeholder="e.g. Sinandomeng, IR64, Dinorado" 
              submitted={submitted} 
              error={errors.name?.[0]} 
            />
            <FormTextarea 
              label="Description" 
              name="description" 
              value={formData.description} 
              onChange={handleFormChange} 
              placeholder="Describe this rice variety (optional)" 
              rows={3} 
              submitted={submitted} 
              error={errors.description?.[0]} 
            />
            <ColorPicker 
              label="Border Color" 
              value={formData.color} 
              onChange={handleColorChange} 
            />
          </>
        )}
      </FormModal>

      {/* Edit Modal */}
      <FormModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSubmit={handleEditSubmit} title="Edit Variety" submitText="Save Changes" size="md" loading={saving}>
        {({ submitted }) => (
          <>
            <FormInput 
              label="Variety Name" 
              name="name" 
              value={formData.name} 
              onChange={handleFormChange} 
              required 
              placeholder="e.g. Sinandomeng, IR64, Dinorado" 
              submitted={submitted} 
              error={errors.name?.[0]} 
            />
            <FormTextarea 
              label="Description" 
              name="description" 
              value={formData.description} 
              onChange={handleFormChange} 
              placeholder="Describe this rice variety (optional)" 
              rows={3} 
              submitted={submitted} 
              error={errors.description?.[0]} 
            />
            <ColorPicker 
              label="Border Color" 
              value={formData.color} 
              onChange={handleColorChange} 
            />
            <FormSelect 
              label="Status" 
              name="status" 
              value={formData.status} 
              onChange={handleFormChange} 
              options={statusOptions} 
              required 
              submitted={submitted} 
              error={errors.status?.[0]} 
            />
          </>
        )}
      </FormModal>

      <ConfirmModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={handleDeleteConfirm} 
        title="Archive Variety" 
        message={`Are you sure you want to archive "${selectedItem?.name}"? It will be moved to the archives and can be restored later.`} 
        confirmText="Archive" 
        variant="warning" 
        icon={Archive} 
        loading={saving}
      />
    </div>
  );
};

export default Varieties;
