/**
 * Website Content API
 * 
 * Handles API calls for website content management (Home, About, Products, Contact pages)
 */

import apiClient from './apiClient';

const websiteContentApi = {
  /**
   * Get all website content (home, about, products, contact)
   */
  getAll: async () => {
    return apiClient.get('/website-content');
  },

  /**
   * Get home page content
   */
  getHomeContent: async () => {
    return apiClient.get('/website-content/home');
  },

  /**
   * Get about page content
   */
  getAboutContent: async () => {
    return apiClient.get('/website-content/about');
  },

  /**
   * Get products page content
   */
  getProductsContent: async () => {
    return apiClient.get('/website-content/products');
  },

  /**
   * Get contact page content
   */
  getContactContent: async () => {
    return apiClient.get('/website-content/contact');
  },

  /**
   * Save home page content
   * @param {Object} data - Home page content data
   */
  saveHomeContent: async (data) => {
    return apiClient.post('/website-content/home', data);
  },

  /**
   * Save about page content
   * @param {Object} data - About page content data
   */
  saveAboutContent: async (data) => {
    return apiClient.post('/website-content/about', data);
  },

  /**
   * Save products page content
   * @param {Object} data - Products page content data
   */
  saveProductsContent: async (data) => {
    return apiClient.post('/website-content/products', data);
  },

  /**
   * Save contact page content
   * @param {Object} data - Contact page content data
   */
  saveContactContent: async (data) => {
    return apiClient.post('/website-content/contact', data);
  },

  /**
   * Get legal content (terms & privacy)
   */
  getLegalContent: async () => {
    return apiClient.get('/website-content/legal');
  },

  /**
   * Save legal content (terms & privacy)
   * @param {Object} data - Legal content data
   */
  saveLegalContent: async (data) => {
    return apiClient.post('/website-content/legal', data);
  },

  /**
   * Upload hero image for any page
   * @param {File} file - Image file
   * @param {string} page - 'home', 'about', 'products', or 'contact'
   */
  uploadHeroImage: async (file, page) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('page', page);
    
    return apiClient.post('/website-content/hero-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Seed default content (useful for initial setup)
   */
  seedDefaults: async () => {
    return apiClient.post('/website-content/seed');
  },
};

export default websiteContentApi;
