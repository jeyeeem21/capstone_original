/**
 * Users API
 * 
 * All user management API calls (admin)
 */

import apiClient from './apiClient';
import { ENDPOINTS } from './config';

export const usersApi = {
  /**
   * Check if email is available (includes soft-deleted users)
   * @param {string} email - Email to check
   */
  checkEmail: async (email) => {
    return apiClient.post(`${ENDPOINTS.USERS.BASE}/check-email`, { email });
  },

  /**
   * Get all users
   * @param {Object} options - Filter options
   * @param {string} options.search - Search query
   * @param {string} options.role - Role filter
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   */
  getAll: async ({ search = '', role = '', page = 1, limit = 20 } = {}) => {
    const params = { page, limit };
    if (search) params.search = search;
    if (role) params.role = role;
    
    return apiClient.get(ENDPOINTS.USERS.BASE, { params });
  },
  
  /**
   * Get single user by ID
   * @param {number|string} id - User ID
   */
  getById: async (id) => {
    return apiClient.get(ENDPOINTS.USERS.BY_ID(id));
  },
  
  /**
   * Send email verification code
   * @param {string} email - Email to verify
   */
  sendVerification: async (email) => {
    return apiClient.post(`${ENDPOINTS.USERS.BASE}/send-verification`, { email });
  },

  /**
   * Verify the email code
   * @param {string} email - Email address
   * @param {string} code - 6-digit verification code
   */
  verifyCode: async (email, code) => {
    return apiClient.post(`${ENDPOINTS.USERS.BASE}/verify-code`, { email, code });
  },

  /**
   * Create a new user
   * @param {Object} userData - User data
   */
  create: async (userData) => {
    return apiClient.post(ENDPOINTS.USERS.BASE, userData);
  },
  
  /**
   * Update user
   * @param {number|string} id - User ID
   * @param {Object} userData - Updated user data
   */
  update: async (id, userData) => {
    return apiClient.put(ENDPOINTS.USERS.BY_ID(id), userData);
  },
  
  /**
   * Delete user
   * @param {number|string} id - User ID
   */
  delete: async (id) => {
    return apiClient.delete(ENDPOINTS.USERS.BY_ID(id));
  },
  
  /**
   * Update user role
   * @param {number|string} id - User ID
   * @param {string} role - New role
   */
  updateRole: async (id, role) => {
    return apiClient.patch(ENDPOINTS.USERS.BY_ID(id), { role });
  },
};

export default usersApi;
