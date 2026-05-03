import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Truck, Users, Package, CheckCircle, XCircle, Archive, Mail, Phone, MapPin, User, Building2, Box, Scale, Layers, ClipboardList, Loader2, ShoppingBag } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatusBadge, ActionButtons, StatsCard, FormModal, ConfirmModal, FormInput, FormSelect, Modal, useToast, SkeletonStats, SkeletonTable } from '../../../components/ui';
import { apiClient } from '../../../api';
import { useDataFetch, invalidateCache } from '../../../hooks';
import { useAuth } from '../../../context/AuthContext';

const CACHE_KEY = '/suppliers';

const Supplier = () => {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', contact: '', phone: '', email: '', address: '', status: 'Active' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [isProcurementsModalOpen, setIsProcurementsModalOpen] = useState(false);
  const [supplierProcurements, setSupplierProcurements] = useState([]);
  const [loadingProcurements, setLoadingProcurements] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const emailCheckTimeout = useRef(null);

  // Super-fast data fetching with cache
  const { 
    data: suppliers, 
    loading, 
    isRefreshing,
    refetch,
    optimisticUpdate 
  } = useDataFetch('/suppliers', {
    cacheKey: CACHE_KEY,
    initialData: [],
  });

  const statusOptions = useMemo(() => [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ], []);

  // Debounced email validation
  const checkEmailAvailability = useCallback(async (email, supplierId = null) => {
    // Clear previous timeout
    if (emailCheckTimeout.current) {
      clearTimeout(emailCheckTimeout.current);
    }

    // Validate email format first
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return;
    }

    // Debounce: wait 500ms after user stops typing
    emailCheckTimeout.current = setTimeout(async () => {
      try {
        setIsCheckingEmail(true);
        const response = await apiClient.post('/suppliers/check-email', {
          email,
          supplier_id: supplierId
        });

        if (response.success && !response.data.available) {
          setErrors(prev => ({
            ...prev,
            email: ['This email is already registered.']
          }));
        } else {
          // Clear email error if available
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.email;
            return newErrors;
          });
        }
      } catch (error) {
        console.error('Error checking email:', error);
      } finally {
        setIsCheckingEmail(false);
      }
    }, 500); // 500ms debounce
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (emailCheckTimeout.current) {
        clearTimeout(emailCheckTimeout.current);
      }
    };
  }, []);

  const handleAdd = useCallback(() => {
    setFormData({ name: '', contact: '', phone: '', email: '', address: '', status: 'Active' });
    setErrors({});
    setIsAddModalOpen(true);
  }, []);

  const handleView = useCallback((item) => {
    setSelectedItem(item);
    setIsViewModalOpen(true);
  }, []);

  const handleViewProcurements = useCallback(async (item) => {
    setSelectedItem(item);
    setIsProcurementsModalOpen(true);
    setLoadingProcurements(true);
    try {
      const response = await apiClient.get(`/suppliers/${item.id}/procurements`);
      if (response.success) {
        setSupplierProcurements(response.data || []);
      } else {
        toast.error('Error', 'Failed to load procurement records');
        setSupplierProcurements([]);
      }
    } catch (error) {
      console.error('Error fetching procurements:', error);
      toast.error('Error', 'Failed to load procurement records');
      setSupplierProcurements([]);
    } finally {
      setLoadingProcurements(false);
    }
  }, [toast]);

  const handleEdit = useCallback((item) => {
    setSelectedItem(item);
    setFormData({ name: item.name, contact: item.contact, phone: item.phone, email: item.email, address: item.address, status: item.status });
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
    
    // Clear error for this field when user types
    setErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });

    // Real-time validation for specific fields
    if (name === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        setErrors(prev => ({
          ...prev,
          email: ['Please enter a valid email address.']
        }));
      } else {
        // Check email availability in database
        checkEmailAvailability(value, selectedItem?.id);
      }
    }

    if (name === 'phone' && value) {
      // Allow spaces in phone numbers: +63 912 345 6789 or 09171234567
      const cleanPhone = value.replace(/\s/g, '');
      const phoneRegex = /^(\+63\d{10}|09\d{9})$/;
      if (!phoneRegex.test(cleanPhone)) {
        setErrors(prev => ({
          ...prev,
          phone: ['Phone must be +63 followed by 10 digits (e.g., +63 912 345 6789) or 09 followed by 9 digits (e.g., 09171234567).']
        }));
      }
    }
  }, [checkEmailAvailability, selectedItem]);

  const handleAddSubmit = async () => {
    if (saving) return; // Prevent double submit
    setSaving(true);
    try {
      setErrors({});
      // Strip spaces from phone before sending
      const submitData = {
        ...formData,
        phone: formData.phone.replace(/\s/g, '')
      };
      const response = await apiClient.post('/suppliers', submitData);
      
      if (response.success && response.data) {
        const supplierName = formData.name;
        // Close modal first
        setIsAddModalOpen(false);
        
        toast.success('Supplier Added', `${supplierName} has been added successfully.`);
        // Fire-and-forget email
        apiClient.post(`/suppliers/${response.data.id}/store-email`).catch(() => {});
        // Instantly show new supplier in the table
        optimisticUpdate(prev => [...prev, response.data]);
        // Then confirm with fresh server data
        invalidateCache(CACHE_KEY);
        await refetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error adding supplier:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        const fieldNames = Object.keys(backendErrors).map(f => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ');
        toast.error('Validation Error', `Please fix the following: ${fieldNames}`);
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
      // Strip spaces from phone before sending
      const submitData = {
        ...formData,
        phone: formData.phone.replace(/\s/g, '')
      };
      const response = await apiClient.put(`/suppliers/${selectedItem.id}`, submitData);
      
      if (response.success && response.data) {
        const supplierName = formData.name;
        // Close modal first
        setIsEditModalOpen(false);
        
        toast.success('Supplier Updated', `${supplierName} has been updated.`);
        // Fire-and-forget email
        apiClient.post(`/suppliers/${selectedItem.id}/update-email`, { changes: response._changes || [] }).catch(() => {});
        // Instantly show updated supplier in the table
        optimisticUpdate(prev => prev.map(s => s.id === selectedItem.id ? response.data : s));
        // Then confirm with fresh server data
        invalidateCache(CACHE_KEY);
        await refetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error updating supplier:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        const fieldNames = Object.keys(backendErrors).map(f => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ');
        toast.error('Validation Error', `Please fix the following: ${fieldNames}`);
        throw error;
      } else {
        toast.error('Error', error.response?.data?.message || error.message || 'Failed to update supplier');
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
      // Soft delete - use DELETE endpoint which sets deleted_at
      const response = await apiClient.delete(`/suppliers/${selectedItem.id}`);
      
      if (response.success) {
        const supplierName = selectedItem.name;
        const archivedId = selectedItem.id;
        // Close modal first
        setIsDeleteModalOpen(false);
        
        // Immediately remove from local data (optimistic update) for instant UI
        optimisticUpdate(prev => prev.filter(s => s.id !== archivedId));
        toast.success('Supplier Archived', `${supplierName} has been archived.`);
        // Refetch in background to confirm
        invalidateCache(CACHE_KEY);
        refetch();
        return;
      } else {
        throw new Error(response.error || 'Failed to archive');
      }
    } catch (error) {
      console.error('Error archiving supplier:', error);
      toast.error('Error', 'Failed to archive supplier');
      refetch();
    } finally {
      setSaving(false);
    }
  };

  // Stats
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter(s => s.status === 'Active').length;
  const inactiveSuppliers = suppliers.filter(s => s.status === 'Inactive').length;
  const totalKgProcured = suppliers.reduce((sum, s) => sum + (s.total_kg || 0), 0);
  const totalSacks = suppliers.reduce((sum, s) => sum + (s.total_sacks || 0), 0);

  const columns = useMemo(() => [
    { header: 'Company Name', accessor: 'name' },
    { header: 'Contact Person', accessor: 'contact' },
    { 
      header: 'Email & Phone', 
      accessor: 'contact_info',
      sortable: false,
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm">
            <Mail size={14} className="text-green-600 dark:text-green-400" />
            <a href={`mailto:${row.email}`} className="text-button-600 hover:text-button-700 dark:text-button-300 hover:underline">
              {row.email}
            </a>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Phone size={14} className="text-purple-600 dark:text-purple-400" />
            <a href={`tel:${row.phone}`} className="text-gray-700 dark:text-gray-200 hover:text-gray-900">
              {row.phone}
            </a>
          </div>
        </div>
      )
    },
    { header: 'Address', accessor: 'address' },
    { 
      header: 'Procured (Sacks / kg)', 
      accessor: 'kg_procured',
      cell: (row) => {
        const sacks = row.total_sacks || 0;
        const kg = row.total_kg || 0;
        return (
          <div className="text-sm">
            <span className={`font-semibold ${sacks > 0 ? 'text-button-600 dark:text-button-400' : 'text-gray-400'}`}>{sacks.toLocaleString()} sacks</span>
            <span className="text-gray-400 mx-1">/</span>
            <span className={`font-semibold ${kg > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>{kg.toLocaleString()} kg</span>
          </div>
        );
      }
    },
    { header: 'Status', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
    { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleViewProcurements(row); }}
          className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 hover:text-blue-700 dark:text-blue-300 transition-colors"
          title="View Procurement Records"
        >
          <ClipboardList size={15} />
        </button>
        <ActionButtons onEdit={() => handleEdit(row)} onArchive={isSuperAdmin() ? () => handleDelete(row) : undefined} />
      </div>
    )},
  ], [handleView, handleEdit, handleDelete, handleViewProcurements, isSuperAdmin]);

  return (
    <div>
      <PageHeader 
        title="Suppliers" 
        description="Manage your supplier database and partnerships" 
        icon={Truck}
        action={isRefreshing ? (
          <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">Syncing...</span>
        ) : null}
      />

      {/* Stats Cards - Show data immediately, skeleton only on true first load */}
      {loading && suppliers.length === 0 ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Suppliers" value={totalSuppliers} unit="suppliers" icon={Users} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <StatsCard label="Active" value={activeSuppliers} unit="suppliers" icon={CheckCircle} iconBgColor="bg-gradient-to-br from-button-500 to-button-700" />
          <StatsCard label="Total Sacks" value={totalSacks.toLocaleString()} unit="sacks" icon={Layers} iconBgColor="bg-gradient-to-br from-amber-400 to-amber-600" />
          <StatsCard label="Total Procured" value={totalKgProcured.toLocaleString()} unit="kg" icon={Scale} iconBgColor="bg-gradient-to-br from-green-400 to-green-600" />
        </div>
      )}

      {/* Table - Show data immediately, skeleton only on true first load */}
      {loading && suppliers.length === 0 ? (
        <SkeletonTable rows={5} columns={7} />
      ) : (
        <DataTable 
          title="Supplier List" 
          subtitle="Manage all supplier records" 
          columns={columns} 
          data={suppliers} 
          searchPlaceholder="Search suppliers..." 
          filterField="status" 
          filterPlaceholder="All Status" 
          onAdd={handleAdd} 
          addLabel="Add Supplier"
          onRowDoubleClick={handleView}
        />
      )}

      {/* View Modal */}
      <Modal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)} 
        title="Supplier Details" 
        size="2xl"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setIsViewModalOpen(false);
                handleViewProcurements(selectedItem);
              }}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <ClipboardList size={16} /> View Records
            </button>
            <button
              onClick={() => {
                setIsViewModalOpen(false);
                handleEdit(selectedItem);
              }}
              className="px-4 py-2 bg-button-500 hover:bg-button-600 text-white rounded-lg transition-colors"
            >
              Edit Supplier
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
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              {/* Business Info */}
              <div className="bg-gradient-to-r from-primary-50 dark:from-gray-700 to-button-50 dark:to-gray-700 p-3 rounded-lg border-2 border-primary-200 dark:border-primary-700">
                <div className="flex items-start gap-2">
                  <div className="p-2 bg-button-500 text-white rounded-lg">
                    <Building2 size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{selectedItem.name}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300">Company Name</p>
                  </div>
                  <StatusBadge status={selectedItem.status} />
                </div>
              </div>

              {/* Contact Person */}
              <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <User size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Contact Person</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{selectedItem.contact}</p>
                </div>
              </div>

              {/* Products */}
              <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-button-50 dark:from-gray-700 to-primary-50 dark:to-gray-700 rounded-lg border-2 border-button-200 dark:border-button-700">
                <div className="p-2 bg-button-500 text-white rounded-lg">
                  <Box size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Products Supplied</p>
                  <p className="text-xl font-bold text-button-600 dark:text-button-400">{selectedItem.products || 0}</p>
                </div>
              </div>

              {/* Procurement Stats */}
              <div className="p-3 bg-gradient-to-r from-green-50 dark:from-gray-700 to-emerald-50 dark:to-gray-700 rounded-lg border-2 border-green-200 dark:border-green-700">
                <div className="flex items-center gap-2 mb-2">
                  <Scale size={16} className="text-green-600 dark:text-green-400" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Procurement Summary</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Transactions</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{selectedItem.procurement_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Cost</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">₱{(selectedItem.total_cost || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Sacks</p>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{(selectedItem.total_sacks || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Kg</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">{(selectedItem.total_kg || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {/* Email & Phone in Same Section */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2.5">
                {/* Email */}
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                    <Mail size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300">Email</p>
                    <a href={`mailto:${selectedItem.email}`} className="font-semibold text-button-600 hover:text-button-700 dark:text-button-300 transition-colors text-sm">
                      {selectedItem.email}
                    </a>
                  </div>
                </div>
                {/* Phone */}
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                    <Phone size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300">Phone</p>
                    <a href={`tel:${selectedItem.phone}`} className="font-semibold text-button-600 hover:text-button-700 dark:text-button-300 transition-colors text-sm">
                      {selectedItem.phone}
                    </a>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
                  <MapPin size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Address</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{selectedItem.address}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modals */}
      <FormModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSubmit={handleAddSubmit} title="Add New Supplier" submitText="Add Supplier" size="lg" loading={saving}>
        {({ submitted }) => (
          <>
            <FormInput 
              label="Company Name" 
              name="name" 
              value={formData.name} 
              onChange={handleFormChange} 
              placeholder="Enter company name" 
              submitted={submitted} 
              error={errors.name?.[0]} 
            />
            <FormInput 
              label="Contact Person" 
              name="contact" 
              value={formData.contact} 
              onChange={handleFormChange} 
              required 
              placeholder="Enter contact person name" 
              submitted={submitted} 
              error={errors.contact?.[0]} 
            />
            <div className="grid grid-cols-2 gap-4">
              <FormInput 
                label="Phone" 
                name="phone" 
                value={formData.phone} 
                onChange={handleFormChange} 
                required 
                placeholder="+639171234567 or 09171234567" 
                submitted={submitted} 
                error={errors.phone?.[0]}
                hint="Format: +63 followed by 10 digits or 09 followed by 9 digits" 
              />
              <FormInput 
                label="Email" 
                name="email" 
                type="email" 
                value={formData.email} 
                onChange={handleFormChange} 
                required 
                placeholder="email@example.com" 
                submitted={submitted} 
                error={errors.email?.[0]}
                loading={isCheckingEmail}
              />
            </div>
            <FormInput 
              label="Address" 
              name="address" 
              value={formData.address} 
              onChange={handleFormChange} 
              required 
              placeholder="Enter company address" 
              submitted={submitted} 
              error={errors.address?.[0]} 
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

      <FormModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSubmit={handleEditSubmit} title="Edit Supplier" submitText="Save Changes" size="lg" loading={saving}>
        {({ submitted }) => (
          <>
            <FormInput 
              label="Company Name" 
              name="name" 
              value={formData.name} 
              onChange={handleFormChange} 
              placeholder="Enter company name" 
              submitted={submitted} 
              error={errors.name?.[0]} 
            />
            <FormInput 
              label="Contact Person" 
              name="contact" 
              value={formData.contact} 
              onChange={handleFormChange} 
              required 
              placeholder="Enter contact person name" 
              submitted={submitted} 
              error={errors.contact?.[0]} 
            />
            <div className="grid grid-cols-2 gap-4">
              <FormInput 
                label="Phone" 
                name="phone" 
                value={formData.phone} 
                onChange={handleFormChange} 
                required 
                placeholder="+639171234567 or 09171234567" 
                submitted={submitted} 
                error={errors.phone?.[0]}
                hint="Format: +63 followed by 10 digits or 09 followed by 9 digits" 
              />
              <FormInput 
                label="Email" 
                name="email" 
                type="email" 
                value={formData.email} 
                onChange={handleFormChange} 
                required 
                placeholder="email@example.com" 
                submitted={submitted} 
                error={errors.email?.[0]}
                loading={isCheckingEmail}
              />
            </div>
            <FormInput 
              label="Address" 
              name="address" 
              value={formData.address} 
              onChange={handleFormChange} 
              required 
              placeholder="Enter company address" 
              submitted={submitted} 
              error={errors.address?.[0]} 
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

      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title="Archive Supplier" message={`Are you sure you want to archive "${selectedItem?.name}"? It will be moved to the archives and can be restored later.`} confirmText="Archive" variant="warning" icon={Archive} loading={saving} />

      {/* Procurement Records Modal */}
      <Modal
        isOpen={isProcurementsModalOpen}
        onClose={() => setIsProcurementsModalOpen(false)}
        title={`Procurement Records — ${selectedItem?.name || ''}`}
        size="full"
        footer={
          <div className="flex justify-between items-center">
            {!loadingProcurements && supplierProcurements.length > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{supplierProcurements.length} record{supplierProcurements.length !== 1 ? 's' : ''}</span>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setIsProcurementsModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        {loadingProcurements ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-button-500" />
            <span className="ml-3 text-gray-500 dark:text-gray-400">Loading procurement records...</span>
          </div>
        ) : supplierProcurements.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <ShoppingBag size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">No procurement records</p>
            <p className="text-sm">No purchases from this supplier yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Summary Cards */}
            {(() => {
              const totalSacks = supplierProcurements.reduce((sum, p) => sum + (p.sacks || 0), 0);
              const totalKg = supplierProcurements.reduce((sum, p) => sum + (p.quantity_kg || 0), 0);
              const totalCost = supplierProcurements.reduce((sum, p) => sum + (p.total_cost || 0), 0);
              const varieties = [...new Set(supplierProcurements.map(p => p.variety_name).filter(Boolean))];
              return (
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-center">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Total Sacks</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{totalSacks.toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">Total Kg</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-300">{totalKg.toLocaleString()}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-center">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Cost</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">₱{totalCost.toLocaleString()}</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3 text-center">
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Varieties</p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{varieties.length}</p>
                    <p className="text-xs text-purple-400 truncate" title={varieties.join(', ')}>{varieties.join(', ') || '—'}</p>
                  </div>
                </div>
              );
            })()}
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Variety</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Sacks</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Quantity (kg)</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Price/kg</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Total Cost</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Batch</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {supplierProcurements.map((proc) => (
                  <tr key={proc.id} className="hover:bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{proc.created_at ? new Date(proc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: proc.variety_color || '#6B7280' }}></span>
                        <span className="text-gray-700 dark:text-gray-200 font-medium">{proc.variety_name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-100">{(proc.sacks || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-100">{(proc.quantity_kg || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">₱{(proc.price_per_kg || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-100">₱{(proc.total_cost || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs font-mono">{proc.batch_number || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={proc.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t flex justify-between items-center text-sm">
              <span className="text-gray-500 dark:text-gray-400">{supplierProcurements.length} record{supplierProcurements.length !== 1 ? 's' : ''}</span>
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                Total: ₱{supplierProcurements.reduce((sum, p) => sum + (p.total_cost || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Supplier;
