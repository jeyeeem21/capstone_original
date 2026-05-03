import { useState, useCallback, useMemo } from 'react';
import { Settings2, Package, CheckCircle, TrendingUp, FileText, Archive, Eye, Calendar, Hash, Scale, Activity, Play, User, Percent, Layers, RotateCcw, ArrowDown, X, Undo2, Edit } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatusBadge, ActionButtons, StatsCard, LineChart, DonutChart, FormModal, ConfirmModal, FormInput, FormSelect, useToast, Modal, Button, SkeletonStats, SkeletonTable } from '../../../components/ui';
import { apiClient } from '../../../api';
import { useDataFetch, invalidateCache } from '../../../hooks';

const CACHE_KEY = '/processings';
const ACTIVE_CACHE_KEY = '/processings/active';
const COMPLETED_CACHE_KEY = '/processings/completed';
const DRYING_CACHE_KEY = '/drying-processes';

const Processing = () => {
  const toast = useToast();
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [activeChartPoint, setActiveChartPoint] = useState(null);
  const [chartScopeActive, setChartScopeActive] = useState(false);
  const [chartMonth, setChartMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [chartYear, setChartYear] = useState(() => new Date().getFullYear());
  const [chartYearFrom, setChartYearFrom] = useState(() => new Date().getFullYear() - 4);
  const [chartYearTo, setChartYearTo] = useState(() => new Date().getFullYear());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({ 
    drying_process_id: '', 
    input_kg: '', 
    operator_name: '', 
    processing_date: new Date().toISOString().split('T')[0]
  });
  const [selectedDryingIds, setSelectedDryingIds] = useState([]); // Multi-select drying sources
  const [completeFormData, setCompleteFormData] = useState({
    output_kg: '',
    husk_kg: 0,
    yield_percent: 0
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Super-fast data fetching with cache - parallel fetches
  const { 
    data: activeProcessings, 
    loading: loadingActive, 
    isRefreshing: refreshingActive,
    refetch: refetchActive,
    optimisticUpdate: optimisticUpdateActive,
  } = useDataFetch('/processings/active', {
    cacheKey: ACTIVE_CACHE_KEY,
    initialData: [],
  });

  const { 
    data: completedProcessings, 
    loading: loadingCompleted, 
    isRefreshing: refreshingCompleted,
    refetch: refetchCompleted,
    optimisticUpdate: optimisticUpdateCompleted,
  } = useDataFetch('/processings/completed', {
    cacheKey: COMPLETED_CACHE_KEY,
    initialData: [],
  });

  // Fetch drying processes for dropdown
  const { data: dryingProcesses, refetch: refetchDrying } = useDataFetch('/drying-processes', {
    cacheKey: DRYING_CACHE_KEY,
    initialData: [],
  });

  // Derived states - show data immediately, only show skeleton on true first load
  const loading = loadingActive && activeProcessings.length === 0 && loadingCompleted && completedProcessings.length === 0;
  const isRefreshing = refreshingActive || refreshingCompleted;
  
  // Combine all records for stats - memoized
  const allProcessings = useMemo(() => [...activeProcessings, ...completedProcessings], [activeProcessings, completedProcessings]);

  // Convert drying processes to options - memoized
  // Only show Dried items with remaining quantity
  // State for dropdown selection in Add modal
  const [pendingDryingId, setPendingDryingId] = useState('');

  const dryingOptions = useMemo(() => {
    const currentDryingId = selectedItem?.drying_process_id ? String(selectedItem.drying_process_id) : null;
    const currentInputKg = selectedItem?.input_kg ? parseFloat(selectedItem.input_kg) : 0;
    
    const options = dryingProcesses
      .filter(d => {
        const remaining = parseFloat(d.quantity_kg) - parseFloat(d.quantity_out || 0);
        return d.status === 'Dried' && (remaining > 0 || String(d.id) === currentDryingId);
      })
      .map(d => {
        let remaining = parseFloat(d.quantity_kg) - parseFloat(d.quantity_out || 0);
        if (String(d.id) === currentDryingId && isEditModalOpen) {
          remaining += currentInputKg;
        }
        // Get variety name from batch or procurement - use Drying ID as fallback
        const varietyName = d.batch_variety_name || d.procurement_info?.variety_name || `Drying #${String(d.id).padStart(4, '0')}`;
        const batchNumber = d.batch_number || null;
        return { 
          value: String(d.id), 
          label: batchNumber ? `${varietyName} (${batchNumber}) — ${remaining.toLocaleString()} kg` : `${varietyName} — ${remaining.toLocaleString()} kg`,
          remaining: remaining,
          varietyName: varietyName,
          batchNumber: batchNumber,
        };
      });
    return options;
  }, [dryingProcesses, selectedItem, isEditModalOpen]);

  // Grouped drying options for Add modal — combines same-batch items into one option
  const groupedDryingOptions = useMemo(() => {
    const driedItems = dryingProcesses
      .filter(d => {
        const remaining = parseFloat(d.quantity_kg) - parseFloat(d.quantity_out || 0);
        return d.status === 'Dried' && remaining > 0;
      })
      .map(d => {
        const remaining = parseFloat(d.quantity_kg) - parseFloat(d.quantity_out || 0);
        const varietyName = d.batch_variety_name || d.procurement_info?.variety_name || `Drying #${String(d.id).padStart(4, '0')}`;
        const batchNumber = d.batch_number || null;
        const batchId = d.batch_id || null;
        const driedAt = d.dried_at ? new Date(d.dried_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : null;
        return { id: String(d.id), remaining, varietyName, batchNumber, batchId, driedAt };
      });

    // Group by batch_id (non-null batch items get combined)
    const batchGroups = {};
    const standaloneItems = [];

    driedItems.forEach(item => {
      if (item.batchId) {
        if (!batchGroups[item.batchId]) {
          batchGroups[item.batchId] = {
            batchId: item.batchId,
            batchNumber: item.batchNumber,
            varietyName: item.varietyName,
            dryingIds: [],
            totalRemaining: 0,
            sourceCount: 0,
          };
        }
        batchGroups[item.batchId].dryingIds.push(item.id);
        batchGroups[item.batchId].totalRemaining += item.remaining;
        batchGroups[item.batchId].sourceCount += 1;
      } else {
        standaloneItems.push(item);
      }
    });

    const options = [];

    // Add batch groups as single options
    Object.values(batchGroups).forEach(group => {
      options.push({
        value: `batch-${group.batchId}`,
        label: `${group.varietyName} (${group.batchNumber}) — ${group.totalRemaining.toLocaleString()} kg`,
        remaining: group.totalRemaining,
        varietyName: group.varietyName,
        batchNumber: group.batchNumber,
        dryingIds: group.dryingIds,
        sourceCount: group.sourceCount,
      });
    });

    // Add standalone items individually (with dried date for distinction)
    standaloneItems.forEach(item => {
      const dateStr = item.driedAt ? ` · Dried ${item.driedAt}` : '';
      options.push({
        value: `single-${item.id}`,
        label: `${item.varietyName} — ${item.remaining.toLocaleString()} kg${dateStr}`,
        remaining: item.remaining,
        varietyName: item.varietyName,
        batchNumber: null,
        dryingIds: [item.id],
        driedAt: item.driedAt,
        sourceCount: 1,
      });
    });

    return options;
  }, [dryingProcesses]);

  // Fast invalidate and parallel refetch - includes procurements for qty_out sync
  const invalidateAndRefetch = useCallback(async () => {
    invalidateCache(CACHE_KEY);
    invalidateCache(ACTIVE_CACHE_KEY);
    invalidateCache(COMPLETED_CACHE_KEY);
    invalidateCache(DRYING_CACHE_KEY);
    await Promise.all([refetchActive(), refetchCompleted(), refetchDrying()]);
  }, [refetchActive, refetchCompleted, refetchDrying]);

  const handleView = useCallback((item) => {
    setSelectedItem(item);
    setIsViewModalOpen(true);
  }, []);

  const handleAdd = useCallback(() => {
    setFormData({ 
      drying_process_id: '', 
      input_kg: '', 
      operator_name: '', 
      processing_date: new Date().toISOString().split('T')[0]
    });
    setSelectedDryingIds([]);
    setPendingDryingId('');
    setErrors({});
    refetchDrying();
    setIsAddModalOpen(true);
  }, [refetchDrying]);

  const handleEdit = useCallback((item) => {
    // Only allow editing Pending items
    if (item.status !== 'Pending') {
      toast.warning('Cannot Edit', 'Only pending records can be edited.');
      return;
    }
    setSelectedItem(item);
    setFormData({ 
      drying_process_id: item.drying_process_id ? String(item.drying_process_id) : '', 
      input_kg: String(item.input_kg), 
      operator_name: item.operator_name || '', 
      processing_date: item.processing_date || new Date().toISOString().split('T')[0]
    });
    setErrors({});
    refetchDrying();
    setIsEditModalOpen(true);
  }, [toast, refetchDrying]);

  const handleDelete = useCallback((item) => {
    // Only allow returning Pending items to drying
    if (item.status !== 'Pending') {
      toast.warning('Cannot Return', 'Only pending records can be returned to drying.');
      return;
    }
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  }, [toast]);

  // Start processing action - optimized
  const handleStartProcessing = useCallback(async (item) => {
    if (item.status !== 'Pending') {
      toast.warning('Cannot Start', 'Only pending records can be started.');
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient.post(`/processings/${item.id}/process`);
      
      if (response.success) {
        await invalidateAndRefetch();
        toast.success('Processing Started', `Record #${String(item.id).padStart(4, '0')} is now being processed.`);
      } else {
        throw new Error(response.message || 'Failed to start processing');
      }
    } catch (error) {
      console.error('Error starting processing:', error);
      toast.error('Error', error.message || 'Failed to start processing');
    } finally {
      setSaving(false);
    }
  }, [toast, invalidateAndRefetch]);

  // Open complete modal
  const handleOpenCompleteModal = useCallback((item) => {
    if (item.status !== 'Processing') {
      toast.warning('Cannot Complete', 'Only processing records can be completed.');
      return;
    }
    setSelectedItem(item);
    setCompleteFormData({
      output_kg: '',
      husk_kg: 0,
      yield_percent: 0
    });
    setIsCompleteModalOpen(true);
  }, [toast]);

  // Open return to processing confirmation modal
  const handleReturnToProcessing = useCallback((item) => {
    if (item.status !== 'Completed') {
      toast.warning('Cannot Return', 'Only completed batches can be returned to processing.');
      return;
    }

    if (parseFloat(item.stock_out || 0) > 0) {
      toast.warning('Cannot Return', 'Cannot return to processing: stock has already been distributed.');
      return;
    }

    setSelectedItem(item);
    setIsReturnModalOpen(true);
  }, [toast]);

  // Confirm return to processing - close modal first, then refetch and toast together
  const handleReturnConfirm = useCallback(async () => {
    if (saving) return; // Prevent double submit
    setSaving(true);
    try {
      const response = await apiClient.post(`/processings/${selectedItem.id}/return-to-processing`);
      
      if (response.success) {
        const recordId = selectedItem.id;
        // Close modal first
        setIsReturnModalOpen(false);
        toast.success('Returned to Processing', `Record #${String(recordId).padStart(4, '0')} has been returned to processing.`);
        // Refetch in background
        invalidateAndRefetch();
        return;
      } else {
        throw new Error(response.message || 'Failed to return to processing');
      }
    } catch (error) {
      console.error('Error returning to processing:', error);
      toast.error('Error', error.message || 'Failed to return to processing');
    } finally {
      setSaving(false);
    }
  }, [selectedItem, invalidateAndRefetch, toast, saving]);

  // Calculate husk and yield when output changes
  const handleCompleteFormChange = useCallback((e) => {
    const { name, value } = e.target;
    
    if (name === 'output_kg') {
      const outputKg = parseFloat(value) || 0;
      const inputKg = selectedItem?.input_kg || 0;
      const huskKg = Math.max(0, inputKg - outputKg);
      const yieldPercent = inputKg > 0 ? ((outputKg / inputKg) * 100).toFixed(2) : 0;
      
      setCompleteFormData({
        output_kg: value,
        husk_kg: huskKg,
        yield_percent: yieldPercent
      });
    }
  }, [selectedItem]);

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

  // Submit add form - close modal first, then refetch and toast together
  const handleAddSubmit = async () => {
    if (saving) return; // Prevent double submit
    
    // Validation
    if (selectedDryingIds.length === 0) {
      toast.error('Required', 'Please select at least one drying source.');
      throw new Error('No drying source selected');
    }
    if (!formData.processing_date) {
      toast.error('Required', 'Please select a processing date.');
      throw new Error('Processing date required');
    }
    // Validate input_kg doesn't exceed available kg from selected drying sources
    const selectedGroups = groupedDryingOptions.filter(opt => 
      opt.dryingIds.some(id => selectedDryingIds.includes(id))
    );
    const totalAvailableKg = selectedGroups.reduce((sum, opt) => sum + opt.remaining, 0);
    const inputKg = parseFloat(formData.input_kg) || 0;
    if (inputKg <= 0) {
      toast.error('Invalid', 'Input quantity must be greater than 0.');
      throw new Error('Input kg must be > 0');
    }
    if (inputKg > totalAvailableKg) {
      toast.error('Exceeds Available', `Input (${inputKg.toLocaleString()} kg) exceeds available stock (${totalAvailableKg.toLocaleString()} kg) from selected drying sources.`);
      throw new Error('Input kg exceeds available');
    }
    
    setSaving(true);
    try {
      setErrors({});
      
      // Send all drying sources in ONE request — backend creates ONE record
      const submitData = {
        drying_process_ids: selectedDryingIds,
        input_kg: parseFloat(formData.input_kg),
        operator_name: formData.operator_name || null,
        processing_date: formData.processing_date,
      };

      const response = await apiClient.post('/processings', submitData);
      
      if (response.success && response.data) {
        setIsAddModalOpen(false);
        toast.success('Processing Created', 'Processing record has been created.');
        // Refetch in background
        invalidateAndRefetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error creating processing:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        toast.error('Validation Error', 'Please fix the highlighted fields.');
        throw error;
      } else {
        toast.error('Error', error.message || 'Failed to create processing');
        throw error;
      }
    } finally {
      setSaving(false);
    }
  };

  // Submit edit form - close modal first, then refetch and toast together
  const handleEditSubmit = async () => {
    if (saving) return; // Prevent double submit
    setSaving(true);
    try {
      setErrors({});
      const submitData = {
        drying_process_id: formData.drying_process_id || null,
        input_kg: parseFloat(formData.input_kg),
        operator_name: formData.operator_name || null,
        processing_date: formData.processing_date || null,
      };

      const response = await apiClient.put(`/processings/${selectedItem.id}`, submitData);
      
      if (response.success && response.data) {
        // Close modal first
        setIsEditModalOpen(false);
        toast.success('Processing Updated', 'Processing record has been updated.');
        // Refetch in background
        invalidateAndRefetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error updating processing:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        toast.error('Validation Error', 'Please fix the highlighted fields.');
        throw error;
      } else {
        toast.error('Error', error.message || 'Failed to update processing');
        throw error;
      }
    } finally {
      setSaving(false);
    }
  };

  // Submit complete form - close modal first, then refetch and toast together
  const handleCompleteSubmit = async () => {
    if (saving) return; // Prevent double submit
    
    const outputKg = parseFloat(completeFormData.output_kg) || 0;
    const inputKg = parseFloat(selectedItem?.input_kg) || 0;
    
    if (outputKg <= 0) {
      toast.error('Invalid Output', 'Output quantity must be greater than 0.');
      return;
    }
    
    if (outputKg > inputKg) {
      toast.error('Exceeds Input', `Output quantity (${outputKg.toLocaleString()} kg) cannot exceed the input quantity (${inputKg.toLocaleString()} kg).`);
      return;
    }
    
    setSaving(true);
    try {
      const response = await apiClient.post(`/processings/${selectedItem.id}/complete`, {
        output_kg: outputKg
      });
      
      if (response.success && response.data) {
        const recordId = selectedItem.id;
        // Close modal first
        setIsCompleteModalOpen(false);
        toast.success('Processing Completed', `Record #${String(recordId).padStart(4, '0')} has been completed.`);
        // Refetch in background
        invalidateAndRefetch();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error completing processing:', error);
      toast.error('Error', error.message || 'Failed to complete processing');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // Delete handler - close modal first, then refetch and toast together
  const handleDeleteConfirm = useCallback(async () => {
    if (saving) return; // Prevent double submit
    setSaving(true);
    try {
      const response = await apiClient.delete(`/processings/${selectedItem.id}`);
      
      if (response.success) {
        const archivedId = selectedItem.id;
        // Close modal first
        setIsDeleteModalOpen(false);
        // Immediately remove from local data (optimistic update) for instant UI
        optimisticUpdateActive(prev => prev.filter(p => p.id !== archivedId));
        optimisticUpdateCompleted(prev => prev.filter(p => p.id !== archivedId));
        toast.success('Returned to Drying', 'Processing record has been returned to drying.');
        // Refetch in background to confirm
        invalidateAndRefetch();
        return;
      } else {
        throw new Error(response.message || 'Failed to return to drying');
      }
    } catch (error) {
      console.error('Error returning processing to drying:', error);
      toast.error('Error', 'Failed to return processing to drying');
    } finally {
      setSaving(false);
    }
  }, [selectedItem, invalidateAndRefetch, optimisticUpdateActive, optimisticUpdateCompleted, toast, saving]);

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

  const matchesChartPoint = useCallback((p) => {
    if (!activeChartPoint || !p.processing_date) return true;
    const date = new Date(p.processing_date);
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

  const isInChartScope = useCallback((p) => {
    if (!p.processing_date) return false;
    const date = new Date(p.processing_date);
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

  const chartFilteredProcessings = useMemo(() => {
    if (!chartScopeActive && !activeChartPoint) return allProcessings;
    const scoped = allProcessings.filter(isInChartScope);
    if (!activeChartPoint) return scoped;
    return scoped.filter(matchesChartPoint);
  }, [allProcessings, isInChartScope, activeChartPoint, matchesChartPoint, chartScopeActive]);

  const chartFilteredActive = useMemo(() => {
    if (!chartScopeActive && !activeChartPoint) return activeProcessings;
    const scoped = activeProcessings.filter(isInChartScope);
    if (!activeChartPoint) return scoped;
    return scoped.filter(matchesChartPoint);
  }, [activeProcessings, isInChartScope, activeChartPoint, matchesChartPoint, chartScopeActive]);

  const chartFilteredCompleted = useMemo(() => {
    if (!chartScopeActive && !activeChartPoint) return completedProcessings;
    const scoped = completedProcessings.filter(isInChartScope);
    if (!activeChartPoint) return scoped;
    return scoped.filter(matchesChartPoint);
  }, [completedProcessings, isInChartScope, activeChartPoint, matchesChartPoint, chartScopeActive]);

  // Memoized stats calculations — filtered by chart scope + active point
  const stats = useMemo(() => {
    const totalRecords = chartFilteredProcessings.length;
    const pendingCount = chartFilteredProcessings.filter(p => p.status === 'Pending').length;
    const processingCount = chartFilteredProcessings.filter(p => p.status === 'Processing').length;
    const completedCount = chartFilteredProcessings.filter(p => p.status === 'Completed').length;
    const completedItems = chartFilteredProcessings.filter(p => p.status === 'Completed');
    const totalInput = chartFilteredProcessings.reduce((sum, p) => sum + parseFloat(p.input_kg || 0), 0);
    const totalOutput = completedItems.reduce((sum, p) => sum + parseFloat(p.output_kg || 0), 0);
    const totalHusk = completedItems.reduce((sum, p) => sum + parseFloat(p.husk_kg || 0), 0);
    const avgYield = completedCount > 0 
      ? (completedItems.reduce((sum, p) => sum + parseFloat(p.yield_percent || 0), 0) / completedCount).toFixed(2)
      : 0;
    
    return { totalRecords, pendingCount, processingCount, completedCount, totalInput, totalOutput, totalHusk, avgYield };
  }, [chartFilteredProcessings]);

  // Helper function to get days in a month
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  // Chart data based on chartPeriod (daily, weekly, monthly, bi-annually, annually)
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (chartPeriod === 'daily') {
      const [y, m] = chartMonth.split('-').map(Number);
      const daysInMonth = getDaysInMonth(y, m - 1);
      const dayGroups = {};
      allProcessings.forEach(p => {
        if (!p.processing_date) return;
        const date = new Date(p.processing_date);
        if (date.getFullYear() === y && date.getMonth() === m - 1) {
          const day = date.getDate();
          if (!dayGroups[day]) dayGroups[day] = { input: 0, output: 0 };
          dayGroups[day].input += parseFloat(p.input_kg || 0);
          if (p.output_kg) dayGroups[day].output += parseFloat(p.output_kg);
        }
      });
      return Array.from({ length: daysInMonth }, (_, i) => ({
        name: String(i + 1),
        input: dayGroups[i + 1]?.input || 0,
        output: dayGroups[i + 1]?.output || 0,
      }));
    }
    
    if (chartPeriod === 'weekly') {
      const [y, m] = chartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      return weeks.map(week => {
        let input = 0, output = 0;
        allProcessings.forEach(p => {
          if (!p.processing_date) return;
          const date = new Date(p.processing_date);
          if (date >= week.start && date <= new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59)) {
            input += parseFloat(p.input_kg || 0);
            if (p.output_kg) output += parseFloat(p.output_kg);
          }
        });
        return { name: week.label, input, output };
      });
    }
    
    if (chartPeriod === 'monthly') {
      const monthGroups = {};
      allProcessings.forEach(p => {
        if (!p.processing_date) return;
        const date = new Date(p.processing_date);
        if (date.getFullYear() === chartYear) {
          const month = date.getMonth();
          if (!monthGroups[month]) monthGroups[month] = { input: 0, output: 0 };
          monthGroups[month].input += parseFloat(p.input_kg || 0);
          if (p.output_kg) monthGroups[month].output += parseFloat(p.output_kg);
        }
      });
      return months.map((name, i) => ({
        name,
        input: monthGroups[i]?.input || 0,
        output: monthGroups[i]?.output || 0,
      }));
    }
    
    if (chartPeriod === 'bi-annually') {
      const h1 = { input: 0, output: 0 };
      const h2 = { input: 0, output: 0 };
      allProcessings.forEach(p => {
        if (!p.processing_date) return;
        const date = new Date(p.processing_date);
        if (date.getFullYear() === chartYear) {
          const target = date.getMonth() < 6 ? h1 : h2;
          target.input += parseFloat(p.input_kg || 0);
          if (p.output_kg) target.output += parseFloat(p.output_kg);
        }
      });
      return [
        { name: 'H1', fullName: `Jan - Jun ${chartYear}`, input: h1.input, output: h1.output },
        { name: 'H2', fullName: `Jul - Dec ${chartYear}`, input: h2.input, output: h2.output },
      ];
    }
    
    // annually
    const years = [];
    for (let y = chartYearFrom; y <= chartYearTo; y++) years.push(y);
    const yearGroups = {};
    allProcessings.forEach(p => {
      if (!p.processing_date) return;
      const date = new Date(p.processing_date);
      const year = date.getFullYear();
      if (year >= chartYearFrom && year <= chartYearTo) {
        if (!yearGroups[year]) yearGroups[year] = { input: 0, output: 0 };
        yearGroups[year].input += parseFloat(p.input_kg || 0);
        if (p.output_kg) yearGroups[year].output += parseFloat(p.output_kg);
      }
    });
    return years.map(year => ({
      name: year.toString(),
      input: yearGroups[year]?.input || 0,
      output: yearGroups[year]?.output || 0,
    }));
  }, [allProcessings, chartPeriod, chartMonth, chartYear, chartYearFrom, chartYearTo, getWeeksInMonth]);

  // Average daily output
  const avgPerDay = useMemo(() => {
    const [y, m] = chartMonth.split('-').map(Number);
    const daysInMonth = getDaysInMonth(y, m - 1);
    
    const monthOutput = completedProcessings.filter(p => {
      if (!p.completed_date) return false;
      const date = new Date(p.completed_date);
      return date.getFullYear() === y && date.getMonth() === m - 1;
    }).reduce((sum, p) => sum + parseFloat(p.output_kg || 0), 0);
    
    return Math.floor(monthOutput / daysInMonth);
  }, [completedProcessings, chartMonth]);

  // Donut charts data - using stats object
  const outputBreakdown = useMemo(() => {
    if (stats.totalOutput === 0 && stats.totalHusk === 0) {
      return [
        { name: 'Milled Rice', value: 0, color: '#22c55e' },
        { name: 'Husk', value: 0, color: '#ef4444' },
      ];
    }
    return [
      { name: 'Milled Rice', value: Math.round(stats.totalOutput), color: '#22c55e' },
      { name: 'Husk', value: Math.round(stats.totalHusk), color: '#ef4444' },
    ];
  }, [stats.totalOutput, stats.totalHusk]);

  const statusBreakdown = useMemo(() => {
    return [
      { name: 'Pending', value: stats.pendingCount, color: '#eab308' },
      { name: 'Processing', value: stats.processingCount, color: '#3b82f6' },
      { name: 'Completed', value: stats.completedCount, color: '#22c55e' },
    ].filter(item => item.value > 0);
  }, [stats.pendingCount, stats.processingCount, stats.completedCount]);

  // Active records columns (Pending + Processing)
  const activeColumns = useMemo(() => [
    { 
      header: 'ID', 
      accessor: 'id',
      cell: (row) => <span className="font-mono text-sm text-gray-600 dark:text-gray-300">#{String(row.id).padStart(4, '0')}</span>
    },
    { 
      header: 'Drying Source', 
      accessor: 'drying_process_info',
      cell: (row) => {
        const sources = row.drying_sources;
        if (sources && sources.length > 0) {
          return (
            <div className="text-sm">
              {sources.length === 1 ? (
                <>
                  <span>{sources[0].variety_name || sources[0].supplier_name}</span>
                  {sources[0].batch_number && (
                    <span className="block text-xs text-indigo-600 dark:text-indigo-400 font-medium">{sources[0].batch_number}</span>
                  )}
                </>
              ) : (
                <>
                  <span className="font-medium">{sources.length} sources</span>
                  {sources.map((s, i) => (
                    <span key={i} className="block text-xs text-indigo-600 dark:text-indigo-400">
                      {s.variety_name || s.supplier_name}{s.batch_number ? ` (${s.batch_number})` : ''} — {s.quantity_kg_taken.toLocaleString()} kg
                    </span>
                  ))}
                </>
              )}
            </div>
          );
        }
        if (row.drying_process_info) return (
          <div className="text-sm">
            <span>Drying #{String(row.drying_process_id).padStart(4, '0')} - {row.drying_process_info.supplier_name}</span>
            {row.drying_process_info.batch_number && (
              <span className="block text-xs text-indigo-600 dark:text-indigo-400 font-medium">{row.drying_process_info.batch_number}</span>
            )}
          </div>
        );
        if (row.procurement_info) return (
          <span className="text-sm">Proc #{String(row.procurement_id).padStart(4, '0')} - {row.procurement_info.supplier_name}</span>
        );
        return <span className="text-gray-400 text-sm">Manual input</span>;
      }
    },
    { 
      header: 'Input (kg)', 
      accessor: 'input_kg',
      cell: (row) => <span className="font-semibold text-blue-600 dark:text-blue-400">{parseFloat(row.input_kg).toLocaleString()}</span>
    },
    { header: 'Operator', accessor: 'operator_name', cell: (row) => row.operator_name || '-' },
    { header: 'Status', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
    { header: 'Date', accessor: 'processing_date', cell: (row) => row.processing_date || '-' },
    { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
      <div className="flex items-center gap-1">
        {row.status === 'Pending' && (
          <button
            onClick={() => handleStartProcessing(row)}
            disabled={saving}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
            title="Start Processing"
          >
            <Play size={16} />
          </button>
        )}
        {row.status === 'Processing' && (
          <button
            onClick={() => handleOpenCompleteModal(row)}
            disabled={saving}
            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
            title="Complete Processing"
          >
            <CheckCircle size={16} />
          </button>
        )}
        {row.status === 'Pending' && (
          <button
            onClick={() => handleEdit(row)}
            disabled={saving}
            className="p-1.5 rounded-md hover:bg-button-50 dark:hover:bg-button-900/30 text-button-500 hover:text-button-700 dark:text-button-300 transition-colors disabled:opacity-50"
            title="Edit"
          >
            <Edit size={15} />
          </button>
        )}
        {row.status === 'Pending' && (
          <button
            onClick={() => handleDelete(row)}
            disabled={saving}
            className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors disabled:opacity-50"
            title="Return to Drying"
          >
            <Undo2 size={16} />
          </button>
        )}
      </div>
    )},
  ], [handleView, handleEdit, handleDelete, handleStartProcessing, handleOpenCompleteModal, saving]);

  // Completed records columns
  const completedColumns = useMemo(() => [
    { 
      header: 'ID', 
      accessor: 'id',
      cell: (row) => <span className="font-mono text-sm text-gray-600 dark:text-gray-300">#{String(row.id).padStart(4, '0')}</span>
    },
    { 
      header: 'Drying Source', 
      accessor: 'drying_process_info',
      cell: (row) => {
        const sources = row.drying_sources;
        if (sources && sources.length > 0) {
          return (
            <div className="text-sm">
              {sources.length === 1 ? (
                <>
                  <span>{sources[0].variety_name || sources[0].supplier_name}</span>
                  {sources[0].batch_number && (
                    <span className="block text-xs text-indigo-600 dark:text-indigo-400 font-medium">{sources[0].batch_number}</span>
                  )}
                </>
              ) : (
                <>
                  <span className="font-medium">{sources.length} sources</span>
                  {sources.map((s, i) => (
                    <span key={i} className="block text-xs text-indigo-600 dark:text-indigo-400">
                      {s.variety_name || s.supplier_name}{s.batch_number ? ` (${s.batch_number})` : ''} — {s.quantity_kg_taken.toLocaleString()} kg
                    </span>
                  ))}
                </>
              )}
            </div>
          );
        }
        if (row.drying_process_info) return (
          <div className="text-sm">
            <span>Drying #{String(row.drying_process_id).padStart(4, '0')} - {row.drying_process_info.supplier_name}</span>
            {row.drying_process_info.batch_number && (
              <span className="block text-xs text-indigo-600 dark:text-indigo-400 font-medium">{row.drying_process_info.batch_number}</span>
            )}
          </div>
        );
        if (row.procurement_info) return (
          <span className="text-sm">Proc #{String(row.procurement_id).padStart(4, '0')} - {row.procurement_info.supplier_name}</span>
        );
        return <span className="text-gray-400 text-sm">Manual input</span>;
      }
    },
    { 
      header: 'Input (kg)', 
      accessor: 'input_kg',
      cell: (row) => <span className="font-semibold text-blue-600 dark:text-blue-400">{parseFloat(row.input_kg).toLocaleString()}</span>
    },
    { 
      header: 'Output (kg)', 
      accessor: 'output_kg',
      cell: (row) => <span className="font-semibold text-green-600 dark:text-green-400">{parseFloat(row.output_kg).toLocaleString()}</span>
    },
    { 
      header: 'Stock Out (kg)', 
      accessor: 'stock_out',
      cell: (row) => <span className="font-semibold text-indigo-600 dark:text-indigo-400">{parseFloat(row.stock_out || 0).toLocaleString()}</span>
    },
    { 
      header: 'Husk (kg)', 
      accessor: 'husk_kg',
      cell: (row) => <span className="font-semibold text-orange-600 dark:text-orange-400">{parseFloat(row.husk_kg).toLocaleString()}</span>
    },
    { 
      header: 'Yield', 
      accessor: 'yield_percent',
      cell: (row) => <span className="font-semibold text-purple-600 dark:text-purple-400">{parseFloat(row.yield_percent).toFixed(1)}%</span>
    },
    { 
      header: 'Stock Status', 
      accessor: 'stock_status', 
      cell: (row) => <StatusBadge status={row.stock_status} />
    },
    { header: 'Completed', accessor: 'completed_date', cell: (row) => row.completed_date || '-' },
    { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
      <div className="flex items-center gap-1">
        {row.stock_status === 'Pending' && (
          <button
            onClick={() => handleReturnToProcessing(row)}
            disabled={saving}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors disabled:opacity-50"
            title="Return to Processing"
          >
            <RotateCcw size={16} />
          </button>
        )}
        <ActionButtons />
      </div>
    )},
  ], [handleView, handleReturnToProcessing, saving]);

  // View Detail Item component
  const ViewDetailItem = ({ icon: Icon, label, value, iconColor = 'text-primary-500', compact = false }) => (
    <div className={`flex items-start gap-2 ${compact ? 'p-2' : 'p-4'} bg-primary-50 dark:bg-gray-700/50 rounded-xl border-2 border-primary-200 dark:border-primary-700`}>
      <div className={`${compact ? 'p-1.5' : 'p-2'} rounded-lg bg-white dark:bg-gray-600 shadow-sm ${iconColor}`}>
        <Icon size={compact ? 14 : 18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate`}>{label}</p>
        <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-gray-800 dark:text-gray-100 mt-0.5 truncate`}>{value}</p>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader 
        title="Processing" 
        description="Track and manage rice processing operations" 
        icon={Settings2}
        action={isRefreshing ? (
          <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">Syncing...</span>
        ) : null}
      />

      {/* Stats Cards - Show data immediately, skeleton only on true first load */}
      {loading ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Input" value={stats.totalInput.toLocaleString()} unit="kg palay" icon={Package} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <StatsCard label="Total Output" value={stats.totalOutput.toLocaleString()} unit="kg rice" icon={CheckCircle} iconBgColor="bg-gradient-to-br from-green-400 to-green-600" />
          <StatsCard label="Average Yield" value={stats.avgYield} unit="%" icon={TrendingUp} iconBgColor="bg-gradient-to-br from-purple-400 to-purple-600" />
          <StatsCard label="Total Records" value={stats.totalRecords} unit="entries" icon={FileText} iconBgColor="bg-gradient-to-br from-button-500 to-button-700" />
        </div>
      )}

      {/* Charts - Show data immediately */}
      {loading ? (
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
              title="Processing Trends" 
              subtitle={(() => {
                const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                if (!chartScopeActive && !activeChartPoint) return 'Production performance overview';
                let scope = '';
                if (chartPeriod === 'daily' || chartPeriod === 'weekly') { const [y,m] = chartMonth.split('-').map(Number); scope = `${months[m-1]} ${y}`; }
                else if (chartPeriod === 'monthly' || chartPeriod === 'bi-annually') scope = String(chartYear);
                else if (chartPeriod === 'annually') scope = `${chartYearFrom}–${chartYearTo}`;
                const mode = chartPeriod.charAt(0).toUpperCase() + chartPeriod.slice(1);
                if (activeChartPoint) return `${activeChartPoint} · ${scope}`;
                return `${mode} · ${scope}`;
              })()} 
              data={chartData} 
              lines={[{ dataKey: 'input', name: 'Input (kg)', dashed: true }, { dataKey: 'output', name: 'Output (kg)' }]} 
              height={280} 
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
                { label: 'Total Output', value: `${stats.totalOutput.toLocaleString()} kg`, color: 'text-primary-600 dark:text-primary-400' }, 
                { label: 'Avg per Day', value: `${avgPerDay.toLocaleString()} kg`, color: 'text-primary-600 dark:text-primary-400' }, 
                { label: 'Yield', value: `${stats.avgYield}%`, color: 'text-green-600 dark:text-green-400' }
              ]} 
            />
          </div>
          <div className="space-y-4">
            <DonutChart 
              title="Output Breakdown" 
              data={outputBreakdown} 
              centerValue={`${stats.totalOutput.toLocaleString()} kg`} 
              centerLabel="Total Output" 
              height={175}
              innerRadius={56}
              outerRadius={78}
              showLegend={true}
              horizontalLegend={true}
            />
            <DonutChart 
              title="Status Distribution" 
              data={statusBreakdown} 
              centerValue={stats.totalRecords.toString()} 
              centerLabel="Total Records" 
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

      {/* Active Processing Records Table (Pending + Processing) - Show immediately */}
      {loading ? (
        <SkeletonTable className="mb-6" />
      ) : (
        <div className="mb-6">
          <DataTable 
            title="Processing Records"
            subtitle="Pending and active processing batches"
            columns={activeColumns} 
            data={chartFilteredActive} 
            searchPlaceholder="Search records..." 
            filterField="status" 
            filterPlaceholder="All Status"
            dateFilterField="processing_date"
            onAdd={handleAdd}
            addLabel="New Processing"
            onRowDoubleClick={handleView}
          />
        </div>
      )}

      {/* Completed Records Table - Show immediately */}
      {loading ? (
        <SkeletonTable />
      ) : (
        <DataTable 
          title="Completed Records"
          subtitle="Finished processing batches with results"
          columns={completedColumns} 
          data={chartFilteredCompleted} 
          searchPlaceholder="Search completed..." 
          dateFilterField="completed_date"
          onRowDoubleClick={handleView}
        />
      )}

      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Processing Details" size="2xl">
        {selectedItem && (
          <div className="space-y-3">
            {/* Header with Status - Compact */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary-50 dark:from-gray-700 to-primary-100 dark:to-gray-800 rounded-xl border border-primary-200 dark:border-primary-700">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Processing #{String(selectedItem.id).padStart(4, '0')}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedItem.drying_sources && selectedItem.drying_sources.length > 1
                    ? `From ${selectedItem.drying_sources.length} drying sources`
                    : selectedItem.drying_sources && selectedItem.drying_sources.length === 1
                      ? selectedItem.drying_sources[0].batch_number
                        ? `From ${selectedItem.drying_sources[0].batch_number} — ${selectedItem.drying_sources[0].variety_name || selectedItem.drying_sources[0].supplier_name}`
                        : `From ${selectedItem.drying_sources[0].variety_name || selectedItem.drying_sources[0].supplier_name}`
                    : selectedItem.drying_process_info 
                      ? selectedItem.drying_process_info.batch_number
                        ? `From ${selectedItem.drying_process_info.batch_number} (Drying #${String(selectedItem.drying_process_id).padStart(4, '0')})`
                        : `From Drying #${String(selectedItem.drying_process_id).padStart(4, '0')} - ${selectedItem.drying_process_info.supplier_name}`
                      : selectedItem.procurement_info
                        ? `Linked to Procurement #${String(selectedItem.procurement_id).padStart(4, '0')}`
                        : 'Manual input record'}
                </p>
              </div>
              <StatusBadge status={selectedItem.status} />
            </div>

            {/* Details Grid - More Compact */}
            <div className="grid grid-cols-3 gap-2">
              <ViewDetailItem icon={Hash} label="Record ID" value={`#${String(selectedItem.id).padStart(4, '0')}`} compact />
              <ViewDetailItem icon={Calendar} label="Processing Date" value={selectedItem.processing_date || 'Not set'} iconColor="text-blue-500" compact />
              <ViewDetailItem icon={Scale} label="Input (kg)" value={`${parseFloat(selectedItem.input_kg).toLocaleString()} kg`} iconColor="text-blue-500" compact />
              <ViewDetailItem icon={User} label="Operator" value={selectedItem.operator_name || 'Not assigned'} iconColor="text-purple-500" compact />

              {/* Multi-source drying info */}
              {selectedItem.drying_sources && selectedItem.drying_sources.length > 0 && (
                <div className="col-span-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1 flex items-center gap-1"><Layers className="w-3 h-3" /> Drying Sources ({selectedItem.drying_sources.length})</p>
                  {selectedItem.drying_sources.map((s, i) => (
                    <p key={i} className="text-xs text-gray-700 dark:text-gray-200">
                      {s.variety_name || s.supplier_name}
                      {s.batch_number && <span className="text-indigo-600 dark:text-indigo-400"> ({s.batch_number})</span>}
                      <span className="text-green-600 dark:text-green-400 font-medium"> — {s.quantity_kg_taken.toLocaleString()} kg</span>
                    </p>
                  ))}
                </div>
              )}
              
              {/* Legacy single source display */}
              {(!selectedItem.drying_sources || selectedItem.drying_sources.length === 0) && selectedItem.drying_process_info && (
                <>
                  <ViewDetailItem icon={Package} label="Supplier" value={selectedItem.drying_process_info.supplier_name} iconColor="text-orange-500" compact />
                  <ViewDetailItem icon={Layers} label="Drying Remaining" value={`${parseFloat(selectedItem.drying_process_info.remaining_kg).toLocaleString()} kg`} iconColor="text-gray-500 dark:text-gray-400" compact />
                </>
              )}
              {(!selectedItem.drying_sources || selectedItem.drying_sources.length === 0) && !selectedItem.drying_process_info && selectedItem.procurement_info && (
                <>
                  <ViewDetailItem icon={Package} label="Supplier" value={selectedItem.procurement_info.supplier_name} iconColor="text-orange-500" compact />
                  <ViewDetailItem icon={Layers} label="Sacks/Bags" value={`${parseInt(selectedItem.procurement_info.sacks || 0)} sacks (${parseFloat(selectedItem.procurement_info.quantity_kg).toLocaleString()} kg)`} iconColor="text-gray-500 dark:text-gray-400" compact />
                </>
              )}
              
              {selectedItem.status === 'Completed' && (
                <>
                  <ViewDetailItem icon={CheckCircle} label="Output (kg)" value={`${parseFloat(selectedItem.output_kg).toLocaleString()} kg`} iconColor="text-green-500" compact />
                  <ViewDetailItem icon={ArrowDown} label="Stock Out" value={`${parseFloat(selectedItem.stock_out || 0).toLocaleString()} kg`} iconColor="text-indigo-500" compact />
                  <ViewDetailItem icon={Package} label="Husk (kg)" value={`${parseFloat(selectedItem.husk_kg).toLocaleString()} kg`} iconColor="text-orange-500" compact />
                  <ViewDetailItem icon={Percent} label="Yield" value={`${parseFloat(selectedItem.yield_percent).toFixed(1)}%`} iconColor="text-purple-500" compact />
                  <ViewDetailItem icon={Activity} label="Stock Status" value={selectedItem.stock_status} iconColor="text-blue-500" compact />
                  <ViewDetailItem icon={Calendar} label="Completed" value={selectedItem.completed_date || '-'} iconColor="text-green-500" compact />
                </>
              )}
            </div>

            {/* Yield Summary for Completed - Compact */}
            {selectedItem.status === 'Completed' && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Processing Yield</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {parseFloat(selectedItem.yield_percent).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 flex gap-4 text-xs">
                  <span className="text-gray-600 dark:text-gray-300">Input: <strong>{parseFloat(selectedItem.input_kg).toLocaleString()} kg</strong></span>
                  <span className="text-gray-600 dark:text-gray-300">→ Rice: <strong className="text-green-600 dark:text-green-400">{parseFloat(selectedItem.output_kg).toLocaleString()} kg</strong></span>
                  <span className="text-gray-600 dark:text-gray-300">+ Husk: <strong className="text-orange-600 dark:text-orange-400">{parseFloat(selectedItem.husk_kg).toLocaleString()} kg</strong></span>
                </div>
              </div>
            )}

            {/* Action Buttons - Compact */}
            <div className="flex gap-3 pt-3 border-t-2 border-primary-200 dark:border-primary-700">
              {selectedItem.status === 'Pending' && (
                <Button variant="outline" onClick={() => { setIsViewModalOpen(false); handleEdit(selectedItem); }} className="flex-1">
                  Edit Record
                </Button>
              )}
              {selectedItem.status === 'Completed' && selectedItem.stock_status === 'Pending' && (
                <Button 
                  variant="outline" 
                  onClick={() => { setIsViewModalOpen(false); handleReturnToProcessing(selectedItem); }} 
                  className="flex-1"
                  disabled={saving}
                >
                  <RotateCcw size={16} className="mr-2" />
                  Return to Processing
                </Button>
              )}
              <Button onClick={() => setIsViewModalOpen(false)} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Complete Processing Modal */}
      <Modal isOpen={isCompleteModalOpen} onClose={() => setIsCompleteModalOpen(false)} title="Complete Processing" size="md">
        {selectedItem && (
          <div className="space-y-4">
            {/* Info Header */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Processing #{String(selectedItem.id).padStart(4, '0')}</strong>
                {selectedItem.drying_sources && selectedItem.drying_sources.length > 0 ? (
                  <span> — {selectedItem.drying_sources.map(s => s.variety_name || s.supplier_name).join(', ')}</span>
                ) : selectedItem.drying_process_info ? (
                  <span> - From Drying #{String(selectedItem.drying_process_id).padStart(4, '0')} ({selectedItem.drying_process_info.supplier_name})</span>
                ) : selectedItem.procurement_info && (
                  <span> - From {selectedItem.procurement_info.supplier_name}</span>
                )}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Input: <strong>{parseFloat(selectedItem.input_kg).toLocaleString()} kg</strong>
              </p>
            </div>

            {/* Output Input */}
            <FormInput 
              label="Output Quantity (kg)" 
              name="output_kg" 
              type="number" 
              value={completeFormData.output_kg} 
              onChange={handleCompleteFormChange} 
              required 
              placeholder="Enter milled rice output"
              hint={`Maximum: ${parseFloat(selectedItem.input_kg).toLocaleString()} kg (cannot exceed input)`}
              max={parseFloat(selectedItem.input_kg)}
            />
            {parseFloat(completeFormData.output_kg) > parseFloat(selectedItem.input_kg) && (
              <p className="text-xs text-red-500 -mt-2">Output cannot exceed input ({parseFloat(selectedItem.input_kg).toLocaleString()} kg)</p>
            )}

            {/* Auto-calculated fields */}
            {completeFormData.output_kg && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-700">
                  <p className="text-xs text-orange-600 dark:text-orange-400 uppercase font-medium">Husk (Auto-calculated)</p>
                  <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{completeFormData.husk_kg.toLocaleString()} kg</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
                  <p className="text-xs text-purple-600 dark:text-purple-400 uppercase font-medium">Yield (Auto-calculated)</p>
                  <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{completeFormData.yield_percent}%</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
              <Button variant="outline" onClick={() => setIsCompleteModalOpen(false)} className="flex-1" disabled={saving}>
                Cancel
              </Button>
              <Button 
                onClick={handleCompleteSubmit} 
                className="flex-1" 
                disabled={saving || !completeFormData.output_kg || parseFloat(completeFormData.output_kg) > parseFloat(selectedItem?.input_kg || 0) || parseFloat(completeFormData.output_kg) <= 0}
                loading={saving}
              >
                Complete Processing
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Modal */}
      <FormModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSubmit={handleAddSubmit} 
        title="Create Processing Record" 
        submitText="Create Record" 
        size="lg"
        loading={saving}
      >
        {({ submitted }) => {
          // Get selected option groups (each group may contain multiple drying IDs)
          const selectedGroups = groupedDryingOptions.filter(opt => 
            opt.dryingIds.some(id => selectedDryingIds.includes(id))
          );
          
          // Calculate total kg from all selected groups
          const totalAvailableKg = selectedGroups.reduce((sum, opt) => sum + opt.remaining, 0);
          
          // Filter out options where any of their dryingIds are already selected
          // Also filter by variety if at least one source is already selected
          const selectedVariety = selectedGroups.length > 0 ? selectedGroups[0].varietyName : null;
          const availableOptions = groupedDryingOptions.filter(opt => 
            !opt.dryingIds.some(id => selectedDryingIds.includes(id))
            && (!selectedVariety || opt.varietyName === selectedVariety)
          );
          
          return (
          <>
            {/* Drying Sources with Add button */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Drying Sources <span className="text-red-500">*</span>
              </label>
              
              {/* Dropdown + Add button */}
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <FormSelect
                    name="pending_drying"
                    value={pendingDryingId}
                    onChange={(e) => setPendingDryingId(e.target.value)}
                    options={availableOptions}
                    placeholder="Select dried source..."
                    className="!mb-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!pendingDryingId) return;
                    const opt = groupedDryingOptions.find(o => o.value === pendingDryingId);
                    if (!opt) return;
                    // Add ALL drying IDs from this option group
                    const newIds = [...selectedDryingIds, ...opt.dryingIds];
                    setSelectedDryingIds(newIds);
                    setPendingDryingId('');
                    // Auto-fill input_kg with total available from all selected groups
                    const allSelectedGroups = groupedDryingOptions.filter(g => 
                      g.dryingIds.some(id => newIds.includes(id))
                    );
                    const total = allSelectedGroups.reduce((sum, g) => sum + g.remaining, 0);
                    setFormData(prev => ({ ...prev, input_kg: String(Math.round(total * 100) / 100) }));
                  }}
                  disabled={!pendingDryingId}
                  className="px-5 py-3 border-2 border-green-600 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700 hover:border-green-700 disabled:bg-gray-300 disabled:border-gray-300 dark:border-gray-600 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                >
                  Add
                </button>
              </div>
              
              {/* Selected sources list — grouped by option */}
              {selectedGroups.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedGroups.map(opt => (
                    <div key={opt.value} className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{opt.varietyName}</span>
                        {opt.batchNumber && (
                          <span className="text-xs text-indigo-600 dark:text-indigo-400">({opt.batchNumber})</span>
                        )}
                        {opt.driedAt && !opt.batchNumber && (
                          <span className="text-xs text-gray-400">· Dried {opt.driedAt}</span>
                        )}
                        <span className="text-sm text-green-600 dark:text-green-400 font-semibold">— {opt.remaining.toLocaleString()} kg</span>
                        {opt.sourceCount > 1 && (
                          <span className="text-xs text-gray-400">({opt.sourceCount} sources)</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          // Remove ALL drying IDs from this option group
                          const newIds = selectedDryingIds.filter(id => !opt.dryingIds.includes(id));
                          setSelectedDryingIds(newIds);
                          // Recalculate total and update input_kg
                          const remainingGroups = groupedDryingOptions.filter(g => 
                            g.dryingIds.some(id => newIds.includes(id))
                          );
                          const total = remainingGroups.reduce((sum, g) => sum + g.remaining, 0);
                          setFormData(prev => ({ ...prev, input_kg: newIds.length > 0 ? String(Math.round(total * 100) / 100) : '' }));
                        }}
                        className="text-red-500 hover:text-red-700 dark:text-red-300 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {selectedGroups.length} source(s) — Total: <strong>{totalAvailableKg.toLocaleString()} kg</strong>
                  </p>
                </div>
              )}
              
              {submitted && selectedDryingIds.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Please add at least one drying source</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormInput 
                  label="Input Quantity (kg)" 
                  name="input_kg" 
                  type="number" 
                  value={formData.input_kg} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (val > totalAvailableKg && totalAvailableKg > 0) {
                      setFormData(prev => ({ ...prev, input_kg: String(Math.round(totalAvailableKg * 100) / 100) }));
                      return;
                    }
                    handleFormChange(e);
                  }}
                  required 
                  placeholder="0"
                  error={errors.input_kg || (formData.input_kg && parseFloat(formData.input_kg) > totalAvailableKg && totalAvailableKg > 0 ? `Max: ${totalAvailableKg.toLocaleString()} kg` : undefined)}
                  submitted={submitted}
                />
                {totalAvailableKg > 0 && (
                  <p className="text-[11px] text-gray-400 -mt-2 ml-1">Available: <strong>{totalAvailableKg.toLocaleString()} kg</strong> from selected sources</p>
                )}
              </div>
              <FormInput 
                label="Processing Date" 
                name="processing_date" 
                type="date" 
                value={formData.processing_date} 
                onChange={handleFormChange}
                required
                submitted={submitted}
              />
            </div>
            <FormInput 
              label="Operator Name" 
              name="operator_name" 
              value={formData.operator_name} 
              onChange={handleFormChange} 
              placeholder="e.g. Juan Dela Cruz"
              submitted={submitted}
            />
          </>
          );
        }}
      </FormModal>

      {/* Edit Modal */}
      <FormModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSubmit={handleEditSubmit} 
        title="Edit Processing Record" 
        submitText="Save Changes" 
        size="lg"
        loading={saving}
      >
        {({ submitted }) => {
          // Get selected drying source remaining kg for edit validation
          const editDryingOption = dryingOptions.find(o => String(o.value) === String(formData.drying_process_id));
          const editMaxKg = editDryingOption?.remaining || 0;
          
          return (
          <>
            <FormSelect 
              label="Drying Source" 
              name="drying_process_id" 
              value={formData.drying_process_id} 
              onChange={handleFormChange} 
              options={dryingOptions}
              placeholder="Select dried batch..."
              submitted={submitted}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormInput 
                  label="Input Quantity (kg)" 
                  name="input_kg" 
                  type="number" 
                  value={formData.input_kg} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (editMaxKg > 0 && val > editMaxKg) {
                      setFormData(prev => ({ ...prev, input_kg: String(Math.round(editMaxKg * 100) / 100) }));
                      return;
                    }
                    handleFormChange(e);
                  }}
                  required 
                  placeholder="0"
                  error={errors.input_kg || (editMaxKg > 0 && formData.input_kg && parseFloat(formData.input_kg) > editMaxKg ? `Max: ${editMaxKg.toLocaleString()} kg` : undefined)}
                  submitted={submitted}
                />
                {editMaxKg > 0 && (
                  <p className="text-[11px] text-gray-400 -mt-2 ml-1">Available: <strong>{editMaxKg.toLocaleString()} kg</strong></p>
                )}
              </div>
              <FormInput 
                label="Processing Date" 
                name="processing_date" 
                type="date" 
                value={formData.processing_date} 
                onChange={handleFormChange}
                submitted={submitted}
              />
            </div>
            <FormInput 
              label="Operator Name" 
              name="operator_name" 
              value={formData.operator_name} 
              onChange={handleFormChange} 
              placeholder="e.g. Juan Dela Cruz"
              submitted={submitted}
            />
          </>
          );
        }}
      </FormModal>

      {/* Return to Drying Confirmation Modal */}
      <ConfirmModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={handleDeleteConfirm} 
        title="Return to Drying" 
        message={`Are you sure you want to return Processing #${String(selectedItem?.id || 0).padStart(4, '0')} back to drying? The input quantity will be restored to the drying source.`} 
        confirmText="Return to Drying" 
        variant="warning" 
        icon={Undo2}
        loading={saving}
      />
      
      {/* Return to Processing Confirmation Modal */}
      <ConfirmModal 
        isOpen={isReturnModalOpen} 
        onClose={() => setIsReturnModalOpen(false)} 
        onConfirm={handleReturnConfirm} 
        title="Return to Processing" 
        message={`Are you sure you want to return Processing #${String(selectedItem?.id || 0).padStart(4, '0')} back to processing status? This will clear the output results.`} 
        confirmText="Return to Processing" 
        variant="warning" 
        icon={RotateCcw}
        loading={saving}
      />
    </div>
  );
};

export default Processing;
