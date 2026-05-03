/**
 * Products API
 * 
 * All product-related API calls
 */

import apiClient from './apiClient';
import { ENDPOINTS } from './config';

export const productsApi = {
  /**
   * Get all products with optional filters
   * @param {Object} options - Filter options
   * @param {string} options.search - Search query
   * @param {string} options.variety - Variety filter
   * @param {string} options.sort - Sort option (popular, price-low, price-high, newest)
   */
  getAll: async ({ search = '', variety = 'all', sort = 'popular' } = {}) => {
    const params = {};
    if (search) params.search = search;
    if (variety && variety !== 'all') params.variety = variety;
    if (sort) params.sort = sort;
    
    return apiClient.get(ENDPOINTS.PRODUCTS.BASE, {
      params,
      useCache: true,
      cacheKey: `products-${search}-${variety}-${sort}`,
    });
  },
  
  /**
   * Get featured products for homepage
   */
  getFeatured: async () => {
    return apiClient.get(ENDPOINTS.PRODUCTS.FEATURED, {
      useCache: true,
      cacheKey: 'products-featured',
    });
  },
  
  /**
   * Get product varieties with counts
   */
  getVarieties: async () => {
    return apiClient.get(ENDPOINTS.PRODUCTS.VARIETIES, {
      useCache: true,
      cacheKey: 'varieties',
    });
  },
  
  /**
   * Get single product by ID
   * @param {number|string} id - Product ID
   */
  getById: async (id) => {
    return apiClient.get(ENDPOINTS.PRODUCTS.BY_ID(id), {
      useCache: true,
      cacheKey: `product-${id}`,
    });
  },
  
  /**
   * Create a new product (admin)
   * @param {Object} productData - Product data
   */
  create: async (productData) => {
    const response = await apiClient.post(ENDPOINTS.PRODUCTS.BASE, productData);
    if (response.success) {
      // Clear products cache
      apiClient.cache.remove('products-featured');
      apiClient.cache.remove('products-varieties');
    }
    return response;
  },
  
  /**
   * Update a product (admin)
   * @param {number|string} id - Product ID
   * @param {Object} productData - Updated product data
   */
  update: async (id, productData) => {
    const response = await apiClient.put(ENDPOINTS.PRODUCTS.BY_ID(id), productData);
    if (response.success) {
      // Clear product cache
      apiClient.cache.remove(`product-${id}`);
      apiClient.cache.remove('products-featured');
    }
    return response;
  },
  
  /**
   * Delete a product (admin)
   * @param {number|string} id - Product ID
   */
  delete: async (id) => {
    const response = await apiClient.delete(ENDPOINTS.PRODUCTS.BY_ID(id));
    if (response.success) {
      // Clear product cache
      apiClient.cache.remove(`product-${id}`);
      apiClient.cache.remove('products-featured');
      apiClient.cache.remove('varieties');
    }
    return response;
  },
};

export default productsApi;
