/**
 * Inventory API
 * 
 * All inventory-related API calls
 */

import apiClient from './apiClient';
import { ENDPOINTS } from './config';

export const inventoryApi = {
  /**
   * Get all inventory items
   * @param {Object} options - Filter options
   * @param {string} options.search - Search query
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   */
  getAll: async ({ search = '', page = 1, limit = 20 } = {}) => {
    const params = { page, limit };
    if (search) params.search = search;
    
    return apiClient.get(ENDPOINTS.INVENTORY.BASE, { params });
  },
  
  /**
   * Get single inventory item by ID
   * @param {number|string} id - Inventory item ID
   */
  getById: async (id) => {
    return apiClient.get(ENDPOINTS.INVENTORY.BY_ID(id));
  },
  
  /**
   * Get low stock items
   */
  getLowStock: async () => {
    return apiClient.get(ENDPOINTS.INVENTORY.LOW_STOCK);
  },
  
  /**
   * Create new inventory item
   * @param {Object} itemData - Inventory item data
   */
  create: async (itemData) => {
    return apiClient.post(ENDPOINTS.INVENTORY.BASE, itemData);
  },
  
  /**
   * Update inventory item
   * @param {number|string} id - Inventory item ID
   * @param {Object} itemData - Updated inventory data
   */
  update: async (id, itemData) => {
    return apiClient.put(ENDPOINTS.INVENTORY.BY_ID(id), itemData);
  },
  
  /**
   * Update stock quantity
   * @param {number|string} id - Inventory item ID
   * @param {number} quantity - New quantity
   * @param {string} reason - Reason for stock change
   */
  updateStock: async (id, quantity, reason = '') => {
    return apiClient.patch(ENDPOINTS.INVENTORY.BY_ID(id), { quantity, reason });
  },
  
  /**
   * Delete inventory item
   * @param {number|string} id - Inventory item ID
   */
  delete: async (id) => {
    return apiClient.delete(ENDPOINTS.INVENTORY.BY_ID(id));
  },
};

export default inventoryApi;
