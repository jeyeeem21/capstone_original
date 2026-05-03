import { useState, useCallback, useMemo, useEffect } from 'react';
import { Sun, Package, Clock, CheckCircle, DollarSign, Undo2, Check, PlusCircle, Calendar, Scale, Layers, Filter, X } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatusBadge, StatsCard, LineChart, DonutChart, FormModal, ConfirmModal, FormInput, FormSelect, Modal, useToast, SkeletonStats, SkeletonTable } from '../../../components/ui';
import { apiClient } from '../../../api';
import { useDataFetch, invalidateCache } from '../../../hooks';

const CACHE_KEY = '/drying-processes';
const PROCUREMENTS_CACHE_KEY = '/procurements';
const BATCHES_CACHE_KEY = '/procurement-batches';

const DryingProcess = () => {
  const toast = useToast();
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [activeChartPoint, setActiveChartPoint] = useState(null);
  const [chartScopeActive, setChartScopeActive] = useState(false);
  const [chartMonth, setChartMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [chartYear, setChartYear] = useState(() => new Date().getFullYear());
  const [chartYearFrom, setChartYearFrom] = useState(() => new Date().getFullYear() - 4);
  const [chartYearTo, setChartYearTo] = useState(() => new Date().getFullYear());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // kept for add modal reuse
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    procurement_id: '',
    quantity_kg: '',
    sacks: '',
    price: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Batch drying state
  const [dryingSource, setDryingSource] = useState('procurement'); // 'procurement' | 'batch'
  const [batchFormData, setBatchFormData] = useState({ batch_id: '', sacks: '', price: '' });
  const [batchPreview, setBatchPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [batchErrors, setBatchErrors] = useState({});

  // Batch filter state
  const [batchFilter, setBatchFilter] = useState('');

  // Fetch drying processes
  const {
    data: dryingProcesses,
    loading,
    isRefreshing,
    refetch,
    optimisticUpdate,
  } = useDataFetch('/drying-processes', {
    cacheKey: CACHE_KEY,
    initialData: [],
  });

  // Fetch procurements for add modal dropdown
  const { data: procurements, refetch: refetchProcurements } = useDataFetch('/procurements', {
    cacheKey: PROCUREMENTS_CACHE_KEY,
    initialData: [],
  });

  // Fetch all batches for batch mode
  const { data: allBatches, refetch: refetchBatches } = useDataFetch('/procurement-batches', {
    cacheKey: BATCHES_CACHE_KEY,
    initialData: [],
  });

  // Open + Closed batches are eligible for drying
  const openBatchOptions = useMemo(() => {
    const opts = allBatches
      .filter(b => b.status === 'Open' || b.status === 'Closed')
      .map(b => ({
        value: String(b.id),
        label: `${b.batch_number} — ${b.variety_name || '?'} (${b.remaining_sacks} sacks left)`,
      }));
    return [{ value: '', label: 'Select batch...' }, ...opts];
  }, [allBatches]);

  // Procurement options for dropdown - only Pending with available quantity
  const procurementOptions = useMemo(() => {
    return procurements
      .filter(p => p.status === 'Pending' && !p.batch_id)
      .map(p => ({
        value: String(p.id),
        label: `#${String(p.id).padStart(4, '0')} - ${p.supplier_name}${p.variety_name ? ` — ${p.variety_name}` : ''} (${parseInt(p.sacks || 0)} sacks / ${parseFloat(p.quantity_kg).toLocaleString()} kg)`,
      }));
  }, [procurements]);

  // Invalidate and refetch all related caches
  const invalidateAndRefetch = useCallback(async () => {
    invalidateCache(CACHE_KEY);
    invalidateCache(PROCUREMENTS_CACHE_KEY);
    invalidateCache(BATCHES_CACHE_KEY);
    await Promise.all([refetch(), refetchProcurements(), refetchBatches()]);
  }, [refetch, refetchProcurements, refetchBatches]);

  // Calculate selected procurement info for auto-fill
  const selectedProcurement = useMemo(() => {
    if (!formData.procurement_id) return null;
    return procurements.find(p => String(p.id) === formData.procurement_id) || null;
  }, [formData.procurement_id, procurements]);

  // Calculated total (for form preview): (sacks × price) × days
  const calculatedTotal = useMemo(() => {
    const sacks = parseInt(formData.sacks) || 0;
    const price = parseFloat(formData.price) || 0;
    const days = selectedItem?.days || 0;
    return (sacks * price) * days;
  }, [formData.sacks, formData.price, selectedItem]);

  // ---- Handlers ----
  const handleAdd = useCallback(() => {
    setFormData({ procurement_id: '', quantity_kg: '', sacks: '', price: '' });
    setBatchFormData({ batch_id: '', sacks: '', price: '' });
    setBatchPreview(null);
    setBatchErrors({});
    setDryingSource('procurement');
    setErrors({});
    refetchProcurements();
    refetchBatches();
    setIsAddModalOpen(true);
  }, [refetchProcurements, refetchBatches]);

  const handleView = useCallback(async (item) => {
    // If batch drying, fetch from show endpoint to get batchProcurements loaded
    if (item.batch_id) {
      try {
        const response = await apiClient.get(`/drying-processes/${item.id}`);
        setSelectedItem(response.data?.data || item);
      } catch {
        setSelectedItem(item);
      }
    } else {
      setSelectedItem(item);
    }
    setIsViewModalOpen(true);
  }, []);

  const handleDelete = useCallback((item) => {
    if (item.status !== 'Drying' && item.status !== 'Postponed') {
      toast.warning('Cannot Return', 'Only records with Drying or Postponed status can be returned.');
      return;
    }
    if ((item.days || 0) >= 1) {
      toast.warning('Cannot Return', 'Drying processes that have started (1+ days) cannot be returned.');
      return;
    }
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  }, [toast]);

  // Increment day (+1)
  const handleIncrementDay = useCallback(async (item) => {
    if (item.status !== 'Drying') return;
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiClient.post(`/drying-processes/${item.id}/increment-day`);
      if (response.success) {
        // Optimistic: update day count instantly
        optimisticUpdate(prev => prev.map(d => d.id === item.id ? { ...d, days: (item.days || 0) + 1 } : d));
        toast.success('Day Added', `Day ${item.days + 1} added. Total: ₱${((parseInt(item.sacks || 0) * parseFloat(item.price)) * (item.days + 1)).toLocaleString()}`);
        invalidateAndRefetch();
      } else {
        throw new Error(response.message || 'Failed to increment day');
      }
    } catch (error) {
      console.error('Error incrementing day:', error);
      toast.error('Error', error.message || 'Failed to add day');
    } finally {
      setSaving(false);
    }
  }, [saving, invalidateAndRefetch, toast]);

  // Mark as Dried (✓)
  const handleMarkDried = useCallback(async (item) => {
    if (item.status !== 'Drying') return;
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiClient.post(`/drying-processes/${item.id}/mark-dried`);
      if (response.success) {
        // Optimistic: mark as dried instantly
        optimisticUpdate(prev => prev.map(d => d.id === item.id ? { ...d, status: 'Dried' } : d));
        toast.success('Marked as Dried', `Drying #${String(item.id).padStart(4, '0')} is now dried and ready for processing.`);
        invalidateAndRefetch();
      } else {
        throw new Error(response.message || 'Failed to mark as dried');
      }
    } catch (error) {
      console.error('Error marking as dried:', error);
      toast.error('Error', error.message || 'Failed to mark as dried');
    } finally {
      setSaving(false);
    }
  }, [saving, invalidateAndRefetch, toast]);

  // Postpone drying — removed from UI

  const handleBatchFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setBatchFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Auto-fill max sacks when batch is selected
      if (name === 'batch_id' && value) {
        const batch = allBatches.find(b => String(b.id) === value);
        if (batch) updated.sacks = String(batch.remaining_sacks);
      }
      return updated;
    });
    setBatchErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    if (name === 'batch_id' || name === 'sacks') setBatchPreview(null);
  }, [allBatches]);

  // Auto-fetch distribution preview when batch + sacks are both filled
  useEffect(() => {
    const batchId = batchFormData.batch_id;
    const sacks = parseInt(batchFormData.sacks);
    if (!batchId || !sacks || sacks <= 0 || !isAddModalOpen || dryingSource !== 'batch') return;
    let cancelled = false;
    setLoadingPreview(true);
    apiClient.get(`/procurement-batches/${batchId}/drying-distribution?sacks=${sacks}`)
      .then(res => { if (!cancelled && res.success) setBatchPreview(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingPreview(false); });
    return () => { cancelled = true; };
  }, [batchFormData.batch_id, batchFormData.sacks, isAddModalOpen, dryingSource]);

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Auto-fill quantity_kg and sacks (remaining) when procurement is selected
      if (name === 'procurement_id' && value) {
        const proc = procurements.find(p => String(p.id) === value);
        if (proc) {
          const alreadyDrying = proc.drying_sacks || 0;
          const remaining = Math.max(0, parseInt(proc.sacks || 0) - alreadyDrying);
          updated.quantity_kg = String(proc.quantity_kg);
          updated.sacks = String(remaining);
        }
      }
      return updated;
    });
    setErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });
    // Real-time sacks validation
    if (name === 'sacks') {
      const num = parseInt(value);
      const procId = formData.procurement_id || (name === 'procurement_id' ? value : null);
      if (procId) {
        const proc = procurements.find(p => String(p.id) === procId);
        const alreadyDrying = proc?.drying_sacks || 0;
        const remaining = Math.max(0, parseInt(proc?.sacks || 0) - alreadyDrying);
        if (num > remaining) {
          setErrors(prev => ({ ...prev, sacks: [`Maximum is ${remaining} sacks.`] }));
        }
      }
    }
  }, [procurements]);

  const handleAddSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      setErrors({});
      setBatchErrors({});
      let submitData;

      if (dryingSource === 'batch') {
        const localErrors = {};
        if (!batchFormData.batch_id) localErrors.batch_id = ['Please select a batch.'];
        if (!batchFormData.sacks || parseInt(batchFormData.sacks) <= 0) localErrors.sacks = ['Enter number of sacks to dry.'];
        else {
          const selBatch = allBatches.find(b => String(b.id) === batchFormData.batch_id);
          if (selBatch && parseInt(batchFormData.sacks) > selBatch.remaining_sacks) {
            localErrors.sacks = [`Cannot exceed ${selBatch.remaining_sacks} available sacks.`];
          }
        }
        if (!batchFormData.price) localErrors.price = ['Price is required.'];
        if (Object.keys(localErrors).length) { setBatchErrors(localErrors); setSaving(false); throw new Error('Validation'); }
        submitData = {
          batch_id: parseInt(batchFormData.batch_id),
          sacks: parseInt(batchFormData.sacks),
          price: parseFloat(batchFormData.price),
        };
      } else {
        const localErrors = {};
        if (!formData.procurement_id) localErrors.procurement_id = ['Please select a procurement.'];
        const proc = procurements.find(p => String(p.id) === formData.procurement_id);
        const alreadyDrying = proc?.drying_sacks || 0;
        const remaining = Math.max(0, parseInt(proc?.sacks || 0) - alreadyDrying);
        if (!formData.sacks || parseInt(formData.sacks) <= 0) localErrors.sacks = ['Enter number of sacks.'];
        else if (parseInt(formData.sacks) > remaining) localErrors.sacks = [`Only ${remaining} sacks remaining.`];
        if (!formData.price) localErrors.price = ['Price is required.'];
        if (Object.keys(localErrors).length) { setErrors(localErrors); setSaving(false); throw new Error('Validation'); }
        submitData = {
          procurement_id: parseInt(formData.procurement_id),
          sacks: parseInt(formData.sacks),
          price: parseFloat(formData.price),
        };
      }

      const response = await apiClient.post('/drying-processes', submitData);
      if (response.success && response.data) {
        // Optimistic: show new drying process instantly
        optimisticUpdate(prev => [response.data, ...prev]);
        setIsAddModalOpen(false);
        toast.success('Drying Started',
          dryingSource === 'batch' ? 'Batch drying process has been created.' : 'New drying process has been created.');
        // Refetch in background
        invalidateAndRefetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      if (error.message === 'Validation') return;
      console.error('Error creating drying process:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        toast.error('Validation Error', 'Please fix the highlighted fields.');
        throw error;
      } else {
        toast.error('Error', error.message || 'Failed to create drying process');
        throw error;
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiClient.delete(`/drying-processes/${selectedItem.id}`);
      if (response.success) {
        const archivedId = selectedItem.id;
        setIsDeleteModalOpen(false);
        // Immediately remove from local data (optimistic update) for instant UI
        optimisticUpdate(prev => prev.filter(d => d.id !== archivedId));
        toast.success('Returned', 'Drying process has been returned to procurement.');
        // Refetch in background to confirm
        invalidateAndRefetch();
        return;
      } else {
        throw new Error(response.message || 'Failed to return');
      }
    } catch (error) {
      console.error('Error returning drying process:', error);
      toast.error('Error', 'Failed to return drying process to procurement');
    } finally {
      setSaving(false);
    }
  }, [selectedItem, invalidateAndRefetch, optimisticUpdate, toast, saving]);

  // ---- Chart helper functions ----
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
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const label = `${months[start.getMonth()]} ${start.getDate()} - ${months[end.getMonth()]} ${end.getDate()}`;
      weeks.push({ start: new Date(start), end: new Date(end), label });
      start.setDate(start.getDate() + 7);
      if (start.getMonth() > month && start.getFullYear() === year) break;
      if (start.getFullYear() > year) break;
      if (weeks.length >= 6) break;
    }
    return weeks;
  }, []);

  const matchesChartPoint = useCallback((d) => {
    if (!activeChartPoint || !d.created_at) return true;
    const date = new Date(d.created_at);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
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
    if (chartPeriod === 'monthly') {
      return date.getFullYear() === chartYear && months[date.getMonth()] === activeChartPoint;
    }
    if (chartPeriod === 'bi-annually') {
      if (activeChartPoint === 'H1') return date.getFullYear() === chartYear && date.getMonth() < 6;
      if (activeChartPoint === 'H2') return date.getFullYear() === chartYear && date.getMonth() >= 6;
      return false;
    }
    if (chartPeriod === 'annually') {
      return String(date.getFullYear()) === activeChartPoint;
    }
    return true;
  }, [activeChartPoint, chartPeriod, chartMonth, chartYear, getWeeksInMonth]);

  const isInChartScope = useCallback((d) => {
    if (!d.created_at) return false;
    const date = new Date(d.created_at);
    if (chartPeriod === 'daily') {
      const [y, m] = chartMonth.split('-').map(Number);
      return date.getFullYear() === y && date.getMonth() === m - 1;
    }
    if (chartPeriod === 'weekly') {
      const [y, m] = chartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      if (weeks.length === 0) return false;
      return date >= weeks[0].start && date <= new Date(weeks[weeks.length-1].end.getFullYear(), weeks[weeks.length-1].end.getMonth(), weeks[weeks.length-1].end.getDate(), 23, 59, 59);
    }
    if (chartPeriod === 'monthly') return date.getFullYear() === chartYear;
    if (chartPeriod === 'bi-annually') return date.getFullYear() === chartYear;
    if (chartPeriod === 'annually') return date.getFullYear() >= chartYearFrom && date.getFullYear() <= chartYearTo;
    return true;
  }, [chartPeriod, chartMonth, chartYear, chartYearFrom, chartYearTo, getWeeksInMonth]);

  const chartFilteredDrying = useMemo(() => {
    if (!chartScopeActive && !activeChartPoint) return dryingProcesses;
    const scoped = dryingProcesses.filter(isInChartScope);
    if (!activeChartPoint) return scoped;
    return scoped.filter(matchesChartPoint);
  }, [dryingProcesses, isInChartScope, activeChartPoint, matchesChartPoint, chartScopeActive]);

  const chartFilteredTableData = useMemo(() => {
    const filtered = chartFilteredDrying;
    if (batchFilter === 'no-batch') return filtered.filter(d => !d.batch_id);
    if (batchFilter) return filtered.filter(d => String(d.batch_id) === batchFilter);
    return filtered;
  }, [chartFilteredDrying, batchFilter]);

  // ---- Stats — filtered by chart scope + active point ----
  const totalRecords = chartFilteredDrying.length;
  const dryingCount = chartFilteredDrying.filter(d => d.status === 'Drying').length;
  const driedCount = chartFilteredDrying.filter(d => d.status === 'Dried').length;
  const totalQuantity = chartFilteredDrying.reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
  const totalCost = chartFilteredDrying.reduce((sum, d) => sum + parseFloat(d.total_price || 0), 0);
  const avgDays = totalRecords > 0 ? (chartFilteredDrying.reduce((sum, d) => sum + (d.days || 0), 0) / totalRecords).toFixed(1) : 0;

  // ---- Chart Data (daily, weekly, monthly, bi-annually, annually) ----
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (chartPeriod === 'daily') {
      const [y, m] = chartMonth.split('-').map(Number);
      const daysInMonth = getDaysInMonth(y, m - 1);
      const dayGroups = {};
      dryingProcesses.forEach(d => {
        if (!d.created_at) return;
        const date = new Date(d.created_at);
        if (date.getFullYear() === y && date.getMonth() === m - 1) {
          const day = date.getDate();
          if (!dayGroups[day]) dayGroups[day] = { cost: 0, quantity: 0 };
          dayGroups[day].cost += parseFloat(d.total_price || 0);
          dayGroups[day].quantity += parseFloat(d.quantity_kg || 0);
        }
      });
      return Array.from({ length: daysInMonth }, (_, i) => ({
        name: String(i + 1),
        value: dayGroups[i + 1]?.cost || 0,
        quantity: dayGroups[i + 1]?.quantity || 0,
      }));
    }

    if (chartPeriod === 'weekly') {
      const [y, m] = chartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      return weeks.map(week => {
        let cost = 0, quantity = 0;
        dryingProcesses.forEach(d => {
          if (!d.created_at) return;
          const date = new Date(d.created_at);
          if (date >= week.start && date <= new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59)) {
            cost += parseFloat(d.total_price || 0);
            quantity += parseFloat(d.quantity_kg || 0);
          }
        });
        return { name: week.label, value: cost, quantity };
      });
    }

    if (chartPeriod === 'monthly') {
      const monthGroups = {};
      dryingProcesses.forEach(d => {
        if (!d.created_at) return;
        const date = new Date(d.created_at);
        if (date.getFullYear() === chartYear) {
          const month = date.getMonth();
          if (!monthGroups[month]) monthGroups[month] = { cost: 0, quantity: 0 };
          monthGroups[month].cost += parseFloat(d.total_price || 0);
          monthGroups[month].quantity += parseFloat(d.quantity_kg || 0);
        }
      });
      return months.map((name, i) => ({
        name,
        value: monthGroups[i]?.cost || 0,
        quantity: monthGroups[i]?.quantity || 0,
      }));
    }

    if (chartPeriod === 'bi-annually') {
      const h1 = { cost: 0, quantity: 0 };
      const h2 = { cost: 0, quantity: 0 };
      dryingProcesses.forEach(d => {
        if (!d.created_at) return;
        const date = new Date(d.created_at);
        if (date.getFullYear() === chartYear) {
          const target = date.getMonth() < 6 ? h1 : h2;
          target.cost += parseFloat(d.total_price || 0);
          target.quantity += parseFloat(d.quantity_kg || 0);
        }
      });
      return [
        { name: 'H1', fullName: `Jan - Jun ${chartYear}`, value: h1.cost, quantity: h1.quantity },
        { name: 'H2', fullName: `Jul - Dec ${chartYear}`, value: h2.cost, quantity: h2.quantity },
      ];
    }

    // annually
    const years = [];
    for (let y = chartYearFrom; y <= chartYearTo; y++) years.push(y);
    const yearGroups = {};
    dryingProcesses.forEach(d => {
      if (!d.created_at) return;
      const date = new Date(d.created_at);
      const year = date.getFullYear();
      if (year >= chartYearFrom && year <= chartYearTo) {
        if (!yearGroups[year]) yearGroups[year] = { cost: 0, quantity: 0 };
        yearGroups[year].cost += parseFloat(d.total_price || 0);
        yearGroups[year].quantity += parseFloat(d.quantity_kg || 0);
      }
    });
    return years.map(year => ({
      name: year.toString(),
      value: yearGroups[year]?.cost || 0,
      quantity: yearGroups[year]?.quantity || 0,
    }));
  }, [dryingProcesses, chartPeriod, chartMonth, chartYear, chartYearFrom, chartYearTo, getWeeksInMonth]);

  // Status breakdown for donut chart — uses chartFilteredDrying
  const statusBreakdown = useMemo(() => {
    let drying = 0, dried = 0;
    chartFilteredDrying.forEach(d => {
      if (d.status === 'Drying') drying++;
      if (d.status === 'Dried') dried++;
    });
    return [
      { name: 'Drying', value: drying, color: '#eab308' },
      { name: 'Dried', value: dried, color: '#22c55e' },
    ].filter(item => item.value > 0);
  }, [chartFilteredDrying]);

  // Sacks vs Kg comparison — uses chartFilteredDrying
  const totalSacks = chartFilteredDrying.reduce((sum, d) => sum + parseInt(d.sacks || 0), 0);
  const quantityComparison = useMemo(() => {
    let filteredSacks = 0, filteredKg = 0;
    chartFilteredDrying.forEach(d => {
      filteredSacks += parseInt(d.sacks || 0);
      filteredKg += parseFloat(d.quantity_kg || 0);
    });
    return [
      { name: 'Sacks', value: filteredSacks, color: '#22c55e' },
      { name: 'Kg', value: Math.round(filteredKg), color: '#3b82f6' },
    ];
  }, [chartFilteredDrying]);

  // ---- Table Columns ----
  const columns = useMemo(() => [
    {
      header: 'ID', accessor: 'id',
      cell: (row) => <span className="font-mono text-sm text-gray-600 dark:text-gray-300">#{String(row.id).padStart(4, '0')}</span>
    },
    {
      header: 'Source', accessor: 'procurement_info',
      cell: (row) => {
        if (row.batch_id) return (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 w-fit">
              <Layers size={10} />{row.batch_number}
            </span>
          </div>
        );
        return row.procurement_info ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">#{String(row.procurement_id).padStart(4, '0')} - {row.procurement_info.supplier_name}</span>
            {row.procurement_info.variety_name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white w-fit" style={{ backgroundColor: row.procurement_info.variety_color || '#6b7280' }}>
                {row.procurement_info.variety_name}
              </span>
            )}
          </div>
        ) : <span className="text-gray-400 text-sm">-</span>;
      }
    },
    {
      header: 'Quantity', accessor: 'quantity_kg',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-green-600 dark:text-green-400">
            {parseFloat(row.quantity_kg).toLocaleString()} kg
          </span>
          <span className="text-xs text-blue-600 dark:text-blue-400">
            {parseInt(row.sacks || 0)} sacks
          </span>
          {parseFloat(row.quantity_out || 0) > 0 && (
            <span className="text-xs font-medium text-red-500">
              -{parseFloat(row.quantity_out).toLocaleString()} kg out
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Days', accessor: 'days',
      cell: (row) => <span className="font-semibold text-blue-600 dark:text-blue-400">{row.days}</span>
    },
    {
      header: 'Price', accessor: 'price',
      cell: (row) => <span className="text-gray-700 dark:text-gray-200">₱{parseFloat(row.price).toLocaleString()}</span>
    },
    {
      header: 'Total Price', accessor: 'total_price',
      cell: (row) => <span className="font-semibold text-button-600 dark:text-button-400">₱{parseFloat(row.total_price).toLocaleString()}</span>
    },
    { header: 'Status', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Dates', accessor: 'created_at',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Start: {row.created_at ? new Date(row.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </span>
          {row.dried_at ? (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
              Dried: {new Date(row.dried_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          ) : (
            <span className="text-xs text-yellow-500 italic">In progress</span>
          )}
        </div>
      )
    },
    {
      header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => {
        const isDrying = row.status === 'Drying';
        const isDried = row.status === 'Dried';
        const actionDisabled = isDried; // +day, mark dried, edit disabled unless Drying
        const deleteDisabled = isDried;
        return (
          <div className="flex items-center gap-1">
            {/* + button: increment day */}
            <button
              onClick={(e) => { e.stopPropagation(); handleIncrementDay(row); }}
              disabled={actionDisabled || saving}
              className={`p-1.5 rounded-md transition-colors ${
                actionDisabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 hover:text-blue-700 dark:text-blue-300'
              }`}
              title={actionDisabled ? 'Cannot add days' : 'Add Day (+1)'}
            >
              <PlusCircle size={15} />
            </button>
            {/* ✓ button: mark as dried */}
            <button
              onClick={(e) => { e.stopPropagation(); handleMarkDried(row); }}
              disabled={actionDisabled || (row.days || 0) < 1 || saving}
              className={`p-1.5 rounded-md transition-colors ${
                actionDisabled || (row.days || 0) < 1 ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-500 hover:text-green-700 dark:text-green-300'
              }`}
              title={actionDisabled ? 'Already dried' : (row.days || 0) < 1 ? 'Add at least 1 day first' : 'Mark as Dried'}
            >
              <Check size={15} />
            </button>
            {/* Return button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
              disabled={deleteDisabled || (row.days || 0) >= 1}
              className={`p-1.5 rounded-md transition-colors ${
                deleteDisabled || (row.days || 0) >= 1 ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-amber-50 text-amber-500 hover:text-amber-700 dark:text-amber-300'
              }`}
              title={deleteDisabled ? 'Cannot return' : (row.days || 0) >= 1 ? 'Cannot return — drying has started' : 'Return to Procurement'}
            >
              <Undo2 size={15} />
            </button>
          </div>
        );
      }
    },
  ], [handleIncrementDay, handleMarkDried, handleDelete, saving]);

  return (
    <div>
      <PageHeader
        title="Drying Process"
        description="Manage the drying stage between procurement and processing"
        icon={Sun}
        action={isRefreshing ? (
          <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">Syncing...</span>
        ) : null}
      />

      {/* Stats Cards */}
      {loading && dryingProcesses.length === 0 ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Records" value={totalRecords} unit="entries" icon={Package} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <StatsCard label="Currently Drying" value={dryingCount} unit="batches" icon={Clock} iconBgColor="bg-gradient-to-br from-yellow-400 to-yellow-600" />
          <StatsCard label="Dried" value={driedCount} unit="batches" icon={CheckCircle} iconBgColor="bg-gradient-to-br from-green-400 to-green-600" />
          <StatsCard label="Total Cost" value={`₱${totalCost.toLocaleString()}`} unit="drying cost" icon={DollarSign} iconBgColor="bg-gradient-to-br from-button-500 to-button-700" />
        </div>
      )}

      {/* Charts */}
      {loading && dryingProcesses.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 bg-white dark:bg-gray-700 rounded-xl border border-primary-200 dark:border-primary-700 p-6 h-[340px] animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
            <div className="h-[240px] bg-gray-100 dark:bg-gray-700 rounded"></div>
          </div>
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-700 rounded-xl border border-primary-200 dark:border-primary-700 p-4 h-[162px] animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
              <div className="h-[100px] bg-gray-100 dark:bg-gray-700 rounded-full mx-auto w-[100px]"></div>
            </div>
            <div className="bg-white dark:bg-gray-700 rounded-xl border border-primary-200 dark:border-primary-700 p-4 h-[162px] animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
              <div className="h-[100px] bg-gray-100 dark:bg-gray-700 rounded-full mx-auto w-[100px]"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2">
            <LineChart
              title="Drying Cost Trends"
              subtitle={(() => {
                const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                if (!chartScopeActive && !activeChartPoint) return 'Drying process cost overview';
                let scope = '';
                if (chartPeriod === 'daily' || chartPeriod === 'weekly') { const [y,m] = chartMonth.split('-').map(Number); scope = `${months[m-1]} ${y}`; }
                else if (chartPeriod === 'monthly' || chartPeriod === 'bi-annually') scope = String(chartYear);
                else if (chartPeriod === 'annually') scope = `${chartYearFrom}–${chartYearTo}`;
                const mode = chartPeriod.charAt(0).toUpperCase() + chartPeriod.slice(1);
                if (activeChartPoint) return `${activeChartPoint} · ${scope}`;
                return `${mode} · ${scope}`;
              })()}
              data={chartData}
              lines={[{ dataKey: 'value', name: 'Cost (₱)' }]}
              height={280}
              yAxisUnit="₱"
              headerRight={
                <div className="flex items-center gap-2 flex-wrap">
                  {(activeChartPoint || chartScopeActive) && (
                    <button
                      onClick={() => { setActiveChartPoint(null); setChartScopeActive(false); setChartPeriod('daily'); const d = new Date(); setChartMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); setChartYear(d.getFullYear()); setChartYearFrom(d.getFullYear() - 4); setChartYearTo(d.getFullYear()); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      title="Clear chart filter"
                    >
                      <X size={14} />
                      Clear Filter
                    </button>
                  )}
                  <select
                    value={chartPeriod}
                    onClick={() => { if (!chartScopeActive) { setActiveChartPoint(null); setChartScopeActive(true); } }}
                    onChange={(e) => { setChartPeriod(e.target.value); setActiveChartPoint(null); setChartScopeActive(true); }}
                    className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="bi-annually">Bi-Annually</option>
                    <option value="annually">Annually</option>
                  </select>
                  {chartPeriod === 'daily' && (
                    <input type="month" value={chartMonth} onChange={(e) => { setChartMonth(e.target.value); setActiveChartPoint(null); setChartScopeActive(true); }}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  )}
                  {chartPeriod === 'weekly' && (
                    <input type="month" value={chartMonth} onChange={(e) => { setChartMonth(e.target.value); setActiveChartPoint(null); setChartScopeActive(true); }}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  )}
                  {chartPeriod === 'monthly' && (
                    <input type="number" value={chartYear} onChange={(e) => { setChartYear(parseInt(e.target.value) || new Date().getFullYear()); setActiveChartPoint(null); setChartScopeActive(true); }}
                      min="2000" max={new Date().getFullYear()}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-24" />
                  )}
                  {chartPeriod === 'bi-annually' && (
                    <input type="number" value={chartYear} onChange={(e) => { setChartYear(parseInt(e.target.value) || new Date().getFullYear()); setActiveChartPoint(null); setChartScopeActive(true); }}
                      min="2000" max={new Date().getFullYear()}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-24" />
                  )}
                  {chartPeriod === 'annually' && (
                    <div className="flex items-center gap-1">
                      <input type="number" value={chartYearFrom} onChange={(e) => { const v = parseInt(e.target.value) || 2000; setChartYearFrom(v); setActiveChartPoint(null); setChartScopeActive(true); }}
                        min="2000" max={chartYearTo}
                        className="px-2 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-20" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">to</span>
                      <input type="number" value={chartYearTo} onChange={(e) => { const v = parseInt(e.target.value) || new Date().getFullYear(); setChartYearTo(v); setActiveChartPoint(null); setChartScopeActive(true); }}
                        min={chartYearFrom} max={new Date().getFullYear()}
                        className="px-2 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-20" />
                    </div>
                  )}
                </div>
              }
              onDotClick={(point) => { setActiveChartPoint(point); setChartScopeActive(true); }}
              activePoint={activeChartPoint}
              summaryStats={[
                { label: 'Total Records', value: totalRecords.toString(), color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Avg Days', value: String(avgDays), color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Total Qty', value: `${totalQuantity.toLocaleString()} kg`, color: 'text-green-600 dark:text-green-400' },
              ]}
            />
          </div>
          <div className="space-y-4">
            <DonutChart
              title="Status Breakdown"
              data={statusBreakdown}
              centerValue={totalRecords.toString()}
              centerLabel="Total"
              height={175}
              innerRadius={56}
              outerRadius={78}
              showLegend={true}
              horizontalLegend={true}
              valueUnit=""
            />
            <DonutChart
              title="Sacks vs Kg"
              data={quantityComparison}
              centerValue={`${totalSacks}`}
              centerLabel="Sacks"
              height={140}
              innerRadius={45}
              outerRadius={62}
              showLegend={true}
              horizontalLegend={true}
              valueUnit=""
            />
          </div>
        </div>
      )}

      {/* Batch Filter + Table */}
      {loading && dryingProcesses.length === 0 ? (
        <SkeletonTable rows={5} columns={8} />
      ) : (
        <>
          {/* Batch Filter Bar */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-indigo-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Filter by Batch:</span>
            </div>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 min-w-[240px]"
            >
              <option value="">All Batches</option>
              <option value="no-batch">No Batch (Standalone)</option>
              {allBatches.map(b => (
                <option key={b.id} value={String(b.id)}>{b.batch_number} — {b.variety_name || '?'} ({b.remaining_sacks}/{b.total_sacks} sacks left)</option>
              ))}
            </select>
            {batchFilter && (
              <button
                onClick={() => setBatchFilter('')}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 underline transition-colors"
              >
                Clear filter
              </button>
            )}
            {batchFilter && batchFilter !== 'no-batch' && (() => {
              const b = allBatches.find(b => String(b.id) === batchFilter);
              return b ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg">
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{b.batch_number}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">·</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">{b.remaining_sacks}/{b.total_sacks} sacks remaining</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">·</span>
                  <span className={`text-xs font-medium ${b.status === 'Open' ? 'text-green-600 dark:text-green-400' : b.status === 'Closed' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'}`}>{b.status}</span>
                </div>
              ) : null;
            })()}
          </div>
          <DataTable
            title="Drying Records"
            subtitle="Manage all drying process records"
            columns={columns}
            data={chartFilteredTableData}
            searchPlaceholder="Search drying records..."
            filterField="status"
            filterPlaceholder="All Status"
            dateFilterField="created_at"
            onAdd={handleAdd}
            addLabel="Add Drying"
            onRowDoubleClick={handleView}
          />
        </>
      )}

      {/* View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Drying Process Details"
        size="2xl"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedItem && (
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              {/* ID & Status */}
              <div className="bg-gradient-to-r from-primary-50 dark:from-gray-700 to-button-50 dark:to-gray-700 p-3 rounded-lg border-2 border-primary-200 dark:border-primary-700">
                <div className="flex items-start gap-2">
                  <div className="p-2 bg-button-500 text-white rounded-lg">
                    <Sun size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Drying #{String(selectedItem.id).padStart(4, '0')}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300">Record ID</p>
                  </div>
                  <StatusBadge status={selectedItem.status} />
                </div>
              </div>

              {/* Procurement Info */}
              {selectedItem.procurement_info && (
                <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><Package size={18} /></div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Procurement Source</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">#{String(selectedItem.procurement_id).padStart(4, '0')} - {selectedItem.procurement_info.supplier_name}</p>
                  </div>
                </div>
              )}

              {/* Batch Info */}
              {selectedItem.batch_id && (
                <div className="flex items-start gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg"><Layers size={18} /></div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Batch Source</p>
                    <p className="font-semibold text-indigo-700 dark:text-indigo-300 text-sm">{selectedItem.batch_number}</p>
                    {selectedItem.batch_breakdown?.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {selectedItem.batch_breakdown.map((item, i) => (
                          <p key={i} className="text-xs text-gray-600 dark:text-gray-300">
                            #{String(item.procurement_id).padStart(4,'0')} {item.supplier_name} — {item.sacks_taken} sacks / {parseFloat(item.quantity_kg).toLocaleString()} kg
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Total Cost */}
              <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-button-50 dark:from-gray-700 to-primary-50 dark:to-gray-700 rounded-lg border-2 border-button-200 dark:border-button-700">
                <div className="p-2 bg-button-500 text-white rounded-lg">
                  <DollarSign size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Total Cost</p>
                  <p className="text-xl font-bold text-button-600 dark:text-button-400">₱{parseFloat(selectedItem.total_price).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">({parseInt(selectedItem.sacks || 0)} sacks × ₱{parseFloat(selectedItem.price).toLocaleString()}) × {selectedItem.days} days</p>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {/* Quantity Info */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                    <Scale size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300">Quantity</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{parseInt(selectedItem.sacks || 0)} sacks ({parseFloat(selectedItem.quantity_kg).toLocaleString()} kg)</p>
                  </div>
                </div>
              </div>

              {/* Days & Price */}
              <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Calendar size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Drying Days</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{selectedItem.days} days</p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-lg">
                  <DollarSign size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Price</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">₱{parseFloat(selectedItem.price).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Modal */}
      <FormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddSubmit}
        title="Add Drying Process"
        submitText="Start Drying"
        size="lg"
        loading={saving}
        submitDisabled={!!(errors.sacks?.length || batchErrors.sacks?.length)}
      >
        {({ submitted }) => (
          <>
            {/* Source Toggle */}
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => { setDryingSource('procurement'); setBatchPreview(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                  dryingSource === 'procurement' ? 'bg-white dark:bg-gray-700 shadow text-button-600 dark:text-button-400 border border-button-200 dark:border-button-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-200'
                }`}
              >
                <Package size={14} /> Standalone
              </button>
              <button
                type="button"
                onClick={() => setDryingSource('batch')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                  dryingSource === 'batch' ? 'bg-white dark:bg-gray-700 shadow text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-200'
                }`}
              >
                <Layers size={14} /> From Batch
              </button>
            </div>

            {/* Single procurement mode */}
            {dryingSource === 'procurement' && (
              <>
                <FormSelect
                  label="Procurement Source"
                  name="procurement_id"
                  value={formData.procurement_id}
                  onChange={handleFormChange}
                  options={procurementOptions}
                  placeholder="Select procurement to dry..."
                  required
                  submitted={submitted}
                  error={errors.procurement_id?.[0]}
                />
                {formData.procurement_id && (() => {
                  const proc = procurements.find(p => String(p.id) === formData.procurement_id);
                  const alreadyDrying = proc?.drying_sacks || 0;
                  const totalSacks = parseInt(proc?.sacks || 0);
                  const remaining = Math.max(0, totalSacks - alreadyDrying);
                  const enteredSacks = parseInt(formData.sacks) || 0;
                  const proportionalKg = totalSacks > 0 ? ((enteredSacks / totalSacks) * parseFloat(proc?.quantity_kg || 0)).toFixed(2) : 0;
                  return (
                    <>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg mb-2">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          {totalSacks} total sacks / {parseFloat(proc?.quantity_kg || 0).toLocaleString()} kg
                          {alreadyDrying > 0 && <span className="text-orange-600 dark:text-orange-400 ml-1">({alreadyDrying} already drying)</span>}
                          {' · '}<strong>{remaining} sacks available</strong>
                        </p>
                      </div>
                      <FormInput
                        label={`Sacks to Dry (max ${remaining})`}
                        name="sacks"
                        type="number"
                        value={formData.sacks}
                        onChange={handleFormChange}
                        required
                        placeholder={`1 - ${remaining}`}
                        submitted={submitted}
                        error={errors.sacks?.[0]}
                        min="1"
                        max={remaining}
                      />
                      {enteredSacks > 0 && enteredSacks <= remaining && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg mb-2">
                          <p className="text-xs text-green-700 dark:text-green-300">
                            <strong>{enteredSacks} sacks</strong> → <strong>{parseFloat(proportionalKg).toLocaleString()} kg</strong> will be sent to drying.
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
                <FormInput label="Price (₱)" name="price" type="number" value={formData.price}
                  onChange={handleFormChange} required placeholder="0.00" submitted={submitted}
                  error={errors.price?.[0]} step="0.01"
                />
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-primary-200 dark:border-primary-700 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-300">Days start at <strong>0</strong>. Use the <strong>+</strong> button in the table to increment days. Total = (Sacks × Price) × Days.</p>
                </div>
              </>
            )}

            {/* Batch mode */}
            {dryingSource === 'batch' && (
              <>
                <div className="mb-3">
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Batch <span className="text-red-500">*</span></label>
                  <select name="batch_id" value={batchFormData.batch_id} onChange={handleBatchFormChange}
                    className={`w-full px-4 py-2.5 text-sm border-2 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-4 transition-all ${
                      batchErrors.batch_id ? 'border-red-400 focus:ring-red-500/20' : 'border-gray-200 dark:border-gray-600 focus:ring-indigo-500/20 focus:border-indigo-400'
                    }`}
                  >
                    {openBatchOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  {batchErrors.batch_id && <p className="mt-1 text-xs text-red-500">{batchErrors.batch_id[0]}</p>}
                </div>

                {batchFormData.batch_id && (() => {
                  const b = allBatches.find(b => String(b.id) === batchFormData.batch_id);
                  return b ? (
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg mb-3 flex gap-4">
                      <div><p className="text-xs text-gray-500 dark:text-gray-400">Variety</p><p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{b.variety_name}</p></div>
                      <div><p className="text-xs text-gray-500 dark:text-gray-400">Available</p><p className="text-sm font-bold text-green-600 dark:text-green-400">{b.remaining_sacks} sacks / {parseFloat(b.remaining_kg).toLocaleString()} kg</p></div>
                      <div><p className="text-xs text-gray-500 dark:text-gray-400">Status</p><p className="text-sm font-medium">{b.status}</p></div>
                    </div>
                  ) : null;
                })()}

                <FormInput label="Sacks to Dry" name="sacks" type="number"
                  value={batchFormData.sacks} onChange={handleBatchFormChange}
                  required placeholder="0" submitted={submitted} error={batchErrors.sacks?.[0]}
                  min={1} max={(() => { const b = allBatches.find(b => String(b.id) === batchFormData.batch_id); return b ? b.remaining_sacks : undefined; })()}
                />
                {batchFormData.batch_id && batchFormData.sacks && (() => {
                  const b = allBatches.find(b => String(b.id) === batchFormData.batch_id);
                  if (b && parseInt(batchFormData.sacks) > b.remaining_sacks) {
                    return <p className="text-xs text-red-500 mt-1">Cannot exceed {b.remaining_sacks} available sacks</p>;
                  }
                  return null;
                })()}

                {loadingPreview && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-primary-200 dark:border-primary-700 rounded-lg mb-2 animate-pulse">
                    <p className="text-xs text-gray-400">Calculating distribution...</p>
                  </div>
                )}
                {batchPreview && !loadingPreview && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg mb-2">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1.5">Proportional distribution:</p>
                    <div className="space-y-1">
                      {batchPreview.breakdown?.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-700 dark:text-gray-200">
                          <span>Procurement #{String(item.procurement_id).padStart(4,'0')}</span>
                          <span>{item.sacks_taken} sacks → {parseFloat(item.quantity_kg).toLocaleString()} kg</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-green-200 dark:border-green-700 flex justify-between text-xs font-bold text-green-700 dark:text-green-300">
                      <span>Total</span>
                      <span>{batchFormData.sacks} sacks → {parseFloat(batchPreview.total_kg || 0).toLocaleString()} kg</span>
                    </div>
                  </div>
                )}

                <FormInput label="Drying Price (₱/sack)" name="price" type="number"
                  value={batchFormData.price} onChange={handleBatchFormChange}
                  required placeholder="0.00" submitted={submitted} error={batchErrors.price?.[0]} step="0.01"
                />
              </>
            )}
          </>
        )}
      </FormModal>

      {/* Return Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Return to Procurement"
        message={`Are you sure you want to return Drying #${String(selectedItem?.id || 0).padStart(4, '0')}? The quantity will be returned to its procurement.`}
        confirmText="Return"
        variant="warning"
        icon={Undo2}
        loading={saving}
      />
    </div>
  );
};

export default DryingProcess;
