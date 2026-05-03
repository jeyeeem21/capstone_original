/**
 * API Index
 * 
 * Central export point for all API modules.
 * Import from here: import { productsApi, authApi } from '@/api';
 */

// Configuration
export { API_BASE_URL, ENDPOINTS, REQUEST_CONFIG, CACHE_CONFIG } from './config';

// API Client
export { default as apiClient, setAuthToken } from './apiClient';

// API Modules
export { default as productsApi } from './productsApi';
export { default as authApi } from './authApi';
export { default as ordersApi } from './ordersApi';
export { default as inventoryApi } from './inventoryApi';
export { default as salesApi } from './salesApi';
export { default as dashboardApi } from './dashboardApi';
export { default as usersApi } from './usersApi';
export { default as contactApi } from './contactApi';
export { default as settingsApi } from './settingsApi';
export { default as websiteContentApi } from './websiteContentApi';
export { default as businessSettingsApi } from './businessSettingsApi';
export { default as reportsApi } from './reportsApi';
