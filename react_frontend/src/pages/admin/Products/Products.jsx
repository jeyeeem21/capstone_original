import { useState, useCallback, useMemo, useRef } from 'react';
import { Package, Box, Tag, DollarSign, CheckCircle, XCircle, Archive, Scale, Hash, Calendar, ShoppingCart, Upload, X, ImageIcon, ClipboardList, Truck, Store } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatusBadge, ActionButtons, StatsCard, FormModal, ConfirmModal, FormInput, FormSelect, Modal, useToast, SkeletonStats, SkeletonTable } from '../../../components/ui';
import { apiClient } from '../../../api';
import { useDataFetch, invalidateCache } from '../../../hooks';
import { useAuth } from '../../../context/AuthContext';

const CACHE_KEY = '/products';
const VARIETIES_CACHE_KEY = '/varieties';

const Products = () => {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({ 
    product_name: '', 
    variety_id: '', 
    price: '',
    weight: '',
    status: 'active'
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [costAnalysis, setCostAnalysis] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const imageInputRef = useRef(null);
  // Order history modal state
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [orderHistoryProduct, setOrderHistoryProduct] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loadingOrderHistory, setLoadingOrderHistory] = useState(false);

  // Super-fast data fetching with cache
  const { 
    data: products, 
    loading, 
    isRefreshing,
    refetch,
    optimisticUpdate,
  } = useDataFetch('/products', {
    cacheKey: CACHE_KEY,
    initialData: [],
  });

  // Fetch varieties for dropdown
  const { 
    data: varieties, 
    refetch: refetchVarieties 
  } = useDataFetch('/varieties', {
    cacheKey: VARIETIES_CACHE_KEY,
    initialData: [],
  });

  // Memoized variety options for dropdown
  const varietyOptions = useMemo(() => {
    return varieties
      .filter(c => c.status === 'Active')
      .map(c => ({
        value: String(c.id),
        label: c.name
      }));
  }, [varieties]);

  const statusOptions = useMemo(() => [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ], []);

  const handleAdd = useCallback(() => {
    setFormData({ 
      product_name: '', 
      variety_id: '', 
      price: '',
      weight: '',
      status: 'active'
    });
    setErrors({});
    setImageFile(null);
    setImagePreview(null);
    refetchVarieties();
    setIsAddModalOpen(true);
  }, [refetchVarieties]);

  const handleView = useCallback((item) => {
    setSelectedItem(item);
    setIsViewModalOpen(true);
  }, []);

  const handleEdit = useCallback(async (item) => {
    setSelectedItem(item);
    setFormData({ 
      product_name: item.product_name, 
      variety_id: String(item.variety_id), 
      price: item.price || '',
      weight: item.weight || '',
      status: item.status
    });
    setErrors({});
    setCostAnalysis(null);
    setImageFile(null);
    setImagePreview(item.image || null);
    refetchVarieties();
    setIsEditModalOpen(true);
    // Fetch cost analysis for unit cost display
    try {
      const response = await apiClient.get(`/products/${item.product_id}/cost-analysis`);
      if (response.success && response.data) {
        setCostAnalysis(response.data);
      }
    } catch (error) {
      console.error('Error fetching cost analysis:', error);
    }
  }, [refetchVarieties]);

  const handleDelete = useCallback((item) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  }, []);

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user types
    setErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleImageChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }, []);

  const handleAddSubmit = async () => {
    if (saving) return; // Prevent double submit
    setSaving(true);
    try {
      setErrors({});
      const fd = new FormData();
      fd.append('product_name', formData.product_name);
      fd.append('variety_id', parseInt(formData.variety_id));
      fd.append('price', parseFloat(formData.price) || 0);
      fd.append('stocks', 0);
      fd.append('weight', formData.weight ? parseFloat(formData.weight) : '');
      fd.append('status', formData.status);
      if (imageFile) fd.append('image', imageFile);
      const response = await apiClient.post('/products', fd);
      
      if (response.success && response.data) {
        const productName = formData.product_name;
        // Optimistic: show new product instantly
        optimisticUpdate(prev => [response.data, ...prev]);
        // Close modal first
        setIsAddModalOpen(false);
        
        toast.success('Product Added', `${productName} has been added successfully.`);
        setImageFile(null);
        setImagePreview(null);
        // Refetch in background
        invalidateCache(CACHE_KEY);
        refetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error adding product:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        const fieldNames = Object.keys(backendErrors).map(f => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ');
        toast.error('Validation Error', `Please fix the following: ${fieldNames}`);
        throw error;
      } else {
        toast.error('Error', error.response?.data?.message || error.message || 'Failed to add product');
        throw error;
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async () => {
    if (saving) return; // Prevent double submit
    setSaving(true);
    try {
      setErrors({});
      const fd = new FormData();
      fd.append('_method', 'PUT');
      fd.append('product_name', formData.product_name);
      fd.append('variety_id', parseInt(formData.variety_id));
      fd.append('price', parseFloat(formData.price) || 0);
      fd.append('stocks', selectedItem.stocks);
      fd.append('weight', formData.weight ? parseFloat(formData.weight) : '');
      fd.append('status', formData.status);
      if (imageFile) fd.append('image', imageFile);
      const response = await apiClient.post(`/products/${selectedItem.product_id}`, fd);
      
      if (response.success && response.data) {
        const productName = formData.product_name;
        // Optimistic: update product instantly
        optimisticUpdate(prev => prev.map(p => p.product_id === selectedItem.product_id ? { ...p, ...response.data } : p));
        // Close modal first
        setIsEditModalOpen(false);
        
        toast.success('Product Updated', `${productName} has been updated.`);
        setImageFile(null);
        setImagePreview(null);
        // Refetch in background
        invalidateCache(CACHE_KEY);
        refetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error updating product:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        const fieldNames = Object.keys(backendErrors).map(f => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ');
        toast.error('Validation Error', `Please fix the following: ${fieldNames}`);
        throw error;
      } else {
        toast.error('Error', error.response?.data?.message || error.message || 'Failed to update product');
        throw error;
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (saving) return; // Prevent double submit
    setSaving(true);
    try {
      const response = await apiClient.delete(`/products/${selectedItem.product_id}`);
      
      if (response.success) {
        const productName = selectedItem.product_name;
        const archivedId = selectedItem.product_id;
        // Close modal first
        setIsDeleteModalOpen(false);
        
        // Immediately remove from local data (optimistic update) for instant UI
        optimisticUpdate(prev => prev.filter(p => p.product_id !== archivedId));
        toast.success('Product Archived', `${productName} has been archived.`);
        // Refetch in background to confirm
        invalidateCache(CACHE_KEY);
        refetch();
        return;
      } else {
        throw new Error(response.error || 'Failed to archive');
      }
    } catch (error) {
      console.error('Error archiving product:', error);
      toast.error('Error', 'Failed to archive product');
      refetch();
    } finally {
      setSaving(false);
    }
  };

  // Open order history modal for a product
  const handleOrderHistory = useCallback(async (row) => {
    setOrderHistoryProduct(row);
    setOrderHistory([]);
    setIsOrderHistoryOpen(true);
    setLoadingOrderHistory(true);
    try {
      const res = await apiClient.get(`/products/${row.product_id}/order-history`);
      if (res.success) {
        setOrderHistory(res.data || []);
        if (res.current_stock !== undefined) {
          setOrderHistoryProduct(prev => prev ? { ...prev, current_stock: res.current_stock } : prev);
        }
      }
    } catch (err) {
      console.error('Error fetching order history:', err);
    } finally {
      setLoadingOrderHistory(false);
    }
  }, []);

  // Stats
  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.status === 'active').length;
  const inactiveProducts = products.filter(p => p.status === 'inactive').length;
  const inStockProducts = products.filter(p => (p.stocks || 0) > 0).length;
  const outOfStockProducts = products.filter(p => (p.stocks || 0) <= 0).length;

  // Table columns
  const columns = useMemo(() => [
    { header: 'Product Name', accessor: 'product_name' },
    { 
      header: 'Variety', 
      accessor: 'variety_name',
      cell: (row) => (
        <span 
          className="px-2 py-1 rounded-full text-xs font-medium"
          style={{ 
            backgroundColor: `${row.variety_color}20`, 
            color: row.variety_color 
          }}
        >
          {row.variety_name}
        </span>
      )
    },
    { 
      header: 'Price', 
      accessor: 'price_formatted',
      cell: (row) => (
        <span className="font-semibold text-green-600 dark:text-green-400">{row.price_formatted}</span>
      )
    },
    { 
      header: 'Weight', 
      accessor: 'weight_formatted',
      cell: (row) => (
        <span className="text-gray-600 dark:text-gray-300">{row.weight_formatted || '-'}</span>
      )
    },
    { 
      header: 'Stocks', 
      accessor: 'stocks',
      cell: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-medium ${row.stocks > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
              {row.stocks.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{row.unit}</span>
          </div>
          {row.weight && row.stocks > 0 && (
            <p className="text-[10px] text-gray-400">{(row.stocks * parseFloat(row.weight)).toLocaleString()} kg total</p>
          )}
        </div>
      )
    },
    { 
      header: 'Status', 
      accessor: 'status',
      cell: (row) => <StatusBadge status={row.status === 'active' ? 'Active' : 'Inactive'} />
    },
    {
      header: 'Actions',
      accessor: 'actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOrderHistory(row)}
            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:text-blue-400 transition-colors"
            title="Order History"
          >
            <ClipboardList size={15} />
          </button>
          <ActionButtons
            onEdit={() => handleEdit(row)}
            onArchive={isSuperAdmin() && (row.stocks || 0) === 0 && !row.has_pending_orders ? () => handleDelete(row) : undefined}
          />
        </div>
      )
    }
  ], [handleView, handleEdit, handleDelete]);

  // ViewDetailItem component for view modal
  const ViewDetailItem = ({ icon: Icon, label, value, iconColor = 'text-primary-500', compact = false }) => (
    <div className={`flex items-start gap-2 ${compact ? 'p-2' : 'p-3'} bg-primary-50 dark:bg-primary-900/20 rounded-xl border-2 border-primary-200 dark:border-primary-700`}>
      <div className={`${compact ? 'p-1.5' : 'p-2'} rounded-lg bg-white dark:bg-gray-700 shadow-sm ${iconColor}`}>
        <Icon size={compact ? 14 : 18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate`}>{label}</p>
        <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-gray-800 dark:text-gray-100 mt-0.5 truncate`}>{value}</p>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader 
        title="Products" 
        description="Manage your product inventory and catalog" 
        icon={Package}
        action={isRefreshing ? (
          <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">Syncing...</span>
        ) : null}
      />

      {/* Stats Cards */}
      {loading ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatsCard 
            label="Total Products" 
            value={totalProducts} 
            unit={`${activeProducts} active`}
            icon={Package} 
            iconBgColor="bg-gradient-to-br from-button-400 to-button-600"
          />
          <StatsCard 
            label="Active" 
            value={activeProducts} 
            unit="Available for sale"
            icon={CheckCircle} 
            iconBgColor="bg-gradient-to-br from-green-400 to-green-600"
          />
          <StatsCard 
            label="In Stock" 
            value={inStockProducts} 
            unit={`${outOfStockProducts} out of stock`}
            icon={Box} 
            iconBgColor="bg-gradient-to-br from-blue-400 to-blue-600"
          />
          <StatsCard 
            label="Inactive" 
            value={inactiveProducts} 
            unit="Not available"
            icon={XCircle} 
            iconBgColor="bg-gradient-to-br from-gray-400 to-gray-600"
          />
        </div>
      )}

      {/* Products Table */}
      {loading ? (
        <SkeletonTable />
      ) : (
        <DataTable 
          title="Product Inventory"
          subtitle="Manage your rice products"
          columns={columns} 
          data={products} 
          searchPlaceholder="Search products..." 
          filterField="status"
          filterOptions={['active', 'inactive']}
          filterPlaceholder="All Status"
          onAdd={handleAdd}
          addLabel="Add Product"
          onRowDoubleClick={handleView}
        />
      )}

      {/* Add Modal */}
      <FormModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSubmit={handleAddSubmit} 
        title="Add New Product" 
        submitText="Add Product" 
        size="md"
        loading={saving}
      >
        {({ submitted }) => (
          <>
            {/* Image Upload */}
            <div className="mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Product Image <span className="text-gray-400 font-normal">(optional)</span></label>
              <div
                onClick={() => imageInputRef.current?.click()}
                className="relative cursor-pointer rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 transition-colors overflow-hidden"
              >
                {imagePreview ? (
                  <div className="relative h-36">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                      className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full shadow"
                    ><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-24 gap-1 text-gray-400 dark:text-gray-500">
                    <Upload size={22} />
                    <span className="text-xs">Click to upload image</span>
                    <span className="text-[10px] text-gray-400">JPG, PNG, WEBP — max 2MB</span>
                  </div>
                )}
              </div>
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/jpg,image/webp" className="hidden" onChange={handleImageChange} />
            </div>
            <FormInput 
              label="Product Name" 
              name="product_name" 
              value={formData.product_name} 
              onChange={handleFormChange} 
              required 
              placeholder="e.g. Premium Rice"
              error={errors.product_name}
              submitted={submitted}
            />
            <FormSelect 
              label="Variety" 
              name="variety_id" 
              value={formData.variety_id} 
              onChange={handleFormChange} 
              options={varietyOptions} 
              required
              placeholder="Select a variety"
              error={errors.variety_id}
              submitted={submitted}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormInput 
                label="Price (₱)" 
                name="price" 
                type="number" 
                value={formData.price} 
                onChange={handleFormChange} 
                placeholder="0.00"
                error={errors.price}
                submitted={submitted}
              />
              <FormInput 
                label="Weight (kg)" 
                name="weight" 
                type="number" 
                value={formData.weight} 
                onChange={handleFormChange} 
                required
                placeholder="e.g. 25"
                error={errors.weight}
                submitted={submitted}
              />
            </div>
          </>
        )}
      </FormModal>

      {/* Edit Modal */}
      <FormModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSubmit={handleEditSubmit} 
        title="Edit Product" 
        submitText="Save Changes" 
        size="md"
        loading={saving}
      >
        {({ submitted }) => {
          const hasStock = selectedItem?.stocks > 0;
          return (
          <>
            {/* Image Upload */}
            <div className="mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Product Image <span className="text-gray-400 font-normal">(optional)</span></label>
              <div
                onClick={() => imageInputRef.current?.click()}
                className="relative cursor-pointer rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 transition-colors overflow-hidden"
              >
                {imagePreview ? (
                  <div className="relative h-36">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                      className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full shadow"
                    ><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-24 gap-1 text-gray-400 dark:text-gray-500">
                    <Upload size={22} />
                    <span className="text-xs">Click to upload image</span>
                    <span className="text-[10px] text-gray-400">JPG, PNG, WEBP — max 2MB</span>
                  </div>
                )}
              </div>
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/jpg,image/webp" className="hidden" onChange={handleImageChange} />
            </div>
            <FormInput 
              label="Product Name" 
              name="product_name" 
              value={formData.product_name} 
              onChange={handleFormChange} 
              required 
              placeholder="e.g. Premium Rice"
              error={errors.product_name}
              submitted={submitted}
            />
            <FormSelect 
              label="Variety" 
              name="variety_id" 
              value={formData.variety_id} 
              onChange={handleFormChange} 
              options={varietyOptions} 
              required
              placeholder="Select a variety"
              error={errors.variety_id}
              submitted={submitted}
              disabled={hasStock}
              hint={hasStock ? 'Cannot change variety while product has existing stock' : ''}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormInput 
                  label="Price (₱)" 
                  name="price" 
                  type="number" 
                  value={formData.price} 
                  onChange={handleFormChange} 
                  placeholder="0.00"
                  error={errors.price}
                  submitted={submitted}
                />
                {costAnalysis?.has_data && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Unit Cost: <span className="font-semibold text-gray-700 dark:text-gray-200">₱{costAnalysis.avg_cost_per_unit.toLocaleString()}</span>
                  </p>
                )}
              </div>
              <FormInput 
                label="Weight (kg)" 
                name="weight" 
                type="number" 
                value={formData.weight} 
                onChange={handleFormChange} 
                required
                placeholder="e.g. 25"
                hint={hasStock ? 'Cannot change weight while product has existing stock' : ''}
                error={errors.weight}
                submitted={submitted}
                disabled={hasStock}
              />
            </div>
            <FormSelect 
              label="Status" 
              name="status" 
              value={formData.status} 
              onChange={handleFormChange} 
              options={statusOptions}
              submitted={submitted}
            />
          </>
          );
        }}
      </FormModal>

      {/* Archive Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Archive Product"
        message={`Are you sure you want to archive "${selectedItem?.product_name}"? It will be moved to the archives and can be restored later.`}
        confirmText="Archive"
        cancelText="Cancel"
        variant="warning"
        icon={Archive}
        isLoading={saving}
      />

      {/* View Modal */}
      <Modal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)} 
        title="Product Details" 
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
              Edit Product
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
          <div className="space-y-3">
            {/* Header with Status */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary-50 dark:from-gray-700 to-primary-100 dark:to-gray-800 rounded-xl border border-primary-200 dark:border-primary-700">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{selectedItem.product_name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Product ID: #{String(selectedItem.product_id).padStart(4, '0')}</p>
              </div>
              <StatusBadge status={selectedItem.status === 'active' ? 'Active' : 'Inactive'} />
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-3 gap-2">
              <ViewDetailItem icon={Hash} label="Product ID" value={`#${String(selectedItem.product_id).padStart(4, '0')}`} compact />
              <ViewDetailItem icon={Tag} label="Variety" value={selectedItem.variety_name} iconColor="text-blue-500" compact />
              <ViewDetailItem icon={DollarSign} label="Price" value={selectedItem.price_formatted} iconColor="text-green-500" compact />
              <ViewDetailItem icon={Box} label="Stocks" value={`${selectedItem.stocks.toLocaleString()} ${selectedItem.unit}${selectedItem.weight && selectedItem.stocks > 0 ? ` (${(selectedItem.stocks * parseFloat(selectedItem.weight)).toLocaleString()} kg)` : ''}`} iconColor="text-blue-500" compact />
              <ViewDetailItem icon={Scale} label="Weight" value={selectedItem.weight_formatted || 'N/A'} iconColor="text-purple-500" compact />
              <ViewDetailItem icon={ShoppingCart} label="Stock Status" value={selectedItem.stock_status} iconColor={selectedItem.is_in_stock ? 'text-green-500' : 'text-red-500'} compact />
              <ViewDetailItem icon={Calendar} label="Created" value={selectedItem.created_date} iconColor="text-gray-500 dark:text-gray-400" compact />
            </div>

            {/* Price Summary */}
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Unit Price</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">{selectedItem.price_formatted}</span>
              </div>
              {selectedItem.stocks > 0 && (
                <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  Total Value: <strong className="text-green-600 dark:text-green-400">₱{(selectedItem.price * selectedItem.stocks).toLocaleString()}</strong>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Order History Modal */}
      <Modal
        isOpen={isOrderHistoryOpen}
        onClose={() => { setIsOrderHistoryOpen(false); setOrderHistoryProduct(null); setOrderHistory([]); }}
        title={`Order History — ${orderHistoryProduct?.product_name || ''}`}
        size="xl"
        footer={
          <div className="flex justify-end">
            <button
              onClick={() => { setIsOrderHistoryOpen(false); setOrderHistoryProduct(null); setOrderHistory([]); }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        {orderHistoryProduct && (
          <div className="space-y-3">
            {/* Product Info */}
            <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <div className="p-2 bg-button-500 text-white rounded-lg">
                <Package size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{orderHistoryProduct.product_name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${orderHistoryProduct.variety_color}20`, color: orderHistoryProduct.variety_color }}>
                    {orderHistoryProduct.variety_name}
                  </span>
                  {orderHistoryProduct.weight_formatted && <span className="ml-2">{orderHistoryProduct.weight_formatted}</span>}
                  <span className="ml-2">{orderHistoryProduct.price_formatted}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{(orderHistoryProduct.current_stock ?? orderHistoryProduct.stocks ?? 0).toLocaleString()}</p>
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Current Stock</p>
              </div>
            </div>

            {/* Stats Summary */}
            {!loadingOrderHistory && orderHistory.length > 0 && (() => {
              const completed = orderHistory.filter(o => ['delivered', 'completed'].includes(o.status));
              const pending = orderHistory.filter(o => !['delivered', 'completed', 'cancelled'].includes(o.status));
              return (
                <div className="space-y-2">
                  {/* Completed / Delivered Stats */}
                  <div>
                    <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase mb-1 flex items-center gap-1">Delivered / Completed</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">{completed.length}</p>
                        <p className="text-[10px] font-medium text-green-500 uppercase">Orders</p>
                      </div>
                      <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">{completed.reduce((sum, o) => sum + o.quantity, 0)}</p>
                        <p className="text-[10px] font-medium text-green-500 uppercase">Units Sold</p>
                      </div>
                      <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">₱{completed.reduce((sum, o) => sum + o.subtotal, 0).toLocaleString()}</p>
                        <p className="text-[10px] font-medium text-green-500 uppercase">Revenue</p>
                      </div>
                    </div>
                  </div>
                  {/* Pending Stats */}
                  {pending.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase mb-1 flex items-center gap-1">Pending / Processing</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{pending.length}</p>
                          <p className="text-[10px] font-medium text-amber-500 uppercase">Orders</p>
                        </div>
                        <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{pending.reduce((sum, o) => sum + o.quantity, 0)}</p>
                          <p className="text-[10px] font-medium text-amber-500 uppercase">Units Reserved</p>
                        </div>
                        <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">₱{pending.reduce((sum, o) => sum + o.subtotal, 0).toLocaleString()}</p>
                          <p className="text-[10px] font-medium text-amber-500 uppercase">Pending Amount</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Overall Totals */}
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase mb-1 flex items-center gap-1">Overall</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <p className="text-lg font-bold text-gray-700 dark:text-gray-200">{orderHistory.filter(o => o.status !== 'cancelled').length}</p>
                        <p className="text-[10px] font-medium text-gray-500 uppercase">Total Orders</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <p className="text-lg font-bold text-gray-700 dark:text-gray-200">{orderHistory.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.quantity, 0)}</p>
                        <p className="text-[10px] font-medium text-gray-500 uppercase">Total Units</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <p className="text-lg font-bold text-gray-700 dark:text-gray-200">₱{orderHistory.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.subtotal, 0).toLocaleString()}</p>
                        <p className="text-[10px] font-medium text-gray-500 uppercase">Total Amount</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Orders Table */}
            {loadingOrderHistory ? (
              <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-button-500 mr-2" />
                Loading order history...
              </div>
            ) : orderHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                <ClipboardList size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No orders found for this product.</p>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-primary-200 dark:border-primary-700 overflow-x-auto max-h-[360px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary-50 dark:bg-primary-900/20 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Transaction</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Customer</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Qty</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Subtotal</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Type</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Status</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {orderHistory.map((order, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700/50">
                        <td className="px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-100">{order.transaction_id}</td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 truncate max-w-[120px]">{order.customer_name}</td>
                        <td className="px-3 py-2 text-center text-xs text-gray-600 dark:text-gray-300">{order.quantity}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-gray-800 dark:text-gray-100">₱{order.subtotal.toLocaleString()}</td>
                        <td className="px-3 py-2 text-center">
                          {order.is_delivery ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                              <Truck size={9} /> Delivery
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                              <Store size={9} /> Pick Up
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <StatusBadge status={order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' ')} />
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400">{order.date_formatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Products;
