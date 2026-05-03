import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Clock, CheckCircle, Truck, XCircle, Package, 
  Search, Eye, ChevronDown, ChevronUp, RotateCcw,
  Calendar, MapPin, CreditCard, FileText, ClipboardList, AlertTriangle,
  ImageIcon, X, DollarSign, Banknote, Smartphone, Upload, Camera, Ban
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useBusinessSettings } from '../../../context/BusinessSettingsContext';
import { Skeleton, Pagination, Modal, ConfirmModal } from '../../../components/ui';
import { useDataFetch, invalidateCache } from '../../../hooks/useDataFetch';
import apiClient from '../../../api/apiClient';
import { resolveStorageUrl } from '../../../api/config';
import { suppressNotifToasts } from '../../../utils/notifToastGuard';

const statusConfig = {
  'Pending':          { icon: Clock,        badgeClass: 'bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400', iconBgClass: 'bg-yellow-50 dark:bg-yellow-900/30', iconColorClass: 'text-yellow-600 dark:text-yellow-400', connectorClass: 'bg-yellow-300 dark:bg-yellow-700', label: 'Pending' },
  'Processing':       { icon: Package,      badgeClass: 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400',         iconBgClass: 'bg-blue-50 dark:bg-blue-900/30',   iconColorClass: 'text-blue-600 dark:text-blue-400',   connectorClass: 'bg-blue-300 dark:bg-blue-700',   label: 'Processing' },
  'Shipped':          { icon: Truck,        badgeClass: 'bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400', iconBgClass: 'bg-purple-50 dark:bg-purple-900/30', iconColorClass: 'text-purple-600 dark:text-purple-400', connectorClass: 'bg-purple-300 dark:bg-purple-700', label: 'Shipped' },
  'Delivered':        { icon: CheckCircle,  badgeClass: 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400',   iconBgClass: 'bg-green-50 dark:bg-green-900/30',  iconColorClass: 'text-green-600 dark:text-green-400',  connectorClass: 'bg-green-300 dark:bg-green-700',  label: 'Delivered' },
  'Return Requested': { icon: RotateCcw,    badgeClass: 'bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400', iconBgClass: 'bg-orange-50 dark:bg-orange-900/30', iconColorClass: 'text-orange-600 dark:text-orange-400', connectorClass: 'bg-orange-300 dark:bg-orange-700', label: 'Return Requested' },
  'Returned':         { icon: RotateCcw,    badgeClass: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400',           iconBgClass: 'bg-red-50 dark:bg-red-900/30',    iconColorClass: 'text-red-600 dark:text-red-400',    connectorClass: 'bg-red-300 dark:bg-red-700',    label: 'Returned' },
  'Cancelled':        { icon: XCircle,      badgeClass: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400',           iconBgClass: 'bg-red-50 dark:bg-red-900/30',    iconColorClass: 'text-red-600 dark:text-red-400',    connectorClass: 'bg-red-300 dark:bg-red-700',    label: 'Cancelled' },
};

const statusTabs = ['All', 'Processing', 'Shipped', 'Delivered', 'Return Requested', 'Cancelled'];

const returnReasons = [
  'Damaged Product',
  'Wrong Item Received',
  'Quality Issue',
  'Excess Order / Overstock',
  'Changed My Mind',
  'Other',
];

const Orders = () => {
  const { theme } = useTheme();
  const { settings: bizSettings } = useBusinessSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = searchParams.get('tab');
    return tabFromUrl && statusTabs.includes(tabFromUrl) ? tabFromUrl : 'All';
  });

  // Sync active tab to URL
  useEffect(() => {
    setSearchParams(prev => { prev.set('tab', activeTab); return prev; }, { replace: true });
  }, [activeTab, setSearchParams]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage, setOrdersPerPage] = useState(14);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnOrder, setReturnOrder] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnProofFiles, setReturnProofFiles] = useState([]);
  const [returnProofPreviews, setReturnProofPreviews] = useState([]);
  const [returnSubmitted, setReturnSubmitted] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [showPayModal, setShowPayModal] = useState(null);
  const [payMethod, setPayMethod] = useState('gcash');
  const [payReference, setPayReference] = useState('');
  const [payProofFiles, setPayProofFiles] = useState([]);
  const [payProofPreviews, setPayProofPreviews] = useState([]);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payRefError, setPayRefError] = useState('');
  const payRefCheckTimeout = useRef(null);
  const payProofInputRef = useRef(null);
  const [payShowCamera, setPayShowCamera] = useState(false);
  const payVideoRef = useRef(null);
  const payStreamRef = useRef(null);
  const [returnShowCamera, setReturnShowCamera] = useState(false);
  const returnVideoRef = useRef(null);
  const returnStreamRef = useRef(null);

  // Fetch orders from API
  const { data: rawOrders, loading, refetch, optimisticUpdate } = useDataFetch('/sales/my-orders', {
    cacheKey: '/sales/my-orders',
    initialData: [],
  });

  // Map API data to order format
  const orders = useMemo(() =>
    (rawOrders || []).map(o => {
      const formatStatus = (s) => {
        const map = {
          'pending': 'Pending', 'processing': 'Processing', 'shipped': 'Shipped',
          'delivered': 'Delivered', 'completed': 'Delivered', 'return_requested': 'Return Requested',
          'picking_up': 'Return Requested', 'picked_up': 'Return Requested', 'returned': 'Returned', 'cancelled': 'Cancelled', 'voided': 'Cancelled',
        };
        return map[s] || s;
      };
      return {
        id: o.transaction_id,
        saleId: o.id,
        status: formatStatus(o.status),
        rawStatus: o.status,
        date: o.created_at,
        dateFormatted: o.date_formatted,
        total: o.total || 0,
        subtotal: o.subtotal || 0,
        discount: o.discount || 0,
        deliveryFee: o.delivery_fee || 0,
        paymentMethod: o.payment_method === 'cod' ? 'COD' : o.payment_method === 'gcash' ? 'GCash' : o.payment_method === 'pay_later' ? 'Pay Later' : 'Cash',
        paymentStatus: o.payment_status === 'paid' ? 'Paid' : o.payment_status === 'not_paid' ? 'Not Paid' : 'Paid',
        deliveryAddress: o.delivery_address || 'Pick Up',
        deliveredAt: o.rawStatus === 'delivered' || o.rawStatus === 'completed' ? o.updated_at : null,
        notes: o.notes,
        items: (o.items || []).map(item => ({
          name: item.product_name,
          quantity: item.quantity,
          price: item.unit_price,
          unit: item.weight_formatted || 'pc',
          varietyName: item.variety_name,
          varietyColor: item.variety_color,
        })),
        driverName: o.driver_name,
        driverPlate: o.driver_plate_number,
        paidAt: o.paid_at_formatted,
        referenceNumber: o.reference_number,
        paymentProof: (o.payment_proof || []).map(p => resolveStorageUrl(p)),
        returnProof: (o.return_proof || []).map(p => resolveStorageUrl(p)),
        returnReason: o.return_reason,
        returnNotes: o.return_notes,
        deliveryProof: (o.delivery_proof || []).map(p => resolveStorageUrl(p)),
        returnPickupDriver: o.return_pickup_driver,
        returnPickupPlate: o.return_pickup_plate,
        returnPickupDate: o.return_pickup_date_formatted,
      };
    }),
    [rawOrders]
  );

  const handleReturnRequest = (order) => {
    setReturnOrder(order);
    setReturnReason('');
    setReturnNotes('');
    setReturnProofFiles([]);
    setReturnProofPreviews([]);
    setReturnSubmitted(false);
    setReturnShowCamera(false);
    setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = async () => {
    setReturnSubmitted(true);
    if (!returnReason || !returnProofFiles.length) return;
    try {
      const formData = new FormData();
      formData.append('return_reason', returnReason);
      if (returnNotes) formData.append('return_notes', returnNotes);
      returnProofFiles.forEach(file => formData.append('return_proof[]', file));
      await apiClient.post(`/sales/${returnOrder.saleId}/return`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Fire-and-forget email
      apiClient.post(`/sales/${returnOrder.saleId}/status-email`).catch(() => {});
      suppressNotifToasts();
      stopReturnCamera();
      setIsReturnModalOpen(false);
      setReturnOrder(null);
      // Optimistic: mark as return_requested instantly
      optimisticUpdate(prev => prev.map(o => o.id === returnOrder.saleId ? { ...o, status: 'return_requested' } : o));
      invalidateCache('/sales/my-orders');
      refetch();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to submit return request.');
    }
  };

  const handleCancelOrder = async (order) => {
    setCancellingId(order.saleId);
    try {
      await apiClient.put(`/sales/${order.saleId}/status`, { status: 'cancelled' });
      // Fire-and-forget email
      apiClient.post(`/sales/${order.saleId}/status-email`).catch(() => {});
      suppressNotifToasts();
      // Optimistic: mark as cancelled instantly
      optimisticUpdate(prev => prev.map(o => o.id === order.saleId ? { ...o, status: 'cancelled' } : o));
      invalidateCache('/sales/my-orders');
      refetch();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to cancel order.');
    } finally {
      setCancellingId(null);
    }
  };

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
      alert('Could not access camera.');
    }
  }, []);

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

  const stopReturnCamera = useCallback(() => {
    if (returnStreamRef.current) {
      returnStreamRef.current.getTracks().forEach(t => t.stop());
      returnStreamRef.current = null;
    }
    setReturnShowCamera(false);
  }, []);

  const startReturnCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      returnStreamRef.current = stream;
      setReturnShowCamera(true);
      setTimeout(() => { if (returnVideoRef.current) returnVideoRef.current.srcObject = stream; }, 100);
    } catch {
      alert('Could not access camera.');
    }
  }, []);

  const captureReturnPhoto = useCallback(() => {
    if (!returnVideoRef.current) return;
    const video = returnVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `return_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setReturnProofFiles(prev => [...prev, file]);
      setReturnProofPreviews(prev => [...prev, URL.createObjectURL(blob)]);
      stopReturnCamera();
    }, 'image/jpeg', 0.85);
  }, [stopReturnCamera]);

  const openPayModal = (order) => {
    setShowPayModal(order);
    setPayMethod('gcash');
    setPayReference('');
    setPayRefError('');
    setPayProofFiles([]);
    setPayProofPreviews([]);
    setPayShowCamera(false);
  };

  const checkPayReference = (ref) => {
    const digits = ref.replace(/\s/g, '');
    if (digits.length !== 13) return;
    if (payRefCheckTimeout.current) clearTimeout(payRefCheckTimeout.current);
    payRefCheckTimeout.current = setTimeout(async () => {
      try {
        const response = await apiClient.post('/sales/check-reference', { reference_number: digits });
        if (response.data && !response.data.available) {
          setPayRefError('This reference number has already been used.');
        } else {
          setPayRefError('');
        }
      } catch { /* silent */ }
    }, 500);
  };

  const handlePayProofChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPayProofFiles(prev => [...prev, ...files]);
    setPayProofPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const handlePaySubmit = async () => {
    if (payMethod === 'gcash' && (!payReference.trim() || payReference.replace(/\s/g, '').length !== 13 || payProofFiles.length === 0 || payRefError)) return;
    setPayRefError('');
    setPaySubmitting(true);
    try {
      const formData = new FormData();
      formData.append('payment_method', payMethod);
      if (payMethod === 'gcash') {
        formData.append('reference_number', payReference);
        payProofFiles.forEach(file => formData.append('payment_proof[]', file));
      }
      formData.append('amount_tendered', showPayModal.total);
      await apiClient.post(`/sales/${showPayModal.saleId}/pay`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Fire-and-forget email
      apiClient.post(`/sales/${showPayModal.saleId}/payment-email`).catch(() => {});
      suppressNotifToasts();
      stopPayCamera();
      setShowPayModal(null);
      // Optimistic: mark as paid instantly
      optimisticUpdate(prev => prev.map(o => o.id === showPayModal.saleId ? { ...o, payment_status: 'paid' } : o));
      invalidateCache('/sales/my-orders');
      refetch();
    } catch (err) {
      const errors = err?.response?.data?.errors;
      const message = err?.response?.data?.message || '';
      if (errors?.reference_number || message.toLowerCase().includes('reference number')) {
        setPayRefError('This reference number has already been used.');
      } else {
        alert(message || 'Failed to process payment.');
      }
    } finally {
      setPaySubmitting(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const statusPriority = { 'Pending': 1, 'Processing': 2, 'Shipped': 3, 'Delivered': 4, 'Return Requested': 5, 'Returned': 6, 'Cancelled': 7 };
    return orders
      .filter(order => {
        const matchesTab = activeTab === 'All' || order.status === activeTab;
        const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              order.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesTab && matchesSearch;
      })
      .sort((a, b) => (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99));
  }, [activeTab, searchTerm, orders]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [activeTab, searchTerm]);

  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ordersPerPage;
    return filteredOrders.slice(start, start + ordersPerPage);
  }, [filteredOrders, currentPage]);

  const orderStats = useMemo(() => {
    return {
      total: orders.length,
      active: orders.filter(o => ['Processing', 'Shipped'].includes(o.status)).length,
      delivered: orders.filter(o => o.status === 'Delivered').length,
      cancelled: orders.filter(o => o.status === 'Cancelled').length,
    };
  }, [orders]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>My Orders</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Track and manage your orders
        </p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gradient-to-br from-primary-50 via-primary-100/30 to-primary-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 rounded-xl p-4 border-2 border-primary-400 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30">
              <Skeleton variant="title" width="w-12" className="mb-1" />
              <Skeleton variant="text" width="w-20" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Orders', value: orderStats.total, colorClass: 'text-button-600 dark:text-button-400' },
          { label: 'Active', value: orderStats.active, colorClass: 'text-blue-600 dark:text-blue-400' },
          { label: 'Delivered', value: orderStats.delivered, colorClass: 'text-green-600 dark:text-green-400' },
          { label: 'Cancelled', value: orderStats.cancelled, colorClass: 'text-red-500 dark:text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gradient-to-br from-primary-50 via-primary-100/30 to-primary-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 rounded-xl p-4 border-2 border-primary-400 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30">
            <p className={`text-2xl font-bold ${stat.colorClass}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>
      )}

      {/* Filters */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 border-2 border-primary-300 dark:border-primary-700">
          <div className="flex flex-col sm:flex-row gap-3">
            <Skeleton variant="input" className="flex-1" />
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => <Skeleton key={i} variant="button" width="w-20" />)}
            </div>
          </div>
        </div>
      ) : (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 border-2 border-primary-300 dark:border-primary-700">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
            <input
              type="text"
              placeholder="Search by order ID or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border-2 border-primary-300 dark:border-primary-700 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all bg-white dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {statusTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={activeTab === tab ? {
                  backgroundColor: 'var(--color-button-500)',
                  color: '#fff',
                } : {}}
                    className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab ? '' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Orders List - 2 per row */}
      {loading ? (
        <div className="columns-1 sm:columns-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 break-inside-avoid border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <Skeleton variant="text" width="w-36" />
                <Skeleton variant="button" width="w-20" />
              </div>
              <div className="space-y-2 mb-3">
                <Skeleton variant="text" width="w-full" />
                <Skeleton variant="text" width="w-3/4" />
              </div>
              <div className="flex justify-between">
                <Skeleton variant="text" width="w-20" />
                <Skeleton variant="title" width="w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700">
          <ClipboardList size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-500" />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>No orders found</h3>
          <p className="text-sm mt-1 text-gray-500 dark:text-gray-400">
            {activeTab !== 'All' ? `No ${activeTab.toLowerCase()} orders` : 'Try a different search term'}
          </p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 gap-4">
          {paginatedOrders.map(order => {
            const config = statusConfig[order.status];
            const StatusIcon = config.icon;
            const isExpanded = expandedOrder === order.id;

            return (
              <div 
                key={order.id} 
                className={`bg-white dark:bg-gray-800 rounded-xl overflow-hidden transition-all mb-4 break-inside-avoid border-2 ${isExpanded ? 'border-button-500 dark:border-button-400 shadow-lg shadow-button-500/10' : 'border-primary-300 dark:border-primary-700'}`}
              >
                {/* Order Header - compact */}
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.iconBgClass}`}>
                      <StatusIcon size={14} className={config.iconColorClass} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{order.id}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {new Date(order.date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}{order.items.length} item(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>₱{order.total.toLocaleString()}</p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <span 
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.badgeClass}`}
                        >
                          {order.status}
                        </span>
                        <span 
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${order.paymentStatus === 'Paid' ? 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400'}`}
                        >
                          {order.paymentStatus}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={14} style={{ color: 'var(--color-text-secondary)' }} />
                    ) : (
                      <ChevronDown size={14} style={{ color: 'var(--color-text-secondary)' }} />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t-2 border-primary-200 dark:border-primary-700 px-3 pb-3">
                    {/* Status Timeline - compact */}
                    <div className="flex items-center gap-1.5 py-3 overflow-x-auto">
                      {['Pending', 'Processing', 'Shipped', 'Delivered'].map((step, idx) => {
                        const stepConfig = statusConfig[step];
                        const isActive = ['Pending', 'Processing', 'Shipped', 'Delivered'].indexOf(order.status) >= idx;
                        const isCancelled = order.status === 'Cancelled';
                        return (
                          <div key={step} className="flex items-center gap-1.5">
                            <div className="flex flex-col items-center">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                isCancelled ? 'bg-red-50 dark:bg-red-900/30' : isActive ? stepConfig.iconBgClass : 'bg-gray-100 dark:bg-gray-700'
                              }`}>
                                <stepConfig.icon size={10} className={isCancelled ? 'text-red-500 dark:text-red-400' : isActive ? stepConfig.iconColorClass : 'text-gray-300 dark:text-gray-600'} />
                              </div>
                              <span className={`text-[9px] mt-0.5 whitespace-nowrap ${
                                isActive && !isCancelled ? stepConfig.iconColorClass : 'text-gray-400 dark:text-gray-500'
                              }`}>
                                {step}
                              </span>
                            </div>
                            {idx < 3 && (
                              <div className={`w-5 sm:w-8 h-0.5 rounded mb-3 ${
                                isCancelled ? 'bg-red-200 dark:bg-red-800' : isActive ? stepConfig.connectorClass : 'bg-gray-200 dark:bg-gray-600'
                              }`} />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Order Info Grid - compact */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      {/* Payment + Proof side by side */}
                      <div className="flex gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-primary-300 dark:border-primary-700">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-1">
                            <CreditCard size={11} className="flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                            <p className="text-[9px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>Payment</p>
                          </div>
                          <p className="text-[11px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{order.paymentMethod}</p>
                          <p className={`text-[9px] font-semibold ${order.paymentStatus === 'Paid' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            {order.paymentStatus}
                          </p>
                          {order.paidAt && (
                            <p className="text-[8px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{order.paidAt}</p>
                          )}
                          {order.referenceNumber && (
                            <p className="text-[9px] font-semibold mt-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded inline-block">Ref: {order.referenceNumber}</p>
                          )}
                        </div>
                        {order.paymentProof && order.paymentProof.length > 0 && (
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <p className="text-[8px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>Proof</p>
                            <div className="flex gap-1 flex-wrap justify-end">
                              {order.paymentProof.map((proof, i) => (
                                <img key={i} src={proof} alt={`Payment proof ${i + 1}`}
                                  className="w-14 h-14 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-500 cursor-pointer hover:scale-105 hover:shadow-md transition-all"
                                  onClick={(e) => { e.stopPropagation(); window.open(proof, '_blank', 'noopener,noreferrer'); }}
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Address + Date combined */}
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-primary-300 dark:border-primary-700">
                        <div className="flex items-center gap-1 mb-1">
                          <MapPin size={11} className="flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                          <p className="text-[9px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>Address</p>
                        </div>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-primary)' }} title={order.deliveryAddress}>{order.deliveryAddress}</p>
                        <div className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar size={10} className="flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                            <p className="text-[9px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                              {order.deliveredAt ? 'Delivered' : 'Placed'}
                            </p>
                          </div>
                          <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                            {new Date(order.deliveredAt || order.date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
                            {' '}
                            <span className="font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                              {new Date(order.deliveredAt || order.date).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true })}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Driver Info */}
                      {order.driverName && (
                        <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-primary-300 dark:border-primary-700">
                          <div className="flex items-center gap-1 mb-1">
                            <Truck size={11} className="flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                            <p className="text-[9px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>Driver</p>
                          </div>
                          <p className="text-[10px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{order.driverName}</p>
                          {order.driverPlate && (
                            <p className="text-[9px] mt-0.5 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded inline-block font-medium">{order.driverPlate}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Items + Return Details side by side */}
                    <div className={`grid gap-2 ${(order.status === 'Return Requested' || order.status === 'Returned') && (order.returnReason || order.returnProof?.length > 0 || order.returnPickupDriver) ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                      {/* Items - compact */}
                      <div className="border-2 border-primary-300 dark:border-primary-700 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5">
                          <p className="text-[9px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>ORDER ITEMS</p>
                        </div>
                        <div className="divide-y divide-primary-200 dark:divide-primary-700">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between px-3 py-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{item.name}</p>
                                  {item.varietyName && (
                                    <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: item.varietyColor || '#6b7280' }}>
                                      {item.varietyName}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                                  {item.quantity} × ₱{item.price.toLocaleString()} / {item.unit}
                                </p>
                              </div>
                              <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                ₱{(item.quantity * item.price).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                        {/* Totals */}
                        <div className="border-t border-primary-200 dark:border-primary-700 px-3 py-2 space-y-0.5">
                          <div className="flex justify-between text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                            <span>Subtotal</span>
                            <span>₱{order.subtotal.toLocaleString()}</span>
                          </div>
                          {order.discount > 0 && (
                            <div className="flex justify-between text-[10px] text-green-600 dark:text-green-400">
                              <span>Discount</span>
                              <span>-₱{order.discount.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                            <span>Delivery Fee</span>
                            <span>{order.deliveryFee > 0 ? `₱${order.deliveryFee.toLocaleString()}` : 'Free'}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold pt-1 border-t border-primary-200 dark:border-primary-700" style={{ color: 'var(--color-text-primary)' }}>
                            <span>Total</span>
                            <span style={{ color: 'var(--color-button-500)' }}>₱{order.total.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Return Details — side by side with items */}
                      {(order.status === 'Return Requested' || order.status === 'Returned') && (order.returnReason || order.returnProof?.length > 0 || order.returnPickupDriver) && (
                        <div className="border-2 border-orange-300 dark:border-orange-700 rounded-lg overflow-hidden self-start">
                          <div className="bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5">
                            <p className="text-[9px] font-semibold text-orange-700 dark:text-orange-300">RETURN DETAILS</p>
                          </div>
                          <div className="p-3 space-y-2">
                            {order.returnReason && (
                              <div>
                                <p className="text-[9px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>Reason</p>
                                <p className="text-[10px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{order.returnReason}</p>
                              </div>
                            )}
                            {order.returnNotes && (
                              <div>
                                <p className="text-[9px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>Notes</p>
                                <p className="text-[10px]" style={{ color: 'var(--color-text-primary)' }}>{order.returnNotes}</p>
                              </div>
                            )}
                            {order.returnProof && order.returnProof.length > 0 && (
                              <div>
                                <p className="text-[9px] font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Proof</p>
                                <div className="flex gap-1 flex-wrap">
                                  {order.returnProof.map((proof, i) => (
                                    <img key={i} src={proof} alt={`Return proof ${i + 1}`}
                                      className="w-14 h-14 object-cover rounded-lg border-2 border-orange-200 dark:border-orange-500 cursor-pointer hover:scale-105 hover:shadow-md transition-all"
                                      onClick={(e) => { e.stopPropagation(); window.open(proof, '_blank', 'noopener,noreferrer'); }}
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                            {order.returnPickupDriver && (
                              <div className="pt-1.5 border-t border-orange-200 dark:border-orange-700">
                                <p className="text-[9px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>Pickup Driver</p>
                                <p className="text-[10px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{order.returnPickupDriver}</p>
                                {order.returnPickupPlate && (
                                  <p className="text-[9px] mt-0.5 px-1.5 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded inline-block font-medium">{order.returnPickupPlate}</p>
                                )}
                                {order.returnPickupDate && (
                                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Picked up: {order.returnPickupDate}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {order.notes && (
                      <div className="mt-2 flex items-start gap-1.5 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                        <FileText size={12} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
                        <p className="text-[10px] text-yellow-800">{order.notes}</p>
                      </div>
                    )}

                    {/* Unpaid warning */}
                    {order.paymentStatus === 'Not Paid' && !['Cancelled', 'Delivered', 'Returned', 'Return Requested'].includes(order.status) && (
                      <div className="mt-2 flex items-start gap-1.5 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                        <DollarSign size={12} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] text-red-700 dark:text-red-300 font-medium">
                          This order has not been paid yet. Please settle your payment to avoid delays.
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {/* Cancel — only for Pending */}
                      {order.status === 'Pending' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setCancelOrder(order); }}
                          disabled={cancellingId === order.saleId}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 transition-all hover:bg-red-100 disabled:opacity-50"
                        >
                          <Ban size={12} /> {cancellingId === order.saleId ? 'Cancelling...' : 'Cancel Order'}
                        </button>
                      )}

                      {/* Pay Now — for unpaid orders (pay_later, cod) that aren't cancelled */}
                      {order.paymentStatus === 'Not Paid' && !['Cancelled', 'Returned'].includes(order.status) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openPayModal(order); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
                          style={{ backgroundColor: '#3b82f6' }}
                        >
                          <CreditCard size={12} /> Pay Now
                        </button>
                      )}

                      {/* Reorder + Return — for Delivered */}
                      {order.status === 'Delivered' && (
                        <>
                          <button
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
                            style={{ backgroundColor: 'var(--color-button-500)' }}
                          >
                            <RotateCcw size={12} /> Reorder
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleReturnRequest(order); }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 transition-all hover:bg-orange-100 dark:hover:bg-orange-900/20"
                          >
                            <RotateCcw size={12} /> Return Item
                          </button>
                        </>
                      )}
                    </div>

                    {order.status === 'Return Requested' && (
                      <div className="mt-2 flex items-start gap-1.5 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
                        <AlertTriangle size={12} className="text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] text-orange-800">Return request submitted. Waiting for admin approval.</p>
                      </div>
                    )}
                    {order.status === 'Returned' && (
                      <div className="mt-2 flex items-start gap-1.5 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                        <CheckCircle size={12} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] text-green-800">Return has been processed. Refund will be credited to your account.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredOrders.length > ordersPerPage && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700 overflow-hidden">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredOrders.length}
            itemsPerPage={ordersPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(val) => { setOrdersPerPage(val); setCurrentPage(1); }}
            showItemsPerPage={true}
            itemsPerPageOptions={[7, 14, 21, 50]}
          />
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      <ConfirmModal
        isOpen={!!cancelOrder}
        onClose={() => setCancelOrder(null)}
        onConfirm={() => { handleCancelOrder(cancelOrder); setCancelOrder(null); }}
        title="Cancel Order"
        message={`Are you sure you want to cancel order "${cancelOrder?.id}"? This action cannot be undone.`}
        confirmText={cancellingId ? 'Cancelling...' : 'Cancel Order'}
        variant="danger"
        icon={Ban}
        isLoading={!!cancellingId}
      />

      {/* Return Request Modal */}
      <Modal
        isOpen={isReturnModalOpen && !!returnOrder}
        onClose={() => { stopReturnCamera(); setIsReturnModalOpen(false); }}
        title={`Request Return — ${returnOrder?.id || ''}`}
        size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { stopReturnCamera(); setIsReturnModalOpen(false); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-primary-300 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleReturnSubmit}
              disabled={!returnReason || !returnProofFiles.length}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <RotateCcw size={14} /> Submit Return Request
            </button>
          </div>
        }
      >
        {returnOrder && (
          <div className="space-y-4">
            {/* Items being returned */}
            <div className="rounded-lg border border-primary-200 dark:border-primary-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Items to Return</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {returnOrder.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-gray-800 dark:text-gray-100">{item.name}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">×{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">Return Reason <span className="text-red-500">*</span></label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">Select a reason...</option>
                {returnReasons.map(reason => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">Additional Notes <span className="font-normal normal-case text-gray-400">(Optional)</span></label>
              <textarea
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Describe the issue..."
                rows={3}
                className="w-full px-3 py-2.5 text-sm border border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            {/* Proof Images */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">
                Proof Images <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-2">Upload photos showing the reason for return</p>

              {returnShowCamera && (
                <div className="relative mb-3 rounded-lg overflow-hidden border border-button-300 dark:border-button-600">
                  <video ref={returnVideoRef} autoPlay playsInline className="w-full h-40 object-cover bg-black" />
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-3">
                    <button onClick={captureReturnPhoto} className="px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-full shadow-lg hover:bg-orange-600 flex items-center gap-1.5"><Camera size={12} /> Capture</button>
                    <button onClick={stopReturnCamera} className="px-3 py-1.5 bg-gray-600 text-white text-xs font-bold rounded-full shadow-lg hover:bg-gray-700 flex items-center gap-1.5"><X size={12} /> Cancel</button>
                  </div>
                </div>
              )}

              {returnProofPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {returnProofPreviews.map((preview, idx) => (
                    <div key={idx} className="relative group">
                      <img src={preview} alt={`Proof ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg border border-button-200 dark:border-button-700" />
                      <button
                        type="button"
                        onClick={() => {
                          setReturnProofFiles(prev => prev.filter((_, i) => i !== idx));
                          setReturnProofPreviews(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!returnShowCamera && (
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-button-300 dark:border-button-600 text-button-600 dark:text-button-400 hover:bg-button-50 dark:hover:bg-button-900/20 text-xs font-semibold cursor-pointer">
                    <ImageIcon size={14} /> Upload
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
                        if (files.length) {
                          setReturnProofFiles(prev => [...prev, ...files]);
                          setReturnProofPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button type="button" onClick={startReturnCamera}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-button-300 dark:border-button-600 text-button-600 dark:text-button-400 hover:bg-button-50 dark:hover:bg-button-900/20 text-xs font-semibold">
                    <Camera size={14} /> Camera
                  </button>
                </div>
              )}
              {returnSubmitted && returnProofFiles.length === 0 && (
                <p className="mt-1.5 text-xs text-red-500">Please upload at least one proof image</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Pay Now Modal */}
      {!!showPayModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => { stopPayCamera(); setShowPayModal(null); }} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full overflow-hidden border-2 border-primary-200 dark:border-primary-700 ${(bizSettings.gcash_qr || bizSettings.gcash_name || bizSettings.gcash_number) ? 'max-w-3xl' : 'max-w-md'}`}>
              {/* Header */}
              <div className="p-5 text-white shrink-0 bg-gradient-to-r from-blue-500 to-blue-600">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <CreditCard size={20} /> GCash Payment
                </h3>
                <p className="text-sm text-white/80 mt-1">Enter GCash reference number</p>
              </div>

              <div className={`${(bizSettings.gcash_qr || bizSettings.gcash_name || bizSettings.gcash_number) ? 'flex' : ''}`}>
              {/* Left side: form content */}
              <div className="flex-1 min-w-0">
              <div className="p-5 space-y-4">
                {/* Order Summary */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{showPayModal.id}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{showPayModal.items?.length || 0} item(s)</p>
                    </div>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                    <span className="font-bold text-gray-800 dark:text-gray-100">Total Due</span>
                    <span className="text-xl font-bold text-primary-600 dark:text-primary-400">₱{showPayModal.total.toLocaleString()}</span>
                  </div>
                </div>

                {/* GCash Reference */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">GCash Reference Number <span className="text-red-500">*</span></label>
                  <input type="text" value={payReference} onChange={(e) => {
                    const val = e.target.value.replace(/[^\d\s]/g, '').slice(0, 15);
                    setPayReference(val);
                    setPayRefError('');
                    checkPayReference(val);
                  }}
                    placeholder="Enter 13-digit reference number"
                    className={`w-full px-4 py-3 text-lg font-bold border-2 rounded-lg focus:outline-none focus:ring-2 tracking-wider bg-white dark:bg-gray-700 dark:text-gray-100 ${
                      payRefError
                        ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                        : payReference.replace(/\s/g, '').length > 0 && payReference.replace(/\s/g, '').length !== 13
                          ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                          : payReference.replace(/\s/g, '').length === 13 && !payRefError
                            ? 'border-green-400 focus:ring-green-500 focus:border-green-500'
                            : 'border-primary-200 dark:border-primary-700 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    autoFocus />
                  {payRefError && <p className="text-xs text-red-500 font-medium mt-1">{payRefError}</p>}
                  {!payRefError && payReference.replace(/\s/g, '').length > 0 && payReference.replace(/\s/g, '').length !== 13 && (
                    <p className="mt-1 text-xs text-red-500">Reference number must be exactly 13 digits (currently {payReference.replace(/\s/g, '').length}).</p>
                  )}
                </div>

                {/* Payment Proof */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">
                    Payment Proof <span className="text-red-500">*</span>
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
                      {payProofPreviews.map((src, i) => (
                        <div key={i} className="relative group">
                          <img src={src} alt={`Proof ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border-2 border-blue-200 dark:border-blue-700" />
                          <button onClick={() => { setPayProofFiles(prev => prev.filter((_, j) => j !== i)); setPayProofPreviews(prev => prev.filter((_, j) => j !== i)); }}
                            className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {!payShowCamera && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => payProofInputRef.current?.click()} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-xs font-semibold transition-all ${
                        payProofFiles.length === 0
                          ? 'border-red-300 dark:border-red-600 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400'
                          : 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400'
                      }`}>
                        <ImageIcon size={14} /> Upload Image
                      </button>
                      <button type="button" onClick={startPayCamera}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-xs font-semibold transition-all ${
                          payProofFiles.length === 0
                            ? 'border-red-300 dark:border-red-600 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400'
                            : 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400'
                        }`}>
                        <Camera size={14} /> Open Camera
                      </button>
                    </div>
                  )}
                  {payProofFiles.length === 0 && (
                    <p className="mt-1 text-xs text-red-500">Payment proof is required.</p>
                  )}
                  <input ref={payProofInputRef} type="file" accept="image/*" multiple onChange={handlePayProofChange} className="hidden" />
                </div>

                {/* GCash Info */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1 uppercase tracking-wide">Payment Verification</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Enter the exact 13-digit GCash reference number and upload a screenshot or capture the payment confirmation as proof.</p>
                </div>
              </div>
              </div>{/* end left-side flex-1 */}

              {/* Right side: GCash QR Code & Info Panel */}
              {(bizSettings.gcash_qr || bizSettings.gcash_name || bizSettings.gcash_number) && (
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
                  onClick={() => { stopPayCamera(); setShowPayModal(null); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-1"
                >
                  ← Back
                </button>
                <button
                  onClick={handlePaySubmit}
                  disabled={paySubmitting || !payReference.trim() || payReference.replace(/\s/g, '').length !== 13 || !!payRefError || payProofFiles.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <CheckCircle size={14} /> {paySubmitting ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Orders;
