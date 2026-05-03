/**
 * useReportsData Hook
 * 
 * Persistent caching for Reports page - shows cached data instantly,
 * then updates in background. No loading states on revisit.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import reportsApi from '../api/reportsApi';

// Memory cache for instant display
const reportsCache = new Map();
const cacheTimestamps = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// LocalStorage keys
const STORAGE_PREFIX = 'kjp-reports-';

/**
 * Get cached data from memory or localStorage
 */
const getCachedData = (key) => {
  // Try memory cache first (fastest)
  if (reportsCache.has(key)) {
    const timestamp = cacheTimestamps.get(key) || 0;
    const age = Date.now() - timestamp;
    
    if (age < CACHE_TTL) {
      return reportsCache.get(key);
    }
  }
  
  // Try localStorage
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + key);
    if (stored) {
      const { data, timestamp } = JSON.parse(stored);
      const age = Date.now() - timestamp;
      
      if (age < CACHE_TTL) {
        // Restore to memory cache
        reportsCache.set(key, data);
        cacheTimestamps.set(key, timestamp);
        return data;
      }
    }
  } catch (e) {
    // Invalid cache, ignore
  }
  
  return null;
};

/**
 * Save data to cache
 */
const setCachedData = (key, data) => {
  // Save to memory
  reportsCache.set(key, data);
  cacheTimestamps.set(key, Date.now());
  
  // Save to localStorage
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    // Storage full, ignore
  }
};

/**
 * Generate cache key from date range
 */
const getCacheKey = (from, to, reportType) => {
  return `${reportType}-${from}-${to}`;
};

/**
 * Main hook for reports data
 */
export const useReportsData = () => {
  const [plData, setPlData] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [procData, setProcData] = useState(null);
  const [dryData, setDryData] = useState(null);
  const [procYieldData, setProcYieldData] = useState(null);
  const [invData, setInvData] = useState(null);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasInitialData, setHasInitialData] = useState(false);
  
  const fetchInProgress = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Fetch all reports data
   */
  const fetchReports = useCallback(async (from, to, showRefreshing = false) => {
    if (!from || !to || from > to) return;
    if (fetchInProgress.current) return;
    
    fetchInProgress.current = true;
    if (showRefreshing) setIsRefreshing(true);
    
    // Try to load from cache first
    const plKey = getCacheKey(from, to, 'pl');
    const salesKey = getCacheKey(from, to, 'sales');
    const procKey = getCacheKey(from, to, 'proc');
    const dryKey = getCacheKey(from, to, 'dry');
    const procYieldKey = getCacheKey(from, to, 'procYield');
    const invKey = 'inventory'; // Inventory doesn't depend on date range
    
    const cachedPl = getCachedData(plKey);
    const cachedSales = getCachedData(salesKey);
    const cachedProc = getCachedData(procKey);
    const cachedDry = getCachedData(dryKey);
    const cachedProcYield = getCachedData(procYieldKey);
    const cachedInv = getCachedData(invKey);
    
    // Show cached data immediately if available
    if (cachedPl) setPlData(cachedPl);
    if (cachedSales) setSalesData(cachedSales);
    if (cachedProc) setProcData(cachedProc);
    if (cachedDry) setDryData(cachedDry);
    if (cachedProcYield) setProcYieldData(cachedProcYield);
    if (cachedInv) setInvData(cachedInv);
    
    if (cachedPl || cachedSales || cachedProc || cachedDry || cachedProcYield || cachedInv) {
      setHasInitialData(true);
    }
    
    try {
      // Fetch fresh data in background
      const [pl, sales, proc, dry, procYield, inv] = await Promise.allSettled([
        reportsApi.getProfitLoss(from, to),
        reportsApi.getSalesSummary(from, to),
        reportsApi.getProcurementCost(from, to),
        reportsApi.getDryingCost(from, to),
        reportsApi.getProcessingYield(from, to),
        reportsApi.getInventoryValuation(),
      ]);
      
      if (!isMounted.current) return;
      
      // Update state and cache with fresh data
      if (pl.status === 'fulfilled' && pl.value?.success) {
        setPlData(pl.value.data);
        setCachedData(plKey, pl.value.data);
      }
      
      if (sales.status === 'fulfilled' && sales.value?.success) {
        setSalesData(sales.value.data);
        setCachedData(salesKey, sales.value.data);
      }
      
      if (proc.status === 'fulfilled' && proc.value?.success) {
        setProcData(proc.value.data);
        setCachedData(procKey, proc.value.data);
      }
      
      if (dry.status === 'fulfilled' && dry.value?.success) {
        setDryData(dry.value.data);
        setCachedData(dryKey, dry.value.data);
      }
      
      if (procYield.status === 'fulfilled' && procYield.value?.success) {
        setProcYieldData(procYield.value.data);
        setCachedData(procYieldKey, procYield.value.data);
      }
      
      if (inv.status === 'fulfilled' && inv.value?.success) {
        setInvData(inv.value.data);
        setCachedData(invKey, inv.value.data);
      }
      
      setHasInitialData(true);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      if (isMounted.current) {
        setIsRefreshing(false);
        fetchInProgress.current = false;
      }
    }
  }, []);

  return {
    plData,
    salesData,
    procData,
    dryData,
    procYieldData,
    invData,
    isRefreshing,
    hasInitialData,
    fetchReports,
  };
};

export default useReportsData;
