import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Shield, Users, CheckCircle, XCircle, UserPlus, Trash2, Edit3, Save, Loader2, ShieldCheck, Truck, ClipboardList, Ban, UserCheck, Mail, AlertTriangle, Eye, EyeOff, Lock, KeyRound } from 'lucide-react';
import { DataTable, StatusBadge, ActionButtons, StatsCard, FormModal, ConfirmModal, FormInput, FormSelect, Modal, Button, useToast, SkeletonStats, SkeletonTable } from '../../../components/ui';
import { usersApi, apiClient } from '../../../api';

const ROLE_COLORS = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Secretary: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Driver: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  customer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const ROLE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'admin', label: 'Admin' },
  { id: 'Secretary', label: 'Secretary' },
  { id: 'Driver', label: 'Driver' },
  { id: 'customer', label: 'Customer' },
];

const getRoleDisplay = (user) => {
  if (user.role === 'staff') return user.position || 'Staff';
  if (user.role === 'super_admin') return 'Super Admin';
  if (user.role === 'admin') return 'Admin';
  if (user.role === 'customer') return 'Customer';
  return user.role;
};

const AdminAccounts = () => {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isResendVerificationModalOpen, setIsResendVerificationModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', status: 'active',
  });

  // Verification modal state
  const [verificationStep, setVerificationStep] = useState('options'); // 'options' | 'change-email' | 'verify'
  const [newEmail, setNewEmail] = useState('');
  const [newEmailError, setNewEmailError] = useState('');
  const [isCheckingNewEmail, setIsCheckingNewEmail] = useState(false);
  const newEmailCheckTimeout = useRef(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef(null);

  // Email validation state for Add/Edit forms
  const [emailError, setEmailError] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const emailCheckTimeout = useRef(null);

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (newEmailCheckTimeout.current) clearTimeout(newEmailCheckTimeout.current);
      if (emailCheckTimeout.current) clearTimeout(emailCheckTimeout.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const fetchAccounts = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await usersApi.getAll({});
      const data = response?.data?.data || response?.data || [];
      const list = Array.isArray(data) ? data : [];
      setAccounts(prev => {
        if (JSON.stringify(prev) === JSON.stringify(list)) return prev;
        return list;
      });
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      if (!silent) toast.error('Error', 'Failed to load accounts.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Realtime polling — refresh every 5s when tab is visible and no modal open
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isAddModalOpen && !isEditModalOpen && !isDeleteModalOpen && !isBlockModalOpen) {
        fetchAccounts(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchAccounts, isAddModalOpen, isEditModalOpen, isDeleteModalOpen, isBlockModalOpen]);

  const filteredAccounts = useMemo(() => {
    if (activeTab === 'all') return accounts;
    if (activeTab === 'Secretary' || activeTab === 'Driver') {
      return accounts.filter(a => a.role === 'staff' && a.position === activeTab);
    }
    return accounts.filter(a => a.role === activeTab);
  }, [accounts, activeTab]);

  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter(a => a.status === 'active').length;
  const blockedAccounts = accounts.filter(a => a.status === 'inactive').length;
  const unverifiedAccounts = accounts.filter(a => !a.email_verified_at).length;
  const roleCounts = useMemo(() => ({
    admin: accounts.filter(a => a.role === 'admin').length,
    Secretary: accounts.filter(a => a.role === 'staff' && a.position === 'Secretary').length,
    Driver: accounts.filter(a => a.role === 'staff' && a.position === 'Driver').length,
    customer: accounts.filter(a => a.role === 'customer').length,
  }), [accounts]);

  const handleAdd = () => {
    setFormData({ name: '', email: '', phone: '', password: '', status: 'active' });
    setEmailError('');
    setIsAddModalOpen(true);
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      name: item.name || '',
      email: item.email || '',
      phone: item.phone || '',
      password: '',
      status: item.status || 'active',
    });
    setEmailError('');
    setIsEditModalOpen(true);
  };

  const handleDelete = (item) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleBlockToggle = (item) => {
    setSelectedItem(item);
    setIsBlockModalOpen(true);
  };

  const handleResendVerification = (item) => {
    setSelectedItem(item);
    setVerificationStep('options');
    setNewEmail(item.email || '');
    setNewEmailError('');
    setVerifyCode('');
    setVerifyError('');
    setResendCountdown(0);
    setIsResendVerificationModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'email') {
      setEmailError('');
      if (emailCheckTimeout.current) clearTimeout(emailCheckTimeout.current);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value || !emailRegex.test(value)) {
        if (value) setEmailError('Please enter a valid email address.');
        return;
      }

      // Don't check if email hasn't changed (edit mode)
      if (selectedItem && value.toLowerCase() === selectedItem.email?.toLowerCase()) {
        setEmailError('');
        return;
      }

      emailCheckTimeout.current = setTimeout(async () => {
        try {
          setIsCheckingEmail(true);
          const response = await usersApi.checkEmail(value);
          if (response.success && response.data && response.data.taken) {
            setEmailError('This email is already registered.');
          } else {
            setEmailError('');
          }
        } catch {
          setEmailError('Error checking email availability.');
        } finally {
          setIsCheckingEmail(false);
        }
      }, 500);
    }
  };

  const handleAddSubmit = async () => {
    if (emailError || isCheckingEmail) {
      toast.error('Error', 'Please fix the email address before submitting.');
      return;
    }
    try {
      setSubmitting(true);
      const response = await usersApi.create({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'admin',
        phone: formData.phone,
        status: formData.status,
      });
      toast.success('Admin Added', `${formData.name} has been added as an admin.`);
      // Fire-and-forget email
      if (response?.data?.id) apiClient.post(`/users/${response.data.id}/welcome-email`).catch(() => {});
      setIsAddModalOpen(false);
      fetchAccounts(true);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to add admin account.';
      toast.error('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedItem) return;
    if (emailError || isCheckingEmail) {
      toast.error(emailError || 'Please wait for email verification to complete');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        status: formData.status,
      };
      if (formData.password) {
        payload.password = formData.password;
      }
      const response = await usersApi.update(selectedItem.id, payload);

      if (response._requires_reverification) {
        toast.success('Account Updated', 'Email verification has been reset. A new verification code has been sent.');
      } else {
        toast.success('Account Updated', `${formData.name}'s information has been updated.`);
      }

      // Fire-and-forget email
      apiClient.post(`/users/${selectedItem.id}/update-email`, { changes: response._changes || [] }).catch(() => {});
      setIsEditModalOpen(false);
      fetchAccounts(true);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to update account.';
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
      // Optimistic: remove immediately from local state
      setAccounts(prev => prev.filter(a => a.id !== selectedItem.id));
      toast.success('Account Archived', `${selectedItem.name} has been archived.`);
      setIsDeleteModalOpen(false);
      fetchAccounts(true);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to archive account.';
      toast.error('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlockConfirm = async () => {
    if (!selectedItem) return;
    const newStatus = selectedItem.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'inactive' ? 'blocked' : 'unblocked';
    try {
      setSubmitting(true);
      await usersApi.update(selectedItem.id, { status: newStatus });
      // Optimistic: update status immediately in local state
      setAccounts(prev => prev.map(a => a.id === selectedItem.id ? { ...a, status: newStatus } : a));
      toast.success('Status Updated', `${selectedItem.name} has been ${action}.`);
      // Fire-and-forget email
      apiClient.post(`/users/${selectedItem.id}/update-email`, { changes: [`Status changed to ${newStatus}`] }).catch(() => {});
      setIsBlockModalOpen(false);
      fetchAccounts(true);
    } catch (error) {
      const msg = error?.response?.data?.message || `Failed to ${action.replace('ed', '')} account.`;
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

  const handleResendVerificationConfirm = async () => {
    if (!selectedItem) return;
    try {
      setSubmitting(true);
      const response = await apiClient.post(`/users/staff/${selectedItem.id}/resend-verification`);
      if (response.success) {
        toast.success('Verification Sent', `Verification email has been sent to ${selectedItem.email}`);
        setVerificationStep('verify');
        setVerifyCode('');
        setVerifyError('');
        startResendCountdown(60);
      } else {
        toast.error('Error', response.message || 'Failed to send verification email.');
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to send verification email.';
      toast.error('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewEmailChange = (e) => {
    const value = e.target.value;
    setNewEmail(value);
    setNewEmailError('');

    if (newEmailCheckTimeout.current) clearTimeout(newEmailCheckTimeout.current);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value || !emailRegex.test(value)) {
      if (value) setNewEmailError('Please enter a valid email address.');
      return;
    }

    if (value.toLowerCase() === selectedItem?.email?.toLowerCase()) {
      setNewEmailError('');
      return;
    }

    newEmailCheckTimeout.current = setTimeout(async () => {
      try {
        setIsCheckingNewEmail(true);
        const response = await usersApi.checkEmail(value);
        if (response.success && response.data && response.data.taken) {
          setNewEmailError('This email is already registered.');
        } else {
          setNewEmailError('');
        }
      } catch {
        setNewEmailError('Error checking email availability.');
      } finally {
        setIsCheckingNewEmail(false);
      }
    }, 500);
  };

  const handleChangeEmailAndResend = async () => {
    if (!selectedItem || newEmailError || isCheckingNewEmail) return;

    const emailChanged = newEmail.toLowerCase() !== selectedItem.email.toLowerCase();

    try {
      setSubmitting(true);

      if (emailChanged) {
        await usersApi.update(selectedItem.id, { email: newEmail });
        setSelectedItem(prev => ({ ...prev, email: newEmail }));
      }

      const response = await apiClient.post(`/users/staff/${selectedItem.id}/resend-verification`);
      if (response.success) {
        toast.success('Verification Sent', `Verification email has been sent to ${newEmail}`);
        setVerificationStep('verify');
        setVerifyCode('');
        setVerifyError('');
        startResendCountdown(60);
        fetchAccounts(true);
      } else {
        toast.error('Error', response.message || 'Failed to send verification email.');
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to update email.';
      toast.error('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAccountCode = async (code) => {
    if (!selectedItem || code.length < 6) return;

    setVerifying(true);
    setVerifyError('');

    try {
      const response = await apiClient.post(`/users/staff/${selectedItem.id}/verify-email`, {
        email: selectedItem.email,
        code: code,
      });

      if (response.success) {
        toast.success('Email Verified', 'Account email has been verified successfully!');
        handleVerificationModalClose();
        fetchAccounts(true);
      } else {
        setVerifyError(response.message || 'Invalid verification code.');
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Verification failed. Please try again.';
      setVerifyError(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCodeInVerify = async () => {
    if (!selectedItem || resendCountdown > 0) return;

    setResendingCode(true);
    setVerifyError('');

    try {
      const response = await apiClient.post(`/users/staff/${selectedItem.id}/resend-verification`);
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

  const handleVerificationModalClose = () => {
    setIsResendVerificationModalOpen(false);
    setVerificationStep('options');
    setNewEmail('');
    setNewEmailError('');
    setVerifyCode('');
    setVerifyError('');
    setResendCountdown(0);
    clearInterval(countdownRef.current);
  };

  const columns = [
    { header: 'Name', accessor: 'name' },
    { header: 'Email', accessor: 'email', cell: (row) => (
      <div className="flex items-center gap-1.5 text-sm">
        <Mail size={14} className={`shrink-0 ${row.email_verified_at ? '!text-green-500 dark:!text-green-400' : '!text-amber-500 dark:!text-amber-400'}`} title={row.email_verified_at ? 'Email Verified' : 'Email Not Verified'} />
        <span>{row.email}</span>
      </div>
    )},
    { header: 'Role', accessor: 'role', cell: (row) => {
      const display = getRoleDisplay(row);
      const colorKey = row.role === 'staff' ? (row.position || 'Secretary') : row.role;
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[colorKey] || 'bg-gray-100 text-gray-600'}`}>
          {display}
        </span>
      );
    }},
    { header: 'Phone', accessor: 'phone', cell: (row) => row.phone || <span className="text-gray-400 text-xs">—</span> },
    { header: 'Created', accessor: 'created_at', cell: (row) => (
      row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
    )},
    { header: 'Status', accessor: 'status', cell: (row) => (
      <StatusBadge status={row.status === 'active' ? 'Active' : 'Blocked'} />
    )},
    { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
      <div className="flex items-center gap-1">
        {!row.email_verified_at && (
          <button 
            onClick={() => handleResendVerification(row)} 
            className="p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500" 
            title="Verify / Change Email"
          >
            <Mail size={15} />
          </button>
        )}
        {row.role !== 'customer' && (
          <button onClick={() => handleEdit(row)} className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500" title="Edit Account">
            <Edit3 size={15} />
          </button>
        )}
        <button
          onClick={() => handleBlockToggle(row)}
          className={`p-1.5 rounded-md transition-colors ${
            row.status === 'active'
              ? 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 hover:text-red-700'
              : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-500 hover:text-green-700'
          }`}
          title={row.status === 'active' ? 'Block' : 'Unblock'}
        >
          {row.status === 'active' ? <Ban size={15} /> : <CheckCircle size={15} />}
        </button>
        <button onClick={() => handleDelete(row)} className="p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500" title="Archive">
          <Trash2 size={15} />
        </button>
      </div>
    )},
  ];

  return (
    <div>
      {/* Stats */}
      {loading ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Accounts" value={totalAccounts} unit="accounts" icon={Users} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <StatsCard label="Active" value={activeAccounts} unit="accounts" icon={CheckCircle} iconBgColor="bg-gradient-to-br from-green-400 to-green-600" />
          <StatsCard label="Unverified" value={unverifiedAccounts} unit="accounts" icon={Mail} iconBgColor="bg-gradient-to-br from-amber-400 to-amber-600" />
          <StatsCard label="Blocked" value={blockedAccounts} unit="accounts" icon={Ban} iconBgColor="bg-gradient-to-br from-red-400 to-red-600" />
        </div>
      )}

      {/* Role Tabs */}
      <div className="flex gap-2 mb-4">
        {ROLE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === tab.id ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'
            }`}>
              {tab.id === 'all' ? accounts.length : (tab.id === 'Secretary' || tab.id === 'Driver') ? accounts.filter(a => a.role === 'staff' && a.position === tab.id).length : accounts.filter(a => a.role === tab.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={5} columns={7} />
      ) : (
        <DataTable
          title="All Accounts"
          subtitle="Manage all system accounts"
          columns={columns}
          data={filteredAccounts}
          searchPlaceholder="Search accounts..."
          onAdd={handleAdd}
          addLabel="Add Admin"
        />
      )}

      {/* Add Admin Modal */}
      <FormModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSubmit={handleAddSubmit} title="Add New Admin" submitText={submitting ? 'Adding...' : 'Add Admin'} size="lg" disabled={submitting}>
        {({ submitted }) => (
          <>
            <FormInput label="Full Name" name="name" value={formData.name} onChange={handleFormChange} required placeholder="Enter full name" submitted={submitted} />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Email" name="email" type="email" value={formData.email} onChange={handleFormChange} required placeholder="admin@kjp.com" submitted={submitted} error={emailError} loading={isCheckingEmail} />
              <FormInput label="Phone" name="phone" value={formData.phone} onChange={handleFormChange} placeholder="+63 XXX XXX XXXX" submitted={submitted} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Password" name="password" type="password" value={formData.password} onChange={handleFormChange} required placeholder="Min. 8 characters" submitted={submitted} />
              <FormSelect label="Status" name="status" value={formData.status} onChange={handleFormChange} options={statusOptions} required submitted={submitted} />
            </div>
          </>
        )}
      </FormModal>

      {/* Edit Modal */}
      <FormModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSubmit={handleEditSubmit} title={`Edit ${selectedItem ? getRoleDisplay(selectedItem) : ''} Account`} submitText={submitting ? 'Saving...' : 'Save Changes'} size="lg" disabled={submitting}>
        {({ submitted }) => (
          <>
            {(formData.email !== selectedItem?.email || formData.password) && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-500/30 mb-2">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  Changing email or password will reset email verification. The account will need to be re-verified.
                </p>
              </div>
            )}
            <FormInput label="Full Name" name="name" value={formData.name} onChange={handleFormChange} required placeholder="Enter full name" submitted={submitted} />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Email" name="email" type="email" value={formData.email} onChange={handleFormChange} required placeholder="admin@kjp.com" submitted={submitted} error={emailError} loading={isCheckingEmail} />
              <FormInput label="Phone" name="phone" value={formData.phone} onChange={handleFormChange} placeholder="+63 XXX XXX XXXX" submitted={submitted} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="New Password" name="password" type="password" value={formData.password} onChange={handleFormChange} placeholder="Leave blank to keep current" submitted={submitted} />
              <FormSelect label="Status" name="status" value={formData.status} onChange={handleFormChange} options={statusOptions} required submitted={submitted} />
            </div>
          </>
        )}
      </FormModal>

      {/* Archive Confirm */}
      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title="Archive Account" message={`Are you sure you want to archive "${selectedItem?.name}"? Their access will be revoked. You can restore this record from the Archives.`} confirmText={submitting ? 'Archiving...' : 'Archive'} variant="warning" icon={Trash2} />

      {/* Block/Unblock Confirm */}
      <ConfirmModal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        onConfirm={handleBlockConfirm}
        title={selectedItem?.status === 'active' ? 'Block Account' : 'Unblock Account'}
        message={selectedItem?.status === 'active'
          ? `Are you sure you want to block "${selectedItem?.name}"? They will not be able to log in until unblocked.`
          : `Are you sure you want to unblock "${selectedItem?.name}"? They will be able to log in again.`
        }
        confirmText={submitting ? (selectedItem?.status === 'active' ? 'Blocking...' : 'Unblocking...') : (selectedItem?.status === 'active' ? 'Block' : 'Unblock')}
        variant={selectedItem?.status === 'active' ? 'danger' : 'primary'}
        icon={selectedItem?.status === 'active' ? Ban : CheckCircle}
      />

      {/* Verification Modal - Enhanced with Change Email + Verify Code */}
      <Modal
        isOpen={isResendVerificationModalOpen}
        onClose={handleVerificationModalClose}
        title={
          verificationStep === 'options' ? 'Email Verification' :
          verificationStep === 'change-email' ? 'Change Email & Verify' :
          'Enter Verification Code'
        }
        size="lg"
      >
        {/* Step 1: Options */}
        {verificationStep === 'options' && selectedItem && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={32} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                {selectedItem.name}'s email is not verified
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Current email: <strong>{selectedItem.email}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleResendVerificationConfirm}
                disabled={submitting}
                className="w-full p-4 border-2 border-blue-200 dark:border-blue-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <Mail size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100">Resend Verification Code</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Send a new code to {selectedItem.email}</p>
                </div>
                {submitting && <Loader2 size={16} className="animate-spin text-blue-500 ml-auto" />}
              </button>

              <button
                onClick={() => setVerificationStep('change-email')}
                className="w-full p-4 border-2 border-amber-200 dark:border-amber-700 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <Edit3 size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100">Change Email & Verify</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Update the email address and send verification</p>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleVerificationModalClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Change Email */}
        {verificationStep === 'change-email' && selectedItem && (
          <div className="space-y-6">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-500/30">
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                Changing the email will update the account everywhere. A verification code will be sent to the new email.
              </p>
            </div>

            <FormInput 
              label="Email Address" 
              name="newEmail" 
              type="email" 
              value={newEmail} 
              onChange={handleNewEmailChange} 
              required 
              placeholder="newemail@kjp.com" 
              error={newEmailError}
              loading={isCheckingNewEmail}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={() => setVerificationStep('options')}>
                Back
              </Button>
              <Button
                onClick={handleChangeEmailAndResend}
                disabled={submitting || !!newEmailError || isCheckingNewEmail || !newEmail}
              >
                {submitting ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Updating...</>
                ) : (
                  <><Mail size={16} className="mr-2" /> Update & Send Code</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Enter Verification Code */}
        {verificationStep === 'verify' && selectedItem && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={32} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Enter Verification Code
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                A 6-digit code has been sent to <strong>{selectedItem.email}</strong>
              </p>
            </div>

            <div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={verifyCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerifyCode(val);
                    setVerifyError('');
                    if (val.length === 6) handleVerifyAccountCode(val);
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
                onClick={handleResendCodeInVerify}
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
              <Button variant="outline" onClick={handleVerificationModalClose}>
                Skip for Now
              </Button>
              <Button
                onClick={() => handleVerifyAccountCode(verifyCode)}
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
    </div>
  );
};

export default AdminAccounts;
