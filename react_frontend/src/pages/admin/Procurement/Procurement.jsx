import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { ShoppingCart, Package, Truck, DollarSign, FileText, Archive, Scale, Boxes, Building2, User, Clock, CheckCircle, XCircle, AlertCircle, PlusCircle, Eye, Edit, Check, Layers, Sun, Calendar, List, Phone, Mail, MapPin, X } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatusBadge, StatsCard, LineChart, DonutChart, FormModal, ConfirmModal, FormInput, FormSelect, Modal, useToast, SkeletonStats, SkeletonTable } from '../../../components/ui';
import { apiClient } from '../../../api';
import { useDataFetch, invalidateCache } from '../../../hooks';
import { useAuth } from '../../../context/AuthContext';
import { put as dbPut, STORES as DB_STORES } from '../../../pwa/offlineDb';

const CACHE_KEY = '/procurements';
const SUPPLIERS_CACHE_KEY = '/suppliers';
const VARIETIES_CACHE_KEY = '/varieties';
const BATCHES_CACHE_KEY = '/procurement-batches';

// Supplier combobox component - DEFINED OUTSIDE to prevent re-creation on parent re-render
const SupplierCombobox = memo(({ value, newName, newContact, newPhone, newEmail, newAddress, onChange, onInputChange, onFieldChange, error, submitted, supplierOptions }) => {
  const hasValue = (value && value.toString().trim().length > 0) || (newName && newName.trim().length > 0);
  const showRequiredError = !hasValue && submitted && !error;
  const displayError = error || (showRequiredError ? 'Please select a supplier or add a new one' : '');
  
  return (
    <div className="mb-4">
      <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
        Supplier <span className="text-red-500">*</span>
      </label>
      
      {/* Dropdown for existing suppliers */}
      <div className="relative">
        <select
          name="supplier_id"
          value={value}
          onChange={onChange}
          className={`w-full px-4 py-3 text-sm border-2 rounded-xl transition-all appearance-none cursor-pointer shadow-sm pr-10 focus:outline-none focus:ring-4 ${
            displayError 
              ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20' 
              : hasValue && !newName
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20'
                : 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20'
          } ${submitted && showRequiredError ? 'animate-shake' : ''}`}
        >
          {supplierOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          {displayError && <AlertCircle size={16} className="text-red-500" />}
          {hasValue && !newName && !displayError && <Check size={16} className="text-green-500" />}
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* OR divider */}
      <div className="flex items-center gap-3 my-3">
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600"></div>
        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">or add new</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600"></div>
      </div>

      {/* Input for new supplier */}
      <div className="relative">
        <input
          type="text"
          name="new_supplier_name"
          value={newName}
          onChange={onInputChange}
          placeholder="Type new supplier name..."
          className={`w-full px-4 py-3 pl-10 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 ${
            newName 
              ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20' 
              : 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20'
          }`}
        />
        <PlusCircle size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${newName ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
        {newName && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Check size={18} className="text-green-500" />
          </div>
        )}
      </div>

      {/* Contact details fields — shown when adding new supplier */}
      {newName && (
        <div className="mt-2 space-y-2">
          <div className="relative">
            <input
              type="text"
              value={newContact || ''}
              onChange={(e) => onFieldChange('new_supplier_contact', e.target.value)}
              placeholder="Contact person name"
              className="w-full px-4 py-2.5 pl-10 text-sm border-2 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20"
            />
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="relative">
            <input
              type="text"
              value={newPhone || ''}
              onChange={(e) => onFieldChange('new_supplier_phone', e.target.value)}
              placeholder="Contact number (e.g. 09171234567)"
              className="w-full px-4 py-2.5 pl-10 text-sm border-2 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20"
            />
            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="relative">
            <input
              type="email"
              value={newEmail || ''}
              onChange={(e) => onFieldChange('new_supplier_email', e.target.value)}
              placeholder="Email address (optional)"
              className="w-full px-4 py-2.5 pl-10 text-sm border-2 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20"
            />
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="relative">
            <input
              type="text"
              value={newAddress || ''}
              onChange={(e) => onFieldChange('new_supplier_address', e.target.value)}
              placeholder="Address (optional)"
              className="w-full px-4 py-2.5 pl-10 text-sm border-2 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20"
            />
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 pl-1">Provide supplier contact details for your records.</p>
        </div>
      )}

      {/* Info message when new supplier name is entered */}
      {newName && (
        <div className="flex items-start gap-2 p-2 mt-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
          <AlertCircle size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-green-700 dark:text-green-300">
            A new supplier "<strong>{newName}</strong>" will be created and added to your suppliers list.
          </p>
        </div>
      )}

      {displayError && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{displayError}</p>
      )}
    </div>
  );
});

SupplierCombobox.displayName = 'SupplierCombobox';

