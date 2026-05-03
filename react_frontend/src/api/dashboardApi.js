/**
 * Dashboard API
 * 
 * All dashboard-related API calls
 */

import apiClient from './apiClient';
import { ENDPOINTS } from './config';

export const dashboardApi = {
  /**
   * Get dashboard statistics
   * @param {string} period - 'daily' | 'weekly' | 'monthly' | 'bi-annually' | 'annually'
   * @param {object} chartParams - { month, year, yearFrom, yearTo }
   */
  getStats: async (period = 'monthly', chartParams = {}) => {
    const params = new URLSearchParams({ period });
    if (chartParams.month) params.set('month', chartParams.month);
    if (chartParams.year) params.set('year', chartParams.year);
    if (chartParams.yearFrom) params.set('year_from', chartParams.yearFrom);
    if (chartParams.yearTo) params.set('year_to', chartParams.yearTo);
    if (chartParams.point) params.set('point', chartParams.point);
    const cacheKey = `dashboard-stats-${period}-${JSON.stringify(chartParams)}`;
    return apiClient.get(`${ENDPOINTS.DASHBOARD.STATS}?${params.toString()}`, {
      useCache: true,
      cacheKey,
    });
  },

  /**
   * Get recent activity
   * @param {number} limit - Number of activities to fetch
   */
  getRecentActivity: async (limit = 15) => {
    return apiClient.get(`${ENDPOINTS.DASHBOARD.RECENT_ACTIVITY}?limit=${limit}`, {
      useCache: true,
      cacheKey: `dashboard-activity-${limit}`,
    });
  },

  /**
   * Refresh dashboard data (clears cache and fetches fresh)
   */
  refresh: async () => {
    // Clear all dashboard frontend caches (memory + localStorage)
    dashboardApi.clearFrontendCache();

    // Clear backend cache
    await apiClient.post(ENDPOINTS.DASHBOARD.REFRESH);
  },

  /**
   * Clear all dashboard-related frontend cache entries.
   * Call this after archive/restore/soft-delete to keep Dashboard in sync.
   */
  clearFrontendCache: () => {
    apiClient.cache.removeByPrefix('dashboard-stats');
    apiClient.cache.removeByPrefix('dashboard-activity');
  },
};

export default dashboardApi;
