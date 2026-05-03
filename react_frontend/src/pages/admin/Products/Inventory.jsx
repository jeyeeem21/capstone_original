import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Warehouse, Package, AlertTriangle, XCircle, Box, Tag, Scale, Hash, DollarSign, Calendar, Trash2, ShoppingCart, Settings2, TrendingUp, TrendingDown, ArrowDownUp, BarChart3, Layers, Minus, Plus, RotateCcw, ArrowUpRight, ArrowDownRight, Receipt, Percent, X } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatusBadge, ActionButtons, StatsCard, BarChart, LineChart, DonutChart, FormModal, ConfirmModal, FormInput, FormSelect, Modal, useToast, SkeletonStats, SkeletonTable, Button } from '../../../components/ui';
import { apiClient } from '../../../api';
import useDataFetch, { invalidateCache } from '../../../hooks/useDataFetch';
import { useAuth } from '../../../context/AuthContext';

const CACHE_KEY = '/products';
const VARIETIES_CACHE_KEY = '/varieties';

const Inventory = () => {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state - persist in URL
  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = searchParams.get('tab');
    const validTabs = ['inventory', 'inout', 'growth', 'costs'];
    return tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'inventory';
  });

  // Sync active tab to URL
  useEffect(() => {
    setSearchParams(prev => { prev.set('tab', activeTab); return prev; }, { replace: true });
  }, [activeTab, setSearchParams]);
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [activeChartPoint, setActiveChartPoint] = useState(null);
  const [chartScopeActive, setChartScopeActive] = useState(false);
  // In/Out chart calendar state
  const [chartMonth, setChartMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [chartYear, setChartYear] = useState(() => new Date().getFullYear());
  const [chartYearFrom, setChartYearFrom] = useState(() => new Date().getFullYear() - 4);
  const [chartYearTo, setChartYearTo] = useState(() => new Date().getFullYear());
  const [growthChartPeriod, setGrowthChartPeriod] = useState('daily');
  const [activeGrowthChartPoint, setActiveGrowthChartPoint] = useState(null);
  const [growthChartScopeActive, setGrowthChartScopeActive] = useState(false);
  // Growth chart calendar state
  const [growthChartMonth, setGrowthChartMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [growthChartYear, setGrowthChartYear] = useState(() => new Date().getFullYear());
  const [growthChartYearFrom, setGrowthChartYearFrom] = useState(() => new Date().getFullYear() - 4);
  const [growthChartYearTo, setGrowthChartYearTo] = useState(() => new Date().getFullYear());
  const [growthCustomStart, setGrowthCustomStart] = useState('');
  const [growthCustomEnd, setGrowthCustomEnd] = useState('');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [isCostDetailOpen, setIsCostDetailOpen] = useState(false);
  const [selectedCostRecord, setSelectedCostRecord] = useState(null);
  const [isMovementDetailOpen, setIsMovementDetailOpen] = useState(false);
  const [selectedMovementGroup, setSelectedMovementGroup] = useState([]);
  const [isGrowthDetailOpen, setIsGrowthDetailOpen] = useState(false);
  const [selectedGrowthProduct, setSelectedGrowthProduct] = useState(null);
  const [processingDetails, setProcessingDetails] = useState([]);
  const [loadingProcessingDetail, setLoadingProcessingDetail] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    product_name: '',
    variety_id: '',
    price: '',
    weight: '',
    stock_floor: '',
    status: 'active'
  });
  const [addStockKg, setAddStockKg] = useState('');
  const [floorValue, setFloorValue] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [availableProcessings, setAvailableProcessings] = useState([]);
  const [selectedProcessings, setSelectedProcessings] = useState([]);
  const [loadingProcessings, setLoadingProcessings] = useState(false);
  const [costAnalysis, setCostAnalysis] = useState(null);
  const [loadingCostAnalysis, setLoadingCostAnalysis] = useState(false);

  // Fetch products
  const {
    data: products,
    loading,
    isRefreshing,
    refetch,
    optimisticUpdate,
  } = useDataFetch('/products', {
    cacheKey: CACHE_KEY,
    initialData: [],
  });

  // Fetch varieties for dropdown
  const {
    data: varieties,
    refetch: refetchVarieties
  } = useDataFetch('/varieties', {
    cacheKey: VARIETIES_CACHE_KEY,
    initialData: [],
  });

  // Fetch completed processings for In/Out & Growth tabs
  const {
    data: completedProcessings,
  } = useDataFetch('/processings/completed', {
    cacheKey: '/processings/completed',
    initialData: [],
  });

  // Fetch stock movement logs
  const {
    data: stockLogs,
    refetch: refetchStockLogs,
  } = useDataFetch('/stock-logs', {
    cacheKey: '/stock-logs',
    initialData: [],
  });

  // Fetch sales data for growth analysis
  const {
    data: sales,
  } = useDataFetch('/sales', {
    cacheKey: '/sales',
    initialData: [],
  });

  // Variety options for dropdown (variety)
  const varietyOptions = useMemo(() => {
    return varieties
      .filter(c => c.status === 'Active')
      .map(c => ({
        value: String(c.id),
        label: c.name
      }));
  }, [varieties]);

  const statusOptions = useMemo(() => [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ], []);

  // ─── Handlers ────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    setFormData({
      product_name: '',
      variety_id: '',
      price: '',
      weight: '',
      stock_floor: '',
      status: 'active'
    });
    setErrors({});
    refetchVarieties();
    setIsAddModalOpen(true);
  }, [refetchVarieties]);

  const handleView = useCallback(async (item) => {
    setSelectedItem(item);
    setCostAnalysis(null);
    setIsViewModalOpen(true);
    // Fetch cost analysis in background
    setLoadingCostAnalysis(true);
    try {
      const response = await apiClient.get(`/products/${item.product_id}/cost-analysis`);
      if (response.success && response.data) {
        setCostAnalysis(response.data);
      }
    } catch (error) {
      console.error('Error fetching cost analysis:', error);
    } finally {
      setLoadingCostAnalysis(false);
    }
  }, []);

  const handleEdit = useCallback(async (item) => {
    setSelectedItem(item);
    setFormData({
      product_name: item.product_name,
      variety_id: String(item.variety_id),
      price: item.price || '',
      weight: item.weight || '',
      stock_floor: item.stock_floor || '',
      status: item.status
    });
    setErrors({});
    setCostAnalysis(null);
    refetchVarieties();
    setIsEditModalOpen(true);
    // Fetch cost analysis for unit cost display
    try {
      const response = await apiClient.get(`/products/${item.product_id}/cost-analysis`);
      if (response.success && response.data) {
        setCostAnalysis(response.data);
      }
    } catch (error) {
      console.error('Error fetching cost analysis:', error);
    }
  }, [refetchVarieties]);

  const handleDelete = useCallback((item) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  }, []);

  const handleOpenAddStock = useCallback(async (item) => {
    setSelectedItem(item);
    setAddStockKg('');
    setSelectedProcessings([]);
    setAvailableProcessings([]);
    setIsAddStockModalOpen(true);
    // Fetch completed processings for this product's variety
    setLoadingProcessings(true);
    try {
      const response = await apiClient.get(`/products/${item.product_id}/completed-processings`);
      if (response.success && response.data) {
        setAvailableProcessings(response.data);
      }
    } catch (error) {
      console.error('Error fetching processings:', error);
    } finally {
      setLoadingProcessings(false);
    }
  }, []);

  const handleOpenFloor = useCallback((item) => {
    setSelectedItem(item);
    setFloorValue(String(item.stock_floor || ''));
    setIsFloorModalOpen(true);
  }, []);

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });
  }, []);

  // Toggle a processing on/off
  const toggleProcessingSelection = useCallback((processingId) => {
    setSelectedProcessings(prev => {
      const existing = prev.find(p => p.processing_id === processingId);
      if (existing) {
        const newSel = prev.filter(p => p.processing_id !== processingId);
        const totalKg = newSel.reduce((sum, s) => sum + s.kg_to_take, 0);
        setAddStockKg(totalKg > 0 ? String(totalKg) : '');
        return newSel;
      } else {
        const proc = availableProcessings.find(p => p.id === processingId);
        if (!proc) return prev;
        const kgToTake = proc.remaining_stock;
        const newSel = [...prev, { processing_id: processingId, kg_to_take: kgToTake }];
        const totalKg = newSel.reduce((sum, s) => sum + s.kg_to_take, 0);
        setAddStockKg(String(totalKg));
        return newSel;
      }
    });
  }, [availableProcessings]);

  // Update kg for a specific selected processing
  const updateProcessingKg = useCallback((processingId, newKg) => {
    setSelectedProcessings(prev => {
      const updated = prev.map(p => {
        if (p.processing_id !== processingId) return p;
        const maxKg = availableProcessings.find(ap => ap.id === processingId)?.remaining_stock || 0;
        const clamped = Math.min(Math.max(parseFloat(newKg) || 0, 0), maxKg);
        return { ...p, kg_to_take: clamped };
      });
      const totalKg = updated.reduce((sum, s) => sum + s.kg_to_take, 0);
      setAddStockKg(String(totalKg));
      return updated;
    });
  }, [availableProcessings]);

  // Select all processings at once
  const handleSelectAll = useCallback(() => {
    const allSelected = availableProcessings.length === selectedProcessings.length;
    if (allSelected) {
      setSelectedProcessings([]);
      setAddStockKg('');
    } else {
      const allSel = availableProcessings.map(p => ({ processing_id: p.id, kg_to_take: p.remaining_stock }));
      setSelectedProcessings(allSel);
      const totalKg = allSel.reduce((sum, s) => sum + s.kg_to_take, 0);
      setAddStockKg(String(totalKg));
    }
  }, [availableProcessings, selectedProcessings.length]);

  // Reset a processing kg to its full remaining
  const resetProcessingKg = useCallback((processingId) => {
    const proc = availableProcessings.find(p => p.id === processingId);
    if (!proc) return;
    updateProcessingKg(processingId, proc.remaining_stock);
  }, [availableProcessings, updateProcessingKg]);

  // Group processings by batch for display
  const groupedProcessings = useMemo(() => {
    if (!availableProcessings.length) return [];
    const groups = {};
    availableProcessings.forEach(proc => {
      const ds = proc.drying_sources?.[0];
      const batchKey = ds?.batch_number || 'standalone';
      const batchLabel = ds?.batch_number ? `Batch ${ds.batch_number}` : 'Standalone Processing';
      if (!groups[batchKey]) {
        groups[batchKey] = {
          key: batchKey,
          label: batchLabel,
          varietyName: ds?.variety_name || selectedItem?.variety_name || '',
          varietyColor: ds?.variety_color || selectedItem?.variety_color || '#6b7280',
          processings: [],
        };
      }
      groups[batchKey].processings.push(proc);
    });
    return Object.values(groups);
  }, [availableProcessings, selectedItem]);

  // Auto-calculate stock units from kg input
  const computedStockUnits = useMemo(() => {
    if (!selectedItem || !addStockKg) return null;
    const kg = parseFloat(addStockKg) || 0;
    if (kg <= 0) return null;
    const weight = parseFloat(selectedItem.weight) || 0;
    if (weight <= 0) return { units: kg, remainder: 0, totalKg: kg, weight: 0 };
    const units = Math.floor(kg / weight);
    const remainder = parseFloat((kg - units * weight).toFixed(2));
    return { units, remainder, totalKg: kg, weight };
  }, [selectedItem, addStockKg]);

  // Cost breakdown for selected processings
  const computedCostBreakdown = useMemo(() => {
    if (!selectedItem || selectedProcessings.length === 0) return null;

    let totalProcurementCost = 0;
    let totalDryingCost = 0;

    selectedProcessings.forEach(sel => {
      const proc = availableProcessings.find(p => p.id === sel.processing_id);
      if (!proc?.cost_breakdown) return;
      const outputKg = proc.output_kg || 1;
      const fraction = sel.kg_to_take / outputKg;
      totalProcurementCost += (proc.cost_breakdown.procurement_cost || 0) * fraction;
      totalDryingCost += (proc.cost_breakdown.drying_cost || 0) * fraction;
    });

    const totalCost = totalProcurementCost + totalDryingCost;
    const weight = parseFloat(selectedItem.weight) || 0;
    const totalKg = parseFloat(addStockKg) || 0;
    const units = weight > 0 ? Math.floor(totalKg / weight) : 0;
    const costPerUnit = units > 0 ? totalCost / units : 0;
    const sellingPrice = parseFloat(selectedItem.price) || 0;
    const profitPerUnit = sellingPrice - costPerUnit;
    const profitMargin = sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;

    return {
      totalProcurementCost,
      totalDryingCost,
      totalCost,
      costPerUnit,
      sellingPrice,
      profitPerUnit,
      profitMargin,
    };
  }, [selectedItem, selectedProcessings, availableProcessings, addStockKg]);

  // ─── Submit handlers ─────────────────────────────────────────

  const handleAddSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      setErrors({});
      const submitData = {
        product_name: formData.product_name,
        variety_id: parseInt(formData.variety_id),
        price: parseFloat(formData.price) || 0,
        stocks: 0,
        stock_floor: parseInt(formData.stock_floor) || 0,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        status: formData.status,
      };
      const response = await apiClient.post('/products', submitData);

      if (response.success && response.data) {
        const productName = formData.product_name;
        setIsAddModalOpen(false);
        toast.success('Product Added', `${productName} has been added to inventory.`);
        // Refetch in background
        invalidateCache(CACHE_KEY);
        refetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error adding product:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        toast.error('Validation Error', 'Please fix the highlighted fields.');
        throw error;
      } else {
        toast.error('Error', error.message || 'Failed to add product');
        throw error;
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      setErrors({});
      const submitData = {
        product_name: formData.product_name,
        variety_id: parseInt(formData.variety_id),
        price: parseFloat(formData.price) || 0,
        stocks: selectedItem.stocks,
        stock_floor: parseInt(formData.stock_floor) || 0,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        status: formData.status,
      };
      const response = await apiClient.put(`/products/${selectedItem.product_id}`, submitData);

      if (response.success && response.data) {
        const productName = formData.product_name;
        setIsEditModalOpen(false);
        toast.success('Product Updated', `${productName} has been updated.`);
        // Refetch in background
        invalidateCache(CACHE_KEY);
        refetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error updating product:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        toast.error('Validation Error', 'Please fix the highlighted fields.');
        throw error;
      } else {
        toast.error('Error', error.message || 'Failed to update product');
        throw error;
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiClient.delete(`/products/${selectedItem.product_id}`);
      if (response.success) {
        const productName = selectedItem.product_name;
        const archivedId = selectedItem.product_id;
        setIsDeleteModalOpen(false);
        // Immediately remove from local data (optimistic update) for instant UI
        optimisticUpdate(prev => prev.filter(p => p.product_id !== archivedId));
        toast.success('Product Archived', `${productName} has been archived.`);
        // Refetch in background to confirm
        invalidateCache(CACHE_KEY);
        refetch();
        return;
      } else {
        throw new Error(response.message || response.error || 'Failed to archive');
      }
    } catch (error) {
      console.error('Error archiving product:', error);
      toast.error('Cannot Archive', error.message || 'Failed to archive product');
      refetch();
    } finally {
      setSaving(false);
    }
  };

  const handleAddStockSubmit = async () => {
    if (saving || selectedProcessings.length === 0 || !computedStockUnits || computedStockUnits.units <= 0) return;
    setSaving(true);
    try {
      const response = await apiClient.post(`/products/${selectedItem.product_id}/distribute-stock`, {
        sources: selectedProcessings.map(s => ({
          processing_id: s.processing_id,
          kg_to_take: s.kg_to_take,
        })),
      });
      if (response.success) {
        const productName = selectedItem.product_name;
        const units = response.data?.total_units_added || computedStockUnits.units;
        const excess = response.data?.excess_kg || 0;
        setIsAddStockModalOpen(false);
        let msg = `Added ${units} unit(s) to ${productName}.`;
        if (excess > 0) msg += ` ${excess} kg excess returned.`;
        toast.success('Stock Distributed', msg);
        // Refetch in background
        invalidateCache(CACHE_KEY);
        invalidateCache('/stock-logs');
        refetch();
        refetchStockLogs();
      } else {
        throw new Error(response.message || 'Failed to distribute stock');
      }
    } catch (error) {
      console.error('Error distributing stock:', error);
      toast.error('Error', error.message || 'Failed to distribute stock');
    } finally {
      setSaving(false);
    }
  };

  const handleFloorSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiClient.put(`/products/${selectedItem.product_id}`, {
        stock_floor: parseInt(floorValue) || 0,
      });
      if (response.success) {
        const productName = selectedItem.product_name;
        setIsFloorModalOpen(false);
        toast.success('Floor Updated', `${productName} low-stock threshold set to ${parseInt(floorValue) || 0} units.`);
        // Refetch in background
        invalidateCache(CACHE_KEY);
        refetch();
      } else {
        throw new Error(response.message || 'Failed to update floor');
      }
    } catch (error) {
      console.error('Error updating floor:', error);
      toast.error('Error', error.message || 'Failed to update floor');
    } finally {
      setSaving(false);
    }
  };

  // ─── Stats ───────────────────────────────────────────────────

  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.status === 'active').length;
  const totalStock = products.reduce((sum, p) => sum + (p.stocks || 0), 0);
  const lowStockItems = products.filter(p => p.stock_status === 'Low Stock').length;
  const outOfStockItems = products.filter(p => p.stock_status === 'Out of Stock').length;

  // Stock by variety chart data — include all varieties even if no products
  const varietyStock = useMemo(() => {
    const map = {};
    // Start with all varieties from DB
    varieties.forEach(c => {
      if (c.status === 'Active') {
        map[c.name] = { name: c.name, stock: 0 };
      }
    });
    // Add actual product stock
    products.forEach(p => {
      const name = p.variety_name || 'Uncategorized';
      if (!map[name]) map[name] = { name, stock: 0 };
      map[name].stock += (p.stocks || 0);
    });
    return Object.values(map).sort((a, b) => b.stock - a.stock);
  }, [products, varieties]);

  // ─── In/Out Tab: Stock movement chart data (Procurement-style) ─
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  // Helper: get the week ranges for a given month/year
  const getWeeksInMonth = useCallback((year, month) => {
    const weeks = [];
    const firstDay = new Date(year, month, 1);
    let start = new Date(firstDay);
    const dayOfWeek = start.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + diff);
    while (start.getMonth() <= month || (start.getMonth() > month && start.getFullYear() < year) || weeks.length === 0) {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${months[start.getMonth()]} ${start.getDate()} - ${months[end.getMonth()]} ${end.getDate()}`;
      weeks.push({ start: new Date(start), end: new Date(end), label });
      start.setDate(start.getDate() + 7);
      if (start.getMonth() > month && start.getFullYear() === year) break;
      if (start.getFullYear() > year) break;
      if (weeks.length >= 6) break;
    }
    return weeks;
  }, []);

  // In/Out: check if a stock log is within current chart scope
  const isInOutInScope = useCallback((log) => {
    if (!log.created_at) return false;
    const date = new Date(log.created_at);
    if (chartPeriod === 'daily') {
      const [y, m] = chartMonth.split('-').map(Number);
      return date.getFullYear() === y && date.getMonth() === m - 1;
    }
    if (chartPeriod === 'weekly') {
      const [y, m] = chartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      if (weeks.length === 0) return false;
      return date >= weeks[0].start && date <= new Date(weeks[weeks.length - 1].end.getFullYear(), weeks[weeks.length - 1].end.getMonth(), weeks[weeks.length - 1].end.getDate(), 23, 59, 59);
    }
    if (chartPeriod === 'monthly') return date.getFullYear() === chartYear;
    if (chartPeriod === 'bi-annually') return date.getFullYear() === chartYear;
    if (chartPeriod === 'annually') return date.getFullYear() >= chartYearFrom && date.getFullYear() <= chartYearTo;
    return true;
  }, [chartPeriod, chartMonth, chartYear, chartYearFrom, chartYearTo, getWeeksInMonth]);

  // In/Out: check if a stock log matches the active chart point
  const matchesInOutChartPoint = useCallback((log) => {
    if (!activeChartPoint || !log.created_at) return true;
    const date = new Date(log.created_at);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (chartPeriod === 'daily') {
      const [y, m] = chartMonth.split('-').map(Number);
      return date.getFullYear() === y && date.getMonth() === m - 1 && String(date.getDate()) === activeChartPoint;
    }
    if (chartPeriod === 'weekly') {
      const [y, m] = chartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      const week = weeks.find(w => w.label === activeChartPoint);
      if (!week) return false;
      return date >= week.start && date <= new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59);
    }
    if (chartPeriod === 'monthly') return date.getFullYear() === chartYear && months[date.getMonth()] === activeChartPoint;
    if (chartPeriod === 'bi-annually') {
      if (activeChartPoint === 'H1') return date.getFullYear() === chartYear && date.getMonth() < 6;
      if (activeChartPoint === 'H2') return date.getFullYear() === chartYear && date.getMonth() >= 6;
      return false;
    }
    if (chartPeriod === 'annually') return String(date.getFullYear()) === activeChartPoint;
    return true;
  }, [activeChartPoint, chartPeriod, chartMonth, chartYear, getWeeksInMonth]);

  const chartFilteredStockLogs = useMemo(() => {
    if (!chartScopeActive && !activeChartPoint) return stockLogs;
    const scoped = stockLogs.filter(isInOutInScope);
    if (!activeChartPoint) return scoped;
    return scoped.filter(matchesInOutChartPoint);
  }, [stockLogs, isInOutInScope, activeChartPoint, matchesInOutChartPoint, chartScopeActive]);

  // ─── Aggregate stock logs by product + type + period bucket ──────
  const aggregatedStockLogs = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Build a bucket key for each log based on chartPeriod
    const getBucketKey = (log) => {
      if (!log.created_at) return null;
      const d = new Date(log.created_at);
      if (chartPeriod === 'daily') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (chartPeriod === 'weekly') {
        const [y, m] = chartMonth.split('-').map(Number);
        const weeks = getWeeksInMonth(y, m - 1);
        const match = weeks.find(w => d >= w.start && d <= new Date(w.end.getFullYear(), w.end.getMonth(), w.end.getDate(), 23, 59, 59));
        return match ? match.label : `${d.getFullYear()}-W?`;
      }
      if (chartPeriod === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (chartPeriod === 'bi-annually') return `${d.getFullYear()}-${d.getMonth() < 6 ? 'H1' : 'H2'}`;
      if (chartPeriod === 'annually') return `${d.getFullYear()}`;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const getBucketLabel = (log) => {
      if (!log.created_at) return '';
      const d = new Date(log.created_at);
      if (chartPeriod === 'daily') return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      if (chartPeriod === 'weekly') {
        const [y, m] = chartMonth.split('-').map(Number);
        const weeks = getWeeksInMonth(y, m - 1);
        const match = weeks.find(w => d >= w.start && d <= new Date(w.end.getFullYear(), w.end.getMonth(), w.end.getDate(), 23, 59, 59));
        return match ? `${match.label}, ${y}` : '';
      }
      if (chartPeriod === 'monthly') return `${months[d.getMonth()]} ${d.getFullYear()}`;
      if (chartPeriod === 'bi-annually') return `${d.getMonth() < 6 ? 'H1' : 'H2'} ${d.getFullYear()} (${d.getMonth() < 6 ? 'Jan - Jun' : 'Jul - Dec'})`;
      if (chartPeriod === 'annually') return `${d.getFullYear()}`;
      return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    };

    const groups = {};
    chartFilteredStockLogs.forEach(log => {
      const bucket = getBucketKey(log);
      if (!bucket) return;
      const key = `${log.product_id}_${log.type}_${bucket}`;
      if (!groups[key]) {
        groups[key] = {
          _groupKey: key,
          product_id: log.product_id,
          product_name: log.product_name,
          variety_name: log.variety_name,
          variety_color: log.variety_color,
          type: log.type,
          bucket,
          bucket_label: getBucketLabel(log),
          quantity_change: 0,
          kg_amount: 0,
          total_cost: 0,
          movement_count: 0,
          _logs: [],
          // Keep the source_type breakdown
          _sourceTypes: {},
          created_at: log.created_at,
        };
      }
      const g = groups[key];
      g.quantity_change += log.quantity_change || 0;
      g.kg_amount += log.kg_amount ? parseFloat(log.kg_amount) : 0;
      g.total_cost += log.total_cost || 0;
      g.movement_count += 1;
      g._logs.push(log);
      if (log.source_type) g._sourceTypes[log.source_type] = (g._sourceTypes[log.source_type] || 0) + 1;
      // Keep earliest created_at for sorting
      if (new Date(log.created_at) < new Date(g.created_at)) g.created_at = log.created_at;
    });

    return Object.values(groups).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [chartFilteredStockLogs, chartPeriod, chartMonth, getWeeksInMonth]);

  const inOutChartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const getLogGroups = (filterFn) => {
      const groups = {};
      stockLogs.forEach(log => {
        if (!log.created_at) return;
        const date = new Date(log.created_at);
        if (!filterFn(date)) return;
        const key = filterFn.keyFn(date);
        if (!groups[key]) groups[key] = { stock_in: 0, stock_out: 0 };
        if (log.type === 'in') groups[key].stock_in += log.quantity_change;
        else groups[key].stock_out += log.quantity_change;
      });
      return groups;
    };

    if (chartPeriod === 'daily') {
      const [y, m] = chartMonth.split('-').map(Number);
      const daysInMonth = getDaysInMonth(y, m - 1);
      const dayGroups = {};
      stockLogs.forEach(log => {
        if (!log.created_at) return;
        const date = new Date(log.created_at);
        if (date.getFullYear() === y && date.getMonth() === m - 1) {
          const day = date.getDate();
          if (!dayGroups[day]) dayGroups[day] = { stock_in: 0, stock_out: 0 };
          if (log.type === 'in') dayGroups[day].stock_in += log.quantity_change;
          else dayGroups[day].stock_out += log.quantity_change;
        }
      });
      return Array.from({ length: daysInMonth }, (_, i) => ({
        name: String(i + 1),
        stock_in: dayGroups[i + 1]?.stock_in || 0,
        stock_out: dayGroups[i + 1]?.stock_out || 0,
      }));
    }
    if (chartPeriod === 'weekly') {
      const [y, m] = chartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      return weeks.map(week => {
        let stock_in = 0, stock_out = 0;
        stockLogs.forEach(log => {
          if (!log.created_at) return;
          const date = new Date(log.created_at);
          if (date >= week.start && date <= new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59)) {
            if (log.type === 'in') stock_in += log.quantity_change;
            else stock_out += log.quantity_change;
          }
        });
        return { name: week.label, stock_in, stock_out };
      });
    }
    if (chartPeriod === 'monthly') {
      const monthGroups = {};
      stockLogs.forEach(log => {
        if (!log.created_at) return;
        const date = new Date(log.created_at);
        if (date.getFullYear() === chartYear) {
          const month = date.getMonth();
          if (!monthGroups[month]) monthGroups[month] = { stock_in: 0, stock_out: 0 };
          if (log.type === 'in') monthGroups[month].stock_in += log.quantity_change;
          else monthGroups[month].stock_out += log.quantity_change;
        }
      });
      return months.map((name, i) => ({
        name,
        stock_in: monthGroups[i]?.stock_in || 0,
        stock_out: monthGroups[i]?.stock_out || 0,
      }));
    }
    if (chartPeriod === 'bi-annually') {
      const h1 = { stock_in: 0, stock_out: 0 }, h2 = { stock_in: 0, stock_out: 0 };
      stockLogs.forEach(log => {
        if (!log.created_at) return;
        const date = new Date(log.created_at);
        if (date.getFullYear() === chartYear) {
          const target = date.getMonth() < 6 ? h1 : h2;
          if (log.type === 'in') target.stock_in += log.quantity_change;
          else target.stock_out += log.quantity_change;
        }
      });
      return [
        { name: 'H1', fullName: `Jan - Jun ${chartYear}`, stock_in: h1.stock_in, stock_out: h1.stock_out },
        { name: 'H2', fullName: `Jul - Dec ${chartYear}`, stock_in: h2.stock_in, stock_out: h2.stock_out },
      ];
    }
    // annually
    const years = [];
    for (let y = chartYearFrom; y <= chartYearTo; y++) years.push(y);
    const yearGroups = {};
    stockLogs.forEach(log => {
      if (!log.created_at) return;
      const year = new Date(log.created_at).getFullYear();
      if (year >= chartYearFrom && year <= chartYearTo) {
        if (!yearGroups[year]) yearGroups[year] = { stock_in: 0, stock_out: 0 };
        if (log.type === 'in') yearGroups[year].stock_in += log.quantity_change;
        else yearGroups[year].stock_out += log.quantity_change;
      }
    });
    return years.map(year => ({
      name: year.toString(),
      stock_in: yearGroups[year]?.stock_in || 0,
      stock_out: yearGroups[year]?.stock_out || 0,
    }));
  }, [stockLogs, chartPeriod, chartMonth, chartYear, chartYearFrom, chartYearTo, getWeeksInMonth]);

  // In/Out: Stock distributed by variety (donut) — filtered by scope + activeChartPoint
  const varietyDistribution = useMemo(() => {
    const map = {};
    const scopeActive = chartScopeActive || activeChartPoint;
    const logsToUse = stockLogs.length > 0 ? stockLogs.filter(l => l.type === 'in') : [];

    if (logsToUse.length > 0) {
      logsToUse.forEach(log => {
        if (scopeActive && !isInOutInScope(log)) return;
        if (scopeActive && !matchesInOutChartPoint(log)) return;
        const variety = log.variety_name || 'Unknown';
        if (!map[variety]) map[variety] = { name: variety, value: 0 };
        map[variety].value += log.quantity_change;
      });
    } else {
      // Fallback to completedProcessings
      completedProcessings.forEach(p => {
        const ds = p.drying_sources?.[0];
        const variety = ds?.variety_name || 'Unknown';
        if (!map[variety]) map[variety] = { name: variety, value: 0 };
        map[variety].value += (p.stock_out || 0);
      });
    }

    return Object.values(map).filter(v => v.value > 0).sort((a, b) => b.value - a.value);
  }, [stockLogs, completedProcessings, isInOutInScope, matchesInOutChartPoint, chartScopeActive, activeChartPoint]);

  // In/Out: Product breakdown donut — filtered by scope + activeChartPoint
  const productBreakdown = useMemo(() => {
    const colors = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#8b5cf6'];
    const map = {};
    const scopeActive = chartScopeActive || activeChartPoint;

    stockLogs.filter(l => l.type === 'in').forEach(log => {
      if (scopeActive && !isInOutInScope(log)) return;
      if (scopeActive && !matchesInOutChartPoint(log)) return;
      const name = log.product_name || 'Unknown';
      if (!map[name]) map[name] = { name, value: 0 };
      map[name].value += log.quantity_change;
    });

    return Object.values(map)
      .filter(v => v.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((item, idx) => ({ ...item, color: colors[idx % colors.length] }));
  }, [stockLogs, isInOutInScope, matchesInOutChartPoint, chartScopeActive, activeChartPoint]);

  // In/Out stats — filtered by scope + activeChartPoint
  const inOutStats = useMemo(() => {
    let totalIn = 0, totalOut = 0, inCount = 0, outCount = 0;
    const scopeActive = chartScopeActive || activeChartPoint;

    stockLogs.forEach(log => {
      if (scopeActive && !isInOutInScope(log)) return;
      if (scopeActive && !matchesInOutChartPoint(log)) return;
      if (log.type === 'in') { totalIn += log.quantity_change; inCount++; }
      else { totalOut += log.quantity_change; outCount++; }
    });

    return { totalIn, totalOut, inCount, outCount, netChange: totalIn - totalOut };
  }, [stockLogs, isInOutInScope, matchesInOutChartPoint, chartScopeActive, activeChartPoint]);

  // ─── Cost Records: Distribution logs with cost data ──────
  const costRecords = useMemo(() => {
    // Build a lookup of current product info by product_id
    const productMap = {};
    products.forEach(p => {
      productMap[p.product_id] = {
        price: parseFloat(p.price) || 0,
        weight: p.weight,
        unit: p.unit,
      };
    });

    return stockLogs
      .filter(l => l.type === 'in' && l.total_cost !== null && l.total_cost !== undefined)
      .map(log => {
        const product = productMap[log.product_id];
        const currentPrice = product?.price ?? (log.selling_price ? parseFloat(log.selling_price) : 0);
        const costPerUnit = log.cost_per_unit ? parseFloat(log.cost_per_unit) : 0;
        const profitPerUnit = currentPrice - costPerUnit;
        const profitMargin = currentPrice > 0 ? (profitPerUnit / currentPrice) * 100 : 0;
        return {
          ...log,
          selling_price: currentPrice,
          profit_per_unit: profitPerUnit,
          profit_margin: profitMargin,
          product_weight: product?.weight || null,
          product_unit: product?.unit || null,
        };
      });
  }, [stockLogs, products]);

  const costStats = useMemo(() => {
    if (costRecords.length === 0) return { totalCost: 0, avgCostPerUnit: 0, avgProfitPerUnit: 0, avgMargin: 0, totalUnits: 0, totalProfit: 0 };

    const totalCost = costRecords.reduce((s, r) => s + (r.total_cost || 0), 0);
    const totalUnits = costRecords.reduce((s, r) => s + (r.quantity_change || 0), 0);
    const avgCostPerUnit = totalUnits > 0 ? totalCost / totalUnits : 0;
    const profitRecords = costRecords.filter(r => r.profit_per_unit !== null && r.profit_per_unit !== undefined);
    const avgProfitPerUnit = profitRecords.length > 0 ? profitRecords.reduce((s, r) => s + parseFloat(r.profit_per_unit), 0) / profitRecords.length : 0;
    const marginRecords = costRecords.filter(r => r.profit_margin !== null && r.profit_margin !== undefined);
    const avgMargin = marginRecords.length > 0 ? marginRecords.reduce((s, r) => s + parseFloat(r.profit_margin), 0) / marginRecords.length : 0;
    const totalProfit = profitRecords.reduce((s, r) => s + (parseFloat(r.profit_per_unit) * (r.quantity_change || 0)), 0);

    return { totalCost, avgCostPerUnit, avgProfitPerUnit, avgMargin, totalUnits, totalProfit };
  }, [costRecords]);

  // ─── Growth Analysis: Sales-based growth over time ──────
  const completedSales = useMemo(() => sales.filter(s => s.status === 'completed' || s.status === 'delivered'), [sales]);

  // Chart data — matches Procurement pattern: { name, value, quantity }
  const growthChartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (growthChartPeriod === 'daily') {
      const [y, m] = growthChartMonth.split('-').map(Number);
      const daysInMonth = getDaysInMonth(y, m - 1);
      const dayGroups = {};
      completedSales.forEach(sale => {
        if (!sale.created_at) return;
        const date = new Date(sale.created_at);
        if (date.getFullYear() === y && date.getMonth() === m - 1) {
          const day = date.getDate();
          if (!dayGroups[day]) dayGroups[day] = { value: 0, quantity: 0 };
          dayGroups[day].value += sale.total || 0;
          dayGroups[day].quantity += sale.total_quantity || 0;
        }
      });
      return Array.from({ length: daysInMonth }, (_, i) => ({
        name: String(i + 1),
        value: dayGroups[i + 1]?.value || 0,
        quantity: dayGroups[i + 1]?.quantity || 0,
      }));
    }
    if (growthChartPeriod === 'weekly') {
      const [y, m] = growthChartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      return weeks.map(week => {
        let value = 0, quantity = 0;
        completedSales.forEach(sale => {
          if (!sale.created_at) return;
          const date = new Date(sale.created_at);
          if (date >= week.start && date <= new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59)) {
            value += sale.total || 0;
            quantity += sale.total_quantity || 0;
          }
        });
        return { name: week.label, value, quantity };
      });
    }
    if (growthChartPeriod === 'monthly') {
      const monthGroups = {};
      completedSales.forEach(sale => {
        if (!sale.created_at) return;
        const date = new Date(sale.created_at);
        if (date.getFullYear() === growthChartYear) {
          const month = date.getMonth();
          if (!monthGroups[month]) monthGroups[month] = { value: 0, quantity: 0 };
          monthGroups[month].value += sale.total || 0;
          monthGroups[month].quantity += sale.total_quantity || 0;
        }
      });
      return months.map((name, i) => ({
        name,
        value: monthGroups[i]?.value || 0,
        quantity: monthGroups[i]?.quantity || 0,
      }));
    }
    if (growthChartPeriod === 'bi-annually') {
      const h1 = { value: 0, quantity: 0 }, h2 = { value: 0, quantity: 0 };
      completedSales.forEach(sale => {
        if (!sale.created_at) return;
        const date = new Date(sale.created_at);
        if (date.getFullYear() === growthChartYear) {
          const target = date.getMonth() < 6 ? h1 : h2;
          target.value += sale.total || 0;
          target.quantity += sale.total_quantity || 0;
        }
      });
      return [
        { name: 'H1', fullName: `Jan - Jun ${growthChartYear}`, value: h1.value, quantity: h1.quantity },
        { name: 'H2', fullName: `Jul - Dec ${growthChartYear}`, value: h2.value, quantity: h2.quantity },
      ];
    }
    // annually
    const years = [];
    for (let y = growthChartYearFrom; y <= growthChartYearTo; y++) years.push(y);
    const yearGroups = {};
    completedSales.forEach(sale => {
      if (!sale.created_at) return;
      const year = new Date(sale.created_at).getFullYear();
      if (year >= growthChartYearFrom && year <= growthChartYearTo) {
        if (!yearGroups[year]) yearGroups[year] = { value: 0, quantity: 0 };
        yearGroups[year].value += sale.total || 0;
        yearGroups[year].quantity += sale.total_quantity || 0;
      }
    });
    return years.map(year => ({
      name: year.toString(),
      value: yearGroups[year]?.value || 0,
      quantity: yearGroups[year]?.quantity || 0,
    }));
  }, [completedSales, growthChartPeriod, growthChartMonth, growthChartYear, growthChartYearFrom, growthChartYearTo, getWeeksInMonth]);

  // Sales stats (overall)
  const growthStats = useMemo(() => {
    const totalRevenue = completedSales.reduce((s, sale) => s + (sale.total || 0), 0);
    const totalTransactions = completedSales.length;
    const totalUnitsSold = completedSales.reduce((s, sale) => s + (sale.total_quantity || 0), 0);
    const avgTransaction = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;
    return { totalRevenue, totalTransactions, totalUnitsSold, avgTransaction };
  }, [completedSales]);

  // ─── Computed Product Growth (frontend, like In/Out) ──────
  // Compares the "current" period vs "previous" period per product.
  // When a chart dot is clicked (activeGrowthChartPoint), that specific segment vs its predecessor.
  // Otherwise defaults to today vs yesterday / this week vs last week / etc.
  const computedProductGrowth = useMemo(() => {
    const now = new Date();
    let currentStart, currentEnd, previousStart, previousEnd;

    if (growthChartPeriod === 'custom' && growthCustomStart && growthCustomEnd) {
      currentStart = new Date(growthCustomStart + 'T00:00:00');
      currentEnd = new Date(growthCustomEnd + 'T23:59:59');
      const duration = Math.ceil((currentEnd - currentStart) / (1000 * 60 * 60 * 24));
      previousEnd = new Date(currentStart); previousEnd.setDate(previousEnd.getDate() - 1); previousEnd.setHours(23, 59, 59);
      previousStart = new Date(previousEnd); previousStart.setDate(previousStart.getDate() - duration + 1); previousStart.setHours(0, 0, 0);

    } else if (growthChartPeriod === 'daily') {
      const [y, m] = growthChartMonth.split('-').map(Number);
      let day;
      if (activeGrowthChartPoint) {
        day = parseInt(activeGrowthChartPoint);
      } else {
        const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;
        day = isCurrentMonth ? now.getDate() : new Date(y, m, 0).getDate();
      }
      currentStart = new Date(y, m - 1, day);
      currentEnd = new Date(y, m - 1, day, 23, 59, 59);
      if (day > 1) {
        previousStart = new Date(y, m - 1, day - 1);
        previousEnd = new Date(y, m - 1, day - 1, 23, 59, 59);
      } else {
        const pm = m === 1 ? 12 : m - 1; const py = m === 1 ? y - 1 : y;
        const lastD = new Date(py, pm, 0).getDate();
        previousStart = new Date(py, pm - 1, lastD); previousEnd = new Date(py, pm - 1, lastD, 23, 59, 59);
      }

    } else if (growthChartPeriod === 'weekly') {
      const [y, m] = growthChartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      let targetWeek = null;
      if (activeGrowthChartPoint) {
        targetWeek = weeks.find(w => w.label === activeGrowthChartPoint);
      } else {
        const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;
        if (isCurrentMonth) targetWeek = weeks.find(w => now >= w.start && now <= new Date(w.end.getFullYear(), w.end.getMonth(), w.end.getDate(), 23, 59, 59));
        if (!targetWeek) targetWeek = weeks[weeks.length - 1];
      }
      if (targetWeek) {
        currentStart = targetWeek.start;
        currentEnd = new Date(targetWeek.end.getFullYear(), targetWeek.end.getMonth(), targetWeek.end.getDate(), 23, 59, 59);
        // Always go exactly 7 days back — avoids the overlap bug where getWeeksInMonth
        // for the previous month returns the same Monday-Sunday span as week 1 of current month
        previousStart = new Date(currentStart); previousStart.setDate(previousStart.getDate() - 7);
        previousEnd   = new Date(currentEnd);   previousEnd.setDate(previousEnd.getDate() - 7);
      } else {
        currentStart = new Date(y, m - 1, 1); currentEnd = new Date(y, m, 0, 23, 59, 59);
        previousStart = new Date(y, m - 2, 1); previousEnd = new Date(y, m - 1, 0, 23, 59, 59);
      }

    } else if (growthChartPeriod === 'monthly') {
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      let mIdx;
      if (activeGrowthChartPoint) {
        mIdx = monthNames.indexOf(activeGrowthChartPoint);
      } else {
        const isCurrentYear = growthChartYear === now.getFullYear();
        mIdx = isCurrentYear ? now.getMonth() : 11;
      }
      if (mIdx < 0) mIdx = 0;
      currentStart = new Date(growthChartYear, mIdx, 1);
      currentEnd = new Date(growthChartYear, mIdx + 1, 0, 23, 59, 59);
      if (mIdx > 0) {
        previousStart = new Date(growthChartYear, mIdx - 1, 1);
        previousEnd = new Date(growthChartYear, mIdx, 0, 23, 59, 59);
      } else {
        previousStart = new Date(growthChartYear - 1, 11, 1);
        previousEnd = new Date(growthChartYear - 1, 11, 31, 23, 59, 59);
      }

    } else if (growthChartPeriod === 'bi-annually') {
      let half;
      if (activeGrowthChartPoint) {
        half = activeGrowthChartPoint === 'H1' ? 1 : 2;
      } else {
        const isCurrentYear = growthChartYear === now.getFullYear();
        half = isCurrentYear ? (now.getMonth() < 6 ? 1 : 2) : 2;
      }
      if (half === 1) {
        currentStart = new Date(growthChartYear, 0, 1); currentEnd = new Date(growthChartYear, 5, 30, 23, 59, 59);
        previousStart = new Date(growthChartYear - 1, 6, 1); previousEnd = new Date(growthChartYear - 1, 11, 31, 23, 59, 59);
      } else {
        currentStart = new Date(growthChartYear, 6, 1); currentEnd = new Date(growthChartYear, 11, 31, 23, 59, 59);
        previousStart = new Date(growthChartYear, 0, 1); previousEnd = new Date(growthChartYear, 5, 30, 23, 59, 59);
      }

    } else {
      // annually
      let refYear = activeGrowthChartPoint ? parseInt(activeGrowthChartPoint) : growthChartYearTo;
      currentStart = new Date(refYear, 0, 1); currentEnd = new Date(refYear, 11, 31, 23, 59, 59);
      previousStart = new Date(refYear - 1, 0, 1); previousEnd = new Date(refYear - 1, 11, 31, 23, 59, 59);
    }

    // Build product lookup for current stock
    const productLookup = {};
    products.forEach(p => {
      productLookup[p.product_id] = { stocks: p.stocks || 0, variety_name: p.variety_name || 'Unknown', variety_color: p.variety_color || '#6B7280' };
    });

    // Aggregate per-product from sale items
    const productData = {};
    completedSales.forEach(sale => {
      if (!sale.created_at || !sale.items) return;
      const saleDate = new Date(sale.created_at);
      const isCurrent  = saleDate >= currentStart && saleDate <= currentEnd;
      const isPrevious = saleDate >= previousStart && saleDate <= previousEnd;
      if (!isCurrent && !isPrevious) return;
      sale.items.forEach(item => {
        const pid = item.product_id;
        if (!productData[pid]) {
          const pInfo = productLookup[pid] || {};
          productData[pid] = {
            product_id: pid,
            product_name: item.product_name || 'Unknown',
            variety_name: item.variety_name || pInfo.variety_name || 'Unknown',
            variety_color: item.variety_color || pInfo.variety_color || '#6B7280',
            current_stock: pInfo.stocks || 0,
            current_qty: 0, previous_qty: 0, current_revenue: 0, previous_revenue: 0,
          };
        }
        if (isCurrent)       { productData[pid].current_qty += item.quantity || 0; productData[pid].current_revenue += item.subtotal || 0; }
        else if (isPrevious) { productData[pid].previous_qty += item.quantity || 0; productData[pid].previous_revenue += item.subtotal || 0; }
      });
    });

    Object.values(productData).forEach(p => {
      p.stock_before = p.current_stock + p.current_qty;
      p.qty_growth = p.previous_qty > 0 ? Math.round(((p.current_qty - p.previous_qty) / p.previous_qty) * 1000) / 10 : (p.current_qty > 0 ? 100 : 0);
      p.revenue_growth = p.previous_revenue > 0 ? Math.round(((p.current_revenue - p.previous_revenue) / p.previous_revenue) * 1000) / 10 : (p.current_revenue > 0 ? 100 : 0);
      p.trend = p.qty_growth > 0 ? 'up' : (p.qty_growth < 0 ? 'down' : 'stable');
    });

    const productList = Object.values(productData).sort((a, b) => b.current_revenue - a.current_revenue);
    const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return {
      products: productList,
      period: growthChartPeriod,
      current_range: { start: fmtDate(currentStart), end: fmtDate(currentEnd) },
      previous_range: { start: fmtDate(previousStart), end: fmtDate(previousEnd) },
      _currentStart: currentStart,
      _currentEnd: currentEnd,
    };
  }, [completedSales, products, growthChartPeriod, growthChartMonth, growthChartYear, growthChartYearFrom, growthChartYearTo, growthCustomStart, growthCustomEnd, activeGrowthChartPoint, getWeeksInMonth]);

  // Helper: does a sale match the current activeGrowthChartPoint filter?
  const matchesGrowthChartPoint = useCallback((createdAt) => {
    if (!activeGrowthChartPoint || !createdAt) return true;
    const date = new Date(createdAt);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (growthChartPeriod === 'daily') {
      const [y, m] = growthChartMonth.split('-').map(Number);
      return date.getFullYear() === y && date.getMonth() === m - 1 && String(date.getDate()) === activeGrowthChartPoint;
    }
    if (growthChartPeriod === 'weekly') {
      const [y, m] = growthChartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      const week = weeks.find(w => w.label === activeGrowthChartPoint);
      if (!week) return false;
      return date >= week.start && date <= new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59);
    }
    if (growthChartPeriod === 'monthly') return date.getFullYear() === growthChartYear && months[date.getMonth()] === activeGrowthChartPoint;
    if (growthChartPeriod === 'bi-annually') {
      if (activeGrowthChartPoint === 'H1') return date.getFullYear() === growthChartYear && date.getMonth() < 6;
      if (activeGrowthChartPoint === 'H2') return date.getFullYear() === growthChartYear && date.getMonth() >= 6;
      return false;
    }
    if (growthChartPeriod === 'annually') return String(date.getFullYear()) === activeGrowthChartPoint;
    return true;
  }, [activeGrowthChartPoint, growthChartPeriod, growthChartMonth, growthChartYear, getWeeksInMonth]);

  // Filtered sales for table (respects chart scope + point click)
  const filteredGrowthSales = useMemo(() => {
    if (!growthChartScopeActive && !activeGrowthChartPoint) return completedSales;
    return completedSales.filter(sale => {
      if (!sale.created_at) return false;
      const date = new Date(sale.created_at);
      // Scope to current period calendar setting
      if (growthChartPeriod === 'daily') {
        const [y, m] = growthChartMonth.split('-').map(Number);
        if (date.getFullYear() !== y || date.getMonth() !== m - 1) return false;
      }
      if (growthChartPeriod === 'weekly') {
        const [y, m] = growthChartMonth.split('-').map(Number);
        const weeks = getWeeksInMonth(y, m - 1);
        if (weeks.length === 0) return false;
        if (date < weeks[0].start || date > new Date(weeks[weeks.length - 1].end.getFullYear(), weeks[weeks.length - 1].end.getMonth(), weeks[weeks.length - 1].end.getDate(), 23, 59, 59)) return false;
      }
      if (growthChartPeriod === 'monthly' && date.getFullYear() !== growthChartYear) return false;
      if (growthChartPeriod === 'bi-annually' && date.getFullYear() !== growthChartYear) return false;
      if (growthChartPeriod === 'annually' && (date.getFullYear() < growthChartYearFrom || date.getFullYear() > growthChartYearTo)) return false;
      return matchesGrowthChartPoint(sale.created_at);
    });
  }, [completedSales, growthChartPeriod, growthChartMonth, growthChartYear, growthChartYearFrom, growthChartYearTo, matchesGrowthChartPoint, getWeeksInMonth, growthChartScopeActive, activeGrowthChartPoint]);

  // ─── Columns ─────────────────────────────────────────────────

  const columns = useMemo(() => [
    { header: 'Product Name', accessor: 'product_name' },
    {
      header: 'Variety',
      accessor: 'variety_name',
      cell: (row) => (
        <span
          className="px-2 py-1 rounded-full text-xs font-medium"
          style={{
            backgroundColor: `${row.variety_color}20`,
            color: row.variety_color
          }}
        >
          {row.variety_name}
        </span>
      )
    },
    {
      header: 'Price',
      accessor: 'price_formatted',
      cell: (row) => (
        <span className="font-semibold text-green-600 dark:text-green-400">{row.price_formatted}</span>
      )
    },
    {
      header: 'Weight',
      accessor: 'weight',
      cell: (row) => (
        <span className="text-gray-600 dark:text-gray-300">{row.weight ? `${parseFloat(row.weight).toLocaleString()} kg` : '-'}</span>
      )
    },
    {
      header: 'Stocks',
      accessor: 'stocks',
      cell: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-medium ${
              row.stock_status === 'Out of Stock' ? 'text-red-500' :
              row.stock_status === 'Low Stock' ? 'text-orange-500' :
              'text-blue-600 dark:text-blue-400'
            }`}>
              {(row.stocks || 0).toLocaleString()}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{row.unit}</span>
          </div>
          {row.weight && row.stocks > 0 && (
            <p className="text-[10px] text-gray-400">{((row.stocks || 0) * parseFloat(row.weight)).toLocaleString()} kg total</p>
          )}
        </div>
      )
    },
    {
      header: 'Floor Qty',
      accessor: 'stock_floor',
      cell: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleOpenFloor(row); }}
          className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-button-600 dark:hover:text-button-400 dark:text-button-400 hover:underline cursor-pointer"
          title="Click to set floor quantity"
        >
          {(row.stock_floor || 0).toLocaleString()}
        </button>
      )
    },
    {
      header: 'Stock Status',
      accessor: 'stock_status',
      cell: (row) => (
        <StatusBadge status={row.stock_status} />
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenAddStock(row); }}
            className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-green-500 hover:text-green-700 dark:text-green-400 transition-colors"
            title="Add Stock"
          >
            <Box size={15} />
          </button>
          <ActionButtons
            onEdit={() => handleEdit(row)}
            onArchive={isSuperAdmin() && (row.stocks || 0) === 0 && !row.has_pending_orders ? () => handleDelete(row) : undefined}
          />
        </div>
      )
    }
  ], [handleView, handleEdit, handleDelete, handleOpenAddStock, handleOpenFloor]);

  // ─── View Detail Item ────────────────────────────────────────

  const ViewDetailItem = ({ icon: Icon, label, value, iconColor = 'text-button-500', compact = false }) => (
    <div className={`flex items-start gap-2 ${compact ? 'p-2' : 'p-3'} bg-primary-50 dark:bg-primary-900/20 rounded-xl border-2 border-primary-200 dark:border-primary-700`}>
      <div className={`${compact ? 'p-1.5' : 'p-2'} rounded-lg bg-white dark:bg-gray-700 shadow-sm ${iconColor}`}>
        <Icon size={compact ? 14 : 18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate`}>{label}</p>
        <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-gray-800 dark:text-gray-100 mt-0.5 truncate`}>{value}</p>
      </div>
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────

  const tabs = [
    { key: 'inventory', label: 'Inventory', icon: Warehouse },
    { key: 'inout', label: 'In / Out', icon: ArrowDownUp },
    { key: 'growth', label: 'Growth Analysis', icon: TrendingUp },
    { key: 'costs', label: 'Cost Records', icon: Receipt },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track and manage your product stock levels"
        icon={Warehouse}
        action={isRefreshing ? (
          <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">Syncing...</span>
        ) : null}
      />

      {/* Tab Navigation */}
      <div className="flex border-b-2 border-primary-200 dark:border-primary-700 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 text-sm font-semibold transition-all relative
              ${activeTab === tab.key
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 -mb-[2px] bg-primary-50 dark:bg-primary-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700/50'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <tab.icon size={16} />
              {tab.label}
            </div>
          </button>
        ))}
      </div>

      {/* ═══════════ INVENTORY TAB ═══════════ */}
      {activeTab === 'inventory' && (
        <>
          {/* Stats Cards */}
          {loading ? (
            <SkeletonStats count={4} className="mb-6" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard
                label="Total Products"
                value={totalProducts}
                unit={`${activeProducts} active`}
                icon={Package}
                iconBgColor="bg-gradient-to-br from-button-400 to-button-600"
              />
              <StatsCard
                label="Total Stock"
                value={totalStock.toLocaleString()}
                unit="units"
                icon={Warehouse}
                iconBgColor="bg-gradient-to-br from-button-500 to-button-700"
              />
              <StatsCard
                label="Low Stock"
                value={lowStockItems}
                unit={lowStockItems > 0 ? 'needs restocking' : 'all stocked'}
                icon={AlertTriangle}
                iconBgColor={lowStockItems > 0 ? "bg-gradient-to-br from-orange-400 to-orange-600" : "bg-gradient-to-br from-button-400 to-button-600"}
              />
              <StatsCard
                label="Out of Stock"
                value={outOfStockItems}
                unit={outOfStockItems > 0 ? 'action needed' : 'none'}
                icon={XCircle}
                iconBgColor={outOfStockItems > 0 ? "bg-gradient-to-br from-red-400 to-red-600" : "bg-gradient-to-br from-button-400 to-button-600"}
              />
            </div>
          )}

          {/* Stock by Variety Chart */}
          {!loading && varietyStock.length > 0 && (
            <div className="mb-6">
              <BarChart
                title="Stock by Variety"
                subtitle="Current inventory levels per variety"
                data={varietyStock}
                bars={[{ dataKey: 'stock', name: 'Stock' }]}
                height={200}
                layout="vertical"
                showLegend={false}
              />
            </div>
          )}

          {/* Inventory Table */}
          {loading ? (
            <SkeletonTable />
          ) : (
            <DataTable
              title="Inventory Items"
              subtitle="All products in stock"
              columns={columns}
              data={products}
              searchPlaceholder="Search inventory..."
              filterField="variety_name"
              filterPlaceholder="All Varieties"
              onAdd={handleAdd}
              addLabel="Add Product"
              onRowDoubleClick={handleView}
            />
          )}
        </>
      )}

      {/* ═══════════ IN / OUT TAB ═══════════ */}
      {activeTab === 'inout' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatsCard
              label="Stock In"
              value={inOutStats.totalIn.toLocaleString()}
              unit={`${inOutStats.inCount} movement${inOutStats.inCount !== 1 ? 's' : ''}`}
              icon={ArrowUpRight}
              iconBgColor="bg-gradient-to-br from-green-400 to-green-600"
            />
            <StatsCard
              label="Stock Out"
              value={inOutStats.totalOut.toLocaleString()}
              unit={`${inOutStats.outCount} movement${inOutStats.outCount !== 1 ? 's' : ''}`}
              icon={ArrowDownRight}
              iconBgColor="bg-gradient-to-br from-red-400 to-red-600"
            />
            <StatsCard
              label="Net Change"
              value={`${inOutStats.netChange >= 0 ? '+' : ''}${inOutStats.netChange.toLocaleString()}`}
              unit="units net"
              icon={ArrowDownUp}
              iconBgColor={inOutStats.netChange >= 0 ? "bg-gradient-to-br from-blue-400 to-blue-600" : "bg-gradient-to-br from-orange-400 to-orange-600"}
            />
            <StatsCard
              label="Total Movements"
              value={stockLogs.length}
              unit="all time"
              icon={TrendingUp}
              iconBgColor="bg-gradient-to-br from-purple-400 to-purple-600"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <LineChart
                title="Stock Movement Trends"
                subtitle={activeChartPoint ? `Filtered: ${activeChartPoint} — click dot again to clear` : "Stock in vs out activity overview"}
                data={inOutChartData}
                lines={[
                  { dataKey: 'stock_in', name: 'Stock In (units)' },
                  { dataKey: 'stock_out', name: 'Stock Out (units)' },
                ]}
                height={280}
                headerRight={
                  <div className="flex items-center gap-2 flex-wrap">
                    {(activeChartPoint || chartScopeActive) && (
                      <button
                        onClick={() => { setActiveChartPoint(null); setChartScopeActive(false); setChartPeriod('daily'); const d = new Date(); setChartMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); setChartYear(d.getFullYear()); setChartYearFrom(d.getFullYear()-4); setChartYearTo(d.getFullYear()); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      >
                        <X size={12} /> Clear Filter
                      </button>
                    )}
                    <select
                      value={chartPeriod}
                      onChange={(e) => { setChartPeriod(e.target.value); setActiveChartPoint(null); setChartScopeActive(true); }}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="bi-annually">Bi-Annually</option>
                      <option value="annually">Annually</option>
                    </select>
                    {(chartPeriod === 'daily' || chartPeriod === 'weekly') && (
                      <input
                        type="month"
                        value={chartMonth}
                        onChange={(e) => { setChartMonth(e.target.value); setActiveChartPoint(null); setChartScopeActive(true); }}
                        className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    )}
                    {(chartPeriod === 'monthly' || chartPeriod === 'bi-annually') && (
                      <input
                        type="number"
                        value={chartYear}
                        onChange={(e) => { setChartYear(parseInt(e.target.value) || new Date().getFullYear()); setActiveChartPoint(null); setChartScopeActive(true); }}
                        min="2000"
                        max={new Date().getFullYear()}
                        className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-24"
                      />
                    )}
                    {chartPeriod === 'annually' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={chartYearFrom}
                          onChange={(e) => { const v = parseInt(e.target.value) || 2000; setChartYearFrom(v); setActiveChartPoint(null); setChartScopeActive(true); }}
                          min="2000"
                          max={chartYearTo}
                          className="px-2 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-20"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">to</span>
                        <input
                          type="number"
                          value={chartYearTo}
                          onChange={(e) => { const v = parseInt(e.target.value) || new Date().getFullYear(); setChartYearTo(v); setActiveChartPoint(null); setChartScopeActive(true); }}
                          min={chartYearFrom}
                          max={new Date().getFullYear()}
                          className="px-2 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-20"
                        />
                      </div>
                    )}
                  </div>
                }
                onDotClick={(point) => { setActiveChartPoint(activeChartPoint === point ? null : point); setChartScopeActive(true); }}
                activePoint={activeChartPoint}
                yAxisUnit=" units"
                summaryStats={[
                  { label: 'Total In', value: inOutStats.totalIn.toLocaleString(), color: 'text-green-600 dark:text-green-400' },
                  { label: 'Total Out', value: inOutStats.totalOut.toLocaleString(), color: 'text-red-600 dark:text-red-400' },
                  { label: 'Net', value: `${inOutStats.netChange >= 0 ? '+' : ''}${inOutStats.netChange.toLocaleString()}`, color: inOutStats.netChange >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400' },
                ]}
              />
            </div>
            <div className="space-y-4">
              <DonutChart
                title="By Variety"
                subtitle="Stock added per variety"
                data={varietyDistribution}
                height={175}
                innerRadius={56}
                outerRadius={78}
                showLegend={true}
                horizontalLegend={true}
                unit="units"
              />
              {productBreakdown.length > 0 && (
                <DonutChart
                  title="Top Products"
                  subtitle="Most stocked products"
                  data={productBreakdown}
                  centerValue={`${productBreakdown.length}`}
                  centerLabel="Products"
                  height={140}
                  innerRadius={45}
                  outerRadius={62}
                  showLegend={true}
                  horizontalLegend={true}
                />
              )}
            </div>
          </div>

          {/* Stock Movement History Table */}
          <DataTable
            title="Stock Movement History"
            subtitle={chartScopeActive || activeChartPoint ? `Grouped by ${chartPeriod} period · Click row to see details` : "All stock movements · Click row to see details"}
            columns={[
              {
                header: 'Product',
                accessor: 'product_name',
                cell: (row) => (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.variety_color || '#6b7280' }} />
                    <div>
                      <span className="font-medium text-gray-800 dark:text-gray-100">{row.product_name}</span>
                      <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${row.variety_color}20`, color: row.variety_color }}>
                        {row.variety_name}
                      </span>
                    </div>
                  </div>
                )
              },
              {
                header: 'Type',
                accessor: 'type',
                cell: (row) => {
                  const sourceLabels = {
                    'processing_distribution': { label: 'Processing', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700' },
                    'order': { label: 'Order', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700' },
                    'order_cancelled': { label: 'Cancelled', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700' },
                    'order_return': { label: 'Restocked', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700' },
                    'return_loss': { label: 'Return Loss', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-700' },
                    'sale_void': { label: 'Voided', color: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
                  };
                  // For aggregated rows, show top source types
                  const sourceTypes = row._sourceTypes || (row.source_type ? { [row.source_type]: 1 } : {});
                  const topSources = Object.entries(sourceTypes).sort((a, b) => b[1] - a[1]).slice(0, 2);
                  return (
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        row.type === 'in'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                      }`}>
                        {row.type === 'in' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {row.type === 'in' ? 'IN' : 'OUT'}
                      </span>
                      {topSources.map(([src]) => {
                        const s = sourceLabels[src];
                        return s ? (
                          <span key={src} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${s.color} w-fit`}>
                            {s.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  );
                }
              },
              {
                header: 'Units',
                accessor: 'quantity_change',
                cell: (row) => (
                  <div>
                    <span className={`font-bold ${row.type === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {row.type === 'in' ? '+' : '-'}{row.quantity_change.toLocaleString()}
                    </span>
                    {row.kg_amount > 0 && (
                      <p className="text-[10px] text-gray-400">{row.kg_amount.toLocaleString()} kg</p>
                    )}
                  </div>
                )
              },
              {
                header: 'Movements',
                accessor: 'movement_count',
                cell: (row) => (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {row.movement_count} {row.movement_count === 1 ? 'entry' : 'entries'}
                  </span>
                )
              },
              {
                header: 'Period',
                accessor: 'bucket_label',
                cell: (row) => (
                  <span className="text-xs text-gray-600 dark:text-gray-300">{row.bucket_label}</span>
                )
              },
            ]}
            data={aggregatedStockLogs}
            searchPlaceholder="Search stock movements..."
            onRowDoubleClick={(row) => { setSelectedMovementGroup(row._logs || []); setIsMovementDetailOpen(true); }}
            pagination={true}
            defaultItemsPerPage={15}
          />
        </>
      )}

      {/* ═══════════ GROWTH ANALYSIS TAB ═══════════ */}
      {activeTab === 'growth' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard label="Total Sales" value={`₱${Number(growthStats.totalRevenue).toLocaleString()}`} unit="revenue" icon={DollarSign} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
            <StatsCard label="Transactions" value={growthStats.totalTransactions} unit="completed" icon={ShoppingCart} iconBgColor="bg-gradient-to-br from-green-400 to-green-600" />
            <StatsCard label="Units Sold" value={growthStats.totalUnitsSold.toLocaleString()} unit="items" icon={Package} iconBgColor="bg-gradient-to-br from-blue-400 to-blue-600" />
            <StatsCard label="Avg. Transaction" value={`₱${Number(growthStats.avgTransaction).toLocaleString()}`} unit="per sale" icon={TrendingUp} iconBgColor="bg-gradient-to-br from-button-500 to-button-700" />
          </div>

          {/* Sales Trends Chart (full width) */}
          <div className="mb-6">
            <LineChart
              title="Sales Trends"
              subtitle={activeGrowthChartPoint ? `Filtered: ${activeGrowthChartPoint} — click dot again to clear` : "Revenue from completed sales"}
              data={growthChartData}
              lines={[{ dataKey: 'value', name: 'Revenue (₱)' }]}
              height={280}
              yAxisUnit="₱"
              headerRight={
                <div className="flex items-center gap-2 flex-wrap">
                  {(activeGrowthChartPoint || growthChartScopeActive) && (
                    <button
                      onClick={() => { setActiveGrowthChartPoint(null); setGrowthChartScopeActive(false); setGrowthChartPeriod('daily'); const d = new Date(); setGrowthChartMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); setGrowthChartYear(d.getFullYear()); setGrowthChartYearFrom(d.getFullYear()-4); setGrowthChartYearTo(d.getFullYear()); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    >
                      <X size={12} /> Clear Filter
                    </button>
                  )}
                  <select
                    value={growthChartPeriod}
                    onChange={(e) => { setGrowthChartPeriod(e.target.value); setActiveGrowthChartPoint(null); setGrowthChartScopeActive(true); }}
                    className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="bi-annually">Bi-Annually</option>
                    <option value="annually">Annually</option>
                  </select>
                  {(growthChartPeriod === 'daily' || growthChartPeriod === 'weekly') && (
                    <input
                      type="month"
                      value={growthChartMonth}
                      onChange={(e) => { setGrowthChartMonth(e.target.value); setActiveGrowthChartPoint(null); setGrowthChartScopeActive(true); }}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                  {(growthChartPeriod === 'monthly' || growthChartPeriod === 'bi-annually') && (
                    <input
                      type="number"
                      value={growthChartYear}
                      onChange={(e) => { setGrowthChartYear(parseInt(e.target.value) || new Date().getFullYear()); setActiveGrowthChartPoint(null); setGrowthChartScopeActive(true); }}
                      min="2000"
                      max={new Date().getFullYear()}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-24"
                    />
                  )}
                  {growthChartPeriod === 'annually' && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={growthChartYearFrom}
                        onChange={(e) => { const v = parseInt(e.target.value) || 2000; setGrowthChartYearFrom(v); setActiveGrowthChartPoint(null); setGrowthChartScopeActive(true); }}
                        min="2000"
                        max={growthChartYearTo}
                        className="px-2 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-20"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">to</span>
                      <input
                        type="number"
                        value={growthChartYearTo}
                        onChange={(e) => { const v = parseInt(e.target.value) || new Date().getFullYear(); setGrowthChartYearTo(v); setActiveGrowthChartPoint(null); setGrowthChartScopeActive(true); }}
                        min={growthChartYearFrom}
                        max={new Date().getFullYear()}
                        className="px-2 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-20"
                      />
                    </div>
                  )}
                </div>
              }
              onDotClick={(point) => { setActiveGrowthChartPoint(activeGrowthChartPoint === point ? null : point); setGrowthChartScopeActive(true); }}
              activePoint={activeGrowthChartPoint}
              summaryStats={[
                { label: 'Transactions', value: filteredGrowthSales.length.toString(), color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Avg Sale', value: `₱${filteredGrowthSales.length > 0 ? Math.round(filteredGrowthSales.reduce((s, sale) => s + (sale.total || 0), 0) / filteredGrowthSales.length).toLocaleString() : 0}`, color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Units Sold', value: `${filteredGrowthSales.reduce((s, sale) => s + (sale.total_quantity || 0), 0).toLocaleString()}`, color: 'text-green-600 dark:text-green-400' },
              ]}
            />
          </div>

          {/* ── Per-Product Growth Table ── */}
            <DataTable
              title="Product Sales Growth"
              subtitle={(() => {
                const cr = computedProductGrowth?.current_range;
                const pr = computedProductGrowth?.previous_range;
                if (!cr || !pr) return 'Comparing current vs previous period';
                const fmt = (d) => { const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
                const current = cr.start === cr.end ? fmt(cr.start) : `${fmt(cr.start)} → ${fmt(cr.end)}`;
                const previous = pr.start === pr.end ? fmt(pr.start) : `${fmt(pr.start)} → ${fmt(pr.end)}`;
                return `Current: ${current}  vs  Previous: ${previous}`;
              })()}
              columns={[
                {
                  header: 'Product',
                  accessor: 'product_name',
                  cell: (row) => (
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.variety_color }} />
                      <div className="min-w-0">
                        <span className="font-bold text-content text-sm">{row.product_name}</span>
                        <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${row.variety_color}20`, color: row.variety_color }}>
                          {row.variety_name}
                        </span>
                      </div>
                    </div>
                  )
                },
                {
                  header: 'Stock Before',
                  accessor: 'stock_before',
                  cell: (row) => <span className="font-semibold text-gray-600 dark:text-gray-300">{(row.stock_before ?? 0).toLocaleString()}</span>
                },
                {
                  header: 'Units Sold',
                  accessor: 'current_qty',
                  cell: (row) => (
                    <div>
                      <span className="font-bold text-red-500">{row.current_qty.toLocaleString()}</span>
                      <p className="text-[10px] text-secondary">prev: {row.previous_qty.toLocaleString()}</p>
                    </div>
                  )
                },
                {
                  header: 'Current Stock',
                  accessor: 'current_stock',
                  cell: (row) => (
                    <span className={`font-bold ${row.current_stock <= 0 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                      {row.current_stock.toLocaleString()}
                    </span>
                  )
                },
                {
                  header: 'Qty Growth',
                  accessor: 'qty_growth',
                  cell: (row) => (
                    <div className={`flex items-center gap-1 ${
                      row.trend === 'up' ? 'text-green-600 dark:text-green-400' : row.trend === 'down' ? 'text-red-500' : 'text-gray-400'
                    }`}>
                      {row.trend === 'up' && <TrendingUp size={14} />}
                      {row.trend === 'down' && <TrendingDown size={14} />}
                      {row.trend === 'stable' && <Minus size={12} />}
                      <span className="text-sm font-bold">
                        {row.qty_growth > 0 && '+'}{row.qty_growth}%
                      </span>
                    </div>
                  )
                },
                {
                  header: 'Revenue',
                  accessor: 'current_revenue',
                  cell: (row) => (
                    <div>
                      <span className="font-bold text-green-600 dark:text-green-400">₱{Number(row.current_revenue).toLocaleString()}</span>
                      <p className="text-[10px] text-secondary">prev: ₱{Number(row.previous_revenue).toLocaleString()}</p>
                    </div>
                  )
                },
                {
                  header: 'Revenue Growth',
                  accessor: 'revenue_growth',
                  cell: (row) => (
                    <div className={`flex items-center gap-1 ${
                      row.revenue_growth > 0 ? 'text-green-600 dark:text-green-400' : row.revenue_growth < 0 ? 'text-red-500' : 'text-gray-400'
                    }`}>
                      {row.revenue_growth > 0 && <TrendingUp size={14} />}
                      {row.revenue_growth < 0 && <TrendingDown size={14} />}
                      {row.revenue_growth === 0 && <Minus size={12} />}
                      <span className="text-sm font-bold">
                        {row.revenue_growth > 0 && '+'}{row.revenue_growth}%
                      </span>
                    </div>
                  )
                },
                {
                  header: 'Trend',
                  accessor: 'trend',
                  cell: (row) => (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      row.trend === 'up' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700 dark:bg-green-500/20 dark:text-green-400' :
                      row.trend === 'down' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 dark:bg-red-500/20 dark:text-red-400' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {row.trend === 'up' && <TrendingUp size={12} />}
                      {row.trend === 'down' && <TrendingDown size={12} />}
                      {row.trend === 'stable' && <Minus size={10} />}
                      {row.trend === 'up' ? 'Up' : row.trend === 'down' ? 'Down' : 'Stable'}
                    </span>
                  )
                },
                {
                  header: 'Date',
                  accessor: '_date',
                  cell: () => {
                    const cr = computedProductGrowth?.current_range;
                    if (!cr) return <span className="text-xs text-gray-400">—</span>;
                    const fmt = (d) => { const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
                    return (
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        {cr.start === cr.end ? (
                          <span>{fmt(cr.start)}</span>
                        ) : (
                          <span>{fmt(cr.start)} — {fmt(cr.end)}</span>
                        )}
                      </div>
                    );
                  }
                },
              ]}
              data={computedProductGrowth?.products || []}
              onRowClick={(row) => {
                const cs = computedProductGrowth?._currentStart;
                const ce = computedProductGrowth?._currentEnd;
                const salesForProduct = completedSales.filter(sale => {
                  if (!sale.created_at || !sale.items) return false;
                  const d = new Date(sale.created_at);
                  return d >= cs && d <= ce && sale.items.some(item => item.product_id === row.product_id);
                });
                setSelectedGrowthProduct({ ...row, _sales: salesForProduct, _currentRange: computedProductGrowth?.current_range });
                setIsGrowthDetailOpen(true);
              }}
              searchPlaceholder="Search products..."
              filterField="trend"
              filterPlaceholder="All Trends"
              filterOptions={[
                { value: 'up', label: 'Up' },
                { value: 'down', label: 'Down' },
                { value: 'stable', label: 'Stable' },
              ]}
              pagination={true}
              defaultItemsPerPage={10}
              headerRight={
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Period selector pills */}
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                    {[
                      { label: 'Daily', value: 'daily' },
                      { label: 'Weekly', value: 'weekly' },
                      { label: 'Monthly', value: 'monthly' },
                      { label: 'Bi-Annual', value: 'bi-annually' },
                      { label: 'Annual', value: 'annually' },
                      { label: 'Custom', value: 'custom' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setGrowthChartPeriod(opt.value); setGrowthChartScopeActive(true); }}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                          growthChartPeriod === opt.value
                            ? 'bg-white dark:bg-gray-800 text-button-600 dark:text-button-400 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {/* Custom date inputs */}
                  {growthChartPeriod === 'custom' && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={growthCustomStart}
                        onChange={(e) => setGrowthCustomStart(e.target.value)}
                        className="text-xs border border-primary-300 dark:border-primary-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-content focus:ring-2 focus:ring-button-500 focus:border-button-500"
                      />
                      <span className="text-xs text-secondary">to</span>
                      <input
                        type="date"
                        value={growthCustomEnd}
                        onChange={(e) => setGrowthCustomEnd(e.target.value)}
                        className="text-xs border border-primary-300 dark:border-primary-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-content focus:ring-2 focus:ring-button-500 focus:border-button-500"
                      />
                    </div>
                  )}
                </div>
              }
            />
        </>
      )}

      {/* ═══════════ COST RECORDS TAB ═══════════ */}
      {activeTab === 'costs' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatsCard
              label="Total Production Cost"
              value={`₱${Number(costStats.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              unit={`${costRecords.length} distributions`}
              icon={Receipt}
              iconBgColor="bg-gradient-to-br from-button-400 to-button-600"
            />
            <StatsCard
              label="Avg. Cost / Unit"
              value={`₱${Number(costStats.avgCostPerUnit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              unit={`${costStats.totalUnits.toLocaleString()} total units`}
              icon={DollarSign}
              iconBgColor="bg-gradient-to-br from-blue-400 to-blue-600"
            />
            <StatsCard
              label="Avg. Profit / Unit"
              value={`₱${Number(costStats.avgProfitPerUnit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              unit={costStats.avgProfitPerUnit >= 0 ? 'profit' : 'loss'}
              icon={TrendingUp}
              iconBgColor={costStats.avgProfitPerUnit >= 0 ? "bg-gradient-to-br from-green-400 to-green-600" : "bg-gradient-to-br from-red-400 to-red-600"}
            />
            <StatsCard
              label="Avg. Profit Margin"
              value={`${Number(costStats.avgMargin).toFixed(1)}%`}
              unit={`₱${Number(costStats.totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total profit`}
              icon={Percent}
              iconBgColor={costStats.avgMargin >= 20 ? "bg-gradient-to-br from-green-400 to-green-600" : costStats.avgMargin >= 0 ? "bg-gradient-to-br from-amber-400 to-amber-600" : "bg-gradient-to-br from-red-400 to-red-600"}
            />
          </div>

          {/* Cost Records Table */}
          <DataTable
            title="Cost & Expense Records"
            subtitle="Production cost breakdown for every stock distribution"
            columns={[
              {
                header: 'Product',
                accessor: 'product_name',
                cell: (row) => (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.variety_color || '#6b7280' }} />
                    <div>
                      <span className="font-medium text-gray-800 dark:text-gray-100">{row.product_name}</span>
                      <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${row.variety_color}20`, color: row.variety_color }}>
                        {row.variety_name}
                      </span>
                    </div>
                  </div>
                )
              },
              {
                header: 'Units',
                accessor: 'quantity_change',
                cell: (row) => (
                  <div>
                    <span className="font-bold text-gray-700 dark:text-gray-200">{row.quantity_change.toLocaleString()}</span>
                    {row.kg_amount && (
                      <p className="text-[10px] text-gray-400">{parseFloat(row.kg_amount).toLocaleString()} kg total</p>
                    )}
                    {row.product_weight && (
                      <p className="text-[10px] text-gray-400">{row.product_weight} kg/sacks</p>
                    )}
                  </div>
                )
              },
              {
                header: 'Procurement',
                accessor: 'procurement_cost',
                cell: (row) => row.procurement_cost ? (
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">₱{parseFloat(row.procurement_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                ) : <span className="text-gray-300 text-xs">—</span>
              },
              {
                header: 'Drying',
                accessor: 'drying_cost',
                cell: (row) => row.drying_cost ? (
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">₱{parseFloat(row.drying_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                ) : <span className="text-gray-300 text-xs">—</span>
              },
              {
                header: 'Total Cost',
                accessor: 'total_cost',
                cell: (row) => (
                  <span className="font-bold text-gray-800 dark:text-gray-100">₱{parseFloat(row.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                )
              },
              {
                header: 'Cost / Unit',
                accessor: 'cost_per_unit',
                cell: (row) => (
                  <span className="font-semibold text-blue-600 dark:text-blue-400">₱{parseFloat(row.cost_per_unit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                )
              },
              {
                header: 'Sell Price',
                accessor: 'selling_price',
                cell: (row) => row.selling_price > 0 ? (
                  <span className="font-semibold text-gray-700 dark:text-gray-200">₱{parseFloat(row.selling_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                ) : <span className="text-gray-300 text-xs">—</span>
              },
              {
                header: 'Profit / Unit',
                accessor: 'profit_per_unit',
                cell: (row) => row.profit_per_unit !== null && row.profit_per_unit !== undefined ? (
                  <span className={`font-bold ${parseFloat(row.profit_per_unit) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {parseFloat(row.profit_per_unit) >= 0 ? '+' : ''}₱{parseFloat(row.profit_per_unit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                ) : <span className="text-gray-300 text-xs">—</span>
              },
              {
                header: 'Margin',
                accessor: 'profit_margin',
                cell: (row) => row.profit_margin !== null && row.profit_margin !== undefined ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                    parseFloat(row.profit_margin) >= 20 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                    parseFloat(row.profit_margin) >= 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  }`}>
                    {parseFloat(row.profit_margin).toFixed(1)}%
                  </span>
                ) : <span className="text-gray-300 text-xs">—</span>
              },
              {
                header: 'Date',
                accessor: 'date_formatted',
                cell: (row) => (
                  <span className="text-xs text-gray-600 dark:text-gray-300">{row.date_formatted}</span>
                )
              },
            ]}
            data={costRecords}
            searchPlaceholder="Search cost records..."
            filterField="variety_name"
            filterPlaceholder="All Varieties"
            dateFilterField="created_at"
            onRowDoubleClick={async (row) => {
              setSelectedCostRecord(row);
              setIsCostDetailOpen(true);
              setProcessingDetails([]);
              if (row.source_type === 'processing_distribution') {
                setLoadingProcessingDetail(true);
                try {
                  // source_processing_ids can be:
                  //   New format: [{processing_id: 4, kg_taken: 2090}, ...]
                  //   Legacy format: [4, 2, ...] (plain IDs)
                  //   Empty/null: fall back to source_id
                  const rawIds = (row.source_processing_ids && row.source_processing_ids.length > 0)
                    ? row.source_processing_ids
                    : (row.source_id ? [row.source_id] : []);
                  // Normalize to objects with {processing_id, kg_taken}
                  const sources = rawIds.map(item =>
                    typeof item === 'object' && item !== null
                      ? { processing_id: item.processing_id, kg_taken: item.kg_taken }
                      : { processing_id: item, kg_taken: null }
                  );
                  if (sources.length > 0) {
                    const results = await Promise.all(
                      sources.map(s => apiClient.get(`/processings/${s.processing_id}`).catch(() => null))
                    );
                    const details = results
                      .map((r, i) => r?.success && r.data ? { ...r.data, _kg_taken: sources[i].kg_taken } : null)
                      .filter(Boolean);
                    setProcessingDetails(details);
                  }
                } catch {
                  setProcessingDetails([]);
                } finally {
                  setLoadingProcessingDetail(false);
                }
              }
            }}
          />
        </>
      )}

      {/* ─── Growth Product Detail Modal ──────────────────────── */}
      <Modal
        isOpen={isGrowthDetailOpen}
        onClose={() => { setIsGrowthDetailOpen(false); setSelectedGrowthProduct(null); }}
        title="Sales Detail"
        size="full"
      >
        {selectedGrowthProduct && (() => {
          const p = selectedGrowthProduct;
          const cr = p._currentRange;
          const fmt = (d) => { const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
          const periodLabel = cr ? (cr.start === cr.end ? fmt(cr.start) : `${fmt(cr.start)} — ${fmt(cr.end)}`) : '';
          return (
            <div className="space-y-4">
              {/* Product header */}
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.variety_color }} />
                <span className="font-bold text-gray-800 dark:text-white text-base">{p.product_name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${p.variety_color}20`, color: p.variety_color }}>{p.variety_name}</span>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{periodLabel}</span>
              </div>
              {/* Summary row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-0.5">Units Sold (Current)</p>
                  <p className="text-lg font-bold text-red-500">{p.current_qty.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-0.5">Units Sold (Previous)</p>
                  <p className="text-lg font-bold text-gray-500 dark:text-gray-400">{p.previous_qty.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-0.5">Revenue (Current)</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">₱{Number(p.current_revenue).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-0.5">Qty Growth</p>
                  <p className={`text-lg font-bold ${p.qty_growth > 0 ? 'text-green-600 dark:text-green-400' : p.qty_growth < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {p.qty_growth > 0 ? '+' : ''}{p.qty_growth}%
                  </p>
                </div>
              </div>
              {/* Transactions table */}
              {p._sales.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">No transactions in this period</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Transaction</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Qty</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Unit Price</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Subtotal</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Total Sale</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                      {p._sales.map((sale, idx) => {
                        const saleItem = sale.items?.find(i => i.product_id === p.product_id);
                        return (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-300 font-mono">{sale.transaction_id || `#${sale.id}`}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-sm text-red-500">{(saleItem?.quantity ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-600 dark:text-gray-300">₱{Number(saleItem?.unit_price ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-green-600 dark:text-green-400">₱{Number(saleItem?.subtotal ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-500 dark:text-gray-400">₱{Number(sale.total ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              {sale.created_at ? new Date(sale.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${sale.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                                {sale.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <td className="px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Total ({p._sales.length} transactions)</td>
                        <td className="px-4 py-2.5 text-right font-bold text-sm text-red-500">{p._sales.reduce((s, sale) => s + (sale.items?.find(i => i.product_id === p.product_id)?.quantity || 0), 0).toLocaleString()}</td>
                        <td></td>
                        <td className="px-4 py-2.5 text-right font-bold text-green-600 dark:text-green-400">₱{p._sales.reduce((s, sale) => s + (sale.items?.find(i => i.product_id === p.product_id)?.subtotal || 0), 0).toLocaleString()}</td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* ─── Movement Detail Modal ──────────────────────── */}
      <Modal
        isOpen={isMovementDetailOpen}
        onClose={() => { setIsMovementDetailOpen(false); setSelectedMovementGroup([]); }}
        title="Stock Movement Details"
        size="full"
      >
        {selectedMovementGroup.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {selectedMovementGroup[0]?.product_name}
              </span>
              {selectedMovementGroup[0]?.variety_name && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${selectedMovementGroup[0]?.variety_color}20`, color: selectedMovementGroup[0]?.variety_color }}>
                  {selectedMovementGroup[0]?.variety_name}
                </span>
              )}
              <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                {selectedMovementGroup.length} {selectedMovementGroup.length === 1 ? 'movement' : 'movements'}
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Source</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Units</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Kg</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Stock Before → After</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Date & Time</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                  {selectedMovementGroup.map((log, idx) => {
                    const sourceLabels = {
                      'processing_distribution': 'Processing',
                      'order': 'Order',
                      'order_cancelled': 'Cancelled',
                      'order_return': 'Restocked',
                      'return_loss': 'Return Loss',
                      'sale_void': 'Voided',
                    };
                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                            log.type === 'in'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}>
                            {log.type === 'in' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {log.type === 'in' ? 'IN' : 'OUT'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                          {sourceLabels[log.source_type] || (log.source_type ? log.source_type.replace(/_/g, ' ') : '—')}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right">
                          <span className={`font-bold text-sm ${log.type === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {log.type === 'in' ? '+' : '-'}{(log.quantity_change ?? 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right text-xs text-gray-500 dark:text-gray-400">
                          {log.kg_amount ? parseFloat(log.kg_amount).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-center text-xs text-gray-600 dark:text-gray-300">
                          {(log.quantity_before ?? '—')} → {(log.quantity_after ?? '—')}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                          {log.created_at ? new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                          {log.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Total</td>
                    <td className="px-4 py-2.5 text-right font-bold text-sm text-gray-800 dark:text-white">
                      {selectedMovementGroup.reduce((sum, l) => sum + (l.type === 'in' ? (l.quantity_change || 0) : -(l.quantity_change || 0)), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
                      {selectedMovementGroup.reduce((sum, l) => sum + (l.kg_amount ? parseFloat(l.kg_amount) : 0), 0).toLocaleString()}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Cost Record Detail Modal ──────────────────────── */}
      <Modal
        isOpen={isCostDetailOpen}
        onClose={() => { setIsCostDetailOpen(false); setSelectedCostRecord(null); setProcessingDetails([]); }}
        title="Cost Record Details"
        size={processingDetails.length > 1 ? 'full' : '2xl'}
      >
        {selectedCostRecord && (() => {
          const r = selectedCostRecord;
          const pList = processingDetails; // array of processing objects (each has _kg_taken)
          const fmt = (v) => v != null ? `₱${parseFloat(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
          const profitColor = parseFloat(r.profit_per_unit) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
          const marginColor = parseFloat(r.profit_margin) >= 20 ? 'text-green-600 dark:text-green-400' : parseFloat(r.profit_margin) >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
          const showNumber = pList.length > 1;

          /* Helper to render a single processing source card */
          const renderSourceCard = (p, idx) => {
            const kgTaken = p._kg_taken;
            const totalOutput = p.output_kg ? parseFloat(p.output_kg) : null;
            const hasPartialTake = kgTaken != null && totalOutput != null && kgTaken < totalOutput;

            return (
              <div key={p.id || idx} className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-primary-200 dark:border-primary-700">
                {/* Source number badge */}
                {showNumber && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-button-500 text-white text-xs font-bold">{idx + 1}</span>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Source {idx + 1}</span>
                    {p.processing_date && <span className="text-xs text-gray-400 ml-auto">{p.processing_date}</span>}
                  </div>
                )}

                {/* Kg Taken highlight banner — ALWAYS show prominently */}
                {kgTaken != null && (
                  <div className={`px-4 py-3 rounded-lg border-2 ${hasPartialTake ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600' : 'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-600'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${hasPartialTake ? 'bg-amber-100 dark:bg-amber-800/50' : 'bg-green-100 dark:bg-green-800/50'}`}>
                        <svg className={`w-4 h-4 ${hasPartialTake ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div>
                        <p className={`text-base font-extrabold ${hasPartialTake ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>
                          {parseFloat(kgTaken).toLocaleString()} kg taken
                        </p>
                        {hasPartialTake && totalOutput && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            Only {((kgTaken / totalOutput) * 100).toFixed(1)}% of {totalOutput.toLocaleString()} kg total output
                          </p>
                        )}
                        {!hasPartialTake && totalOutput && (
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                            100% of {totalOutput.toLocaleString()} kg total output
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Procurement */}
                <div>
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                    <ShoppingCart size={12} /> Procurement
                  </h4>
                  {p.procurement_info ? (
                    <div className="bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 divide-y divide-gray-100 dark:divide-gray-600">
                      <div className="flex justify-between items-center px-3 py-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Supplier</span>
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{p.procurement_info.supplier_name}</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Quantity</span>
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{parseFloat(p.procurement_info.quantity_kg).toLocaleString()} kg</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Sacks</span>
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{p.procurement_info.sacks}</span>
                      </div>
                      {p.procurement_info.price_per_kg && (
                        <div className="flex justify-between items-center px-3 py-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Price/kg</span>
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{fmt(p.procurement_info.price_per_kg)}</span>
                        </div>
                      )}
                      {p.procurement_info.total_cost && (
                        <div className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-600/50">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Total Cost</span>
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{fmt(p.procurement_info.total_cost)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 text-center">
                      <p className="text-xs text-gray-400">No procurement data</p>
                    </div>
                  )}
                </div>

                {/* Drying */}
                <div>
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                    <Layers size={12} /> Drying
                  </h4>
                  {p.drying_sources && p.drying_sources.length > 0 ? (
                    <div className="space-y-1.5">
                      {p.drying_sources.map((ds, di) => (
                        <div key={di} className="bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 divide-y divide-gray-100 dark:divide-gray-600">
                          <div className="flex justify-between items-center px-3 py-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Source</span>
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 text-right max-w-[60%] truncate">
                              {ds.supplier_name}{ds.batch_number ? ` (Batch #${ds.batch_number})` : ''}
                            </span>
                          </div>
                          <div className="flex justify-between items-center px-3 py-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Qty Used</span>
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{parseFloat(ds.quantity_kg_taken).toLocaleString()} kg</span>
                          </div>
                          <div className="flex justify-between items-center px-3 py-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Total Dried</span>
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{parseFloat(ds.total_quantity_kg).toLocaleString()} kg</span>
                          </div>
                          {ds.days > 0 && (
                            <div className="flex justify-between items-center px-3 py-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Days</span>
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{ds.days} {ds.days === 1 ? 'day' : 'days'}</span>
                            </div>
                          )}
                          {ds.sacks > 0 && (
                            <div className="flex justify-between items-center px-3 py-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Sacks</span>
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{ds.sacks}</span>
                            </div>
                          )}
                        </div>
                      ))}
                      {/* Drying cost totals from cost record */}
                      {r.drying_cost > 0 && (
                        <div className="bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 divide-y divide-gray-100 dark:divide-gray-600 mt-1.5">
                          {r.kg_amount > 0 && (
                            <div className="flex justify-between items-center px-3 py-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Drying Cost/kg</span>
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{fmt(r.drying_cost / r.kg_amount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-600/50">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Total Drying Cost</span>
                            <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{fmt(r.drying_cost)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : p.drying_process_info ? (
                    <div className="bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 divide-y divide-gray-100 dark:divide-gray-600">
                      <div className="flex justify-between items-center px-3 py-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Source</span>
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{p.drying_process_info.supplier_name}</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Quantity</span>
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{parseFloat(p.drying_process_info.quantity_kg).toLocaleString()} kg</span>
                      </div>
                      {p.drying_process_info.days > 0 && (
                        <div className="flex justify-between items-center px-3 py-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Days</span>
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{p.drying_process_info.days} days</span>
                        </div>
                      )}
                      {/* Drying cost totals */}
                      {r.drying_cost > 0 && (
                        <div className="bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 divide-y divide-gray-100 dark:divide-gray-600 mt-1.5">
                          {r.kg_amount > 0 && (
                            <div className="flex justify-between items-center px-3 py-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Drying Cost/kg</span>
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{fmt(r.drying_cost / r.kg_amount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-600/50">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Total Drying Cost</span>
                            <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{fmt(r.drying_cost)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 text-center">
                      <p className="text-xs text-gray-400">No drying data</p>
                    </div>
                  )}
                </div>

                {/* Processing */}
                <div>
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                    <Settings2 size={12} /> Processing
                  </h4>
                  <div className="bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700 divide-y divide-gray-100 dark:divide-gray-600">
                    <div className="flex justify-between items-center px-3 py-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Input</span>
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{parseFloat(p.input_kg).toLocaleString()} kg</span>
                    </div>
                    {p.output_kg && (
                      <div className="flex justify-between items-center px-3 py-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Output</span>
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{parseFloat(p.output_kg).toLocaleString()} kg</span>
                      </div>
                    )}
                    {p.husk_kg && (
                      <div className="flex justify-between items-center px-3 py-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Husk/Waste</span>
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{parseFloat(p.husk_kg).toLocaleString()} kg</span>
                      </div>
                    )}
                    {p.yield_percent && (
                      <div className="flex justify-between items-center px-3 py-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Yield</span>
                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">{parseFloat(p.yield_percent).toFixed(1)}%</span>
                      </div>
                    )}
                    {p.operator_name && (
                      <div className="flex justify-between items-center px-3 py-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Operator</span>
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{p.operator_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center px-3 py-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
                      <span className={`text-xs font-semibold ${p.status === 'Completed' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>{p.status}</span>
                    </div>
                    {p.processing_date && (
                      <div className="flex justify-between items-center px-3 py-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Date</span>
                        <span className="text-xs text-gray-600 dark:text-gray-300">{p.processing_date}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          };

          return (
            <div style={{ height: 'calc(90vh - 180px)' }} className="flex gap-3">
              {/* LEFT PANEL: Summary (fixed width, scrollable) */}
              <div className="w-[260px] flex-shrink-0 flex flex-col gap-2.5 overflow-y-auto pr-1">
                  {/* Product Header inside left panel */}
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-100 dark:bg-gray-700/80 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: r.variety_color || '#6b7280' }} />
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight truncate">{r.product_name}</h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${r.variety_color}20`, color: r.variety_color }}>{r.variety_name}</span>
                        {r.product_weight && <span className="text-xs text-gray-500 dark:text-gray-400">{r.product_weight}kg/unit</span>}
                        {showNumber && <span className="text-xs font-medium text-primary-500">{pList.length} sources</span>}
                      </div>
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                      <p className="text-xs text-blue-500 dark:text-blue-400 font-medium uppercase tracking-wide">Units Dist.</p>
                      <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{r.quantity_change?.toLocaleString()}</p>
                      {r.kg_amount && <p className="text-xs text-blue-400 mt-0.5">{parseFloat(r.kg_amount).toLocaleString()} kg total</p>}
                    </div>
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-700/80 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Stock Change</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{r.quantity_before?.toLocaleString()} → <span className="font-bold text-gray-800 dark:text-gray-100">{r.quantity_after?.toLocaleString()}</span></p>
                      <p className="text-xs text-gray-400">+{r.quantity_change?.toLocaleString()} added</p>
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Cost Breakdown</p>
                    <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-600">
                      <div className="flex justify-between items-center px-3 py-2">
                        <div>
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Procurement</p>
                          <p className="text-[10px] text-gray-400">Raw material</p>
                        </div>
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{fmt(r.procurement_cost)}</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2">
                        <div>
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Drying</p>
                          <p className="text-[10px] text-gray-400">Process expense</p>
                        </div>
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{fmt(r.drying_cost)}</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-600/50 rounded-b-lg">
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100">Total Production</p>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{fmt(r.total_cost)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing & Profit */}
                  <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Pricing & Profit</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                        <p className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">Cost/Unit</p>
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{fmt(r.cost_per_unit)}</p>
                      </div>
                      <div className="p-2 bg-gray-50 dark:bg-gray-700/80 rounded-lg border border-gray-200 dark:border-gray-600">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Selling</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{fmt(r.selling_price)}</p>
                      </div>
                      <div className={`p-2 rounded-lg border ${parseFloat(r.profit_per_unit) >= 0 ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700'}`}>
                        <p className={`text-[10px] font-medium ${profitColor}`}>Profit/Unit</p>
                        <p className={`text-sm font-bold ${profitColor}`}>{parseFloat(r.profit_per_unit) >= 0 ? '+' : ''}{fmt(r.profit_per_unit)}</p>
                      </div>
                      <div className={`p-2 rounded-lg border ${parseFloat(r.profit_margin) >= 20 ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700' : parseFloat(r.profit_margin) >= 0 ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700' : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700'}`}>
                        <p className={`text-[10px] font-medium ${marginColor}`}>Margin</p>
                        <p className={`text-sm font-bold ${marginColor}`}>{parseFloat(r.profit_margin).toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Source Info */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/80 rounded-lg border border-gray-200 dark:border-gray-600">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Source Info</p>
                    {r.source_type && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">
                        <span className="font-medium">Source:</span>{' '}
                        {r.source_type === 'processing_distribution' ? 'Processing Distribution' : r.source_type.replace(/_/g, ' ')}
                        {!showNumber && r.source_id && <span className="text-gray-400 ml-1">#{r.source_id}</span>}
                      </p>
                    )}
                    {r.notes && <p className="text-xs text-gray-600 dark:text-gray-300"><span className="font-medium">Notes:</span> {r.notes}</p>}
                    <p className="text-xs text-gray-400 mt-1.5">{r.date_formatted}</p>
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="w-px bg-gray-200 dark:bg-gray-600 flex-shrink-0" />

                {/* RIGHT PANEL: Processing Sources */}
                <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-y-auto">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex-1 border-t border-gray-200 dark:border-gray-600" />
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {showNumber ? 'Processing Sources' : 'Production Chain'}
                    </span>
                    <div className="flex-1 border-t border-gray-200 dark:border-gray-600" />
                  </div>
                  {loadingProcessingDetail ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
                        <p className="text-xs text-gray-400 mt-3">Loading production chain...</p>
                      </div>
                    </div>
                  ) : pList.length > 0 ? (
                    <div className={`grid gap-3 ${pList.length === 1 ? 'grid-cols-1' : pList.length === 2 ? 'grid-cols-2' : pList.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      {pList.map((p, idx) => renderSourceCard(p, idx))}
                    </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400">No production chain data available</p>
                </div>
              )}
                </div>
            </div>
          );
        })()}
      </Modal>

      {/* ─── Add Product Modal ──────────────────────────────── */}
      <FormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddSubmit}
        title="Add New Product"
        submitText="Add Product"
        size="md"
        loading={saving}
      >
        {({ submitted }) => (
          <>
            <FormInput
              label="Product Name"
              name="product_name"
              value={formData.product_name}
              onChange={handleFormChange}
              required
              placeholder="e.g. Premium Rice"
              error={errors.product_name}
              submitted={submitted}
            />
            <FormSelect
              label="Variety"
              name="variety_id"
              value={formData.variety_id}
              onChange={handleFormChange}
              options={varietyOptions}
              required
              placeholder="Select a variety"
              error={errors.variety_id}
              submitted={submitted}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Price (₱)"
                name="price"
                type="number"
                value={formData.price}
                onChange={handleFormChange}
                placeholder="0.00"
                error={errors.price}
                submitted={submitted}
              />
              <FormInput
                label="Weight per unit (kg)"
                name="weight"
                type="number"
                value={formData.weight}
                onChange={handleFormChange}
                required
                placeholder="e.g. 25"
                hint="Used to auto-compute units from kg"
                error={errors.weight}
                submitted={submitted}
              />
            </div>
            <FormInput
              label="Low Stock Floor (units)"
              name="stock_floor"
              type="number"
              value={formData.stock_floor}
              onChange={handleFormChange}
              placeholder="e.g. 10"
              hint="Stock at or below this number is flagged as Low Stock"
              error={errors.stock_floor}
              submitted={submitted}
            />
          </>
        )}
      </FormModal>

      {/* ─── Edit Product Modal ─────────────────────────────── */}
      <FormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        title="Edit Product"
        submitText="Save Changes"
        size="md"
        loading={saving}
      >
        {({ submitted }) => {
          const hasStock = selectedItem?.stocks > 0;
          return (
          <>
            <FormInput
              label="Product Name"
              name="product_name"
              value={formData.product_name}
              onChange={handleFormChange}
              required
              placeholder="e.g. Premium Rice"
              error={errors.product_name}
              submitted={submitted}
            />
            <FormSelect
              label="Variety"
              name="variety_id"
              value={formData.variety_id}
              onChange={handleFormChange}
              options={varietyOptions}
              required
              placeholder="Select a variety"
              error={errors.variety_id}
              submitted={submitted}
              disabled={hasStock}
              hint={hasStock ? 'Cannot change variety while product has existing stock' : ''}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormInput
                  label="Price (₱)"
                  name="price"
                  type="number"
                  value={formData.price}
                  onChange={handleFormChange}
                  placeholder="0.00"
                  error={errors.price}
                  submitted={submitted}
                />
                {costAnalysis?.has_data && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Unit Cost: <span className="font-semibold text-gray-700 dark:text-gray-200">₱{costAnalysis.avg_cost_per_unit.toLocaleString()}</span>
                  </p>
                )}
              </div>
              <FormInput
                label="Weight per unit (kg)"
                name="weight"
                type="number"
                value={formData.weight}
                onChange={handleFormChange}
                required
                placeholder="e.g. 25"
                hint={hasStock ? 'Cannot change weight while product has existing stock' : 'Used to auto-compute units from kg'}
                error={errors.weight}
                submitted={submitted}
                disabled={hasStock}
              />
            </div>
            <FormInput
              label="Low Stock Floor (units)"
              name="stock_floor"
              type="number"
              value={formData.stock_floor}
              onChange={handleFormChange}
              placeholder="e.g. 10"
              hint="Stock at or below this number is flagged as Low Stock"
              error={errors.stock_floor}
              submitted={submitted}
            />
            <FormSelect
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleFormChange}
              options={statusOptions}
              submitted={submitted}
            />
          </>
          );
        }}
      </FormModal>

      {/* ─── Archive Confirmation Modal ──────────────────────── */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Archive Product"
        message={`Are you sure you want to archive "${selectedItem?.product_name}"? You can restore it later from Archives.`}
        confirmText="Archive"
        cancelText="Cancel"
        variant="warning"
        icon={Trash2}
        isLoading={saving}
      />

      {/* ─── Add Stock Modal ────────────────────────────────── */}
      <Modal
        isOpen={isAddStockModalOpen}
        onClose={() => setIsAddStockModalOpen(false)}
        title="Distribute Stock from Processing"
        size="xl"
      >
        {selectedItem && (
          <div className="space-y-5">
            {/* Product Info Header */}
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-700 bg-gradient-to-r from-blue-50 dark:from-gray-700 to-indigo-50 dark:to-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${selectedItem.variety_color}20` }}>
                    <Package size={20} style={{ color: selectedItem.variety_color }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{selectedItem.product_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {(selectedItem.stocks || 0).toLocaleString()} units in stock
                      {selectedItem.weight ? ` • ${parseFloat(selectedItem.weight)} kg per unit` : ''}
                    </p>
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: `${selectedItem.variety_color}20`, color: selectedItem.variety_color }}
                >
                  {selectedItem.variety_name}
                </span>
              </div>
            </div>

            {/* Processing Sources */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Source Processings
                </label>
                {availableProcessings.length > 1 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs font-medium text-button-600 hover:text-button-700 dark:text-button-300 transition-colors"
                  >
                    {availableProcessings.length === selectedProcessings.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {loadingProcessings ? (
                <div className="py-10 text-center text-gray-400">
                  <div className="animate-spin w-7 h-7 border-2 border-button-500 border-t-transparent rounded-full mx-auto mb-3" />
                  <p className="text-sm">Loading processings...</p>
                </div>
              ) : availableProcessings.length === 0 ? (
                <div className="py-10 text-center text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-dashed border-primary-300 dark:border-primary-700">
                  <Package size={36} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No processings available</p>
                  <p className="text-xs mt-1 text-gray-400">No completed <strong>{selectedItem.variety_name}</strong> processings with remaining stock.</p>
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                  {groupedProcessings.map(group => (
                    <div key={group.key}>
                      {/* Batch group header */}
                      {groupedProcessings.length > 1 && (
                        <div className="flex items-center gap-2 mb-2">
                          <Layers size={13} className="text-gray-400" />
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{group.label}</span>
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
                        </div>
                      )}

                      <div className="space-y-2">
                        {group.processings.map(proc => {
                          const isSelected = selectedProcessings.some(s => s.processing_id === proc.id);
                          const selectedEntry = selectedProcessings.find(s => s.processing_id === proc.id);
                          const ds = proc.drying_sources?.[0];
                          const pct = selectedEntry ? Math.round((selectedEntry.kg_to_take / proc.remaining_stock) * 100) : 0;
                          const costPerKg = proc.cost_breakdown?.cost_per_kg || 0;

                          return (
                            <div
                              key={proc.id}
                              className={`rounded-xl border-2 transition-all ${
                                isSelected
                                  ? 'border-button-400 dark:border-button-600 bg-button-50 dark:bg-button-900/20 shadow-sm'
                                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 dark:border-gray-600'
                              }`}
                            >
                              {/* Header — toggle area */}
                              <div
                                className="flex items-center gap-3 p-3.5 cursor-pointer select-none"
                                onClick={() => toggleProcessingSelection(proc.id)}
                              >
                                {/* Toggle switch */}
                                <div className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 ${
                                  isSelected ? 'bg-button-500' : 'bg-gray-300 dark:bg-gray-600'
                                }`}>
                                  <div className={`absolute top-[3px] w-4 h-4 bg-white dark:bg-gray-700 rounded-full shadow transition-transform ${
                                    isSelected ? 'translate-x-[22px]' : 'translate-x-[3px]'
                                  }`} />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Processing #{proc.id}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                                      {proc.remaining_stock.toLocaleString()} kg
                                    </span>
                                    {costPerKg > 0 && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                                        ₱{costPerKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/kg
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                                    <span>{proc.completed_date}</span>
                                    <span>•</span>
                                    <span>Output: {proc.output_kg.toLocaleString()} kg</span>
                                    {ds?.batch_number && (
                                      <>
                                        <span>•</span>
                                        <span>{ds.batch_number}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Expanded: Quantity control */}
                              {isSelected && selectedEntry && (
                                <div className="px-3.5 pb-3.5 pt-0" onClick={(e) => e.stopPropagation()}>
                                  <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-primary-200 dark:border-primary-700">
                                    {/* Quantity label */}
                                    <div className="flex items-center justify-between mb-2.5">
                                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Quantity to distribute</span>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => resetProcessingKg(proc.id)}
                                          className="text-[10px] px-2 py-0.5 rounded-md bg-button-100 dark:bg-button-900/30 text-button-600 dark:text-button-400 hover:bg-button-200 font-medium transition-colors"
                                          title="Use all remaining"
                                        >
                                          Use All
                                        </button>
                                      </div>
                                    </div>

                                    {/* Range slider */}
                                    <input
                                      type="range"
                                      min="0"
                                      max={proc.remaining_stock}
                                      step={Math.max(1, Math.floor(proc.remaining_stock / 1000))}
                                      value={selectedEntry.kg_to_take}
                                      onChange={(e) => updateProcessingKg(proc.id, e.target.value)}
                                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full appearance-none cursor-pointer accent-button-500 mb-2"
                                    />

                                    {/* Numeric input with +/- buttons */}
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const step = parseFloat(selectedItem.weight) || 25;
                                          const newVal = Math.max(0, selectedEntry.kg_to_take - step);
                                          updateProcessingKg(proc.id, newVal);
                                        }}
                                        className="w-8 h-8 rounded-lg border border-primary-300 dark:border-primary-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 transition-colors"
                                      >
                                        <Minus size={14} />
                                      </button>
                                      <div className="flex-1 relative">
                                        <input
                                          type="number"
                                          value={selectedEntry.kg_to_take}
                                          onChange={(e) => updateProcessingKg(proc.id, e.target.value)}
                                          className="w-full px-3 py-1.5 text-center text-sm font-semibold border border-primary-300 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-button-500 focus:border-button-500"
                                          min="0"
                                          max={proc.remaining_stock}
                                          step="0.01"
                                        />
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">kg</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const step = parseFloat(selectedItem.weight) || 25;
                                          const newVal = Math.min(proc.remaining_stock, selectedEntry.kg_to_take + step);
                                          updateProcessingKg(proc.id, newVal);
                                        }}
                                        className="w-8 h-8 rounded-lg border border-primary-300 dark:border-primary-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 transition-colors"
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>

                                    {/* Progress indicator */}
                                    <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                                      <span>{pct}% of available stock</span>
                                      <span>{(proc.remaining_stock - selectedEntry.kg_to_take).toLocaleString()} kg stays in processing</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ─── Big Calculation Summary ─── */}
            {selectedProcessings.length > 0 && computedStockUnits && (
              <div className="rounded-xl overflow-hidden border-2 border-green-300 dark:border-green-600 bg-gradient-to-br from-green-50 dark:from-gray-700 to-emerald-50 dark:to-gray-700">
                <div className="p-4">
                  {/* Main calculation */}
                  <div className="text-center mb-3">
                    <p className="text-[10px] uppercase tracking-widest text-green-500 font-bold mb-1">Stock Distribution Summary</p>
                    <div className="flex items-center justify-center gap-2 text-green-800 dark:text-green-300">
                      <span className="text-lg font-bold">{computedStockUnits.totalKg.toLocaleString()} kg</span>
                      <span className="text-sm text-green-500">÷</span>
                      <span className="text-lg font-bold">{computedStockUnits.weight} kg</span>
                      <span className="text-sm text-green-500">=</span>
                      <span className="text-2xl font-black text-green-700 dark:text-green-300">{computedStockUnits.units.toLocaleString()}</span>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">units</span>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-white/60 dark:bg-gray-700/60 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Current Stock</p>
                      <p className="text-base font-bold text-gray-700 dark:text-gray-200">{(selectedItem.stocks || 0).toLocaleString()}</p>
                    </div>
                    <div className="text-center p-2 bg-white/60 dark:bg-gray-700/60 rounded-lg">
                      <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">Adding</p>
                      <p className="text-base font-bold text-green-600 dark:text-green-400">+{computedStockUnits.units.toLocaleString()}</p>
                    </div>
                    <div className="text-center p-2 bg-white/60 dark:bg-gray-700/60 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">New Total</p>
                      <p className="text-base font-bold text-button-600 dark:text-button-400">{((selectedItem.stocks || 0) + computedStockUnits.units).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Remainder notice */}
                  {computedStockUnits.remainder > 0 && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                      <RotateCcw size={14} className="text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        <strong>{computedStockUnits.remainder} kg</strong> remainder stays in processing (not enough for 1 unit)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Cost & Profit Analysis ─── */}
            {selectedProcessings.length > 0 && computedCostBreakdown && computedCostBreakdown.totalCost > 0 && (
              <div className="rounded-xl overflow-hidden border-2 border-blue-300 dark:border-blue-600 bg-gradient-to-br from-blue-50 dark:from-gray-700 to-indigo-50 dark:to-gray-700">
                <div className="p-4">
                  <p className="text-[10px] uppercase tracking-widest text-blue-500 font-bold mb-3 text-center">Cost & Profit Analysis</p>

                  {/* Cost breakdown */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center p-2 bg-white/60 dark:bg-gray-700/60 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Procurement</p>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">₱{computedCostBreakdown.totalProcurementCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-center p-2 bg-white/60 dark:bg-gray-700/60 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Drying</p>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">₱{computedCostBreakdown.totalDryingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-center p-2 bg-white/60 dark:bg-gray-700/60 rounded-lg">
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Total Cost</p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-300">₱{computedCostBreakdown.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {/* Per-unit breakdown */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-white/60 dark:bg-gray-700/60 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Cost/Unit</p>
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">₱{computedCostBreakdown.costPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-center p-2 bg-white/60 dark:bg-gray-700/60 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Selling Price</p>
                      <p className="text-sm font-bold text-green-600 dark:text-green-400">₱{computedCostBreakdown.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-center p-2 bg-white/60 dark:bg-gray-700/60 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Profit/Unit</p>
                      <p className={`text-sm font-bold ${computedCostBreakdown.profitPerUnit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {computedCostBreakdown.profitPerUnit >= 0 ? '+' : ''}₱{computedCostBreakdown.profitPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Profit margin indicator */}
                  <div className={`mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${
                    computedCostBreakdown.profitMargin >= 20 ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700' :
                    computedCostBreakdown.profitMargin >= 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' :
                    'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                  }`}>
                    {computedCostBreakdown.profitMargin >= 0 ? (
                      <TrendingUp size={14} className={computedCostBreakdown.profitMargin >= 20 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'} />
                    ) : (
                      <TrendingDown size={14} className="text-red-600 dark:text-red-400" />
                    )}
                    <p className={`text-xs font-semibold ${
                      computedCostBreakdown.profitMargin >= 20 ? 'text-green-700 dark:text-green-400' :
                      computedCostBreakdown.profitMargin >= 0 ? 'text-amber-700 dark:text-amber-300' :
                      'text-red-700 dark:text-red-300'
                    }`}>
                      {computedCostBreakdown.profitMargin >= 0 ? '' : ''}{computedCostBreakdown.profitMargin.toFixed(1)}% Profit Margin
                      {computedCostBreakdown.profitMargin < 0 && ' — Selling below cost!'}
                      {computedCostBreakdown.profitMargin >= 0 && computedCostBreakdown.profitMargin < 10 && ' — Low margin'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsAddStockModalOpen(false)} className="flex-1" disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleAddStockSubmit}
                className="flex-1"
                disabled={saving || selectedProcessings.length === 0 || !computedStockUnits || computedStockUnits.units <= 0}
              >
                {saving ? 'Distributing...' : `Distribute ${computedStockUnits?.units?.toLocaleString() || 0} Units`}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Set Floor Modal ────────────────────────────────── */}
      <Modal
        isOpen={isFloorModalOpen}
        onClose={() => setIsFloorModalOpen(false)}
        title="Set Low Stock Floor"
        size="sm"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-700">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">{selectedItem.product_name}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                Current stock: <strong>{(selectedItem.stocks || 0).toLocaleString()}</strong> • Current floor: <strong>{(selectedItem.stock_floor || 0).toLocaleString()}</strong>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Floor Quantity (units)
              </label>
              <input
                type="number"
                value={floorValue}
                onChange={(e) => setFloorValue(e.target.value)}
                placeholder="e.g. 10"
                className="w-full px-3 py-2 border border-primary-300 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-button-500 focus:border-button-500"
                min="0"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">When stock is at or below this number, it will be flagged as &quot;Low Stock&quot;</p>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
              <Button variant="outline" onClick={() => setIsFloorModalOpen(false)} className="flex-1" disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleFloorSubmit}
                className="flex-1"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Floor'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── View Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Product Details"
        size="2xl"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setIsViewModalOpen(false);
                handleEdit(selectedItem);
              }}
              className="px-4 py-2 bg-button-500 hover:bg-button-600 text-white rounded-lg transition-colors"
            >
              Edit Product
            </button>
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedItem && (
          <div className="space-y-3">
            {/* Header with Status */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary-50 dark:from-gray-700 to-primary-100 dark:to-gray-800 rounded-xl border border-primary-200 dark:border-primary-700">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{selectedItem.product_name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Product ID: #{String(selectedItem.product_id).padStart(4, '0')}</p>
              </div>
              <StatusBadge status={selectedItem.stock_status} />
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-3 gap-2">
              <ViewDetailItem icon={Hash} label="Product ID" value={`#${String(selectedItem.product_id).padStart(4, '0')}`} compact />
              <ViewDetailItem icon={Tag} label="Variety" value={selectedItem.variety_name} iconColor="text-blue-500" compact />
              <ViewDetailItem icon={DollarSign} label="Price" value={selectedItem.price_formatted} iconColor="text-green-500" compact />
              <ViewDetailItem icon={Box} label="Current Stock" value={`${(selectedItem.stocks || 0).toLocaleString()} ${selectedItem.unit}${selectedItem.weight && selectedItem.stocks > 0 ? ` (${((selectedItem.stocks || 0) * parseFloat(selectedItem.weight)).toLocaleString()} kg)` : ''}`} iconColor="text-blue-500" compact />
              <ViewDetailItem icon={Scale} label="Weight/Unit" value={selectedItem.weight ? `${parseFloat(selectedItem.weight).toLocaleString()} kg` : 'N/A'} iconColor="text-purple-500" compact />
              <ViewDetailItem icon={AlertTriangle} label="Floor Qty" value={`${(selectedItem.stock_floor || 0).toLocaleString()} units`} iconColor="text-orange-500" compact />
              <ViewDetailItem icon={ShoppingCart} label="Stock Status" value={selectedItem.stock_status} iconColor={selectedItem.stock_status === 'In Stock' ? 'text-green-500' : selectedItem.stock_status === 'Low Stock' ? 'text-orange-500' : 'text-red-500'} compact />
              <ViewDetailItem icon={Settings2} label="Product Status" value={selectedItem.status === 'active' ? 'Active' : 'Inactive'} iconColor="text-gray-500 dark:text-gray-400" compact />
              <ViewDetailItem icon={Calendar} label="Created" value={selectedItem.created_date || 'N/A'} iconColor="text-gray-500 dark:text-gray-400" compact />
            </div>

            {/* Price Summary */}
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Unit Price</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">{selectedItem.price_formatted}</span>
              </div>
              {selectedItem.stocks > 0 && (
                <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  Total Value: <strong className="text-green-600 dark:text-green-400">₱{(selectedItem.price * selectedItem.stocks).toLocaleString()}</strong>
                </div>
              )}
            </div>

            {/* Cost & Profit Analysis */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={14} className="text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Production Cost Analysis</span>
              </div>
              {loadingCostAnalysis ? (
                <div className="py-3 text-center">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Computing costs...</p>
                </div>
              ) : costAnalysis?.has_data ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-white/70 dark:bg-gray-700/70 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Avg. Cost/Unit</p>
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">₱{costAnalysis.avg_cost_per_unit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-2 bg-white/70 dark:bg-gray-700/70 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Profit/Unit</p>
                      <p className={`text-sm font-bold ${costAnalysis.profit_per_unit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {costAnalysis.profit_per_unit >= 0 ? '+' : ''}₱{costAnalysis.profit_per_unit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-white/70 dark:bg-gray-700/70 rounded-lg text-center">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Procurement</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-200">₱{costAnalysis.total_procurement_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-2 bg-white/70 dark:bg-gray-700/70 rounded-lg text-center">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Drying</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-200">₱{costAnalysis.total_drying_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-2 bg-white/70 dark:bg-gray-700/70 rounded-lg text-center">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Total Cost</p>
                      <p className="text-xs font-bold text-blue-700 dark:text-blue-300">₱{costAnalysis.total_production_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <div className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg ${
                    costAnalysis.profit_margin >= 20 ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700' :
                    costAnalysis.profit_margin >= 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' :
                    'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                  }`}>
                    {costAnalysis.profit_margin >= 0 ? (
                      <TrendingUp size={12} className={costAnalysis.profit_margin >= 20 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'} />
                    ) : (
                      <TrendingDown size={12} className="text-red-600 dark:text-red-400" />
                    )}
                    <span className={`text-xs font-semibold ${
                      costAnalysis.profit_margin >= 20 ? 'text-green-700 dark:text-green-400' :
                      costAnalysis.profit_margin >= 0 ? 'text-amber-700 dark:text-amber-300' :
                      'text-red-700 dark:text-red-300'
                    }`}>
                      {costAnalysis.profit_margin.toFixed(1)}% Profit Margin
                    </span>
                    <span className="text-[10px] text-gray-400">
                      ({costAnalysis.total_distributed_kg.toLocaleString()} kg from {costAnalysis.processings_count} processing{costAnalysis.processings_count !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">No distribution data yet — distribute stock to see cost analysis</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Inventory;
