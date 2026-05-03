/**
 * Settings API
 * 
 * All settings-related API calls
 */

import apiClient from './apiClient';
import { ENDPOINTS } from './config';

export const settingsApi = {
  /**
   * Get all settings
   */
  getAll: async () => {
    return apiClient.get(ENDPOINTS.SETTINGS.BASE);
  },
  
  /**
   * Update settings
   * @param {Object} settings - Settings to update
   */
  update: async (settings) => {
    return apiClient.put(ENDPOINTS.SETTINGS.BASE, settings);
  },
  
  /**
   * Get user profile settings
   */
  getProfile: async () => {
    return apiClient.get(ENDPOINTS.SETTINGS.PROFILE);
  },
  
  /**
   * Update user profile
   * @param {Object} profileData - Profile data to update
   */
  updateProfile: async (profileData) => {
    return apiClient.put(ENDPOINTS.SETTINGS.PROFILE, profileData);
  },
  
  /**
   * Upload profile avatar
   * @param {File} file - Avatar image file
   */
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiClient.upload(ENDPOINTS.SETTINGS.PROFILE + '/avatar', formData);
  },
};

export default settingsApi;
