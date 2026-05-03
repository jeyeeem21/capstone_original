/**
 * Sales API
 * 
 * All sales-related API calls
 */

import apiClient from './apiClient';
import { ENDPOINTS } from './config';

export const salesApi = {
  /**
   * Get all sales records
   * @param {Object} options - Filter options
   * @param {string} options.startDate - Start date
   * @param {string} options.endDate - End date
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   */
  getAll: async ({ startDate = '', endDate = '', page = 1, limit = 20 } = {}) => {
    const params = { page, limit };
    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;
    
    return apiClient.get(ENDPOINTS.SALES.BASE, { params });
  },
  
  /**
   * Get sales summary/statistics
   * @param {Object} options - Filter options
   * @param {string} options.period - Period (today, week, month, year)
   */
  getSummary: async ({ period = 'month' } = {}) => {
    return apiClient.get(ENDPOINTS.SALES.SUMMARY, {
      params: { period },
      useCache: true,
      cacheKey: `sales-summary-${period}`,
    });
  },
  
  /**
   * Get sales by date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   */
  getByDateRange: async (startDate, endDate) => {
    return apiClient.get(ENDPOINTS.SALES.BY_DATE(startDate, endDate));
  },
  
  /**
   * Create a new sale record
   * @param {Object} saleData - Sale data
   */
  create: async (saleData) => {
    const response = await apiClient.post(ENDPOINTS.SALES.BASE, saleData);
    if (response.success) {
      // Clear sales summary cache
      apiClient.cache.remove('sales-summary-today');
      apiClient.cache.remove('sales-summary-week');
      apiClient.cache.remove('sales-summary-month');
      apiClient.cache.remove('sales-summary-year');
    }
    return response;
  },

  /**
   * Get predictive analysis data
   * @param {string} period - 'daily' | 'monthly' | 'yearly'
   */
  getPredictions: async (period = 'daily') => {
    return apiClient.get('/sales-predictions', {
      params: { period },
      useCache: true,
      cacheKey: `sales-predictions-${period}`,
    });
  },

  /**
   * Refresh prediction cache
   */
  refreshPredictions: async () => {
    const response = await apiClient.post('/sales-predictions/refresh');
    if (response.success) {
      apiClient.cache.remove('sales-predictions-daily');
      apiClient.cache.remove('sales-predictions-monthly');
      apiClient.cache.remove('sales-predictions-yearly');
    }
    return response;
  },
};

export default salesApi;
