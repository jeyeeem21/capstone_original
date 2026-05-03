/**
 * Authentication API
 * 
 * All authentication-related API calls
 */

import apiClient, { setAuthToken } from './apiClient';
import { ENDPOINTS } from './config';

export const authApi = {
  /**
   * Login user
   * @param {Object} credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @param {boolean} credentials.remember - Remember me option
   */
  login: async ({ email, password, remember = false }) => {
    const response = await apiClient.post(ENDPOINTS.AUTH.LOGIN, {
      email,
      password,
      remember,
    });
    
    if (response.success && response.token) {
      setAuthToken(response.token);
      if (response.session_token) {
        localStorage.setItem('session_token', response.session_token);
      }
    }
    
    return response;
  },
  
  /**
   * Logout current user
   */
  logout: async () => {
    const response = await apiClient.post(ENDPOINTS.AUTH.LOGOUT);
    setAuthToken(null);
    localStorage.removeItem('session_token');
    apiClient.cache.clear();
    return response;
  },
  
  /**
   * Register new user
   * @param {Object} userData
   * @param {string} userData.name - User name
   * @param {string} userData.email - User email
   * @param {string} userData.password - User password
   * @param {string} userData.password_confirmation - Password confirmation
   */
  register: async (userData) => {
    const response = await apiClient.post(ENDPOINTS.AUTH.REGISTER, userData);
    
    if (response.success && response.token) {
      setAuthToken(response.token);
    }
    
    return response;
  },
  
  /**
   * Request password reset email
   * @param {string} email - User email
   */
  forgotPassword: async (email) => {
    return apiClient.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
  },

  /**
   * Verify password reset code
   * @param {string} email - User email
   * @param {string} code - 6-digit verification code
   */
  forgotPasswordVerifyCode: async (email, code) => {
    return apiClient.post(ENDPOINTS.AUTH.FORGOT_PASSWORD_VERIFY_CODE, { email, code });
  },

  /**
   * Reset password with verified code
   * @param {Object} data
   * @param {string} data.email - User email
   * @param {string} data.password - New password
   * @param {string} data.password_confirmation - Password confirmation
   */
  resetPassword: async (data) => {
    return apiClient.post(ENDPOINTS.AUTH.RESET_PASSWORD, data);
  },
  
  /**
   * Get current authenticated user
   */
  getCurrentUser: async () => {
    return apiClient.get(ENDPOINTS.AUTH.ME);
  },

  /**
   * Check if profile email is available
   * @param {string} email - Email to check
   */
  checkProfileEmail: async (email) => {
    return apiClient.post('/auth/check-profile-email', { email });
  },

  /**
   * Update user profile
   * @param {Object} profileData
   * @param {string} profileData.first_name - First name
   * @param {string} profileData.last_name - Last name
   * @param {string} profileData.email - Email address
   * @param {string} profileData.phone - Phone number
   * @param {string} profileData.current_password - Current password (required when changing email)
   */
  updateProfile: async (profileData) => {
    return apiClient.put('/auth/profile', profileData);
  },

  /**
   * Verify email change with code
   * @param {string} code - 6-digit verification code
   */
  verifyEmailChange: async (code) => {
    return apiClient.post('/auth/verify-email-change', { code });
  },

  /**
   * Clear email change pending flag (after completing email change flow)
   */
  clearEmailChangePending: async () => {
    return apiClient.post('/auth/clear-email-change-pending');
  },

  revertEmailChange: async (oldEmail) => {
    return apiClient.post('/auth/revert-email-change', { old_email: oldEmail });
  },

  /**
   * Update user password
   * @param {Object} passwordData
   * @param {string} passwordData.current_password - Current password
   * @param {string} passwordData.new_password - New password
   * @param {string} passwordData.new_password_confirmation - Password confirmation
   */
  updatePassword: async (passwordData) => {
    return apiClient.put('/auth/password', passwordData);
  },
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('auth_token');
  },
  
  /**
   * Get stored auth token
   */
  getToken: () => {
    return localStorage.getItem('auth_token');
  },

  // ── Self-registration ────────────────────────────────────────────────────

  /** Check if an email is already registered (public). */
  checkEmail: async (email) => {
    return apiClient.post(ENDPOINTS.AUTH.CHECK_EMAIL, { email });
  },

  /**
   * Step 1 – submit registration form; backend validates, caches data, sends
   * 6-digit verification code to the email address.
   */
  registerSendVerification: async (data) => {
    return apiClient.post(ENDPOINTS.AUTH.REGISTER_SEND_VERIFICATION, data);
  },

  /** Step 2 – verify the 6-digit code entered by the user. */
  registerVerifyCode: async (email, code) => {
    return apiClient.post(ENDPOINTS.AUTH.REGISTER_VERIFY_CODE, { email, code });
  },

  /**
   * Step 3 – finalise registration; sets password, creates Customer + User records and
   * returns an auth token so the user is logged in immediately.
   */
  registerComplete: async (email, password, password_confirmation) => {
    const response = await apiClient.post(ENDPOINTS.AUTH.REGISTER_COMPLETE, { email, password, password_confirmation });
    if (response.success && response.token) {
      setAuthToken(response.token);
    }
    return response;
  },

  /** Cancel a pending registration (audit-logged server-side). */
  registerCancel: async (email) => {
    return apiClient.post(ENDPOINTS.AUTH.REGISTER_CANCEL, { email });
  },
};

export default authApi;
