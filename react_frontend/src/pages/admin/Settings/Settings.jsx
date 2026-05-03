import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon, User, Lock, Palette, Database, Save, Building2, Mail, Phone, MapPin, Globe, Camera, Shield, Eye, EyeOff, Moon, Sun, Download, Upload, Trash2, CheckCircle, RotateCcw, Paintbrush, Square, Type, Layout, Loader2, Users, X, Info, Home, FileText, Edit3, Plus, Award, Target, Leaf, Heart, Truck, Calendar, RefreshCw, Clock, Facebook, Twitter, Instagram, Linkedin, Share2, MousePointer, ClipboardList, Archive, Package, MessageCircle, Scale, ShieldCheck, AlertTriangle, Smartphone, QrCode } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { Card, CardContent, Button, Tabs, FormInput, FormSelect, FormTextarea, useToast, SkeletonSettings } from '../../../components/ui';
import AuditTrail from '../AuditTrail/AuditTrail';
import Archives from '../Archives/Archives';
import AdminAccounts from './AdminAccounts';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useBusinessSettings } from '../../../context/BusinessSettingsContext';
import { websiteContentApi, businessSettingsApi, authApi } from '../../../api';
import { API_BASE_URL, resolveStorageUrl, DEFAULT_LOGO } from '../../../api/config';

// Helper to get full logo URL
const getFullLogoUrl = (logoPath) => {
  if (!logoPath || logoPath === '/logo.svg') return DEFAULT_LOGO;
  if (logoPath.startsWith('blob:')) return DEFAULT_LOGO;
  if (logoPath.startsWith('http')) {
    // Guard against malformed URLs from stale cache (e.g. https://.kjpricemill.com)
    if (/https?:\/\/\./.test(logoPath)) return DEFAULT_LOGO;
    return logoPath;
  }
  return resolveStorageUrl(logoPath);
};

// Helper to get full image URL (for hero images, etc.)
const getFullImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http') || imagePath.startsWith('blob:')) return imagePath;
  return resolveStorageUrl(imagePath);
};

// Profile Section Component - Defined outside to prevent re-creation
const ProfileSectionComponent = ({ profileInfo, handleProfileChange, handleSaveProfile, isCheckingEmail, emailError }) => (
  <div className="space-y-6">
    {/* Profile Avatar */}
    <div className="flex items-center gap-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-dashed border-primary-200 dark:border-primary-700">
      <div className="w-20 h-20 bg-gradient-to-br from-secondary-400 to-secondary-500 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg">
        {profileInfo.firstName?.charAt(0) || ''}{profileInfo.lastName?.charAt(0) || ''}
      </div>
      <div>
        <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Profile Picture</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Upload a photo (PNG, JPG - Max 10MB)</p>
        <Button variant="outline" size="sm">
          <Camera size={16} className="mr-1.5" />
          Upload Photo
        </Button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormInput label="First Name" name="firstName" value={profileInfo.firstName || ''} onChange={handleProfileChange} required placeholder="Enter first name" />
      <FormInput label="Last Name" name="lastName" value={profileInfo.lastName || ''} onChange={handleProfileChange} required placeholder="Enter last name" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="relative">
        <FormInput 
          label="Email Address" 
          name="email" 
          type="email" 
          value={profileInfo.email || ''} 
          onChange={handleProfileChange} 
          required 
          placeholder="your@email.com"
          error={emailError}
        />
        {isCheckingEmail && (
          <div className="absolute right-3 top-9 flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-primary-500" />
            <span className="text-xs text-gray-500">Checking...</span>
          </div>
        )}
      </div>
      <FormInput label="Phone Number" name="phone" value={profileInfo.phone || ''} onChange={handleProfileChange} placeholder="+63 XXX XXX XXXX" />
    </div>
    <FormInput label="Role" name="role" value={profileInfo.role || ''} disabled hint="Contact administrator to change your role" />
    
    <div className="flex justify-end pt-4 border-t border-primary-200 dark:border-primary-700">
      <Button onClick={handleSaveProfile} disabled={!!emailError || isCheckingEmail}>
        <Save size={16} className="mr-1.5" />
        Update Profile
      </Button>
    </div>
  </div>
);

// Security Section Component - Defined outside to prevent re-creation
const SecuritySectionComponent = ({ securityInfo, showPassword, setShowPassword, handleSecurityChange, handleSaveSecurity }) => (
  <div className="space-y-6">
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/30">
      <div className="flex items-start gap-3">
        <Shield size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
        <div>
          <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">Password Requirements</h4>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>• At least 8 characters long</li>
            <li>• Contains uppercase and lowercase letters</li>
            <li>• Contains at least one number</li>
            <li>• Contains at least one special character</li>
          </ul>
        </div>
      </div>
    </div>

    <div className="relative">
      <FormInput label="Current Password" name="currentPassword" type={showPassword ? 'text' : 'password'} value={securityInfo.currentPassword || ''} onChange={handleSecurityChange} required placeholder="Enter current password" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormInput label="New Password" name="newPassword" type={showPassword ? 'text' : 'password'} value={securityInfo.newPassword || ''} onChange={handleSecurityChange} required placeholder="Enter new password" />
      <FormInput label="Confirm New Password" name="confirmPassword" type={showPassword ? 'text' : 'password'} value={securityInfo.confirmPassword || ''} onChange={handleSecurityChange} required placeholder="Confirm new password" />
    </div>
    
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} className="w-4 h-4 rounded border-primary-300 dark:border-primary-700 text-primary-500 focus:ring-primary-500" />
      <span className="text-sm text-gray-600 dark:text-gray-300">Show passwords</span>
    </label>

    <div className="flex justify-end pt-4 border-t border-primary-200 dark:border-primary-700">
      <Button onClick={handleSaveSecurity}>
        <Lock size={16} className="mr-1.5" />
        Change Password
      </Button>
    </div>
  </div>
);