const Procurement = () => {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [activeChartPoint, setActiveChartPoint] = useState(null);
  const [chartScopeActive, setChartScopeActive] = useState(false);
  // Chart calendar filter state
  const [chartMonth, setChartMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [chartYear, setChartYear] = useState(() => new Date().getFullYear());
  const [chartYearFrom, setChartYearFrom] = useState(() => new Date().getFullYear() - 4);
  const [chartYearTo, setChartYearTo] = useState(() => new Date().getFullYear());
  const [tableTab, setTableTab] = useState('records'); // 'records' | 'batches'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRemarksOnlyEdit, setIsRemarksOnlyEdit] = useState(false); // For dried procurements
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isNewSupplierConfirmOpen, setIsNewSupplierConfirmOpen] = useState(false);
  const [isStandaloneConfirmOpen, setIsStandaloneConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [batchFilter, setBatchFilter] = useState('');
  // Accumulator state for sacks and kg entries in Add modal
  const [sacksEntries, setSacksEntries] = useState([]);
  const [kgEntries, setKgEntries] = useState([]);
  const [sacksInput, setSacksInput] = useState('');
  const [kgInput, setKgInput] = useState('');
  const [editingSacksIdx, setEditingSacksIdx] = useState(null);
  const [editingKgIdx, setEditingKgIdx] = useState(null);
  const [editingSacksValue, setEditingSacksValue] = useState('');
  const [editingKgValue, setEditingKgValue] = useState('');
  const [formData, setFormData] = useState({ 
    supplier_id: '', 
    new_supplier_name: '',
    new_supplier_contact: '',
    new_supplier_phone: '',
    new_supplier_email: '',
    new_supplier_address: '',
    quantity_kg: '', 
    sacks: '', 
    price_per_kg: '', 
    description: '', 
    status: 'Pending',
    batch_id: '',
  });
  const [errors, setErrors] = useState({});
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [saving, setSaving] = useState(false);

  // Batch creation state
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [newBatchNotes, setNewBatchNotes] = useState('');
  const [creatingBatchLoading, setCreatingBatchLoading] = useState(false);

  // Send to Drying state
  const [isSendToDryingOpen, setIsSendToDryingOpen] = useState(false);
  const [dryingSacks, setDryingSacks] = useState('');
  const [dryingPrice, setDryingPrice] = useState('');
  const [dryingPreview, setDryingPreview] = useState(null);
  const [loadingDryingPreview, setLoadingDryingPreview] = useState(false);
  const [dryingErrors, setDryingErrors] = useState({});

  // Individual send to drying state
  const [isIndividualDryingOpen, setIsIndividualDryingOpen] = useState(false);
  const [individualDryingItem, setIndividualDryingItem] = useState(null);
  const [individualDryingPrice, setIndividualDryingPrice] = useState('');
  const [individualDryingSacks, setIndividualDryingSacks] = useState('');
  const [individualDryingErrors, setIndividualDryingErrors] = useState({});

  // Unified Send to Drying modal state (top-level button)
  const [isUnifiedDryingOpen, setIsUnifiedDryingOpen] = useState(false);
  const [unifiedDryingSource, setUnifiedDryingSource] = useState('standalone');
  const [unifiedDryingProcId, setUnifiedDryingProcId] = useState('');
  const [unifiedDryingPrice, setUnifiedDryingPrice] = useState('');
  const [unifiedDryingStandaloneSacks, setUnifiedDryingStandaloneSacks] = useState('');
  const [unifiedDryingErrors, setUnifiedDryingErrors] = useState({});
  const [unifiedDryingBatchId, setUnifiedDryingBatchId] = useState('');
  const [unifiedDryingSacks, setUnifiedDryingSacks] = useState('');
  const [unifiedDryingBatchPreview, setUnifiedDryingBatchPreview] = useState(null);
  const [loadingUnifiedBatchPreview, setLoadingUnifiedBatchPreview] = useState(false);
  const [unifiedDryingBatchErrors, setUnifiedDryingBatchErrors] = useState({});

  // Batch view state
  const [isBatchViewOpen, setIsBatchViewOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);

  // Super-fast data fetching with cache for procurements
  const { 
    data: procurements, 
    loading, 
    isRefreshing,
    refetch,
    optimisticUpdate,
  } = useDataFetch('/procurements', {
    cacheKey: CACHE_KEY,
    initialData: [],
  });

  // Fetch suppliers for dropdown
  const { 
    data: suppliers, 
    refetch: refetchSuppliers,
  } = useDataFetch('/suppliers', {
    cacheKey: SUPPLIERS_CACHE_KEY,
    initialData: [],
  });

  // Fetch varieties for dropdown
  const { data: varieties } = useDataFetch('/varieties', {
    cacheKey: VARIETIES_CACHE_KEY,
    initialData: [],
  });

  // Fetch procurement batches (for filter dropdown + add-to-batch in modal)
  const { data: batches, refetch: refetchBatches, optimisticUpdate: optimisticUpdateBatches } = useDataFetch('/procurement-batches', {
    cacheKey: BATCHES_CACHE_KEY,
    initialData: [],
  });

  // Convert suppliers to options for dropdown
  const supplierOptions = useMemo(() => {
    const options = suppliers.map(s => ({ value: String(s.id), label: s.name }));
    return [{ value: '', label: 'Select supplier or type new name...' }, ...options];
  }, [suppliers]);

  // Convert varieties to options for dropdown
  const varietyOptions = useMemo(() => {
    const options = varieties
      .filter(v => v.status === 'Active')
      .map(v => ({ value: String(v.id), label: v.name }));
    return [{ value: '', label: 'Select variety...' }, ...options];
  }, [varieties]);

  const statusOptions = useMemo(() => [
    { value: 'Pending', label: 'Pending' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' },
  ], []);

  // Batch options for filter bar and modal
  const batchOptions = useMemo(() => {
    const opts = batches.map(b => ({
      value: String(b.id),
      label: `${b.batch_number} — ${b.variety_name || '?'} (${b.remaining_sacks}/${b.total_sacks} sacks left)`,
    }));
    return [{ value: '', label: 'All Batches' }, { value: 'no-batch', label: 'No Batch (Standalone)' }, ...opts];
  }, [batches]);

  // Only Open batches for assigning new procurements - Closed/Completed not selectable
  const openBatchOptions = useMemo(() => {
    const opts = batches
      .filter(b => b.status === 'Open')
      .map(b => ({
        value: String(b.id),
        label: `${b.batch_number} — ${b.variety_name || '?'} (${b.remaining_sacks} sacks)`,
      }));
    return [{ value: '', label: 'None (standalone)' }, ...opts];
  }, [batches]);

  // Standalone procurement options for unified drying modal (only pending, no batch)
  const standaloneProcOptions = useMemo(() => {
    return procurements
      .filter(p => p.status === 'Pending' && !p.batch_id)
      .map(p => ({
        value: String(p.id),
        label: `#${String(p.id).padStart(4, '0')} - ${p.supplier_name}${p.variety_name ? ` — ${p.variety_name}` : ''} (${parseInt(p.sacks || 0)} sacks / ${parseFloat(p.quantity_kg).toLocaleString()} kg)`,
      }));
  }, [procurements]);

  // Open batch options for unified drying modal
  const dryingBatchOptions = useMemo(() => {
    const opts = batches
      .filter(b => b.status === 'Open' && b.remaining_sacks > 0)
      .map(b => ({
        value: String(b.id),
        label: `${b.batch_number} — ${b.variety_name || '?'} (${b.remaining_sacks} sacks remaining)`,
      }));
    return [{ value: '', label: 'Select batch...' }, ...opts];
  }, [batches]);

  // Helper: get the week ranges for a given month/year
  const getWeeksInMonth = useCallback((year, month) => {
    const weeks = [];
    const firstDay = new Date(year, month, 1);
    // Start from Monday of the week containing the 1st
    let start = new Date(firstDay);
    const dayOfWeek = start.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday
    start.setDate(start.getDate() + diff);
    
    while (start.getMonth() <= month || (start.getMonth() > month && start.getFullYear() < year) || weeks.length === 0) {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${months[start.getMonth()]} ${start.getDate()} - ${months[end.getMonth()]} ${end.getDate()}`;
      weeks.push({ start: new Date(start), end: new Date(end), label });
      start.setDate(start.getDate() + 7);
      // Stop if the week starts in the next month entirely
      if (start.getMonth() > month && start.getFullYear() === year) break;
      if (start.getFullYear() > year) break;
      if (weeks.length >= 6) break;
    }
    return weeks;
  }, []);

  // Helper: checks if a procurement matches the active chart point filter
  const matchesChartPoint = useCallback((p) => {
    if (!activeChartPoint || !p.created_at) return true;
    const date = new Date(p.created_at);
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

  // Helper: check if a procurement date falls within the current chart scope (period + calendar)
  const isInChartScope = useCallback((p) => {
    if (!p.created_at) return false;
    const date = new Date(p.created_at);
    
    if (chartPeriod === 'daily') {
      const [y, m] = chartMonth.split('-').map(Number);
      return date.getFullYear() === y && date.getMonth() === m - 1;
    }
    if (chartPeriod === 'weekly') {
      const [y, m] = chartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      if (weeks.length === 0) return false;
      return date >= weeks[0].start && date <= new Date(weeks[weeks.length -1].end.getFullYear(), weeks[weeks.length -1].end.getMonth(), weeks[weeks.length -1].end.getDate(), 23, 59, 59);
    }
    if (chartPeriod === 'monthly') {
      return date.getFullYear() === chartYear;
    }
    if (chartPeriod === 'bi-annually') {
      return date.getFullYear() === chartYear;
    }
    if (chartPeriod === 'annually') {
      return date.getFullYear() >= chartYearFrom && date.getFullYear() <= chartYearTo;
    }
    return true;
  }, [chartPeriod, chartMonth, chartYear, chartYearFrom, chartYearTo, getWeeksInMonth]);

  // Chart-filtered procurements — used for stats, cards, table (scoped by calendar + dot)
  const chartFilteredProcurements = useMemo(() => {
    if (!chartScopeActive && !activeChartPoint) return procurements;
    const scoped = procurements.filter(isInChartScope);
    if (!activeChartPoint) return scoped;
    return scoped.filter(matchesChartPoint);
  }, [procurements, isInChartScope, activeChartPoint, matchesChartPoint, chartScopeActive]);

  // Chart-filtered batches — used for batches tab
  const chartFilteredBatches = useMemo(() => {
    if (!chartScopeActive && !activeChartPoint) return batches;
    const scopedBatches = batches.filter(b => {
      if (!b.created_at) return false;
      return isInChartScope(b);
    });
    if (!activeChartPoint) return scopedBatches;
    return scopedBatches.filter(matchesChartPoint);
  }, [batches, activeChartPoint, matchesChartPoint, chartScopeActive, isInChartScope]);

  // Apply batch filter to procurement list
  const filteredProcurements = useMemo(() => {
    let list = [...chartFilteredProcurements];
    
    // Apply batch filter
    if (batchFilter === 'no-batch') {
      list = list.filter(p => !p.batch_id);
    } else if (batchFilter) {
      list = list.filter(p => String(p.batch_id) === batchFilter);
    }
    
    // Simple sort: Pending at top, Drying next, Dried at bottom, Cancelled/Completed last
    const statusPriority = { Pending: 0, Drying: 1, Dried: 2, Completed: 3, Cancelled: 4 };
    
    list.sort((a, b) => {
      // First by status priority
      const statusA = statusPriority[a.status] ?? 99;
      const statusB = statusPriority[b.status] ?? 99;
      if (statusA !== statusB) return statusA - statusB;
      
      // Then by date descending
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    
    return list;
  }, [chartFilteredProcurements, batchFilter]);

  // Calculate total cost dynamically
  const calculatedTotal = useMemo(() => {
    const qty = parseFloat(formData.quantity_kg) || 0;
    const price = parseFloat(formData.price_per_kg) || 0;
    return qty * price;
  }, [formData.quantity_kg, formData.price_per_kg]);

  // Sync accumulator totals into formData whenever entries change
  useEffect(() => {
    const totalSacks = sacksEntries.reduce((sum, v) => sum + v, 0);
    const totalKg = kgEntries.reduce((sum, v) => sum + v, 0);
    setFormData(prev => ({
      ...prev,
      sacks: totalSacks > 0 ? String(totalSacks) : '',
      quantity_kg: totalKg > 0 ? String(totalKg) : '',
    }));
  }, [sacksEntries, kgEntries]);

  // Accumulator handlers for sacks
  const handleAddSacks = useCallback(() => {
    const val = parseInt(sacksInput);
    if (!val || val <= 0) return;
    setSacksEntries(prev => [...prev, val]);
    setSacksInput('');
  }, [sacksInput]);

  const handleRemoveSacks = useCallback((idx) => {
    setSacksEntries(prev => prev.filter((_, i) => i !== idx));
    if (editingSacksIdx === idx) setEditingSacksIdx(null);
  }, [editingSacksIdx]);

  const handleStartEditSacks = useCallback((idx) => {
    setEditingSacksIdx(idx);
    setEditingSacksValue(String(sacksEntries[idx]));
  }, [sacksEntries]);

  const handleConfirmEditSacks = useCallback(() => {
    const val = parseInt(editingSacksValue);
    if (!val || val <= 0) { setEditingSacksIdx(null); return; }
    setSacksEntries(prev => prev.map((v, i) => i === editingSacksIdx ? val : v));
    setEditingSacksIdx(null);
  }, [editingSacksValue, editingSacksIdx]);

  // Accumulator handlers for kg
  const handleAddKg = useCallback(() => {
    const val = parseFloat(kgInput);
    if (!val || val <= 0) return;
    setKgEntries(prev => [...prev, val]);
    setKgInput('');
  }, [kgInput]);

  const handleRemoveKg = useCallback((idx) => {
    setKgEntries(prev => prev.filter((_, i) => i !== idx));
    if (editingKgIdx === idx) setEditingKgIdx(null);
  }, [editingKgIdx]);

  const handleStartEditKg = useCallback((idx) => {
    setEditingKgIdx(idx);
    setEditingKgValue(String(kgEntries[idx]));
  }, [kgEntries]);

  const handleConfirmEditKg = useCallback(() => {
    const val = parseFloat(editingKgValue);
    if (!val || val <= 0) { setEditingKgIdx(null); return; }
    setKgEntries(prev => prev.map((v, i) => i === editingKgIdx ? val : v));
    setEditingKgIdx(null);
  }, [editingKgValue, editingKgIdx]);

  const handleAdd = useCallback(() => {
    setFormData({ 
      supplier_id: '', 
      new_supplier_name: '',
      new_supplier_contact: '',
      new_supplier_phone: '',
      new_supplier_email: '',
      new_supplier_address: '',
      variety_id: '',
      quantity_kg: '', 
      sacks: '', 
      price_per_kg: '', 
      description: '', 
      status: 'Pending',
      batch_id: '',
    });
    setErrors({});
    setIsCreatingBatch(false);
    setNewBatchNotes('');
    setSacksEntries([]);
    setKgEntries([]);
    setSacksInput('');
    setKgInput('');
    setEditingSacksIdx(null);
    setEditingKgIdx(null);
    refetchBatches();
    setIsAddModalOpen(true);
  }, [refetchBatches]);

  const handleView = useCallback((item) => {
    setSelectedItem(item);
    setIsViewModalOpen(true);
  }, []);

  const handleEdit = useCallback((item, remarksOnly = false) => {
    setSelectedItem(item);
    setIsRemarksOnlyEdit(remarksOnly);
    setFormData({ 
      supplier_id: String(item.supplier_id), 
      new_supplier_name: '',
      new_supplier_contact: '',
      new_supplier_phone: '',
      new_supplier_email: '',
      new_supplier_address: '',
      variety_id: String(item.variety_id || ''),
      quantity_kg: String(item.quantity_kg), 
      sacks: String(item.sacks || 0), 
      price_per_kg: String(item.price_per_kg), 
      description: item.description || '',
      status: item.status || 'Pending',
      batch_id: String(item.batch_id || ''),
    });
    setErrors({});
    refetchBatches();
    setIsEditModalOpen(true);
  }, [refetchBatches]);

  const handleCancel = useCallback(async (item) => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiClient.put(`/procurements/${item.id}`, {
        ...item,
        status: 'Cancelled'
      });
      
      if (response.success) {
        // Immediately update status in local data for instant UI
        optimisticUpdate(prev => prev.map(p => p.id === item.id ? { ...p, status: 'Cancelled' } : p));
        toast.success('Procurement Cancelled', 'Procurement status changed to Cancelled.');
        // Refetch in background (include batches so sack counts update)
        invalidateCache(CACHE_KEY);
        invalidateCache(BATCHES_CACHE_KEY);
        refetch();
        refetchBatches();
      }
    } catch (error) {
      console.error('Error cancelling procurement:', error);
      toast.error('Error', error.response?.data?.message || 'Failed to cancel procurement');
    } finally {
      setSaving(false);
    }
  }, [saving, refetch, refetchBatches, optimisticUpdate, toast]);

  const handleDelete = useCallback((item) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  }, []);

  // ---- Batch handlers ----
  const handleBatchView = useCallback((batch) => {
    setSelectedBatch(batch);
    setIsBatchViewOpen(true);
  }, []);

  const handleToggleBatchStatus = useCallback(async (batch, e) => {
    if (e) e.stopPropagation();
    if (saving) return;
    const newStatus = batch.status === 'Open' ? 'Closed' : 'Open';
    setSaving(true);
    try {
      const response = await apiClient.put(`/procurement-batches/${batch.id}`, {
        status: newStatus,
      });
      if (response.success) {
        toast.success('Status Updated', `Batch ${batch.batch_number} is now ${newStatus}.`);
        // Refetch in background
        invalidateCache(BATCHES_CACHE_KEY);
        refetchBatches();
      }
    } catch (error) {
      console.error('Error toggling batch status:', error);
      toast.error('Error', error.message || 'Failed to update batch status.');
    } finally {
      setSaving(false);
    }
  }, [saving, refetchBatches, toast]);

  // Check if supplier name matches existing supplier
  const findMatchingSupplier = useCallback((name) => {
    if (!name) return null;
    return suppliers.find(s => s.name.toLowerCase() === name.toLowerCase());
  }, [suppliers]);

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // If typing in new_supplier_name, check for existing match
      if (name === 'new_supplier_name' && value) {
        const match = findMatchingSupplier(value);
        if (match) {
          // Auto-select existing supplier and clear new supplier fields
          return { ...newData, supplier_id: String(match.id), new_supplier_name: '', new_supplier_contact: '', new_supplier_phone: '', new_supplier_email: '', new_supplier_address: '' };
        }
        // Clear supplier_id if typing a new name
        newData.supplier_id = '';
      }
      
      // If selecting from dropdown, clear new supplier fields
      if (name === 'supplier_id' && value) {
        newData.new_supplier_name = '';
        newData.new_supplier_contact = '';
        newData.new_supplier_phone = '';
        newData.new_supplier_email = '';
        newData.new_supplier_address = '';
      }

      // Auto-set variety when batch is selected + auto-fill price from existing batch procurements
      if (name === 'batch_id' && value) {
        const selectedBatch = batches.find(b => String(b.id) === value);
        if (selectedBatch) {
          newData.variety_id = String(selectedBatch.variety_id);
          // Auto-fill price from existing procurements in this batch
          const batchProcurements = procurements.filter(p => String(p.batch_id) === value);
          if (batchProcurements.length > 0) {
            // Get the most recent procurement's price
            const latestPrice = batchProcurements[0]?.price_per_kg;
            if (latestPrice && !prev.price_per_kg) {
              newData.price_per_kg = String(latestPrice);
            }
          }
        }
      }
      
      // Clear batch if variety changes and doesn't match current batch
      if (name === 'variety_id' && prev.batch_id) {
        const currentBatch = batches.find(b => String(b.id) === prev.batch_id);
        if (currentBatch && String(currentBatch.variety_id) !== value) {
          newData.batch_id = '';
        }
      }
      
      return newData;
    });
    
    // Clear error for this field when user types
    setErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });
  }, [findMatchingSupplier, batches, procurements]);

  // Handle supplier input to allow both dropdown and typing
  const handleSupplierInput = useCallback((e) => {
    const value = e.target.value;
    handleFormChange({ target: { name: 'new_supplier_name', value } });
  }, [handleFormChange]);

  // Handle new supplier detail fields (contact, phone, email, address)
  const handleSupplierFieldChange = useCallback((fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  }, []);

  // Actual submission after confirmation (if needed) - close modal first, then refetch and toast together
  const performSubmit = async (isEdit = false) => {
    if (saving) return; // Prevent double submit
    setSaving(true);
    try {
      setErrors({});
      const submitData = {
        supplier_id: formData.supplier_id || null,
        new_supplier_name: formData.new_supplier_name || null,
        new_supplier_contact: formData.new_supplier_contact || null,
        new_supplier_phone: formData.new_supplier_phone || null,
        new_supplier_email: formData.new_supplier_email || null,
        new_supplier_address: formData.new_supplier_address || null,
        variety_id: formData.variety_id ? parseInt(formData.variety_id) : null,
        quantity_kg: parseFloat(formData.quantity_kg),
        sacks: parseInt(formData.sacks) || 0,
        price_per_kg: parseFloat(formData.price_per_kg),
        description: formData.description,
        status: formData.status,
        // Preserve temp IDs (offline-created batches) as strings so the sync
        // engine can replace them once back online. Only parseInt real numeric IDs.
        batch_id: formData.batch_id
          ? (String(formData.batch_id).startsWith('temp_')
              ? formData.batch_id          // keep as temp string for sync engine
              : parseInt(formData.batch_id))
          : null,
      };

      let response;
      if (isEdit) {
        response = await apiClient.put(`/procurements/${selectedItem.id}`, submitData);
      } else {
        response = await apiClient.post('/procurements', submitData);
      }
      
      if (response.success && response.data) {
        const message = isEdit ? 'Procurement Updated' : 'Procurement Added';
        const desc = isEdit ? 'Procurement record has been updated.' : 
          formData.new_supplier_name 
            ? `Procurement added and new supplier "${formData.new_supplier_name}" created.`
            : 'Procurement record has been added.';
        
        // Fire-and-forget: send email notification (non-blocking)
        if (!isEdit && response.data?.id) {
          apiClient.post(`/procurements/${response.data.id}/store-email`).catch(() => {});
        }

        // Optimistic update — instantly show the new/updated row
        if (isEdit) {
          optimisticUpdate(prev => prev.map(p => p.id === selectedItem.id ? { ...p, ...response.data } : p));
        } else {
          optimisticUpdate(prev => [response.data, ...prev]);
        }

        // Close modal first
        isEdit ? setIsEditModalOpen(false) : setIsAddModalOpen(false);
        
        // Refetch and toast together
        toast.success(message, desc);
        // Refetch in background
        invalidateCache(CACHE_KEY);
        invalidateCache(SUPPLIERS_CACHE_KEY);
        invalidateCache(BATCHES_CACHE_KEY);
        refetch();
        refetchSuppliers();
        refetchBatches();
        return;
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error saving procurement:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        setErrors(backendErrors);
        const fieldNames = Object.keys(backendErrors).map(f => f.replace(/^new_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ');
        toast.error('Validation Error', `Please fix the following: ${fieldNames}`);
        throw error;
      } else {
        toast.error('Error', error.response?.data?.message || error.message || 'Failed to save procurement');
        throw error;
      }
    } finally {
      setSaving(false);
    }
  };

  // Handle add submission - check if standalone or new supplier needs confirmation
  const handleAddSubmit = async () => {
    // If no batch selected, confirm standalone first
    if (!formData.batch_id) {
      setPendingSubmit('add');
      setIsStandaloneConfirmOpen(true);
      throw new Error('PENDING_CONFIRMATION');
    }

    // If there's a new supplier name, show confirmation first
    if (formData.new_supplier_name && !formData.supplier_id) {
      setPendingSubmit('add');
      setIsNewSupplierConfirmOpen(true);
      throw new Error('PENDING_CONFIRMATION');
    }
    
    await performSubmit(false);
  };

  // Handle edit submission
  const handleEditSubmit = async () => {
    await performSubmit(true);
  };

  // Handle new supplier confirmation
  const handleNewSupplierConfirm = async () => {
    setIsNewSupplierConfirmOpen(false);
    try {
      if (pendingSubmit === 'add') {
        await performSubmit(false);
        setIsAddModalOpen(false);
      }
    } catch (error) {
      // Errors already handled in performSubmit
    }
    setPendingSubmit(null);
  };

  const handleNewSupplierCancel = () => {
    setIsNewSupplierConfirmOpen(false);
    setPendingSubmit(null);
    // Focus back on supplier input
    if (supplierInputRef.current) {
      supplierInputRef.current.focus();
    }
  };

  // Handle standalone confirmation
  const handleStandaloneConfirm = async () => {
    setIsStandaloneConfirmOpen(false);
    try {
      // Still check for new supplier confirmation after standalone is confirmed
      if (formData.new_supplier_name && !formData.supplier_id) {
        setPendingSubmit('add');
        setIsNewSupplierConfirmOpen(true);
        return;
      }
      await performSubmit(false);
      setIsAddModalOpen(false);
    } catch (error) {
      // Errors already handled in performSubmit
    }
    setPendingSubmit(null);
  };

  const handleStandaloneCancel = () => {
    setIsStandaloneConfirmOpen(false);
    setPendingSubmit(null);
  };

  // ---- Send to Drying from Batch ----
  const handleOpenSendToDrying = useCallback(() => {
    setDryingSacks('');
    setDryingPrice('');
    setDryingPreview(null);
    setDryingErrors({});
    setIsSendToDryingOpen(true);
  }, []);

  // ---- Send Individual to Drying ----
  const handleOpenIndividualDrying = useCallback((item) => {
    const remaining = Math.max(0, parseInt(item.sacks || 0) - (item.drying_sacks || 0));
    setIndividualDryingItem(item);
    setIndividualDryingPrice('');
    setIndividualDryingSacks(String(remaining));
    setIndividualDryingErrors({});
    setIsIndividualDryingOpen(true);
  }, []);

  const handleIndividualDryingSubmit = async () => {
    if (saving) return;
    // Block if there are existing real-time errors
    if (individualDryingErrors.sacks?.length) return;
    
    const localErrors = {};
    const sacks = parseInt(individualDryingSacks);
    const remaining = Math.max(0, parseInt(individualDryingItem?.sacks || 0) - (individualDryingItem?.drying_sacks || 0));
    if (!individualDryingSacks || sacks <= 0) localErrors.sacks = ['Enter number of sacks.'];
    else if (sacks > remaining) localErrors.sacks = [`Only ${remaining} sacks remaining.`];
    if (!individualDryingPrice) localErrors.price = ['Price is required.'];
    if (Object.keys(localErrors).length) { setIndividualDryingErrors(localErrors); return; }

    setSaving(true);
    try {
      const response = await apiClient.post('/drying-processes', {
        procurement_id: individualDryingItem.id,
        sacks: sacks,
        price: parseFloat(individualDryingPrice),
      });
      if (response.success && response.data) {
        setIsIndividualDryingOpen(false);
        toast.success('Sent to Drying', `${sacks} sacks from Procurement #${String(individualDryingItem.id).padStart(4, '0')} sent to drying.`);
        // Optimistic: update procurement status instantly
        optimisticUpdate(prev => prev.map(p => p.id === individualDryingItem.id ? { ...p, status: 'Sent to Drying' } : p));
        // Refetch in background
        invalidateCache(CACHE_KEY);
        invalidateCache('/drying-processes');
        invalidateCache(BATCHES_CACHE_KEY);
        refetch();
        refetchBatches();
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error sending to drying:', error);
      if (error.response?.data?.errors || error.errors) {
        setIndividualDryingErrors(error.response?.data?.errors || error.errors);
      } else {
        toast.error('Error', error.message || 'Failed to send to drying.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Auto-fetch distribution preview when sacks is entered
  useEffect(() => {
    if (!isSendToDryingOpen || !batchFilter || !dryingSacks) return;
    const sacks = parseInt(dryingSacks);
    if (!sacks || sacks <= 0) { setDryingPreview(null); return; }
    let cancelled = false;
    setLoadingDryingPreview(true);
    apiClient.get(`/procurement-batches/${batchFilter}/drying-distribution?sacks=${sacks}`)
      .then(res => { if (!cancelled && res.success) setDryingPreview(res.data); })
      .catch(() => { if (!cancelled) setDryingPreview(null); })
      .finally(() => { if (!cancelled) setLoadingDryingPreview(false); });
    return () => { cancelled = true; };
  }, [batchFilter, dryingSacks, isSendToDryingOpen]);

  const handleSendToDryingSubmit = async () => {
    if (saving) return;
    const localErrors = {};
    if (!dryingSacks || parseInt(dryingSacks) <= 0) localErrors.sacks = ['Enter number of sacks to dry.'];
    if (!dryingPrice) localErrors.price = ['Price is required.'];
    if (Object.keys(localErrors).length) { setDryingErrors(localErrors); return; }

    setSaving(true);
    try {
      const response = await apiClient.post('/drying-processes', {
        batch_id: parseInt(batchFilter),
        sacks: parseInt(dryingSacks),
        price: parseFloat(dryingPrice),
      });
      if (response.success && response.data) {
        setIsSendToDryingOpen(false);
        toast.success('Sent to Drying', `${dryingSacks} sacks have been sent to drying.`);
        // Optimistic: mark affected procurements as sent
        const affectedIds = dryingPreview?.distribution?.map(d => d.procurement_id) || [];
        if (affectedIds.length) {
          optimisticUpdate(prev => prev.map(p => affectedIds.includes(p.id) ? { ...p, status: 'Sent to Drying' } : p));
        }
        // Refetch in background
        invalidateCache(CACHE_KEY);
        invalidateCache(BATCHES_CACHE_KEY);
        invalidateCache('/drying-processes');
        refetch();
        refetchBatches();
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error sending to drying:', error);
      if (error.response?.data?.errors || error.errors) {
        setDryingErrors(error.response?.data?.errors || error.errors);
        toast.error('Validation Error', 'Please fix the highlighted fields.');
      } else {
        toast.error('Error', error.message || 'Failed to send to drying.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ---- Unified Send to Drying Modal ----
  const handleOpenUnifiedDrying = useCallback(() => {
    setUnifiedDryingProcId('');
    setUnifiedDryingPrice('');
    setUnifiedDryingStandaloneSacks('');
    setUnifiedDryingErrors({});
    setUnifiedDryingBatchPreview(null);
    setUnifiedDryingBatchErrors({});

    // If a batch filter is active, auto-select batch mode with that batch
    if (batchFilter) {
      const b = batches.find(b => String(b.id) === batchFilter);
      setUnifiedDryingSource('batch');
      setUnifiedDryingBatchId(batchFilter);
      setUnifiedDryingSacks(b ? String(b.remaining_sacks) : '');
    } else {
      setUnifiedDryingSource('standalone');
      setUnifiedDryingBatchId('');
      setUnifiedDryingSacks('');
    }

    setIsUnifiedDryingOpen(true);
  }, [batchFilter, batches]);

  // Auto-fill sacks/kg when standalone procurement is selected
  const selectedUnifiedProc = useMemo(() => {
    if (!unifiedDryingProcId) return null;
    return procurements.find(p => String(p.id) === unifiedDryingProcId);
  }, [unifiedDryingProcId, procurements]);

  // Batch preview for unified drying modal
  useEffect(() => {
    if (!isUnifiedDryingOpen || unifiedDryingSource !== 'batch' || !unifiedDryingBatchId || !unifiedDryingSacks) return;
    const sacks = parseInt(unifiedDryingSacks);
    if (!sacks || sacks <= 0) { setUnifiedDryingBatchPreview(null); return; }
    let cancelled = false;
    setLoadingUnifiedBatchPreview(true);
    apiClient.get(`/procurement-batches/${unifiedDryingBatchId}/drying-distribution?sacks=${sacks}`)
      .then(res => { if (!cancelled && res.success) setUnifiedDryingBatchPreview(res.data); })
      .catch(() => { if (!cancelled) setUnifiedDryingBatchPreview(null); })
      .finally(() => { if (!cancelled) setLoadingUnifiedBatchPreview(false); });
    return () => { cancelled = true; };
  }, [unifiedDryingBatchId, unifiedDryingSacks, isUnifiedDryingOpen, unifiedDryingSource]);

  const handleUnifiedDryingSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let submitData;
      if (unifiedDryingSource === 'batch') {
        const localErrors = {};
        if (!unifiedDryingBatchId) localErrors.batch_id = ['Please select a batch.'];
        if (!unifiedDryingSacks || parseInt(unifiedDryingSacks) <= 0) localErrors.sacks = ['Enter number of sacks to dry.'];
        else {
          const selBatch = batches.find(b => String(b.id) === unifiedDryingBatchId);
          if (selBatch && parseInt(unifiedDryingSacks) > selBatch.remaining_sacks) {
            localErrors.sacks = [`Cannot exceed ${selBatch.remaining_sacks} available sacks.`];
          }
        }
        if (!unifiedDryingPrice) localErrors.price = ['Price is required.'];
        if (Object.keys(localErrors).length) { setUnifiedDryingBatchErrors(localErrors); setSaving(false); return; }
        submitData = {
          batch_id: parseInt(unifiedDryingBatchId),
          sacks: parseInt(unifiedDryingSacks),
          price: parseFloat(unifiedDryingPrice),
        };
      } else {
        const localErrors = {};
        if (!unifiedDryingProcId) localErrors.procurement_id = ['Please select a procurement.'];
        const proc = procurements.find(p => String(p.id) === unifiedDryingProcId);
        const alreadyDrying = proc?.drying_sacks || 0;
        const remaining = Math.max(0, parseInt(proc?.sacks || 0) - alreadyDrying);
        if (!unifiedDryingStandaloneSacks || parseInt(unifiedDryingStandaloneSacks) <= 0) localErrors.sacks = ['Enter number of sacks.'];
        else if (parseInt(unifiedDryingStandaloneSacks) > remaining) localErrors.sacks = [`Only ${remaining} sacks remaining.`];
        if (!unifiedDryingPrice) localErrors.price = ['Price is required.'];
        if (Object.keys(localErrors).length) { setUnifiedDryingErrors(localErrors); setSaving(false); return; }
        submitData = {
          procurement_id: parseInt(unifiedDryingProcId),
          sacks: parseInt(unifiedDryingStandaloneSacks),
          price: parseFloat(unifiedDryingPrice),
        };
      }

      const response = await apiClient.post('/drying-processes', submitData);
      if (response.success && response.data) {
        setIsUnifiedDryingOpen(false);
        toast.success('Sent to Drying',
          unifiedDryingSource === 'batch'
            ? `${unifiedDryingSacks} sacks have been sent to drying.`
            : `Procurement #${String(unifiedDryingProcId).padStart(4, '0')} sent to drying.`
        );
        invalidateCache(CACHE_KEY);
        invalidateCache(BATCHES_CACHE_KEY);
        invalidateCache('/drying-processes');
        refetch();
        refetchBatches();
      } else {
        throw response;
      }
    } catch (error) {
      console.error('Error sending to drying:', error);
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        if (unifiedDryingSource === 'batch') {
          setUnifiedDryingBatchErrors(backendErrors);
        } else {
          setUnifiedDryingErrors(backendErrors);
        }
        toast.error('Validation Error', 'Please fix the highlighted fields.');
      } else {
        toast.error('Error', error.message || 'Failed to send to drying.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (saving) return; // Prevent double submit
    setSaving(true);
    try {
      const response = await apiClient.delete(`/procurements/${selectedItem.id}`);
      
      if (response.success) {
        const archivedItem = selectedItem;
        const archivedId = archivedItem.id;
        // Close modal first
        setIsDeleteModalOpen(false);
        
        // Immediately remove from local data (optimistic update) for instant UI
        optimisticUpdate(prev => prev.filter(p => p.id !== archivedId));
        
        // Immediately update batch sack counts if procurement belonged to a batch
        if (archivedItem.batch_id) {
          optimisticUpdateBatches(prev => prev.map(b => {
            if (b.id === archivedItem.batch_id) {
              const newTotalSacks = Math.max(0, (b.total_sacks || 0) - (archivedItem.sacks || 0));
              const newTotalKg = Math.max(0, (b.total_kg || 0) - parseFloat(archivedItem.quantity_kg || 0));
              const usedSacks = (b.total_sacks || 0) - (b.remaining_sacks || 0);
              const usedKg = (b.total_kg || 0) - (b.remaining_kg || 0);
              return {
                ...b,
                total_sacks: newTotalSacks,
                total_kg: newTotalKg,
                remaining_sacks: Math.max(0, newTotalSacks - usedSacks),
                remaining_kg: Math.max(0, newTotalKg - usedKg),
              };
            }
            return b;
          }));
        }
        
        toast.success('Procurement Archived', 'Procurement record has been archived.');
        
        // Refetch in background to confirm (include batches so sack counts update)
        invalidateCache(CACHE_KEY);
        invalidateCache(BATCHES_CACHE_KEY);
        refetch();
        refetchBatches();
        return;
      } else {
        throw new Error(response.error || 'Failed to archive');
      }
    } catch (error) {
      console.error('Error archiving procurement:', error);
      toast.error('Error', 'Failed to archive procurement');
      refetch();
    } finally {
      setSaving(false);
    }
  };

  // Helper function to get days in a month
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  // Stats — react to chart point filter
  const totalProcurements = chartFilteredProcurements.length;
  const pendingOrders = chartFilteredProcurements.filter(p => p.status === 'Pending').length;
  const completedOrders = chartFilteredProcurements.filter(p => p.status === 'Completed').length;
  const totalQuantity = chartFilteredProcurements.reduce((sum, p) => sum + parseFloat(p.quantity_kg || 0), 0);
  const totalSacks = chartFilteredProcurements.reduce((sum, p) => sum + parseInt(p.sacks || 0), 0);
  const totalCost = chartFilteredProcurements.reduce((sum, p) => sum + parseFloat(p.total_cost || 0), 0);

  // Chart Data - Based on chartPeriod (daily, weekly, monthly, bi-annually, annually)
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (chartPeriod === 'daily') {
      const [y, m] = chartMonth.split('-').map(Number);
      const daysInMonth = getDaysInMonth(y, m - 1);
      const dayGroups = {};
      procurements.forEach(p => {
        if (!p.created_at) return;
        const date = new Date(p.created_at);
        if (date.getFullYear() === y && date.getMonth() === m - 1) {
          const day = date.getDate();
          if (!dayGroups[day]) dayGroups[day] = { value: 0, quantity: 0 };
          dayGroups[day].value += parseFloat(p.total_cost || 0);
          dayGroups[day].quantity += parseFloat(p.quantity_kg || 0);
        }
      });
      return Array.from({ length: daysInMonth }, (_, i) => ({
        name: String(i + 1),
        value: dayGroups[i + 1]?.value || 0,
        quantity: dayGroups[i + 1]?.quantity || 0,
      }));
    }
    
    if (chartPeriod === 'weekly') {
      const [y, m] = chartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      return weeks.map(week => {
        let value = 0, quantity = 0;
        procurements.forEach(p => {
          if (!p.created_at) return;
          const date = new Date(p.created_at);
          if (date >= week.start && date <= new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59)) {
            value += parseFloat(p.total_cost || 0);
            quantity += parseFloat(p.quantity_kg || 0);
          }
        });
        return { name: week.label, value, quantity };
      });
    }
    
    if (chartPeriod === 'monthly') {
      const monthGroups = {};
      procurements.forEach(p => {
        if (!p.created_at) return;
        const date = new Date(p.created_at);
        if (date.getFullYear() === chartYear) {
          const month = date.getMonth();
          if (!monthGroups[month]) monthGroups[month] = { value: 0, quantity: 0 };
          monthGroups[month].value += parseFloat(p.total_cost || 0);
          monthGroups[month].quantity += parseFloat(p.quantity_kg || 0);
        }
      });
      return months.map((name, i) => ({
        name,
        value: monthGroups[i]?.value || 0,
        quantity: monthGroups[i]?.quantity || 0,
      }));
    }
    
    if (chartPeriod === 'bi-annually') {
      const h1 = { value: 0, quantity: 0 };
      const h2 = { value: 0, quantity: 0 };
      procurements.forEach(p => {
        if (!p.created_at) return;
        const date = new Date(p.created_at);
        if (date.getFullYear() === chartYear) {
          const target = date.getMonth() < 6 ? h1 : h2;
          target.value += parseFloat(p.total_cost || 0);
          target.quantity += parseFloat(p.quantity_kg || 0);
        }
      });
      return [
        { name: 'H1', fullName: `Jan - Jun ${chartYear}`, value: h1.value, quantity: h1.quantity },
        { name: 'H2', fullName: `Jul - Dec ${chartYear}`, value: h2.value, quantity: h2.quantity },
      ];
    }
    
    // annually
    const years = [];
    for (let y = chartYearFrom; y <= chartYearTo; y++) years.push(y);
    const yearGroups = {};
    procurements.forEach(p => {
      if (!p.created_at) return;
      const date = new Date(p.created_at);
      const year = date.getFullYear();
      if (year >= chartYearFrom && year <= chartYearTo) {
        if (!yearGroups[year]) yearGroups[year] = { value: 0, quantity: 0 };
        yearGroups[year].value += parseFloat(p.total_cost || 0);
        yearGroups[year].quantity += parseFloat(p.quantity_kg || 0);
      }
    });
    return years.map(year => ({
      name: year.toString(),
      value: yearGroups[year]?.value || 0,
      quantity: yearGroups[year]?.quantity || 0,
    }));
  }, [procurements, chartPeriod, chartMonth, chartYear, chartYearFrom, chartYearTo, getWeeksInMonth]);

  // Supplier breakdown for donut chart - TOP 5 ONLY - filtered by chart period + active point
  const supplierBreakdown = useMemo(() => {
    const colors = ['#22c55e', '#eab308', '#3b82f6', '#f97316', '#8b5cf6'];
    const supplierTotals = {};
    
    procurements.forEach(p => {
      if (chartScopeActive && !isInChartScope(p)) return;
      if (activeChartPoint && !matchesChartPoint(p)) return;
      
      const supplierName = p.supplier_name || 'Unknown';
      if (!supplierTotals[supplierName]) supplierTotals[supplierName] = 0;
      supplierTotals[supplierName] += parseFloat(p.quantity_kg || 0);
    });

    return Object.entries(supplierTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value], index) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        value: Math.round(value),
        color: colors[index % colors.length],
      }));
  }, [procurements, isInChartScope, activeChartPoint, matchesChartPoint, chartScopeActive]);

  // Sacks vs Kg comparison for donut chart - filtered by chart period + active point
  const quantityComparison = useMemo(() => {
    let filteredSacks = 0;
    let filteredKg = 0;
    
    procurements.forEach(p => {
      if (chartScopeActive && !isInChartScope(p)) return;
      if (activeChartPoint && !matchesChartPoint(p)) return;
      
      filteredSacks += parseInt(p.sacks || 0);
      filteredKg += parseFloat(p.quantity_kg || 0);
    });
    
    return [
      { name: 'Total Sacks', value: filteredSacks, color: '#3b82f6' },
      { name: 'Total Kg', value: Math.round(filteredKg), color: '#22c55e' },
    ];
  }, [procurements, isInChartScope, activeChartPoint, matchesChartPoint, chartScopeActive]);

  // Average order value
  const avgOrderValue = totalProcurements > 0 ? Math.floor(totalCost / totalProcurements) : 0;

  const columns = useMemo(() => [
    { 
      header: 'ID / Batch', 
      accessor: 'id',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm text-gray-600 dark:text-gray-300">#{String(row.id).padStart(4, '0')}</span>
          {row.batch_number && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 w-fit">
              <Layers size={10} />{row.batch_number}
            </span>
          )}
        </div>
      )
    },
    { header: 'Supplier', accessor: 'supplier_name' },
    {
      header: 'Variety', accessor: 'variety_name',
      cell: (row) => row.variety_name ? (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: row.variety_color || '#6b7280' }}>
          {row.variety_name}
        </span>
      ) : <span className="text-gray-400 text-xs">—</span>
    },
    { 
      header: 'Quantity', 
      accessor: 'quantity_kg',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-green-600 dark:text-green-400">{parseFloat(row.quantity_kg).toLocaleString()} kg</span>
          <span className="text-xs text-blue-600 dark:text-blue-400">{parseInt(row.sacks || 0).toLocaleString()} sacks</span>
          {(row.drying_sacks > 0 || row.drying_kg > 0) && (
            <span className="text-[11px] text-orange-500">
              ↗ {row.drying_sacks} sacks / {parseFloat(row.drying_kg).toLocaleString()} kg drying
            </span>
          )}
        </div>
      )
    },
    { 
      header: 'Price/kg', 
      accessor: 'price_per_kg',
      cell: (row) => <span className="text-gray-700 dark:text-gray-200">₱{parseFloat(row.price_per_kg).toLocaleString()}</span>
    },
    { 
      header: 'Total Cost', 
      accessor: 'total_cost',
      cell: (row) => <span className="font-semibold text-button-600 dark:text-button-400">₱{parseFloat(row.total_cost).toLocaleString()}</span>
    },
    { header: 'Status', accessor: 'status', cell: (row) => (
      <div>
        <StatusBadge status={row.status} />
        {row.description && (
          <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[140px]" title={row.description}><span className="text-gray-500 dark:text-gray-400">Remarks:</span> {row.description}</p>
        )}
      </div>
    )},
    {
      header: 'Date', accessor: 'created_at',
      cell: (row) => row.created_at ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-600 dark:text-gray-300">{new Date(row.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span className="text-[11px] text-gray-400">{new Date(row.created_at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
        </div>
      ) : <span className="text-gray-300 text-xs">—</span>
    },
    { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => {
      const isDried = row.status === 'Dried';
      const isDrying = row.status === 'Drying';
      const isCancelled = row.status === 'Cancelled' || row.status === 'Completed';
      const hasDryingSacks = row.drying_sacks > 0;
      // Edit disabled only for Cancelled/Completed
      const editDisabled = isCancelled;
      const deleteDisabled = isDried || isDrying;
      const remainingSacks = Math.max(0, parseInt(row.sacks || 0) - (row.drying_sacks || 0));
      const canSendToDrying = (row.status === 'Pending' || row.status === 'Drying') && remainingSacks > 0;
      // Remarks-only edit when dried OR has sacks in drying
      const remarksOnlyEdit = isDried || hasDryingSacks;
      return (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { if (!editDisabled) { e.stopPropagation(); handleEdit(row, remarksOnlyEdit); } else e.stopPropagation(); }}
            disabled={editDisabled}
            className={`p-1.5 rounded-md transition-colors ${
              editDisabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-button-50 dark:hover:bg-button-900/20 text-button-500 hover:text-button-700 dark:text-button-300'
            }`}
            title={editDisabled ? 'Cannot edit' : remarksOnlyEdit ? 'Edit Remarks' : 'Edit'}
          >
            <Edit size={15} />
          </button>
          {/* Sun icon disabled - use top-level Send to Drying button instead */}

          {isSuperAdmin() && (
          <button
            onClick={(e) => { if (!deleteDisabled) { e.stopPropagation(); handleDelete(row); } else e.stopPropagation(); }}
            disabled={deleteDisabled}
            className={`p-1.5 rounded-md transition-colors ${
              deleteDisabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-amber-50 text-amber-500 hover:text-amber-700 dark:text-amber-300'
            }`}
            title={deleteDisabled ? 'Cannot archive' : 'Archive'}
          >
            <Archive size={15} />
          </button>
          )}
        </div>
      );
    }},
  ], [handleView, handleEdit, handleDelete]);

  // Batch table columns
  const batchColumns = useMemo(() => [
    {
      header: 'Batch #', accessor: 'batch_number',
      cell: (row) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
          <Layers size={10} />{row.batch_number}
        </span>
      )
    },
    {
      header: 'Variety', accessor: 'variety_name',
      cell: (row) => row.variety_name ? (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: row.variety_color || '#6b7280' }}>
          {row.variety_name}
        </span>
      ) : <span className="text-gray-400 text-sm">—</span>
    },
    {
      header: 'Sacks', accessor: 'total_sacks',
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-blue-600 dark:text-blue-400">{row.total_sacks}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{row.remaining_sacks} left</span>
        </div>
      )
    },
    {
      header: 'Total Kg', accessor: 'total_kg',
      cell: (row) => <span className="font-semibold text-green-600 dark:text-green-400">{parseFloat(row.total_kg).toLocaleString()} kg</span>
    },
    {
      header: 'Procurement Cost', accessor: 'total_cost',
      cell: (row) => <span className="font-semibold text-button-600 dark:text-button-400">₱{parseFloat(row.total_cost || 0).toLocaleString()}</span>
    },
    {
      header: 'Drying Cost', accessor: 'total_drying_cost',
      cell: (row) => {
        const cost = parseFloat(row.total_drying_cost || 0);
        return cost > 0 
          ? <span className="font-semibold text-orange-600 dark:text-orange-400">₱{cost.toLocaleString()}</span>
          : <span className="text-gray-400 text-xs">—</span>;
      }
    },
    {
      header: 'Total Expenses', accessor: 'total_expenses',
      cell: (row) => {
        const procurement = parseFloat(row.total_cost || 0);
        const drying = parseFloat(row.total_drying_cost || 0);
        return <span className="font-bold text-purple-600 dark:text-purple-400">₱{(procurement + drying).toLocaleString()}</span>;
      }
    },
    {
      header: 'Items', accessor: 'procurements_count',
      cell: (row) => <span className="text-sm text-gray-700 dark:text-gray-200">{row.procurements_count ?? '—'}</span>
    },
    { 
      header: 'Status', accessor: 'status', 
      cell: (row) => (
        <button 
          onClick={(e) => handleToggleBatchStatus(row, e)}
          className="focus:outline-none hover:scale-105 transition-transform"
          title={`Click to ${row.status === 'Open' ? 'close' : 're-open'} batch`}
        >
          <StatusBadge status={row.status} />
        </button>
      )
    },
    {
      header: 'Notes', accessor: 'notes',
      cell: (row) => row.notes ? (
        <span className="text-xs text-gray-600 dark:text-gray-300 max-w-[200px] truncate block">{row.notes}</span>
      ) : <span className="text-gray-400 text-xs">—</span>
    },
    {
      header: 'Created', accessor: 'created_at',
      cell: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {row.created_at ? new Date(row.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </span>
      )
    },
  ], [handleToggleBatchStatus]);

  return (
    <div>
      <PageHeader 
        title="Procurement" 
        description="Manage purchase orders and supplier transactions" 
        icon={ShoppingCart}
        action={isRefreshing ? (
          <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">Syncing...</span>
        ) : null}
      />

      {/* Stats Cards - Show data immediately, skeleton only on true first load */}
      {loading && procurements.length === 0 ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Procurements" value={totalProcurements} unit="records" icon={Package} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <StatsCard label="Pending" value={pendingOrders} unit="orders" icon={Clock} iconBgColor="bg-gradient-to-br from-yellow-400 to-yellow-600" />
          <StatsCard label="Completed" value={completedOrders} unit="orders" icon={CheckCircle} iconBgColor="bg-gradient-to-br from-green-400 to-green-600" />
          <StatsCard label="Total Value" value={`₱${totalCost.toLocaleString()}`} unit="invested" icon={DollarSign} iconBgColor="bg-gradient-to-br from-button-500 to-button-700" />
        </div>
      )}

      {/* Charts */}
      {loading && procurements.length === 0 ? (
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
              title="Procurement Trends" 
              subtitle={(() => {
                const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                if (!chartScopeActive && !activeChartPoint) return 'Purchase order activity overview';
                let scope = '';
                if (chartPeriod === 'daily' || chartPeriod === 'weekly') { const [y,m] = chartMonth.split('-').map(Number); scope = `${months[m-1]} ${y}`; }
                else if (chartPeriod === 'monthly' || chartPeriod === 'bi-annually') scope = String(chartYear);
                else if (chartPeriod === 'annually') scope = `${chartYearFrom}–${chartYearTo}`;
                const mode = chartPeriod.charAt(0).toUpperCase() + chartPeriod.slice(1);
                if (activeChartPoint) return `${activeChartPoint} · ${scope}`;
                return `${mode} · ${scope}`;
              })()}
              data={chartData} 
              lines={[{ dataKey: 'value', name: 'Value (₱)' }]} 
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
                  {/* Period dropdown */}
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
                  {/* Calendar controls based on period */}
                  {chartPeriod === 'daily' && (
                    <input
                      type="month"
                      value={chartMonth}
                      onChange={(e) => { setChartMonth(e.target.value); setActiveChartPoint(null); setChartScopeActive(true); }}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                  {chartPeriod === 'weekly' && (
                    <input
                      type="month"
                      value={chartMonth}
                      onChange={(e) => { setChartMonth(e.target.value); setActiveChartPoint(null); setChartScopeActive(true); }}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                  {chartPeriod === 'monthly' && (
                    <input
                      type="number"
                      value={chartYear}
                      onChange={(e) => { setChartYear(parseInt(e.target.value) || new Date().getFullYear()); setActiveChartPoint(null); setChartScopeActive(true); }}
                      min="2000"
                      max={new Date().getFullYear()}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-24"
                    />
                  )}
                  {chartPeriod === 'bi-annually' && (
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
              onDotClick={(point) => { setActiveChartPoint(point); setChartScopeActive(true); }}
              activePoint={activeChartPoint}
              summaryStats={[
                { label: 'Total Orders', value: totalProcurements.toString(), color: 'text-primary-600 dark:text-primary-400' }, 
                { label: 'Avg Order Value', value: `₱${avgOrderValue.toLocaleString()}`, color: 'text-primary-600 dark:text-primary-400' }, 
                { label: 'Total Qty', value: `${totalQuantity.toLocaleString()} kg`, color: 'text-green-600 dark:text-green-400' }
              ]} 
            />
          </div>
          <div className="space-y-4">
            <DonutChart 
              title="Top 5 Suppliers" 
              data={supplierBreakdown} 
              centerValue={`${supplierBreakdown.length}`} 
              centerLabel="Suppliers" 
              height={175} 
              innerRadius={56} 
              outerRadius={78} 
              showLegend={true} 
              horizontalLegend={true}
            />
            <DonutChart 
              title="Sacks vs Kg" 
              data={quantityComparison} 
              centerValue={`${quantityComparison[0]?.value || 0}`} 
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

      {/* Table Tab Toggle */}
      <div className="flex items-center gap-1 mb-4 bg-white dark:bg-gray-700 rounded-lg p-1 shadow-sm border border-primary-200 dark:border-primary-700 w-fit">
        <button
          onClick={() => setTableTab('records')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
            tableTab === 'records' ? 'bg-button-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 dark:text-gray-100'
          }`}
        >
          <FileText size={14} /> Records
        </button>
        <button
          onClick={() => setTableTab('batches')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
            tableTab === 'batches' ? 'bg-button-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 dark:text-gray-100'
          }`}
        >
          <List size={14} /> Batches
        </button>
      </div>

      {tableTab === 'records' ? (
        <>
          {/* Batch filter bar */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-indigo-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Filter by Batch:</span>
            </div>
            <select
              value={batchFilter}
              onChange={e => setBatchFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 min-w-[240px]"
            >
              {batchOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
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
            {batchFilter && (() => {
              const b = batches.find(b => String(b.id) === batchFilter);
              return b ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg">
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{b.batch_number}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">·</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">{b.remaining_sacks}/{b.total_sacks} sacks remaining</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">·</span>
                  <span className={`text-xs font-medium ${ b.status === 'Open' ? 'text-green-600 dark:text-green-400' : b.status === 'Closed' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'}`}>{b.status}</span>
                </div>
              ) : null;
            })()}
          </div>

          {/* Table - Show data immediately, skeleton only on true first load */}
          {loading && procurements.length === 0 ? (
            <SkeletonTable rows={5} columns={7} />
          ) : (
            <DataTable 
              title="Procurement Records" 
              subtitle={activeChartPoint ? `Filtered: ${activeChartPoint}${batchFilter ? ` · Batch: ${batches.find(b => String(b.id) === batchFilter)?.batch_number || ''}` : ''}` : batchFilter ? `Filtered by batch: ${batches.find(b => String(b.id) === batchFilter)?.batch_number || ''}` : 'Manage all procurement transactions'}
              columns={columns} 
              data={filteredProcurements} 
              searchPlaceholder="Search procurements..." 
              filterField="status" 
              filterPlaceholder="All Status" 
              dateFilterField="created_at"
              onAdd={handleAdd} 
              addLabel="Add Procurement"
              onRowDoubleClick={handleView}
              headerRight={
                <button
                  onClick={handleOpenUnifiedDrying}
                  className="px-3 py-1.5 text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Sun size={14} /> Send to Drying
                </button>
              }
            />
          )}
        </>
      ) : (
        /* Batches Tab */
        loading && batches.length === 0 ? (
          <SkeletonTable rows={5} columns={8} />
        ) : (
          <DataTable
            title="Procurement Batches"
            subtitle={activeChartPoint ? `Filtered: ${activeChartPoint} — click chart dot to clear` : "Overview of all procurement batch groups — click row to view, click status to toggle"}
            columns={batchColumns}
            data={chartFilteredBatches}
            searchPlaceholder="Search batches..."
            filterField="status"
            filterPlaceholder="All Status"
            dateFilterField="created_at"
            onRowDoubleClick={handleBatchView}
          />
        )
      )}

      {/* View Modal */}
      <Modal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)} 
        title="Procurement Details" 
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
              Edit Procurement
            </button>
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
              <div className="bg-gradient-to-r from-primary-50 to-button-50 dark:from-gray-700 dark:to-gray-700 p-3 rounded-lg border-2 border-primary-200 dark:border-primary-700">
                <div className="flex items-start gap-2">
                  <div className="p-2 bg-button-500 dark:bg-button-600 text-white rounded-lg">
                    <Package size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Procurement #{String(selectedItem.id).padStart(4, '0')}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300">Record ID</p>
                  </div>
                  <StatusBadge status={selectedItem.status} />
                </div>
              </div>

              {/* Supplier */}
              <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Building2 size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Supplier</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{selectedItem.supplier_name}</p>
                </div>
              </div>

              {/* Batch badge */}
              {selectedItem?.batch_number && (
                <div className="flex items-center gap-2 p-2.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg">
                  <Layers size={15} className="text-indigo-500 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Batch</p>
                    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{selectedItem.batch_number}</p>
                  </div>
                  <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                    selectedItem.batch_status === 'Open' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                    selectedItem.batch_status === 'Closed' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>{selectedItem.batch_status}</span>
                </div>
              )}

              {/* Variety */}
              <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                  <User size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Variety</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{selectedItem.variety_name || '—'}</p>
                </div>
              </div>

              {/* Total Cost */}
              <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-button-50 to-primary-50 dark:from-gray-700 dark:to-gray-700 rounded-lg border-2 border-button-200 dark:border-button-700">
                <div className="p-2 bg-button-500 dark:bg-button-600 text-white rounded-lg">
                  <DollarSign size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Total Cost</p>
                  <p className="text-xl font-bold text-button-600 dark:text-button-400">₱{parseFloat(selectedItem.total_cost).toLocaleString()}</p>
                </div>
              </div>

              {/* Date */}
              <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                  <Calendar size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Date Created</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                    {selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                  {selectedItem.created_at && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(selectedItem.created_at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {/* Quantity Info */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Boxes size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300">Sacks/Bags</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{parseInt(selectedItem.sacks || 0).toLocaleString()} sacks</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                    <Scale size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300">Quantity</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{parseFloat(selectedItem.quantity_kg).toLocaleString()} kg</p>
                  </div>
                </div>
              </div>

              {/* Price per KG */}
              <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-lg">
                  <DollarSign size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Price per KG</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">₱{parseFloat(selectedItem.price_per_kg).toLocaleString()}</p>
                </div>
              </div>

              {/* Remarks */}
              {selectedItem.description && (
                <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg">
                    <FileText size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Remarks</p>
                    <p className="text-gray-800 dark:text-gray-100 text-sm">{selectedItem.description}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Modal */}
      <FormModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSubmit={handleAddSubmit} 
        title="Add Procurement" 
        submitText="Add Procurement" 
        size="lg"
        loading={saving}
      >
        {({ submitted }) => (
          <>
            {/* Batch Assignment Section — TOP */}
            <div className="pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <Layers size={14} className="text-indigo-500" />
                Batch Assignment <span className="text-gray-400 font-normal">(optional)</span>
              </label>

              {!isCreatingBatch ? (
                <>
                  <div className="flex gap-2">
                    <select
                      name="batch_id"
                      value={formData.batch_id}
                      onChange={handleFormChange}
                      className="flex-1 min-w-0 px-4 py-2.5 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    >
                      {openBatchOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsCreatingBatch(true)}
                      className="px-3 py-2.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
                    >
                      <PlusCircle size={14} />
                      <span className="hidden sm:inline">New Batch</span>
                      <span className="sm:hidden">New</span>
                    </button>
                  </div>
                  {formData.batch_id && (() => {
                    const b = batches.find(b => String(b.id) === formData.batch_id);
                    return b ? (
                      <p className="mt-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                        Batch variety: <strong>{b.variety_name}</strong> · {b.remaining_sacks} sacks remaining
                      </p>
                    ) : null;
                  })()}
                </>
              ) : (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Create New Batch</p>
                    <button
                      type="button"
                      onClick={() => { setIsCreatingBatch(false); setNewBatchNotes(''); }}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-200 underline"
                    >
                      Cancel
                    </button>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">Batch Variety *</label>
                    <select
                      name="variety_id"
                      value={formData.variety_id}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 text-sm border-2 border-indigo-200 dark:border-indigo-700 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                    >
                      {varietyOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">All procurements in this batch must be this variety.</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">Notes (optional)</label>
                    <input
                      type="text"
                      value={newBatchNotes}
                      onChange={(e) => setNewBatchNotes(e.target.value)}
                      placeholder="e.g. Season 2026 first harvest"
                      className="w-full px-3 py-2 text-sm border-2 border-indigo-200 dark:border-indigo-700 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!formData.variety_id || creatingBatchLoading}
                    onClick={async () => {
                      if (!formData.variety_id) return;
                      setCreatingBatchLoading(true);
                      try {
                        const res = await apiClient.post('/procurement-batches', {
                          variety_id: parseInt(formData.variety_id),
                          notes: newBatchNotes || null,
                        });
                        if (res.success && res.data) {
                          const newBatch = res.data;
                          const varietyName = varieties.find(v => String(v.id) === String(formData.variety_id))?.name || '';
                          // Build a complete batch object so the dropdown works even when offline
                          // (offline temp record lacks status/variety_name/batch_number)
                          const enrichedBatch = {
                            ...newBatch,
                            variety_name: newBatch.variety_name || varietyName,
                            remaining_sacks: newBatch.remaining_sacks ?? 0,
                            total_sacks: newBatch.total_sacks ?? 0,
                            status: newBatch.status || 'Open',
                            batch_number: newBatch.batch_number || `OFFLINE-${Date.now()}`,
                            variety_color: newBatch.variety_color || null,
                          };
                          // If this was an offline write, persist the enriched record to IndexedDB
                          // so that refetchBatches() returns the correct status/variety_name fields
                          if (newBatch._offlineCreated) {
                            try { await dbPut(DB_STORES.PROCUREMENT_BATCHES, enrichedBatch); } catch { /* non-critical */ }
                          }
                          optimisticUpdateBatches(prev => [enrichedBatch, ...prev]);
                          setFormData(prev => ({ ...prev, batch_id: String(enrichedBatch.id) }));
                          setIsCreatingBatch(false);
                          setNewBatchNotes('');
                          toast.success('Batch Created', `Batch created successfully.`);
                          // Background sync — use optimisticUpdate already set, only refetch when online
                          invalidateCache(BATCHES_CACHE_KEY);
                          if (navigator.onLine) refetchBatches();
                        }
                      } catch (err) {
                        toast.error('Error', err.response?.data?.message || 'Failed to create batch');
                      } finally {
                        setCreatingBatchLoading(false);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                  >
                    {creatingBatchLoading ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Creating...</>
                    ) : (
                      <><PlusCircle size={14} /> Create Batch & Assign</>
                    )}
                  </button>                </div>
              )}
            </div>

            <SupplierCombobox 
              value={formData.supplier_id}
              newName={formData.new_supplier_name}
              newContact={formData.new_supplier_contact}
              newPhone={formData.new_supplier_phone}
              newEmail={formData.new_supplier_email}
              newAddress={formData.new_supplier_address}
              onChange={handleFormChange}
              onInputChange={(e) => handleSupplierInput(e)}
              onFieldChange={handleSupplierFieldChange}
              error={errors.supplier_id?.[0] || errors.new_supplier_name?.[0]}
              submitted={submitted}
              supplierOptions={supplierOptions}
            />

            <div className="relative">
              <FormSelect
                label={formData.batch_id ? "Variety (set by batch)" : "Variety"}
                name="variety_id"
                value={formData.variety_id}
                onChange={handleFormChange}
                options={varietyOptions}
                required
                submitted={submitted}
                error={errors.variety_id?.[0]}
                disabled={!!formData.batch_id && !isCreatingBatch}
              />
              {formData.batch_id && !isCreatingBatch && (
                <p className="text-xs text-indigo-500 -mt-2 mb-2">Variety is locked to match the selected batch.</p>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Sacks Accumulator */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Sacks/Bags <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={sacksInput}
                    onChange={e => setSacksInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSacks(); } }}
                    placeholder={sacksEntries.length > 0 ? `Total: ${sacksEntries.reduce((s,v)=>s+v,0)}` : 'Enter sacks'}
                    min="1"
                    className="flex-1 min-w-0 px-3 py-2 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                  />
                  <button type="button" onClick={handleAddSacks} className="px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all flex-shrink-0">
                    <PlusCircle size={16} />
                  </button>
                </div>
                {sacksEntries.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {sacksEntries.map((val, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700 rounded-lg pl-1 pr-0.5 py-0.5">
                        {editingSacksIdx === idx ? (
                          <input
                            type="number"
                            value={editingSacksValue}
                            onChange={e => setEditingSacksValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleConfirmEditSacks(); } if (e.key === 'Escape') setEditingSacksIdx(null); }}
                            onBlur={handleConfirmEditSacks}
                            autoFocus
                            className="w-14 px-1 py-0 text-xs border border-primary-300 dark:border-primary-600 rounded bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none"
                            min="1"
                          />
                        ) : (
                          <button type="button" onClick={() => handleStartEditSacks(idx)} className="px-1 hover:underline cursor-pointer" title="Click to edit">
                            {val}
                          </button>
                        )}
                        <button type="button" onClick={() => handleRemoveSacks(idx)} className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-400 hover:text-red-600 transition-colors" title="Remove">
                          <XCircle size={12} />
                        </button>
                      </span>
                    ))}
                    <span className="inline-flex items-center text-xs font-bold text-primary-600 dark:text-primary-400 px-1.5 py-0.5">
                      = {sacksEntries.reduce((s,v)=>s+v,0)}
                    </span>
                  </div>
                )}
                {submitted && !formData.sacks && !sacksInput && <p className="text-xs text-red-500 mt-1">Sacks is required</p>}
                {submitted && sacksInput && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">You have an unadded value. Click + or press Enter to add it first.</p>}
                {!submitted && sacksInput && parseInt(sacksInput) > 0 && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Click + or press Enter to add this value.</p>}
                {errors.sacks?.[0] && <p className="text-xs text-red-500 mt-1">{errors.sacks[0]}</p>}
              </div>

              {/* Kg Accumulator */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Quantity (kg) <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={kgInput}
                    onChange={e => setKgInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddKg(); } }}
                    placeholder={kgEntries.length > 0 ? `Total: ${kgEntries.reduce((s,v)=>s+v,0)}` : 'Enter kg'}
                    min="0.01"
                    step="0.01"
                    className="flex-1 min-w-0 px-3 py-2 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                  />
                  <button type="button" onClick={handleAddKg} className="px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all flex-shrink-0">
                    <PlusCircle size={16} />
                  </button>
                </div>
                {kgEntries.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {kgEntries.map((val, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700 rounded-lg pl-1 pr-0.5 py-0.5">
                        {editingKgIdx === idx ? (
                          <input
                            type="number"
                            value={editingKgValue}
                            onChange={e => setEditingKgValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleConfirmEditKg(); } if (e.key === 'Escape') setEditingKgIdx(null); }}
                            onBlur={handleConfirmEditKg}
                            autoFocus
                            className="w-16 px-1 py-0 text-xs border border-primary-300 dark:border-primary-600 rounded bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none"
                            min="0.01"
                            step="0.01"
                          />
                        ) : (
                          <button type="button" onClick={() => handleStartEditKg(idx)} className="px-1 hover:underline cursor-pointer" title="Click to edit">
                            {val}
                          </button>
                        )}
                        <button type="button" onClick={() => handleRemoveKg(idx)} className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-400 hover:text-red-600 transition-colors" title="Remove">
                          <XCircle size={12} />
                        </button>
                      </span>
                    ))}
                    <span className="inline-flex items-center text-xs font-bold text-primary-600 dark:text-primary-400 px-1.5 py-0.5">
                      = {kgEntries.reduce((s,v)=>s+v,0)} kg
                    </span>
                  </div>
                )}
                {submitted && !formData.quantity_kg && !kgInput && <p className="text-xs text-red-500 mt-1">Quantity is required</p>}
                {submitted && kgInput && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">You have an unadded value. Click + or press Enter to add it first.</p>}
                {!submitted && kgInput && parseFloat(kgInput) > 0 && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Click + or press Enter to add this value.</p>}
                {errors.quantity_kg?.[0] && <p className="text-xs text-red-500 mt-1">{errors.quantity_kg[0]}</p>}
              </div>
            </div>

            <div>
              <FormInput 
                label="Price per KG (₱)" 
                name="price_per_kg" 
                type="number" 
                value={formData.price_per_kg} 
                onChange={handleFormChange} 
                required 
                placeholder="0.00" 
                submitted={submitted} 
                error={errors.price_per_kg?.[0]}
                step="0.01"
              />
            </div>

            {/* Calculated Total */}
            {(formData.quantity_kg && formData.price_per_kg) && (
              <div className="p-3 bg-button-50 dark:bg-button-900/20 border border-button-200 dark:border-button-700 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Calculated Total:</span>
                  <span className="text-lg font-bold text-button-600 dark:text-button-400">₱{calculatedTotal.toLocaleString()}</span>
                </div>
              </div>
            )}

            <FormInput 
              label="Remarks" 
              name="description" 
              value={formData.description} 
              onChange={handleFormChange} 
              required
              placeholder="e.g. Paid, Not paid, COD, etc." 
              submitted={submitted} 
              error={errors.description?.[0]}
            />
          </>
        )}
      </FormModal>

      {/* Edit Modal */}
      <FormModal 
        isOpen={isEditModalOpen} 
        onClose={() => { setIsEditModalOpen(false); setIsRemarksOnlyEdit(false); }} 
        onSubmit={handleEditSubmit} 
        title={(isRemarksOnlyEdit || selectedItem?.drying_sacks > 0) ? "Edit Remarks" : "Edit Procurement"} 
        submitText="Save Changes" 
        size={(isRemarksOnlyEdit || selectedItem?.drying_sacks > 0) ? "md" : "lg"}
        loading={saving}
      >
        {({ submitted }) => {
          const hasItemsInDrying = selectedItem?.drying_sacks > 0;
          const showRemarksOnly = isRemarksOnlyEdit || hasItemsInDrying;
          
          return (
          <>
            {showRemarksOnly ? (
              /* Remarks-only edit for dried/drying procurements */
              <>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg mb-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Procurement #{String(selectedItem?.id).padStart(4, '0')}</strong> {isRemarksOnlyEdit ? 'is already Dried' : `has ${selectedItem?.drying_sacks} sacks in drying`}. Only the remarks can be edited.
                  </p>
                </div>
                <FormInput 
                  label="Remarks" 
                  name="description" 
                  value={formData.description} 
                  onChange={handleFormChange} 
                  required
                  placeholder="e.g. Paid, Not paid, COD, etc." 
                  submitted={submitted} 
                  error={errors.description?.[0]}
                />
              </>
            ) : (
              /* Full edit for non-dried procurements */
              <>
                <FormSelect 
                  label="Supplier" 
                  name="supplier_id" 
                  value={formData.supplier_id} 
                  onChange={handleFormChange} 
                  options={supplierOptions.filter(opt => opt.value !== '')} 
                  required 
                  submitted={submitted} 
                  error={errors.supplier_id?.[0]} 
                />

                <FormSelect
                  label="Variety"
                  name="variety_id"
                  value={formData.variety_id}
                  onChange={handleFormChange}
                  options={varietyOptions}
                  required
                  submitted={submitted}
                  error={errors.variety_id?.[0]}
                />
                
                <div className="grid grid-cols-3 gap-4">
                  <FormInput 
                    label="Sacks/Bags" 
                    name="sacks" 
                    type="number" 
                    value={formData.sacks} 
                    onChange={handleFormChange} 
                    required 
                    placeholder="0" 
                    submitted={submitted} 
                    error={errors.sacks?.[0] || ((selectedItem?.drying_sacks > 0 && parseInt(formData.sacks) < selectedItem.drying_sacks) ? `Min ${selectedItem.drying_sacks} sacks (in drying)` : undefined)}
                    min={selectedItem?.drying_sacks || 0}
                  />
                  <FormInput 
                    label="Quantity (kg)" 
                    name="quantity_kg" 
                    type="number" 
                    value={formData.quantity_kg} 
                    onChange={handleFormChange} 
                    required 
                    placeholder="0" 
                    submitted={submitted} 
                    error={errors.quantity_kg?.[0] || ((selectedItem?.drying_kg > 0 && parseFloat(formData.quantity_kg) < parseFloat(selectedItem.drying_kg)) ? `Min ${parseFloat(selectedItem.drying_kg).toLocaleString()} kg (in drying)` : undefined)}
                    step="0.01"
                    min={selectedItem?.drying_kg || 0}
                  />
                  <FormInput 
                    label="Price per KG (₱)" 
                    name="price_per_kg" 
                    type="number" 
                    value={formData.price_per_kg} 
                    onChange={handleFormChange} 
                    required 
                    placeholder="0.00" 
                    submitted={submitted} 
                    error={errors.price_per_kg?.[0]}
                    step="0.01"
                  />
                </div>

                {/* Drying info banner */}
                {selectedItem?.drying_sacks > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>{selectedItem.drying_sacks} sacks</strong> / <strong>{parseFloat(selectedItem.drying_kg).toLocaleString()} kg</strong> are committed to drying. Values cannot be set below these amounts.
                    </p>
                  </div>
                )}

                {/* Calculated Total */}
                {(formData.quantity_kg && formData.price_per_kg) && (
                  <div className="p-3 bg-button-50 dark:bg-button-900/20 border border-button-200 dark:border-button-700 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Calculated Total:</span>
                      <span className="text-lg font-bold text-button-600 dark:text-button-400">₱{calculatedTotal.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <FormInput 
                  label="Remarks" 
                  name="description" 
                  value={formData.description} 
                  onChange={handleFormChange} 
                  required
                  placeholder="e.g. Paid, Not paid, COD, etc." 
                  submitted={submitted} 
                  error={errors.description?.[0]}
                />

                {/* Batch Assignment */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-1">
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    <Layers size={14} className="text-indigo-500" />
                    Batch Assignment <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      name="batch_id"
                      value={formData.batch_id}
                      onChange={handleFormChange}
                      className="flex-1 px-4 py-2.5 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    >
                      {openBatchOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                      {/* Also show current batch if it's closed */}
                      {formData.batch_id && !openBatchOptions.find(o => o.value === formData.batch_id) && (() => {
                        const b = batches.find(b => String(b.id) === formData.batch_id);
                        return b ? (
                          <option value={formData.batch_id}>{b.batch_number} — {b.status}</option>
                        ) : null;
                      })()}
                    </select>
                  </div>
                  {formData.batch_id && (() => {
                    const b = batches.find(b => String(b.id) === formData.batch_id);
                    return b ? (
                      <p className="mt-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                        Batch variety: <strong>{b.variety_name}</strong> · {b.remaining_sacks} sacks remaining
                      </p>
                    ) : null;
                  })()}
                </div>
              </>
            )}
          </>
          );
        }}
      </FormModal>

      {/* Archive Confirmation Modal */}
      <ConfirmModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={handleDeleteConfirm} 
        title="Archive Procurement" 
        message={`Are you sure you want to archive this procurement record from ${selectedItem?.supplier_name}? It will be moved to the archives and can be restored later.`} 
        confirmText="Archive" 
        variant="warning" 
        icon={Archive}
        loading={saving}
      />

      {/* Standalone Procurement Confirmation Modal */}
      <ConfirmModal 
        isOpen={isStandaloneConfirmOpen} 
        onClose={handleStandaloneCancel} 
        onConfirm={handleStandaloneConfirm} 
        title="Standalone Procurement" 
        message="This procurement is not assigned to any batch. Are you sure you want to add it as a standalone procurement?" 
        confirmText="Yes, Add Standalone" 
        cancelText="Go Back" 
        variant="primary" 
        icon={AlertCircle}
        loading={saving}
      />

      {/* New Supplier Confirmation Modal */}
      <ConfirmModal 
        isOpen={isNewSupplierConfirmOpen} 
        onClose={handleNewSupplierCancel} 
        onConfirm={handleNewSupplierConfirm} 
        title="Create New Supplier" 
        message={`You are about to create a new supplier "${formData.new_supplier_name}". This will add them to your suppliers list. Do you want to continue?`} 
        confirmText="Yes, Create Supplier" 
        cancelText="Cancel"
        variant="primary" 
        icon={PlusCircle}
        loading={saving}
      />

      {/* Send to Drying Modal */}
      <FormModal
        isOpen={isSendToDryingOpen}
        onClose={() => setIsSendToDryingOpen(false)}
        onSubmit={handleSendToDryingSubmit}
        title="Send Batch to Drying"
        submitText="Start Drying"
        size="lg"
        loading={saving}
      >
        {({ submitted }) => {
          const selectedBatch = batches.find(b => String(b.id) === batchFilter);
          return (
            <>
              {/* Batch Info */}
              {selectedBatch && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{selectedBatch.batch_number}</span>
                    <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                      selectedBatch.status === 'Open' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                      selectedBatch.status === 'Closed' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}>{selectedBatch.status}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-300">
                    <div><span className="font-medium">Variety:</span> {selectedBatch.variety_name}</div>
                    <div><span className="font-medium">Available:</span> <span className="font-bold text-green-600 dark:text-green-400">{selectedBatch.remaining_sacks} sacks / {parseFloat(selectedBatch.remaining_kg).toLocaleString()} kg</span></div>
                  </div>
                </div>
              )}

              <FormInput
                label="Sacks to Dry"
                name="sacks"
                type="number"
                value={dryingSacks}
                onChange={(e) => { setDryingSacks(e.target.value); setDryingErrors(prev => { const n = {...prev}; delete n.sacks; return n; }); }}
                required
                placeholder="0"
                submitted={submitted}
                error={dryingErrors.sacks?.[0]}
              />

              {loadingDryingPreview && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-primary-200 dark:border-primary-700 rounded-lg mb-2 animate-pulse">
                  <p className="text-xs text-gray-400">Calculating distribution...</p>
                </div>
              )}
              {dryingPreview && !loadingDryingPreview && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg mb-2">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1.5">Proportional distribution:</p>
                  <div className="space-y-1">
                    {dryingPreview.breakdown?.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-700 dark:text-gray-200">
                        <span>Procurement #{String(item.procurement_id).padStart(4,'0')}</span>
                        <span>{item.sacks_taken} sacks → {parseFloat(item.quantity_kg).toLocaleString()} kg</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-green-200 dark:border-green-700 flex justify-between text-xs font-bold text-green-700 dark:text-green-300">
                    <span>Total</span>
                    <span>{dryingSacks} sacks → {parseFloat(dryingPreview.total_kg || 0).toLocaleString()} kg</span>
                  </div>
                </div>
              )}

              <FormInput
                label="Drying Price (₱/sack)"
                name="price"
                type="number"
                value={dryingPrice}
                onChange={(e) => { setDryingPrice(e.target.value); setDryingErrors(prev => { const n = {...prev}; delete n.price; return n; }); }}
                required
                placeholder="0.00"
                submitted={submitted}
                error={dryingErrors.price?.[0]}
                step="0.01"
              />

              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-primary-200 dark:border-primary-700 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-300">Days start at <strong>0</strong>. Use the <strong>+</strong> button in the Drying page to increment days. Total = (Sacks × Price) × Days.</p>
              </div>
            </>
          );
        }}
      </FormModal>

      {/* Individual Send to Drying Modal */}
      <FormModal
        isOpen={isIndividualDryingOpen}
        onClose={() => setIsIndividualDryingOpen(false)}
        title="Send to Drying"
        onSubmit={handleIndividualDryingSubmit}
        saving={saving}
        saveText="Send to Drying"
        savingText="Sending..."
        maxWidth="md"
      >
        {(submitted) => {
          if (!individualDryingItem) return null;
          const totalSacks = parseInt(individualDryingItem.sacks || 0);
          const alreadyDrying = individualDryingItem.drying_sacks || 0;
          const remaining = Math.max(0, totalSacks - alreadyDrying);
          const enteredSacks = parseInt(individualDryingSacks) || 0;
          const proportionalKg = totalSacks > 0 ? ((enteredSacks / totalSacks) * parseFloat(individualDryingItem.quantity_kg)).toFixed(2) : 0;
          return (
            <>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg space-y-1">
                <p className="text-sm font-medium text-yellow-800">
                  Procurement #{String(individualDryingItem.id).padStart(4, '0')}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Supplier: {individualDryingItem.supplier_name} &bull; {individualDryingItem.variety_name || 'N/A'}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  {totalSacks.toLocaleString()} sacks &bull; {parseFloat(individualDryingItem.quantity_kg).toLocaleString()} kg
                  {alreadyDrying > 0 && (
                    <span className="text-orange-600 dark:text-orange-400 ml-1">({alreadyDrying} sacks already drying)</span>
                  )}
                </p>
              </div>

              <FormInput
                label={`Sacks to Send (max ${remaining.toLocaleString()})`}
                type="number"
                value={individualDryingSacks}
                onChange={(e) => { 
                  const val = e.target.value;
                  setIndividualDryingSacks(val);
                  // Real-time validation
                  const num = parseInt(val);
                  if (num > remaining) {
                    setIndividualDryingErrors(prev => ({ ...prev, sacks: [`Maximum is ${remaining} sacks.`] }));
                  } else {
                    setIndividualDryingErrors(prev => ({ ...prev, sacks: undefined }));
                  }
                }}
                placeholder={`1 - ${remaining}`}
                submitted={submitted}
                error={individualDryingErrors.sacks?.[0]}
                min="1"
                max={remaining}
                required
              />

              <FormInput
                label="Drying Price (per sack per day)"
                type="number"
                value={individualDryingPrice}
                onChange={(e) => { setIndividualDryingPrice(e.target.value); setIndividualDryingErrors(prev => ({ ...prev, price: undefined })); }}
                placeholder="Enter price per sack per day"
                submitted={submitted}
                error={individualDryingErrors.price?.[0]}
                step="0.01"
                required
              />

              {enteredSacks > 0 && !(parseInt(individualDryingSacks) > remaining) && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>{enteredSacks.toLocaleString()} sacks</strong> → <strong>{parseFloat(proportionalKg).toLocaleString()} kg</strong> will be sent to drying. Days start at <strong>0</strong>.
                  </p>
                </div>
              )}
            </>
          );
        }}
      </FormModal>

      {/* Unified Send to Drying Modal (top-level button) */}
      <FormModal
        isOpen={isUnifiedDryingOpen}
        onClose={() => setIsUnifiedDryingOpen(false)}
        onSubmit={handleUnifiedDryingSubmit}
        title="Send to Drying"
        submitText="Start Drying"
        size="lg"
        loading={saving}
        submitDisabled={!!(unifiedDryingErrors.sacks?.length || unifiedDryingBatchErrors.sacks?.length)}
      >
        {({ submitted }) => (
          <>
            {/* Source Toggle */}
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => { setUnifiedDryingSource('standalone'); setUnifiedDryingBatchPreview(null); setUnifiedDryingBatchErrors({}); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                  unifiedDryingSource === 'standalone' ? 'bg-white dark:bg-gray-700 shadow text-button-600 dark:text-button-400 border border-button-200 dark:border-button-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <Package size={14} /> Standalone
              </button>
              <button
                type="button"
                onClick={() => { setUnifiedDryingSource('batch'); setUnifiedDryingErrors({}); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                  unifiedDryingSource === 'batch' ? 'bg-white dark:bg-gray-700 shadow text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <Layers size={14} /> From Batch
              </button>
            </div>

            {/* Standalone mode */}
            {unifiedDryingSource === 'standalone' && (
              <>
                <FormSelect
                  label="Procurement Source"
                  name="procurement_id"
                  value={unifiedDryingProcId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUnifiedDryingProcId(val);
                    setUnifiedDryingErrors(prev => { const n = {...prev}; delete n.procurement_id; return n; });
                    // Auto-fill remaining sacks
                    if (val) {
                      const proc = procurements.find(p => String(p.id) === val);
                      if (proc) {
                        const alreadyDrying = proc.drying_sacks || 0;
                        const remaining = Math.max(0, parseInt(proc.sacks || 0) - alreadyDrying);
                        setUnifiedDryingStandaloneSacks(String(remaining));
                      }
                    } else {
                      setUnifiedDryingStandaloneSacks('');
                    }
                  }}
                  options={[{ value: '', label: 'Select procurement to dry...' }, ...standaloneProcOptions]}
                  required
                  submitted={submitted}
                  error={unifiedDryingErrors.procurement_id?.[0]}
                />
                {selectedUnifiedProc && (() => {
                  const alreadyDrying = selectedUnifiedProc.drying_sacks || 0;
                  const totalSacks = parseInt(selectedUnifiedProc.sacks || 0);
                  const remaining = Math.max(0, totalSacks - alreadyDrying);
                  const enteredSacks = parseInt(unifiedDryingStandaloneSacks) || 0;
                  const proportionalKg = totalSacks > 0 ? ((enteredSacks / totalSacks) * parseFloat(selectedUnifiedProc.quantity_kg || 0)).toFixed(2) : 0;
                  return (
                    <>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg mb-2">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          {totalSacks} total sacks / {parseFloat(selectedUnifiedProc.quantity_kg || 0).toLocaleString()} kg
                          {alreadyDrying > 0 && <span className="text-orange-600 dark:text-orange-400 ml-1">({alreadyDrying} already drying)</span>}
                          {' \u00b7 '}<strong>{remaining} sacks available</strong>
                        </p>
                      </div>
                      <FormInput
                        label={`Sacks to Dry (max ${remaining})`}
                        name="sacks"
                        type="number"
                        value={unifiedDryingStandaloneSacks}
                        onChange={(e) => {
                          const val = e.target.value;
                          setUnifiedDryingStandaloneSacks(val);
                          const num = parseInt(val);
                          if (num > remaining) {
                            setUnifiedDryingErrors(prev => ({ ...prev, sacks: [`Maximum is ${remaining} sacks.`] }));
                          } else {
                            setUnifiedDryingErrors(prev => { const n = {...prev}; delete n.sacks; return n; });
                          }
                        }}
                        required
                        placeholder={`1 - ${remaining}`}
                        submitted={submitted}
                        error={unifiedDryingErrors.sacks?.[0]}
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
                <FormInput label="Price (₱)" name="price" type="number" value={unifiedDryingPrice}
                  onChange={(e) => { setUnifiedDryingPrice(e.target.value); setUnifiedDryingErrors(prev => { const n = {...prev}; delete n.price; return n; }); }}
                  required placeholder="0.00" submitted={submitted}
                  error={unifiedDryingErrors.price?.[0]} step="0.01"
                />
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-primary-200 dark:border-primary-700 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-300">Days start at <strong>0</strong>. Use the <strong>+</strong> button in the Drying page to increment days. Total = (Sacks × Price) × Days.</p>
                </div>
              </>
            )}

            {/* Batch mode */}
            {unifiedDryingSource === 'batch' && (
              <>
                <div className="mb-3">
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Batch <span className="text-red-500">*</span></label>
                  <select name="batch_id" value={unifiedDryingBatchId} onChange={(e) => { const val = e.target.value; setUnifiedDryingBatchId(val); setUnifiedDryingBatchErrors(prev => { const n = {...prev}; delete n.batch_id; return n; }); setUnifiedDryingBatchPreview(null); if (val) { const b = batches.find(b => String(b.id) === val); if (b) setUnifiedDryingSacks(String(b.remaining_sacks)); } else { setUnifiedDryingSacks(''); } }}
                    className={`w-full px-4 py-2.5 text-sm border-2 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-4 transition-all ${
                      unifiedDryingBatchErrors.batch_id ? 'border-red-400 focus:ring-red-500/20' : 'border-gray-200 dark:border-gray-600 focus:ring-indigo-500/20 focus:border-indigo-400'
                    }`}
                  >
                    {dryingBatchOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  {unifiedDryingBatchErrors.batch_id && <p className="mt-1 text-xs text-red-500">{unifiedDryingBatchErrors.batch_id[0]}</p>}
                </div>

                {unifiedDryingBatchId && (() => {
                  const selBatch = batches.find(b => String(b.id) === unifiedDryingBatchId);
                  return selBatch ? (
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{selBatch.batch_number}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-300">
                        <div><span className="font-medium">Variety:</span> {selBatch.variety_name}</div>
                        <div><span className="font-medium">Available:</span> <span className="font-bold text-green-600 dark:text-green-400">{selBatch.remaining_sacks} sacks / {parseFloat(selBatch.remaining_kg).toLocaleString()} kg</span></div>
                      </div>
                    </div>
                  ) : null;
                })()}

                <FormInput
                  label="Sacks to Dry"
                  name="sacks"
                  type="number"
                  value={unifiedDryingSacks}
                  onChange={(e) => { setUnifiedDryingSacks(e.target.value); setUnifiedDryingBatchErrors(prev => { const n = {...prev}; delete n.sacks; return n; }); }}
                  required
                  placeholder="0"
                  submitted={submitted}
                  error={unifiedDryingBatchErrors.sacks?.[0]}
                />

                {loadingUnifiedBatchPreview && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-primary-200 dark:border-primary-700 rounded-lg mb-2 animate-pulse">
                    <p className="text-xs text-gray-400">Calculating distribution...</p>
                  </div>
                )}
                {unifiedDryingBatchPreview && !loadingUnifiedBatchPreview && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg mb-2">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1.5">Proportional distribution:</p>
                    <div className="space-y-1">
                      {unifiedDryingBatchPreview.breakdown?.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-700 dark:text-gray-200">
                          <span>Procurement #{String(item.procurement_id).padStart(4,'0')}</span>
                          <span>{item.sacks_taken} sacks → {parseFloat(item.quantity_kg).toLocaleString()} kg</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-green-200 dark:border-green-700 flex justify-between text-xs font-bold text-green-700 dark:text-green-300">
                      <span>Total</span>
                      <span>{unifiedDryingSacks} sacks → {parseFloat(unifiedDryingBatchPreview.total_kg || 0).toLocaleString()} kg</span>
                    </div>
                  </div>
                )}

                <FormInput
                  label="Drying Price (₱/sack)"
                  name="price"
                  type="number"
                  value={unifiedDryingPrice}
                  onChange={(e) => { setUnifiedDryingPrice(e.target.value); setUnifiedDryingBatchErrors(prev => { const n = {...prev}; delete n.price; return n; }); }}
                  required
                  placeholder="0.00"
                  submitted={submitted}
                  error={unifiedDryingBatchErrors.price?.[0]}
                  step="0.01"
                />

                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-primary-200 dark:border-primary-700 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-300">Days start at <strong>0</strong>. Use the <strong>+</strong> button in the Drying page to increment days. Total = (Sacks × Price) × Days.</p>
                </div>
              </>
            )}
          </>
        )}
      </FormModal>

      {/* Batch View Modal */}
      <Modal
        isOpen={isBatchViewOpen}
        onClose={() => setIsBatchViewOpen(false)}
        title={`Batch Details`}
        size="xl"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => handleToggleBatchStatus(selectedBatch)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedBatch?.status === 'Open'
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {selectedBatch?.status === 'Open' ? 'Close Batch' : 'Re-open Batch'}
            </button>
            <button
              onClick={() => setIsBatchViewOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedBatch && (
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              {/* Batch ID & Status */}
              <div className="bg-gradient-to-r from-indigo-50 to-button-50 dark:from-gray-700 dark:to-gray-700 p-3 rounded-lg border-2 border-indigo-200 dark:border-gray-600">
                <div className="flex items-start gap-2">
                  <div className="p-2 bg-indigo-500 dark:bg-indigo-600 text-white rounded-lg">
                    <Layers size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{selectedBatch.batch_number}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300">Batch Number</p>
                  </div>
                  <StatusBadge status={selectedBatch.status} />
                </div>
              </div>

              {/* Variety */}
              <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-primary-200 dark:border-primary-700">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                  <User size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Variety</p>
                  {selectedBatch.variety_name ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: selectedBatch.variety_color || '#6b7280' }}>
                      {selectedBatch.variety_name}
                    </span>
                  ) : <span className="text-gray-400">—</span>}
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-button-50 to-primary-50 dark:from-gray-700 dark:to-gray-700 rounded-lg border-2 border-button-200 dark:border-button-700">
                <div className="p-2 bg-button-500 dark:bg-button-600 text-white rounded-lg">
                  <DollarSign size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">Cost Breakdown</p>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Procurement</span>
                      <span className="text-sm font-semibold text-button-600 dark:text-button-400">₱{parseFloat(selectedBatch.total_cost || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Drying</span>
                      <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">₱{parseFloat(selectedBatch.total_drying_cost || 0).toLocaleString()}</span>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-1 flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Total Expenses</span>
                      <span className="text-lg font-bold text-purple-600 dark:text-purple-400">₱{(parseFloat(selectedBatch.total_cost || 0) + parseFloat(selectedBatch.total_drying_cost || 0)).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Date */}
              <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-primary-200 dark:border-primary-700">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                  <Calendar size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Date Created</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                    {selectedBatch.created_at ? new Date(selectedBatch.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                  {selectedBatch.created_at && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(selectedBatch.created_at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedBatch.notes && (
                <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-primary-200 dark:border-primary-700">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg">
                    <FileText size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">Notes</p>
                    <p className="text-gray-800 dark:text-gray-100 text-sm">{selectedBatch.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Boxes size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300">Total Sacks</p>
                    <p className="font-bold text-blue-600 dark:text-blue-400 text-lg">{selectedBatch.total_sacks}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                    <Scale size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300">Total Kg</p>
                    <p className="font-bold text-green-600 dark:text-green-400 text-lg">{parseFloat(selectedBatch.total_kg).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
                    <Boxes size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300">Sacks Left</p>
                    <p className="font-bold text-orange-600 dark:text-orange-400 text-lg">{selectedBatch.remaining_sacks}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                    <Package size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300">Items</p>
                    <p className="font-bold text-purple-600 dark:text-purple-400 text-lg">{selectedBatch.procurements_count || procurements.filter(p => String(p.batch_id) === String(selectedBatch.id)).length}</p>
                  </div>
                </div>
              </div>

              {/* Procurements in Batch */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-primary-200 dark:border-primary-700">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Procurements in this Batch</p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {procurements.filter(p => String(p.batch_id) === String(selectedBatch.id)).length > 0 ? (
                    procurements.filter(p => String(p.batch_id) === String(selectedBatch.id)).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 border border-primary-200 dark:border-primary-700 rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-600 dark:text-gray-300">#{String(p.id).padStart(4, '0')}</span>
                          <span className="text-gray-700 dark:text-gray-200">{p.supplier_name}</span>
                          <StatusBadge status={p.status} />
                        </div>
                        <div className="text-right text-xs">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{p.sacks} sacks</span>
                          <span className="text-gray-400 mx-1">•</span>
                          <span className="text-green-600 dark:text-green-400 font-medium">{parseFloat(p.quantity_kg).toLocaleString()} kg</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-2">No procurements in this batch yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Procurement;
