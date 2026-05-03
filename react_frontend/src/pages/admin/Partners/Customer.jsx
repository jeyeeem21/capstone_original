import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { UserCheck, Users, ShoppingBag, CheckCircle, XCircle, Archive, Mail, Phone, MapPin, User, Building2, Package, ClipboardList, UserPlus, Send, ShieldCheck, Lock, Loader2, Edit, FileText, ScrollText, Eye, EyeOff, AlertTriangle, ArrowLeft, KeyRound, Shield } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatusBadge, ActionButtons, StatsCard, FormModal, ConfirmModal, FormInput, FormSelect, Modal, useToast, SkeletonStats, SkeletonTable, Button, AddressAutocomplete } from '../../../components/ui';
import { apiClient, websiteContentApi, usersApi } from '../../../api';
import { useDataFetch, invalidateCache } from '../../../hooks';
import { useAuth } from '../../../context/AuthContext';

const CACHE_KEY = '/customers';

const Customer = () => {
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
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [verificationStep, setVerificationStep] = useState('initial');
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [accountFormData, setAccountFormData] = useState({ password: '', password_confirmation: '' });
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [legalContent, setLegalContent] = useState(null);
  const [loadingLegal, setLoadingLegal] = useState(false);
  const [legalTab, setLegalTab] = useState('terms');
  const [resendCountdown, setResendCountdown] = useState(0);
  const emailCheckTimeout = useRef(null);
  const countdownRef = useRef(null);

  // Manage Account Modal state (for existing accounts)
  const [isManageAccountOpen, setIsManageAccountOpen] = useState(false);
  const [manageAccountStep, setManageAccountStep] = useState('edit'); // 'edit' | 'verification'
  const [manageFormData, setManageFormData] = useState({ email: '', password: '' });
  const [manageEmailError, setManageEmailError] = useState('');
  const [isCheckingManageEmail, setIsCheckingManageEmail] = useState(false);
  const [showManagePassword, setShowManagePassword] = useState(false);
  const [manageSaving, setManageSaving] = useState(false);
  const [manageCreatedAccount, setManageCreatedAccount] = useState(null);
  const [manageVerifyCode, setManageVerifyCode] = useState('');
  const [manageVerifyError, setManageVerifyError] = useState('');
  const [manageVerifying, setManageVerifying] = useState(false);
  const [manageResendingCode, setManageResendingCode] = useState(false);
  const [manageResendCountdown, setManageResendCountdown] = useState(0);
  const manageEmailCheckTimeout = useRef(null);
  const manageCountdownRef = useRef(null);

  // Super-fast data fetching with cache
  const { 
    data: customers, 
    loading, 
    isRefreshing,
    refetch,
    optimisticUpdate 
  } = useDataFetch('/customers', {
    cacheKey: CACHE_KEY,
    initialData: [],
  });

  const statusOptions = useMemo(() => [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ], []);

  // Pre-fetch legal content on mount so Terms modal opens instantly
  useEffect(() => {
    if (!legalContent) {
      websiteContentApi.getLegalContent().then(res => {
        if (res.success && res.data) setLegalContent(res.data);
      }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced email validation
  const checkEmailAvailability = useCallback(async (email, customerId = null) => {
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
        const response = await apiClient.post('/customers/check-email', {
          email,
          customer_id: customerId
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
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      if (manageEmailCheckTimeout.current) {
        clearTimeout(manageEmailCheckTimeout.current);
      }
      if (manageCountdownRef.current) {
        clearInterval(manageCountdownRef.current);
      }
    };
  }, []);

  const startCountdown = useCallback((seconds = 60) => {
    setResendCountdown(seconds);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // --- Customer Orders & Account handlers ---
  const handleViewOrders = useCallback(async (item) => {
    setSelectedItem(item);
    setIsOrdersModalOpen(true);
    setLoadingOrders(true);
    try {
      const response = await apiClient.get(`/customers/${item.id}/orders`);
      if (response.success) {
        setCustomerOrders(response.data || []);
      } else {
        toast.error('Error', 'Failed to load orders');
        setCustomerOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Error', 'Failed to load customer orders');
      setCustomerOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [toast]);

  const handleOpenAccountModal = useCallback((item) => {
    setSelectedItem(item);
    setTermsAccepted(false);
    setLegalTab('terms');
    setShowTermsModal(true);
  }, []);

  const handleAcceptTerms = useCallback(async () => {
    setTermsAccepted(true);
    setShowTermsModal(false);
    setVerificationStep('code-sent');
    setVerificationCode('');
    setAccountFormData({ password: '', password_confirmation: '' });
    setErrors({});
    setIsAccountModalOpen(true);
    // Auto-send verification code
    setSendingCode(true);
    try {
      const response = await apiClient.post(`/customers/${selectedItem.id}/send-verification`);
      if (response.success) {
        startCountdown(60);
        toast.success('Code Sent', `Verification code sent to ${selectedItem.email}`);
      } else {
        toast.error('Error', response.message || 'Failed to send verification code');
        setVerificationStep('initial');
      }
    } catch (error) {
      toast.error('Error', error.message || 'Failed to send verification code');
      setVerificationStep('initial');
    } finally {
      setSendingCode(false);
    }
  }, [selectedItem, toast, startCountdown]);

  const handleDeclineTerms = useCallback(() => {
    setShowTermsModal(false);
    setSelectedItem(null);
    toast.info('Cancelled', 'Account creation cancelled. Terms and conditions were not accepted.');
  }, [toast]);

  const handleSendVerificationCode = useCallback(async () => {
    setSendingCode(true);
    try {
      const response = await apiClient.post(`/customers/${selectedItem.id}/send-verification`);
      if (response.success) {
        setVerificationStep('code-sent');
        startCountdown(60);
        toast.success('Code Sent', `Verification code sent to ${selectedItem.email}`);
      } else {
        toast.error('Error', response.message || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Error sending verification code:', error);
      toast.error('Error', error.response?.data?.message || error.message || 'Failed to send verification code');
    } finally {
      setSendingCode(false);
    }
  }, [selectedItem, toast, startCountdown]);

  const handleVerifyCode = useCallback(async (code) => {
    setVerifying(true);
    setErrors({});
    try {
      const response = await apiClient.post(`/customers/${selectedItem.id}/verify-code`, { code });
      if (response.success) {
        setVerificationStep('verified');
        toast.success('Email Verified', 'Email address has been verified successfully');
      } else {
        setErrors({ code: [response.message || 'Invalid verification code'] });
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      const msg = error.response?.data?.message || error.message || 'Verification failed';
      setErrors({ code: [msg] });
    } finally {
      setVerifying(false);
    }
  }, [selectedItem, toast]);

  const handleCreateAccountSubmit = useCallback(async () => {
    setCreatingAccount(true);
    setErrors({});
    try {
      const response = await apiClient.post(`/customers/${selectedItem.id}/create-account`, accountFormData);
      if (response.success) {
        toast.success('Account Created', `Account has been created for ${selectedItem.name}`);
        setIsAccountModalOpen(false);
        invalidateCache(CACHE_KEY);
        refetch();
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error creating account:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
      }
      toast.error('Error', error.response?.data?.message || error.message || 'Failed to create account');
    } finally {
      setCreatingAccount(false);
    }
  }, [selectedItem, accountFormData, toast, refetch]);

  const handleAdd = useCallback(() => {
    setFormData({ name: '', contact: '', phone: '', email: '', address: '', address_landmark: '', status: 'Active' });
    setErrors({});
    setIsAddModalOpen(true);
  }, []);

  const handleView = useCallback((item) => {
    setSelectedItem(item);
    setIsViewModalOpen(true);
  }, []);

  const handleEdit = useCallback((item) => {
    setSelectedItem(item);
    setFormData({ name: item.name, contact: item.contact, phone: item.phone, email: item.email, address: item.address, address_landmark: item.address_landmark || '', status: item.status });
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
      const response = await apiClient.post('/customers', submitData);
      
      if (response.success && response.data) {
        const customerName = formData.name;
        // Close add modal
        setIsAddModalOpen(false);
        
        toast.success('Customer Added', `${customerName} has been added successfully.`);
        // Fire-and-forget email
        apiClient.post(`/customers/${response.data.id}/store-email`).catch(() => {});
        // Instantly show new customer in the table
        optimisticUpdate(prev => [...prev, response.data]);
        // Then confirm with fresh server data
        invalidateCache(CACHE_KEY);
        await refetch();

        // Chain into account creation flow: open Terms modal
        const newCustomer = response.data;
        handleOpenAccountModal(newCustomer);
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        const fieldNames = Object.keys(backendErrors).map(f => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ');
        toast.error('Validation Error', `Please fix the following: ${fieldNames}`);
        throw error;
      } else {
        toast.error('Error', error.response?.data?.message || error.message || 'Failed to add customer');
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
      const response = await apiClient.put(`/customers/${selectedItem.id}`, submitData);
      
      if (response.success && response.data) {
        const customerName = formData.name;
        // Close modal first
        setIsEditModalOpen(false);
        
        toast.success('Customer Updated', `${customerName} has been updated.`);
        // Fire-and-forget email
        apiClient.post(`/customers/${selectedItem.id}/update-email`, { changes: response._changes || [] }).catch(() => {});
        // Instantly show updated customer in the table
        optimisticUpdate(prev => prev.map(c => c.id === selectedItem.id ? response.data : c));
        // Then confirm with fresh server data
        invalidateCache(CACHE_KEY);
        await refetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        const fieldNames = Object.keys(backendErrors).map(f => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ');
        toast.error('Validation Error', `Please fix the following: ${fieldNames}`);
        throw error;
      } else {
        toast.error('Error', error.response?.data?.message || error.message || 'Failed to update customer');
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
      // Soft delete - use DELETE endpoint which now sets deleted_at
      const response = await apiClient.delete(`/customers/${selectedItem.id}`);
      
      if (response.success) {
        const customerName = selectedItem.name;
        const archivedId = selectedItem.id;
        // Close modal first
        setIsDeleteModalOpen(false);
        
        // Immediately remove from local data (optimistic update) for instant UI
        optimisticUpdate(prev => prev.filter(c => c.id !== archivedId));
        toast.success('Customer Archived', `${customerName} has been archived.`);
        // Refetch in background to confirm
        invalidateCache(CACHE_KEY);
        refetch();
        return;
      } else {
        throw new Error(response.error || 'Failed to archive');
      }
    } catch (error) {
      console.error('Error archiving customer:', error);
      toast.error('Error', 'Failed to archive customer');
      refetch();
    } finally {
      setSaving(false);
    }
  };

  // ========== Manage Account Handlers (for existing customer accounts) ==========

  const startManageCountdown = useCallback((seconds = 60) => {
    setManageResendCountdown(seconds);
    clearInterval(manageCountdownRef.current);
    manageCountdownRef.current = setInterval(() => {
      setManageResendCountdown(prev => {
        if (prev <= 1) { clearInterval(manageCountdownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleManageAccount = useCallback((item) => {
    setSelectedItem(item);
    setManageFormData({ email: item.email || '', password: '' });
    setManageEmailError('');
    setShowManagePassword(false);
    setManageAccountStep('edit');
    setManageVerifyCode('');
    setManageVerifyError('');
    setManageCreatedAccount(null);
    setIsManageAccountOpen(true);
  }, []);

  const handleManageAccountFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setManageFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'email') {
      setManageEmailError('');
      if (manageEmailCheckTimeout.current) {
        clearTimeout(manageEmailCheckTimeout.current);
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value || !emailRegex.test(value)) {
        if (value) setManageEmailError('Please enter a valid email address.');
        return;
      }
      if (value.toLowerCase() === selectedItem?.email?.toLowerCase()) {
        setManageEmailError('');
        return;
      }
      manageEmailCheckTimeout.current = setTimeout(async () => {
        try {
          setIsCheckingManageEmail(true);
          const response = await usersApi.checkEmail(value);
          if (response.success && response.data && response.data.taken) {
            setManageEmailError('This email is already registered.');
          } else {
            setManageEmailError('');
          }
        } catch {
          setManageEmailError('Error checking email availability.');
        } finally {
          setIsCheckingManageEmail(false);
        }
      }, 500);
    }
  }, [selectedItem]);

  const handleManageAccountSubmit = useCallback(async () => {
    const passwordChanged = !!manageFormData.password;
    if (!passwordChanged) {
      toast.info('No Changes', 'No changes were made to the account.');
      return;
    }
    if (manageFormData.password.length < 8) {
      toast.error('Error', 'Password must be at least 8 characters long.');
      return;
    }
    try {
      setManageSaving(true);
      const payload = {};
      if (passwordChanged) payload.password = manageFormData.password;

      const response = await usersApi.update(selectedItem.user_id, payload);

      if (response._requires_reverification) {
        setManageCreatedAccount({
          id: selectedItem.user_id,
          name: selectedItem.name,
          email: manageFormData.email || selectedItem.email,
        });
        setManageAccountStep('verification');
        setManageVerifyCode('');
        setManageVerifyError('');
        startManageCountdown(60);
        toast.success('Account Updated', 'A verification code has been sent to the email.');
        invalidateCache(CACHE_KEY);
        refetch();
      } else {
        toast.success('Account Updated', 'Account has been updated successfully.');
        handleManageAccountClose();
        invalidateCache(CACHE_KEY);
        refetch();
      }
      // Fire-and-forget notification email
      apiClient.post(`/users/${selectedItem.user_id}/update-email`, { changes: response._changes || [] }).catch(() => {});
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to update account.';
      toast.error('Error', msg);
    } finally {
      setManageSaving(false);
    }
  }, [manageFormData, manageEmailError, isCheckingManageEmail, selectedItem, toast, startManageCountdown, refetch]);

  const handleManageAccountClose = useCallback(() => {
    setIsManageAccountOpen(false);
    setManageAccountStep('edit');
    setManageFormData({ email: '', password: '' });
    setManageEmailError('');
    setShowManagePassword(false);
    setManageCreatedAccount(null);
    setManageVerifyCode('');
    setManageVerifyError('');
    setManageResendCountdown(0);
    clearInterval(manageCountdownRef.current);
  }, []);

  const handleManageVerifyCode = useCallback(async (code) => {
    if (code.length < 6) return;
    setManageVerifying(true);
    setManageVerifyError('');
    try {
      const response = await apiClient.post(`/users/staff/${manageCreatedAccount.id}/verify-email`, {
        email: manageCreatedAccount.email,
        code: code,
      });
      if (response.success) {
        toast.success('Email Verified', 'Customer email has been verified successfully!');
        handleManageAccountClose();
        invalidateCache(CACHE_KEY);
        refetch();
      } else {
        setManageVerifyError(response.message || 'Invalid verification code.');
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Verification failed. Please try again.';
      setManageVerifyError(msg);
    } finally {
      setManageVerifying(false);
    }
  }, [manageCreatedAccount, toast, handleManageAccountClose, refetch]);

  const handleManageResendCode = useCallback(async () => {
    if (manageResendCountdown > 0) return;
    setManageResendingCode(true);
    setManageVerifyError('');
    try {
      const response = await apiClient.post(`/users/staff/${manageCreatedAccount.id}/resend-verification`);
      if (response.success) {
        toast.success('Code Sent', 'A new verification code has been sent.');
        startManageCountdown(60);
      } else {
        setManageVerifyError(response.message || 'Failed to resend code.');
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to resend code.';
      setManageVerifyError(msg);
    } finally {
      setManageResendingCode(false);
    }
  }, [manageCreatedAccount, manageResendCountdown, toast, startManageCountdown]);

  // Stats
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'Active').length;
  const inactiveCustomers = customers.filter(c => c.status === 'Inactive').length;
  const totalOrders = customers.reduce((sum, c) => sum + c.orders, 0);

  const columns = useMemo(() => [
    { header: 'Business Name', accessor: 'name' },
    { header: 'Contact Person', accessor: 'contact' },
    { 
      header: 'Email & Phone', 
      accessor: 'contact_info',
      sortable: false,
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm">
            <Mail size={14} className={`shrink-0 ${row.has_account ? (row.email_verified_at ? '!text-green-500 dark:!text-green-400' : '!text-amber-500 dark:!text-amber-400') : '!text-gray-400 dark:!text-gray-500'}`} title={row.has_account ? (row.email_verified_at ? 'Email Verified' : 'Email Not Verified') : 'No Account'} />
            <a href={`mailto:${row.email}`} className="text-button-600 hover:text-button-700 dark:text-button-300 hover:underline">
              {row.email}
            </a>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Phone size={14} className="shrink-0 !text-purple-600 dark:!text-purple-400" />
            <a href={`tel:${row.phone}`} className="text-gray-700 dark:text-gray-200 hover:text-gray-900">
              {row.phone}
            </a>
          </div>
        </div>
      )
    },
    { header: 'Address', accessor: 'address' },
    { header: 'Orders', accessor: 'orders' },
    { header: 'Status', accessor: 'status', cell: (row) => (
      <div className="flex flex-col items-start gap-1">
        <StatusBadge status={row.status} />
        {!row.has_account && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">No Account</span>
        )}
      </div>
    )},
    { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleViewOrders(row); }}
          className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 hover:text-blue-700 dark:text-blue-300 transition-colors"
          title="View Orders"
        >
          <ClipboardList size={15} />
        </button>
        {!row.has_account ? (
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenAccountModal(row); }}
            className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-green-500 hover:text-green-700 dark:text-green-300 transition-colors"
            title="Create Account"
          >
            <UserPlus size={15} />
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); handleManageAccount(row); }}
            className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 hover:text-blue-700 dark:text-blue-300 transition-colors"
            title="Manage Account"
          >
            <KeyRound size={15} />
          </button>
        )}
        <ActionButtons onEdit={() => handleEdit(row)} onArchive={isSuperAdmin() ? () => handleDelete(row) : undefined} />
      </div>
    )},
  ], [handleView, handleEdit, handleDelete, handleViewOrders, handleOpenAccountModal, handleManageAccount, isSuperAdmin]);

  return (
    <div>
      <PageHeader 
        title="Customers" 
        description="Manage your customer database and relationships" 
        icon={UserCheck}
        action={isRefreshing ? (
          <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">Syncing...</span>
        ) : null}
      />

      {/* Stats Cards - Show data immediately, skeleton only on true first load */}
      {loading && customers.length === 0 ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Customers" value={totalCustomers} unit="customers" icon={Users} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <StatsCard label="Active" value={activeCustomers} unit="customers" icon={CheckCircle} iconBgColor="bg-gradient-to-br from-button-500 to-button-700" />
          <StatsCard label="Inactive" value={inactiveCustomers} unit="customers" icon={XCircle} iconBgColor="bg-gradient-to-br from-red-400 to-red-600" />
          <StatsCard label="Total Orders" value={totalOrders} unit="orders" icon={ShoppingBag} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
        </div>
      )}

      {/* Table - Show data immediately, skeleton only on true first load */}
      {loading && customers.length === 0 ? (
        <SkeletonTable rows={5} columns={7} />
      ) : (
        <DataTable 
          title="Customer List" 
          subtitle="Manage all customer records" 
          columns={columns} 
          data={customers} 
          searchPlaceholder="Search customers..." 
          filterField="status" 
          filterPlaceholder="All Status" 
          onAdd={handleAdd} 
          addLabel="Add Customer"
          onRowDoubleClick={handleView}
        />
      )}

      {/* View Modal */}
      <Modal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)} 
        title="Customer Details" 
        size="2xl"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setIsViewModalOpen(false);
                handleViewOrders(selectedItem);
              }}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <ClipboardList size={16} /> View Orders
            </button>
            {selectedItem && !selectedItem.has_account && (
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleOpenAccountModal(selectedItem);
                }}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <UserPlus size={16} /> Create Account
              </button>
            )}
            {selectedItem && selectedItem.has_account && (
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleManageAccount(selectedItem);
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <KeyRound size={16} /> Manage Account
              </button>
            )}
            <button
              onClick={() => {
                setIsViewModalOpen(false);
                handleEdit(selectedItem);
              }}
              className="px-4 py-2 bg-button-500 hover:bg-button-600 text-white rounded-lg transition-colors"
            >
              Edit Customer
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
                    <p className="text-xs text-gray-600 dark:text-gray-300">Business Name</p>
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

              {/* Orders */}
              <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-button-50 dark:from-gray-700 to-primary-50 dark:to-gray-700 rounded-lg border-2 border-button-200 dark:border-button-700">
                <div className="p-2 bg-button-500 text-white rounded-lg">
                  <Package size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Total Orders</p>
                  <p className="text-xl font-bold text-button-600 dark:text-button-400">{selectedItem.orders || 0}</p>
                </div>
              </div>

              {/* Account Status */}
              <div className={`flex items-start gap-2 p-3 rounded-lg ${selectedItem.has_account ? 'bg-gradient-to-r from-green-50 dark:from-gray-700 to-emerald-50 dark:to-gray-700 border-2 border-green-200 dark:border-green-700' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                <div className={`p-2 rounded-lg ${selectedItem.has_account ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                  {selectedItem.has_account ? <ShieldCheck size={18} /> : <UserPlus size={18} />}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Account Status</p>
                  <p className={`text-sm font-semibold ${selectedItem.has_account ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {selectedItem.has_account ? 'Active Account' : 'No Account'}
                  </p>
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
      <FormModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSubmit={handleAddSubmit} title="Add New Customer" submitText="Add Customer" size="lg" loading={saving}>
        {({ submitted }) => (
          <>
            <FormInput 
              label="Business Name" 
              name="name" 
              value={formData.name} 
              onChange={handleFormChange} 
              placeholder="Enter business name" 
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
            <AddressAutocomplete 
              label="Address" 
              name="address" 
              value={formData.address} 
              onChange={handleFormChange} 
              required 
              submitted={submitted} 
              error={errors.address?.[0]}
              landmark={formData.address_landmark}
              onLandmarkChange={handleFormChange}
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

      <FormModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSubmit={handleEditSubmit} title="Edit Customer" submitText="Save Changes" size="lg" loading={saving}>
        {({ submitted }) => (
          <>
            <FormInput 
              label="Business Name" 
              name="name" 
              value={formData.name} 
              onChange={handleFormChange} 
              placeholder="Enter business name" 
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
                disabled={selectedItem?.has_account}
                hint={selectedItem?.has_account ? 'Email cannot be changed for customers with an account' : ''}
              />
            </div>
            <AddressAutocomplete 
              label="Address" 
              name="address" 
              value={formData.address} 
              onChange={handleFormChange} 
              required 
              submitted={submitted} 
              error={errors.address?.[0]}
              landmark={formData.address_landmark}
              onLandmarkChange={handleFormChange}
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

      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title="Archive Customer" message={`Are you sure you want to archive "${selectedItem?.name}"? It will be moved to the archives and can be restored later.`} confirmText="Archive" variant="warning" icon={Archive} loading={saving} />

      {/* Orders Modal */}
      <Modal
        isOpen={isOrdersModalOpen}
        onClose={() => setIsOrdersModalOpen(false)}
        title={`Orders — ${selectedItem?.name || ''}`}
        size="full"
        footer={
          <div className="flex justify-between items-center">
            {!loadingOrders && customerOrders.length > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{customerOrders.length} order{customerOrders.length !== 1 ? 's' : ''} found</span>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setIsOrdersModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        {loadingOrders ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-button-500" />
            <span className="ml-3 text-gray-500 dark:text-gray-400">Loading orders...</span>
          </div>
        ) : customerOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <ShoppingBag size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">No orders found</p>
            <p className="text-sm">This customer hasn't placed any orders yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Order Summary Cards */}
            {(() => {
              const pendingOrders = customerOrders.filter(o => ['pending', 'processing', 'shipped'].includes(o.status));
              const completedOrders = customerOrders.filter(o => ['delivered', 'completed'].includes(o.status));
              const pendingTotal = pendingOrders.reduce((sum, o) => sum + o.total, 0);
              const completedTotal = completedOrders.reduce((sum, o) => sum + o.total, 0);
              const grandTotal = customerOrders.reduce((sum, o) => sum + o.total, 0);
              return (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 text-center">
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Pending</p>
                    <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">₱{pendingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-yellow-500">{pendingOrders.length} order{pendingOrders.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">Completed / Delivered</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-300">₱{completedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-green-500">{completedOrders.length} order{completedOrders.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="bg-button-50 dark:bg-button-900/20 border border-button-200 dark:border-button-700 rounded-lg p-3 text-center">
                    <p className="text-xs text-button-600 dark:text-button-400 font-medium">Grand Total</p>
                    <p className="text-lg font-bold text-button-700 dark:text-button-300">₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-button-500">{customerOrders.length} order{customerOrders.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              );
            })()}
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Transaction ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Items</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Payment</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {customerOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-button-600 dark:text-button-400">{order.transaction_id}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{order.date_formatted}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.variety_color }}></span>
                            <span className="text-gray-700 dark:text-gray-200">{item.product_name}</span>
                            <span className="text-gray-400">×{item.quantity}</span>
                            <span className="text-gray-500 dark:text-gray-400">₱{item.unit_price?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{order.total_formatted}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300 capitalize">{order.payment_method}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t flex justify-between items-center text-sm">
              <span className="text-gray-500 dark:text-gray-400">{customerOrders.length} order{customerOrders.length !== 1 ? 's' : ''}</span>
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                Grand Total: ₱{customerOrders.reduce((sum, o) => sum + o.total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* Terms and Conditions / Privacy Policy Modal */}
      <Modal
        isOpen={showTermsModal}
        onClose={handleDeclineTerms}
        title="Terms & Conditions and Privacy Policy"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-button-600 dark:text-button-400">
            <ScrollText size={20} />
            <p className="font-semibold">Please read and accept the Terms & Conditions and Privacy Policy before creating an account.</p>
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
            <button
              onClick={() => setLegalTab('terms')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${legalTab === 'terms' ? 'bg-button-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <FileText size={14} />
              Terms & Conditions
            </button>
            <button
              onClick={() => setLegalTab('privacy')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${legalTab === 'privacy' ? 'bg-button-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <ShieldCheck size={14} />
              Privacy Policy
            </button>
          </div>

          {loadingLegal ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-button-500" />
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-primary-200 dark:border-primary-700 text-sm text-gray-700 dark:text-gray-300 space-y-4">
              {legalTab === 'terms' && (
                <>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">KJP Ricemill — Terms and Conditions</h3>
                  {legalContent?.termsLastUpdated && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Last updated: {legalContent.termsLastUpdated}</p>
                  )}
                  {legalContent?.termsIntro && (
                    <p className="text-gray-600 dark:text-gray-400">{legalContent.termsIntro}</p>
                  )}
                  {(legalContent?.termsSections || []).map((section, index) => (
                    <div key={index}>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200">{index + 1}. {section.title}</h4>
                      <p>{section.content}</p>
                    </div>
                  ))}
                  {(!legalContent?.termsSections || legalContent.termsSections.length === 0) && (
                    <p className="text-center text-gray-400 dark:text-gray-500 py-4">No terms and conditions have been configured yet.</p>
                  )}
                </>
              )}
              {legalTab === 'privacy' && (
                <>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">KJP Ricemill — Privacy Policy</h3>
                  {legalContent?.privacyLastUpdated && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Last updated: {legalContent.privacyLastUpdated}</p>
                  )}
                  {legalContent?.privacyIntro && (
                    <p className="text-gray-600 dark:text-gray-400">{legalContent.privacyIntro}</p>
                  )}
                  {(legalContent?.privacySections || []).map((section, index) => (
                    <div key={index}>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200">{index + 1}. {section.title}</h4>
                      <p>{section.content}</p>
                    </div>
                  ))}
                  {(!legalContent?.privacySections || legalContent.privacySections.length === 0) && (
                    <p className="text-center text-gray-400 dark:text-gray-500 py-4">No privacy policy has been configured yet.</p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleDeclineTerms}
              className="flex-1 px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Decline
            </button>
            <button
              onClick={handleAcceptTerms}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-button-500 hover:bg-button-600 text-white rounded-lg transition-colors font-medium"
            >
              <FileText size={16} />
              I Accept
            </button>
          </div>
        </div>
      </Modal>

      {/* Account Creation Modal — multi-step like Staff */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => { setIsAccountModalOpen(false); setVerificationStep('initial'); setVerificationCode(''); setAccountFormData({ password: '', password_confirmation: '' }); setErrors({}); setShowPassword(false); setShowConfirmPassword(false); clearInterval(countdownRef.current); }}
        title={
          verificationStep === 'initial' ? 'Create Customer Account' :
          verificationStep === 'code-sent' ? 'Verify Customer Email' :
          'Set Account Password'
        }
        size="lg"
      >
        {selectedItem && (
          <>
            {/* Step 1: Send Verification Code */}
            {verificationStep === 'initial' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                    Verify Email Address
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Send a verification code to confirm <strong>{selectedItem.name}</strong>'s email
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/30">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                    <ShieldCheck size={18} />
                    Customer Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-400">Business:</span>
                      <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-400">Contact:</span>
                      <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.contact}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-400">Email:</span>
                      <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button variant="outline" onClick={() => { setIsAccountModalOpen(false); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendVerificationCode}
                    disabled={sendingCode}
                  >
                    {sendingCode ? (
                      <><Loader2 size={16} className="mr-2 animate-spin" /> Sending...</>
                    ) : (
                      <><Send size={16} className="mr-2" /> Send Verification Code</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Enter Verification Code */}
            {verificationStep === 'code-sent' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                    Verify Customer Email
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    A 6-digit verification code has been sent to <strong>{selectedItem.email}</strong>
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/30">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                    <ShieldCheck size={18} />
                    Customer Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-400">Business:</span>
                      <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-400">Contact:</span>
                      <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.contact}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-400">Email:</span>
                      <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.email}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Verification Code <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={verificationCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setVerificationCode(val);
                        setErrors(prev => ({ ...prev, code: undefined }));
                        if (val.length === 6) handleVerifyCode(val);
                      }}
                      placeholder="••••••"
                      maxLength={6}
                      disabled={verifying}
                      className={`w-full px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono border-2 rounded-xl transition-all focus:outline-none focus:ring-4 ${
                        errors.code
                          ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 focus:border-button-500 focus:ring-button-500/20'
                      }`}
                      autoFocus
                    />
                    {verifying && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Loader2 size={20} className="animate-spin text-button-500" />
                      </div>
                    )}
                  </div>
                  {errors.code && (
                    <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                      <AlertTriangle size={14} /> {Array.isArray(errors.code) ? errors.code[0] : errors.code}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Didn't receive the code?</span>
                  <button
                    type="button"
                    onClick={handleSendVerificationCode}
                    disabled={resendCountdown > 0 || sendingCode}
                    className="font-medium text-button-600 dark:text-button-400 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
                  >
                    {sendingCode ? (
                      <><Loader2 size={14} className="animate-spin" /> Sending...</>
                    ) : resendCountdown > 0 ? (
                      `Resend in ${resendCountdown}s`
                    ) : (
                      'Resend Code'
                    )}
                  </button>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-500/30">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={18} className="text-green-600 dark:text-green-400 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-green-800 dark:text-green-300 mb-1">Next Steps</h4>
                      <ol className="text-xs text-green-700 dark:text-green-400 space-y-1 list-decimal list-inside">
                        <li>Ask {selectedItem.name} to check their email</li>
                        <li>Enter the 6-digit code above to verify</li>
                        <li>Once verified, set the account password</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button variant="outline" onClick={() => { setIsAccountModalOpen(false); clearInterval(countdownRef.current); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleVerifyCode(verificationCode)}
                    disabled={verificationCode.length < 6 || verifying}
                  >
                    {verifying ? (
                      <><Loader2 size={16} className="mr-2 animate-spin" /> Verifying...</>
                    ) : (
                      <><CheckCircle size={16} className="mr-2" /> Verify Email</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Set Password */}
            {verificationStep === 'verified' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock size={32} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                    Set Account Password
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Create login credentials for <strong>{selectedItem.name}</strong>
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/30">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                    <ShieldCheck size={18} />
                    Customer Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-400">Business:</span>
                      <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-400">Contact:</span>
                      <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.contact}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-400">Email:</span>
                      <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-400">Email Status:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                        <ShieldCheck size={14} /> Verified
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={accountFormData.password}
                        onChange={(e) => setAccountFormData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Minimum 8 characters"
                        className="w-full pl-10 pr-12 py-3 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password[0]}</p>}
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={accountFormData.password_confirmation}
                        onChange={(e) => setAccountFormData(prev => ({ ...prev, password_confirmation: e.target.value }))}
                        placeholder="Re-enter password"
                        className="w-full pl-10 pr-12 py-3 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {accountFormData.password && accountFormData.password_confirmation && accountFormData.password !== accountFormData.password_confirmation && (
                      <p className="mt-1 text-sm text-red-500">Passwords do not match.</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    This password will be shared with the customer for their first login.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button variant="outline" onClick={() => { setIsAccountModalOpen(false); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateAccountSubmit}
                    disabled={creatingAccount || !accountFormData.password || accountFormData.password.length < 8 || !accountFormData.password_confirmation || accountFormData.password !== accountFormData.password_confirmation}
                  >
                    {creatingAccount ? (
                      <><Loader2 size={16} className="mr-2 animate-spin" /> Creating Account...</>
                    ) : (
                      <><CheckCircle size={16} className="mr-2" /> Create Account</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Manage Account Modal - Edit Email/Password with Verification */}
      <Modal
        isOpen={isManageAccountOpen}
        onClose={handleManageAccountClose}
        title={manageAccountStep === 'edit' ? 'Manage Account' : 'Verify Email'}
        size="lg"
      >
        {/* Step 1: Edit Account */}
        {manageAccountStep === 'edit' && selectedItem && (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/30">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                <Shield size={18} />
                Customer Info
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Name:</span>
                  <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Contact:</span>
                  <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.contact}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 dark:text-blue-400">Verification:</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedItem.email_verified_at
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  }`}>
                    {selectedItem.email_verified_at ? (
                      <><CheckCircle size={12} /> Verified</>
                    ) : (
                      <><AlertTriangle size={12} /> Not Verified</>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <FormInput 
              label="Email" 
              name="email" 
              type="email" 
              value={manageFormData.email} 
              disabled={true}
              placeholder="email@example.com" 
            />

            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <input
                  type={showManagePassword ? 'text' : 'password'}
                  name="password"
                  value={manageFormData.password}
                  onChange={handleManageAccountFormChange}
                  placeholder="Leave blank to keep current"
                  className="w-full pl-10 pr-12 py-3 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20"
                />
                <button 
                  type="button" 
                  onClick={() => setShowManagePassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
                >
                  {showManagePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Minimum 8 characters. Leave blank if not changing.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleManageAccountClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleManageAccountSubmit}
                disabled={manageSaving || !!manageEmailError || isCheckingManageEmail}
              >
                {manageSaving ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} className="mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Email Verification */}
        {manageAccountStep === 'verification' && manageCreatedAccount && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={32} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Verify Customer Email
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                A 6-digit verification code has been sent to <strong>{manageCreatedAccount.email}</strong>
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Verification Code <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={manageVerifyCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setManageVerifyCode(val);
                    setManageVerifyError('');
                    if (val.length === 6) handleManageVerifyCode(val);
                  }}
                  placeholder="••••••"
                  maxLength={6}
                  disabled={manageVerifying}
                  className={`w-full px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono border-2 rounded-xl transition-all focus:outline-none focus:ring-4 ${
                    manageVerifyError
                      ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 focus:border-button-500 focus:ring-button-500/20'
                  }`}
                  autoFocus
                />
                {manageVerifying && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 size={20} className="animate-spin text-button-500" />
                  </div>
                )}
              </div>
              {manageVerifyError && (
                <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                  <AlertTriangle size={14} /> {manageVerifyError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Didn't receive the code?</span>
              <button
                type="button"
                onClick={handleManageResendCode}
                disabled={manageResendCountdown > 0 || manageResendingCode}
                className="font-medium text-button-600 dark:text-button-400 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
              >
                {manageResendingCode ? (
                  <><Loader2 size={14} className="animate-spin" /> Sending...</>
                ) : manageResendCountdown > 0 ? (
                  `Resend in ${manageResendCountdown}s`
                ) : (
                  'Resend Code'
                )}
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleManageAccountClose}>
                Skip for Now
              </Button>
              <Button 
                onClick={() => handleManageVerifyCode(manageVerifyCode)}
                disabled={manageVerifyCode.length < 6 || manageVerifying}
              >
                {manageVerifying ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Verifying...</>
                ) : (
                  <><CheckCircle size={16} className="mr-2" /> Verify</>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Customer;
