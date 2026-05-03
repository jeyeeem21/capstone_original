import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Package, DollarSign, Clock, CheckCircle, Truck, XCircle, Ban, CircleSlash, FileText, ShoppingBag, RotateCcw, PlayCircle, Loader2, User, Calendar, CreditCard, MapPin, Hash, StickyNote, Receipt, ImageIcon, X, Camera, Banknote, Lock, Store, Printer, PackageCheck } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatusBadge, ActionButtons, StatsCard, LineChart, DonutChart, FormModal, ConfirmModal, FormInput, FormSelect, Modal, useToast, SkeletonStats, SkeletonTable } from '../../../components/ui';
import { apiClient } from '../../../api';
import { resolveStorageUrl } from '../../../api/config';
import useDataFetch, { invalidateCache } from '../../../hooks/useDataFetch';
import { useAuth } from '../../../context/AuthContext';
import { useBusinessSettings } from '../../../context/BusinessSettingsContext';
import { suppressNotifToasts } from '../../../utils/notifToastGuard';

// ─── Print Receipt Helper ─────────────────────────────────────────────────────
const printOrderReceipt = (order, bizName = 'KJP Ricemill', copies = 1) => {
  const win = window.open('', '_blank', 'width=480,height=660');
  if (!win) return;

  const payStatus = order.payment_status === 'not_paid' ? 'UNPAID' : 'PAID';
  const payColor  = order.payment_status === 'not_paid' ? '#dc2626' : '#16a34a';

  const itemRows = (order.items || []).map(item => `
    <tr>
      <td>${(item.product_name || item.name || '')}${item.weight_formatted ? ` (${item.weight_formatted})` : ''}</td>
      <td class="c">${item.quantity}</td>
      <td class="r">&#8369;${(item.unit_price || item.price || 0).toLocaleString()}</td>
      <td class="r">&#8369;${(item.subtotal || 0).toLocaleString()}</td>
    </tr>`).join('');

  const receiptHTML = `
  <div class="rcpt">
    <div class="hdr">
      <div class="biz">${bizName}</div>
      <div class="sub">OFFICIAL RECEIPT</div>
    </div>
    <hr class="d"/>
    <table class="meta">
      <tr><td class="ml">TXN ID:</td><td class="mv">${order.order_id}</td></tr>
      <tr><td class="ml">Date:</td><td class="mv">${order.date_formatted || ''}</td></tr>
      <tr><td class="ml">Customer:</td><td class="mv">${order.customer}</td></tr>
      <tr><td class="ml">Type:</td><td class="mv">${order.is_delivery ? 'Delivery' : 'Pick Up'}</td></tr>
      ${order.delivery_address ? `<tr><td class="ml">Address:</td><td class="mv">${order.delivery_address}</td></tr>` : ''}
      <tr><td class="ml">Payment:</td><td class="mv">${order.payment_method} &mdash; <span style="color:${payColor};font-weight:700">${payStatus}</span></td></tr>
      ${order.driver_name ? `<tr><td class="ml">Driver:</td><td class="mv">${order.driver_name}</td></tr>` : ''}
    </table>
    <hr class="d"/>
    <table class="items">
      <thead><tr><th>Product</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Subtotal</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr class="d"/>
    <table class="totals">
      ${(order.delivery_fee > 0) ? `<tr><td class="tl">Delivery Fee</td><td class="tr_">&#8369;${Number(order.delivery_fee).toLocaleString()}</td></tr>` : ''}
      ${(order.discount > 0) ? `<tr><td class="tl">Discount</td><td class="tr_" style="color:#dc2626">-&#8369;${Number(order.discount).toLocaleString()}</td></tr>` : ''}
      <tr class="grand"><td>TOTAL</td><td class="tr_">&#8369;${Number(order.total).toLocaleString()}</td></tr>
      ${(order.amount_tendered > 0) ? `<tr><td class="tl">Tendered</td><td class="tr_">&#8369;${Number(order.amount_tendered).toLocaleString()}</td></tr>` : ''}
      ${(order.change_amount > 0) ? `<tr><td class="tl">Change</td><td class="tr_">&#8369;${Number(order.change_amount).toLocaleString()}</td></tr>` : ''}
    </table>
    <hr class="d"/>
    <div class="status">Status: <strong>${order.status}</strong></div>
    <div class="ftr">Thank you! &mdash; System-generated</div>
  </div>`;

  const allCopies = Array.from({ length: copies }, (_, i) =>
    i < copies - 1 ? `${receiptHTML}<div class="pb"></div>` : receiptHTML
  ).join('');

  win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
    <title>Receipt &mdash; ${order.order_id}</title>
    <style>
      @page{size:4.25in 5.5in;margin:7mm}
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:9px;color:#111;background:#fff}
      .rcpt{width:100%}
      .hdr{text-align:center;padding-bottom:5px}
      .biz{font-size:13px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
      .sub{font-size:8px;color:#555;font-weight:600;letter-spacing:1px;margin-top:1px}
      hr.d{border:none;border-top:1px dashed #aaa;margin:4px 0}
      table.meta{width:100%;border-collapse:collapse;font-size:8.5px;margin:3px 0}
      table.meta td{padding:1.5px 2px}
      .ml{color:#555;font-weight:600;white-space:nowrap;padding-right:6px;width:52px}
      .mv{color:#111}
      table.items{width:100%;border-collapse:collapse;font-size:8px;margin:3px 0}
      table.items th{padding:2.5px 3px;text-align:left;font-weight:700;border-bottom:1px solid #ccc;font-size:8px}
      table.items td{padding:2px 3px;border-bottom:1px solid #eee}
      .c{text-align:center}.r{text-align:right}
      table.totals{width:100%;border-collapse:collapse;font-size:8.5px;margin:2px 0}
      table.totals td{padding:1.5px 3px}
      .tl{color:#555;text-align:left}.tr_{text-align:right}
      .grand td{font-size:10px;font-weight:700;padding:3px;border-top:1px solid #333;border-bottom:1px solid #333}
      .status{font-size:8px;margin-top:4px;text-align:center}
      .ftr{font-size:7.5px;color:#999;text-align:center;margin-top:3px;padding-top:3px;border-top:1px dashed #ccc}
      .pb{page-break-after:always}
      @media print{.pb{page-break-after:always}}
    </style></head><body>${allCopies}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
};

// ─── Batch Print Helper (4 receipts per short bond paper, 2 per row) ─────────
const printBatchReceipts = (orders, bizName = 'KJP Ricemill') => {
  const win = window.open('', '_blank', 'width=800,height=1100');
  if (!win) return;

  const generateReceiptHTML = (order) => {
    const payStatus = order.payment_status === 'not_paid' ? 'UNPAID' : 'PAID';
    const payColor  = order.payment_status === 'not_paid' ? '#dc2626' : '#16a34a';

    const itemRows = (order.items || []).map(item => `
      <tr>
        <td>${(item.product_name || item.name || '')}${item.weight_formatted ? ` (${item.weight_formatted})` : ''}</td>
        <td class="c">${item.quantity}</td>
        <td class="r">&#8369;${(item.unit_price || item.price || 0).toLocaleString()}</td>
        <td class="r">&#8369;${(item.subtotal || 0).toLocaleString()}</td>
      </tr>`).join('');

    return `
    <div class="rcpt">
      <div class="hdr">
        <div class="biz">${bizName}</div>
        <div class="sub">OFFICIAL RECEIPT</div>
      </div>
      <hr class="d"/>
      <table class="meta">
        <tr><td class="ml">TXN ID:</td><td class="mv">${order.order_id}</td></tr>
        <tr><td class="ml">Date:</td><td class="mv">${order.date_formatted || ''}</td></tr>
        <tr><td class="ml">Customer:</td><td class="mv">${order.customer}</td></tr>
        <tr><td class="ml">Type:</td><td class="mv">${order.is_delivery ? 'Delivery' : 'Pick Up'}</td></tr>
        ${order.delivery_address ? `<tr><td class="ml">Address:</td><td class="mv">${order.delivery_address}</td></tr>` : ''}
        <tr><td class="ml">Payment:</td><td class="mv">${order.payment_method} &mdash; <span style="color:${payColor};font-weight:700">${payStatus}</span></td></tr>
        ${order.driver_name ? `<tr><td class="ml">Driver:</td><td class="mv">${order.driver_name}</td></tr>` : ''}
      </table>
      <hr class="d"/>
      <table class="items">
        <thead><tr><th>Product</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Subtotal</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <hr class="d"/>
      <table class="totals">
        ${(order.delivery_fee > 0) ? `<tr><td class="tl">Delivery Fee</td><td class="tr_">&#8369;${Number(order.delivery_fee).toLocaleString()}</td></tr>` : ''}
        ${(order.discount > 0) ? `<tr><td class="tl">Discount</td><td class="tr_" style="color:#dc2626">-&#8369;${Number(order.discount).toLocaleString()}</td></tr>` : ''}
        <tr class="grand"><td>TOTAL</td><td class="tr_">&#8369;${Number(order.total).toLocaleString()}</td></tr>
        ${(order.amount_tendered > 0) ? `<tr><td class="tl">Tendered</td><td class="tr_">&#8369;${Number(order.amount_tendered).toLocaleString()}</td></tr>` : ''}
        ${(order.change_amount > 0) ? `<tr><td class="tl">Change</td><td class="tr_">&#8369;${Number(order.change_amount).toLocaleString()}</td></tr>` : ''}
      </table>
      <hr class="d"/>
      <div class="status">Status: <strong>${order.status}</strong></div>
      <div class="ftr">Thank you! &mdash; System-generated</div>
    </div>`;
  };

  // Group receipts into pages (4 per page, 2 per row)
  const pages = [];
  for (let i = 0; i < orders.length; i += 4) {
    const pageOrders = orders.slice(i, i + 4);
    const rows = [];
    
    // Create 2 rows per page
    for (let j = 0; j < pageOrders.length; j += 2) {
      const leftReceipt = generateReceiptHTML(pageOrders[j]);
      const rightReceipt = pageOrders[j + 1] ? generateReceiptHTML(pageOrders[j + 1]) : '<div class="rcpt empty"></div>';
      rows.push(`
        <div class="receipt-row">
          <div class="receipt-cell">${leftReceipt}</div>
          <div class="receipt-cell">${rightReceipt}</div>
        </div>
      `);
    }
    
    pages.push(`<div class="page">${rows.join('')}</div>`);
  }

  win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
    <title>Batch Receipts (${orders.length} orders)</title>
    <style>
      @page{size:8.5in 11in;margin:0.35in 0.4in}
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#fff}
      .page{width:100%;display:flex;flex-direction:column;gap:0.25in;page-break-after:always}
      .page:last-child{page-break-after:auto}
      .receipt-row{display:flex;gap:0.25in;flex:1;min-height:0}
      .receipt-cell{flex:1;min-width:0;display:flex}
      .rcpt{width:100%;font-size:8.5px;color:#111;border:1.5px solid #ccc;padding:10px;background:#fff;display:flex;flex-direction:column}
      .rcpt.empty{border:none;background:transparent}
      .hdr{text-align:center;padding-bottom:5px}
      .biz{font-size:13px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
      .sub{font-size:8px;color:#555;font-weight:600;letter-spacing:1px;margin-top:1px}
      hr.d{border:none;border-top:1px dashed #aaa;margin:4px 0}
      table.meta{width:100%;border-collapse:collapse;font-size:8px;margin:3px 0}
      table.meta td{padding:1.5px 2px}
      .ml{color:#555;font-weight:600;white-space:nowrap;padding-right:5px;width:50px}
      .mv{color:#111;word-break:break-word}
      table.items{width:100%;border-collapse:collapse;font-size:7.5px;margin:3px 0}
      table.items th{padding:2.5px 2px;text-align:left;font-weight:700;border-bottom:1px solid #ccc;font-size:7.5px}
      table.items td{padding:2px 2px;border-bottom:1px solid #eee}
      .c{text-align:center}.r{text-align:right}
      table.totals{width:100%;border-collapse:collapse;font-size:8px;margin:3px 0}
      table.totals td{padding:1.5px 2px}
      .tl{color:#555;text-align:left}.tr_{text-align:right}
      .grand td{font-size:9.5px;font-weight:700;padding:2.5px;border-top:1px solid #333;border-bottom:1px solid #333}
      .status{font-size:7.5px;margin-top:4px;text-align:center}
      .ftr{font-size:7px;color:#999;text-align:center;margin-top:3px;padding-top:3px;border-top:1px dashed #ccc}
      @media print{.page{page-break-after:always}.page:last-child{page-break-after:auto}}
    </style></head><body>${pages.join('')}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
};

const AdminOrders = () => {
  const toast = useToast();
  const { isSuperAdmin, isAdmin, isAdminOrAbove } = useAuth();
  const { settings: bizSettings } = useBusinessSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [activeChartPoint, setActiveChartPoint] = useState(null);
  const [chartScopeActive, setChartScopeActive] = useState(false);
  // Chart calendar filter state
  const [chartMonth, setChartMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [chartYear, setChartYear] = useState(() => new Date().getFullYear());
  const [chartYearFrom, setChartYearFrom] = useState(() => new Date().getFullYear() - 4);
  const [chartYearTo, setChartYearTo] = useState(() => new Date().getFullYear());
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnProofFiles, setReturnProofFiles] = useState([]);
  const [returnProofPreviews, setReturnProofPreviews] = useState([]);
  const [isAcceptReturnModalOpen, setIsAcceptReturnModalOpen] = useState(false);
  const [acceptReturnOrder, setAcceptReturnOrder] = useState(null);
  const [pickupDriverId, setPickupDriverId] = useState('');
  const [pickupDrivers, setPickupDrivers] = useState([]);
  const [loadingPickupDrivers, setLoadingPickupDrivers] = useState(false);
  const [pickupDate, setPickupDate] = useState('');
  const [previewProofImage, setPreviewProofImage] = useState(null);
  const [isMarkReturnModalOpen, setIsMarkReturnModalOpen] = useState(false);
  const [markReturnOrder, setMarkReturnOrder] = useState(null);
  const [rejectReturnOrder, setRejectReturnOrder] = useState(null);
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
  const [activeStatusTab, setActiveStatusTab] = useState(() => {
    const tabFromUrl = searchParams.get('tab');
    const validTabs = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered & Completed', 'Returns & Cancelled'];
    if (tabFromUrl && validTabs.includes(tabFromUrl)) return tabFromUrl;
    // Support legacy tab values from URL
    if (['Delivered', 'Completed'].includes(tabFromUrl)) return 'Delivered & Completed';
    if (['Return Requested', 'Picking Up', 'Picked Up', 'Returned', 'Cancelled', 'Voided'].includes(tabFromUrl)) return 'Returns & Cancelled';
    return 'All';
  });
  const [statusSubFilter, setStatusSubFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [shipOrder, setShipOrder] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  // Deliver proof state
  const [isDeliverModalOpen, setIsDeliverModalOpen] = useState(false);
  const [deliverOrder, setDeliverOrder] = useState(null);
  const [deliverProofFiles, setDeliverProofFiles] = useState([]);
  const [deliverProofPreviews, setDeliverProofPreviews] = useState([]);
  const [deliverShowCamera, setDeliverShowCamera] = useState(false);
  const deliverVideoRef = useRef(null);
  const deliverStreamRef = useRef(null);
  const deliverProofInputRef = useRef(null);
  // Void state
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidOrder, setVoidOrder] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidPassword, setVoidPassword] = useState('');
  // Payment filters
  const [payStatusFilter, setPayStatusFilter] = useState(''); // '' | 'paid' | 'not_paid'
  const [payMethodFilter, setPayMethodFilter] = useState(''); // '' | 'cash' | 'gcash' | 'cod' | 'pay_later'
  // Restock state
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockOrder, setRestockOrder] = useState(null);
  // { [itemId]: quantity } — only contains items to be restocked
  const [restockQuantities, setRestockQuantities] = useState({});
  const [restockNotes, setRestockNotes] = useState('');
  // Multi-select for batch printing
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);

  // Sync active tab to URL
  useEffect(() => {
    setSearchParams(prev => { prev.set('tab', activeStatusTab); return prev; }, { replace: true });
  }, [activeStatusTab, setSearchParams]);

  // Fetch real orders from API
  const {
    data: orders,
    loading,
    refetch,
    optimisticUpdate,
  } = useDataFetch('/sales', {
    cacheKey: '/sales',
    initialData: [],
  });

  // Map API data to order format
  const mappedOrders = useMemo(() =>
    (orders || [])
      .map(o => ({
        ...o,
        order_id: o.transaction_id,
        customer: o.customer_name || 'Walk-in',
        items: o.items || [],
        items_count: o.items_count || 0,
        total_quantity: o.total_quantity || 0,
        total: o.total || 0,
        payment_method: o.payment_method === 'cod' ? 'COD' : o.payment_method === 'gcash' ? 'GCash' : o.payment_method === 'pay_later' ? 'Pay Later' : 'Cash',
        raw_payment_method: o.payment_method,
        payment_status: o.payment_status || 'paid',
        status: formatStatus(o.status),
        raw_status: o.status,
        date: o.created_at,
        date_formatted: o.date_formatted,
        delivery_address: o.delivery_address || null,
        is_delivery: !!(o.delivery_address),
      })),
    [orders]
  );

  function formatStatus(status) {
    const map = {
      'pending': 'Pending',
      'processing': 'Processing',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'completed': 'Completed',
      'return_requested': 'Return Requested',
      'picking_up': 'Picking Up',
      'picked_up': 'Picked Up',
      'returned': 'Returned',
      'cancelled': 'Cancelled',
      'voided': 'Voided',
    };
    return map[status] || status;
  }

  function rawStatus(status) {
    const map = {
      'Pending': 'pending',
      'Processing': 'processing',
      'Shipped': 'shipped',
      'Delivered': 'delivered',
      'Completed': 'completed',
      'Return Requested': 'return_requested',
      'Picking Up': 'picking_up',
      'Picked Up': 'picked_up',
      'Returned': 'returned',
      'Cancelled': 'cancelled',
      'Voided': 'voided',
    };
    return map[status] || status;
  }

  const statusTabs = [
    { value: 'All', label: 'All', icon: FileText, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-700', activeBg: 'bg-button-500', activeText: 'text-white' },
    { value: 'Pending', label: 'Pending', icon: Clock, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', activeBg: 'bg-yellow-500', activeText: 'text-white' },
    { value: 'Processing', label: 'Processing', icon: Package, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', activeBg: 'bg-blue-500', activeText: 'text-white' },
    { value: 'Shipped', label: 'Shipped', icon: Truck, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/40', activeBg: 'bg-indigo-500', activeText: 'text-white' },
    { value: 'Delivered & Completed', label: 'Delivered & Completed', icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', activeBg: 'bg-green-500', activeText: 'text-white', statuses: ['Delivered', 'Completed'] },
    { value: 'Returns & Cancelled', label: 'Returns & Cancelled', icon: RotateCcw, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', activeBg: 'bg-red-500', activeText: 'text-white', statuses: ['Return Requested', 'Picking Up', 'Picked Up', 'Returned', 'Cancelled', 'Voided'] },
  ];

  // Helper to get statuses for a tab
  const getTabStatuses = (tabValue) => {
    const tab = statusTabs.find(t => t.value === tabValue);
    return tab?.statuses || [tabValue];
  };

  const ORDER_STATUS_SORT = { 'Pending': 0, 'Processing': 1, 'Picking Up': 2, 'Picked Up': 3, 'Shipped': 4, 'Delivered': 5, 'Completed': 6, 'Return Requested': 7, 'Returned': 8, 'Cancelled': 9, 'Voided': 10 };

  const filteredOrdersByTab = useMemo(() => {
    if (activeStatusTab === 'All') {
      return [...mappedOrders].sort((a, b) => (ORDER_STATUS_SORT[a.status] ?? 99) - (ORDER_STATUS_SORT[b.status] ?? 99));
    }
    const statuses = getTabStatuses(activeStatusTab);
    return mappedOrders.filter(o => statuses.includes(o.status));
  }, [mappedOrders, activeStatusTab]);

  // ─── Handlers ────────────────────────────────────────────

  const handleView = useCallback((order) => {
    setSelectedOrder(order);
    setIsViewModalOpen(true);
  }, []);

  const [printReceiptOrder, setPrintReceiptOrder] = useState(null);
  const [printReceiptCopies, setPrintReceiptCopies] = useState(1);

  const handlePrintReceipt = useCallback((order) => {
    setPrintReceiptCopies(1);
    setPrintReceiptOrder(order);
  }, []);

  const handleCancel = useCallback((order) => {
    setSelectedOrder(order);
    setIsCancelModalOpen(true);
  }, []);

  const handleReturn = useCallback((order) => {
    setSelectedOrder(order);
    setReturnReason('');
    setReturnNotes('');
    setReturnProofFiles([]);
    setReturnProofPreviews([]);
    setIsReturnModalOpen(true);
  }, []);

  // Progress order to next status
  const handleProgressStatus = useCallback(async (order) => {
    if (saving) return;
    const isDelivery = !!(order.delivery_address);
    const nextStatusMap = {
      'pending': 'processing',
      'processing': isDelivery ? 'shipped' : 'completed',
      'shipped': 'delivered',
      'picking_up': 'picked_up',
    };
    const nextStatus = nextStatusMap[order.raw_status];
    if (!nextStatus) return;

    // If shipping, show driver selection modal instead
    if (nextStatus === 'shipped') {
      setShipOrder(order);
      setSelectedDriverId('');
      setDeliveryNotes('');
      setIsShipModalOpen(true);
      // Fetch staff drivers (users with position=Driver)
      setLoadingDrivers(true);
      try {
        const res = await apiClient.get('/users', { params: { role: 'staff' } });
        if (res.success) {
          const staffDrivers = (res.data?.data || res.data || []).filter(u => u.position === 'Driver' && u.status === 'active');
          setDrivers(staffDrivers);
        }
      } catch (err) {
        console.error('Error fetching drivers:', err);
      } finally {
        setLoadingDrivers(false);
      }

      // Auto-estimate delivery date based on distance (with +1 day allowance)
      const distKm = parseFloat(order.distance_km) || 0;
      if (distKm > 0) {
        // Rough estimate: average truck speed ~40 km/h + 1hr loading + 1 day allowance
        const driveHours = distKm / 40;
        const totalHours = driveHours + 1;
        const baseDays = totalHours > 8 ? Math.ceil(totalHours / 8) : 1;
        const daysWithAllowance = baseDays + 1; // +1 day allowance/buffer
        const estimated = new Date();
        estimated.setDate(estimated.getDate() + daysWithAllowance);
        setDeliveryDate(estimated.toISOString().split('T')[0]);
      } else {
        // Default: day after tomorrow (tomorrow + 1 day allowance)
        const est = new Date();
        est.setDate(est.getDate() + 2);
        setDeliveryDate(est.toISOString().split('T')[0]);
      }
      return;
    }

    // If delivering, show proof upload modal instead
    if (nextStatus === 'delivered') {
      setDeliverOrder(order);
      setDeliverProofFiles([]);
      setDeliverProofPreviews([]);
      setIsDeliverModalOpen(true);
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient.put(`/sales/${order.id}/status`, { status: nextStatus });
      if (response.success) {
        // Optimistic: update status instantly
        optimisticUpdate(prev => prev.map(o => o.id === order.id ? { ...o, status: nextStatus } : o));
        invalidateCache('/sales');
        invalidateCache('/products');
        refetch();
        const labels = { processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', completed: 'Completed', picked_up: 'Picked Up' };
        suppressNotifToasts();
        toast.success('Status Updated', `Order ${order.order_id} moved to ${labels[nextStatus]}.`);
        // Fire-and-forget email
        apiClient.post(`/sales/${order.id}/status-email`).catch(() => {});
      } else {
        throw response;
      }
    } catch (error) {
      toast.error('Update Failed', error.message || 'Failed to update order status');
    } finally {
      setSaving(false);
    }
  }, [saving, refetch, toast]);

  // Confirm ship with driver assignment
  const handleShipConfirm = useCallback(async () => {
    if (!shipOrder || !selectedDriverId || saving) return;
    setSaving(true);
    try {
      // Get selected driver details
      const selectedDriver = drivers.find(d => String(d.id) === selectedDriverId);

      // 1. Update order status to shipped (include driver info)
      const statusRes = await apiClient.put(`/sales/${shipOrder.id}/status`, {
        status: 'shipped',
        driver_name: selectedDriver?.name || null,
        driver_plate_number: selectedDriver?.truck_plate_number || null,
      });
      if (!statusRes.success) throw statusRes;

      // Optimistic: update status + driver info instantly
      optimisticUpdate(prev => prev.map(o => o.id === shipOrder.id ? { ...o, status: 'shipped', driver_name: selectedDriver?.name || null } : o));
      invalidateCache('/sales');
      invalidateCache('/products');
      invalidateCache('/users');
      refetch();
      suppressNotifToasts();
      toast.success('Order Shipped', `Order ${shipOrder.order_id} has been shipped with ${selectedDriver?.name || 'a driver'} assigned.`);
      // Fire-and-forget email
      apiClient.post(`/sales/${shipOrder.id}/status-email`).catch(() => {});
      setIsShipModalOpen(false);
    } catch (error) {
      toast.error('Ship Failed', error.message || 'Failed to ship order');
    } finally {
      setSaving(false);
    }
  }, [shipOrder, selectedDriverId, deliveryDate, deliveryNotes, saving, refetch, toast]);

  // Open payment modal for an order
  const handleOpenPayModal = useCallback((order) => {
    setPayOrder(order);
    setPayMethod('cash');
    setPayCashTendered('');
    setPayGcashRef('');
    setPayGcashRefError('');
    setPayProofFiles([]);
    setPayProofPreviews([]);
    setPayShowCamera(false);
    setIsPayModalOpen(true);
  }, []);

  // Confirm deliver with proof upload
  const handleDeliverConfirm = useCallback(async () => {
    if (!deliverOrder || deliverProofFiles.length === 0 || saving) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('_method', 'PUT');
      formData.append('status', 'delivered');
      deliverProofFiles.forEach((file) => {
        formData.append('delivery_proof[]', file);
      });
      const response = await apiClient.post(`/sales/${deliverOrder.id}/status`, formData);
      if (!response.success) throw response;
      // Optimistic: mark as delivered instantly
      optimisticUpdate(prev => prev.map(o => o.id === deliverOrder.id ? { ...o, status: 'delivered' } : o));
      invalidateCache('/sales');
      invalidateCache('/products');
      refetch();
      suppressNotifToasts();
      toast.success('Order Delivered', `Order ${deliverOrder.order_id} has been marked as delivered.`);
      // Fire-and-forget email
      apiClient.post(`/sales/${deliverOrder.id}/status-email`).catch(() => {});

      // If COD and not paid, auto-open payment modal
      const wasCod = deliverOrder.raw_payment_method === 'cod';
      const wasUnpaid = deliverOrder.payment_status === 'not_paid';
      const orderForPay = { ...deliverOrder };

      setIsDeliverModalOpen(false);
      setDeliverOrder(null);
      setDeliverProofFiles([]);
      setDeliverProofPreviews([]);

      if (wasCod && wasUnpaid) {
        setTimeout(() => handleOpenPayModal(orderForPay), 300);
      }
    } catch (error) {
      toast.error('Delivery Failed', error.message || 'Failed to mark order as delivered');
    } finally {
      setSaving(false);
    }
  }, [deliverOrder, deliverProofFiles, saving, refetch, toast, handleOpenPayModal]);

  // Void order handler
  const handleVoidConfirm = useCallback(async () => {
    if (!voidOrder || !voidReason.trim() || saving) return;
    // All roles must provide a password
    if (!voidPassword.trim()) return;
    setSaving(true);
    try {
      const payload = { reason: voidReason, admin_password: voidPassword };
      const response = await apiClient.post(`/sales/${voidOrder.id}/void`, payload);
      if (response.success) {
        // Optimistic: mark as voided instantly
        optimisticUpdate(prev => prev.map(o => o.id === voidOrder.id ? { ...o, status: 'voided' } : o));
        invalidateCache('/sales');
        invalidateCache('/products');
        refetch();
        suppressNotifToasts();
        toast.success('Order Voided', `Order ${voidOrder.order_id} has been voided. Stock restored.`);
        setIsVoidModalOpen(false);
        setVoidOrder(null);
        setVoidReason('');
        setVoidPassword('');
      } else {
        throw response;
      }
    } catch (error) {
      toast.error('Void Failed', error.message || 'Failed to void order');
    } finally {
      setSaving(false);
    }
  }, [voidOrder, voidReason, voidPassword, saving, refetch, toast]);

  const handleCancelConfirm = useCallback(async () => {
    if (!selectedOrder || saving) return;
    setSaving(true);
    try {
      const response = await apiClient.put(`/sales/${selectedOrder.id}/status`, { status: 'cancelled' });
      if (response.success) {
        const cancelledId = selectedOrder.id;
        // Immediately update status in local data for instant UI
        optimisticUpdate(prev => prev.map(o => o.id === cancelledId ? { ...o, status: 'cancelled' } : o));
        suppressNotifToasts();
        toast.success('Order Cancelled', `Order ${selectedOrder.order_id} has been cancelled.`);
        // Fire-and-forget email
        apiClient.post(`/sales/${selectedOrder.id}/status-email`).catch(() => {});
        setIsCancelModalOpen(false);
        // Refetch in background to confirm
        invalidateCache('/sales');
        invalidateCache('/products');
        refetch();
      } else {
        throw response;
      }
    } catch (error) {
      toast.error('Cancel Failed', error.message || 'Failed to cancel order');
    } finally {
      setSaving(false);
    }
  }, [selectedOrder, saving, refetch, optimisticUpdate, toast]);

  const handleReturnConfirm = useCallback(async () => {
    if (!selectedOrder || !returnReason || !returnProofFiles.length || saving) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('return_reason', returnReason);
      if (returnNotes) formData.append('return_notes', returnNotes);
      returnProofFiles.forEach(file => formData.append('return_proof[]', file));

      const response = await apiClient.post(`/sales/${selectedOrder.id}/return`, formData);
      if (response.success) {
        const returnedId = selectedOrder.id;
        // Immediately update status in local data for instant UI
        optimisticUpdate(prev => prev.map(o => o.id === returnedId ? { ...o, status: 'return_requested' } : o));
        suppressNotifToasts();
        toast.success('Return Requested', `Return request submitted for order ${selectedOrder.order_id}. Awaiting review.`);
        // Fire-and-forget email
        apiClient.post(`/sales/${selectedOrder.id}/status-email`).catch(() => {});
        setIsReturnModalOpen(false);
        // Refetch in background to confirm
        invalidateCache('/sales');
        refetch();
      } else {
        throw response;
      }
    } catch (error) {
      toast.error('Return Request Failed', error.message || 'Failed to submit return request');
    } finally {
      setSaving(false);
    }
  }, [selectedOrder, returnReason, returnNotes, returnProofFiles, saving, refetch, optimisticUpdate, toast]);

  // Accept return — assign pickup driver + date
  const handleAcceptReturn = useCallback((order) => {
    setAcceptReturnOrder(order);
    setPickupDriverId('');
    setIsAcceptReturnModalOpen(true);
    // Fetch staff drivers
    setLoadingPickupDrivers(true);
    apiClient.get('/users', { params: { role: 'staff' } }).then(res => {
      if (res.success) {
        const staffDrivers = (res.data?.data || res.data || []).filter(u => u.position === 'Driver' && u.status === 'active');
        setPickupDrivers(staffDrivers);
      }
    }).catch(err => console.error('Error fetching drivers:', err)).finally(() => setLoadingPickupDrivers(false));

    // Auto-estimate pickup date based on distance (like ship flow)
    const distKm = parseFloat(order.distance_km) || 0;
    if (distKm > 0) {
      const driveHours = distKm / 40;
      const totalHours = driveHours + 1;
      const baseDays = totalHours > 8 ? Math.ceil(totalHours / 8) : 1;
      const daysWithAllowance = baseDays + 1;
      const estimated = new Date();
      estimated.setDate(estimated.getDate() + daysWithAllowance);
      setPickupDate(estimated.toISOString().split('T')[0]);
    } else {
      const est = new Date();
      est.setDate(est.getDate() + 2);
      setPickupDate(est.toISOString().split('T')[0]);
    }
  }, []);

  const handleAcceptReturnConfirm = useCallback(async () => {
    if (!acceptReturnOrder || saving) return;
    setSaving(true);
    try {
      const selectedDriver = pickupDrivers.find(d => String(d.id) === pickupDriverId);
      const response = await apiClient.post(`/sales/${acceptReturnOrder.id}/return/accept`, {
        pickup_driver: selectedDriver?.name || null,
        pickup_plate: selectedDriver?.truck_plate_number || null,
        pickup_date: pickupDate || null,
      });
      if (response.success) {
        // Optimistic: mark as picking_up instantly
        optimisticUpdate(prev => prev.map(o => o.id === acceptReturnOrder.id ? { ...o, status: 'picking_up' } : o));
        invalidateCache('/sales');
        refetch();
        suppressNotifToasts();
        toast.success('Return Accepted', `Pickup assigned for order ${acceptReturnOrder.order_id}. Driver is on the way.`);
        // Fire-and-forget email
        apiClient.post(`/sales/${acceptReturnOrder.id}/status-email`).catch(() => {});
        setIsAcceptReturnModalOpen(false);
      } else {
        throw response;
      }
    } catch (error) {
      toast.error('Accept Failed', error.message || 'Failed to accept return');
    } finally {
      setSaving(false);
    }
  }, [acceptReturnOrder, pickupDriverId, pickupDrivers, pickupDate, saving, refetch, toast]);

  // Reject return — revert to delivered
  const handleRejectReturn = useCallback(async (order) => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiClient.post(`/sales/${order.id}/return/reject`);
      if (response.success) {
        // Optimistic: revert to delivered
        optimisticUpdate(prev => prev.map(o => o.id === order.id ? { ...o, status: 'delivered' } : o));
        invalidateCache('/sales');
        refetch();
        suppressNotifToasts();
        toast.success('Return Rejected', `Return rejected for order ${order.order_id}. Reverted to delivered.`);
      } else {
        throw response;
      }
    } catch (error) {
      toast.error('Reject Failed', error.message || 'Failed to reject return');
    } finally {
      setSaving(false);
    }
  }, [saving, refetch, toast]);

  // Open confirm modal for marking as returned
  const handleMarkReturned = useCallback((order) => {
    setMarkReturnOrder(order);
    setIsMarkReturnModalOpen(true);
  }, []);

  // Confirm mark as returned (stock restored)
  const handleConfirmMarkReturned = useCallback(async () => {
    if (saving || !markReturnOrder) return;
    setSaving(true);
    try {
      const response = await apiClient.post(`/sales/${markReturnOrder.id}/return/complete`);
      if (response.success) {
        // Optimistic: mark as returned instantly
        optimisticUpdate(prev => prev.map(o => o.id === markReturnOrder.id ? { ...o, status: 'returned' } : o));
        invalidateCache('/sales');
        invalidateCache('/products');
        refetch();
        suppressNotifToasts();
        toast.success('Order Returned', `Order ${markReturnOrder.order_id} has been returned. Use "Restock Items" to restore stock.`);
        // Fire-and-forget email
        apiClient.post(`/sales/${markReturnOrder.id}/status-email`).catch(() => {});
        setIsMarkReturnModalOpen(false);
        setMarkReturnOrder(null);
      } else {
        throw response;
      }
    } catch (error) {
      toast.error('Return Failed', error.message || 'Failed to mark as returned');
    } finally {
      setSaving(false);
    }
  }, [saving, markReturnOrder, refetch, toast]);

  // ─── Restock Items ───────────────────────────────────────

  const handleOpenRestock = useCallback((order) => {
    setRestockOrder(order);
    // Pre-select all un-restocked items at their full returned quantity
    const initialQtys = {};
    (order.items || []).filter(i => !i.restocked).forEach(i => {
      initialQtys[i.id] = i.quantity;
    });
    setRestockQuantities(initialQtys);
    setRestockNotes('');
    setIsRestockModalOpen(true);
  }, []);

  const handleConfirmRestock = useCallback(async () => {
    const selectedEntries = Object.entries(restockQuantities).filter(([, qty]) => qty > 0);
    if (saving || !restockOrder || selectedEntries.length === 0) return;
    setSaving(true);
    try {
      const items = selectedEntries.map(([id, quantity]) => ({ id: parseInt(id), quantity }));
      const payload = { items };
      if (restockNotes.trim()) payload.notes = restockNotes.trim();
      const response = await apiClient.post(`/sales/${restockOrder.id}/restock`, payload);
      if (response.success) {
        // Optimistic: mark restocked items
        optimisticUpdate(prev => prev.map(o => o.id === restockOrder.id ? { ...o, restocked: true } : o));
        invalidateCache('/sales');
        invalidateCache('/products');
        invalidateCache('/stock-logs');
        refetch();
        suppressNotifToasts();
        toast.success('Items Restocked', `${items.length} item(s) have been restocked.`);
        setIsRestockModalOpen(false);
        setRestockOrder(null);
        setRestockQuantities({});
        setRestockNotes('');
      } else {
        throw response;
      }
    } catch (error) {
      toast.error('Restock Failed', error.message || 'Failed to restock items');
    } finally {
      setSaving(false);
    }
  }, [saving, restockOrder, restockQuantities, restockNotes, refetch, toast]);

  // ─── Batch Print Selected Orders ─────────────────────────

  const handleBatchPrint = useCallback(() => {
    if (selectedOrderIds.length === 0) {
      toast.error('No Orders Selected', 'Please select at least one order to print.');
      return;
    }
    
    // Get the full order objects for selected IDs
    const selectedOrders = mappedOrders.filter(o => selectedOrderIds.includes(o.id));
    
    if (selectedOrders.length === 0) {
      toast.error('Orders Not Found', 'Selected orders could not be found.');
      return;
    }

    const bizName = bizSettings?.business_name || 'KJP Ricemill';
    printBatchReceipts(selectedOrders, bizName);
    
    // Clear selection after printing
    setSelectedOrderIds([]);
  }, [selectedOrderIds, mappedOrders, bizSettings, toast]);

  // ─── Mark as Paid ────────────────────────────────────────

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

  const handleConfirmPay = useCallback(async () => {
    if (saving || !payOrder) return;
    if (payMethod === 'cash' && (!payCashTendered || parseFloat(payCashTendered) < payOrder.total)) return;
    if (payMethod === 'gcash' && (!payGcashRef.trim() || payGcashRef.replace(/\s/g, '').length !== 13 || payGcashRefError)) return;

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('payment_method', payMethod);
      if (payMethod === 'cash') {
        formData.append('amount_tendered', parseFloat(payCashTendered));
      }
      if (payMethod === 'gcash' && payGcashRef) {
        formData.append('reference_number', payGcashRef);
      }
      payProofFiles.forEach(file => formData.append('payment_proof[]', file));

      const response = await apiClient.post(`/sales/${payOrder.id}/pay`, formData);
      if (response.success) {
        // Optimistic: mark as paid instantly
        optimisticUpdate(prev => prev.map(o => o.id === payOrder.id ? { ...o, payment_status: 'paid', payment_method: payMethod } : o));
        invalidateCache('/sales');
        refetch();
        suppressNotifToasts();
        toast.success('Payment Recorded', `Order ${payOrder.order_id} has been marked as paid.`);
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
      setSaving(false);
    }
  }, [saving, payOrder, payMethod, payCashTendered, payGcashRef, payProofFiles, refetch, toast, stopPayCamera]);

  // ─── Chart Helpers ────────────────────────────────────────

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

  // Helper: checks if an order matches the active chart point filter
  const matchesChartPoint = useCallback((o) => {
    if (!activeChartPoint || !o.date) return true;
    const date = new Date(o.date);
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

  // Helper: check if an order date falls within the current chart scope
  const isInChartScope = useCallback((o) => {
    if (!o.date) return false;
    const date = new Date(o.date);
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

  // Chart-filtered orders — used for stats, cards, table (scoped by calendar + dot)
  const chartFilteredOrders = useMemo(() => {
    if (!chartScopeActive && !activeChartPoint) return mappedOrders;
    const scoped = mappedOrders.filter(isInChartScope);
    if (!activeChartPoint) return scoped;
    return scoped.filter(matchesChartPoint);
  }, [mappedOrders, isInChartScope, activeChartPoint, matchesChartPoint, chartScopeActive]);

  const chartFilteredOrdersByTab = useMemo(() => {
    let result;
    if (activeStatusTab === 'All') {
      result = [...chartFilteredOrders].sort((a, b) => (ORDER_STATUS_SORT[a.status] ?? 99) - (ORDER_STATUS_SORT[b.status] ?? 99));
    } else {
      const statuses = getTabStatuses(activeStatusTab);
      result = chartFilteredOrders.filter(o => statuses.includes(o.status));
    }
    if (statusSubFilter) result = result.filter(o => o.status === statusSubFilter);
    if (payStatusFilter) result = result.filter(o => (o.payment_status || 'paid') === payStatusFilter);
    if (payMethodFilter) result = result.filter(o => o.raw_payment_method === payMethodFilter);
    return result;
  }, [chartFilteredOrders, activeStatusTab, statusSubFilter, payStatusFilter, payMethodFilter]);

  // ─── Stats ───────────────────────────────────────────────

  const totalRevenue = chartFilteredOrders.filter(o => o.status === 'Delivered' || o.status === 'Completed').reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = chartFilteredOrders.filter(o => o.status === 'Pending').length;
  const deliveredOrders = chartFilteredOrders.filter(o => o.status === 'Delivered' || o.status === 'Completed').length;
  const totalItems = chartFilteredOrders.reduce((sum, o) => sum + o.total_quantity, 0);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (chartPeriod === 'daily') {
      const [y, m] = chartMonth.split('-').map(Number);
      const daysInMonth = getDaysInMonth(y, m - 1);
      const dayGroups = {};
      mappedOrders.forEach(o => {
        if (!o.date) return;
        const date = new Date(o.date);
        if (date.getFullYear() === y && date.getMonth() === m - 1) {
          const day = date.getDate();
          if (!dayGroups[day]) dayGroups[day] = 0;
          dayGroups[day] += o.total;
        }
      });
      return Array.from({ length: daysInMonth }, (_, i) => ({
        name: String(i + 1),
        value: dayGroups[i + 1] || 0,
      }));
    }
    if (chartPeriod === 'weekly') {
      const [y, m] = chartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      return weeks.map(week => {
        let value = 0;
        mappedOrders.forEach(o => {
          if (!o.date) return;
          const date = new Date(o.date);
          if (date >= week.start && date <= new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59)) {
            value += o.total;
          }
        });
        return { name: week.label, value };
      });
    }
    if (chartPeriod === 'monthly') {
      const monthGroups = {};
      mappedOrders.forEach(o => {
        if (!o.date) return;
        const date = new Date(o.date);
        if (date.getFullYear() === chartYear) {
          const month = date.getMonth();
          if (!monthGroups[month]) monthGroups[month] = 0;
          monthGroups[month] += o.total;
        }
      });
      return months.map((name, i) => ({ name, value: monthGroups[i] || 0 }));
    }
    if (chartPeriod === 'bi-annually') {
      const h1 = { value: 0 }, h2 = { value: 0 };
      mappedOrders.forEach(o => {
        if (!o.date) return;
        const date = new Date(o.date);
        if (date.getFullYear() === chartYear) {
          (date.getMonth() < 6 ? h1 : h2).value += o.total;
        }
      });
      return [
        { name: 'H1', fullName: `Jan - Jun ${chartYear}`, value: h1.value },
        { name: 'H2', fullName: `Jul - Dec ${chartYear}`, value: h2.value },
      ];
    }
    // annually
    const years = [];
    for (let y = chartYearFrom; y <= chartYearTo; y++) years.push(y);
    const yearGroups = {};
    mappedOrders.forEach(o => {
      if (!o.date) return;
      const date = new Date(o.date);
      const year = date.getFullYear();
      if (year >= chartYearFrom && year <= chartYearTo) {
        if (!yearGroups[year]) yearGroups[year] = 0;
        yearGroups[year] += o.total;
      }
    });
    return years.map(year => ({ name: year.toString(), value: yearGroups[year] || 0 }));
  }, [mappedOrders, chartPeriod, chartMonth, chartYear, chartYearFrom, chartYearTo, getWeeksInMonth]);

  const avgPerDay = useMemo(() => {
    const now = new Date();
    const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth());
    const monthOrders = mappedOrders.filter(o => {
      const date = new Date(o.date);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }).length;
    return Math.round(monthOrders / daysInMonth * 10) / 10;
  }, [mappedOrders]);

  const statusBreakdown = useMemo(() => [
    { name: 'Delivered', value: chartFilteredOrders.filter(o => o.status === 'Delivered').length, color: '#22c55e' },
    { name: 'Pending', value: chartFilteredOrders.filter(o => o.status === 'Pending').length, color: '#eab308' },
    { name: 'Processing', value: chartFilteredOrders.filter(o => o.status === 'Processing').length, color: '#3b82f6' },
    { name: 'Shipped', value: chartFilteredOrders.filter(o => o.status === 'Shipped').length, color: '#a855f7' },
    { name: 'Return Requested', value: chartFilteredOrders.filter(o => o.status === 'Return Requested').length, color: '#f97316' },
    { name: 'Picking Up', value: chartFilteredOrders.filter(o => o.status === 'Picking Up').length, color: '#f59e0b' },
    { name: 'Picked Up', value: chartFilteredOrders.filter(o => o.status === 'Picked Up').length, color: '#d97706' },
    { name: 'Returned', value: chartFilteredOrders.filter(o => o.status === 'Returned').length, color: '#fb923c' },
    { name: 'Cancelled', value: chartFilteredOrders.filter(o => o.status === 'Cancelled').length, color: '#ef4444' },
  ], [chartFilteredOrders]);

  const paymentBreakdown = useMemo(() => {
    const groups = {};
    const colors = { 'Cash': '#22c55e', 'GCash': '#3b82f6', 'COD': '#f59e0b' };
    chartFilteredOrders.forEach(o => {
      if (!groups[o.payment_method]) groups[o.payment_method] = 0;
      groups[o.payment_method]++;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value, color: colors[name] || '#6b7280' }));
  }, [chartFilteredOrders]);

  // Next status label for progress button
  const getNextAction = (rawSt, isDelivery) => {
    if (rawSt === 'pending') return { label: 'Process', icon: PlayCircle, color: 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:text-blue-400' };
    if (rawSt === 'processing') {
      if (isDelivery) return { label: 'Ship', icon: Truck, color: 'text-button-500 hover:bg-button-50 dark:hover:bg-button-900/20 hover:text-button-600 dark:hover:text-button-400 dark:text-button-400' };
      return { label: 'Complete', icon: CheckCircle, color: 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:text-emerald-400' };
    }
    if (rawSt === 'shipped') return { label: 'Deliver', icon: CheckCircle, color: 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:text-green-400' };
    if (rawSt === 'picking_up') return { label: 'Confirm Picked Up', icon: PackageCheck, color: 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:text-orange-400' };
    return null;
  };

  // Hide Actions column for tabs that have no actions
  const tabsWithNoActions = ['Cancelled'];
  const showActions = !tabsWithNoActions.includes(activeStatusTab);

  const baseColumns = [
    { header: 'Order ID', accessor: 'order_id' },
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
    { header: 'Total', accessor: 'total', cell: (row) => `₱${row.total.toLocaleString()}` },
    { header: 'Payment', accessor: 'payment_method', cell: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs">{row.payment_method}</span>
        {row.payment_status === 'not_paid' && (
          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 w-fit">Not Paid</span>
        )}
      </div>
    )},
    { header: 'Date', accessor: 'date', cell: (row) => row.date_formatted },
    { header: 'Type', accessor: 'type', cell: (row) => (
      row.is_delivery ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
          <Truck size={10} /> Delivery
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
          <Store size={10} /> Pick Up
        </span>
      )
    )},
    { header: 'Status', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
  ];

  const actionsColumn = {
    header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => {
      const nextAction = getNextAction(row.raw_status, row.is_delivery);
      const canVoid = row.raw_status === 'completed' && !row.is_delivery;
      const hasAnyAction = nextAction || canVoid ||
        row.raw_status === 'pending' || row.raw_status === 'processing' ||
        row.raw_status === 'delivered' || row.raw_status === 'return_requested' ||
        row.raw_status === 'picking_up' || row.raw_status === 'picked_up' || row.raw_status === 'returned' ||
        (row.raw_status === 'voided' && (row.items || []).some(i => !i.restocked)) ||
        row.payment_status === 'not_paid';

      if (!hasAnyAction) return null;

      return (
        <div className="flex items-center gap-1">
          {nextAction && (
            <button
              onClick={() => handleProgressStatus(row)}
              disabled={saving}
              className={`p-1.5 rounded-lg transition-colors ${nextAction.color} disabled:opacity-50`}
              title={nextAction.label}
            >
              <nextAction.icon size={15} />
            </button>
          )}
          {(row.raw_status === 'pending' || row.raw_status === 'processing') && (
            <button
              onClick={() => handleCancel(row)}
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:text-red-400 transition-colors"
              title="Cancel Order"
            >
              <Ban size={15} />
            </button>
          )}
          {row.raw_status === 'delivered' && (
            <button
              onClick={() => handleReturn(row)}
              className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:text-orange-400 transition-colors"
              title="Request Return"
            >
              <RotateCcw size={15} />
            </button>
          )}
          {row.raw_status === 'return_requested' && (
            <>
              <button
                onClick={() => handleAcceptReturn(row)}
                disabled={saving}
                className="p-1.5 rounded-lg text-button-500 hover:bg-button-50 dark:hover:bg-button-900/20 hover:text-button-600 dark:hover:text-button-400 dark:text-button-400 transition-colors disabled:opacity-50"
                title="Accept Return"
              >
                <CheckCircle size={15} />
              </button>
              <button
                onClick={() => setRejectReturnOrder(row)}
                disabled={saving}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:text-red-400 transition-colors disabled:opacity-50"
                title="Reject Return"
              >
                <XCircle size={15} />
              </button>
            </>
          )}
          {row.raw_status === 'picked_up' && (
            <button
              onClick={() => handleMarkReturned(row)}
              disabled={saving}
              className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:text-orange-400 transition-colors disabled:opacity-50"
              title="Mark as Returned"
            >
              <RotateCcw size={15} />
            </button>
          )}
          {(row.raw_status === 'returned' || row.raw_status === 'voided') && (row.items || []).some(i => !i.restocked) && (
            <button
              onClick={() => handleOpenRestock(row)}
              disabled={saving}
              className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:text-green-400 transition-colors disabled:opacity-50"
              title="Restock Items"
            >
              <Package size={15} />
            </button>
          )}
          {row.payment_status === 'not_paid' && row.raw_status !== 'cancelled' && row.raw_status !== 'returned' && (
            <button
              onClick={() => handleOpenPayModal(row)}
              disabled={saving}
              className="p-1.5 rounded-lg text-button-500 hover:bg-button-50 dark:hover:bg-button-900/20 hover:text-button-600 dark:hover:text-button-400 dark:text-button-400 transition-colors disabled:opacity-50"
              title="Mark as Paid"
            >
              <Banknote size={15} />
            </button>
          )}
          {canVoid && (
            <button
              onClick={() => { setVoidOrder(row); setVoidReason(''); setVoidPassword(''); setIsVoidModalOpen(true); }}
              disabled={saving}
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:text-red-400 transition-colors disabled:opacity-50"
              title="Void Order"
            >
              <CircleSlash size={15} />
            </button>
          )}
          <button
            onClick={() => handlePrintReceipt(row)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:text-gray-400 transition-colors"
            title="Print Receipt"
          >
            <Printer size={15} />
          </button>
        </div>
      );
    },
  };

  const columns = [...baseColumns, actionsColumn];

  return (
    <div>
      <PageHeader title="Orders" description="Manage customer orders" icon={ClipboardList} />

      {/* Stats Cards */}
      {loading ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Revenue" value={`₱${totalRevenue.toLocaleString()}`} unit="delivered" icon={DollarSign} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <StatsCard label="Total Orders" value={mappedOrders.length} unit="orders" icon={ClipboardList} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <StatsCard label="Pending" value={pendingOrders} unit="awaiting" icon={Clock} iconBgColor="bg-gradient-to-br from-yellow-400 to-yellow-600" />
          <StatsCard label="Delivered" value={deliveredOrders} unit="completed" icon={CheckCircle} iconBgColor="bg-gradient-to-br from-green-400 to-green-600" />
        </div>
      )}

      {/* Charts */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2">
            <LineChart
              title="Order Trends"
              subtitle={activeChartPoint ? `Filtered: ${activeChartPoint} — click dot again to clear` : !chartScopeActive ? 'Revenue from customer orders' : 'Filtered by chart scope'}
              data={chartData}
              lines={[{ dataKey: 'value', name: 'Revenue (₱)' }]}
              height={280}
              yAxisUnit="₱"
              headerRight={
                <div className="flex items-center gap-2 flex-wrap">
                  {(activeChartPoint || chartScopeActive) && (
                    <button
                      onClick={() => { setActiveChartPoint(null); setChartScopeActive(false); setChartPeriod('daily'); const d = new Date(); setChartMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); setChartYear(d.getFullYear()); setChartYearFrom(d.getFullYear() - 4); setChartYearTo(d.getFullYear()); }}
                      className="px-2 py-1 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                      ✕ Reset
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
              onDotClick={setActiveChartPoint}
              activePoint={activeChartPoint}
              summaryStats={[
                { label: 'Total Revenue', value: `₱${totalRevenue.toLocaleString()}`, color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Avg/Day', value: `${avgPerDay} orders`, color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Items Ordered', value: totalItems.toString(), color: 'text-green-600 dark:text-green-400' },
              ]}
            />
          </div>
          <div className="space-y-4">
            <DonutChart title="Order Status" subtitle="Breakdown by status" data={statusBreakdown} centerValue={chartFilteredOrders.length} centerLabel="Orders" height={175} innerRadius={56} outerRadius={78} valueUnit="" horizontalLegend={true} compactLegend={true} />
            <DonutChart title="Payment Method" subtitle="Breakdown by payment" data={paymentBreakdown} centerValue={chartFilteredOrders.length} centerLabel="Orders" height={140} innerRadius={45} outerRadius={62} valueUnit="" horizontalLegend={true} />
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={8} columns={8} />
      ) : (
        <>
          {/* Status Tabs */}
          <div className="bg-white dark:bg-gray-700 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 mb-0 rounded-b-none border-b-0">
            <div className="px-4 pt-4 pb-0">
              <div className="flex items-center gap-1 overflow-x-auto pb-0 scrollbar-hide">
                {statusTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeStatusTab === tab.value;
                  const count = tab.value === 'All' ? mappedOrders.length : mappedOrders.filter(o => (tab.statuses || [tab.value]).includes(o.status)).length;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => { setActiveStatusTab(tab.value); setStatusSubFilter(''); }}
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
            title="Order Records"
            subtitle={activeStatusTab === 'All' ? 'All customer orders' : statusSubFilter ? `Showing ${statusSubFilter.toLowerCase()} orders` : `Showing ${activeStatusTab.toLowerCase()} orders`}
            columns={columns}
            data={chartFilteredOrdersByTab}
            searchPlaceholder="Search orders..."
            dateFilterField="date"
            onRowDoubleClick={handleView}
            selectable={true}
            selectedRows={selectedOrderIds}
            onSelectionChange={setSelectedOrderIds}
            headerRight={
              <div className="flex items-center gap-2 flex-wrap">
                {selectedOrderIds.length > 0 && (
                  <button
                    onClick={handleBatchPrint}
                    className="flex items-center gap-2 px-3 py-2 bg-button-500 hover:bg-button-600 text-white rounded-lg transition-colors text-sm font-medium shadow-md"
                  >
                    <Printer size={16} />
                    Print Selected ({selectedOrderIds.length})
                  </button>
                )}
                {activeStatusTab === 'Delivered & Completed' && (
                  <select
                    value={statusSubFilter}
                    onChange={e => setStatusSubFilter(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-lg border border-primary-200 dark:border-primary-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-button-500"
                  >
                    <option value="">All (Delivered & Completed)</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Completed">Completed</option>
                  </select>
                )}
                {activeStatusTab === 'Returns & Cancelled' && (
                  <select
                    value={statusSubFilter}
                    onChange={e => setStatusSubFilter(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-lg border border-primary-200 dark:border-primary-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-button-500"
                  >
                    <option value="">All (Returns & Cancelled)</option>
                    <option value="Return Requested">Return Requested</option>
                    <option value="Picking Up">Picking Up</option>
                    <option value="Picked Up">Picked Up</option>
                    <option value="Returned">Returned</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Voided">Voided</option>
                  </select>
                )}
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

      {/* View Order Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Order Details — ${selectedOrder?.order_id || ''}`}
        size="full"
        footer={
          <div className="flex gap-3 justify-end">
            {(selectedOrder?.raw_status === 'returned' || selectedOrder?.raw_status === 'voided') && (selectedOrder.items || []).some(i => !i.restocked) && (
              <button
                onClick={() => { setIsViewModalOpen(false); handleOpenRestock(selectedOrder); }}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Package size={16} /> Restock Items
              </button>
            )}
            <button
              onClick={() => handlePrintReceipt(selectedOrder)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Printer size={16} /> Print Receipt
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
        {selectedOrder && (
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Left Column — Order Info */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Header with Order ID & Status */}
              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-primary-50 dark:from-gray-700 to-button-50 dark:to-gray-700 rounded-xl border-2 border-primary-200 dark:border-primary-700">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-button-500 text-white rounded-lg">
                    <Receipt size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{selectedOrder.order_id}</h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{selectedOrder.date_formatted}</p>
                  </div>
                </div>
                <StatusBadge status={selectedOrder.status} />
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {/* Customer */}
                <div className="flex items-center gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <User size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-gray-400 uppercase">Customer</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{selectedOrder.customer}</p>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="flex items-center gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className={`p-1 rounded-md ${selectedOrder.payment_status === 'not_paid' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                    <CreditCard size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-gray-400 uppercase">Payment</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{selectedOrder.payment_method}</p>
                    {selectedOrder.payment_status === 'not_paid' ? (
                      <span className="inline-flex px-1 py-0.5 text-[9px] font-semibold rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">Not Paid</span>
                    ) : selectedOrder.paid_at_formatted && (
                      <p className="text-[9px] text-gray-400">Paid: {selectedOrder.paid_at_formatted}</p>
                    )}
                  </div>
                </div>

                {/* Order Type */}
                <div className="flex items-center gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className={`p-1 rounded-md ${selectedOrder.is_delivery ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                    {selectedOrder.is_delivery ? <Truck size={12} /> : <Store size={12} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-gray-400 uppercase">Type</p>
                    <p className={`text-xs font-semibold ${selectedOrder.is_delivery ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {selectedOrder.is_delivery ? 'Delivery' : 'Pick Up'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Proof Images */}
              {selectedOrder.payment_proof?.length > 0 && (
                <div className="bg-button-50 dark:bg-gray-700 rounded-lg p-2 border border-button-200 dark:border-button-700">
                  <p className="text-[10px] font-bold text-button-600 dark:text-button-400 uppercase tracking-wide mb-1.5">Payment Proof</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedOrder.payment_proof.map((url, idx) => (
                      <img
                        key={idx}
                        src={resolveStorageUrl(url)}
                        alt={`Payment proof ${idx + 1}`}
                        className="w-[60px] h-[60px] object-cover rounded-lg border border-button-200 dark:border-button-700 cursor-pointer hover:opacity-80"
                        onClick={() => setPreviewProofImage(resolveStorageUrl(url))}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery Address */}
              {selectedOrder.delivery_address && (
                <div className="flex items-start gap-2 p-2 bg-button-50 dark:bg-gray-700 rounded-lg border border-button-200 dark:border-button-700">
                  <div className="p-1 rounded-md bg-button-100 dark:bg-button-800/50 text-button-600 dark:text-button-400">
                    <MapPin size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-button-600 dark:text-button-400 uppercase">Delivery Address</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{selectedOrder.delivery_address}</p>
                    {selectedOrder.distance_km && (
                      <p className="text-[10px] text-button-500 dark:text-button-400">{parseFloat(selectedOrder.distance_km).toFixed(1)} km from warehouse</p>
                    )}
                  </div>
                </div>
              )}

              {/* Assigned Driver */}
              {selectedOrder.driver_name && (
                <div className="flex items-center gap-2 p-2 bg-button-50 dark:bg-gray-700 rounded-lg border border-button-200 dark:border-button-700">
                  <div className="w-7 h-7 bg-button-200 dark:bg-button-800/50 rounded-full flex items-center justify-center">
                    <User size={12} className="text-button-600 dark:text-button-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-button-600 dark:text-button-400 uppercase">Assigned Driver</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{selectedOrder.driver_name}</p>
                  </div>
                  {selectedOrder.driver_plate_number && (
                    <span className="text-[10px] font-bold text-button-600 dark:text-button-400 bg-button-100 dark:bg-button-800/50 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                      <Truck size={9} /> {selectedOrder.driver_plate_number}
                    </span>
                  )}
                </div>
              )}

              {/* Delivery Proof Images */}
              {selectedOrder.delivery_proof?.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2.5 border border-green-200 dark:border-green-700">
                  <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wide mb-1.5">Proof of Delivery</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.delivery_proof.map((url, idx) => (
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

              {/* Notes / Void Reason */}
              {selectedOrder.notes && selectedOrder.raw_status !== 'voided' && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-gray-700 rounded-lg border border-amber-200 dark:border-amber-700">
                  <div className="p-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                    <StickyNote size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase">Order Notes</p>
                    <p className="text-xs text-gray-700 dark:text-gray-200">{selectedOrder.notes}</p>
                  </div>
                </div>
              )}

              {/* Void Reason */}
              {selectedOrder.raw_status === 'voided' && (
                <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-gray-700 rounded-lg border border-red-200 dark:border-red-700">
                  <div className="p-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <Ban size={12} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase">Void Information</p>
                    {selectedOrder.notes && (
                      <p className="text-xs text-gray-700 dark:text-gray-200"><span className="font-semibold">Reason:</span> {selectedOrder.notes}</p>
                    )}
                    {selectedOrder.voided_by && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400"><span className="font-medium">Voided by:</span> {selectedOrder.voided_by}</p>
                    )}
                    {selectedOrder.authorized_by && selectedOrder.authorized_by !== selectedOrder.voided_by && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400"><span className="font-medium">Authorized by:</span> {selectedOrder.authorized_by}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Return Info */}
              {selectedOrder.return_reason && (
                <div className="p-2 bg-orange-50 dark:bg-gray-700 rounded-lg border border-orange-200 dark:border-orange-700">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="p-1 rounded-md bg-orange-100 dark:bg-orange-800/50 text-orange-600 dark:text-orange-400">
                      <RotateCcw size={12} />
                    </div>
                    <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase">Return Information</p>
                  </div>
                  <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">{selectedOrder.return_reason}</p>
                  {selectedOrder.return_notes && (
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-0.5 italic">{selectedOrder.return_notes}</p>
                  )}
                  {selectedOrder.return_proof?.length > 0 && (
                    <div className="mt-1.5">
                      <p className="text-[10px] font-medium text-orange-600 dark:text-orange-400 mb-1">Proof {selectedOrder.return_proof.length > 1 ? 'Images' : 'Image'}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedOrder.return_proof.map((url, idx) => (
                          <img
                            key={idx}
                            src={resolveStorageUrl(url)}
                            alt={`Return proof ${idx + 1}`}
                            className="w-[60px] h-[60px] object-cover rounded-lg border border-orange-200 dark:border-orange-700 cursor-pointer hover:opacity-80"
                            onClick={() => setPreviewProofImage(resolveStorageUrl(url))}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedOrder.return_pickup_driver && (
                    <div className="mt-1.5 pt-1.5 border-t border-orange-200 dark:border-orange-700 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="text-[10px] text-orange-700 dark:text-orange-300 flex items-center gap-1">
                        <Truck size={10} className="text-orange-500" />
                        <span className="font-semibold">Pickup:</span> {selectedOrder.return_pickup_driver}
                        {selectedOrder.return_pickup_plate && ` — ${selectedOrder.return_pickup_plate}`}
                      </span>
                      {selectedOrder.return_pickup_date_formatted && (
                        <span className="text-[10px] text-orange-700 dark:text-orange-300 flex items-center gap-1">
                          <Calendar size={10} className="text-orange-500" />
                          <span className="font-semibold">Est.:</span> {selectedOrder.return_pickup_date_formatted}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column — Items Table & Total */}
            <div className="lg:w-[380px] shrink-0">
              {/* Items Table */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Order Items</p>
                <div className="rounded-xl border-2 border-primary-200 dark:border-primary-700 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-primary-50 dark:bg-primary-900/20">
                      <tr>
                        <th className="text-left px-2.5 py-1.5 text-[10px] font-semibold text-gray-600 dark:text-gray-300">Product</th>
                        <th className="text-center px-2 py-1.5 text-[10px] font-semibold text-gray-600 dark:text-gray-300">Qty</th>
                        <th className="text-right px-2 py-1.5 text-[10px] font-semibold text-gray-600 dark:text-gray-300">Price</th>
                        <th className="text-right px-2.5 py-1.5 text-[10px] font-semibold text-gray-600 dark:text-gray-300">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {(selectedOrder.items || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700/50">
                          <td className="px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.variety_color || '#6B7280' }} />
                              <div>
                                <span className="text-gray-800 dark:text-gray-100 text-xs font-medium">{item.product_name || item.name}{item.weight_formatted ? ` (${item.weight_formatted})` : ''}</span>
                                {item.variety_name && <p className="text-[10px] text-gray-500 dark:text-gray-400">{item.variety_name}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center text-gray-600 dark:text-gray-300 text-xs">{item.quantity}</td>
                          <td className="px-2 py-1.5 text-right text-gray-600 dark:text-gray-300 text-xs">₱{(item.unit_price || item.price || 0).toLocaleString()}</td>
                          <td className="px-2.5 py-1.5 text-right font-semibold text-gray-800 dark:text-gray-100 text-xs">₱{(item.subtotal || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                      {selectedOrder.delivery_fee > 0 && (
                        <tr>
                          <td colSpan={3} className="px-2.5 py-1 text-right text-[10px] text-gray-500 dark:text-gray-400">Delivery Fee</td>
                          <td className="px-2.5 py-1 text-right text-[10px] text-gray-600 dark:text-gray-300">₱{selectedOrder.delivery_fee.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedOrder.discount > 0 && (
                        <tr>
                          <td colSpan={3} className="px-2.5 py-1 text-right text-[10px] text-gray-500 dark:text-gray-400">Discount</td>
                          <td className="px-2.5 py-1 text-right text-[10px] text-red-500">-₱{selectedOrder.discount.toLocaleString()}</td>
                        </tr>
                      )}
                      <tr className="border-t border-gray-200 dark:border-gray-600">
                        <td colSpan={3} className="px-2.5 py-2 text-right text-xs font-bold text-gray-600 dark:text-gray-300">Total</td>
                        <td className="px-2.5 py-2 text-right font-bold text-gray-800 dark:text-gray-100">₱{selectedOrder.total.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleCancelConfirm}
        title="Cancel Order"
        message={`Are you sure you want to cancel "${selectedOrder?.order_id}"?${selectedOrder?.raw_status === 'processing' ? ' Stock will be restored.' : ''}`}
        confirmText={saving ? 'Cancelling...' : 'Cancel Order'}
        variant="danger"
        icon={Ban}
      />

      {/* Reject Return Confirmation Modal */}
      <ConfirmModal
        isOpen={!!rejectReturnOrder}
        onClose={() => setRejectReturnOrder(null)}
        onConfirm={() => { handleRejectReturn(rejectReturnOrder); setRejectReturnOrder(null); }}
        title="Reject Return"
        message={`Are you sure you want to reject the return request for "${rejectReturnOrder?.order_id}"? The order will be reverted to delivered status.`}
        confirmText={saving ? 'Rejecting...' : 'Reject Return'}
        variant="danger"
        icon={XCircle}
        isLoading={saving}
      />

      {/* Return Request Modal */}
      <FormModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onSubmit={handleReturnConfirm}
        title={`Request Return — ${selectedOrder?.order_id || ''}`}
        submitText={saving ? 'Submitting...' : 'Submit Return Request'}
        size="md"
        loading={saving}
      >
        {({ submitted }) => (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Customer</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{selectedOrder?.customer}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">₱{selectedOrder?.total?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Current Status</p>
                <StatusBadge status={selectedOrder?.status} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Items</p>
                <p className="text-sm text-gray-800 dark:text-gray-100">{selectedOrder?.items_count} item(s)</p>
              </div>
            </div>

            {selectedOrder?.items && selectedOrder.items.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Items to Return</p>
                <div className="rounded-lg border border-primary-200 dark:border-primary-700 overflow-hidden">
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-gray-800 dark:text-gray-100">{item.product_name || item.name}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">×{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <FormSelect
              label="Return Reason"
              name="returnReason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              options={[
                { value: 'Damaged Product', label: 'Damaged Product' },
                { value: 'Wrong Item', label: 'Wrong Item Received' },
                { value: 'Quality Issue', label: 'Quality Issue' },
                { value: 'Excess Order', label: 'Excess Order / Overstock' },
                { value: 'Customer Changed Mind', label: 'Customer Changed Mind' },
                { value: 'Other', label: 'Other' },
              ]}
              required
              submitted={submitted}
            />

            <FormInput
              label="Additional Notes (Optional)"
              name="returnNotes"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder="Any additional details about the return..."
            />

            {/* Proof Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Proof Images <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-2">Upload photos showing the reason for return (damaged item, wrong product, etc.)</p>
              {returnProofPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {returnProofPreviews.map((preview, idx) => (
                    <div key={idx} className="relative inline-block">
                      <img src={preview} alt={`Proof ${idx + 1}`} className="w-[100px] h-[100px] object-cover rounded-lg border-2 border-primary-200 dark:border-primary-700" />
                      <button
                        type="button"
                        onClick={() => {
                          setReturnProofFiles(prev => prev.filter((_, i) => i !== idx));
                          setReturnProofPreviews(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 transition-colors">
                <div className="text-center">
                  <ImageIcon size={20} className="mx-auto text-gray-400 mb-1" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">{returnProofPreviews.length > 0 ? 'Add more photos' : 'Click to upload proof'}</p>
                </div>
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
              {submitted && returnProofFiles.length === 0 && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">Please upload at least one proof image</p>
              )}
            </div>
          </div>
        )}
      </FormModal>

      {/* Accept Return Modal — Assign Pickup Driver & Date */}
      <Modal
        isOpen={isAcceptReturnModalOpen}
        onClose={() => setIsAcceptReturnModalOpen(false)}
        title={`Accept Return — ${acceptReturnOrder?.order_id || ''}`}
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setIsAcceptReturnModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAcceptReturnConfirm}
              disabled={saving}
              className="px-4 py-2 bg-button-500 hover:bg-button-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {saving ? 'Processing...' : 'Accept & Assign Pickup'}
            </button>
          </div>
        }
      >
        {acceptReturnOrder && (
          <div className="space-y-4">
            {/* Order Summary */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Customer</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{acceptReturnOrder.customer}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">₱{acceptReturnOrder.total?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Items</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{acceptReturnOrder.items_count} item{acceptReturnOrder.items_count > 1 ? 's' : ''} ({acceptReturnOrder.total_quantity} pcs)</p>
                </div>
              </div>
              {acceptReturnOrder.delivery_address && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pickup Address (customer delivery address)</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{acceptReturnOrder.delivery_address}</p>
                  {acceptReturnOrder.distance_km && (
                    <p className="text-xs text-gray-400 mt-0.5">{parseFloat(acceptReturnOrder.distance_km).toFixed(1)} km from warehouse</p>
                  )}
                </div>
              )}
            </div>

            {/* Return Reason */}
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-700">
              <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">Return Reason</p>
              <p className="text-sm font-semibold text-orange-800">{acceptReturnOrder.return_reason}</p>
              {acceptReturnOrder.return_notes && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 italic">{acceptReturnOrder.return_notes}</p>
              )}
              {acceptReturnOrder.return_proof?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">Proof {acceptReturnOrder.return_proof.length > 1 ? 'Images' : 'Image'}</p>
                  <div className="flex flex-wrap gap-2">
                    {acceptReturnOrder.return_proof.map((url, idx) => (
                      <img
                        key={idx}
                        src={resolveStorageUrl(url)}
                        alt={`Return proof ${idx + 1}`}
                        className="w-[100px] h-[100px] object-cover rounded-lg border border-orange-200 dark:border-orange-700 cursor-pointer hover:opacity-80"
                        onClick={() => setPreviewProofImage(resolveStorageUrl(url))}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Items being returned */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Items to be returned (stock will be restored upon completion)</p>
              <div className="rounded-lg border border-primary-200 dark:border-primary-700 overflow-hidden">
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(acceptReturnOrder.items || []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.variety_color || '#6B7280' }} />
                        <span className="text-sm text-gray-800 dark:text-gray-100">{item.product_name || item.name}</span>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pickup Driver Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Assign Pickup Driver *</label>
              <p className="text-xs text-gray-400 mb-2">Select a driver to pick up the returned items from the customer.</p>
              {loadingPickupDrivers ? (
                <div className="flex items-center gap-2 p-4 text-gray-500 dark:text-gray-400">
                  <Loader2 size={18} className="animate-spin" /> Loading drivers...
                </div>
              ) : pickupDrivers.length === 0 ? (
                <p className="text-sm text-red-500 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">No active drivers available. Please add drivers first.</p>
              ) : (
                <>
                  <select
                    value={pickupDriverId}
                    onChange={(e) => setPickupDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="">Select driver...</option>
                    {pickupDrivers.map(driver => (
                      <option key={driver.id} value={String(driver.id)}>
                        {driver.name}{driver.truck_plate_number ? ` — ${driver.truck_plate_number}` : ''}
                      </option>
                    ))}
                  </select>
                  {pickupDriverId && (() => {
                    const d = pickupDrivers.find(dr => String(dr.id) === pickupDriverId);
                    if (!d) return null;
                    return (
                      <div className="mt-2 flex items-center gap-3 p-2.5 bg-button-50 dark:bg-button-900/20 border border-button-200 dark:border-button-700 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-button-200 flex items-center justify-center text-button-700 dark:text-button-300 font-bold text-sm">
                          {d.name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{d.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{d.phone || d.email || 'No contact'}</p>
                        </div>
                        {d.truck_plate_number && (
                          <span className="text-xs font-bold text-button-600 dark:text-button-400 bg-button-100 dark:bg-button-900/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                            <Truck size={10} /> {d.truck_plate_number}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Estimated Pickup Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Estimated Pickup Date *</label>
              <input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              />
              {acceptReturnOrder && (() => {
                const distKm = parseFloat(acceptReturnOrder.distance_km) || 0;
                if (distKm <= 0) return <p className="text-[11px] text-gray-400 mt-1">Estimated: within 2 days (no distance data — +1 day allowance)</p>;
                const driveHrs = distKm / 40;
                const totalHrs = driveHrs + 1;
                const baseDays = totalHrs > 8 ? Math.ceil(totalHrs / 8) : 1;
                const withAllowance = baseDays + 1;
                const earliest = new Date(); earliest.setDate(earliest.getDate() + baseDays);
                const latest = new Date(); latest.setDate(latest.getDate() + withAllowance);
                const fmt = (d) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
                return (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Est. {fmt(earliest)} – {fmt(latest)} ({distKm.toFixed(1)} km · ~{Math.ceil(totalHrs)} hrs travel + 1 day allowance)
                  </p>
                );
              })()}
            </div>

            {/* Pickup Summary Preview */}
            {pickupDriverId && (() => {
              const selectedDriver = pickupDrivers.find(d => String(d.id) === pickupDriverId);
              if (!selectedDriver) return null;
              return (
                <div className="bg-button-50 dark:bg-button-900/20 border border-button-200 dark:border-button-700 rounded-lg p-3">
                  <p className="text-xs font-bold text-button-600 dark:text-button-400 uppercase tracking-wide mb-1.5">Pickup Summary</p>
                  <div className="text-xs text-gray-700 dark:text-gray-200 space-y-1">
                    <p><span className="font-semibold">Driver:</span> {selectedDriver.name}</p>
                    {selectedDriver.truck_plate_number && (
                      <p><span className="font-semibold">Plate No.:</span> {selectedDriver.truck_plate_number}</p>
                    )}
                    {(selectedDriver.phone || selectedDriver.email) && (
                      <p><span className="font-semibold">Contact:</span> {selectedDriver.phone || selectedDriver.email}</p>
                    )}
                    {acceptReturnOrder.delivery_address && (
                      <p><span className="font-semibold">Pickup from:</span> {acceptReturnOrder.delivery_address}</p>
                    )}
                    {pickupDate && (
                      <p><span className="font-semibold">Est. Pickup:</span> {new Date(pickupDate).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Info Note */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">Note:</span> Accepting will set the order to "Picking Up". After the driver picks up the return, the status will change to "Picked Up". You can then verify and mark it as "Returned", and use "Restock Items" to selectively restore stock for items in good condition.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Deliver Order — Proof Upload Modal */}
      <Modal
        isOpen={isDeliverModalOpen}
        onClose={() => { setIsDeliverModalOpen(false); setDeliverOrder(null); setDeliverProofFiles([]); setDeliverProofPreviews([]); if (deliverStreamRef.current) { deliverStreamRef.current.getTracks().forEach(t => t.stop()); deliverStreamRef.current = null; } setDeliverShowCamera(false); }}
        title={`Proof of Delivery — ${deliverOrder?.order_id || ''}`}
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { setIsDeliverModalOpen(false); setDeliverOrder(null); setDeliverProofFiles([]); setDeliverProofPreviews([]); if (deliverStreamRef.current) { deliverStreamRef.current.getTracks().forEach(t => t.stop()); deliverStreamRef.current = null; } setDeliverShowCamera(false); }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeliverConfirm}
              disabled={saving || deliverProofFiles.length === 0}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {saving ? 'Processing...' : 'Confirm Delivery'}
            </button>
          </div>
        }
      >
        {deliverOrder && (
          <div className="space-y-4">
            {/* Order Summary */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Customer</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{deliverOrder.customer}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">₱{deliverOrder.total?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Driver</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{deliverOrder.driver_name || 'N/A'}</p>
                </div>
              </div>
              {deliverOrder.delivery_address && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Delivery Address</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{deliverOrder.delivery_address}</p>
                </div>
              )}
            </div>

            {/* Proof Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Upload Proof of Delivery *</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Take a photo or upload images as proof that the order was delivered.</p>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => deliverProofInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-button-50 dark:bg-button-900/20 border border-button-200 dark:border-button-700 text-button-600 dark:text-button-400 rounded-lg text-xs font-medium hover:bg-button-100 dark:hover:bg-button-900/30 transition-colors"
                >
                  <ImageIcon size={14} /> Upload Photo
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setDeliverShowCamera(true);
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                      deliverStreamRef.current = stream;
                      if (deliverVideoRef.current) deliverVideoRef.current.srcObject = stream;
                    } catch (err) {
                      toast.error('Camera Error', 'Could not access camera');
                      setDeliverShowCamera(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                >
                  <Camera size={14} /> Take Photo
                </button>
              </div>
              <input
                ref={deliverProofInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setDeliverProofFiles(prev => [...prev, ...files]);
                  files.forEach(f => {
                    const reader = new FileReader();
                    reader.onloadend = () => setDeliverProofPreviews(prev => [...prev, reader.result]);
                    reader.readAsDataURL(f);
                  });
                  e.target.value = '';
                }}
              />

              {/* Camera view */}
              {deliverShowCamera && (
                <div className="relative mb-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                  <video ref={deliverVideoRef} autoPlay playsInline className="w-full max-h-48 object-cover" />
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const video = deliverVideoRef.current;
                        if (!video) return;
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        canvas.getContext('2d').drawImage(video, 0, 0);
                        canvas.toBlob((blob) => {
                          if (!blob) return;
                          const file = new File([blob], `delivery-proof-${Date.now()}.jpg`, { type: 'image/jpeg' });
                          setDeliverProofFiles(prev => [...prev, file]);
                          const reader = new FileReader();
                          reader.onloadend = () => setDeliverProofPreviews(prev => [...prev, reader.result]);
                          reader.readAsDataURL(file);
                        }, 'image/jpeg', 0.8);
                      }}
                      className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                    >
                      <Camera size={20} className="text-green-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (deliverStreamRef.current) { deliverStreamRef.current.getTracks().forEach(t => t.stop()); deliverStreamRef.current = null; }
                        setDeliverShowCamera(false);
                      }}
                      className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                    >
                      <X size={20} className="text-red-600" />
                    </button>
                  </div>
                </div>
              )}

              {/* Preview thumbnails */}
              {deliverProofPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {deliverProofPreviews.map((src, idx) => (
                    <div key={idx} className="relative group">
                      <img src={src} alt={`Proof ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                      <button
                        type="button"
                        onClick={() => {
                          setDeliverProofFiles(prev => prev.filter((_, i) => i !== idx));
                          setDeliverProofPreviews(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {deliverProofFiles.length === 0 && (
                <p className="text-xs text-red-500 mt-1">At least one proof photo is required.</p>
              )}
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                <span className="font-semibold">Note:</span> Uploading proof of delivery confirms that the order has been successfully delivered to the customer. This cannot be undone.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Ship Order — Driver Selection Modal */}
      <Modal
        isOpen={isShipModalOpen}
        onClose={() => setIsShipModalOpen(false)}
        title={`Assign Driver — ${shipOrder?.order_id || ''}`}
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setIsShipModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleShipConfirm}
              disabled={saving || !selectedDriverId}
              className="px-4 py-2 bg-button-500 hover:bg-button-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
              {saving ? 'Shipping...' : 'Confirm & Ship'}
            </button>
          </div>
        }
      >
        {shipOrder && (
          <div className="space-y-4">
            {/* Order Summary */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Customer</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{shipOrder.customer}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">₱{shipOrder.total?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Items</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{shipOrder.items_count} item{shipOrder.items_count > 1 ? 's' : ''} ({shipOrder.total_quantity} pcs)</p>
                </div>
              </div>
              {shipOrder.delivery_address && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Delivery Address</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{shipOrder.delivery_address}</p>
                </div>
              )}
            </div>

            {/* Driver Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Select Driver *</label>
              {loadingDrivers ? (
                <div className="flex items-center gap-2 p-4 text-gray-500 dark:text-gray-400">
                  <Loader2 size={18} className="animate-spin" /> Loading drivers...
                </div>
              ) : drivers.length === 0 ? (
                <p className="text-sm text-red-500 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">No active drivers available. Please add drivers first.</p>
              ) : (
                <>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="">Select driver...</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={String(driver.id)}>
                        {driver.name}{driver.truck_plate_number ? ` — ${driver.truck_plate_number}` : ''}
                      </option>
                    ))}
                  </select>
                  {/* Selected driver info card */}
                  {selectedDriverId && (() => {
                    const d = drivers.find(dr => String(dr.id) === selectedDriverId);
                    if (!d) return null;
                    return (
                      <div className="mt-2 flex items-center gap-3 p-2.5 bg-button-50 dark:bg-button-900/20 border border-button-200 dark:border-button-700 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-button-200 flex items-center justify-center text-button-700 dark:text-button-300 font-bold text-sm">
                          {d.name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{d.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{d.phone || d.email || 'No contact'}</p>
                        </div>
                        {d.truck_plate_number && (
                          <span className="text-xs font-bold text-button-600 dark:text-button-400 bg-button-100 dark:bg-button-900/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                            <Truck size={10} /> {d.truck_plate_number}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Estimated Delivery Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Estimated Delivery Date *</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              />
              {shipOrder && (() => {
                const distKm = parseFloat(shipOrder.distance_km) || 0;
                if (distKm <= 0) return <p className="text-[11px] text-gray-400 mt-1">Estimated: within 2 days (no distance data — +1 day allowance)</p>;
                const driveHrs = distKm / 40;
                const totalHrs = driveHrs + 1;
                const baseDays = totalHrs > 8 ? Math.ceil(totalHrs / 8) : 1;
                const withAllowance = baseDays + 1;
                const earliest = new Date(); earliest.setDate(earliest.getDate() + baseDays);
                const latest = new Date(); latest.setDate(latest.getDate() + withAllowance);
                const fmt = (d) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
                return (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Est. {fmt(earliest)} – {fmt(latest)} ({distKm.toFixed(1)} km · ~{Math.ceil(totalHrs)} hrs travel + 1 day allowance)
                  </p>
                );
              })()}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Delivery Notes (Optional)</label>
              <input
                type="text"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Any special instructions for the driver..."
                className="w-full px-3 py-2 border border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            {/* Customer Delivery Note Preview */}
            {selectedDriverId && (() => {
              const selectedDriver = drivers.find(d => String(d.id) === selectedDriverId);
              if (!selectedDriver) return null;
              return (
                <div className="bg-button-50 dark:bg-button-900/20 border border-button-200 dark:border-button-700 rounded-lg p-3">
                  <p className="text-xs font-bold text-button-600 dark:text-button-400 uppercase tracking-wide mb-1.5">Customer Delivery Note</p>
                  <div className="text-xs text-gray-700 dark:text-gray-200 space-y-1">
                    <p><span className="font-semibold">Driver:</span> {selectedDriver.name}</p>
                    {selectedDriver.truck_plate_number && (
                      <p><span className="font-semibold">Plate No.:</span> {selectedDriver.truck_plate_number}</p>
                    )}
                    {(selectedDriver.phone || selectedDriver.email) && (
                      <p><span className="font-semibold">Contact:</span> {selectedDriver.phone || selectedDriver.email}</p>
                    )}
                    {shipOrder.delivery_address && (
                      <p><span className="font-semibold">Deliver to:</span> {shipOrder.delivery_address}</p>
                    )}
                    {deliveryDate && (
                      <p><span className="font-semibold">Est. Delivery:</span> {new Date(deliveryDate).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* Confirm Mark as Returned Modal */}
      <ConfirmModal
        isOpen={isMarkReturnModalOpen}
        onClose={() => { setIsMarkReturnModalOpen(false); setMarkReturnOrder(null); }}
        onConfirm={handleConfirmMarkReturned}
        title="Confirm Return Completion"
        message={markReturnOrder ? `Has the driver picked up the items for Order ${markReturnOrder.order_id}? This will mark it as returned. You can then restock items that are in good condition.` : ''}
        confirmText={saving ? 'Processing...' : 'Yes, Mark as Returned'}
        cancelText="Cancel"
        variant="warning"
      />

      {/* Restock Items Modal */}
      <Modal
        isOpen={isRestockModalOpen}
        onClose={() => { setIsRestockModalOpen(false); setRestockOrder(null); setRestockQuantities({}); setRestockNotes(''); }}
        title={`Restock Items — ${restockOrder?.order_id || ''}`}
        maxWidth="md"
        footer={
          <div className="flex gap-3">
            <button onClick={() => { setIsRestockModalOpen(false); setRestockOrder(null); setRestockQuantities({}); setRestockNotes(''); }} className="flex-1 py-2 rounded-lg text-sm font-semibold border border-primary-300 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700/50">Cancel</button>
            <button
              onClick={handleConfirmRestock}
              disabled={saving || Object.values(restockQuantities).filter(q => q > 0).length === 0}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Package size={14} /> {saving ? 'Restocking...' : `Restock ${Object.values(restockQuantities).filter(q => q > 0).length} Item(s)`}
            </button>
          </div>
        }
      >
        {restockOrder && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                <span className="font-semibold">Note:</span> Select items in good condition and set the quantity to restock. Set quantity to 0 or uncheck to skip damaged/unsellable items.
              </p>
            </div>

            <div className="rounded-xl border-2 border-primary-200 dark:border-primary-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-primary-50 dark:bg-primary-900/20">
                  <tr>
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={
                          (restockOrder.items || []).filter(i => !i.restocked).length > 0 &&
                          (restockOrder.items || []).filter(i => !i.restocked).every(i => (restockQuantities[i.id] ?? 0) > 0)
                        }
                        onChange={(e) => {
                          const newQtys = { ...restockQuantities };
                          (restockOrder.items || []).filter(i => !i.restocked).forEach(i => {
                            newQtys[i.id] = e.target.checked ? i.quantity : 0;
                          });
                          setRestockQuantities(newQtys);
                        }}
                        className="rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500"
                      />
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Product</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Returned</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Restock Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(restockOrder.items || []).map((item) => {
                    const qty = restockQuantities[item.id] ?? 0;
                    const isChecked = !item.restocked && qty > 0;
                    return (
                      <tr key={item.id} className={`${item.restocked ? 'bg-green-50/50 dark:bg-green-900/10' : 'dark:bg-gray-700/50'}`}>
                        <td className="px-3 py-2">
                          {item.restocked ? (
                            <CheckCircle size={16} className="text-green-500" />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setRestockQuantities(prev => ({
                                  ...prev,
                                  [item.id]: e.target.checked ? item.quantity : 0,
                                }));
                              }}
                              className="rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.variety_color || '#6B7280' }} />
                            <span className="text-gray-800 dark:text-gray-100 text-xs font-medium">{item.product_name}{item.weight_formatted ? ` (${item.weight_formatted})` : ''}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-300 text-xs">{item.quantity}</td>
                        <td className="px-3 py-2 text-center">
                          {item.restocked ? (
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400">Restocked</span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={qty}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(item.quantity, parseInt(e.target.value) || 0));
                                setRestockQuantities(prev => ({ ...prev, [item.id]: val }));
                              }}
                              className="w-16 text-center px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Reason / Notes <span className="font-normal text-gray-400">(optional — appears in stock log)</span>
              </label>
              <input
                type="text"
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                placeholder="e.g. Bag torn, items still good condition..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}
      </Modal>
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
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{payOrder.order_id}</p>
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
                  <p className="text-xs text-blue-600 dark:text-blue-400">Enter the exact 13-digit GCash reference number and upload a screenshot or capture the payment confirmation as proof.</p>
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
                  onClick={() => { setIsPayModalOpen(false); stopPayCamera(); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-1"
                >
                  ← Back
                </button>
                <button
                  onClick={handleConfirmPay}
                  disabled={saving || (payMethod === 'cash' ? (!payCashTendered || parseFloat(payCashTendered) < (payOrder?.total || 0)) : (!payGcashRef.trim() || payGcashRef.replace(/\s/g, '').length !== 13 || !!payGcashRefError))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all ${payMethod === 'cash' ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                  <CheckCircle size={14} /> {saving ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Void Order Modal */}
      <Modal
        isOpen={isVoidModalOpen}
        onClose={() => { setIsVoidModalOpen(false); setVoidOrder(null); }}
        title="Void Order"
        maxWidth="md"
        footer={
          <div className="flex gap-3">
            <button onClick={() => { setIsVoidModalOpen(false); setVoidOrder(null); }} className="flex-1 py-2 rounded-lg text-sm font-semibold border border-primary-300 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700/50">Cancel</button>
            <button
              onClick={handleVoidConfirm}
              disabled={!voidReason.trim() || !voidPassword.trim() || saving}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
              {saving ? 'Voiding...' : 'Confirm Void'}
            </button>
          </div>
        }
      >
        {voidOrder && (
          <div className="space-y-4">
            {/* Order Summary */}
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-700">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{voidOrder.order_id}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{voidOrder.customer}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">₱{voidOrder.total.toLocaleString()}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                    <Store size={10} /> {voidOrder.is_delivery ? 'Delivery' : 'Pick Up'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 flex items-start gap-2">
              <Ban size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">Voiding this order will <strong>restore all stock</strong> for the items and mark the transaction as voided. This action cannot be undone.</p>
            </div>

            {/* Void Reason */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">Reason for Void <span className="text-red-500">*</span></label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Enter reason for voiding this order..."
                className="w-full px-3 py-2 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none bg-white dark:bg-gray-700 dark:text-gray-100"
                rows={2}
              />
            </div>

            {/* Password Confirmation */}
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <Lock size={12} />
                {isAdminOrAbove() ? 'Confirm Your Password' : 'Admin / Super Admin Password Required'}
              </p>
              <input
                type="password"
                value={voidPassword}
                onChange={(e) => setVoidPassword(e.target.value)}
                placeholder={isAdminOrAbove() ? 'Enter your password to confirm...' : 'Enter admin or super admin password...'}
                className="w-full px-3 py-2 text-sm border-2 border-amber-200 dark:border-amber-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-700 dark:text-gray-100"
              />
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 italic">
                {isAdminOrAbove() ? 'Enter your password to authorize this void.' : 'Authorization from Admin or Super Admin is required to void orders.'}
              </p>
            </div>
          </div>
        )}
      </Modal>

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
      {/* Print Receipt — Copies Modal */}
      <Modal
        isOpen={!!printReceiptOrder}
        onClose={() => setPrintReceiptOrder(null)}
        title={`Print Receipt — ${printReceiptOrder?.order_id || ''}`}
        size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setPrintReceiptOrder(null)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                printOrderReceipt(printReceiptOrder, bizSettings?.business_name || 'KJP Ricemill', printReceiptCopies);
                setPrintReceiptOrder(null);
              }}
              className="px-4 py-2 bg-button-600 hover:bg-button-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Printer size={15} /> Print {printReceiptCopies} {printReceiptCopies === 1 ? 'Copy' : 'Copies'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Each copy prints on <strong>1/4 of a short bond paper</strong> (4.25″ × 5.5″).
          </p>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Number of Copies</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setPrintReceiptCopies(n)}
                  className={`w-12 h-12 rounded-xl text-lg font-bold border-2 transition-colors ${
                    printReceiptCopies === n
                      ? 'border-button-600 bg-button-50 dark:bg-button-900/30 text-button-700 dark:text-button-300'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:border-button-400'
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={10}
                value={printReceiptCopies}
                onChange={e => setPrintReceiptCopies(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="w-16 h-12 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-center text-base font-bold focus:border-button-500 focus:outline-none"
                title="Custom number (1–10)"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Quick pick: 1–4, or type a custom number (max 10)</p>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default AdminOrders;
