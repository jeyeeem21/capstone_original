import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../../../context/ThemeContext';
import { Skeleton } from '../../../components/ui';

// Customer data — will connect to real auth/API
const mockCustomer = {
    id: 0,
    name: '',
    email: '',
    phone: '',
    address: {
        street: '',
        barangay: '',
        city: '',
        province: '',
        zip: '',
    },
    avatar: null,
    memberSince: '',
    totalOrders: 0,
    totalSpent: 0,
};

const mockAddresses = [];

export default function Profile() {
    const { theme } = useTheme();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(() => {
        const tabFromUrl = searchParams.get('tab');
        const validTabs = ['profile', 'addresses', 'security'];
        return tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'profile';
    });

    // Sync active tab to URL
    useEffect(() => {
        setSearchParams(prev => { prev.set('tab', activeTab); return prev; }, { replace: true });
    }, [activeTab, setSearchParams]);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: mockCustomer.name,
        email: mockCustomer.email,
        phone: mockCustomer.phone,
    });
    const [passwordForm, setPasswordForm] = useState({
        current: '',
        newPassword: '',
        confirm: '',
    });
    const [showPasswordSuccess, setShowPasswordSuccess] = useState(false);
    const [showProfileSuccess, setShowProfileSuccess] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 300);
        return () => clearTimeout(timer);
    }, []);

    const tabs = [
        { id: 'profile', label: 'Profile', icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        )},
        { id: 'addresses', label: 'Addresses', icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        )},
        { id: 'security', label: 'Security', icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
        )},
    ];

    const handleProfileSave = () => {
        setIsEditing(false);
        setShowProfileSuccess(true);
        setTimeout(() => setShowProfileSuccess(false), 3000);
    };

    const handlePasswordChange = (e) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirm) return;
        setPasswordForm({ current: '', newPassword: '', confirm: '' });
        setShowPasswordSuccess(true);
        setTimeout(() => setShowPasswordSuccess(false), 3000);
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-PH', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const getInitials = (name) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    My Profile
                </h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Manage your account information and preferences
                </p>
            </div>

            {loading ? (
                <div className="space-y-6">
                    {/* Skeleton Profile Summary */}
                    <div className="rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6 bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-700">
                        <Skeleton variant="circle" width="w-20" height="h-20" />
                        <div className="flex-1 space-y-2">
                            <Skeleton variant="title" width="w-40" />
                            <Skeleton variant="text" width="w-48" />
                            <Skeleton variant="text" width="w-32" />
                        </div>
                        <div className="flex gap-6">
                            <div className="text-center">
                                <Skeleton variant="title" width="w-12" className="mb-1" />
                                <Skeleton variant="text" width="w-10" />
                            </div>
                            <div className="text-center">
                                <Skeleton variant="title" width="w-16" className="mb-1" />
                                <Skeleton variant="text" width="w-14" />
                            </div>
                        </div>
                    </div>
                    {/* Skeleton Tabs */}
                    <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} variant="button" width="w-full" className="flex-1" />)}
                    </div>
                    {/* Skeleton Content */}
                    <div className="rounded-xl p-6 bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-700">
                        <div className="space-y-4">
                            <Skeleton variant="input" />
                            <Skeleton variant="input" />
                            <Skeleton variant="input" />
                            <Skeleton variant="input" />
                        </div>
                        <Skeleton variant="button" width="w-32" className="mt-4" />
                    </div>
                </div>
            ) : (
            <>

            {/* Profile Summary Card */}
            <div
                className="rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6 bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-700"
            >
                {/* Avatar */}
                <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
                    style={{ backgroundColor: 'var(--color-button-500)' }}
                >
                    {getInitials(mockCustomer.name)}
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {mockCustomer.name}
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {mockCustomer.email}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Member since {formatDate(mockCustomer.memberSince)}
                    </p>
                </div>

                {/* Quick Stats */}
                <div className="flex gap-6">
                    <div className="text-center">
                        <p className="text-2xl font-bold" style={{ color: 'var(--color-button-500)' }}>
                            {mockCustomer.totalOrders}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Orders</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold" style={{ color: 'var(--color-button-500)' }}>
                            ₱{mockCustomer.totalSpent.toLocaleString()}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Total Spent</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex-1 justify-center ${activeTab === tab.id ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
                        style={{
                            color: activeTab === tab.id ? 'var(--color-button-500)' : 'var(--color-text-secondary)',
                        }}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' && (
                <div
                    className="rounded-xl p-6 bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-700"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Personal Information
                        </h3>
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                                style={{ backgroundColor: 'var(--color-button-500)' }}
                                onMouseEnter={(e) => (e.target.style.opacity = '0.9')}
                                onMouseLeave={(e) => (e.target.style.opacity = '1')}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setFormData({
                                            name: mockCustomer.name,
                                            email: mockCustomer.email,
                                            phone: mockCustomer.phone,
                                        });
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleProfileSave}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                                    style={{ backgroundColor: 'var(--color-button-500)' }}
                                >
                                    Save Changes
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Success Message */}
                    {showProfileSuccess && (
                        <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Profile updated successfully!
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Full Name */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Full Name
                            </label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                                    style={{
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                            ) : (
                                <p className="text-sm py-2" style={{ color: 'var(--color-text-primary)' }}>
                                    {mockCustomer.name}
                                </p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Email Address
                            </label>
                            {isEditing ? (
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                                    style={{
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                            ) : (
                                <p className="text-sm py-2" style={{ color: 'var(--color-text-primary)' }}>
                                    {mockCustomer.email}
                                </p>
                            )}
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Phone Number
                            </label>
                            {isEditing ? (
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                                    style={{
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                            ) : (
                                <p className="text-sm py-2" style={{ color: 'var(--color-text-primary)' }}>
                                    {mockCustomer.phone}
                                </p>
                            )}
                        </div>

                        {/* Member Since */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Member Since
                            </label>
                            <p className="text-sm py-2" style={{ color: 'var(--color-text-primary)' }}>
                                {formatDate(mockCustomer.memberSince)}
                            </p>
                        </div>
                    </div>

                    {/* Default Address */}
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Default Delivery Address
                        </label>
                        <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                            {mockCustomer.address.street}, {mockCustomer.address.barangay}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                            {mockCustomer.address.city}, {mockCustomer.address.province} {mockCustomer.address.zip}
                        </p>
                    </div>
                </div>
            )}

            {activeTab === 'addresses' && (
                <div className="space-y-4">
                    {mockAddresses.map((addr) => (
                        <div
                            key={addr.id}
                            className={`rounded-xl p-5 bg-white dark:bg-gray-800 ${addr.isDefault ? 'border border-button-500 dark:border-button-400' : 'border border-gray-200 dark:border-gray-700'}`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center bg-button-500/10 text-button-600 dark:text-button-400"
                                    >
                                        {addr.label === 'Home' ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                {addr.label}
                                            </h4>
                                            {addr.isDefault && (
                                                <span
                                                    className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                                                    style={{ backgroundColor: 'var(--color-button-500)' }}
                                                >
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                            {addr.street}, {addr.barangay}
                                        </p>
                                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            {addr.city}, {addr.province} {addr.zip}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        className="p-2 rounded-lg transition-colors"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                        title="Edit"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    {!addr.isDefault && (
                                        <button
                                            className="p-2 rounded-lg transition-colors text-red-500"
                                            title="Delete"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Add Address Button */}
                    <button
                        className="w-full py-4 rounded-xl border-2 border-dashed text-sm font-medium transition-colors flex items-center justify-center gap-2 border-primary-300 dark:border-primary-700 text-gray-500 dark:text-gray-400"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add New Address
                    </button>
                </div>
            )}

            {activeTab === 'security' && (
                <div
                    className="rounded-xl p-6 bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-700"
                >
                    <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--color-text-primary)' }}>
                        Change Password
                    </h3>

                    {showPasswordSuccess && (
                        <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Password changed successfully!
                        </div>
                    )}

                    <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Current Password
                            </label>
                            <input
                                type="password"
                                value={passwordForm.current}
                                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                                style={{
                                    color: 'var(--color-text-primary)',
                                }}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                New Password
                            </label>
                            <input
                                type="password"
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                                style={{
                                    color: 'var(--color-text-primary)',
                                }}
                                required
                                minLength={8}
                            />
                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                Minimum 8 characters
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={passwordForm.confirm}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                                style={{
                                    color: 'var(--color-text-primary)',
                                }}
                                required
                            />
                            {passwordForm.confirm && passwordForm.newPassword !== passwordForm.confirm && (
                                <p className="text-xs mt-1 text-red-500">Passwords do not match</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                            style={{ backgroundColor: 'var(--color-button-500)' }}
                            onMouseEnter={(e) => (e.target.style.opacity = '0.9')}
                            onMouseLeave={(e) => (e.target.style.opacity = '1')}
                            disabled={!passwordForm.current || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirm}
                        >
                            Update Password
                        </button>
                    </form>

                    {/* Account Actions */}
                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                            Account Actions
                        </h4>
                        <div className="flex flex-wrap gap-3">
                            <button
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                            >
                                Download My Data
                            </button>
                            <button className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </>
            )}
        </div>
    );
}
