/**
 * Reports API
 *
 * All financial report endpoints. Each accepts optional date_from / date_to
 * query params (YYYY-MM-DD). Defaults to the current calendar month on the server.
 */

import apiClient from './apiClient';

const buildParams = (dateFrom, dateTo) => {
  const p = {};
  if (dateFrom) p.date_from = dateFrom;
  if (dateTo)   p.date_to   = dateTo;
  return p;
};

export const reportsApi = {
  /**
   * Profit & Loss Statement
   * Returns: revenue, costs, gross_profit, profit_margin, daily_revenue series
   */
  getProfitLoss: (dateFrom, dateTo) =>
    apiClient.get('/reports/profit-loss', { params: buildParams(dateFrom, dateTo) }),

  /**
   * Sales Summary
   * Returns: order_count, revenue, by_payment, top_products, by_status
   */
  getSalesSummary: (dateFrom, dateTo) =>
    apiClient.get('/reports/sales-summary', { params: buildParams(dateFrom, dateTo) }),

  /**
   * Procurement Cost Report
   * Returns: total_cost, total_kg, by_supplier, records[]
   */
  getProcurementCost: (dateFrom, dateTo) =>
    apiClient.get('/reports/procurement-cost', { params: buildParams(dateFrom, dateTo) }),

  /**
   * Drying Cost Report
   * Returns: total_cost, total_kg_in, total_kg_out, records[]
   */
  getDryingCost: (dateFrom, dateTo) =>
    apiClient.get('/reports/drying-cost', { params: buildParams(dateFrom, dateTo) }),

  /**
   * Processing Yield Report
   * Returns: total_input_kg, total_output_kg, avg_yield_percent, records[]
   */
  getProcessingYield: (dateFrom, dateTo) =>
    apiClient.get('/reports/processing-yield', { params: buildParams(dateFrom, dateTo) }),

  /**
   * Inventory Valuation (snapshot — no date filter)
   * Returns: total_value, total_units, products[]
   */
  getInventoryValuation: () =>
    apiClient.get('/reports/inventory-valuation'),
};

export default reportsApi;
