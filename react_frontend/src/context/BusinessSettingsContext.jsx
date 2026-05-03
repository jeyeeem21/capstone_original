import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { businessSettingsApi } from '../api';
import { resolveStorageUrl, DEFAULT_LOGO } from '../api/config';

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

const BusinessSettingsContext = createContext(null);

// Polling interval in milliseconds (60 seconds)
const POLL_INTERVAL = 60000;

// Default settings to use as fallback
const defaultSettings = {
  business_name: 'KJP Ricemill',
  business_tagline: 'Inventory & Sales',
  business_start_year: '2010',
  business_logo: DEFAULT_LOGO,
  business_email: 'info@kjpricemill.com',
  business_phone: '+63 917-123-4567',
  business_address: 'Calapan City, Oriental Mindoro, Philippines',
  business_hours: 'Mon-Sat: 7:00 AM - 6:00 PM',
  business_open_days: 'Monday - Saturday',
  business_open_time: '07:00',
  business_close_time: '18:00',
  business_hours_json: '',
  footer_tagline: 'Your trusted partner in quality rice processing and distribution.',
  footer_copyright: 'Management System. All rights reserved.',
  footer_powered_by: 'Powered by XianFire Framework. Built at Mindoro State University',
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
  smtp_configured: false,
  gcash_name: '',
  gcash_number: '',
  gcash_qr: '',
};

// Get initial settings from localStorage
const getInitialSettings = () => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('kjp-business-settings');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Always resolve logo through getFullLogoUrl to fix stale relative paths from old cache
        parsed.business_logo = getFullLogoUrl(parsed.business_logo);
        return parsed;
      } catch (e) {
        console.error('Failed to parse cached business settings:', e);
      }
    }
  }
  return defaultSettings;
};

const buildSettings = (data) => {
  const logoUrl = getFullLogoUrl(data.business_logo);
  return {
    business_name: data.business_name || 'KJP Ricemill',
    business_tagline: data.business_tagline || 'Inventory & Sales',
    business_start_year: data.business_start_year || '2010',
    business_logo: logoUrl,
    business_email: data.business_email || 'info@kjpricemill.com',
    business_phone: data.business_phone || '+63 917-123-4567',
    business_address: data.business_address || 'Calapan City, Oriental Mindoro, Philippines',
    business_hours: data.business_hours_formatted || data.business_hours || 'Mon-Sat: 7:00 AM - 6:00 PM',
    business_hours_json: data.business_hours_json || '',
    business_open_days: data.business_open_days || 'Monday - Saturday',
    business_open_time: data.business_open_time || '07:00',
    business_close_time: data.business_close_time || '18:00',
    footer_tagline: data.footer_tagline || 'Your trusted partner in quality rice processing and distribution.',
    footer_copyright: data.footer_copyright || 'Management System. All rights reserved.',
    footer_powered_by: data.footer_powered_by || 'Powered by XianFire Framework. Built at Mindoro State University',
    social_facebook: data.social_facebook || '',
    social_twitter: data.social_twitter || '',
    social_instagram: data.social_instagram || '',
    social_linkedin: data.social_linkedin || '',
    shipping_rate_per_sack: data.shipping_rate_per_sack || '',
    shipping_rate_per_km: data.shipping_rate_per_km || '',
    shipping_base_km: data.shipping_base_km || '',
    warehouse_address: data.warehouse_address || '',
    google_maps_embed: data.google_maps_embed || '',
    smtp_password: data.smtp_password || '', // Include SMTP password for warning check
    smtp_configured: data.smtp_configured || false, // Flag to check if SMTP is configured
    gcash_name: data.gcash_name || '',
    gcash_number: data.gcash_number || '',
    gcash_qr: data.gcash_qr ? resolveStorageUrl(data.gcash_qr) : '',
  };
};

export const BusinessSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(getInitialSettings);
  const [loading, setLoading] = useState(!localStorage.getItem('kjp-business-settings'));
  const pollRef = useRef(null);

  const fetchSettings = useCallback(async (isInitial = false) => {
    try {
      // Use cached for initial load (instant), fresh for polling (real-time)
      const result = isInitial
        ? await businessSettingsApi.getAll()
        : await businessSettingsApi.getFresh();
      
      if (result?.success && result?.data) {
        const newSettings = buildSettings(result.data);
        console.log('Built Settings:', newSettings);
        setSettings(newSettings);
        localStorage.setItem('kjp-business-settings', JSON.stringify(newSettings));
      }
    } catch (error) {
      if (isInitial) console.error('Failed to fetch business settings:', error);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Initial fetch + polling every 30s for real-time sync across all roles/tabs
  useEffect(() => {
    fetchSettings(true);
    pollRef.current = setInterval(() => fetchSettings(false), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchSettings]);

  // Cross-tab sync via localStorage events
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'kjp-business-settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.business_logo && parsed.business_logo.startsWith('blob:')) {
            parsed.business_logo = DEFAULT_LOGO;
          }
          setSettings(parsed);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updateSettings = (newSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('kjp-business-settings', JSON.stringify(updated));
      return updated;
    });
  };

  // Allow manual refresh (e.g. after saving settings) - clears cache first
  const refreshSettings = useCallback(() => {
    // Clear localStorage cache before fetching
    localStorage.removeItem('kjp-business-settings');
    return fetchSettings(false);
  }, [fetchSettings]);

  return (
    <BusinessSettingsContext.Provider value={{ settings, loading, updateSettings, refreshSettings }}>
      {children}
    </BusinessSettingsContext.Provider>
  );
};

export const useBusinessSettings = () => {
  const context = useContext(BusinessSettingsContext);
  
  // Return safe default values if context is not available
  // This prevents crashes during initial render or when used outside provider
  if (!context) {
    console.warn('useBusinessSettings was called outside of BusinessSettingsProvider. Using default settings.');
    return {
      settings: defaultSettings,
      loading: false,
      updateSettings: () => {
        console.warn('Cannot update settings outside of BusinessSettingsProvider');
      }
    };
  }
  
  return context;
};

export default BusinessSettingsContext;
