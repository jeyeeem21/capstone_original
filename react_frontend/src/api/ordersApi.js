/**
 * Orders API
 * 
 * All order-related API calls
 */

import apiClient from './apiClient';
import { ENDPOINTS } from './config';

export const ordersApi = {
  /**
   * Get all orders with optional filters
   * @param {Object} options - Filter options
   * @param {string} options.status - Order status filter
   * @param {string} options.search - Search query
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   */
  getAll: async ({ status = '', search = '', page = 1, limit = 10 } = {}) => {
    const params = { page, limit };
    if (status) params.status = status;
    if (search) params.search = search;
    
    return apiClient.get(ENDPOINTS.ORDERS.BASE, { params });
  },
  
  /**
   * Get single order by ID
   * @param {number|string} id - Order ID
   */
  getById: async (id) => {
    return apiClient.get(ENDPOINTS.ORDERS.BY_ID(id));
  },
  
  /**
   * Create a new order
   * @param {Object} orderData - Order data
   */
  create: async (orderData) => {
    return apiClient.post(ENDPOINTS.ORDERS.BASE, orderData);
  },
  
  /**
   * Update order status
   * @param {number|string} id - Order ID
   * @param {string} status - New status
   */
  updateStatus: async (id, status) => {
    return apiClient.patch(ENDPOINTS.ORDERS.BY_ID(id), { status });
  },
  
  /**
   * Update order details
   * @param {number|string} id - Order ID
   * @param {Object} orderData - Updated order data
   */
  update: async (id, orderData) => {
    return apiClient.put(ENDPOINTS.ORDERS.BY_ID(id), orderData);
  },
  
  /**
   * Cancel an order
   * @param {number|string} id - Order ID
   */
  cancel: async (id) => {
    return apiClient.patch(ENDPOINTS.ORDERS.BY_ID(id), { status: 'cancelled' });
  },
  
  /**
   * Delete an order
   * @param {number|string} id - Order ID
   */
  delete: async (id) => {
    return apiClient.delete(ENDPOINTS.ORDERS.BY_ID(id));
  },
};

export default ordersApi;
