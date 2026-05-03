import { useState, useEffect } from 'react';
import {
  Sun, Moon, Monitor, Lock, User, Eye, EyeOff,
  Check, Save, RotateCcw, AlertCircle
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { Skeleton } from '../../../components/ui';
import apiClient from '../../../api/apiClient';

const Settings = () => {
  const { theme, updateTheme, saving: themeSaving } = useTheme();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Appearance - initialize from current theme
  const [themeMode, setThemeMode] = useState(theme.mode || 'light');
  const [fontSize, setFontSize] = useState(parseInt(theme.font_size_base) || 14);

  // Profile - initialize from logged-in user
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  // Password
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current_password: false,
    new_password: false,
    new_password_confirmation: false,
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [appearanceMsg, setAppearanceMsg] = useState(null);

  // Load user data into form
  useEffect(() => {
    if (user) {
      setProfileForm({
        first_name: user.first_name || user.name?.split(' ')[0] || '',
        last_name: user.last_name || user.name?.split(' ').slice(1).join(' ') || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user]);

  const handleAppearanceSave = () => {
    updateTheme('mode', themeMode);
    updateTheme('font_size_base', String(fontSize));
    setAppearanceMsg({ type: 'success', text: 'Appearance settings saved!' });
    setTimeout(() => setAppearanceMsg(null), 3000);
  };

  const handleAppearanceReset = () => {
    setThemeMode('light');
    setFontSize(14);
    updateTheme('mode', 'light');
    updateTheme('font_size_base', '14');
    setAppearanceMsg({ type: 'success', text: 'Appearance reset to defaults!' });
    setTimeout(() => setAppearanceMsg(null), 3000);
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await apiClient.put('/auth/profile', profileForm);
      if (res.success) {
        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
        // Refresh user data in auth context
        if (typeof refreshUser === 'function') {
          await refreshUser();
        }
      } else {
        setProfileMsg({ type: 'error', text: res.message || 'Failed to update profile' });
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update profile';
      setProfileMsg({ type: 'error', text: msg });
    } finally {
      setProfileSaving(false);
      setTimeout(() => setProfileMsg(null), 4000);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.new_password_confirmation) return;
    if (passwordForm.new_password.length < 8) return;

    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      const res = await apiClient.put('/auth/password', passwordForm);
      if (res.success) {
        setPasswordForm({ current_password: '', new_password: '', new_password_confirmation: '' });
        setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
      } else {
        setPasswordMsg({ type: 'error', text: res.message || 'Failed to change password' });
      }
    } catch (err) {
      const errors = err.response?.data?.errors;
      const msg = errors?.current_password?.[0] || err.response?.data?.message || 'Failed to change password';
      setPasswordMsg({ type: 'error', text: msg });
    } finally {
      setPasswordSaving(false);
      setTimeout(() => setPasswordMsg(null), 4000);
    }
  };

  const isDark = theme.mode === 'dark';

  const inputStyle = {
    color: 'var(--color-text-primary)',
  };

  const sectionCardStyle = {
  };

  const MsgBox = ({ msg }) => {
    if (!msg) return null;
    const isErr = msg.type === 'error';
    return (
      <div className={`mb-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
        isErr ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
      }`}>
        {isErr ? <AlertCircle size={14} /> : <Check size={14} />} {msg.text}
      </div>
    );
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Settings</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Manage your account preferences and appearance</p>
      </div>

      {/* Grid: mobile=1col, tablet=1top+2bottom, desktop=3cols */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`rounded-xl p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${i === 0 ? 'md:col-span-2 lg:col-span-1' : ''}`}>
              <div className="flex items-center gap-2.5 mb-4">
                <Skeleton variant="circle" width="w-8" height="h-8" />
                <div>
                  <Skeleton variant="title" width="w-24" className="mb-1" />
                  <Skeleton variant="text" width="w-32" />
                </div>
              </div>
              <div className="space-y-3">
                <Skeleton variant="input" />
                <Skeleton variant="input" />
                <Skeleton variant="input" />
              </div>
              <Skeleton variant="button" width="w-full" className="mt-4" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* ============ APPEARANCE SECTION ============ */}
        <div className="md:col-span-2 lg:col-span-1 rounded-xl p-4 flex flex-col bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-700">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-button-500/10">
              <Monitor size={16} className="text-button-600 dark:text-button-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Appearance</h2>
              <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Theme & font size</p>
            </div>
          </div>

          {/* Theme Mode */}
          <div className="mb-4">
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Theme Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
              ].map(mode => {
                const Icon = mode.icon;
                const isActive = themeMode === mode.value;
                return (
                  <button key={mode.value} onClick={() => setThemeMode(mode.value)}
                    className={`relative flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${isActive ? 'bg-button-500/10 border-2 border-button-500 text-button-600 dark:text-button-400' : 'border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}>
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center bg-button-500">
                        <Check size={8} className="text-white" />
                      </div>
                    )}
                    <Icon size={16} />
                    <span className="text-sm font-medium">{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Size - Slider */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>Font Size</label>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-button-500/10 text-button-600 dark:text-button-400">
                {fontSize}px
              </span>
            </div>
            <input
              type="range"
              min={12}
              max={22}
              step={1}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${theme.button_primary} 0%, ${theme.button_primary} ${((fontSize - 12) / 10) * 100}%, ${isDark ? '#4b5563' : '#d1d5db'} ${((fontSize - 12) / 10) * 100}%, ${isDark ? '#4b5563' : '#d1d5db'} 100%)`,
              }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>12px</span>
              <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>22px</span>
            </div>
          </div>

          {/* Preview */}
          <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700">
            <p className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Preview</p>
              <p style={{ fontSize: `${fontSize}px`, color: themeMode === 'dark' ? '#f1f5f9' : 'var(--color-text-primary)' }}>
              The quick brown fox jumps over the lazy dog.
            </p>
              <p className="mt-0.5" style={{ fontSize: `${Math.max(10, fontSize - 2)}px`, color: themeMode === 'dark' ? '#94a3b8' : 'var(--color-text-secondary)' }}>
              Secondary text preview. ₱1,234.56
            </p>
          </div>

          {/* Appearance Actions */}
          <MsgBox msg={appearanceMsg} />
          <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <button onClick={handleAppearanceSave}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-all"
              style={{ backgroundColor: 'var(--color-button-500)' }}>
              <Save size={13} /> Save
            </button>
            <button onClick={handleAppearanceReset}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>

        {/* ============ PROFILE SECTION ============ */}
        <div className="rounded-xl p-4 flex flex-col bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-700">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-button-500/10">
              <User size={16} className="text-button-600 dark:text-button-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Profile</h2>
              <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Personal information</p>
            </div>
          </div>

          <MsgBox msg={profileMsg} />

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>First Name</label>
                <input type="text" value={profileForm.first_name}
                  onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  style={inputStyle}
                  />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Last Name</label>
                <input type="text" value={profileForm.last_name}
                  onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  style={inputStyle}
                  />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Email Address</label>
              <input type="email" value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                style={inputStyle}
                />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Phone Number</label>
              <input type="tel" value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                style={inputStyle}
                />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Address</label>
              <input type="text" value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                style={inputStyle}
                />
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={handleProfileSave} disabled={profileSaving}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-all disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-button-500)' }}>
              <Save size={13} /> {profileSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* ============ PASSWORD SECTION ============ */}
        <div className="rounded-xl p-4 flex flex-col bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-700">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-button-500/10">
              <Lock size={16} className="text-button-600 dark:text-button-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Change Password</h2>
              <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Account security</p>
            </div>
          </div>

          <MsgBox msg={passwordMsg} />

          <form onSubmit={handlePasswordSave} className="space-y-3 flex-1 flex flex-col">
            {[
              { key: 'current_password', label: 'Current Password', placeholder: 'Enter current password' },
              { key: 'new_password', label: 'New Password', placeholder: 'Minimum 8 characters' },
              { key: 'new_password_confirmation', label: 'Confirm Password', placeholder: 'Re-enter new password' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{field.label}</label>
                <div className="relative">
                  <input
                    type={showPasswords[field.key] ? 'text' : 'password'}
                    value={passwordForm[field.key]}
                    onChange={(e) => setPasswordForm({ ...passwordForm, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 pr-9 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    style={inputStyle}
                    required
                    minLength={field.key !== 'current_password' ? 8 : undefined}
                  />
                  <button type="button" onClick={() => setShowPasswords(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    {showPasswords[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {field.key === 'new_password_confirmation' && passwordForm.new_password_confirmation && passwordForm.new_password !== passwordForm.new_password_confirmation && (
                  <p className="text-[10px] mt-0.5 text-red-500">Passwords do not match</p>
                )}
              </div>
            ))}
            <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
              <button type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-all disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-button-500)' }}
                disabled={passwordSaving || !passwordForm.current_password || !passwordForm.new_password || passwordForm.new_password !== passwordForm.new_password_confirmation}>
                <Lock size={13} /> {passwordSaving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}
    </div>
  );
};

export default Settings;