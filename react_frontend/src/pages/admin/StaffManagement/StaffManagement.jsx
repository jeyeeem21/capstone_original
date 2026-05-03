import { useState, useEffect, useCallback, useRef } from 'react';
import { UserCog, Shield, Users, CheckCircle, XCircle, Briefcase, Archive, Truck, Mail, Loader2, AlertTriangle, Eye, EyeOff, ArrowRight, ArrowLeft, Lock, KeyRound, Edit } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatusBadge, ActionButtons, StatsCard, Modal, FormModal, ConfirmModal, FormInput, FormSelect, useToast, SkeletonStats, SkeletonTable, Button } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { usersApi, apiClient } from '../../../api';

const StaffManagement = () => {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '', position: '', truck_plate_number: '', email: '', phone: '', date_hired: '', status: 'active', password: '',
  });

  // Email validation state
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  const emailCheckTimeout = useRef(null);

  // Multi-step modal state
  const [modalStep, setModalStep] = useState('details'); // 'details' | 'create-account' | 'verification'
  const [createdAccount, setCreatedAccount] = useState(null);
  
  // Password state for Step 2
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Verification state for Step 4
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendingCode, setResendingCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef(null);

  // Account modal state
  const [accountStep, setAccountStep] = useState('edit'); // 'edit' | 'verification'
  const [accountFormData, setAccountFormData] = useState({ email: '', password: '' });
  const [accountEmailError, setAccountEmailError] = useState('');
  const [isCheckingAccountEmail, setIsCheckingAccountEmail] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const accountEmailCheckTimeout = useRef(null);

  const positionOptions = [
    { value: 'Secretary', label: 'Secretary' },
    { value: 'Driver', label: 'Driver' },
  ];

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (emailCheckTimeout.current) {
        clearTimeout(emailCheckTimeout.current);
      }
      if (accountEmailCheckTimeout.current) {
        clearTimeout(accountEmailCheckTimeout.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Fetch staff members
  const fetchStaff = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await usersApi.getAll({ role: 'staff' });
      const data = response?.data?.data || response?.data || [];
      const list = Array.isArray(data) ? data : [];
      // Only update state if data actually changed — avoids unnecessary re-renders
      // that reset DataTable pagination/search/sorting on every poll tick.
      setStaff(prev => {
        if (JSON.stringify(prev) === JSON.stringify(list)) return prev;
        return list;
      });
    } catch (error) {
      console.error('Failed to fetch staff:', error);
      if (!silent) toast.error('Error', 'Failed to load staff members.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Realtime polling — refresh every 5s when tab is visible and no modal open
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isAddModalOpen && !isEditModalOpen && !isDeleteModalOpen && !isAccountModalOpen) {
        fetchStaff(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStaff, isAddModalOpen, isEditModalOpen, isDeleteModalOpen, isAccountModalOpen]);

  const handleAdd = () => {
    setFormData({
      name: '', position: '', truck_plate_number: '', email: '', phone: '',
      date_hired: new Date().toISOString().split('T')[0],
      status: 'active', password: '',
    });
    setEmailError('');
    setModalStep('details');
    setCreatedAccount(null);
    setPassword('');
    setShowPassword(false);
    setIsAddModalOpen(true);
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      name: item.name || '',
      position: item.position || '',
      truck_plate_number: item.truck_plate_number || '',
      email: item.email || '',
      phone: item.phone || '',
      date_hired: item.date_hired ? item.date_hired.split('T')[0] : '',
      status: item.status || 'active',
      password: '',
    });
    setIsEditModalOpen(true);
  };

  const handleAccount = (item) => {
    setSelectedItem(item);
    setAccountFormData({ email: item.email || '', password: '' });
    setAccountEmailError('');
    setShowAccountPassword(false);
    setAccountStep('edit');
    setVerifyCode('');
    setVerifyError('');
    setCreatedAccount(null);
    setIsAccountModalOpen(true);
  };

  const handleAccountFormChange = (e) => {
    const { name, value } = e.target;
    setAccountFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'email') {
      setAccountEmailError('');
      if (accountEmailCheckTimeout.current) {
        clearTimeout(accountEmailCheckTimeout.current);
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value || !emailRegex.test(value)) {
        if (value) setAccountEmailError('Please enter a valid email address.');
        return;
      }

      // Don't check if email hasn't changed
      if (value.toLowerCase() === selectedItem?.email?.toLowerCase()) {
        setAccountEmailError('');
        return;
      }

      accountEmailCheckTimeout.current = setTimeout(async () => {
        try {
          setIsCheckingAccountEmail(true);
          const response = await usersApi.checkEmail(value);
          if (response.success && response.data && response.data.taken) {
            setAccountEmailError('This email is already registered.');
          } else {
            setAccountEmailError('');
          }
        } catch {
          setAccountEmailError('Error checking email availability.');
        } finally {
          setIsCheckingAccountEmail(false);
        }
      }, 500);
    }
  };

  const handleAccountSubmit = async () => {
    if (accountEmailError || isCheckingAccountEmail) {
      toast.error('Error', 'Please fix the email address before submitting.');
      return;
    }

    const emailChanged = accountFormData.email.toLowerCase() !== selectedItem.email.toLowerCase();
    const passwordChanged = !!accountFormData.password;

    if (!emailChanged && !passwordChanged) {
      toast.info('No Changes', 'No changes were made to the account.');
      return;
    }

    if (passwordChanged && accountFormData.password.length < 8) {
      toast.error('Error', 'Password must be at least 8 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {};
      if (emailChanged) payload.email = accountFormData.email;
      if (passwordChanged) payload.password = accountFormData.password;

      const response = await usersApi.update(selectedItem.id, payload);

      if (response._requires_reverification) {
        // Move to verification step
        setCreatedAccount({
          id: selectedItem.id,
          name: selectedItem.name,
          email: accountFormData.email || selectedItem.email,
          position: selectedItem.position,
        });
        setAccountStep('verification');
        setVerifyCode('');
        setVerifyError('');
        startResendCountdown(60);
        toast.success('Account Updated', 'A verification code has been sent to the email.');
        fetchStaff(true);
      } else {
        toast.success('Account Updated', 'Account has been updated successfully.');
        handleAccountModalClose();
        fetchStaff(true);
      }

      // Fire-and-forget email
      apiClient.post(`/users/${selectedItem.id}/update-email`, { changes: response._changes || [] }).catch(() => {});
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to update account.';
      toast.error('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccountModalClose = () => {
    setIsAccountModalOpen(false);
    setAccountStep('edit');
    setAccountFormData({ email: '', password: '' });
    setAccountEmailError('');
    setShowAccountPassword(false);
    setCreatedAccount(null);
    setVerifyCode('');
    setVerifyError('');
    setResendCountdown(0);
    clearInterval(countdownRef.current);
  };

  const handleDelete = (item) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Real-time email checking
    if (name === 'email') {
      setEmailError('');
      
      // Clear previous timeout
      if (emailCheckTimeout.current) {
        clearTimeout(emailCheckTimeout.current);
      }

      // Validate email format first
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value || !emailRegex.test(value)) {
        if (value) {
          setEmailError('Please enter a valid email address.');
        }
        return;
      }

      // Debounce: wait 500ms after user stops typing
      emailCheckTimeout.current = setTimeout(async () => {
        try {
          setIsCheckingEmail(true);
          const response = await usersApi.checkEmail(value);

          // Check response.data.taken (API uses successResponse wrapper)
          if (response.success && response.data && response.data.taken) {
            setEmailError('This email is already registered.');
          } else {
            setEmailError('');
          }
        } catch (error) {
          console.error('Error checking email:', error);
          setEmailError('Error checking email availability.');
        } finally {
          setIsCheckingEmail(false);
        }
      }, 500);
    }
  };

  const handleAddSubmit = async () => {
    // Prevent submission if email is invalid or being checked
    if (emailError || isCheckingEmail) {
      toast.error('Error', 'Please fix the email address before submitting.');
      return;
    }

    // Send verification code then move to verification step
    try {
      setSubmitting(true);
      await usersApi.sendVerification(formData.email);
      setModalStep('verification');
      setVerifyCode('');
      setVerifyError('');
      startResendCountdown(60);
      toast.success('Code Sent', `Verification code sent to ${formData.email}`);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to send verification code.';
      toast.error('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAccountSubmit = async () => {
    if (!password || password.length < 8) {
      toast.error('Error', 'Password must be at least 8 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await usersApi.create({
        name: formData.name,
        email: formData.email,
        password: password,
        role: 'staff',
        position: formData.position,
        truck_plate_number: formData.position === 'Driver' ? formData.truck_plate_number : null,
        phone: formData.phone,
        status: formData.status,
        date_hired: formData.date_hired || null,
      });

      // Fire-and-forget: send welcome email in background
      if (response?.data?.id) {
        apiClient.post(`/users/${response.data.id}/welcome-email`).catch(() => {});
      }

      toast.success('Staff Added', `${formData.name}'s account has been created with a verified email.`);
      handleModalClose();
      fetchStaff(true);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to add staff member.';
      toast.error('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const startResendCountdown = (seconds) => {
    setResendCountdown(seconds);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerifyCode = async (code) => {
    if (code.length < 6) return;
    
    setVerifying(true);
    setVerifyError('');
    
    try {
      // Account modal uses post-creation endpoint, Add modal uses pre-creation endpoint
      if (isAccountModalOpen && createdAccount) {
        const response = await apiClient.post(`/users/staff/${createdAccount.id}/verify-email`, {
          email: createdAccount.email,
          code: code,
        });
        if (response.success) {
          toast.success('Email Verified', 'Staff email has been verified successfully!');
          handleAccountModalClose();
          fetchStaff(true);
        } else {
          setVerifyError(response.message || 'Invalid verification code.');
        }
      } else {
        // Pre-creation verification for Add flow
        const response = await usersApi.verifyCode(formData.email, code);
        if (response.success) {
          toast.success('Email Verified', 'Email verified! Now set a password to create the account.');
          setModalStep('create-account');
        } else {
          setVerifyError(response.message || 'Invalid verification code.');
        }
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Verification failed. Please try again.';
      setVerifyError(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0) return;
    
    setResendingCode(true);
    setVerifyError('');
    
    try {
      let response;
      if (isAccountModalOpen && createdAccount) {
        // Post-creation resend for Account modal
        response = await apiClient.post(`/users/staff/${createdAccount.id}/resend-verification`);
      } else {
        // Pre-creation resend for Add modal
        response = await usersApi.sendVerification(formData.email);
      }
      
      if (response.success) {
        toast.success('Code Sent', 'A new verification code has been sent.');
        startResendCountdown(60);
      } else {
        setVerifyError(response.message || 'Failed to resend code.');
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to resend code.';
      setVerifyError(msg);
    } finally {
      setResendingCode(false);
    }
  };

  const handleModalClose = () => {
    setIsAddModalOpen(false);
    setModalStep('details');
    setCreatedAccount(null);
    setEmailError('');
    setPassword('');
    setShowPassword(false);
    setVerifyCode('');
    setVerifyError('');
    setResendCountdown(0);
    clearInterval(countdownRef.current);
  };

  const handleEditSubmit = async () => {
    if (!selectedItem) return;
    try {
      setSubmitting(true);
      const payload = {
        name: formData.name,
        position: formData.position,
        truck_plate_number: formData.position === 'Driver' ? formData.truck_plate_number : null,
        phone: formData.phone,
        status: formData.status,
        date_hired: formData.date_hired || null,
      };
      const response = await usersApi.update(selectedItem.id, payload);
      toast.success('Staff Updated', `${formData.name}'s details have been updated.`);
      // Fire-and-forget email
      apiClient.post(`/users/${selectedItem.id}/update-email`, { changes: response._changes || [] }).catch(() => {});
      setIsEditModalOpen(false);
      fetchStaff(true);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to update staff member.';
      toast.error('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedItem) return;
    try {
      setSubmitting(true);
      await usersApi.delete(selectedItem.id);
      const removedId = selectedItem.id;
      // Immediately remove from local data for instant UI
      setStaff(prev => prev.filter(s => s.id !== removedId));
      toast.success('Staff Removed', `${selectedItem.name} has been removed.`);
      setIsDeleteModalOpen(false);
      // Refetch in background to confirm
      fetchStaff(true);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to remove staff member.';
      toast.error('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Stats
  const totalStaff = staff.length;
  const activeStaff = staff.filter(s => s.status === 'active').length;
  const inactiveStaff = staff.filter(s => s.status === 'inactive').length;
  const totalPositions = [...new Set(staff.map(s => s.position).filter(Boolean))].length;

  const getPositionBadge = (position) => {
    const colors = {
      'Secretary': 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      'Driver': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    };
    return colors[position] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
  };

  const columns = [
    { header: 'Name', accessor: 'name' },
    { header: 'Position', accessor: 'position', cell: (row) => (
      row.position ? (
        <div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${getPositionBadge(row.position)}`}>
            <Shield size={12} />
            {row.position}
          </span>
          {row.position === 'Driver' && row.truck_plate_number && (
            <span className="ml-1.5 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              <Truck size={10} />
              {row.truck_plate_number}
            </span>
          )}
        </div>
      ) : <span className="text-gray-400 text-xs">—</span>
    )},
    { header: 'Email', accessor: 'email', cell: (row) => (
      <div className="flex items-center gap-1.5 text-sm">
        <Mail size={14} className={`shrink-0 ${row.email_verified_at ? '!text-green-500 dark:!text-green-400' : '!text-amber-500 dark:!text-amber-400'}`} title={row.email_verified_at ? 'Email Verified' : 'Email Not Verified'} />
        <span>{row.email}</span>
      </div>
    )},
    { header: 'Phone', accessor: 'phone' },
    { header: 'Date Hired', accessor: 'date_hired', cell: (row) => (
      row.date_hired ? new Date(row.date_hired).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : <span className="text-gray-400 text-xs">—</span>
    )},
    { header: 'Status', accessor: 'status', cell: (row) => <StatusBadge status={row.status === 'active' ? 'Active' : 'Inactive'} /> },
    { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
          className="p-1.5 rounded-md hover:bg-button-50 dark:hover:bg-button-900/30 text-button-500 hover:text-button-700 dark:text-button-300 transition-colors"
          title="Edit Details"
        >
          <Edit size={15} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleAccount(row); }}
          className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 hover:text-blue-700 dark:text-blue-300 transition-colors"
          title="Manage Account"
        >
          <KeyRound size={15} />
        </button>
        {isSuperAdmin() && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
            className="p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-500 hover:text-amber-700 dark:text-amber-300 transition-colors"
            title="Archive"
          >
            <Archive size={15} />
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Staff Management" description="Manage your team members and their access levels" icon={UserCog} />

      {loading ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Staff" value={totalStaff} unit="employees" icon={Users} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <StatsCard label="Active" value={activeStaff} unit="employees" icon={CheckCircle} iconBgColor="bg-gradient-to-br from-button-500 to-button-700" />
          <StatsCard label="Inactive" value={inactiveStaff} unit="employees" icon={XCircle} iconBgColor="bg-gradient-to-br from-red-400 to-red-600" />
          <StatsCard label="Positions" value={totalPositions} unit="types" icon={Briefcase} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={8} columns={7} />
      ) : (
        <DataTable title="Staff Records" subtitle="Manage all staff members" columns={columns} data={staff} searchPlaceholder="Search staff..." filterField="position" filterPlaceholder="All Positions" dateFilterField="date_hired" onAdd={handleAdd} addLabel="Add Staff" />
      )}

      {/* Add Modal - Multi-step */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={handleModalClose}
        title={
          modalStep === 'details' ? 'Add New Staff Member' :
          modalStep === 'verification' ? 'Verify Staff Email' :
          'Create Account'
        }
        size="lg"
      >
        {/* Step 1: Staff Details */}
        {modalStep === 'details' && (
          <form onSubmit={(e) => { e.preventDefault(); handleAddSubmit(); }} className="space-y-4">
            <FormInput 
              label="Full Name" 
              name="name" 
              value={formData.name} 
              onChange={handleFormChange} 
              required 
              placeholder="Enter full name" 
            />
            
            <FormSelect 
              label="Position" 
              name="position" 
              value={formData.position} 
              onChange={handleFormChange} 
              options={positionOptions} 
              required 
            />
            
            {formData.position === 'Driver' && (
              <FormInput 
                label="Truck Plate Number" 
                name="truck_plate_number" 
                value={formData.truck_plate_number} 
                onChange={handleFormChange} 
                placeholder="e.g. ABC 1234" 
              />
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <FormInput 
                label="Email" 
                name="email" 
                type="email" 
                value={formData.email} 
                onChange={handleFormChange} 
                required 
                placeholder="email@kjp.com" 
                error={emailError}
                loading={isCheckingEmail}
              />
              <FormInput 
                label="Phone" 
                name="phone" 
                value={formData.phone} 
                onChange={handleFormChange} 
                placeholder="+63 XXX XXX XXXX" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormInput 
                label="Date Hired" 
                name="date_hired" 
                type="date" 
                value={formData.date_hired} 
                onChange={handleFormChange} 
              />
              <FormSelect 
                label="Status" 
                name="status" 
                value={formData.status} 
                onChange={handleFormChange} 
                options={statusOptions} 
                required 
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleModalClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={submitting || !!emailError || isCheckingEmail}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ArrowRight size={16} className="mr-2" />
                    Next: Verify Email
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Email Verification */}
        {modalStep === 'verification' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={32} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Verify Staff Email
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                A 6-digit verification code has been sent to <strong>{formData.email}</strong>
              </p>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/30">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                <Shield size={18} />
                Staff Details
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Name:</span>
                  <span className="font-semibold text-blue-800 dark:text-blue-200">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Position:</span>
                  <span className="font-semibold text-blue-800 dark:text-blue-200">{formData.position}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Email:</span>
                  <span className="font-semibold text-blue-800 dark:text-blue-200">{formData.email}</span>
                </div>
                {formData.position === 'Driver' && formData.truck_plate_number && (
                  <div className="flex justify-between">
                    <span className="text-blue-700 dark:text-blue-400">Truck:</span>
                    <span className="font-semibold text-blue-800 dark:text-blue-200">{formData.truck_plate_number}</span>
                  </div>
                )}
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
                  value={verifyCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerifyCode(val);
                    setVerifyError('');
                    if (val.length === 6) handleVerifyCode(val);
                  }}
                  placeholder="••••••"
                  maxLength={6}
                  disabled={verifying}
                  className={`w-full px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono border-2 rounded-xl transition-all focus:outline-none focus:ring-4 ${
                    verifyError
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
              {verifyError && (
                <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                  <AlertTriangle size={14} /> {verifyError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Didn't receive the code?</span>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCountdown > 0 || resendingCode}
                className="font-medium text-button-600 dark:text-button-400 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
              >
                {resendingCode ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Sending...
                  </>
                ) : resendCountdown > 0 ? (
                  `Resend in ${resendCountdown}s`
                ) : (
                  'Resend Code'
                )}
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={() => setModalStep('details')}>
                <ArrowLeft size={16} className="mr-2" />
                Back
              </Button>
              <Button 
                onClick={() => handleVerifyCode(verifyCode)}
                disabled={verifyCode.length < 6 || verifying}
              >
                {verifying ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} className="mr-2" />
                    Verify & Continue
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Create Account */}
        {modalStep === 'create-account' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock size={32} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Create Account
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Set up login credentials for <strong>{formData.name}</strong>
              </p>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/30">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                <Shield size={18} />
                Staff Details
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Name:</span>
                  <span className="font-semibold text-blue-800 dark:text-blue-200">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Position:</span>
                  <span className="font-semibold text-blue-800 dark:text-blue-200">{formData.position}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Email:</span>
                  <span className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-1.5">
                    {formData.email}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      <CheckCircle size={12} /> Verified
                    </span>
                  </span>
                </div>
                {formData.position === 'Driver' && formData.truck_plate_number && (
                  <div className="flex justify-between">
                    <span className="text-blue-700 dark:text-blue-400">Truck:</span>
                    <span className="font-semibold text-blue-800 dark:text-blue-200">{formData.truck_plate_number}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-10 pr-12 py-3 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20"
                  autoFocus
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                This password will be shared with the staff member for their first login.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleModalClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateAccountSubmit}
                disabled={submitting || !password || password.length < 8}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} className="mr-2" />
                    Create Account
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal - Staff Details Only */}
      <FormModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSubmit={handleEditSubmit} title="Edit Staff Details" submitText={submitting ? 'Saving...' : 'Save Changes'} size="lg" disabled={submitting}>
        {({ submitted }) => (
          <>
            <FormInput label="Full Name" name="name" value={formData.name} onChange={handleFormChange} required placeholder="Enter full name" submitted={submitted} />
            <FormSelect label="Position" name="position" value={formData.position} onChange={handleFormChange} options={positionOptions} required submitted={submitted} />
            {formData.position === 'Driver' && (
              <FormInput label="Truck Plate Number" name="truck_plate_number" value={formData.truck_plate_number} onChange={handleFormChange} placeholder="e.g. ABC 1234" submitted={submitted} />
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Phone" name="phone" value={formData.phone} onChange={handleFormChange} placeholder="+63 XXX XXX XXXX" submitted={submitted} />
              <FormSelect label="Status" name="status" value={formData.status} onChange={handleFormChange} options={statusOptions} required submitted={submitted} />
            </div>
            <FormInput label="Date Hired" name="date_hired" type="date" value={formData.date_hired} onChange={handleFormChange} submitted={submitted} />
          </>
        )}
      </FormModal>

      {/* Account Modal - Edit Email/Password with Verification */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={handleAccountModalClose}
        title={accountStep === 'edit' ? 'Manage Account' : 'Verify Email'}
        size="lg"
      >
        {/* Step 1: Edit Account */}
        {accountStep === 'edit' && selectedItem && (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/30">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                <Shield size={18} />
                Staff Info
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Name:</span>
                  <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Position:</span>
                  <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.position}</span>
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

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-500/30">
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                Changing email or password will require email re-verification. The staff member won't be able to log in until verified.
              </p>
            </div>

            <FormInput 
              label="Email" 
              name="email" 
              type="email" 
              value={accountFormData.email} 
              onChange={handleAccountFormChange} 
              placeholder="email@kjp.com" 
              error={accountEmailError}
              loading={isCheckingAccountEmail}
            />

            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <input
                  type={showAccountPassword ? 'text' : 'password'}
                  name="password"
                  value={accountFormData.password}
                  onChange={handleAccountFormChange}
                  placeholder="Leave blank to keep current"
                  className="w-full pl-10 pr-12 py-3 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20"
                />
                <button 
                  type="button" 
                  onClick={() => setShowAccountPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
                >
                  {showAccountPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Minimum 8 characters. Leave blank if not changing.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleAccountModalClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleAccountSubmit}
                disabled={submitting || !!accountEmailError || isCheckingAccountEmail}
              >
                {submitting ? (
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
        {accountStep === 'verification' && createdAccount && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={32} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Verify Staff Email
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                A 6-digit verification code has been sent to <strong>{createdAccount.email}</strong>
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
                  value={verifyCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerifyCode(val);
                    setVerifyError('');
                    if (val.length === 6) handleVerifyCode(val);
                  }}
                  placeholder="••••••"
                  maxLength={6}
                  disabled={verifying}
                  className={`w-full px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono border-2 rounded-xl transition-all focus:outline-none focus:ring-4 ${
                    verifyError
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
              {verifyError && (
                <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                  <AlertTriangle size={14} /> {verifyError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Didn't receive the code?</span>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCountdown > 0 || resendingCode}
                className="font-medium text-button-600 dark:text-button-400 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
              >
                {resendingCode ? (
                  <><Loader2 size={14} className="animate-spin" /> Sending...</>
                ) : resendCountdown > 0 ? (
                  `Resend in ${resendCountdown}s`
                ) : (
                  'Resend Code'
                )}
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleAccountModalClose}>
                Skip for Now
              </Button>
              <Button 
                onClick={() => handleVerifyCode(verifyCode)}
                disabled={verifyCode.length < 6 || verifying}
              >
                {verifying ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Verifying...</>
                ) : (
                  <><CheckCircle size={16} className="mr-2" /> Verify</>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title="Archive Staff Member" message={`Are you sure you want to archive "${selectedItem?.name}"? You can restore this record from the Archives.`} confirmText={submitting ? 'Archiving...' : 'Archive'} variant="warning" icon={Archive} />
    </div>
  );
};

export default StaffManagement;
