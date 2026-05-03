/**
 * Business Settings API
 * 
 * Handles API calls for business settings management
 */

import apiClient from './apiClient';

const businessSettingsApi = {
  /**
   * Get all business settings (with caching for speed)
   */
  getAll: async () => {
    return apiClient.get('/business-settings', { 
      useCache: true, 
      cacheKey: 'business-settings' 
    });
  },

  /**
   * Get fresh business settings (bypass cache — used for polling)
   */
  getFresh: async () => {
    return apiClient.get('/business-settings');
  },

  /**
   * Update business settings
   * @param {Object} data - Business settings data
   */
  update: async (data) => {
    // Clear all caches when updating
    localStorage.removeItem('kjp-business-settings');
    apiClient.clearCache?.('business-settings');
    return apiClient.put('/business-settings', data);
  },

  /**
   * Upload business logo
   * @param {File} file - Logo file
   */
  uploadLogo: async (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    
    // Clear all caches when uploading logo
    localStorage.removeItem('kjp-business-settings');
    apiClient.clearCache?.('business-settings');
    
    return apiClient.post('/business-settings/logo', formData);
  },

  /**
   * Upload GCash QR code image
   * @param {File} file - QR code image file
   */
  uploadGcashQr: async (file) => {
    const formData = new FormData();
    formData.append('gcash_qr', file);

    // Clear all caches when uploading
    localStorage.removeItem('kjp-business-settings');
    apiClient.clearCache?.('business-settings');

    return apiClient.post('/business-settings/gcash-qr', formData);
  },

  /**
   * Send a test email to verify SMTP configuration
   */
  testEmail: async (smtpPassword) => {
    return apiClient.post('/business-settings/test-email', { smtp_password: smtpPassword });
  },

  /**
   * Check if business email is available
   * @param {string} email - Email to check
   */
  checkBusinessEmail: async (email) => {
    return apiClient.post('/business-settings/check-business-email', { email });
  },

  /**
   * Verify business email change with code
   * @param {string} code - 6-digit verification code
   */
  verifyBusinessEmailChange: async (code) => {
    return apiClient.post('/business-settings/verify-business-email-change', { code });
  },
};

export default businessSettingsApi;
