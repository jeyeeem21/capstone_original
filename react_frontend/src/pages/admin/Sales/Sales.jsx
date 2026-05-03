import { useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingUp, DollarSign, ShoppingBag, FileText, CheckCircle, XCircle, Ban, RotateCcw, Receipt, Brain, User, Calendar, CreditCard, MapPin, Package, Truck, Store, StickyNote, X, Banknote, Loader2, Camera, ImageIcon } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatusBadge, StatsCard, LineChart, DonutChart, FormModal, Modal, useToast, SkeletonStats, SkeletonTable } from '../../../components/ui';
import { apiClient } from '../../../api';
import { resolveStorageUrl } from '../../../api/config';
import useDataFetch, { invalidateCache } from '../../../hooks/useDataFetch';
import { suppressNotifToasts } from '../../../utils/notifToastGuard';
import { useBusinessSettings } from '../../../context/BusinessSettingsContext';
import PredictiveAnalytics from './PredictiveAnalytics';

const Sales = () => {
  const toast = useToast();
  const { settings: bizSettings } = useBusinessSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-based tab state — persists on reload and is shareable as a link
  const activeView = searchParams.get('view') || 'overview'; // 'overview' | 'predictions'
  const activeStatusTab = searchParams.get('tab') || 'All';  // 'All' | status values

  const setActiveView = useCallback((view) => {
    setSearchParams(prev => { prev.set('view', view); return prev; }, { replace: true });
  }, [setSearchParams]);

  const setActiveStatusTab = useCallback((tab) => {
    setSearchParams(prev => { prev.set('tab', tab); return prev; }, { replace: true });
  }, [setSearchParams]);

  const [chartPeriod, setChartPeriod] = useState('daily');
  const [activeChartPoint, setActiveChartPoint] = useState(null);
  const [chartScopeActive, setChartScopeActive] = useState(false);
  // Chart calendar filter state
  const [chartMonth, setChartMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [chartYear, setChartYear] = useState(() => new Date().getFullYear());
  const [chartYearFrom, setChartYearFrom] = useState(() => new Date().getFullYear() - 4);
  const [chartYearTo, setChartYearTo] = useState(() => new Date().getFullYear());
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [previewProofImage, setPreviewProofImage] = useState(null);
  // Record Payment modal state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payOrder, setPayOrder] = useState(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [payCashTendered, setPayCashTendered] = useState('');
  const [payGcashRef, setPayGcashRef] = useState('');
  const [payGcashRefError, setPayGcashRefError] = useState('');
  const payGcashRefCheckTimeout = useRef(null);
  const [payProofFiles, setPayProofFiles] = useState([]);
  const [payProofPreviews, setPayProofPreviews] = useState([]);
  const [payShowCamera, setPayShowCamera] = useState(false);
  const payVideoRef = useRef(null);
  const payStreamRef = useRef(null);
  const payProofInputRef = useRef(null);
  const [savingPay, setSavingPay] = useState(false);
  const [payStatusFilter, setPayStatusFilter] = useState(''); // '' | 'paid' | 'not_paid'
  const [payMethodFilter, setPayMethodFilter] = useState(''); // '' | 'cash' | 'gcash' | 'cod' | 'pay_later'

  // Fetch all sales/orders from API
  const {
    data: salesRaw,
    loading,
    refetch,
  } = useDataFetch('/sales', {
    cacheKey: '/sales',
    initialData: [],
  });

  // Map and filter — show only delivered, returned, cancelled, voided (completed transactions)
  const sales = useMemo(() =>
    (salesRaw || [])
      .filter(s => ['delivered', 'returned', 'cancelled', 'voided', 'completed'].includes(s.status))
      .map(s => ({
        ...s,
        invoice: s.transaction_id,
        customer: s.customer_name || 'Walk-in',
        items_count: s.items_count || 0,
        total_quantity: s.total_quantity || 0,
        total: s.total || 0,
        total_cost: s.total_cost || 0,
        total_profit: s.total_profit || 0,
        profit_margin: s.profit_margin || 0,
        payment: s.payment_method === 'cod' ? 'COD' : s.payment_method === 'gcash' ? 'GCash' : s.payment_method === 'pay_later' ? 'Pay Later' : 'Cash',
        raw_payment_method: s.payment_method,
        payment_status: s.payment_status || 'paid',
        status_display: formatStatus(s.status),
        date: s.created_at,
        date_formatted: s.date_formatted,
        is_delivery: !!(s.delivery_address),
      })),
    [salesRaw]
  );

  function formatStatus(status) {
    const map = {
      'delivered': 'Delivered',
      'completed': 'Completed',
      'returned': 'Returned',
      'cancelled': 'Cancelled',
      'voided': 'Voided',
    };
    return map[status] || status;
  }

  const statusTabs = [
    { value: 'All', label: 'All', icon: FileText, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-700', activeBg: 'bg-button-500', activeText: 'text-white' },
    { value: 'Delivered', label: 'Delivered', icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', activeBg: 'bg-green-500', activeText: 'text-white' },
    { value: 'Completed', label: 'Completed', icon: Store, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', activeBg: 'bg-emerald-500', activeText: 'text-white' },
    { value: 'Returned', label: 'Returned', icon: RotateCcw, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', activeBg: 'bg-orange-500', activeText: 'text-white' },
    { value: 'Cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', activeBg: 'bg-red-500', activeText: 'text-white' },
    { value: 'Voided', label: 'Voided', icon: Ban, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-700', activeBg: 'bg-gray-50 dark:bg-gray-700/500', activeText: 'text-white' },
  ];

  const SALES_STATUS_SORT = { 'Completed': 0, 'Delivered': 1, 'Voided': 2, 'Cancelled': 3, 'Returned': 4 };

  const filteredSalesByTab = useMemo(() => {
    if (activeStatusTab === 'All') {
      return [...sales].sort((a, b) => (SALES_STATUS_SORT[a.status_display] ?? 99) - (SALES_STATUS_SORT[b.status_display] ?? 99));
    }
    return sales.filter(s => s.status_display === activeStatusTab);
  }, [sales, activeStatusTab]);

  // Record Payment handlers
  const stopPayCamera = useCallback(() => {
    if (payStreamRef.current) {
      payStreamRef.current.getTracks().forEach(t => t.stop());
      payStreamRef.current = null;
    }
    setPayShowCamera(false);
  }, []);

  const startPayCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      payStreamRef.current = stream;
      setPayShowCamera(true);
      setTimeout(() => { if (payVideoRef.current) payVideoRef.current.srcObject = stream; }, 100);
    } catch {
      toast.error('Camera Error', 'Could not access camera.');
    }
  }, [toast]);

  const capturePayPhoto = useCallback(() => {
    if (!payVideoRef.current) return;
    const video = payVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `pay_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPayProofFiles(prev => [...prev, file]);
      setPayProofPreviews(prev => [...prev, URL.createObjectURL(blob)]);
      stopPayCamera();
    }, 'image/jpeg', 0.85);
  }, [stopPayCamera]);

  const handlePayProofUpload = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPayProofFiles(prev => [...prev, ...files]);
    setPayProofPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  }, []);

  const removePayProof = useCallback((idx) => {
    setPayProofFiles(prev => prev.filter((_, i) => i !== idx));
    setPayProofPreviews(prev => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const checkPayGcashReference = useCallback((ref) => {
    const digits = ref.replace(/\s/g, '');
    if (digits.length !== 13) return;
    if (payGcashRefCheckTimeout.current) clearTimeout(payGcashRefCheckTimeout.current);
    payGcashRefCheckTimeout.current = setTimeout(async () => {
      try {
        const response = await apiClient.post('/sales/check-reference', { reference_number: digits });
        if (response.data && !response.data.available) {
          setPayGcashRefError('This reference number has already been used.');
        } else {
          setPayGcashRefError('');
        }
      } catch { /* silent */ }
    }, 500);
  }, []);

  const handleOpenPayModal = useCallback((sale) => {
    setPayOrder(sale);
    setPayMethod('cash');
    setPayCashTendered('');
    setPayGcashRef('');
    setPayGcashRefError('');
    setPayProofFiles([]);
    setPayProofPreviews([]);
    setPayShowCamera(false);
    setIsPayModalOpen(true);
  }, []);

  const handleConfirmPay = useCallback(async () => {
    if (savingPay || !payOrder) return;
    if (payMethod === 'cash' && (!payCashTendered || parseFloat(payCashTendered) < payOrder.total)) return;
    if (payMethod === 'gcash' && (!payGcashRef.trim() || payGcashRef.replace(/\s/g, '').length !== 13 || payGcashRefError)) return;

    setSavingPay(true);
    try {
      const formData = new FormData();
      formData.append('payment_method', payMethod);
      if (payMethod === 'cash') formData.append('amount_tendered', parseFloat(payCashTendered));
      if (payMethod === 'gcash' && payGcashRef) formData.append('reference_number', payGcashRef);
      payProofFiles.forEach(file => formData.append('payment_proof[]', file));

      const response = await apiClient.post(`/sales/${payOrder.id}/pay`, formData);
      if (response.success) {
        invalidateCache('/sales');
        refetch();
        suppressNotifToasts();
        toast.success('Payment Recorded', `Order ${payOrder.invoice} has been marked as paid.`);
        // Fire-and-forget email
        apiClient.post(`/sales/${payOrder.id}/payment-email`).catch(() => {});
        setIsPayModalOpen(false);
        setPayOrder(null);
        stopPayCamera();
      } else {
        throw response;
      }
    } catch (error) {
      toast.error('Payment Failed', error.message || 'Failed to record payment');
    } finally {
      setSavingPay(false);
    }
  }, [savingPay, payOrder, payMethod, payCashTendered, payGcashRef, payProofFiles, refetch, toast, stopPayCamera]);

  const handleView = useCallback((sale) => {
    setSelectedSale(sale);
    setIsViewModalOpen(true);
  }, []);

  // Stats from real data
  const deliveredSales = sales.filter(s => s.status === 'delivered' || s.status === 'completed');

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

  // Helper: checks if a sale matches the active chart point filter
  const matchesChartPoint = useCallback((s) => {
    if (!activeChartPoint || !s.date) return true;
    const date = new Date(s.date);
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

  // Helper: check if a sale date falls within the current chart scope
  const isInChartScope = useCallback((s) => {
    if (!s.date) return false;
    const date = new Date(s.date);
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

  // Chart-filtered sales — scoped by calendar + dot
  const chartFilteredSales = useMemo(() => {
    if (!chartScopeActive && !activeChartPoint) return sales;
    const scoped = sales.filter(isInChartScope);
    if (!activeChartPoint) return scoped;
    return scoped.filter(matchesChartPoint);
  }, [sales, isInChartScope, activeChartPoint, matchesChartPoint, chartScopeActive]);

  const chartFilteredSalesByTab = useMemo(() => {
    let result = activeStatusTab === 'All'
      ? [...chartFilteredSales].sort((a, b) => (SALES_STATUS_SORT[a.status_display] ?? 99) - (SALES_STATUS_SORT[b.status_display] ?? 99))
      : chartFilteredSales.filter(s => s.status_display === activeStatusTab);
    if (payStatusFilter) result = result.filter(s => (s.payment_status || 'paid') === payStatusFilter);
    if (payMethodFilter) result = result.filter(s => s.raw_payment_method === payMethodFilter);
    return result;
  }, [chartFilteredSales, activeStatusTab, payStatusFilter, payMethodFilter]);

  const chartFilteredDelivered = useMemo(() => chartFilteredSales.filter(s => s.status === 'delivered' || s.status === 'completed'), [chartFilteredSales]);

  // Chart data
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (chartPeriod === 'daily') {
      const [y, m] = chartMonth.split('-').map(Number);
      const daysInMonth = getDaysInMonth(y, m - 1);
      const dayGroups = {};
      deliveredSales.forEach(s => {
        const date = new Date(s.date);
        if (date.getFullYear() === y && date.getMonth() === m - 1) {
          const day = date.getDate();
          if (!dayGroups[day]) dayGroups[day] = 0;
          dayGroups[day] += s.total;
        }
      });
      return Array.from({ length: daysInMonth }, (_, i) => ({
        name: String(i + 1),
        sales: dayGroups[i + 1] || 0,
      }));
    }
    if (chartPeriod === 'weekly') {
      const [y, m] = chartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      return weeks.map(week => {
        let sales = 0;
        deliveredSales.forEach(s => {
          if (!s.date) return;
          const date = new Date(s.date);
          if (date >= week.start && date <= new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59)) {
            sales += s.total;
          }
        });
        return { name: week.label, sales };
      });
    }
    if (chartPeriod === 'monthly') {
      const monthGroups = {};
      deliveredSales.forEach(s => {
        const date = new Date(s.date);
        if (date.getFullYear() === chartYear) {
          const month = date.getMonth();
          if (!monthGroups[month]) monthGroups[month] = 0;
          monthGroups[month] += s.total;
        }
      });
      return months.map((name, i) => ({ name, sales: monthGroups[i] || 0 }));
    }
    if (chartPeriod === 'bi-annually') {
      const h1 = { sales: 0 }, h2 = { sales: 0 };
      deliveredSales.forEach(s => {
        if (!s.date) return;
        const date = new Date(s.date);
        if (date.getFullYear() === chartYear) {
          (date.getMonth() < 6 ? h1 : h2).sales += s.total;
        }
      });
      return [
        { name: 'H1', fullName: `Jan - Jun ${chartYear}`, sales: h1.sales },
        { name: 'H2', fullName: `Jul - Dec ${chartYear}`, sales: h2.sales },
      ];
    }
    // annually
    const years = [];
    for (let y = chartYearFrom; y <= chartYearTo; y++) years.push(y);
    const yearGroups = {};
    deliveredSales.forEach(s => {
      if (!s.date) return;
      const date = new Date(s.date);
      const year = date.getFullYear();
      if (year >= chartYearFrom && year <= chartYearTo) {
        if (!yearGroups[year]) yearGroups[year] = 0;
        yearGroups[year] += s.total;
      }
    });
    return years.map(year => ({ name: year.toString(), sales: yearGroups[year] || 0 }));
  }, [deliveredSales, chartPeriod, chartMonth, chartYear, chartYearFrom, chartYearTo, getWeeksInMonth]);

  const avgPerDay = useMemo(() => {
    const now = new Date();
    const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth());
    const monthSales = deliveredSales.filter(s => {
      const date = new Date(s.date);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }).reduce((sum, s) => sum + s.total, 0);
    return Math.floor(monthSales / daysInMonth);
  }, [deliveredSales]);

  const statusBreakdown = useMemo(() => [
    { name: 'Delivered', value: chartFilteredDelivered.length, color: '#22c55e' },
    { name: 'Returned', value: chartFilteredSales.filter(s => s.status === 'returned').length, color: '#f97316' },
    { name: 'Cancelled', value: chartFilteredSales.filter(s => s.status === 'cancelled').length, color: '#ef4444' },
    { name: 'Voided', value: chartFilteredSales.filter(s => s.status === 'voided').length, color: '#6b7280' },
  ], [chartFilteredSales, chartFilteredDelivered]);

  const paymentBreakdown = useMemo(() => {
    const groups = {};
    const colors = { 'Cash': '#22c55e', 'GCash': '#3b82f6', 'COD': '#f59e0b' };
    chartFilteredDelivered.forEach(s => {
      if (!groups[s.payment]) groups[s.payment] = 0;
      groups[s.payment]++;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value, color: colors[name] || '#6b7280' }));
  }, [chartFilteredDelivered]);

  const columns = [
    { header: 'Transaction', accessor: 'invoice' },
    { header: 'Customer', accessor: 'customer' },
    { header: 'Products', accessor: 'products_summary', cell: (row) => {
      const items = row.items || [];
      if (items.length === 0) return <span className="text-gray-400 text-xs">No items</span>;
      return (
        <div className="flex flex-col gap-0.5 max-w-[220px]">
          {items.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.variety_color || '#6B7280' }} />
              <span className="text-gray-700 dark:text-gray-200 truncate">
                {item.product_name}{item.weight_formatted ? ` (${item.weight_formatted})` : ''}
              </span>
              <span className="text-gray-400 shrink-0">×{item.quantity}</span>
            </div>
          ))}
          {items.length > 3 && (
            <span className="text-[10px] text-gray-400 italic">+{items.length - 3} more</span>
          )}
        </div>
      );
    }},
    { header: 'Amount', accessor: 'total', cell: (row) => `₱${row.total.toLocaleString()}` },
    { header: 'Payment', accessor: 'payment', cell: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs">{row.payment}</span>
        {row.payment_status === 'not_paid' && (
          <div className="flex items-center gap-1">
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">Not Paid</span>
            <button
              onClick={(e) => { e.stopPropagation(); handleOpenPayModal(row); }}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-button-50 dark:bg-button-900/20 text-button-600 dark:text-button-400 hover:bg-button-100 dark:hover:bg-button-900/30 transition-colors"
              title="Record Payment"
            >
              <Banknote size={10} /> Pay
            </button>
          </div>
        )}
      </div>
    )},
    { header: 'Type', accessor: 'is_delivery', cell: (row) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${
        row.is_delivery
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
          : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
      }`}>
        {row.is_delivery ? <Truck size={10} /> : <Store size={10} />}
        {row.is_delivery ? 'Delivery' : 'Pick Up'}
      </span>
    )},
    { header: 'Date', accessor: 'date', cell: (row) => row.date_formatted },
    { header: 'Status', accessor: 'status_display', cell: (row) => <StatusBadge status={row.status_display} /> },
  ];

  return (
    <div>
      <PageHeader title="Sales" description="Revenue analytics and completed transactions" icon={TrendingUp} />

      {/* View Toggle: Overview vs Predictions */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setActiveView('overview')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${
            activeView === 'overview'
              ? 'border-button-500 bg-button-500 text-white shadow-md'
              : 'border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-gray-700'
          }`}
        >
          <TrendingUp size={14} />
          Sales Overview
        </button>
        <button
          onClick={() => setActiveView('predictions')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${
            activeView === 'predictions'
              ? 'border-button-500 bg-button-500 text-white shadow-md'
              : 'border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-gray-700'
          }`}
        >
          <Brain size={14} />
          Predictive Analysis
        </button>
      </div>

      {activeView === 'predictions' ? (
        <PredictiveAnalytics />
      ) : (
      <>
      {/* Stats Cards */}
      {loading ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Revenue" value={`₱${chartFilteredDelivered.reduce((sum, s) => sum + s.total, 0).toLocaleString()}`} unit="from delivered orders" icon={DollarSign} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          {(() => {
            const totalProfit = chartFilteredDelivered.reduce((sum, s) => sum + (s.total_profit || 0), 0);
            const totalRevenue = chartFilteredDelivered.reduce((sum, s) => sum + s.total, 0);
            const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;
            return <StatsCard label="Total Profit" value={`₱${totalProfit.toLocaleString()}`} unit={`${margin}% margin`} icon={TrendingUp} iconBgColor={totalProfit >= 0 ? "bg-gradient-to-br from-green-400 to-green-600" : "bg-gradient-to-br from-red-400 to-red-600"} />;
          })()}
          <StatsCard label="Transactions" value={chartFilteredDelivered.length} unit="completed" icon={Receipt} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200 dark:border-primary-700 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Payment Status</p>
              <div className="p-2 rounded-xl bg-gradient-to-br from-button-400 to-button-600 text-white">
                <CreditCard size={16} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center p-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{chartFilteredSales.filter(s => (s.payment_status || 'paid') === 'paid').length}</p>
                <p className="text-[10px] font-medium text-green-500 dark:text-green-500 uppercase tracking-wide">Paid</p>
              </div>
              <div className="flex-1 text-center p-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{chartFilteredSales.filter(s => s.payment_status === 'not_paid').length}</p>
                <p className="text-[10px] font-medium text-red-500 dark:text-red-500 uppercase tracking-wide">Not Paid</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2">
            <LineChart
              title="Sales Trends"
              subtitle={(() => {
                const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                if (!chartScopeActive && !activeChartPoint) return 'Revenue from delivered orders';
                let scope = '';
                if (chartPeriod === 'daily' || chartPeriod === 'weekly') { const [y,m] = chartMonth.split('-').map(Number); scope = `${months[m-1]} ${y}`; }
                else if (chartPeriod === 'monthly' || chartPeriod === 'bi-annually') scope = String(chartYear);
                else if (chartPeriod === 'annually') scope = `${chartYearFrom}–${chartYearTo}`;
                const mode = chartPeriod.charAt(0).toUpperCase() + chartPeriod.slice(1);
                if (activeChartPoint) return `${activeChartPoint} · ${scope}`;
                return `${mode} · ${scope}`;
              })()}
              data={chartData}
              lines={[{ dataKey: 'sales', name: 'Sales (₱)' }]}
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
              onDotClick={(point) => { setActiveChartPoint(point); setChartScopeActive(true); }}
              activePoint={activeChartPoint}
              summaryStats={[
                { label: 'Total Revenue', value: `₱${chartFilteredDelivered.reduce((sum, s) => sum + s.total, 0).toLocaleString()}`, color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Avg per Day', value: `₱${avgPerDay.toLocaleString()}`, color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Orders', value: chartFilteredDelivered.length.toString(), color: 'text-green-600 dark:text-green-400' },
              ]}
            />
          </div>
          <div className="space-y-4">
            <DonutChart title="Transaction Status" subtitle="Breakdown by outcome" data={statusBreakdown} centerValue={chartFilteredSales.length} centerLabel="Total" height={175} innerRadius={56} outerRadius={78} valueUnit="" horizontalLegend={true} compactLegend={true} />
            <DonutChart title="Payment Method" subtitle="Revenue by payment type" data={paymentBreakdown} centerValue={chartFilteredDelivered.length} centerLabel="Sales" height={140} innerRadius={45} outerRadius={62} valueUnit="" horizontalLegend={true} />
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={8} columns={7} />
      ) : (
        <>
          {/* Status Tabs */}
          <div className="bg-white dark:bg-gray-700 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 mb-0 rounded-b-none border-b-0">
            <div className="px-4 pt-4 pb-0">
              <div className="flex items-center gap-1 overflow-x-auto pb-0 scrollbar-hide">
                {statusTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeStatusTab === tab.value;
                  const count = tab.value === 'All' ? sales.length : sales.filter(s => s.status_display === tab.value).length;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setActiveStatusTab(tab.value)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-xs font-semibold transition-all whitespace-nowrap border-2 border-b-0 ${
                        isActive
                          ? `${tab.activeBg} ${tab.activeText} border-transparent shadow-md`
                          : `${tab.bg} ${tab.color} border-transparent hover:shadow-sm`
                      }`}
                    >
                      <Icon size={14} />
                      {tab.label}
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white/80 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DataTable
            title="Sales Records"
            subtitle={activeStatusTab === 'All' ? 'All completed transactions' : `Showing ${activeStatusTab.toLowerCase()} transactions`}
            columns={columns}
            data={chartFilteredSalesByTab}
            searchPlaceholder="Search sales..."
            dateFilterField="date"
            onRowDoubleClick={handleView}
            headerRight={
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={payStatusFilter}
                  onChange={e => setPayStatusFilter(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-lg border border-primary-200 dark:border-primary-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-button-500"
                >
                  <option value="">All Payment Status</option>
                  <option value="paid">Paid</option>
                  <option value="not_paid">Not Paid</option>
                </select>
                <select
                  value={payMethodFilter}
                  onChange={e => setPayMethodFilter(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-lg border border-primary-200 dark:border-primary-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-button-500"
                >
                  <option value="">All Payment Methods</option>
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="cod">COD</option>
                  <option value="pay_later">Pay Later</option>
                </select>
              </div>
            }
          />
        </>
      )}
      </>
      )}

      {/* View Sale Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Transaction Details — ${selectedSale?.invoice || ''}`}
        size="2xl"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedSale && (
          <div className="space-y-3">
            {/* Header with Invoice & Status */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary-50 dark:from-gray-700 to-button-50 dark:to-gray-700 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <div className="flex items-start gap-2">
                <div className="p-2 bg-button-500 text-white rounded-lg">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{selectedSale.invoice}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selectedSale.date_formatted}</p>
                </div>
              </div>
              <StatusBadge status={selectedSale.status_display} />
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Customer */}
              <div className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <User size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Customer</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5 truncate">{selectedSale.customer}</p>
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className={`p-1.5 rounded-lg ${selectedSale.payment_status === 'not_paid' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                  <CreditCard size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Payment</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5">{selectedSale.payment}</p>
                  {selectedSale.reference_number && (
                    <p className="text-xs text-gray-400 truncate">Ref: {selectedSale.reference_number}</p>
                  )}
                  {selectedSale.payment_status === 'not_paid' ? (
                    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 mt-0.5">Not Paid</span>
                  ) : selectedSale.paid_at_formatted && (
                    <p className="text-[10px] text-gray-400 mt-0.5">Paid: {selectedSale.paid_at_formatted}</p>
                  )}
                </div>
              </div>

              {/* Items Count */}
              <div className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="p-1.5 rounded-lg bg-button-100 dark:bg-button-900/30 text-button-600 dark:text-button-400">
                  <Package size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Items</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5">{selectedSale.items_count} item{selectedSale.items_count > 1 ? 's' : ''} ({selectedSale.total_quantity} pcs)</p>
                </div>
              </div>

              {/* Date */}
              <div className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                  <Calendar size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Transaction Date</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5">{selectedSale.date_formatted}</p>
                </div>
              </div>

              {/* Order Type */}
              <div className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className={`p-1.5 rounded-lg ${selectedSale.is_delivery ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                  {selectedSale.is_delivery ? <Truck size={14} /> : <Store size={14} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type</p>
                  <p className={`text-sm font-semibold mt-0.5 ${selectedSale.is_delivery ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {selectedSale.is_delivery ? 'Delivery' : 'Pick Up'}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Proof Images */}
            {selectedSale.payment_proof?.length > 0 && (
              <div className="bg-button-50 dark:bg-button-900/20 rounded-xl p-3 border border-button-200 dark:border-button-700">
                <p className="text-xs font-bold text-button-600 dark:text-button-400 uppercase tracking-wide mb-2">Payment Proof</p>
                <div className="flex flex-wrap gap-2">
                  {selectedSale.payment_proof.map((url, idx) => (
                    <img
                      key={idx}
                      src={resolveStorageUrl(url)}
                      alt={`Payment proof ${idx + 1}`}
                      className="w-[80px] h-[80px] object-cover rounded-lg border border-button-200 dark:border-button-700 cursor-pointer hover:opacity-80"
                      onClick={() => setPreviewProofImage(resolveStorageUrl(url))}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Delivery Address */}
            {selectedSale.delivery_address && (
              <div className="flex items-start gap-2 p-2.5 bg-button-50 dark:bg-button-900/20 rounded-xl border border-button-200 dark:border-button-700">
                <div className="p-1.5 rounded-lg bg-button-100 dark:bg-button-900/30 text-button-600 dark:text-button-400">
                  <MapPin size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-button-600 dark:text-button-400 uppercase tracking-wide">Delivery Address</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5">{selectedSale.delivery_address}</p>
                  {selectedSale.distance_km && (
                    <p className="text-xs text-button-500 mt-0.5">{parseFloat(selectedSale.distance_km).toFixed(1)} km from warehouse</p>
                  )}
                </div>
              </div>
            )}

            {/* Assigned Driver */}
            {selectedSale.driver_name && (
              <div className="flex items-center gap-3 p-2.5 bg-button-50 dark:bg-button-900/20 rounded-xl border border-button-200 dark:border-button-700">
                <div className="w-9 h-9 bg-button-200 rounded-full flex items-center justify-center">
                  <User size={16} className="text-button-600 dark:text-button-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-button-600 dark:text-button-400 uppercase tracking-wide">Assigned Driver</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{selectedSale.driver_name}</p>
                </div>
                {selectedSale.driver_plate_number && (
                  <span className="text-xs font-bold text-button-600 dark:text-button-400 bg-button-100 dark:bg-button-900/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                    <Truck size={10} /> {selectedSale.driver_plate_number}
                  </span>
                )}
              </div>
            )}

            {/* Delivery Proof Images */}
            {selectedSale.delivery_proof?.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-700">
                <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide mb-2">Proof of Delivery</p>
                <div className="flex flex-wrap gap-2">
                  {selectedSale.delivery_proof.map((url, idx) => (
                    <img
                      key={idx}
                      src={resolveStorageUrl(url)}
                      alt={`Delivery proof ${idx + 1}`}
                      className="w-[80px] h-[80px] object-cover rounded-lg border border-green-200 dark:border-green-700 cursor-pointer hover:opacity-80"
                      onClick={() => setPreviewProofImage(resolveStorageUrl(url))}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedSale.notes && selectedSale.status !== 'voided' && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700">
                <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  <StickyNote size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Transaction Notes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 mt-0.5">{selectedSale.notes}</p>
                </div>
              </div>
            )}

            {/* Void Info */}
            {selectedSale.status === 'voided' && (
              <div className="flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-700">
                <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  <Ban size={14} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Void Information</p>
                  {selectedSale.notes && (
                    <p className="text-sm text-gray-700 dark:text-gray-200"><span className="font-semibold">Reason:</span> {selectedSale.notes}</p>
                  )}
                  {selectedSale.voided_by && (
                    <p className="text-xs text-gray-500 dark:text-gray-400"><span className="font-medium">Voided by:</span> {selectedSale.voided_by}</p>
                  )}
                  {selectedSale.authorized_by && selectedSale.authorized_by !== selectedSale.voided_by && (
                    <p className="text-xs text-gray-500 dark:text-gray-400"><span className="font-medium">Authorized by:</span> {selectedSale.authorized_by}</p>
                  )}
                </div>
              </div>
            )}

            {/* Return Info */}
            {selectedSale.return_reason && (
              <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-700">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                    <RotateCcw size={14} />
                  </div>
                  <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Return Information</p>
                </div>
                <p className="text-sm font-semibold text-orange-800">{selectedSale.return_reason}</p>
                {selectedSale.return_notes && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 italic">{selectedSale.return_notes}</p>
                )}
                {selectedSale.return_proof?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">Proof {selectedSale.return_proof.length > 1 ? 'Images' : 'Image'}</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSale.return_proof.map((url, idx) => (
                        <img
                          key={idx}
                          src={resolveStorageUrl(url)}
                          alt={`Return proof ${idx + 1}`}
                          className="w-[120px] h-[120px] object-cover rounded-lg border border-orange-200 dark:border-orange-700 cursor-pointer hover:opacity-80"
                          onClick={() => setPreviewProofImage(resolveStorageUrl(url))}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {selectedSale.return_pickup_driver && (
                  <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-700 space-y-1">
                    <div className="flex items-center gap-2">
                      <Truck size={12} className="text-orange-500" />
                      <span className="text-xs text-orange-700 dark:text-orange-300">
                        <span className="font-semibold">Pickup Driver:</span> {selectedSale.return_pickup_driver}
                        {selectedSale.return_pickup_plate && ` — ${selectedSale.return_pickup_plate}`}
                      </span>
                    </div>
                    {selectedSale.return_pickup_date_formatted && (
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-orange-500" />
                        <span className="text-xs text-orange-700 dark:text-orange-300">
                          <span className="font-semibold">Est. Pickup:</span> {selectedSale.return_pickup_date_formatted}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Items Table */}
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Transaction Items</p>
              <div className="rounded-xl border-2 border-primary-200 dark:border-primary-700 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary-50 dark:bg-primary-900/20">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Product</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Qty</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Price</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Cost</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {(selectedSale.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700/50">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.variety_color || '#6B7280' }} />
                            <span className="text-gray-800 dark:text-gray-100 text-xs font-medium">{item.product_name || item.name}{item.weight_formatted ? ` (${item.weight_formatted})` : ''}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-300 text-xs">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300 text-xs">₱{(item.subtotal || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400">
                          {(item.total_cost || 0) > 0 ? `₱${item.total_cost.toLocaleString()}` : <span className="text-gray-400">N/A</span>}
                        </td>
                        <td className={`px-3 py-2 text-right text-xs font-semibold ${(item.profit || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {(item.total_cost || 0) > 0 ? `${item.profit >= 0 ? '+' : ''}₱${item.profit.toLocaleString()}` : <span className="text-gray-400 font-normal">N/A</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                    {selectedSale.delivery_fee > 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-gray-500 dark:text-gray-400">Delivery Fee</td>
                        <td className="px-3 py-1.5 text-right text-xs text-gray-600 dark:text-gray-300">₱{selectedSale.delivery_fee.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedSale.discount > 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-gray-500 dark:text-gray-400">Discount</td>
                        <td className="px-3 py-1.5 text-right text-xs text-red-500">-₱{selectedSale.discount.toLocaleString()}</td>
                      </tr>
                    )}
                    <tr className="border-t border-gray-200 dark:border-gray-600">
                      <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-gray-600 dark:text-gray-300">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800 dark:text-gray-100">₱{selectedSale.total.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Total Summary Card with Profit */}
            <div className="p-3 bg-button-50 dark:bg-gray-700 rounded-xl border border-button-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-button-700 dark:text-button-300">Order Total</span>
                <span className="text-xl font-bold text-button-600 dark:text-button-400">₱{selectedSale.total.toLocaleString()}</span>
              </div>
              {(selectedSale.delivery_fee > 0 || selectedSale.discount > 0) && (
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>Subtotal: ₱{selectedSale.subtotal?.toLocaleString() || selectedSale.total.toLocaleString()}</span>
                  {selectedSale.delivery_fee > 0 && <span>+ ₱{selectedSale.delivery_fee.toLocaleString()} delivery</span>}
                  {selectedSale.discount > 0 && <span>- ₱{selectedSale.discount.toLocaleString()} discount</span>}
                </div>
              )}
              {(selectedSale.total_cost || 0) > 0 && (
                <div className="mt-2 pt-2 border-t border-button-200 dark:border-gray-600">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Cost</p>
                      <p className="text-sm font-bold text-orange-600 dark:text-orange-400">₱{selectedSale.total_cost.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Profit</p>
                      <p className={`text-sm font-bold ${selectedSale.total_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {selectedSale.total_profit >= 0 ? '+' : ''}₱{selectedSale.total_profit.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Margin</p>
                      <p className={`text-sm font-bold ${selectedSale.profit_margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {selectedSale.profit_margin}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      {isPayModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => { setIsPayModalOpen(false); setPayOrder(null); stopPayCamera(); }} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full overflow-hidden border-2 border-primary-200 dark:border-primary-700 ${payMethod === 'gcash' && (bizSettings.gcash_qr || bizSettings.gcash_name || bizSettings.gcash_number) ? 'max-w-3xl' : 'max-w-md'}`}>
              {/* Header */}
              <div className={`p-5 text-white shrink-0 ${payMethod === 'cash' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'}`}>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  {payMethod === 'cash' ? <DollarSign size={20} /> : <CreditCard size={20} />}
                  {payMethod === 'cash' ? 'Cash Payment' : 'GCash Payment'}
                </h3>
                <p className="text-sm text-white/80 mt-1">
                  {payMethod === 'cash' ? 'Enter amount tendered by customer' : 'Enter GCash reference number'}
                </p>
              </div>

              <div className={`${payMethod === 'gcash' && (bizSettings.gcash_qr || bizSettings.gcash_name || bizSettings.gcash_number) ? 'flex' : ''}`}>
              {/* Left side: form content */}
              <div className="flex-1 min-w-0">
              <div className="p-5 space-y-4">
                {payOrder && (
                  <>
                    {/* Order Summary */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <div>
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{payOrder.invoice}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{payOrder.customer}</p>
                        </div>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                        <span className="font-bold text-gray-800 dark:text-gray-100">Total Due</span>
                        <span className="text-xl font-bold text-primary-600 dark:text-primary-400">₱{payOrder.total.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Payment Method Selection */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">Payment Method <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'cash', label: 'Cash', icon: DollarSign, color: 'green' },
                          { value: 'gcash', label: 'GCash', icon: CreditCard, color: 'blue' },
                        ].map(m => (
                          <button
                            key={m.value}
                            onClick={() => setPayMethod(m.value)}
                            className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                              payMethod === m.value
                                ? m.color === 'green' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                          >
                            <m.icon size={16} /> {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {payMethod === 'cash' ? (
                      <>
                        {/* Cash Tendered Input */}
                        <div>
                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">Cash Tendered <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₱</span>
                            <input
                              type="number"
                              value={payCashTendered}
                              onChange={(e) => setPayCashTendered(e.target.value)}
                              onWheel={(e) => e.target.blur()}
                              placeholder="0.00"
                              className="w-full pl-8 pr-4 py-3 text-lg font-bold border-2 border-primary-200 dark:border-primary-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 dark:text-gray-100"
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* Quick Amount Buttons */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[payOrder.total, Math.ceil(payOrder.total / 100) * 100, Math.ceil(payOrder.total / 500) * 500, Math.ceil(payOrder.total / 1000) * 1000].filter((v, i, a) => a.indexOf(v) === i).map(amount => (
                            <button key={amount} onClick={() => setPayCashTendered(String(amount))} className="py-2 rounded-lg text-xs font-semibold border-2 border-primary-200 dark:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-400 transition-all dark:text-gray-200">₱{amount.toLocaleString()}</button>
                          ))}
                        </div>

                        {/* Change Display */}
                        {payCashTendered && (
                          <div className={`rounded-lg p-3 text-center ${parseFloat(payCashTendered) >= payOrder.total ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700'}`}>
                            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: parseFloat(payCashTendered) >= payOrder.total ? '#16a34a' : '#dc2626' }}>
                              {parseFloat(payCashTendered) >= payOrder.total ? 'Change' : 'Insufficient'}
                            </p>
                            <p className={`text-2xl font-bold ${parseFloat(payCashTendered) >= payOrder.total ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              ₱{Math.abs((parseFloat(payCashTendered) || 0) - payOrder.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* GCash Reference */}
                        <div>
                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">GCash Reference Number <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={payGcashRef}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^\d\s]/g, '').slice(0, 15);
                              setPayGcashRef(val);
                              setPayGcashRefError('');
                              checkPayGcashReference(val);
                            }}
                            placeholder="Enter 13-digit reference number"
                            className={`w-full px-4 py-3 text-lg font-bold border-2 rounded-lg focus:outline-none focus:ring-2 tracking-wider bg-white dark:bg-gray-700 dark:text-gray-100 ${
                              payGcashRefError
                                ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                                : payGcashRef.replace(/\s/g, '').length > 0 && payGcashRef.replace(/\s/g, '').length !== 13
                                  ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                                  : payGcashRef.replace(/\s/g, '').length === 13 && !payGcashRefError
                                    ? 'border-green-400 focus:ring-green-500 focus:border-green-500'
                                    : 'border-primary-200 dark:border-primary-700 focus:ring-blue-500 focus:border-blue-500'
                            }`}
                            autoFocus
                          />
                          {payGcashRefError && (
                            <p className="mt-1 text-xs text-red-500">{payGcashRefError}</p>
                          )}
                          {!payGcashRefError && payGcashRef.replace(/\s/g, '').length > 0 && payGcashRef.replace(/\s/g, '').length !== 13 && (
                            <p className="mt-1 text-xs text-red-500">Reference number must be exactly 13 digits (currently {payGcashRef.replace(/\s/g, '').length}).</p>
                          )}
                        </div>

                        {/* Payment Proof */}
                        <div>
                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">
                            Payment Proof <span className="font-normal normal-case text-gray-400">(Optional)</span>
                          </label>

                          {payShowCamera && (
                            <div className="relative mb-3 rounded-lg overflow-hidden border-2 border-blue-300 dark:border-blue-700">
                              <video ref={payVideoRef} autoPlay playsInline className="w-full h-48 object-cover bg-black" />
                              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-3">
                                <button onClick={capturePayPhoto} className="px-4 py-2 bg-blue-500 text-white text-xs font-bold rounded-full shadow-lg hover:bg-blue-600 flex items-center gap-1.5"><Camera size={14} /> Capture</button>
                                <button onClick={stopPayCamera} className="px-4 py-2 bg-gray-600 text-white text-xs font-bold rounded-full shadow-lg hover:bg-gray-700 flex items-center gap-1.5"><X size={14} /> Cancel</button>
                              </div>
                            </div>
                          )}

                          {payProofPreviews.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {payProofPreviews.map((url, idx) => (
                                <div key={idx} className="relative group">
                                  <img src={url} alt={`Proof ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg border-2 border-blue-200 dark:border-blue-700" />
                                  <button onClick={() => removePayProof(idx)} className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                                </div>
                              ))}
                            </div>
                          )}

                          {!payShowCamera && (
                            <div className="flex gap-2">
                              <button type="button" onClick={() => payProofInputRef.current?.click()} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-xs font-semibold transition-all ${
                                payProofFiles.length === 0
                                  ? 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  : 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400'
                              }`}>
                                <ImageIcon size={14} /> Upload Image
                              </button>
                              <button type="button" onClick={startPayCamera} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-xs font-semibold transition-all ${
                                payProofFiles.length === 0
                                  ? 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  : 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400'
                              }`}>
                                <Camera size={14} /> Open Camera
                              </button>
                              <input ref={payProofInputRef} type="file" accept="image/*" multiple onChange={handlePayProofUpload} className="hidden" />
                            </div>
                          )}
                        </div>

                        {/* GCash Info */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-3">
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1 uppercase tracking-wide">Payment Verification</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400">Enter the exact 13-digit GCash reference number and optionally upload a screenshot or capture the payment confirmation as proof.</p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
              </div>{/* end left-side flex-1 */}

              {/* Right side: GCash QR Code & Info Panel */}
              {payMethod === 'gcash' && (bizSettings.gcash_qr || bizSettings.gcash_name || bizSettings.gcash_number) && (
                <div className="w-64 shrink-0 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-700 p-5 flex flex-col items-center justify-center gap-4">
                  <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide text-center">Send Payment Here</h4>
                  {bizSettings.gcash_qr && (
                    <div className="w-48 h-48 bg-white dark:bg-gray-800 rounded-xl border-2 border-blue-200 dark:border-blue-700 overflow-hidden shadow-lg">
                      <img src={bizSettings.gcash_qr} alt="GCash QR Code" className="w-full h-full object-contain p-2" />
                    </div>
                  )}
                  {bizSettings.gcash_name && (
                    <div className="text-center">
                      <p className="text-[10px] text-blue-500 dark:text-blue-400 uppercase tracking-wider font-semibold">Account Name</p>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{bizSettings.gcash_name}</p>
                    </div>
                  )}
                  {bizSettings.gcash_number && (
                    <div className="text-center">
                      <p className="text-[10px] text-blue-500 dark:text-blue-400 uppercase tracking-wider font-semibold">GCash Number</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tracking-wider">{bizSettings.gcash_number}</p>
                    </div>
                  )}
                  <div className="mt-auto pt-2">
                    <p className="text-[10px] text-blue-400 dark:text-blue-500 text-center">Scan the QR code or send to the number above, then enter the reference number.</p>
                  </div>
                </div>
              )}
              </div>{/* end flex wrapper */}

              {/* Footer */}
              <div className="p-4 flex gap-3 shrink-0 border-t-2 border-primary-100 dark:border-primary-800">
                <button
                  onClick={() => { setIsPayModalOpen(false); setPayOrder(null); stopPayCamera(); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-1"
                >
                  ← Cancel
                </button>
                <button
                  onClick={handleConfirmPay}
                  disabled={savingPay || (payMethod === 'cash' ? (!payCashTendered || parseFloat(payCashTendered) < (payOrder?.total || 0)) : (!payGcashRef.trim() || payGcashRef.replace(/\s/g, '').length !== 13 || !!payGcashRefError))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all ${payMethod === 'cash' ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                  {savingPay ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {savingPay ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Proof Image Lightbox */}
      {previewProofImage && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewProofImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewProofImage(null)}
              className="absolute -top-3 -right-3 z-10 p-1.5 bg-white dark:bg-gray-700 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 transition-colors"
            >
              <X size={18} className="text-gray-600 dark:text-gray-300" />
            </button>
            <img
              src={previewProofImage}
              alt="Return proof"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