// Color picker component (extracted to module level to prevent remount on re-render)
// Uses uncontrolled color input with native 'change' event to prevent Chrome from closing the picker dialog
const AppearanceColorPicker = ({ label, description, icon: Icon, value, onChange, presets = [], compact = false }) => {
  const colorInputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Attach native 'change' event (fires only when dialog closes, not while dragging)
  // React's onChange maps to native 'input' which fires continuously and causes re-renders that close the picker
  useEffect(() => {
    const input = colorInputRef.current;
    if (!input) return;
    const handleChange = (e) => onChangeRef.current(e.target.value);
    input.addEventListener('change', handleChange);
    return () => input.removeEventListener('change', handleChange);
  }, []);

  // Sync value from parent imperatively (doesn't trigger React reconciliation on the input)
  useEffect(() => {
    if (colorInputRef.current && colorInputRef.current.value !== value) {
      colorInputRef.current.value = value;
    }
  }, [value]);

  return (
    <div className={`bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:border-primary-700 transition-colors ${compact ? 'p-3' : 'p-4'}`}>
      <div className={`flex items-start gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        {!compact && (
          <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm text-primary-500">
            <Icon size={18} />
          </div>
        )}
        <div className="flex-1">
          <h4 className={`font-semibold text-gray-800 dark:text-gray-100 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</h4>
          <p className={`text-gray-500 dark:text-gray-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            ref={colorInputRef}
            type="color"
            defaultValue={value}
            className={`rounded-lg cursor-pointer border-2 border-primary-200 dark:border-primary-700 hover:border-primary-400 transition-colors ${compact ? 'w-8 h-8' : 'w-12 h-12'}`}
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
            className={`w-full font-mono border-2 border-primary-200 dark:border-primary-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-gray-100 ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'}`}
            placeholder="#000000"
          />
        </div>
      </div>
      {presets.length > 0 && (
        <div className={`flex gap-1.5 ${compact ? 'mt-2' : 'mt-3'}`}>
          {presets.slice(0, compact ? 4 : presets.length).map((preset, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(preset)}
              className={`rounded-lg border-2 border-primary-200 dark:border-primary-700 hover:border-primary-400 hover:scale-110 transition-all shadow-sm ${compact ? 'w-6 h-6' : 'w-8 h-8'}`}
              style={{ backgroundColor: preset }}
              title={preset}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Font size slider component (extracted to module level to prevent remount on re-render)
const AppearanceFontSizeSlider = ({ label, description, icon: Icon, value, onChange, min = 12, max = 24 }) => (
  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:border-primary-700 transition-colors">
    <div className="flex items-start gap-3 mb-3">
      <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm text-primary-500">
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{label}</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <div className="text-lg font-bold text-primary-600 dark:text-primary-400">{value}px</div>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-8">{min}px</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 h-2 bg-primary-200 dark:bg-primary-800 rounded-lg appearance-none cursor-pointer accent-button-500"
      />
      <span className="text-xs text-gray-500 dark:text-gray-400 w-8">{max}px</span>
    </div>
    <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-primary-100 dark:border-primary-700">
      <p style={{ fontSize: `${value}px` }} className="text-gray-700 dark:text-gray-200">
        Preview: The quick brown fox jumps over the lazy dog
      </p>
    </div>
  </div>
);

const Settings = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, updateTheme, saveTheme, resetTheme, defaultTheme, saving } = useTheme();
  const { user, isSuperAdmin, refreshUser } = useAuth();
  const { settings: contextSettings, updateSettings: updateContextSettings, refreshSettings } = useBusinessSettings();
  const [activeSection, setActiveSection] = useState(() => {
    const tabFromUrl = searchParams.get('tab');
    const validTabs = ['general', 'profile', 'security', 'appearance', 'information', 'data', 'accounts', 'audit-trail', 'archives'];
    if (tabFromUrl && validTabs.includes(tabFromUrl)) return tabFromUrl;
    return isSuperAdmin() ? 'general' : 'profile';
  });
  const [activeInfoTab, setActiveInfoTab] = useState(() => searchParams.get('info') || 'home');
  const [showPassword, setShowPassword] = useState(false);

  // Sync active section to URL (preserve existing params like 'info')
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', activeSection);
      if (activeSection === 'information') {
        next.set('info', activeInfoTab);
      } else {
        next.delete('info');
      }
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, activeInfoTab]);
  
  // Form states - initialize from context
  const [businessInfo, setBusinessInfo] = useState({
    business_name: '',
    business_tagline: '',
    business_start_year: '',
    business_email: '',
    business_phone: '',
    business_address: '',
    business_open_days: '',
    business_open_time: '',
    business_close_time: '',
    business_hours_json: '',
    footer_tagline: '',
    footer_copyright: '',
    footer_powered_by: '',
    footer_badge1: '',
    footer_badge2: '',
    social_facebook: '',

    social_twitter: '',
    social_instagram: '',
    social_linkedin: '',
    shipping_rate_per_sack: '',
    shipping_rate_per_km: '',
    shipping_base_km: '',
    warehouse_address: '',
    google_maps_embed: '',
    smtp_password: '',
    gcash_name: '',
    gcash_number: '',
  });
  const [businessLoading, setBusinessLoading] = useState(true);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(DEFAULT_LOGO);
  const logoInputRef = useRef(null);
  const [gcashQrFile, setGcashQrFile] = useState(null);
  const [gcashQrPreview, setGcashQrPreview] = useState('');
  const gcashQrInputRef = useRef(null);
  
  const [profileInfo, setProfileInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
  });
  
  const [securityInfo, setSecurityInfo] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Password verification modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForEmailChange, setPasswordForEmailChange] = useState('');
  const [pendingProfileData, setPendingProfileData] = useState(null);

  // Email verification modal state
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationAttempts, setVerificationAttempts] = useState(0);

  // Email availability checking state
  const [isCheckingProfileEmail, setIsCheckingProfileEmail] = useState(false);
  const [profileEmailError, setProfileEmailError] = useState('');
  const [isCheckingBusinessEmail, setIsCheckingBusinessEmail] = useState(false);
  const [businessEmailError, setBusinessEmailError] = useState('');
  const emailCheckTimeout = useRef(null);

  // SMTP configuration warning state
  const [smtpNotConfigured, setSmtpNotConfigured] = useState(false);
  const [smtpWarningMessage, setSmtpWarningMessage] = useState('');

  // Check SMTP configuration whenever settings change
  useEffect(() => {
    // Check both the explicit flag AND the presence of a masked password as fallback
    const isConfigured = contextSettings?.smtp_configured === true 
      || (contextSettings?.smtp_password && contextSettings.smtp_password !== '' && contextSettings.smtp_password !== null);
    if (!isConfigured) {
      setSmtpNotConfigured(true);
      setSmtpWarningMessage('SMTP is not configured. Email verification and notifications will not work until you configure your Gmail App Password.');
    } else {
      setSmtpNotConfigured(false);
      setSmtpWarningMessage('');
    }
  }, [contextSettings]);

  // New SMTP password modal state (after email change)
  const [showNewSmtpModal, setShowNewSmtpModal] = useState(false);
  const [newSmtpPassword, setNewSmtpPassword] = useState('');
  const [newEmailAddress, setNewEmailAddress] = useState('');
  const [previousEmailAddress, setPreviousEmailAddress] = useState(''); // old email before change (for revert)

  // New account password modal state (after SMTP modal)
  const [showNewAccountPasswordModal, setShowNewAccountPasswordModal] = useState(false);
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountPasswordConfirm, setNewAccountPasswordConfirm] = useState('');

  // Load user profile data when user changes - only run once on mount
  useEffect(() => {
    if (user && !profileInfo.email) {
      setProfileInfo({
        firstName: user.first_name || user.name?.split(' ')[0] || '',
        lastName: user.last_name || user.name?.split(' ').slice(1).join(' ') || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Administrator' : 'Staff',
      });
    }
  }, [user]);
  

  // Load business settings on mount - use cached data first for instant display
  useEffect(() => {
    // Try to load from localStorage cache first for instant display
    const cached = localStorage.getItem('kjp-business-settings');
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        setBusinessInfo({
          business_name: cachedData.business_name ?? '',
          business_tagline: cachedData.business_tagline ?? '',
          business_start_year: cachedData.business_start_year ?? '',
          business_email: cachedData.business_email ?? '',
          business_phone: cachedData.business_phone ?? '',
          business_address: cachedData.business_address ?? '',
          business_open_days: cachedData.business_open_days ?? '',
          business_open_time: cachedData.business_open_time ?? '',
          business_close_time: cachedData.business_close_time ?? '',
          business_hours_json: cachedData.business_hours_json ?? '',
          footer_tagline: cachedData.footer_tagline ?? '',
          footer_copyright: cachedData.footer_copyright ?? '',
          footer_powered_by: cachedData.footer_powered_by ?? '',
          footer_badge1: cachedData.footer_badge1 ?? '',
          footer_badge2: cachedData.footer_badge2 ?? '',
          social_facebook: cachedData.social_facebook ?? '',

          social_twitter: cachedData.social_twitter ?? '',
          social_instagram: cachedData.social_instagram ?? '',
          social_linkedin: cachedData.social_linkedin ?? '',
          shipping_rate_per_sack: cachedData.shipping_rate_per_sack ?? '',
          shipping_rate_per_km: cachedData.shipping_rate_per_km ?? '',
          shipping_base_km: cachedData.shipping_base_km ?? '',
          warehouse_address: cachedData.warehouse_address ?? '',
          google_maps_embed: cachedData.google_maps_embed ?? '',
          smtp_password: cachedData.smtp_password ?? '',
          gcash_name: cachedData.gcash_name ?? '',
          gcash_number: cachedData.gcash_number ?? '',
        });
        if (cachedData.business_logo && cachedData.business_logo !== '/logo.svg' && !cachedData.business_logo.startsWith('blob:')) {
          setLogoPreview(getFullLogoUrl(cachedData.business_logo));
        }
        if (cachedData.gcash_qr) setGcashQrPreview(cachedData.gcash_qr);
        setBusinessLoading(false);
        // Clear any stale email errors
        setBusinessEmailError('');
        
        // Check if we should show the new SMTP modal (only for super admin on general tab)
        if (isSuperAdmin() && activeSection === 'general') {
          // Check if there's a pending SMTP configuration from email change
          const pendingSmtp = localStorage.getItem('kjp-pending-smtp-config');
          if (pendingSmtp) {
            try {
              const { email, old_email, timestamp } = JSON.parse(pendingSmtp);
              // Show modal if it's within 1 hour
              if (Date.now() - timestamp < 3600000) {
                setNewEmailAddress(email);
                setPreviousEmailAddress(old_email || '');
                setShowNewSmtpModal(true);
              } else {
                localStorage.removeItem('kjp-pending-smtp-config');
              }
            } catch (e) {
              localStorage.removeItem('kjp-pending-smtp-config');
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse cached settings:', e);
      }
    }
    
    // Then fetch fresh data from API
    const loadBusinessSettings = async () => {
      try {
        const result = await businessSettingsApi.getAll();
        if (result?.success && result?.data) {
          const data = result.data;
          // Use actual database values - show what's in DB, not defaults
          setBusinessInfo({
            business_name: data.business_name ?? '',
            business_tagline: data.business_tagline ?? '',
            business_start_year: data.business_start_year ?? '',
            business_email: data.business_email ?? '',
            business_phone: data.business_phone ?? '',
            business_address: data.business_address ?? '',
            business_open_days: data.business_open_days ?? '',
            business_open_time: data.business_open_time ?? '',
            business_close_time: data.business_close_time ?? '',
            business_hours_json: data.business_hours_json ?? '',
            footer_tagline: data.footer_tagline ?? '',
            footer_copyright: data.footer_copyright ?? '',
            footer_powered_by: data.footer_powered_by ?? '',
            footer_badge1: data.footer_badge1 ?? '',
            footer_badge2: data.footer_badge2 ?? '',
            social_facebook: data.social_facebook ?? '',

            social_twitter: data.social_twitter ?? '',
            social_instagram: data.social_instagram ?? '',
            social_linkedin: data.social_linkedin ?? '',
            shipping_rate_per_sack: data.shipping_rate_per_sack ?? '',
            shipping_rate_per_km: data.shipping_rate_per_km ?? '',
            shipping_base_km: data.shipping_base_km ?? '',
            warehouse_address: data.warehouse_address ?? '',
            google_maps_embed: data.google_maps_embed ?? '',
            smtp_password: data.smtp_password ?? '',
            gcash_name: data.gcash_name ?? '',
            gcash_number: data.gcash_number ?? '',
          });
          if (data.business_logo && data.business_logo !== '/logo.svg' && !data.business_logo.startsWith('blob:')) {
            setLogoPreview(getFullLogoUrl(data.business_logo));
          }
          if (data.gcash_qr) setGcashQrPreview(resolveStorageUrl(data.gcash_qr));
          // Clear any stale email errors when fresh data loads
          setBusinessEmailError('');
          
        }
      } catch (error) {
        console.error('Failed to load business settings:', error);
      } finally {
        setBusinessLoading(false);
      }
    };
    loadBusinessSettings();

    // Cleanup blob URLs on unmount
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, []);

  const handleBusinessChange = (e) => {
    const { name, value } = e.target;
    setBusinessInfo(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Real-time email checking for business email
    if (name === 'business_email') {
      setBusinessEmailError('');
      
      // Clear previous timeout
      if (emailCheckTimeout.current) {
        clearTimeout(emailCheckTimeout.current);
      }

      // Validate email format first
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value || !emailRegex.test(value)) {
        if (value) {
          setBusinessEmailError('Please enter a valid email address.');
        }
        return;
      }

      // Get the original business email from context (the one loaded from database)
      const originalBusinessEmail = contextSettings?.business_email || '';
      
      console.log('Email check:', {
        typedEmail: value.toLowerCase().trim(),
        originalEmail: originalBusinessEmail.toLowerCase().trim(),
        areEqual: value.toLowerCase().trim() === originalBusinessEmail.toLowerCase().trim()
      });
      
      // Skip check if email hasn't changed from the original database value
      if (originalBusinessEmail && value.toLowerCase().trim() === originalBusinessEmail.toLowerCase().trim()) {
        console.log('Skipping check - email unchanged');
        return;
      }

      // Debounce: wait 500ms after user stops typing
      emailCheckTimeout.current = setTimeout(async () => {
        try {
          console.log('Checking email availability:', value);
          setIsCheckingBusinessEmail(true);
          const response = await businessSettingsApi.checkBusinessEmail(value);
          console.log('Email check response:', response);

          if (response.success && !response.data.available) {
            setBusinessEmailError('This email is already registered.');
          } else {
            setBusinessEmailError('');
          }
        } catch (error) {
          console.error('Error checking business email:', error);
        } finally {
          setIsCheckingBusinessEmail(false);
        }
      }, 500);
    }
  };

  const handleProfileChange = useCallback((e) => {
    const { name, value } = e.target;
    setProfileInfo(prev => ({ ...prev, [name]: value }));

    // Real-time email checking for profile email
    if (name === 'email') {
      setProfileEmailError('');
      
      // Clear previous timeout
      if (emailCheckTimeout.current) {
        clearTimeout(emailCheckTimeout.current);
      }

      // Validate email format first
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value || !emailRegex.test(value)) {
        if (value) {
          setProfileEmailError('Please enter a valid email address.');
        }
        return;
      }

      // Skip check if email hasn't changed from current user email
      if (user?.email && value.toLowerCase() === user.email.toLowerCase()) {
        return;
      }

      // Debounce: wait 500ms after user stops typing
      emailCheckTimeout.current = setTimeout(async () => {
        try {
          setIsCheckingProfileEmail(true);
          const response = await authApi.checkProfileEmail(value);

          if (response.success && !response.available) {
            setProfileEmailError('This email is already registered.');
          } else {
            setProfileEmailError('');
          }
        } catch (error) {
          console.error('Error checking email:', error);
        } finally {
          setIsCheckingProfileEmail(false);
        }
      }, 500);
    }
  }, [user]);

  const handleSecurityChange = useCallback((e) => {
    const { name, value } = e.target;
    setSecurityInfo(prev => ({ ...prev, [name]: value }));
  }, []);

  // Validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    // Allow formats: +63 917-123-4567, 09171234567, +639171234567, etc.
    const phoneRegex = /^(\+?63|0)?[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{4}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ''));
  };

  const validateGeneralForm = () => {
    const errors = {};
    
    if (!businessInfo.business_name?.trim()) {
      errors.business_name = 'Business name is required';
    }
    
    if (!businessInfo.business_email?.trim()) {
      errors.business_email = 'Email is required';
    } else if (!validateEmail(businessInfo.business_email)) {
      errors.business_email = 'Please enter a valid email address';
    }
    
    if (!businessInfo.business_phone?.trim()) {
      errors.business_phone = 'Phone number is required';
    } else if (!validatePhone(businessInfo.business_phone)) {
      errors.business_phone = 'Please enter a valid Philippine phone number';
    }
    
    if (!businessInfo.business_address?.trim()) {
      errors.business_address = 'Business address is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Revoke previous blob URL to prevent memory leak and blob errors
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
      
      console.log('Logo file selected:', file.name, file.type, file.size);
      const blobUrl = URL.createObjectURL(file);
      setLogoPreview(blobUrl);
      setLogoFile(file);
      
      // Automatically upload logo immediately
      try {
        setBusinessSaving(true);
        console.log('Uploading logo immediately...');
        const logoResult = await businessSettingsApi.uploadLogo(file);
        console.log('Logo upload result:', logoResult);
        
        if (logoResult?.success && logoResult?.data?.logo_url) {
          const newLogoUrl = getFullLogoUrl(logoResult.data.logo_url);
          console.log('Logo uploaded successfully:', newLogoUrl);
          setLogoPreview(newLogoUrl);
          setLogoFile(null);
          
          // Clear localStorage cache to force refresh everywhere
          localStorage.removeItem('kjp-business-settings');
          
          // Update context immediately
          updateContextSettings({
            business_logo: newLogoUrl,
          });
          
          toast.success('Logo Updated', 'Your business logo has been changed.');
        } else {
          console.error('Logo upload failed:', logoResult);
          toast.error('Upload Failed', 'Failed to upload logo. Please try again.');
          // Revert to previous logo
          setLogoPreview(contextSettings.business_logo || DEFAULT_LOGO);
          setLogoFile(null);
        }
      } catch (error) {
        console.error('Logo upload error:', error);
        toast.error('Upload Error', 'An error occurred while uploading the logo.');
        // Revert to previous logo
        setLogoPreview(contextSettings.business_logo || DEFAULT_LOGO);
        setLogoFile(null);
      } finally {
        setBusinessSaving(false);
      }
    }
  };

  const handleGcashQrChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (gcashQrPreview && gcashQrPreview.startsWith('blob:')) {
        URL.revokeObjectURL(gcashQrPreview);
      }
      setGcashQrPreview(URL.createObjectURL(file));
      setGcashQrFile(file);
    }
  };

  const handleSaveGeneral = async () => {
    // Check if business email is being checked
    if (isCheckingBusinessEmail) {
      toast.error('Please Wait', 'Business email availability is being checked.');
      return;
    }

    // Check for business email errors
    if (businessEmailError) {
      toast.error('Invalid Email', businessEmailError);
      return;
    }

    // Validate before saving
    if (!validateGeneralForm()) {
      toast.error('Validation Error', 'Please fix the errors before saving.');
      return;
    }

    // Check if business email is changing
    const currentBusinessEmail = contextSettings?.business_email || '';
    const newBusinessEmail = businessInfo.business_email || '';
    const emailChanging = currentBusinessEmail && newBusinessEmail && 
                         currentBusinessEmail.toLowerCase() !== newBusinessEmail.toLowerCase();

    if (emailChanging && isSuperAdmin()) {
      // Show password verification modal for business email change
      setPendingProfileData({
        type: 'business_email',
        data: businessInfo,
        hoursSchedule: hoursSchedule, // Include current hours schedule
      });
      setShowPasswordModal(true);
      return;
    }
    
    setBusinessSaving(true);
    try {
      // Logo is already uploaded in handleLogoChange, just use current preview
      const currentLogoUrl = logoPreview && !logoPreview.startsWith('blob:') 
        ? logoPreview 
        : (contextSettings.business_logo || DEFAULT_LOGO);

      // Upload GCash QR code if a new file was selected
      let currentGcashQrUrl = gcashQrPreview && !gcashQrPreview.startsWith('blob:') ? gcashQrPreview : (contextSettings.gcash_qr || '');
      if (gcashQrFile) {
        try {
          const qrResult = await businessSettingsApi.uploadGcashQr(gcashQrFile);
          if (qrResult?.success && qrResult?.data?.qr_url) {
            currentGcashQrUrl = resolveStorageUrl(qrResult.data.qr_url);
            setGcashQrPreview(currentGcashQrUrl);
            setGcashQrFile(null);
          }
        } catch (qrError) {
          console.error('GCash QR upload error:', qrError);
          toast.error('QR Upload Failed', 'Failed to upload GCash QR code. Other settings will still be saved.');
        }
      }
      
      // Save other settings — default warehouse_address to business_address if empty
      const dataToSave = {
        ...businessInfo,
        warehouse_address: businessInfo.warehouse_address || businessInfo.business_address,
        business_hours_json: JSON.stringify(hoursSchedule),
      };
      console.log('Saving business settings...', dataToSave);
      const updateResult = await businessSettingsApi.update(dataToSave);
      console.log('Update result:', updateResult);
      
      // Format hours for display — group consecutive days with same hours
      const shortNames = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
      const groups = [];
      daysOfWeek.forEach(day => {
        const d = hoursSchedule[day];
        if (!d) return;
        const sig = d.closed ? 'closed' : `${d.open}-${d.close}`;
        if (groups.length > 0 && groups[groups.length - 1].sig === sig) {
          groups[groups.length - 1].end = day;
        } else {
          groups.push({ start: day, end: day, sig, data: d });
        }
      });
      const formattedHours = groups.map(g => {
        const label = g.start === g.end ? shortNames[g.start] : `${shortNames[g.start]} - ${shortNames[g.end]}`;
        return g.sig === 'closed' ? `${label}: Closed` : `${label}: ${formatTime(g.data.open)} - ${formatTime(g.data.close)}`;
      }).join('\n');
      
      // Update context for real-time changes across app (Sidebar, Footer, etc.)
      updateContextSettings({
        ...businessInfo,
        business_logo: currentLogoUrl,
        business_hours: formattedHours,
        business_hours_formatted: formattedHours,
        gcash_qr: currentGcashQrUrl,
      });

      // Trigger a fresh fetch so all tabs/roles get server-formatted data
      refreshSettings();
      
      // If SMTP password was saved, clear the warning
      if (dataToSave.smtp_password && dataToSave.smtp_password !== '••••••••') {
        setSmtpNotConfigured(false);
        setSmtpWarningMessage('');
      }
      
      toast.success('Settings Saved', 'Business information has been updated.');
    } catch (error) {
      console.error('Failed to save business settings:', error);
      const errorMessage = error?.response?.data?.message || error.message || 'Failed to save business settings.';
      toast.error('Error', errorMessage);
    } finally {
      setBusinessSaving(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleSaveProfile = useCallback(async () => {
    try {
      // Check if email is being checked
      if (isCheckingProfileEmail) {
        toast.error('Please Wait', 'Email availability is being checked.');
        return;
      }

      // Check for email errors
      if (profileEmailError) {
        toast.error('Invalid Email', profileEmailError);
        return;
      }

      // Validate email
      if (!profileInfo.email || !validateEmail(profileInfo.email)) {
        toast.error('Invalid Email', 'Please enter a valid email address.');
        return;
      }

      // Validate required fields
      if (!profileInfo.firstName?.trim() || !profileInfo.lastName?.trim()) {
        toast.error('Required Fields', 'First name and last name are required.');
        return;
      }

      const profileData = {
        first_name: profileInfo.firstName.trim(),
        last_name: profileInfo.lastName.trim(),
        email: profileInfo.email.trim(),
        phone: profileInfo.phone?.trim() || null,
      };

      // Check if email is changing
      const emailChanging = user?.email && profileData.email.toLowerCase() !== user.email.toLowerCase();

      if (emailChanging) {
        // Show password verification modal
        setPendingProfileData(profileData);
        setShowPasswordModal(true);
        return;
      }

      // No email change - proceed with normal update
      const result = await authApi.updateProfile(profileData);

      if (result.success) {
        toast.success('Profile Updated', 'Your profile has been updated successfully.');
        // Refresh user data in context
        if (result.user) {
          await refreshUser(); // Refresh user data without page reload
        }
      } else {
        toast.error('Update Failed', result.message || 'Failed to update profile.');
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error.message || 'Failed to update profile.';
      const errors = error?.response?.data?.errors;
      
      if (errors) {
        // Show first validation error
        const firstError = Object.values(errors)[0];
        toast.error('Validation Error', Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error('Update Failed', errorMessage);
      }
    }
  }, [profileInfo, user, toast, refreshUser, isCheckingProfileEmail, profileEmailError]);

  const handleSaveSecurity = useCallback(async () => {
    try {
      // Validate passwords
      if (!securityInfo.currentPassword) {
        toast.error('Required Field', 'Please enter your current password.');
        return;
      }

      if (!securityInfo.newPassword) {
        toast.error('Required Field', 'Please enter a new password.');
        return;
      }

      if (securityInfo.newPassword.length < 8) {
        toast.error('Invalid Password', 'New password must be at least 8 characters long.');
        return;
      }

      if (securityInfo.newPassword !== securityInfo.confirmPassword) {
        toast.error('Password Mismatch', 'New password and confirmation do not match.');
        return;
      }

      const result = await authApi.updatePassword({
        current_password: securityInfo.currentPassword,
        new_password: securityInfo.newPassword,
        new_password_confirmation: securityInfo.confirmPassword,
      });

      if (result.success) {
        toast.success('Password Changed', 'Your password has been updated successfully.');
        // Clear password fields
        setSecurityInfo({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        toast.error('Update Failed', result.message || 'Failed to change password.');
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error.message || 'Failed to change password.';
      const errors = error?.response?.data?.errors;
      
      if (errors) {
        // Show first validation error
        const firstError = Object.values(errors)[0];
        toast.error('Validation Error', Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        toast.error('Update Failed', errorMessage);
      }
    }
  }, [securityInfo, toast]);

  // Handle password verification for email change
  const handlePasswordVerification = useCallback(async () => {
    if (!passwordForEmailChange) {
      toast.error('Required', 'Please enter your password.');
      return;
    }

    try {
      // Check if this is for business email or profile email
      const isBusinessEmail = pendingProfileData?.type === 'business_email';

      if (isBusinessEmail) {
        // Business email change - send password and get verification code
        const currentHoursSchedule = pendingProfileData.hoursSchedule || {};
        
        const dataToSave = {
          ...pendingProfileData.data,
          warehouse_address: pendingProfileData.data.warehouse_address || pendingProfileData.data.business_address,
          business_hours_json: JSON.stringify(currentHoursSchedule),
          current_password: passwordForEmailChange,
        };

        setBusinessSaving(true);
        const updateResult = await businessSettingsApi.update(dataToSave);
        setBusinessSaving(false);

        if (updateResult.success && updateResult.requires_verification) {
          // Password verified, now show email verification modal
          setShowPasswordModal(false);
          // DON'T clear passwordForEmailChange - we need it for account password modal later
          setShowEmailVerificationModal(true);
          toast.success('Verification Sent', updateResult.message || 'Please check your new email for the verification code.');
        } else if (updateResult.success) {
          // No verification needed (shouldn't happen but handle it)
          setShowPasswordModal(false);
          setPasswordForEmailChange('');
          setPendingProfileData(null);
          
          // Update context and refresh
          const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          const shortNames = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
          const groups = [];
          daysOfWeek.forEach(day => {
            const d = currentHoursSchedule[day];
            if (!d) return;
            const sig = d.closed ? 'closed' : `${d.open}-${d.close}`;
            if (groups.length > 0 && groups[groups.length - 1].sig === sig) {
              groups[groups.length - 1].end = day;
            } else {
              groups.push({ start: day, end: day, sig, data: d });
            }
          });
          const formattedHours = groups.map(g => {
            const label = g.start === g.end ? shortNames[g.start] : `${shortNames[g.start]} - ${shortNames[g.end]}`;
            const formatTime = (time) => {
              if (!time) return '';
              const [hours, minutes] = time.split(':');
              const h = parseInt(hours);
              const ampm = h >= 12 ? 'PM' : 'AM';
              const hour12 = h % 12 || 12;
              return `${hour12}:${minutes} ${ampm}`;
            };
            return g.sig === 'closed' ? `${label}: Closed` : `${label}: ${formatTime(g.data.open)} - ${formatTime(g.data.close)}`;
          }).join('\n');
          
          updateContextSettings({
            ...pendingProfileData.data,
            business_logo: logoPreview && !logoPreview.startsWith('blob:') ? logoPreview : (contextSettings.business_logo || DEFAULT_LOGO),
            business_hours: formattedHours,
            business_hours_formatted: formattedHours,
          });

          refreshSettings();
          await refreshUser();
          
          toast.success('Settings Saved', 'Business email has been updated successfully.');
        }
      } else {
        // Profile email change
        const profileData = {
          ...pendingProfileData,
          current_password: passwordForEmailChange,
        };

        setBusinessSaving(true);
        const result = await authApi.updateProfile(profileData);
        setBusinessSaving(false);

        if (result.success && result.requires_verification) {
          // Password verified, now show email verification modal
          setShowPasswordModal(false);
          // DON'T clear passwordForEmailChange - we need it for account password modal later
          setShowEmailVerificationModal(true);
          toast.success('Verification Sent', result.message || 'Please check your new email for the verification code.');
        } else if (result.success) {
          // No verification needed (shouldn't happen but handle it)
          setShowPasswordModal(false);
          setPasswordForEmailChange('');
          setPendingProfileData(null);
          toast.success('Profile Updated', 'Your profile has been updated successfully.');
          await refreshUser();
        } else {
          toast.error('Verification Failed', result.message || 'Failed to verify password.');
        }
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error.message || 'Failed to verify password.';
      const errors = error?.response?.data?.errors;
      const requiresSmtpSetup = error?.response?.data?.requires_smtp_setup;
      
      if (requiresSmtpSetup) {
        // SMTP is not configured - show special warning
        setShowPasswordModal(false);
        setPasswordForEmailChange(''); // Clear here since flow is interrupted
        setPendingProfileData(null);
        setSmtpNotConfigured(true);
        setSmtpWarningMessage(errorMessage);
        toast.error('SMTP Not Configured', errorMessage, { duration: 8000 });
        // Switch to general tab to show SMTP settings
        setActiveSection('general');
      } else if (errors && errors.current_password) {
        toast.error('Incorrect Password', Array.isArray(errors.current_password) ? errors.current_password[0] : errors.current_password);
      } else {
        toast.error('Verification Failed', errorMessage);
      }
      
      setBusinessSaving(false);
    }
  }, [passwordForEmailChange, pendingProfileData, toast, refreshUser, logoPreview, contextSettings, updateContextSettings, refreshSettings]);

  // Handle email verification code submission
  const handleEmailVerification = useCallback(async () => {
    if (!emailVerificationCode || emailVerificationCode.length !== 6) {
      setVerificationError('Please enter the 6-digit code.');
      return;
    }

    if (verificationAttempts >= 5) {
      setVerificationError('Too many failed attempts. Please request a new verification code.');
      return;
    }

    // Capture old emails from auth context / settings (NOT form state which already has the new values)
    const oldProfileEmail = user?.email;
    const oldBusinessEmail = contextSettings?.business_email || user?.email;

    try {
      const isBusinessEmail = pendingProfileData?.type === 'business_email';
      let result;

      if (isBusinessEmail) {
        // Business email verification
        result = await businessSettingsApi.verifyBusinessEmailChange(emailVerificationCode);
      } else {
        // Profile email verification
        result = await authApi.verifyEmailChange(emailVerificationCode);
      }

      if (result.success) {
        setShowEmailVerificationModal(false);
        setEmailVerificationCode('');
        setVerificationError('');
        setVerificationAttempts(0);
        setPendingProfileData(null);
        
        if (isBusinessEmail) {
          // Business email changed - SMTP needs reconfiguration
          toast.success('Email Changed', result.message || 'Business email has been updated successfully.');
          
          // Force clear localStorage cache FIRST
          localStorage.removeItem('kjp-business-settings');
          
          // Refresh settings context to fetch fresh data from API
          await refreshSettings();
          
          // Get the fresh settings after refresh
          let newEmail = '';
          try {
            const freshSettings = await businessSettingsApi.getFresh();
            console.log('Fresh settings from API:', freshSettings);
            if (freshSettings?.success && freshSettings?.data) {
              newEmail = freshSettings.data.business_email;
              console.log('SMTP configured from API:', freshSettings.data.smtp_configured);
              console.log('SMTP password from API:', freshSettings.data.smtp_password);
              
              // Update business info state
              setBusinessInfo(prev => ({
                ...prev,
                business_email: newEmail, // Update with new email
              }));
              
              // Also update profile info to sync (for super admin)
              setProfileInfo(prev => ({
                ...prev,
                email: newEmail,
              }));
              
              setNewEmailAddress(newEmail);
            }
          } catch (e) {
            console.error('Failed to refresh settings:', e);
          }
          await refreshUser();
          
          // SMTP needs reconfiguration for the new email
          setSmtpNotConfigured(true);
          setSmtpWarningMessage('You changed the business email. Please configure a new Gmail App Password for the new email address.');
          
          // Store pending SMTP config in localStorage so modal persists after refresh
          const pendingEmail = newEmail || result.user?.email || '';
          setPreviousEmailAddress(oldBusinessEmail);
          localStorage.setItem('kjp-pending-smtp-config', JSON.stringify({
            email: pendingEmail,
            old_email: oldBusinessEmail,
            timestamp: Date.now()
          }));
          
          // Show modal to configure new SMTP password
          setShowNewSmtpModal(true);
        } else {
          // Profile email changed
          toast.success('Email Changed', result.message || 'Your email address has been updated successfully.');
          
          // Update profile info with new email
          if (result.user) {
            setProfileInfo(prev => ({
              ...prev,
              email: result.user.email,
            }));
            await refreshUser();
            
            // If super admin, SMTP needs reconfiguration for new email
            if (result.user.role === 'super_admin') {
              // Refresh settings to get current state
              await refreshSettings();
              
              // Force clear localStorage cache to ensure fresh data
              localStorage.removeItem('kjp-business-settings');
              
              // Force reload business settings to get fresh data
              try {
                const freshSettings = await businessSettingsApi.getFresh();
                if (freshSettings?.success && freshSettings?.data) {
                  // Update business info state with new email
                  setBusinessInfo(prev => ({
                    ...prev,
                    business_email: result.user.email, // Update with new email (synced from profile)
                  }));
                  setNewEmailAddress(result.user.email);
                  
                  // Update context with fresh settings
                  updateContextSettings(freshSettings.data);
                }
              } catch (e) {
                console.error('Failed to refresh settings:', e);
              }
              
              setSmtpNotConfigured(true);
              setSmtpWarningMessage('You changed your email. Please configure a new Gmail App Password for the new email address.');
              
              // Store pending SMTP config in localStorage so modal persists after refresh
              setPreviousEmailAddress(oldProfileEmail);
              localStorage.setItem('kjp-pending-smtp-config', JSON.stringify({
                email: result.user.email,
                old_email: oldProfileEmail,
                timestamp: Date.now()
              }));
              
              // Show modal to configure new SMTP password
              setShowNewSmtpModal(true);
            }
          }
        }
      } else {
        setVerificationError(result.error || 'Invalid verification code.');
        setVerificationAttempts(prev => prev + 1);
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error.message || 'Failed to verify code.';
      setVerificationError(errorMessage);
      setVerificationAttempts(prev => prev + 1);
    }
  }, [emailVerificationCode, pendingProfileData, user, contextSettings, toast, refreshUser, updateContextSettings, refreshSettings]);

  // Cancel password verification
  const handleCancelPasswordVerification = useCallback(() => {
    setShowPasswordModal(false);
    setPasswordForEmailChange('');
    setPendingProfileData(null);
  }, []);

  // Cancel email verification
  const handleCancelEmailVerification = useCallback(() => {
    setShowEmailVerificationModal(false);
    setEmailVerificationCode('');
    setVerificationError('');
    setVerificationAttempts(0);
    setPendingProfileData(null);
    setPasswordForEmailChange('');
  }, []);

  // Handle new SMTP password submission
  const handleSaveNewSmtpPassword = useCallback(async () => {
    if (!newSmtpPassword || newSmtpPassword.length < 16) {
      toast.error('Invalid Password', 'Gmail App Password must be 16 characters long.');
      return;
    }

    try {
      setBusinessSaving(true);
      
      // Save the new SMTP password
      const result = await businessSettingsApi.update({
        smtp_password: newSmtpPassword,
      });

      if (result.success) {
        toast.success('SMTP Configured', 'Gmail App Password has been configured successfully.');
        
        // Update local state
        setBusinessInfo(prev => ({
          ...prev,
          smtp_password: '••••••••', // Show masked
        }));
        
        // DON'T clear the warning yet - keep it until user also updates account password
        // The warning will stay in sidebar/bottom nav
        
        // Clear pending SMTP config
        localStorage.removeItem('kjp-pending-smtp-config');
        
        // Close SMTP modal
        setShowNewSmtpModal(false);
        setNewSmtpPassword('');
        
        // Refresh settings
        await refreshSettings();
        
        // Show account password modal
        setShowNewAccountPasswordModal(true);
      } else {
        toast.error('Error', result.message || 'Failed to save SMTP password.');
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error.message || 'Failed to save SMTP password.';
      toast.error('Error', errorMessage);
    } finally {
      setBusinessSaving(false);
    }
  }, [newSmtpPassword, toast, refreshSettings]);

  // Cancel email change — reverts email back to the old address
  const handleCancelEmailChange = useCallback(async () => {
    if (!previousEmailAddress) {
      toast.error('Cannot Revert', 'Previous email address is unknown. Please contact support.');
      return;
    }

    try {
      setBusinessSaving(true);
      const result = await authApi.revertEmailChange(previousEmailAddress);

      if (result.success) {
        localStorage.removeItem('kjp-pending-smtp-config');
        setShowNewSmtpModal(false);
        setNewSmtpPassword('');
        setNewEmailAddress('');
        setPreviousEmailAddress('');
        setPasswordForEmailChange('');

        // Restore profile and business info to old email
        setProfileInfo(prev => ({ ...prev, email: result.user?.email || previousEmailAddress }));
        setBusinessInfo(prev => ({ ...prev, business_email: result.user?.email || previousEmailAddress }));

        // Refresh user + settings to sync backend state
        await refreshUser();
        localStorage.removeItem('kjp-business-settings');
        await refreshSettings();

        // SMTP warning will be resolved by the useEffect that checks contextSettings.smtp_configured

        toast.info('Email Change Cancelled', result.message || 'Your email and SMTP configuration have been restored.');
      } else {
        toast.error('Revert Failed', result.error || 'Failed to cancel email change. Please try again.');
      }
    } catch (error) {
      toast.error('Error', 'Failed to cancel email change. Please try again.');
    } finally {
      setBusinessSaving(false);
    }
  }, [previousEmailAddress, toast, refreshUser, refreshSettings]);

  // Handle new account password submission
  const handleSaveNewAccountPassword = useCallback(async () => {
    if (!newAccountPassword || newAccountPassword.length < 8) {
      toast.error('Invalid Password', 'Password must be at least 8 characters long.');
      return;
    }

    if (newAccountPassword !== newAccountPasswordConfirm) {
      toast.error('Password Mismatch', 'Passwords do not match.');
      return;
    }

    try {
      setBusinessSaving(true);
      
      // This is for the super admin to set a new password for their account
      // Since they changed their email, they should update their password too
      const result = await authApi.updatePassword({
        current_password: passwordForEmailChange, // Use the password they entered earlier
        new_password: newAccountPassword,
        new_password_confirmation: newAccountPasswordConfirm,
      });

      if (result.success) {
        // Clear the email_change_pending flag in database
        await authApi.clearEmailChangePending();
        
        toast.success('Password Updated', 'Your account password has been updated successfully. Email change flow completed.');
        
        // Keep SMTP warning visible if SMTP is still not configured
        // (Don't clear smtpNotConfigured - let the useEffect handle it based on actual SMTP status)
        
        // Clear pending SMTP config flag
        localStorage.removeItem('kjp-pending-smtp-config');
        
        // Refresh user to get updated email_change_pending flag
        await refreshUser();
        
        // Close modal
        setShowNewAccountPasswordModal(false);
        setNewAccountPassword('');
        setNewAccountPasswordConfirm('');
        setNewEmailAddress('');
        setPasswordForEmailChange('');
        
        // Switch to general tab
        setActiveSection('general');
      } else {
        toast.error('Error', result.message || 'Failed to update password.');
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error.message || 'Failed to update password.';
      toast.error('Error', errorMessage);
    } finally {
      setBusinessSaving(false);
    }
  }, [newAccountPassword, newAccountPasswordConfirm, passwordForEmailChange, toast, refreshUser]);

  // Skip new account password
  const handleSkipNewAccountPassword = useCallback(async () => {
    try {
      // Clear the email_change_pending flag in database even if skipped
      await authApi.clearEmailChangePending();
    } catch {
      // Non-critical — continue even if clearing fails
    }
    
    // Keep SMTP warning visible since user skipped configuration
    // The warning will remain until user actually configures SMTP
    // (Don't clear smtpNotConfigured - let the useEffect handle it based on actual SMTP status)
    
    // Clear pending SMTP config flag
    localStorage.removeItem('kjp-pending-smtp-config');
    
    // Refresh user to get updated email_change_pending flag
    await refreshUser();
    
    setShowNewAccountPasswordModal(false);
    setNewAccountPassword('');
    setNewAccountPasswordConfirm('');
    setNewEmailAddress('');
    setPasswordForEmailChange('');
    // Switch to general tab
    setActiveSection('general');
    
    toast.info('Email Change Complete', 'You can update your password later from the Security tab. Remember to configure your Gmail App Password for email notifications.');
  }, [toast, refreshUser]);



  // Per-day schedule
  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
  const defaultSchedule = Object.fromEntries(daysOfWeek.map(d => [d, { open: '07:00', close: '18:00', closed: d === 'sunday' }]));

  const [hoursSchedule, setHoursSchedule] = useState(defaultSchedule);

  // Load schedule from business_hours_json when data loads
  useEffect(() => {
    if (businessInfo.business_hours_json) {
      try {
        const parsed = JSON.parse(businessInfo.business_hours_json);
        if (parsed && typeof parsed === 'object') {
          setHoursSchedule(prev => ({ ...prev, ...parsed }));
        }
      } catch {}
    }
  }, [businessInfo.business_hours_json]);

  const handleScheduleChange = (day, field, value) => {
    setHoursSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const handleApplyToAll = () => {
    const monday = hoursSchedule.monday;
    setHoursSchedule(prev => {
      const updated = { ...prev };
      daysOfWeek.forEach(d => {
        updated[d] = { ...monday, closed: prev[d].closed };
      });
      return updated;
    });
  };

  const allSettingsSections = [
    { id: 'general', icon: Building2, title: 'General', description: 'Business information', superAdminOnly: true },
    { id: 'profile', icon: User, title: 'Profile', description: 'Your account settings' },
    { id: 'security', icon: Lock, title: 'Security', description: 'Password & security' },
    { id: 'appearance', icon: Palette, title: 'Appearance', description: 'Theme & display', superAdminOnly: true },
    { id: 'information', icon: Info, title: 'Information', description: 'Website content', superAdminOnly: true },
    { id: 'data', icon: Database, title: 'Data', description: 'Backup & export', superAdminOnly: true },
    { id: 'accounts', icon: Shield, title: 'Accounts', description: 'Admin accounts', superAdminOnly: true },
    { id: 'audit-trail', icon: ClipboardList, title: 'Audit Trail', description: 'System activity logs', superAdminOnly: true },
    { id: 'archives', icon: Archive, title: 'Archives', description: 'Archived records', superAdminOnly: true },
  ];

  const settingsSections = isSuperAdmin()
    ? allSettingsSections
    : allSettingsSections.filter(s => !s.superAdminOnly);

  // General Settings Section - render function to avoid re-creating component
  const renderGeneralSection = () => {
    if (businessLoading && !localStorage.getItem('kjp-business-settings')) {
      return <SkeletonSettings />;
    }
    
    return (
      <div className={`space-y-6 transition-opacity duration-200 ${businessSaving ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* Logo Upload */}
        <div className="flex items-center gap-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-dashed border-primary-200 dark:border-primary-700">
          <div className="w-24 h-24 bg-gradient-to-br from-button-500 to-button-600 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden relative">
            {businessSaving ? (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 size={32} className="text-white animate-spin" />
              </div>
            ) : null}
            <img src={logoPreview} alt="Business Logo" className="w-20 h-20 object-contain rounded-lg bg-white/90 dark:bg-gray-700/90 p-1" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            <span className="text-white font-bold text-3xl hidden">{businessInfo.business_name?.substring(0, 3) || 'KJP'}</span>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Business Logo</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Upload your company logo (PNG, JPG, SVG, WebP - Max 10MB). Logo uploads immediately.</p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleLogoChange}
              className="hidden"
              id="logo-upload"
              disabled={businessSaving}
            />
            <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={businessSaving}>
              {businessSaving ? (
                <>
                  <Loader2 size={16} className="mr-1.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera size={16} className="mr-1.5" />
                  Change Logo
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput 
            label="Business Name" 
            name="business_name" 
            value={businessInfo.business_name} 
            onChange={handleBusinessChange} 
            required 
            placeholder="Enter business name"
            error={validationErrors.business_name}
          />
          <FormInput 
            label="Business Tagline" 
            name="business_tagline" 
            value={businessInfo.business_tagline} 
            onChange={handleBusinessChange} 
            placeholder="e.g. Inventory & Sales"
            hint="This appears under your business name in the sidebar"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput 
            label="Year Established" 
            name="business_start_year" 
            type="number" 
            value={businessInfo.business_start_year} 
            onChange={handleBusinessChange} 
            placeholder="e.g. 2010"
            hint="Used for 'Since YYYY' labels and years of experience calculations"
          />
          <div className="relative">
            <FormInput 
              label="Business Email" 
              name="business_email" 
              type="email" 
              value={businessInfo.business_email} 
              onChange={handleBusinessChange} 
              required 
              placeholder="info@business.com"
              error={validationErrors.business_email || businessEmailError}
            />
            {isCheckingBusinessEmail && (
              <div className="absolute right-3 top-9 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-primary-500" />
                <span className="text-xs text-gray-500">Checking...</span>
              </div>
            )}
          </div>
          <FormInput 
            label="Phone Number" 
            name="business_phone" 
            value={businessInfo.business_phone} 
            onChange={handleBusinessChange} 
            required 
            placeholder="+63 917-123-4567"
            error={validationErrors.business_phone}
          />
        </div>
        <FormTextarea 
          label="Business Address" 
          name="business_address" 
          value={businessInfo.business_address} 
          onChange={handleBusinessChange} 
          required 
          rows={2} 
          placeholder="Enter full business address"
          error={validationErrors.business_address}
        />
        <FormTextarea 
          label="Google Maps Embed URL" 
          name="google_maps_embed" 
          value={businessInfo.google_maps_embed} 
          onChange={handleBusinessChange} 
          rows={2} 
          placeholder="Paste Google Maps embed URL here (from Google Maps > Share > Embed a map)"
          hint="Go to Google Maps → Search your location → Share → Embed a map → Copy the src URL"
        />
        
        {/* Business Hours */}
        <div className="p-4 bg-button-50 dark:bg-gray-700/50 rounded-xl border border-button-200 dark:border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Clock size={18} className="text-button-600 dark:text-button-400" />
              Business Hours
            </h4>
            <button 
              type="button" 
              onClick={handleApplyToAll}
              className="text-xs text-button-600 dark:text-button-400 hover:underline"
            >
              Apply Monday's hours to all
            </button>
          </div>
          <div className="space-y-1.5">
            {daysOfWeek.map(day => (
              <div key={day} className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${hoursSchedule[day]?.closed ? 'bg-red-50 dark:bg-red-900/10' : 'bg-white dark:bg-gray-800/50'}`}>
                <span className="w-10 text-sm font-semibold text-gray-600 dark:text-gray-300">{dayLabels[day]}</span>
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={hoursSchedule[day]?.closed || false} 
                    onChange={(e) => handleScheduleChange(day, 'closed', e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-red-500 border-gray-300 dark:border-gray-500 focus:ring-red-400"
                  />
                  <span className={`text-xs ${hoursSchedule[day]?.closed ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>Closed</span>
                </label>
                {!hoursSchedule[day]?.closed && (
                  <div className="flex items-center gap-2 flex-1 ml-1">
                    <input 
                      type="time" 
                      value={hoursSchedule[day]?.open || '07:00'} 
                      onChange={(e) => handleScheduleChange(day, 'open', e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-button-500"
                    />
                    <span className="text-gray-400 text-xs">—</span>
                    <input 
                      type="time" 
                      value={hoursSchedule[day]?.close || '18:00'} 
                      onChange={(e) => handleScheduleChange(day, 'close', e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-button-500"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Set the opening and closing time for each day. Check "Closed" for days off.</p>
        </div>

        {/* Footer Content */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-primary-200 dark:border-primary-700">
          <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <FileText size={18} className="text-primary-600 dark:text-primary-400" />
            Footer Content
          </h4>
          <div className="space-y-4">
            <FormTextarea 
              label="Footer Tagline" 
              name="footer_tagline" 
              value={businessInfo.footer_tagline} 
              onChange={handleBusinessChange} 
              rows={2} 
              placeholder="Your trusted partner in quality rice processing..." 
              hint="Displayed in the footer under the business name"
            />
            <FormInput 
              label="Footer Copyright Text" 
              name="footer_copyright" 
              value={businessInfo.footer_copyright} 
              onChange={handleBusinessChange} 
              placeholder="Management System. All rights reserved." 
              hint="Shown at the bottom of the footer after the business name and year"
            />
            <FormInput 
              label="Footer Powered By" 
              name="footer_powered_by" 
              value={businessInfo.footer_powered_by} 
              onChange={handleBusinessChange} 
              placeholder="Powered by XianFire Framework. Built at Mindoro State University" 
              hint="Credit line displayed at the very bottom of the footer"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput 
                label="Footer Badge 1 (Outline)" 
                name="footer_badge1" 
                value={businessInfo.footer_badge1} 
                onChange={handleBusinessChange} 
                placeholder="Premium Quality" 
                hint="Leave blank to hide this badge"
              />
              <FormInput 
                label="Footer Badge 2 (Filled)" 
                name="footer_badge2" 
                value={businessInfo.footer_badge2} 
                onChange={handleBusinessChange} 
                placeholder="ISO Certified" 
                hint="Leave blank to hide this badge"
              />
            </div>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/30">
          <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Share2 size={18} className="text-blue-600 dark:text-blue-400" />
            Social Media Links
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput 
              label={
                <span className="flex items-center gap-2">
                  <Facebook size={16} className="text-blue-600 dark:text-blue-400" />
                  Facebook URL
                </span>
              }
              name="social_facebook" 
              value={businessInfo.social_facebook} 
              onChange={handleBusinessChange} 
              placeholder="https://facebook.com/yourpage" 
            />
            <FormInput 
              label={
                <span className="flex items-center gap-2">
                  <Twitter size={16} className="text-sky-500" />
                  Twitter/X URL
                </span>
              }
              name="social_twitter" 
              value={businessInfo.social_twitter} 
              onChange={handleBusinessChange} 
              placeholder="https://twitter.com/yourhandle" 
            />
            <FormInput 
              label={
                <span className="flex items-center gap-2">
                  <Instagram size={16} className="text-pink-500" />
                  Instagram URL
                </span>
              }
              name="social_instagram" 
              value={businessInfo.social_instagram} 
              onChange={handleBusinessChange} 
              placeholder="https://instagram.com/yourprofile" 
            />
            <FormInput 
              label={
                <span className="flex items-center gap-2">
                  <Linkedin size={16} className="text-blue-700 dark:text-blue-300" />
                  LinkedIn URL
                </span>
              }
              name="social_linkedin" 
              value={businessInfo.social_linkedin} 
              onChange={handleBusinessChange} 
              placeholder="https://linkedin.com/company/yourcompany" 
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            Leave empty to hide the social media icon in the footer.
          </p>
        </div>

        {/* Email / SMTP Configuration */}
        <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-500/30">
          <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-2">
            <Mail size={18} className="text-violet-600 dark:text-violet-400" />
            Email Notifications
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Enable email notifications by entering your Gmail <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 underline font-medium">App Password</a>. Emails will be sent from your <strong>Business Email</strong> ({businessInfo.business_email || 'not set'}).
          </p>
          
          {/* SMTP Warning Banner */}
          {smtpNotConfigured && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-500">
              <div className="flex items-center gap-3">
                <AlertTriangle size={24} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-red-800 dark:text-red-300">SMTP Configuration Required</h4>
                  <p className="text-sm text-red-700 dark:text-red-400">{smtpWarningMessage}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <div className="max-w-md">
                <FormInput
                  label={<span className="flex items-center gap-1.5"><Lock size={14} /> Gmail App Password</span>}
                  name="smtp_password"
                  type="password"
                  value={businessInfo.smtp_password}
                  onChange={handleBusinessChange}
                  placeholder="Enter your 16-character app password"
                  error={smtpNotConfigured ? 'SMTP password is required for email verification' : ''}
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const result = await businessSettingsApi.testEmail(businessInfo.smtp_password);
                    if (result?.success) {
                      toast.success('Test Email Sent', 'Check your inbox at ' + (businessInfo.business_email || 'your business email') + '.');
                    } else {
                      toast.error('Test Failed', result?.message || 'Could not send test email. Check your App Password.');
                    }
                  } catch (err) {
                    toast.error('Test Failed', err?.response?.data?.message || 'Could not send test email. Check your App Password.');
                  }
                }}
                disabled={!businessInfo.smtp_password}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300 bg-white dark:bg-violet-900/40 hover:bg-violet-100 dark:hover:bg-violet-800/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Mail size={15} />
                Send Test Email
              </button>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-violet-200 dark:border-violet-500/30">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <strong>How to get an App Password:</strong> Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 underline">Google App Passwords</a> → Select app “Mail” → Generate → Copy the 16-character password and paste it here. Email notifications will only work when this is configured.
              </p>
            </div>
          </div>
        </div>

        {/* Shipping & Delivery Settings */}
        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-500/30">
          <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-2">
            <Truck size={18} className="text-orange-600 dark:text-orange-400" />
            Shipping & Delivery
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Configure shipping rates based on distance from your warehouse.
          </p>
          <div className="space-y-4">
            <FormTextarea 
              label="Warehouse Address"
              name="warehouse_address"
              value={businessInfo.warehouse_address || businessInfo.business_address}
              onChange={handleBusinessChange}
              rows={2}
              placeholder={businessInfo.business_address || "Enter your warehouse/business full address"}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Defaults to Business Address if left empty.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormInput 
                label="Base Distance (km)"
                name="shipping_base_km"
                type="number"
                value={businessInfo.shipping_base_km}
                onChange={handleBusinessChange}
                placeholder="e.g. 50"
              />
              <FormInput 
                label="Rate per Sack (₱)"
                name="shipping_rate_per_sack"
                type="number"
                value={businessInfo.shipping_rate_per_sack}
                onChange={handleBusinessChange}
                placeholder="e.g. 10"
              />
              <FormInput 
                label="Rate per KM (₱)"
                name="shipping_rate_per_km"
                type="number"
                value={businessInfo.shipping_rate_per_km}
                onChange={handleBusinessChange}
                placeholder="e.g. 5"
              />
            </div>
            {(businessInfo.shipping_base_km && businessInfo.shipping_rate_per_sack) ? (
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-500/30">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Preview:</strong> For every <span className="text-orange-600 dark:text-orange-400 font-semibold">{businessInfo.shipping_base_km} km</span>, 
                  charge <span className="text-orange-600 dark:text-orange-400 font-semibold">₱{businessInfo.shipping_rate_per_sack}</span> per sack.
                  {businessInfo.shipping_rate_per_km && (
                    <> Additional rate: <span className="text-orange-600 dark:text-orange-400 font-semibold">₱{businessInfo.shipping_rate_per_km}</span> per km.</>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Example: 100 km × 20 sacks = ₱{((100 / Number(businessInfo.shipping_base_km || 1)) * Number(businessInfo.shipping_rate_per_sack || 0) * 20).toLocaleString()} shipping fee
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* GCash Payment Settings */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/30">
          <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-2">
            <Smartphone size={18} className="text-blue-600 dark:text-blue-400" />
            GCash Payment Details
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            These details will be displayed in the GCash payment modal for customers, admins, secretaries, and super admins to reference when processing GCash payments.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FormInput
              label={<span className="flex items-center gap-1.5"><Smartphone size={14} /> GCash Account Name</span>}
              name="gcash_name"
              value={businessInfo.gcash_name}
              onChange={handleBusinessChange}
              placeholder="e.g. KJP Ricemill"
            />
            <FormInput
              label={<span className="flex items-center gap-1.5"><Phone size={14} /> GCash Number</span>}
              name="gcash_number"
              value={businessInfo.gcash_number}
              onChange={handleBusinessChange}
              placeholder="e.g. 09XX XXX XXXX"
            />
          </div>
          {/* QR Code Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <QrCode size={14} /> GCash QR Code
            </label>
            <div className="flex items-start gap-4">
              {/* QR Preview */}
              <div className="w-32 h-32 shrink-0 rounded-xl border-2 border-blue-200 dark:border-blue-700 overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center">
                {gcashQrPreview ? (
                  <img src={gcashQrPreview} alt="GCash QR Code" className="w-full h-full object-contain p-1" />
                ) : (
                  <QrCode size={48} className="text-blue-200 dark:text-blue-700" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Upload your GCash QR code image. This will be displayed beside the payment form so customers can scan it directly. (PNG, JPG - Max 5MB)
                </p>
                <input
                  ref={gcashQrInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleGcashQrChange}
                  className="hidden"
                />
                <Button variant="outline" size="sm" onClick={() => gcashQrInputRef.current?.click()}>
                  <Camera size={16} className="mr-1.5" />
                  {gcashQrPreview ? 'Change QR Code' : 'Upload QR Code'}
                </Button>
                {gcashQrFile && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                    <CheckCircle size={12} /> New QR code selected — will be uploaded when you save.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end pt-4 border-t border-primary-200 dark:border-primary-700">
          <Button onClick={handleSaveGeneral} disabled={businessSaving}>
            {businessSaving ? (
              <>
                <Loader2 size={16} className="mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="mr-1.5" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // Appearance Section
  const AppearanceSection = () => {
    const colorPresets = {
      green: ['#22c55e', '#16a34a', '#15803d', '#84cc16', '#65a30d'],
      blue: ['#3b82f6', '#2563eb', '#1d4ed8', '#06b6d4', '#0891b2'],
      purple: ['#8b5cf6', '#7c3aed', '#6d28d9', '#a855f7', '#9333ea'],
      red: ['#ef4444', '#dc2626', '#b91c1c', '#f97316', '#ea580c'],
      yellow: ['#eab308', '#ca8a04', '#a16207', '#facc15', '#fde047'],
      gray: ['#6b7280', '#4b5563', '#374151', '#9ca3af', '#d1d5db'],
    };

    return (
      <div className="space-y-6">
        {/* Theme Mode */}
        <div>
          <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Layout size={18} className="text-primary-500" />
            Theme Mode
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => updateTheme('mode', 'light')}
              className={`p-5 rounded-xl border-2 transition-all ${theme.mode === 'light' ? 'border-primary-500 bg-primary-50 dark:bg-gray-700 shadow-lg shadow-primary-100 dark:shadow-gray-900/30' : 'border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:border-primary-700'}`}
            >
              <Sun size={28} className={`mx-auto mb-2 ${theme.mode === 'light' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
              <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Light Mode</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Default light theme</p>
              {theme.mode === 'light' && <CheckCircle size={18} className="text-primary-500 mx-auto mt-2" />}
            </button>
            <button 
              onClick={() => updateTheme('mode', 'dark')}
              className={`p-5 rounded-xl border-2 transition-all ${theme.mode === 'dark' ? 'border-primary-500 bg-primary-50 dark:bg-gray-700 shadow-lg shadow-primary-100 dark:shadow-gray-900/30' : 'border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:border-primary-700'}`}
            >
              <Moon size={28} className={`mx-auto mb-2 ${theme.mode === 'dark' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
              <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Dark Mode</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Easier on the eyes</p>
              {theme.mode === 'dark' && <CheckCircle size={18} className="text-primary-500 mx-auto mt-2" />}
            </button>
          </div>
        </div>

        {/* Button, Border & Hover Colors - 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AppearanceColorPicker
            label="Button Color"
            description="All action buttons"
            icon={Square}
            value={theme.button_primary || '#7f0518'}
            onChange={(val) => updateTheme('button_primary', val)}
            presets={colorPresets.red}
          />
          <AppearanceColorPicker
            label="Border Color"
            description="Cards, inputs, dividers"
            icon={Square}
            value={theme.border_color || '#da2b2b'}
            onChange={(val) => updateTheme('border_color', val)}
            presets={[...colorPresets.red, ...colorPresets.purple.slice(0, 2)]}
          />
          <AppearanceColorPicker
            label="Hover Color"
            description="Table rows & buttons hover"
            icon={MousePointer}
            value={theme.hover_color || '#b22e5c'}
            onChange={(val) => updateTheme('hover_color', val)}
            presets={['#b22e5c', '#a12553', '#8b1e47', '#c2365e', '#d1426a', '#e05076']}
          />
        </div>

        {/* Background Colors - 4 columns */}
        <div>
          <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Layout size={18} className="text-primary-500" />
            Background Colors
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AppearanceColorPicker
              label="Body"
              description="Page background"
              icon={Paintbrush}
              value={theme.bg_body || '#f3f4f6'}
              onChange={(val) => updateTheme('bg_body', val)}
              presets={['#f3f4f6', '#f9fafb', '#e5e7eb', '#f0fdf4', '#ecfdf5']}
              compact
            />
            <AppearanceColorPicker
              label="Sidebar"
              description="Navigation bg"
              icon={Paintbrush}
              value={theme.bg_sidebar || '#ffffff'}
              onChange={(val) => updateTheme('bg_sidebar', val)}
              presets={['#ffffff', '#f9fafb', '#f3f4f6', '#f0fdf4', '#1e293b']}
              compact
            />
            <AppearanceColorPicker
              label="Content"
              description="Card background"
              icon={Paintbrush}
              value={theme.bg_content || '#ffffff'}
              onChange={(val) => updateTheme('bg_content', val)}
              presets={['#ffffff', '#f9fafb', '#fafafa', '#f0fdf4', '#ecfdf5']}
              compact
            />
            <AppearanceColorPicker
              label="Footer"
              description="Footer section"
              icon={Paintbrush}
              value={theme.bg_footer || '#111827'}
              onChange={(val) => updateTheme('bg_footer', val)}
              presets={['#111827', '#1f2937', '#0f172a', '#18181b', '#27272a']}
              compact
            />
          </div>
        </div>

        {/* Text Colors - 3 columns */}
        <div>
          <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Type size={18} className="text-primary-500" />
            Text Colors
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AppearanceColorPicker
              label="Content Text"
              description="Headings & body"
              icon={Type}
              value={theme.text_content || '#1f2937'}
              onChange={(val) => updateTheme('text_content', val)}
              presets={['#1f2937', '#111827', '#374151', '#0f172a', '#030712']}
              compact
            />
            <AppearanceColorPicker
              label="Secondary Text"
              description="Labels & hints"
              icon={Type}
              value={theme.text_secondary || '#6b7280'}
              onChange={(val) => updateTheme('text_secondary', val)}
              presets={['#6b7280', '#9ca3af', '#4b5563', '#374151', '#d1d5db']}
              compact
            />
            <AppearanceColorPicker
              label="Sidebar Text"
              description="Menu items"
              icon={Type}
              value={theme.text_sidebar || '#374151'}
              onChange={(val) => updateTheme('text_sidebar', val)}
              presets={['#374151', '#1f2937', '#111827', '#4b5563', '#6b7280']}
              compact
            />
          </div>
        </div>

        {/* Font Sizes - 2 columns */}
        <div>
          <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Type size={18} className="text-primary-500" />
            Font Sizes
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AppearanceFontSizeSlider
              label="Content Font"
              description="Base content size"
              icon={Type}
              value={theme.font_size_base || '12'}
              onChange={(val) => updateTheme('font_size_base', val)}
              min={12}
              max={22}
            />
            <AppearanceFontSizeSlider
              label="Sidebar Font"
              description="Menu item size"
              icon={Type}
              value={theme.font_size_sidebar || '12'}
              onChange={(val) => updateTheme('font_size_sidebar', val)}
              min={12}
              max={20}
            />
          </div>
        </div>

        {/* Preview & Actions - Combined */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl border-2 border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-gray-700/50">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300 mr-2">Preview:</span>
            <button 
              className="px-3 py-1.5 rounded-lg font-medium text-white text-sm shadow-sm"
              style={{ backgroundColor: theme.button_primary || '#7f0518' }}
            >
              Button
            </button>
            <div 
              className="px-3 py-1.5 rounded-lg font-medium text-sm shadow-sm"
              style={{ 
                backgroundColor: theme.bg_content || '#ffffff', 
                border: `2px solid ${theme.border_color || '#da2b2b'}`,
                color: theme.text_content || '#1f2937'
              }}
            >
              Card
            </div>
            <span 
              className="text-sm"
              style={{ color: theme.text_secondary || '#6b7280' }}
            >
              Secondary
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={async () => { 
                const result = await resetTheme(); 
                if (result.success) {
                  toast.info('Theme Reset', result.message);
                } else {
                  toast.error('Error', result.message);
                }
              }}
              disabled={saving}
            >
              <RotateCcw size={14} className="mr-1" />
              Reset
            </Button>
            <Button 
              size="sm"
              onClick={async () => {
                const result = await saveTheme();
                if (result.success) {
                  toast.success('Theme Saved', result.message);
                } else {
                  toast.error('Error', result.message);
                }
              }}
              disabled={saving}
            >
              <Save size={14} className="mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Information Section - Website Content Management
  const InformationSection = () => {
    const [savingHome, setSavingHome] = useState(false);
    const [savingAbout, setSavingAbout] = useState(false);
    const [savingProducts, setSavingProducts] = useState(false);
    const [savingContact, setSavingContact] = useState(false);
    const [savingLegal, setSavingLegal] = useState(false);
    const [uploadingHomeImage, setUploadingHomeImage] = useState(false);
    const [uploadingAboutImage, setUploadingAboutImage] = useState(false);
    const [uploadingProductsImage, setUploadingProductsImage] = useState(false);
    const [uploadingContactImage, setUploadingContactImage] = useState(false);
    const homeImageInputRef = useRef(null);
    const aboutImageInputRef = useRef(null);
    const productsImageInputRef = useRef(null);
    const contactImageInputRef = useRef(null);
    
    // Defaults per section
    const defaultHome = { heroTitle: '', heroTitleHighlight: '', heroSubtitle: '', heroTag: '', heroImage: null, aboutTitle: '', aboutDescription: '', aboutPoints: [], features: [], stats: [] };
    const defaultAbout = { heroTitle: '', heroTitleHighlight: '', heroSubtitle: '', heroImage: null, missionTitle: '', missionDescription: '', missionPoints: [], visionTitle: '', visionDescription: '', visionPoints: [], values: [], timeline: [], team: [] };
    const defaultProducts = { heroTag: '', heroTitle: '', heroSubtitle: '', heroImage: null, badges: [], ctaTitle: '', ctaDescription: '', ctaButtonText: '' };
    const defaultContact = { heroTag: '', heroTitle: '', heroSubtitle: '', heroImage: null, formTitle: '', faqs: [], socialTitle: '', socialDescription: '' };
    const defaultLegal = { termsLastUpdated: '', termsIntro: '', termsSections: [], privacyLastUpdated: '', privacyIntro: '', privacySections: [] };

    // Load from localStorage instantly so forms never start empty
    const getInitialInfoContent = () => {
      try {
        const saved = localStorage.getItem('kjp-info-content');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return null;
    };
    const cached = getInitialInfoContent();

    const [homeContent, setHomeContent] = useState({ ...defaultHome, ...(cached?.home || {}) });
    const [aboutContent, setAboutContent] = useState({ ...defaultAbout, ...(cached?.about || {}) });
    const [productsContent, setProductsContent] = useState({ ...defaultProducts, ...(cached?.products || {}) });
    const [contactContent, setContactContent] = useState({ ...defaultContact, ...(cached?.contact || {}) });
    const [legalContent, setLegalContent] = useState({ ...defaultLegal, ...(cached?.legal || {}) });

    // Fetch content from API in background (silent refresh, no flicker)
    useEffect(() => {
      const fetchContent = async () => {
        try {
          const result = await websiteContentApi.getAll();
          if (result.success && result.data) {
            if (result.data.home) setHomeContent(prev => ({ ...prev, ...result.data.home }));
            if (result.data.about) setAboutContent(prev => ({ ...prev, ...result.data.about }));
            if (result.data.products) setProductsContent(prev => ({ ...prev, ...result.data.products }));
            if (result.data.contact) setContactContent(prev => ({ ...prev, ...result.data.contact }));
            if (result.data.legal) setLegalContent(prev => ({ ...prev, ...result.data.legal }));
            // Persist for instant load next time
            localStorage.setItem('kjp-info-content', JSON.stringify(result.data));
          }
        } catch (error) {
          console.log('Using cached content');
        }
      };
      fetchContent();
    }, []);

    const handleSaveHome = async () => {
      setSavingHome(true);
      try {
        const result = await websiteContentApi.saveHomeContent(homeContent);
        if (result.success) {
          // Clear localStorage to force refresh on public pages
          localStorage.removeItem('kjp-home-content');
          localStorage.removeItem('kjp-info-content');
          toast.success('Home Content Saved', 'Homepage content has been updated successfully.');
        } else {
          toast.error('Error', result.message || 'Failed to save home content');
        }
      } catch (error) {
        toast.error('Error', 'Failed to connect to server');
      } finally {
        setSavingHome(false);
      }
    };

    const handleSaveAbout = async () => {
      setSavingAbout(true);
      try {
        const result = await websiteContentApi.saveAboutContent(aboutContent);
        if (result.success) {
          // Clear localStorage to force refresh on public pages
          localStorage.removeItem('kjp-about-content');
          localStorage.removeItem('kjp-info-content');
          toast.success('About Content Saved', 'About page content has been updated successfully.');
        } else {
          toast.error('Error', result.message || 'Failed to save about content');
        }
      } catch (error) {
        toast.error('Error', 'Failed to connect to server');
      } finally {
        setSavingAbout(false);
      }
    };

    const handleHomeHeroImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setUploadingHomeImage(true);
      try {
        const result = await websiteContentApi.uploadHeroImage(file, 'home');
        if (result.success || result.data?.success) {
          const imageUrl = result.data?.image_url || result.data?.data?.image_url;
          setHomeContent(prev => ({ ...prev, heroImage: imageUrl }));
          localStorage.removeItem('kjp-home-content');
          localStorage.removeItem('kjp-info-content');
          toast.success('Image Uploaded', 'Home hero image has been updated.');
        } else {
          toast.error('Error', result.data?.message || 'Failed to upload image');
        }
      } catch (error) {
        toast.error('Error', 'Failed to upload image');
      } finally {
        setUploadingHomeImage(false);
      }
    };

    const handleAboutHeroImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setUploadingAboutImage(true);
      try {
        const result = await websiteContentApi.uploadHeroImage(file, 'about');
        if (result.success || result.data?.success) {
          const imageUrl = result.data?.image_url || result.data?.data?.image_url;
          setAboutContent(prev => ({ ...prev, heroImage: imageUrl }));
          localStorage.removeItem('kjp-about-content');
          localStorage.removeItem('kjp-info-content');
          toast.success('Image Uploaded', 'About hero image has been updated.');
        } else {
          toast.error('Error', result.data?.message || 'Failed to upload image');
        }
      } catch (error) {
        toast.error('Error', 'Failed to upload image');
      } finally {
        setUploadingAboutImage(false);
      }
    };

    const handleSaveProducts = async () => {
      setSavingProducts(true);
      try {
        const result = await websiteContentApi.saveProductsContent(productsContent);
        if (result.success) {
          localStorage.removeItem('kjp-products-content');
          localStorage.removeItem('kjp-info-content');
          toast.success('Products Content Saved', 'Products page content has been updated successfully.');
        } else {
          toast.error('Error', result.message || 'Failed to save products content');
        }
      } catch (error) {
        toast.error('Error', 'Failed to connect to server');
      } finally {
        setSavingProducts(false);
      }
    };

    const handleSaveContact = async () => {
      setSavingContact(true);
      try {
        const result = await websiteContentApi.saveContactContent(contactContent);
        if (result.success) {
          localStorage.removeItem('kjp-contact-content');
          localStorage.removeItem('kjp-info-content');
          toast.success('Contact Content Saved', 'Contact page content has been updated successfully.');
        } else {
          toast.error('Error', result.message || 'Failed to save contact content');
        }
      } catch (error) {
        toast.error('Error', 'Failed to connect to server');
      } finally {
        setSavingContact(false);
      }
    };

    const handleProductsHeroImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setUploadingProductsImage(true);
      try {
        const result = await websiteContentApi.uploadHeroImage(file, 'products');
        if (result.success || result.data?.success) {
          const imageUrl = result.data?.image_url || result.data?.data?.image_url;
          setProductsContent(prev => ({ ...prev, heroImage: imageUrl }));
          localStorage.removeItem('kjp-products-content');
          localStorage.removeItem('kjp-info-content');
          toast.success('Image Uploaded', 'Products hero image has been updated.');
        } else {
          toast.error('Error', result.data?.message || 'Failed to upload image');
        }
      } catch (error) {
        toast.error('Error', 'Failed to upload image');
      } finally {
        setUploadingProductsImage(false);
      }
    };

    const handleContactHeroImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setUploadingContactImage(true);
      try {
        const result = await websiteContentApi.uploadHeroImage(file, 'contact');
        if (result.success || result.data?.success) {
          const imageUrl = result.data?.image_url || result.data?.data?.image_url;
          setContactContent(prev => ({ ...prev, heroImage: imageUrl }));
          localStorage.removeItem('kjp-contact-content');
          localStorage.removeItem('kjp-info-content');
          toast.success('Image Uploaded', 'Contact hero image has been updated.');
        } else {
          toast.error('Error', result.data?.message || 'Failed to upload image');
        }
      } catch (error) {
        toast.error('Error', 'Failed to upload image');
      } finally {
        setUploadingContactImage(false);
      }
    };

    const handleAddFeature = () => {
      setHomeContent({
        ...homeContent,
        features: [...homeContent.features, { title: 'New Feature', description: 'Feature description here' }],
      });
    };

    const handleRemoveFeature = (index) => {
      setHomeContent({
        ...homeContent,
        features: homeContent.features.filter((_, i) => i !== index),
      });
    };

    const handleUpdateFeature = (index, field, value) => {
      const updated = [...homeContent.features];
      updated[index][field] = value;
      setHomeContent({ ...homeContent, features: updated });
    };

    const handleAddTimeline = () => {
      setAboutContent({
        ...aboutContent,
        timeline: [...aboutContent.timeline, { year: '2025', title: 'New Milestone', description: 'Description here' }],
      });
    };

    const handleRemoveTimeline = (index) => {
      setAboutContent({
        ...aboutContent,
        timeline: aboutContent.timeline.filter((_, i) => i !== index),
      });
    };

    const handleAddValue = () => {
      setAboutContent({
        ...aboutContent,
        values: [...aboutContent.values, { title: 'New Value', description: 'Value description here' }],
      });
    };

    const handleRemoveValue = (index) => {
      setAboutContent({
        ...aboutContent,
        values: aboutContent.values.filter((_, i) => i !== index),
      });
    };

    const handleSaveLegal = async () => {
      setSavingLegal(true);
      try {
        const result = await websiteContentApi.saveLegalContent(legalContent);
        if (result.success) {
          localStorage.removeItem('kjp-info-content');
          toast.success('Legal Content Saved', 'Terms & Conditions and Privacy Policy have been updated successfully.');
        } else {
          toast.error('Error', result.message || 'Failed to save legal content');
        }
      } catch (error) {
        toast.error('Error', 'Failed to connect to server');
      } finally {
        setSavingLegal(false);
      }
    };

    return (
      <div className="space-y-6">
        {/* Tab Navigation - Scrollable on mobile, centered on desktop */}
        <div className="overflow-x-auto -mx-2 px-2 pb-1">
          <div className="flex md:justify-center min-w-max md:min-w-0">
          <div className="inline-flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1.5 gap-1">
            <button
              type="button"
              onClick={() => setActiveInfoTab('home')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeInfoTab === 'home'
                  ? 'bg-button-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-gray-600'
              }`}
            >
              <Home size={16} />
              Home Page
            </button>
            <button
              type="button"
              onClick={() => setActiveInfoTab('about')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeInfoTab === 'about'
                  ? 'bg-button-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-gray-600'
              }`}
            >
              <FileText size={16} />
              About Page
            </button>
            <button
              type="button"
              onClick={() => setActiveInfoTab('products')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeInfoTab === 'products'
                  ? 'bg-button-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-gray-600'
              }`}
            >
              <Package size={16} />
              Products Page
            </button>
            <button
              type="button"
              onClick={() => setActiveInfoTab('contact')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeInfoTab === 'contact'
                  ? 'bg-button-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-gray-600'
              }`}
            >
              <MessageCircle size={16} />
              Contact Page
            </button>
            <button
              type="button"
              onClick={() => setActiveInfoTab('legal')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeInfoTab === 'legal'
                  ? 'bg-button-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-gray-600'
              }`}
            >
              <Scale size={16} />
              Terms & Privacy
            </button>
          </div>
          </div>
        </div>

        {/* Home Page Content */}
        {activeInfoTab === 'home' && (
          <div className={`space-y-6 transition-opacity duration-200 ${savingHome ? 'opacity-60 pointer-events-none' : ''}`}>
            {/* Hero Section */}
            <div className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Target size={18} className="text-primary-600 dark:text-primary-400" />
                Hero Section
              </h4>
              
              {/* Hero Image Upload */}
              <div className="mb-4 p-4 bg-white dark:bg-gray-700 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-700">
                <div className="flex items-center gap-4">
                  <div className="w-32 h-20 bg-gray-100 dark:bg-gray-600 rounded-lg overflow-hidden flex-shrink-0">
                    {homeContent.heroImage ? (
                      <img src={getFullImageUrl(homeContent.heroImage)} alt="Hero" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-700 dark:text-gray-200 mb-1">Hero Background Image</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Upload an image for the hero section background (JPG, PNG, SVG, WebP - Max 10MB)</p>
                    <input
                      ref={homeImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/svg+xml,image/webp"
                      onChange={handleHomeHeroImageUpload}
                      className="hidden"
                      disabled={uploadingHomeImage}
                    />
                    <Button variant="outline" size="sm" onClick={() => homeImageInputRef.current?.click()} disabled={uploadingHomeImage}>
                      {uploadingHomeImage ? (
                        <>
                          <Loader2 size={14} className="mr-1.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Camera size={14} className="mr-1.5" />
                          Change Image
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput 
                  label="Hero Title" 
                  value={homeContent.heroTitle} 
                  onChange={(e) => setHomeContent({ ...homeContent, heroTitle: e.target.value })} 
                />
                <FormInput 
                  label="Hero Title Highlight" 
                  value={homeContent.heroTitleHighlight} 
                  onChange={(e) => setHomeContent({ ...homeContent, heroTitleHighlight: e.target.value })} 
                />
              </div>
              <FormInput 
                label="Hero Tag" 
                value={homeContent.heroTag} 
                onChange={(e) => setHomeContent({ ...homeContent, heroTag: e.target.value })} 
              />
              <FormTextarea 
                label="Hero Subtitle" 
                value={homeContent.heroSubtitle} 
                onChange={(e) => setHomeContent({ ...homeContent, heroSubtitle: e.target.value })} 
                rows={2}
              />
            </div>

            {/* Statistics */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-2">
                <Award size={18} className="text-primary-600 dark:text-primary-400" />
                Statistics
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Values are auto-calculated from real database records. You can customize the labels.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {homeContent.stats.map((stat, index) => (
                  <div key={index} className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Value <span className="text-gray-400">(Auto)</span></label>
                      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-600 rounded-lg border-2 border-primary-200 dark:border-primary-600 text-sm font-semibold text-gray-700 dark:text-gray-200 cursor-not-allowed">
                        {stat.value}
                      </div>
                    </div>
                    <FormInput 
                      label="Label" 
                      value={stat.label} 
                      onChange={(e) => {
                        const updated = [...homeContent.stats];
                        updated[index].label = e.target.value;
                        setHomeContent({ ...homeContent, stats: updated });
                      }} 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Shield size={18} className="text-primary-600 dark:text-primary-400" />
                  Features ({homeContent.features.length})
                </h4>
                <Button size="sm" variant="outline" onClick={handleAddFeature}>
                  <Plus size={14} className="mr-1" /> Add Feature
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {homeContent.features.map((feature, index) => (
                  <div key={index} className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 relative">
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(index)}
                      className="absolute top-2 right-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"
                    >
                      <X size={14} />
                    </button>
                    <FormInput 
                      label="Title" 
                      value={feature.title} 
                      onChange={(e) => handleUpdateFeature(index, 'title', e.target.value)} 
                    />
                    <FormTextarea 
                      label="Description" 
                      value={feature.description} 
                      onChange={(e) => handleUpdateFeature(index, 'description', e.target.value)} 
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* About Preview Section */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Eye size={18} className="text-primary-600 dark:text-primary-400" />
                About Preview Section (on Home)
              </h4>
              <FormInput 
                label="About Title" 
                value={homeContent.aboutTitle} 
                onChange={(e) => setHomeContent({ ...homeContent, aboutTitle: e.target.value })} 
              />
              <FormTextarea 
                label="About Description" 
                value={homeContent.aboutDescription} 
                onChange={(e) => setHomeContent({ ...homeContent, aboutDescription: e.target.value })} 
                rows={3}
              />
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">About Points</label>
                {homeContent.aboutPoints.map((point, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={point}
                      onChange={(e) => {
                        const updated = [...homeContent.aboutPoints];
                        updated[index] = e.target.value;
                        setHomeContent({ ...homeContent, aboutPoints: updated });
                      }}
                      className="flex-1 px-3 py-2 border-2 border-primary-200 dark:border-primary-700 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-button-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-primary-200 dark:border-primary-700">
              <Button onClick={handleSaveHome} disabled={savingHome}>
                {savingHome ? (
                  <><Loader2 size={16} className="mr-1.5 animate-spin" /> Saving...</>
                ) : (
                  <><Save size={16} className="mr-1.5" /> Save Home Content</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* About Page Content */}
        {activeInfoTab === 'about' && (
          <div className={`space-y-6 transition-opacity duration-200 ${savingAbout ? 'opacity-60 pointer-events-none' : ''}`}>
            {/* Hero Section */}
            <div className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Target size={18} className="text-primary-600 dark:text-primary-400" />
                About Hero Section
              </h4>
              
              {/* Hero Image Upload */}
              <div className="mb-4 p-4 bg-white dark:bg-gray-700 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-700">
                <div className="flex items-center gap-4">
                  <div className="w-32 h-20 bg-gray-100 dark:bg-gray-600 rounded-lg overflow-hidden flex-shrink-0">
                    {aboutContent.heroImage ? (
                      <img src={getFullImageUrl(aboutContent.heroImage)} alt="Hero" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-700 dark:text-gray-200 mb-1">Hero Background Image</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Upload an image for the hero section background (JPG, PNG, SVG, WebP - Max 10MB)</p>
                    <input
                      ref={aboutImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/svg+xml,image/webp"
                      onChange={handleAboutHeroImageUpload}
                      className="hidden"
                      disabled={uploadingAboutImage}
                    />
                    <Button variant="outline" size="sm" onClick={() => aboutImageInputRef.current?.click()} disabled={uploadingAboutImage}>
                      {uploadingAboutImage ? (
                        <>
                          <Loader2 size={14} className="mr-1.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Camera size={14} className="mr-1.5" />
                          Change Image
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput 
                  label="Hero Title" 
                  value={aboutContent.heroTitle} 
                  onChange={(e) => setAboutContent({ ...aboutContent, heroTitle: e.target.value })} 
                />
                <FormInput 
                  label="Hero Title Highlight" 
                  value={aboutContent.heroTitleHighlight} 
                  onChange={(e) => setAboutContent({ ...aboutContent, heroTitleHighlight: e.target.value })} 
                />
              </div>
              <FormTextarea 
                label="Hero Subtitle" 
                value={aboutContent.heroSubtitle} 
                onChange={(e) => setAboutContent({ ...aboutContent, heroSubtitle: e.target.value })} 
                rows={2}
              />
            </div>

            {/* Mission & Vision */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
                <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Target size={18} className="text-primary-600 dark:text-primary-400" />
                  Mission
                </h4>
                <FormInput 
                  label="Mission Title" 
                  value={aboutContent.missionTitle} 
                  onChange={(e) => setAboutContent({ ...aboutContent, missionTitle: e.target.value })} 
                />
                <FormTextarea 
                  label="Mission Description" 
                  value={aboutContent.missionDescription} 
                  onChange={(e) => setAboutContent({ ...aboutContent, missionDescription: e.target.value })} 
                  rows={3}
                />
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Mission Points</label>
                  {aboutContent.missionPoints.map((point, index) => (
                    <input
                      key={index}
                      type="text"
                      value={point}
                      onChange={(e) => {
                        const updated = [...aboutContent.missionPoints];
                        updated[index] = e.target.value;
                        setAboutContent({ ...aboutContent, missionPoints: updated });
                      }}
                      className="w-full px-3 py-2 mb-2 border-2 border-primary-200 dark:border-primary-700 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-button-500"
                    />
                  ))}
                </div>
              </div>

              <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
                <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Eye size={18} className="text-primary-600 dark:text-primary-400" />
                  Vision
                </h4>
                <FormInput 
                  label="Vision Title" 
                  value={aboutContent.visionTitle} 
                  onChange={(e) => setAboutContent({ ...aboutContent, visionTitle: e.target.value })} 
                />
                <FormTextarea 
                  label="Vision Description" 
                  value={aboutContent.visionDescription} 
                  onChange={(e) => setAboutContent({ ...aboutContent, visionDescription: e.target.value })} 
                  rows={3}
                />
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Vision Points</label>
                  {aboutContent.visionPoints.map((point, index) => (
                    <input
                      key={index}
                      type="text"
                      value={point}
                      onChange={(e) => {
                        const updated = [...aboutContent.visionPoints];
                        updated[index] = e.target.value;
                        setAboutContent({ ...aboutContent, visionPoints: updated });
                      }}
                      className="w-full px-3 py-2 mb-2 border-2 border-primary-200 dark:border-primary-700 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-button-500"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Core Values */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Heart size={18} className="text-primary-600 dark:text-primary-400" />
                  Core Values ({aboutContent.values.length})
                </h4>
                <Button size="sm" variant="outline" onClick={handleAddValue}>
                  <Plus size={14} className="mr-1" /> Add Value
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aboutContent.values.map((value, index) => (
                  <div key={index} className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 relative">
                    <button
                      type="button"
                      onClick={() => handleRemoveValue(index)}
                      className="absolute top-2 right-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"
                    >
                      <X size={14} />
                    </button>
                    <FormInput 
                      label="Value Title" 
                      value={value.title} 
                      onChange={(e) => {
                        const updated = [...aboutContent.values];
                        updated[index].title = e.target.value;
                        setAboutContent({ ...aboutContent, values: updated });
                      }} 
                    />
                    <FormTextarea 
                      label="Description" 
                      value={value.description} 
                      onChange={(e) => {
                        const updated = [...aboutContent.values];
                        updated[index].description = e.target.value;
                        setAboutContent({ ...aboutContent, values: updated });
                      }} 
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Calendar size={18} className="text-primary-600 dark:text-primary-400" />
                  Company Timeline ({aboutContent.timeline.length})
                </h4>
                <Button size="sm" variant="outline" onClick={handleAddTimeline}>
                  <Plus size={14} className="mr-1" /> Add Milestone
                </Button>
              </div>
              <div className="space-y-4">
                {aboutContent.timeline.map((item, index) => (
                  <div key={index} className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 relative">
                    <button
                      type="button"
                      onClick={() => handleRemoveTimeline(index)}
                      className="absolute top-2 right-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"
                    >
                      <X size={14} />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FormInput 
                        label="Year" 
                        value={item.year} 
                        onChange={(e) => {
                          const updated = [...aboutContent.timeline];
                          updated[index].year = e.target.value;
                          setAboutContent({ ...aboutContent, timeline: updated });
                        }} 
                      />
                      <FormInput 
                        label="Title" 
                        value={item.title} 
                        onChange={(e) => {
                          const updated = [...aboutContent.timeline];
                          updated[index].title = e.target.value;
                          setAboutContent({ ...aboutContent, timeline: updated });
                        }} 
                      />
                      <div className="md:col-span-2">
                        <FormInput 
                          label="Description" 
                          value={item.description} 
                          onChange={(e) => {
                            const updated = [...aboutContent.timeline];
                            updated[index].description = e.target.value;
                            setAboutContent({ ...aboutContent, timeline: updated });
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Members */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Users size={18} className="text-primary-600 dark:text-primary-400" />
                  Team Members ({aboutContent.team.length})
                </h4>
                <Button size="sm" variant="outline" onClick={() => setAboutContent({ ...aboutContent, team: [...aboutContent.team, { name: '', role: '' }] })}>
                  <Plus size={14} className="mr-1" /> Add Member
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {aboutContent.team.map((member, index) => (
                  <div key={index} className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 relative group">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = aboutContent.team.filter((_, i) => i !== index);
                        setAboutContent({ ...aboutContent, team: updated });
                      }}
                      className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove member"
                    >
                      <X size={14} />
                    </button>
                    <FormInput 
                      label="Name" 
                      value={member.name} 
                      onChange={(e) => {
                        const updated = [...aboutContent.team];
                        updated[index].name = e.target.value;
                        setAboutContent({ ...aboutContent, team: updated });
                      }} 
                    />
                    <FormInput 
                      label="Role" 
                      value={member.role} 
                      onChange={(e) => {
                        const updated = [...aboutContent.team];
                        updated[index].role = e.target.value;
                        setAboutContent({ ...aboutContent, team: updated });
                      }} 
                    />
                  </div>
                ))}
              </div>
              {aboutContent.team.length === 0 && (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-6">No team members added. Click "Add Member" to get started.</p>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-primary-200 dark:border-primary-700">
              <Button onClick={handleSaveAbout} disabled={savingAbout}>
                {savingAbout ? (
                  <><Loader2 size={16} className="mr-1.5 animate-spin" /> Saving...</>
                ) : (
                  <><Save size={16} className="mr-1.5" /> Save About Content</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Products Page Content */}
        {activeInfoTab === 'products' && (
          <div className={`space-y-6 transition-opacity duration-200 ${savingProducts ? 'opacity-60 pointer-events-none' : ''}`}>
            {/* Hero Section */}
            <div className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Target size={18} className="text-primary-600 dark:text-primary-400" />
                Products Hero Section
              </h4>
              
              {/* Hero Image Upload */}
              <div className="mb-4 p-4 bg-white dark:bg-gray-700 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-700">
                <div className="flex items-center gap-4">
                  <div className="w-32 h-20 bg-gray-100 dark:bg-gray-600 rounded-lg overflow-hidden flex-shrink-0">
                    {productsContent.heroImage ? (
                      <img src={getFullImageUrl(productsContent.heroImage)} alt="Hero" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-700 dark:text-gray-200 mb-1">Hero Background Image</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Upload an image for the hero section background (JPG, PNG, SVG, WebP - Max 10MB)</p>
                    <input
                      ref={productsImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/svg+xml,image/webp"
                      onChange={handleProductsHeroImageUpload}
                      className="hidden"
                      disabled={uploadingProductsImage}
                    />
                    <Button variant="outline" size="sm" onClick={() => productsImageInputRef.current?.click()} disabled={uploadingProductsImage}>
                      {uploadingProductsImage ? (
                        <>
                          <Loader2 size={14} className="mr-1.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Camera size={14} className="mr-1.5" />
                          Change Image
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              <FormInput 
                label="Hero Tag" 
                value={productsContent.heroTag} 
                onChange={(e) => setProductsContent({ ...productsContent, heroTag: e.target.value })} 
              />
              <FormInput 
                label="Hero Title" 
                value={productsContent.heroTitle} 
                onChange={(e) => setProductsContent({ ...productsContent, heroTitle: e.target.value })} 
              />
              <FormTextarea 
                label="Hero Subtitle" 
                value={productsContent.heroSubtitle} 
                onChange={(e) => setProductsContent({ ...productsContent, heroSubtitle: e.target.value })} 
                rows={2}
              />
            </div>

            {/* Feature Badges */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Award size={18} className="text-primary-600 dark:text-primary-400" />
                  Feature Badges ({productsContent.badges.length})
                </h4>
                <Button size="sm" variant="outline" onClick={() => setProductsContent({ ...productsContent, badges: [...productsContent.badges, { title: 'New Badge', icon: 'Award' }] })}>
                  <Plus size={14} className="mr-1" /> Add Badge
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {productsContent.badges.map((badge, index) => (
                  <div key={index} className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 relative">
                    <button
                      type="button"
                      onClick={() => setProductsContent({ ...productsContent, badges: productsContent.badges.filter((_, i) => i !== index) })}
                      className="absolute top-2 right-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"
                    >
                      <X size={14} />
                    </button>
                    <FormInput 
                      label="Badge Text" 
                      value={badge.title} 
                      onChange={(e) => {
                        const updated = [...productsContent.badges];
                        updated[index].title = e.target.value;
                        setProductsContent({ ...productsContent, badges: updated });
                      }} 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Section */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Shield size={18} className="text-primary-600 dark:text-primary-400" />
                Call-to-Action Section
              </h4>
              <FormInput 
                label="CTA Title" 
                value={productsContent.ctaTitle} 
                onChange={(e) => setProductsContent({ ...productsContent, ctaTitle: e.target.value })} 
              />
              <FormTextarea 
                label="CTA Description" 
                value={productsContent.ctaDescription} 
                onChange={(e) => setProductsContent({ ...productsContent, ctaDescription: e.target.value })} 
                rows={2}
              />
              <FormInput 
                label="CTA Button Text" 
                value={productsContent.ctaButtonText} 
                onChange={(e) => setProductsContent({ ...productsContent, ctaButtonText: e.target.value })} 
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-primary-200 dark:border-primary-700">
              <Button onClick={handleSaveProducts} disabled={savingProducts}>
                {savingProducts ? (
                  <><Loader2 size={16} className="mr-1.5 animate-spin" /> Saving...</>
                ) : (
                  <><Save size={16} className="mr-1.5" /> Save Products Content</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Contact Page Content */}
        {activeInfoTab === 'contact' && (
          <div className={`space-y-6 transition-opacity duration-200 ${savingContact ? 'opacity-60 pointer-events-none' : ''}`}>
            {/* Hero Section */}
            <div className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Target size={18} className="text-primary-600 dark:text-primary-400" />
                Contact Hero Section
              </h4>
              
              {/* Hero Image Upload */}
              <div className="mb-4 p-4 bg-white dark:bg-gray-700 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-700">
                <div className="flex items-center gap-4">
                  <div className="w-32 h-20 bg-gray-100 dark:bg-gray-600 rounded-lg overflow-hidden flex-shrink-0">
                    {contactContent.heroImage ? (
                      <img src={getFullImageUrl(contactContent.heroImage)} alt="Hero" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-700 dark:text-gray-200 mb-1">Hero Background Image</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Upload an image for the hero section background (JPG, PNG, SVG, WebP - Max 10MB)</p>
                    <input
                      ref={contactImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/svg+xml,image/webp"
                      onChange={handleContactHeroImageUpload}
                      className="hidden"
                      disabled={uploadingContactImage}
                    />
                    <Button variant="outline" size="sm" onClick={() => contactImageInputRef.current?.click()} disabled={uploadingContactImage}>
                      {uploadingContactImage ? (
                        <>
                          <Loader2 size={14} className="mr-1.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Camera size={14} className="mr-1.5" />
                          Change Image
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              <FormInput 
                label="Hero Tag" 
                value={contactContent.heroTag} 
                onChange={(e) => setContactContent({ ...contactContent, heroTag: e.target.value })} 
              />
              <FormInput 
                label="Hero Title" 
                value={contactContent.heroTitle} 
                onChange={(e) => setContactContent({ ...contactContent, heroTitle: e.target.value })} 
              />
              <FormTextarea 
                label="Hero Subtitle" 
                value={contactContent.heroSubtitle} 
                onChange={(e) => setContactContent({ ...contactContent, heroSubtitle: e.target.value })} 
                rows={2}
              />
            </div>

            {/* Form Section */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Edit3 size={18} className="text-primary-600 dark:text-primary-400" />
                Form Section
              </h4>
              <FormInput 
                label="Form Title" 
                value={contactContent.formTitle} 
                onChange={(e) => setContactContent({ ...contactContent, formTitle: e.target.value })} 
              />
            </div>

            {/* FAQs */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Info size={18} className="text-primary-600 dark:text-primary-400" />
                  FAQs ({contactContent.faqs.length})
                </h4>
                <Button size="sm" variant="outline" onClick={() => setContactContent({ ...contactContent, faqs: [...contactContent.faqs, { question: 'New Question?', answer: 'Answer here' }] })}>
                  <Plus size={14} className="mr-1" /> Add FAQ
                </Button>
              </div>
              <div className="space-y-4">
                {contactContent.faqs.map((faq, index) => (
                  <div key={index} className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 relative">
                    <button
                      type="button"
                      onClick={() => setContactContent({ ...contactContent, faqs: contactContent.faqs.filter((_, i) => i !== index) })}
                      className="absolute top-2 right-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"
                    >
                      <X size={14} />
                    </button>
                    <FormInput 
                      label="Question" 
                      value={faq.question} 
                      onChange={(e) => {
                        const updated = [...contactContent.faqs];
                        updated[index].question = e.target.value;
                        setContactContent({ ...contactContent, faqs: updated });
                      }} 
                    />
                    <FormTextarea 
                      label="Answer" 
                      value={faq.answer} 
                      onChange={(e) => {
                        const updated = [...contactContent.faqs];
                        updated[index].answer = e.target.value;
                        setContactContent({ ...contactContent, faqs: updated });
                      }} 
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Social Section */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Share2 size={18} className="text-primary-600 dark:text-primary-400" />
                Social Section
              </h4>
              <FormInput 
                label="Social Title" 
                value={contactContent.socialTitle} 
                onChange={(e) => setContactContent({ ...contactContent, socialTitle: e.target.value })} 
              />
              <FormTextarea 
                label="Social Description" 
                value={contactContent.socialDescription} 
                onChange={(e) => setContactContent({ ...contactContent, socialDescription: e.target.value })} 
                rows={2}
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-primary-200 dark:border-primary-700">
              <Button onClick={handleSaveContact} disabled={savingContact}>
                {savingContact ? (
                  <><Loader2 size={16} className="mr-1.5 animate-spin" /> Saving...</>
                ) : (
                  <><Save size={16} className="mr-1.5" /> Save Contact Content</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Legal Content — Terms & Conditions and Privacy Policy */}
        {activeInfoTab === 'legal' && (
          <div className={`space-y-6 transition-opacity duration-200 ${savingLegal ? 'opacity-60 pointer-events-none' : ''}`}>
            {/* Terms and Conditions */}
            <div className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Scale size={18} className="text-primary-600 dark:text-primary-400" />
                Terms and Conditions
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FormInput
                  label="Last Updated Date"
                  value={legalContent.termsLastUpdated}
                  onChange={(e) => setLegalContent({ ...legalContent, termsLastUpdated: e.target.value })}
                  placeholder="e.g. January 1, 2026"
                />
              </div>
              <FormTextarea
                label="Introduction Text"
                value={legalContent.termsIntro}
                onChange={(e) => setLegalContent({ ...legalContent, termsIntro: e.target.value })}
                rows={2}
                placeholder="Brief introduction shown before the terms sections..."
              />
            </div>

            {/* Terms Sections */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <FileText size={18} className="text-primary-600 dark:text-primary-400" />
                  Terms Sections ({legalContent.termsSections.length})
                </h4>
                <Button size="sm" variant="outline" onClick={() => setLegalContent({ ...legalContent, termsSections: [...legalContent.termsSections, { title: 'New Section', content: 'Section content here...' }] })}>
                  <Plus size={14} className="mr-1" /> Add Section
                </Button>
              </div>
              <div className="space-y-4">
                {legalContent.termsSections.map((section, index) => (
                  <div key={index} className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 relative">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-500 w-6">{index + 1}.</span>
                      <div className="flex-1">
                        <FormInput
                          label="Section Title"
                          value={section.title}
                          onChange={(e) => {
                            const updated = [...legalContent.termsSections];
                            updated[index] = { ...updated[index], title: e.target.value };
                            setLegalContent({ ...legalContent, termsSections: updated });
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setLegalContent({ ...legalContent, termsSections: legalContent.termsSections.filter((_, i) => i !== index) })}
                        className="absolute top-2 right-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <FormTextarea
                      label="Content"
                      value={section.content}
                      onChange={(e) => {
                        const updated = [...legalContent.termsSections];
                        updated[index] = { ...updated[index], content: e.target.value };
                        setLegalContent({ ...legalContent, termsSections: updated });
                      }}
                      rows={3}
                    />
                  </div>
                ))}
                {legalContent.termsSections.length === 0 && (
                  <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">No terms sections yet. Click "Add Section" to create one.</p>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 border-t-2 border-primary-200 dark:border-primary-700" />
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Privacy Policy</span>
              <div className="flex-1 border-t-2 border-primary-200 dark:border-primary-700" />
            </div>

            {/* Privacy Policy */}
            <div className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary-600 dark:text-primary-400" />
                Privacy Policy
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FormInput
                  label="Last Updated Date"
                  value={legalContent.privacyLastUpdated}
                  onChange={(e) => setLegalContent({ ...legalContent, privacyLastUpdated: e.target.value })}
                  placeholder="e.g. January 1, 2026"
                />
              </div>
              <FormTextarea
                label="Introduction Text"
                value={legalContent.privacyIntro}
                onChange={(e) => setLegalContent({ ...legalContent, privacyIntro: e.target.value })}
                rows={2}
                placeholder="Brief introduction shown before the privacy sections..."
              />
            </div>

            {/* Privacy Sections */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <FileText size={18} className="text-primary-600 dark:text-primary-400" />
                  Privacy Sections ({legalContent.privacySections.length})
                </h4>
                <Button size="sm" variant="outline" onClick={() => setLegalContent({ ...legalContent, privacySections: [...legalContent.privacySections, { title: 'New Section', content: 'Section content here...' }] })}>
                  <Plus size={14} className="mr-1" /> Add Section
                </Button>
              </div>
              <div className="space-y-4">
                {legalContent.privacySections.map((section, index) => (
                  <div key={index} className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 relative">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-500 w-6">{index + 1}.</span>
                      <div className="flex-1">
                        <FormInput
                          label="Section Title"
                          value={section.title}
                          onChange={(e) => {
                            const updated = [...legalContent.privacySections];
                            updated[index] = { ...updated[index], title: e.target.value };
                            setLegalContent({ ...legalContent, privacySections: updated });
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setLegalContent({ ...legalContent, privacySections: legalContent.privacySections.filter((_, i) => i !== index) })}
                        className="absolute top-2 right-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <FormTextarea
                      label="Content"
                      value={section.content}
                      onChange={(e) => {
                        const updated = [...legalContent.privacySections];
                        updated[index] = { ...updated[index], content: e.target.value };
                        setLegalContent({ ...legalContent, privacySections: updated });
                      }}
                      rows={3}
                    />
                  </div>
                ))}
                {legalContent.privacySections.length === 0 && (
                  <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">No privacy sections yet. Click "Add Section" to create one.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-primary-200 dark:border-primary-700">
              <Button onClick={handleSaveLegal} disabled={savingLegal}>
                {savingLegal ? (
                  <><Loader2 size={16} className="mr-1.5 animate-spin" /> Saving...</>
                ) : (
                  <><Save size={16} className="mr-1.5" /> Save Terms & Privacy</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Data Section
  const DataSection = () => {
    const [dbInfo, setDbInfo] = useState(null);
    const [loadingInfo, setLoadingInfo] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportingCsv, setExportingCsv] = useState(false);
    const [importing, setImporting] = useState(false);
    const importFileRef = useRef(null);
    const [importTable, setImportTable] = useState('products');

    const importableTables = [
      { value: 'products', label: 'Products' },
      { value: 'varieties', label: 'Varieties' },
      { value: 'customers', label: 'Customers' },
      { value: 'suppliers', label: 'Suppliers' },
      { value: 'procurements', label: 'Procurements' },
      { value: 'processings', label: 'Processings' },
      { value: 'drying_processes', label: 'Drying Processes' },
      { value: 'stock_logs', label: 'Stock Logs' },
      { value: 'orders', label: 'Orders' },
    ];

    const fetchDatabaseInfo = async () => {
      setLoadingInfo(true);
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/database/info`, {
          headers: {
            'Accept': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        });
        if (response.ok) {
          const data = await response.json();
          setDbInfo(data);
        } else {
          toast.error('Error', 'Failed to fetch database info');
        }
      } catch (error) {
        console.error('Error fetching database info:', error);
        toast.error('Error', 'Could not connect to server');
      } finally {
        setLoadingInfo(false);
      }
    };

    const handleExportSQL = async () => {
      setExporting(true);
      toast.info('Export Started', 'Preparing your database backup...');
      
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/database/export`, {
          headers: {
            'Accept': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const contentDisposition = response.headers.get('Content-Disposition');
          let filename = 'backup.sql';
          
          if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
          }
          
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          toast.success('Export Complete', `Database backup saved as ${filename}`);
        } else {
          toast.error('Export Failed', 'Could not export database');
        }
      } catch (error) {
        console.error('Export error:', error);
        toast.error('Export Failed', 'An error occurred during export');
      } finally {
        setExporting(false);
      }
    };

    const handleExportCSV = async () => {
      setExportingCsv(true);
      toast.info('Export Started', 'Preparing CSV export...');
      
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/database/export-csv`, {
          headers: {
            'Accept': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const contentDisposition = response.headers.get('Content-Disposition');
          let filename = 'data_export.zip';
          
          if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
          }
          
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          toast.success('Export Complete', `CSV data exported as ${filename}`);
        } else {
          toast.error('Export Failed', 'Could not export CSV data');
        }
      } catch (error) {
        console.error('CSV export error:', error);
        toast.error('Export Failed', 'An error occurred during CSV export');
      } finally {
        setExportingCsv(false);
      }
    };

    const handleImportCSV = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setImporting(true);
      toast.info('Import Started', `Importing ${file.name} into ${importTable}...`);
      
      try {
        const token = localStorage.getItem('auth_token');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('table', importTable);
        
        const response = await fetch(`${API_BASE_URL}/database/import-csv`, {
          method: 'POST',
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: formData,
        });
        
        const data = await response.json();
        
        if (response.ok) {
          toast.success('Import Complete', data.message);
        } else {
          toast.error('Import Failed', data.message || 'Could not import data');
        }
      } catch (error) {
        console.error('Import error:', error);
        toast.error('Import Failed', 'An error occurred during import');
      } finally {
        setImporting(false);
        if (importFileRef.current) importFileRef.current.value = '';
      }
    };

    // Fetch database info on mount
    useEffect(() => {
      fetchDatabaseInfo();
    }, []);

    return (
      <div className="space-y-6">
        {/* Database Backup */}
        <div className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border-2 border-primary-200 dark:border-primary-700">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary-500 rounded-xl">
              <Database size={28} className="text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Database Backup (.SQL)</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Export your entire database as a .sql file. This backup includes all tables, 
                structure, and data which can be restored using phpMyAdmin or MySQL command line.
              </p>
              
              {/* Database Info */}
              {dbInfo && (
                <div className="mb-4 p-3 bg-white/70 dark:bg-gray-700/70 rounded-lg border border-primary-200 dark:border-primary-700">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Database:</span>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{dbInfo.database}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Tables:</span>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{dbInfo.tables_count}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Total Rows:</span>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{dbInfo.total_rows?.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Size:</span>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{dbInfo.total_size}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <Button 
                  variant="primary" 
                  onClick={handleExportSQL}
                  disabled={exporting}
                >
                  {exporting ? (
                    <>
                      <Loader2 size={16} className="mr-1.5 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download size={16} className="mr-1.5" />
                      Export SQL Backup
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={fetchDatabaseInfo}
                  disabled={loadingInfo}
                >
                  {loadingInfo ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CSV Export */}
          <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
            <Download size={32} className="text-primary-600 dark:text-primary-400 mb-3" />
            <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Export Data (CSV)</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Download all business data as a ZIP of CSV files</p>
            <Button variant="outline" onClick={handleExportCSV} disabled={exportingCsv}>
              {exportingCsv ? (
                <>
                  <Loader2 size={16} className="mr-1.5 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={16} className="mr-1.5" />
                  Export as CSV
                </>
              )}
            </Button>
          </div>

          {/* CSV Import */}
          <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700">
            <Upload size={32} className="text-blue-600 dark:text-blue-400 mb-3" />
            <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Import Data</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Import data from a CSV file into a table</p>
            <div className="mb-3">
              <FormSelect
                label="Target Table"
                value={importTable}
                onChange={(e) => setImportTable(e.target.value)}
                options={importableTables}
              />
            </div>
            <input
              ref={importFileRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
            <Button variant="outline" onClick={() => importFileRef.current?.click()} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 size={16} className="mr-1.5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={16} className="mr-1.5" />
                  Select CSV File
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'general': return renderGeneralSection();
      case 'profile': return <ProfileSectionComponent profileInfo={profileInfo} handleProfileChange={handleProfileChange} handleSaveProfile={handleSaveProfile} isCheckingEmail={isCheckingProfileEmail} emailError={profileEmailError} />;
      case 'security': return <SecuritySectionComponent securityInfo={securityInfo} showPassword={showPassword} setShowPassword={setShowPassword} handleSecurityChange={handleSecurityChange} handleSaveSecurity={handleSaveSecurity} />;
      case 'appearance': return <AppearanceSection />;
      case 'information': return <InformationSection />;
      case 'data': return <DataSection />;
      case 'accounts': return <AdminAccounts />;
      case 'audit-trail': return <AuditTrail />;
      case 'archives': return <Archives />;
      default: return renderGeneralSection();
    }
  };

  const currentSection = settingsSections.find(s => s.id === activeSection);

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account and application preferences" icon={SettingsIcon} />

      {/* Horizontal Navigation Tabs */}
      <Card className="mb-6">
        <CardContent className="p-2">
          <nav className="flex flex-wrap gap-1">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  activeSection === section.id 
                    ? 'bg-button-500 text-white shadow-md' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-button-100 hover:text-button-700 dark:text-button-300'
                }`}
              >
                <section.icon size={18} className={activeSection === section.id ? 'text-white' : 'text-gray-400 dark:text-gray-500 dark:text-gray-400 group-hover:text-button-600 dark:hover:text-button-400 dark:text-button-400'} />
                <span className="font-medium text-sm">{section.title}</span>
              </button>
            ))}
          </nav>
        </CardContent>
      </Card>

      {/* Settings Content */}
      {activeSection === 'audit-trail' || activeSection === 'archives' || activeSection === 'accounts' ? (
        /* Audit Trail & Archives render as full-page components */
        renderContent()
      ) : (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-primary-200 dark:border-primary-700">
            <div className="p-2.5 bg-primary-50 dark:bg-gray-700 rounded-xl">
              <currentSection.icon size={24} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{currentSection.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{currentSection.description}</p>
            </div>
          </div>
          {renderContent()}
        </CardContent>
      </Card>
      )}

      {/* Password Verification Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Lock size={24} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Verify Your Identity</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {pendingProfileData?.type === 'business_email' 
                    ? 'Enter your current account password to proceed with email change' 
                    : 'Enter your current account password to proceed with email change'}
                </p>
              </div>
            </div>
            
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> After changing your email, you'll need to configure a new Gmail App Password for the new email address in the SMTP settings.
              </p>
            </div>
            
            <div className="mb-6">
              <FormInput
                label="Current Account Password"
                type="password"
                value={passwordForEmailChange}
                onChange={(e) => setPasswordForEmailChange(e.target.value)}
                placeholder="Enter your current account password"
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordVerification()}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCancelPasswordVerification} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handlePasswordVerification} className="flex-1" disabled={businessSaving}>
                {businessSaving ? (
                  <>
                    <Loader2 size={16} className="mr-1.5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Lock size={16} className="mr-1.5" />
                    Verify & Continue
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Email Verification Modal */}
      {showEmailVerificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Mail size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Verify Your Email</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Enter the 6-digit code sent to your new email</p>
              </div>
            </div>
            
            <div className="mb-4">
              <FormInput
                label="Verification Code"
                type="text"
                value={emailVerificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setEmailVerificationCode(value);
                  setVerificationError('');
                }}
                placeholder="000000"
                maxLength={6}
                onKeyPress={(e) => e.key === 'Enter' && handleEmailVerification()}
                autoFocus
                className="text-center text-2xl tracking-widest font-mono"
              />
              {verificationError && (
                <p className="text-sm text-red-500 mt-2">{verificationError}</p>
              )}
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                The verification code expires in 15 minutes. You have {5 - verificationAttempts} attempt(s) remaining.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCancelEmailVerification} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleEmailVerification} className="flex-1" disabled={emailVerificationCode.length !== 6 || verificationAttempts >= 5}>
                <CheckCircle size={16} className="mr-1.5" />
                Verify
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New SMTP Password Modal (After Email Change) — MANDATORY, cannot be skipped */}
      {showNewSmtpModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                <Mail size={24} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Configure Gmail App Password</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Required to complete your email change
                </p>
              </div>
            </div>

            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-4 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-700 dark:text-red-300 font-semibold mb-1">⚠ Configuration Required</p>
              <p className="text-xs text-red-600 dark:text-red-400">
                You must configure the Gmail App Password for your new email to complete the email change. If you cancel, the email change will be <strong>reverted</strong>.
              </p>
            </div>
            
            <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg mb-4">
              <p className="text-xs text-violet-700 dark:text-violet-300 mb-2">
                <strong>New Email:</strong> {newEmailAddress}
              </p>
              <p className="text-xs text-violet-700 dark:text-violet-300">
                <strong>How to get an App Password:</strong> Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google App Passwords</a> → Select app "Mail" → Generate → Copy the 16-character password.
              </p>
            </div>
            
            <div className="mb-6">
              <FormInput
                label="Gmail App Password"
                required
                type="text"
                value={newSmtpPassword}
                onChange={(e) => {
                  // Strip all spaces so pasting "xxxx xxxx xxxx xxxx" still gives 16 chars
                  const value = e.target.value.replace(/\s/g, '').slice(0, 16);
                  setNewSmtpPassword(value);
                }}
                placeholder="xxxx xxxx xxxx xxxx"
                maxLength={32}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveNewSmtpPassword()}
                autoFocus
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Paste the 16-character password exactly as generated — spaces are stripped automatically.
                {newSmtpPassword.length > 0 && (
                  <span className={`ml-2 font-semibold ${newSmtpPassword.length === 16 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {newSmtpPassword.length}/16
                  </span>
                )}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCancelEmailChange}
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                disabled={businessSaving}
              >
                {businessSaving ? (
                  <>
                    <Loader2 size={16} className="mr-1.5 animate-spin" />
                    Reverting...
                  </>
                ) : (
                  'Cancel Email Change'
                )}
              </Button>
              <Button onClick={handleSaveNewSmtpPassword} className="flex-1" disabled={businessSaving || newSmtpPassword.length !== 16}>
                {businessSaving ? (
                  <>
                    <Loader2 size={16} className="mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-1.5" />
                    Save & Configure
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Account Password Modal (After SMTP Configuration) */}
      {showNewAccountPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Lock size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Update Account Password</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Set a new password for your account with the new email
                </p>
              </div>
            </div>
            
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>New Email:</strong> {newEmailAddress}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                Since you changed your email, it's recommended to update your account password for security.
              </p>
            </div>
            
            <div className="space-y-4 mb-6">
              <FormInput
                label="Current Password"
                type="password"
                value={passwordForEmailChange}
                readOnly
                disabled
                className="opacity-70 cursor-not-allowed"
                hint="Auto-filled from the password you entered to authorize the email change."
              />
              <FormInput
                label="New Account Password"
                type="password"
                value={newAccountPassword}
                onChange={(e) => setNewAccountPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
                autoFocus
              />
              <FormInput
                label="Confirm New Password"
                type="password"
                value={newAccountPasswordConfirm}
                onChange={(e) => setNewAccountPasswordConfirm(e.target.value)}
                placeholder="Confirm new password"
                onKeyPress={(e) => e.key === 'Enter' && handleSaveNewAccountPassword()}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleSkipNewAccountPassword} className="flex-1">
                Skip for Now
              </Button>
              <Button onClick={handleSaveNewAccountPassword} className="flex-1" disabled={businessSaving || !newAccountPassword || newAccountPassword.length < 8}>
                {businessSaving ? (
                  <>
                    <Loader2 size={16} className="mr-1.5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Lock size={16} className="mr-1.5" />
                    Update Password
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
