import { useState, useEffect } from 'react';
import {
  Sun, Moon, Monitor, Lock, User, Eye, EyeOff,
  Check, Save, RotateCcw, Truck, CreditCard
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { Skeleton } from '../../../components/ui';

const DriverSettings = () => {
  const { theme, updateTheme } = useTheme();
  const { user } = useAuth();
  const isDark = theme.mode === 'dark';
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Appearance - reads from ThemeContext
  const themeMode = theme.mode || 'light';
  const fontSize = parseInt(theme.font_size_base) || 14;

  // Profile
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    license_number: '',
    vehicle_type: 'Truck',
    plate_number: user?.truck_plate_number || '',
  });
  const [profileSaved, setProfileSaved] = useState(false);

  // Password
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    newPassword: '',
    confirm: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    newPassword: false,
    confirm: false,
  });
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [appearanceSaved, setAppearanceSaved] = useState(false);

  const handleProfileSave = () => {
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handlePasswordSave = (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirm) return;
    if (passwordForm.newPassword.length < 8) return;
    setPasswordForm({ current: '', newPassword: '', confirm: '' });
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 3000);
  };

  const handleAppearanceSave = () => {
    setAppearanceSaved(true);
    setTimeout(() => setAppearanceSaved(false), 3000);
  };

  const handleAppearanceReset = () => {
    updateTheme('mode', 'light');
    updateTheme('font_size_base', 14);
  };

  const sectionCardStyle = {
    backgroundColor: 'var(--color-bg-content)',
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Settings</h1>
        <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">Manage your account preferences and appearance</p>
      </div>

      {/* Grid: mobile=1col, tablet=1top+2bottom, desktop=3cols */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl p-4 border-2 border-primary-300 dark:border-primary-700" style={sectionCardStyle}>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* ============ APPEARANCE SECTION ============ */}
        <div className="rounded-xl p-4 flex flex-col border-2 border-primary-300 dark:border-primary-700" style={sectionCardStyle}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${theme.button_primary}15` }}>
              <Monitor size={16} style={{ color: theme.button_primary }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Appearance</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Theme & font size</p>
            </div>
          </div>

          {/* Theme Mode */}
          <div className="mb-4">
            <label className="block text-xs font-medium mb-2 text-gray-800 dark:text-gray-100">Theme Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
              ].map(mode => {
                const Icon = mode.icon;
                const isActive = themeMode === mode.value;
                return (
                  <button key={mode.value} onClick={() => updateTheme('mode', mode.value)}
                    className={`relative flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${!isActive ? 'border-2 border-primary-300 dark:border-primary-700 text-gray-500 dark:text-gray-400' : ''}`}
                    style={isActive
                      ? { backgroundColor: `${theme.button_primary}10`, border: `2px solid ${theme.button_primary}`, color: theme.button_primary }
                      : {}
                    }>
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.button_primary }}>
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
              <label className="text-xs font-medium text-gray-800 dark:text-gray-100">Font Size</label>
              <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: `${theme.button_primary}15`, color: theme.button_primary }}>
                {fontSize}px
              </span>
            </div>
            <input
              type="range"
              min={12}
              max={22}
              step={1}
              value={fontSize}
              onChange={(e) => updateTheme('font_size_base', Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${theme.button_primary} 0%, ${theme.button_primary} ${((fontSize - 12) / 10) * 100}%, ${isDark ? '#4b5563' : '#d1d5db'} ${((fontSize - 12) / 10) * 100}%, ${isDark ? '#4b5563' : '#d1d5db'} 100%)`,
              }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">12px</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">22px</span>
            </div>
          </div>

          {/* Preview */}
          <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border-2 border-primary-300 dark:border-primary-700">
            <p className="text-[10px] font-medium mb-1.5 text-gray-500 dark:text-gray-400">Preview</p>
            <p className="text-gray-800 dark:text-gray-100" style={{ fontSize: `${fontSize}px` }}>
              The quick brown fox jumps over the lazy dog.
            </p>
            <p className="mt-0.5 text-gray-500 dark:text-gray-400" style={{ fontSize: `${Math.max(10, fontSize - 2)}px` }}>
              Secondary text preview. ₱1,234.56
            </p>
          </div>

          {/* Appearance Actions */}
          {appearanceSaved && (
            <div className="mb-3 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs flex items-center gap-2">
              <Check size={14} /> Appearance settings saved!
            </div>
          )}
          <div className="mt-auto pt-4 border-t border-primary-200 dark:border-primary-700">
            <button onClick={handleAppearanceSave}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-all"
              style={{ backgroundColor: theme.button_primary }}>
              <Save size={13} /> Save
            </button>
            <button onClick={handleAppearanceReset}
              className="w-full flex items-center justify-center gap-1.5 mt-2 py-2 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all border-2 border-primary-300 dark:border-primary-700 text-gray-500 dark:text-gray-400">
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>

        {/* ============ PROFILE SECTION ============ */}
        <div className="rounded-xl p-4 flex flex-col border-2 border-primary-300 dark:border-primary-700" style={sectionCardStyle}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${theme.button_primary}15` }}>
              <User size={16} style={{ color: theme.button_primary }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Profile</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Driver information</p>
            </div>
          </div>

          {profileSaved && (
            <div className="mb-3 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs flex items-center gap-2">
              <Check size={14} /> Profile updated successfully!
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Full Name</label>
              <input type="text" value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-transparent text-gray-800 dark:text-gray-100"
                onFocus={(e) => e.target.style.borderColor = theme.button_primary}
                onBlur={(e) => e.target.style.borderColor = ''} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Email Address</label>
              <input type="email" value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-transparent text-gray-800 dark:text-gray-100"
                onFocus={(e) => e.target.style.borderColor = theme.button_primary}
                onBlur={(e) => e.target.style.borderColor = ''} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Phone Number</label>
              <input type="tel" value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-transparent text-gray-800 dark:text-gray-100"
                onFocus={(e) => e.target.style.borderColor = theme.button_primary}
                onBlur={(e) => e.target.style.borderColor = ''} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Address</label>
              <input type="text" value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-transparent text-gray-800 dark:text-gray-100"
                onFocus={(e) => e.target.style.borderColor = theme.button_primary}
                onBlur={(e) => e.target.style.borderColor = ''} />
            </div>
            <div className="pt-2 border-t border-primary-200 dark:border-primary-700">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-gray-500 dark:text-gray-400">Vehicle Info</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Vehicle Type</label>
                  <input type="text" value={profileForm.vehicle_type}
                    onChange={(e) => setProfileForm({ ...profileForm, vehicle_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-transparent text-gray-800 dark:text-gray-100"
                    onFocus={(e) => e.target.style.borderColor = theme.button_primary}
                    onBlur={(e) => e.target.style.borderColor = ''} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Plate Number</label>
                  <input type="text" value={profileForm.plate_number}
                    onChange={(e) => setProfileForm({ ...profileForm, plate_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-transparent text-gray-800 dark:text-gray-100"
                    onFocus={(e) => e.target.style.borderColor = theme.button_primary}
                    onBlur={(e) => e.target.style.borderColor = ''} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-primary-200 dark:border-primary-700">
            <button onClick={handleProfileSave}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-all"
              style={{ backgroundColor: theme.button_primary }}>
              <Save size={13} /> Save Changes
            </button>
          </div>
        </div>

        {/* ============ PASSWORD SECTION ============ */}
        <div className="rounded-xl p-4 flex flex-col border-2 border-primary-300 dark:border-primary-700" style={sectionCardStyle}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${theme.button_primary}15` }}>
              <Lock size={16} style={{ color: theme.button_primary }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Change Password</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Account security</p>
            </div>
          </div>

          {passwordSaved && (
            <div className="mb-3 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs flex items-center gap-2">
              <Check size={14} /> Password changed successfully!
            </div>
          )}

          <form onSubmit={handlePasswordSave} className="space-y-3 flex-1 flex flex-col">
            {[
              { key: 'current', label: 'Current Password', placeholder: 'Enter current password' },
              { key: 'newPassword', label: 'New Password', placeholder: 'Minimum 8 characters' },
              { key: 'confirm', label: 'Confirm Password', placeholder: 'Re-enter new password' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">{field.label}</label>
                <div className="relative">
                  <input
                    type={showPasswords[field.key] ? 'text' : 'password'}
                    value={passwordForm[field.key]}
                    onChange={(e) => setPasswordForm({ ...passwordForm, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 pr-9 rounded-lg text-sm outline-none transition-colors border-2 border-primary-300 dark:border-primary-700 bg-transparent text-gray-800 dark:text-gray-100"
                    onFocus={(e) => e.target.style.borderColor = theme.button_primary}
                    onBlur={(e) => e.target.style.borderColor = ''}
                    required
                    minLength={field.key !== 'current' ? 8 : undefined}
                  />
                  <button type="button" onClick={() => setShowPasswords(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                    {showPasswords[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {field.key === 'confirm' && passwordForm.confirm && passwordForm.newPassword !== passwordForm.confirm && (
                  <p className="text-[10px] mt-0.5 text-red-500">Passwords do not match</p>
                )}
              </div>
            ))}
            <div className="mt-auto pt-4 border-t border-primary-200 dark:border-primary-700">
              <button type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-all disabled:opacity-50"
                style={{ backgroundColor: theme.button_primary }}
                disabled={!passwordForm.current || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirm}>
                <Lock size={13} /> Update Password
              </button>
            </div>
          </form>
        </div>
      </div>
      )}
    </div>
  );
};

export default DriverSettings;