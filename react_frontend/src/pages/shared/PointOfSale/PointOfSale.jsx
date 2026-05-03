import { Monitor, Search, Plus, Minus, ShoppingCart, Trash2, DollarSign, Receipt, Package, Smartphone, XCircle, Tag, Clock, RotateCcw, CheckCircle, ChevronUp, ChevronDown, Banknote, PlusCircle, Check, AlertCircle, User, Phone, Mail, Lock, MapPin, Truck, Loader2, Navigation, Camera, ImageIcon, X } from 'lucide-react';
import { useState, useMemo, memo, useCallback, useRef, useEffect } from 'react';
import { PageHeader } from '../../../components/common';
import { Button, useToast } from '../../../components/ui';
import { useDataFetch, invalidateCache } from '../../../hooks/useDataFetch';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { useBusinessSettings } from '../../../context/BusinessSettingsContext';
import { debouncedSearchAddress, calculateDistance, geocodeAddress } from '../../../api/openRouteService';

// ─── Auto Print Receipt Helper ───────────────────────────────────────────────
const autoPrintReceipt = (orderData, bizName = 'KJP Ricemill', copies = 1) => {
  const win = window.open('', '_blank', 'width=480,height=660');
  if (!win) return;

  const payStatus = orderData.paymentMethod === 'PAY LATER' || orderData.paymentMethod === 'COD' ? 'UNPAID' : 'PAID';
  const payColor = payStatus === 'UNPAID' ? '#dc2626' : '#16a34a';

  const itemRows = (orderData.items || []).map(item => `
    <tr>
      <td>${item.name}${item.weight_formatted ? ` (${item.weight_formatted})` : ''}</td>
      <td class="c">${item.quantity}</td>
      <td class="r">&#8369;${(item.price || 0).toLocaleString()}</td>
      <td class="r">&#8369;${((item.price || 0) * item.quantity).toLocaleString()}</td>
    </tr>`).join('');

  const receiptHTML = `
  <div class="rcpt">
    <div class="hdr">
      <div class="biz">${bizName}</div>
      <div class="sub">OFFICIAL RECEIPT</div>
    </div>
    <hr class="d"/>
    <table class="meta">
      <tr><td class="ml">TXN ID:</td><td class="mv">${orderData.transactionId}</td></tr>
      <tr><td class="ml">Date:</td><td class="mv">${new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })} ${orderData.time}</td></tr>
      <tr><td class="ml">Customer:</td><td class="mv">${orderData.customerName || 'Walk-in'}</td></tr>
      <tr><td class="ml">Type:</td><td class="mv">${orderData.forDelivery ? 'Delivery' : 'Pick Up'}</td></tr>
      <tr><td class="ml">Payment:</td><td class="mv">${orderData.paymentMethod} &mdash; <span style="color:${payColor};font-weight:700">${payStatus}</span></td></tr>
    </table>
    <hr class="d"/>
    <table class="items">
      <thead><tr><th>Product</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Subtotal</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr class="d"/>
    <table class="totals">
      ${(orderData.deliveryFee > 0) ? `<tr><td class="tl">Delivery Fee</td><td class="tr_">&#8369;${Number(orderData.deliveryFee).toLocaleString()}</td></tr>` : ''}
      <tr class="grand"><td>TOTAL</td><td class="tr_">&#8369;${Number(orderData.total).toLocaleString()}</td></tr>
      ${(orderData.cashTendered > 0) ? `<tr><td class="tl">Tendered</td><td class="tr_">&#8369;${Number(orderData.cashTendered).toLocaleString()}</td></tr>` : ''}
      ${(orderData.change > 0) ? `<tr><td class="tl">Change</td><td class="tr_">&#8369;${Number(orderData.change).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ''}
    </table>
    <hr class="d"/>
    <div class="status">Status: <strong>Pending</strong></div>
    <div class="ftr">Thank you! &mdash; System-generated</div>
  </div>`;

  const allCopies = Array.from({ length: copies }, (_, i) =>
    i < copies - 1 ? `${receiptHTML}<div class="pb"></div>` : receiptHTML
  ).join('');

  win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
    <title>Receipt &mdash; ${orderData.transactionId}</title>
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

const posPaymentMethods = [
  { value: 'cash', label: 'Cash', icon: DollarSign, color: '#22c55e' },
  { value: 'gcash', label: 'GCash', icon: Smartphone, color: '#3b82f6' },
  { value: 'cod', label: 'COD', icon: Banknote, color: '#f59e0b' },
  { value: 'pay_later', label: 'Pay Later', icon: Clock, color: '#8b5cf6' },
];

// customer combobox component - select existing or add new (requires name + contact or email)
const CustomerCombobox = memo(({ value, newName, newContact, newEmail, newAddress, newLandmark, onChange, onInputChange, onContactChange, onEmailChange, onAddressChange, onLandmarkChange, customerOptions, selectedEmail, error, emailError }) => {
  return (
    <div className="mb-2">
      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 uppercase tracking-wide">
        <User size={14} className="text-gray-400" />
        Customer <span className="text-red-500">*</span>
      </label>
      
      {/* Dropdown for existing customers */}
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className={`w-full px-3 py-2.5 text-sm border-2 rounded-lg transition-all appearance-none cursor-pointer pr-8 focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20'
              : value && !newName
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20'
                : 'border-primary-200 dark:border-primary-700 bg-white dark:bg-gray-800 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20'
          }`}
        >
          {customerOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          {error && <AlertCircle size={14} className="text-red-500" />}
          {value && !newName && !error && <Check size={14} className="text-green-500" />}
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Show selected customer's email */}
      {value && !newName && selectedEmail && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 pl-1">
          <Mail size={12} className="text-gray-400" />
          {selectedEmail}
        </p>
      )}

      {/* OR divider */}
      <div className="flex items-center gap-2 my-1.5">
        <div className="flex-1 h-px bg-gray-200"></div>
        <span className="text-[10px] text-gray-400 uppercase font-medium">or add new</span>
        <div className="flex-1 h-px bg-gray-200"></div>
      </div>

      {/* Input for new customer name */}
      <div className="relative">
        <input
          type="text"
          value={newName}
          onChange={onInputChange}
          placeholder="Type new customer name..."
          className={`w-full px-3 py-2.5 pl-8 text-sm border-2 rounded-lg transition-all focus:outline-none focus:ring-2 ${
            newName 
              ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20' 
              : 'border-primary-200 dark:border-primary-700 bg-white dark:bg-gray-800 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20'
          }`}
        />
        <PlusCircle size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${newName ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
        {newName && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <Check size={14} className="text-green-500" />
          </div>
        )}
      </div>

      {/* Contact & Email fields - shown when adding new customer */}
      {newName && (
        <div className="mt-1.5 space-y-1.5">
          <div className="relative">
            <input
              type="text"
              value={newContact}
              onChange={onContactChange}
              placeholder="Contact number (e.g. 09171234567)"
              className={`w-full px-3 py-2 pl-8 text-sm border-2 rounded-lg transition-all focus:outline-none focus:ring-2 ${
                newContact
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20'
                  : 'border-primary-200 dark:border-primary-700 bg-white dark:bg-gray-800 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20'
              }`}
            />
            <Phone size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${newContact ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
          </div>
          <div className="relative">
            <input
              type="email"
              value={newEmail}
              onChange={onEmailChange}
              placeholder="Email address (required)"
              className={`w-full px-3 py-2 pl-8 text-sm border-2 rounded-lg transition-all focus:outline-none focus:ring-2 ${
                emailError
                  ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20'
                  : newEmail
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20'
                    : 'border-primary-200 dark:border-primary-700 bg-white dark:bg-gray-800 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20'
              }`}
            />
            <Mail size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${emailError ? 'text-red-500' : newEmail ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
          </div>
          {emailError && (
            <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle size={10} />{emailError}</p>
          )}
          <div className="relative">
            <input
              type="text"
              value={newAddress}
              onChange={onAddressChange}
              placeholder="Address (e.g. Brgy. San Jose, Cainta, Rizal)"
              className={`w-full px-3 py-2 pl-8 text-sm border-2 rounded-lg transition-all focus:outline-none focus:ring-2 ${
                newAddress
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20'
                  : 'border-primary-200 dark:border-primary-700 bg-white dark:bg-gray-800 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20'
              }`}
            />
            <MapPin size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${newAddress ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
          </div>
          <div className="relative">
            <input
              type="text"
              value={newLandmark}
              onChange={onLandmarkChange}
              placeholder="Landmark/directions (optional)"
              className="w-full px-3 py-2 pl-8 text-sm border-2 rounded-lg border-primary-200 dark:border-primary-700 bg-white dark:bg-gray-800 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20 focus:outline-none focus:ring-2 transition-all"
            />
            <Navigation size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      )}

      {/* Info when new customer is valid */}
      {newName && newEmail && !emailError && (
        <div className="flex items-start gap-1.5 p-1.5 mt-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
          <AlertCircle size={12} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-green-700 dark:text-green-300">
            New customer "<strong>{newName}</strong>" will be created.
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-[10px] text-red-500 flex items-center gap-1"><AlertCircle size={10} />{error}</p>
      )}
    </div>
  );
});

CustomerCombobox.displayName = 'CustomerCombobox';

const PointOfSale = () => {
  const toast = useToast();
  const { isSuperAdmin, isAdmin, isAdminOrAbove } = useAuth();
  const { settings: businessSettings } = useBusinessSettings();
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVariety, setSelectedVariety] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showSaleCompleteModal, setShowSaleCompleteModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [cashTendered, setCashTendered] = useState('');
  const [gcashReference, setGcashReference] = useState('');
  const [gcashRefError, setGcashRefError] = useState('');
  const gcashRefCheckTimeout = useRef(null);
  const [gcashProofFiles, setGcashProofFiles] = useState([]);
  const [gcashProofPreviews, setGcashProofPreviews] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const gcashProofInputRef = useRef(null);
  const [lastSale, setLastSale] = useState(null);
  const [voidSearch, setVoidSearch] = useState('');
  const [selectedVoidTxn, setSelectedVoidTxn] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidPassword, setVoidPassword] = useState('');
  const [voidRestockQtys, setVoidRestockQtys] = useState({}); // { [saleItemId]: quantity }
  const [voidRestockNotes, setVoidRestockNotes] = useState('');
  const [showVoidRestockModal, setShowVoidRestockModal] = useState(false);
  const [voidedTxnForRestock, setVoidedTxnForRestock] = useState(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerContact, setNewCustomerContact] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerLandmark, setNewCustomerLandmark] = useState('');
  const [customerError, setCustomerError] = useState('');
  const [emailError, setEmailError] = useState('');
  const emailCheckTimeout = useRef(null);
  // Delivery / Shipping state
  const [forDelivery, setForDelivery] = useState(false);
  const [showWalkInConfirm, setShowWalkInConfirm] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [estimatedDuration, setEstimatedDuration] = useState(null);
  const [isEstimate, setIsEstimate] = useState(false);
  const [warehouseCoords, setWarehouseCoords] = useState(null);
  const addressInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Geocode warehouse address on mount
  useEffect(() => {
    if (businessSettings.warehouse_address && !warehouseCoords) {
      geocodeAddress(businessSettings.warehouse_address).then(coords => {
        if (coords) setWarehouseCoords(coords);
      });
    }
  }, [businessSettings.warehouse_address]);

  // Helper: get warehouse coords, geocoding on-demand if needed
  const getWarehouseCoords = useCallback(async () => {
    if (warehouseCoords) return warehouseCoords;
    if (!businessSettings.warehouse_address) return null;
    const coords = await geocodeAddress(businessSettings.warehouse_address);
    if (coords) setWarehouseCoords(coords);
    return coords;
  }, [warehouseCoords, businessSettings.warehouse_address]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          addressInputRef.current && !addressInputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-calculate distance from an address string (geocode ? route)
  const autoCalcDistance = useCallback(async (address) => {
    if (!address) return;
    setCalculatingDistance(true);
    try {
      const wCoords = await getWarehouseCoords();
      if (!wCoords) { setCalculatingDistance(false); return; }
      const coords = await geocodeAddress(address);
      if (coords) {
        setSelectedCoords(coords);
        const result = await calculateDistance(
          wCoords.lat, wCoords.lng,
          coords.lat, coords.lng
        );
        setDistanceKm(String(result.distanceKm));
        setEstimatedDuration(result.durationMin);
        setIsEstimate(result.isEstimate || false);
      }
    } catch (err) {
      console.error('Distance calc failed:', err);
    } finally {
      setCalculatingDistance(false);
    }
  }, [getWarehouseCoords]);

  // Debounce timer for auto-calculating distance after address typing stops
  const distanceCalcTimer = useRef(null);

  // Handle address input change with autocomplete + debounced distance calc
  const handleAddressInput = useCallback((value) => {
    setDeliveryAddress(value);
    setSelectedCoords(null);
    setDistanceKm('');
    setEstimatedDuration(null);
    // Trigger autocomplete suggestions
    debouncedSearchAddress(value, (results) => {
      setAddressSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, warehouseCoords || {});
    // Also debounce auto-calc distance after user stops typing (1.5s)
    if (distanceCalcTimer.current) clearTimeout(distanceCalcTimer.current);
    if (value && value.length >= 5) {
      distanceCalcTimer.current = setTimeout(() => {
        autoCalcDistance(value);
      }, 1500);
    }
  }, [warehouseCoords, autoCalcDistance]);

  // Handle selecting an address suggestion
  const handleSelectAddress = useCallback(async (suggestion) => {
    setDeliveryAddress(suggestion.label);
    setSelectedCoords({ lat: suggestion.lat, lng: suggestion.lng });
    setShowSuggestions(false);
    setAddressSuggestions([]);
    // Cancel any pending debounced calc
    if (distanceCalcTimer.current) clearTimeout(distanceCalcTimer.current);

    // Auto-calculate distance
    setCalculatingDistance(true);
    try {
      const wCoords = await getWarehouseCoords();
      if (wCoords) {
        const result = await calculateDistance(
          wCoords.lat, wCoords.lng,
          suggestion.lat, suggestion.lng
        );
        setDistanceKm(String(result.distanceKm));
        setEstimatedDuration(result.durationMin);
        setIsEstimate(result.isEstimate || false);
      }
    } catch (err) {
      console.error('Distance calc failed:', err);
    } finally {
      setCalculatingDistance(false);
    }
  }, [getWarehouseCoords]);

  // Fetch real data from API
  const { data: productsRaw, loading: productsLoading, refetch: refetchProducts } = useDataFetch('/products');
  const { data: salesRaw, refetch: refetchSales, optimisticUpdate: optimisticUpdateSales } = useDataFetch('/sales');
  const { data: varietiesRaw } = useDataFetch('/varieties');
  const { data: customersRaw, refetch: refetchCustomers } = useDataFetch('/customers');

  // Map products to POS format × include all active products even with 0 stock
  const products = useMemo(() =>
    (productsRaw || [])
      .filter(p => p.status === 'active' && !p.is_deleted)
      .map(p => ({
        id: p.product_id,
        name: p.product_name,
        price: p.price,
        stock: p.stocks,
        variety: p.variety_name,
        variety_color: p.variety_color,
        variety_id: p.variety_id,
        weight_formatted: p.weight_formatted || null,
      })),

    [productsRaw]
  );

  const varieties = useMemo(() =>
    (varietiesRaw || []).map(c => c.name).filter(Boolean),
    [varietiesRaw]
  );

  // customer options for combobox
  const customerOptions = useMemo(() => {
    const opts = (customersRaw || [])
      .filter(c => c.status === 'Active')
      .map(c => ({ value: String(c.id), label: c.name, email: c.email || '' }));
    return [{ value: '', label: 'Select a customer...', email: '' }, ...opts];
  }, [customersRaw]);

  // Check if selected existing customer has contact or email
  const selectedCustomerHasContactInfo = useMemo(() => {
    if (!selectedCustomerId) return false;
    const cust = (customersRaw || []).find(c => String(c.id) === selectedCustomerId);
    if (!cust) return false;
    return !!(cust.contact || cust.phone || cust.email);
  }, [selectedCustomerId, customersRaw]);

  const handleCustomerSelect = useCallback((e) => {
    const id = e.target.value;
    setSelectedCustomerId(id);
    if (id) {
      setNewCustomerName('');
      setNewCustomerContact('');
      setNewCustomerEmail('');
      setNewCustomerAddress('');
      setNewCustomerLandmark('');
      setEmailError('');
      // Auto-fill delivery address from customer's saved address
      if (forDelivery) {
        const cust = (customersRaw || []).find(c => String(c.id) === id);
        if (cust?.address) {
          setDeliveryAddress(cust.address);
          // Auto-calculate distance immediately
          setDistanceKm('');
          setEstimatedDuration(null);
          setSelectedCoords(null);
          autoCalcDistance(cust.address);
        } else {
          setDeliveryAddress('');
          setDistanceKm('');
          setEstimatedDuration(null);
          setSelectedCoords(null);
        }
      }
    }
    setCustomerError('');
  }, [forDelivery, customersRaw, autoCalcDistance]);

  const handleNewCustomerInput = useCallback((e) => {
    const val = e.target.value;
    setNewCustomerName(val);
    setCustomerError('');
    if (val) {
      // Check if typed name matches existing customer
      const match = (customersRaw || []).find(c => c.name.toLowerCase() === val.toLowerCase());
      if (match) {
        setSelectedCustomerId(String(match.id));
        setNewCustomerName('');
        setNewCustomerContact('');
        setNewCustomerEmail('');
        setNewCustomerAddress('');
        setNewCustomerLandmark('');
        return;
      }
      setSelectedCustomerId('');
    }
  }, [customersRaw]);

  const handleNewCustomerContact = useCallback((e) => {
    setNewCustomerContact(e.target.value);
    setCustomerError('');
  }, []);

  const handleNewCustomerAddress = useCallback((e) => {
    setNewCustomerAddress(e.target.value);
  }, []);

  const handleNewCustomerLandmark = useCallback((e) => {
    setNewCustomerLandmark(e.target.value);
  }, []);

  const checkGcashReference = useCallback((ref) => {
    const digits = ref.replace(/\s/g, '');
    if (digits.length !== 13) return;
    if (gcashRefCheckTimeout.current) clearTimeout(gcashRefCheckTimeout.current);
    gcashRefCheckTimeout.current = setTimeout(async () => {
      try {
        const response = await apiClient.post('/sales/check-reference', { reference_number: digits });
        if (response.data && !response.data.available) {
          setGcashRefError('This reference number has already been used.');
        } else {
          setGcashRefError('');
        }
      } catch {
        // silently ignore network errors
      }
    }, 500);
  }, []);

  const checkPosEmailAvailability = useCallback((email) => {
    if (emailCheckTimeout.current) clearTimeout(emailCheckTimeout.current);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) return;
    emailCheckTimeout.current = setTimeout(async () => {
      try {
        const response = await apiClient.post('/customers/check-email', { email });
        if (response.data && !response.data.available) {
          setEmailError('This email is already taken.');
        } else {
          setEmailError('');
        }
      } catch {
        // silently ignore network errors
      }
    }, 500);
  }, []);

  const handleNewCustomerEmail = useCallback((e) => {
    const value = e.target.value;
    setNewCustomerEmail(value);
    setCustomerError('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      setEmailError('Please enter a valid email address.');
      if (emailCheckTimeout.current) clearTimeout(emailCheckTimeout.current);
    } else {
      setEmailError('');
      checkPosEmailAvailability(value);
    }
  }, [checkPosEmailAvailability]);

  // Recent transactions from API (today only) — use local date to match PH timezone
  const recentTransactions = useMemo(() => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return (salesRaw || [])
      .filter(s => s.date_short === today)
      .map(s => ({
        id: s.transaction_id,
        saleId: s.id,
        time: s.date_formatted,
        total: s.total,
        items: s.items_count,
        itemsList: s.items || [],
        payment: s.payment_method?.toUpperCase(),
        status: s.status,
      }))
      .reverse();
  }, [salesRaw]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVariety = !selectedVariety || p.variety === selectedVariety;
    return matchesSearch && matchesVariety;
  });

  const addToCart = (product) => {
    if (!product.price || product.price <= 0) {
      toast.error('Cannot Add', `"${product.name}" has no price set yet.`);
      return;
    }
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const voidTransaction = () => {
    setShowVoidModal(true);
    setSelectedVoidTxn(null);
    setVoidReason('');
    setVoidPassword('');
    setVoidSearch('');
    setVoidRestockQtys({});
    setVoidRestockNotes('');
    setVoidedTxnForRestock(null);
  };

  const confirmVoid = async () => {
    if (!selectedVoidTxn || !voidReason.trim() || !voidPassword.trim() || saving) return;
    setSaving(true);
    try {
      // Void only — user will restock manually in the next modal
      const payload = { reason: voidReason, admin_password: voidPassword };
      const response = await apiClient.post(`/sales/${selectedVoidTxn.saleId}/void`, payload);
      if (response.success) {
        // Optimistic: mark as voided instantly
        optimisticUpdateSales(prev => prev.map(s => s.id === selectedVoidTxn.saleId ? { ...s, status: 'voided' } : s));
        invalidateCache('/sales');
        invalidateCache('/products');
        refetchSales();
        refetchProducts();
        toast.success('Transaction Voided', `${selectedVoidTxn.id} voided × refund processed`);
        // Pre-fill restock quantities at full qty, then open restock modal
        const initialQtys = {};
        (selectedVoidTxn.itemsList || []).forEach(item => {
          if (item.id) initialQtys[item.id] = item.quantity;
        });
        setVoidRestockQtys(initialQtys);
        setVoidRestockNotes('');
        setVoidedTxnForRestock(selectedVoidTxn);
        setShowVoidModal(false);
        setSelectedVoidTxn(null);
        setVoidReason('');
        setVoidPassword('');
        setShowVoidRestockModal(true);
      } else {
        throw response;
      }
    } catch (error) {
      toast.error('Void Failed', error.message || 'Failed to void transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmVoidRestock = async () => {
    if (!voidedTxnForRestock || saving) return;
    const selectedEntries = Object.entries(voidRestockQtys).filter(([, qty]) => qty > 0);
    if (selectedEntries.length === 0) return;
    setSaving(true);
    try {
      const items = selectedEntries.map(([id, quantity]) => ({ id: parseInt(id), quantity }));
      const payload = { items };
      if (voidRestockNotes.trim()) payload.notes = voidRestockNotes.trim();
      const response = await apiClient.post(`/sales/${voidedTxnForRestock.saleId}/restock`, payload);
      if (response.success) {
        invalidateCache('/sales');
        invalidateCache('/products');
        invalidateCache('/stock-logs');
        refetchSales();
        refetchProducts();
        toast.success('Items Restocked', `${items.length} item(s) have been restocked.`);
        setShowVoidRestockModal(false);
        setVoidedTxnForRestock(null);
        setVoidRestockQtys({});
        setVoidRestockNotes('');
      } else {
        throw response;
      }
    } catch (error) {
      toast.error('Restock Failed', error.message || 'Failed to restock items');
    } finally {
      setSaving(false);
    }
  };

  // Only completed transactions can be voided from POS
  const filteredVoidTxns = recentTransactions.filter(t => {
    const matchesSearch = !voidSearch ||
      t.id.toLowerCase().includes(voidSearch.toLowerCase()) ||
      t.time.toLowerCase().includes(voidSearch.toLowerCase());
    return matchesSearch && t.status === 'completed';
  });

  const completeSale = () => {
    if (cart.length === 0) return;
    // If not for delivery, confirm walk-in first
    if (!forDelivery) {
      setShowWalkInConfirm(true);
      return;
    }
    proceedToCustomerModal();
  };

  const proceedToCustomerModal = () => {
    setShowWalkInConfirm(false);
    // Reset customer fields and show customer modal
    setSelectedCustomerId('');
    setNewCustomerName('');
    setNewCustomerContact('');
    setNewCustomerEmail('');
    setNewCustomerAddress('');
    setNewCustomerLandmark('');
    setCustomerError('');
    setEmailError('');
    setShowCustomerModal(true);
  };

  const confirmCustomer = async () => {
    // Validate customer: must have name + (contact or email)
    if (!selectedCustomerId && !newCustomerName) {
      setCustomerError('Please select a customer or add a new one.');
      return;
    }

    // If existing customer selected, check they have contact info
    if (selectedCustomerId && !selectedCustomerHasContactInfo) {
      setCustomerError('Selected customer has no contact or email on file. Please update their info or add a new customer.');
      return;
    }

    // If new customer, require email
    if (newCustomerName && !newCustomerEmail.trim()) {
      setCustomerError('Email address is required for new customers.');
      return;
    }

    // Block if email has a uniqueness/format error
    if (newCustomerName && emailError) {
      setCustomerError('Please fix the email error before proceeding.');
      return;
    }

    // If for delivery, require address
    if (forDelivery && !deliveryAddress.trim()) {
      setCustomerError('Delivery address is required for delivery orders.');
      return;
    }

    // Auto-calculate distance if for delivery and address is set but no distance yet
    if (forDelivery && deliveryAddress.trim() && !distanceKm) {
      setCalculatingDistance(true);
      try {
        // Ensure warehouse coords are available
        const wCoords = await getWarehouseCoords();
        // Geocode delivery address
        const destCoords = await geocodeAddress(deliveryAddress);
        if (destCoords && wCoords) {
          setSelectedCoords(destCoords);
          const result = await calculateDistance(
            wCoords.lat, wCoords.lng,
            destCoords.lat, destCoords.lng
          );
          setDistanceKm(String(result.distanceKm));
          setEstimatedDuration(result.durationMin);
          setIsEstimate(result.isEstimate || false);
        } else {
          // Geocoding failed × ask user to enter distance manually
          setCalculatingDistance(false);
          setCustomerError('Could not auto-calculate distance. Please enter the distance (km) manually.');
          return;
        }
      } catch (err) {
        console.error('Distance calc failed:', err);
        setCalculatingDistance(false);
        setCustomerError('Distance calculation failed. Please enter the distance (km) manually.');
        return;
      } finally {
        setCalculatingDistance(false);
      }
    }

    // Require distance for delivery orders
    if (forDelivery && (!distanceKm || parseFloat(distanceKm) <= 0)) {
      setCustomerError('Please enter the delivery distance in km.');
      return;
    }

    setCustomerError('');
    setShowCustomerModal(false);
    setCashTendered('');
    setGcashReference('');
    setGcashRefError('');
    setGcashProofFiles([]);
    setGcashProofPreviews([]);
    setShowCamera(false);
    stopCamera();
    setShowPaymentModal(true);
  };

  // Camera helpers
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      cameraStreamRef.current = stream;
      setShowCamera(true);
      setTimeout(() => {
        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
      }, 100);
    } catch {
      toast.error('Camera Error', 'Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!cameraVideoRef.current) return;
    const video = cameraVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `gcash_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setGcashProofFiles(prev => [...prev, file]);
      setGcashProofPreviews(prev => [...prev, URL.createObjectURL(blob)]);
      stopCamera();
    }, 'image/jpeg', 0.85);
  };

  const handleGcashProofUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setGcashProofFiles(prev => [...prev, ...files]);
    setGcashProofPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removeGcashProof = (idx) => {
    setGcashProofFiles(prev => prev.filter((_, i) => i !== idx));
    setGcashProofPreviews(prev => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const confirmPayment = async () => {
    if (saving) return;
    
    if (paymentMethod === 'cash') {
      const tendered = parseFloat(cashTendered);
      if (isNaN(tendered) || tendered < total) return;
    } else if (paymentMethod === 'gcash') {
      if (!gcashReference.trim() || gcashReference.replace(/\s/g, '').length !== 13) return;
      if (gcashProofFiles.length === 0) return;
      if (gcashRefError) return;
    }
    // COD and Pay Later require no additional fields

    setSaving(true);
    try {
      let response;

      if (paymentMethod === 'gcash' && gcashProofFiles.length > 0) {
        // Use FormData when there are proof files
        const formData = new FormData();
        cart.forEach((item, i) => {
          formData.append(`items[${i}][product_id]`, item.id);
          formData.append(`items[${i}][quantity]`, item.quantity);
          formData.append(`items[${i}][unit_price]`, item.price);
        });
        if (selectedCustomerId) formData.append('customer_id', parseInt(selectedCustomerId));
        if (newCustomerName) formData.append('new_customer_name', newCustomerName);
        if (newCustomerContact) formData.append('new_customer_contact', newCustomerContact);
        if (newCustomerEmail) formData.append('new_customer_email', newCustomerEmail);
        if (newCustomerAddress) formData.append('new_customer_address', newCustomerAddress);
        if (newCustomerLandmark) formData.append('new_customer_landmark', newCustomerLandmark);
        formData.append('payment_method', paymentMethod);
        formData.append('amount_tendered', total);
        formData.append('reference_number', gcashReference);
        if (forDelivery) {
          formData.append('delivery_fee', deliveryFee);
          if (distanceKm) formData.append('distance_km', parseFloat(distanceKm));
          if (deliveryAddress) formData.append('delivery_address', deliveryAddress);
        } else {
          formData.append('delivery_fee', 0);
        }
        gcashProofFiles.forEach(file => formData.append('payment_proof[]', file));
        response = await apiClient.post('/sales/order', formData);
      } else {
        const payload = {
          items: cart.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
          })),
          customer_id: selectedCustomerId ? parseInt(selectedCustomerId) : null,
          new_customer_name: newCustomerName || null,
          new_customer_contact: newCustomerContact || null,
          new_customer_email: newCustomerEmail || null,
          new_customer_address: newCustomerAddress || null,
          new_customer_landmark: newCustomerLandmark || null,
          payment_method: paymentMethod,
          amount_tendered: paymentMethod === 'cash' ? parseFloat(cashTendered) : (paymentMethod === 'cod' || paymentMethod === 'pay_later' ? 0 : total),
          reference_number: paymentMethod === 'gcash' ? gcashReference : null,
          delivery_fee: forDelivery ? deliveryFee : 0,
          distance_km: forDelivery && distanceKm ? parseFloat(distanceKm) : null,
          delivery_address: forDelivery ? deliveryAddress : null,
        };
        response = await apiClient.post('/sales/order', payload);
      }
      
      if (response.success && response.data) {
        // Fire-and-forget: send order emails to admin + customer
        const saleId = response.sale_id || response.data?.id;
        if (saleId) {
          apiClient.post(`/sales/${saleId}/notify`).catch(() => {});
        }

        const customerName = newCustomerName || (selectedCustomerId ? customerOptions.find(o => o.value === selectedCustomerId)?.label : null);
        const customerEmail = newCustomerEmail || (selectedCustomerId ? customerOptions.find(o => o.value === selectedCustomerId)?.email : null);
        const saleData = {
          items: [...cart],
          total,
          totalItems,
          customerName,
          customerEmail,
          paymentMethod: paymentMethod === 'cash' ? 'CASH' : paymentMethod === 'gcash' ? 'GCASH' : paymentMethod === 'pay_later' ? 'PAY LATER' : 'COD',
          transactionId: response.data.transaction_id,
          time: response.data.date_formatted || new Date().toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }),
          cashTendered: paymentMethod === 'cash' ? parseFloat(cashTendered) : null,
          change: paymentMethod === 'cash' ? parseFloat(cashTendered) - total : null,
          gcashReference: paymentMethod === 'gcash' ? gcashReference : null,
          deliveryFee: forDelivery ? deliveryFee : 0,
          subtotal,
          forDelivery,
        };
        setLastSale(saleData);
        setShowPaymentModal(false);
        setShowSaleCompleteModal(true);
        
        // Automatically print receipt (1 copy by default, can be configured)
        const receiptCopies = parseInt(businessSettings.receipt_copies) || 1;
        setTimeout(() => {
          autoPrintReceipt(saleData, businessSettings.business_name || 'KJP Ricemill', receiptCopies);
        }, 500);
        
        setCart([]);
        setSelectedCustomerId('');
        setNewCustomerName('');
        setNewCustomerContact('');
        setNewCustomerEmail('');
        setNewCustomerAddress('');
        setNewCustomerLandmark('');
        setCustomerError('');
        setEmailError('');
        setForDelivery(false);
        setDeliveryAddress('');
        setDistanceKm('');
        setSelectedCoords(null);
        setEstimatedDuration(null);
        setAddressSuggestions([]);

        // Refresh data
        invalidateCache('/sales');
        invalidateCache('/products');
        refetchSales();
        refetchProducts();
        if (newCustomerName) {
          invalidateCache('/customers');
          refetchCustomers();
        }
      } else {
        throw response;
      }
    } catch (error) {
      if (error.response?.data?.errors || error.errors) {
        const backendErrors = error.response?.data?.errors || error.errors;
        toast.error('Order Failed', `Please fix: ${Object.values(backendErrors).flat().join(', ')}`);
      } else {
        toast.error('Order Failed', error.message || 'Failed to create order');
      }
    } finally {
      setSaving(false);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalSacks = totalItems; // Each item quantity represents sacks

  // Calculate delivery fee based on business settings
  const deliveryFee = useMemo(() => {
    if (!forDelivery || !distanceKm) return 0;
    const distance = parseFloat(distanceKm) || 0;
    const baseKm = parseFloat(businessSettings.shipping_base_km) || 1;
    const ratePerSack = parseFloat(businessSettings.shipping_rate_per_sack) || 0;
    const ratePerKm = parseFloat(businessSettings.shipping_rate_per_km) || 0;
    // Formula: ceil(distance / baseKm) * ratePerSack * totalSacks + (ratePerKm * distance)
    const sackBasedFee = Math.ceil(distance / baseKm) * ratePerSack * totalSacks;
    const kmBasedFee = ratePerKm * distance;
    return sackBasedFee + kmBasedFee;
  }, [forDelivery, distanceKm, totalSacks, businessSettings.shipping_base_km, businessSettings.shipping_rate_per_sack, businessSettings.shipping_rate_per_km]);

  const total = subtotal + deliveryFee;

  return (
    <div>
      <PageHeader 
        title="Point of Sale" 
        description="Process sales transactions quickly and efficiently"
        icon={Monitor}
      />

      <div className="flex gap-4 lg:gap-6" style={{ height: 'calc(100vh - 200px)', minHeight: '540px' }}>
        {/* Products Section - scrollable */}
        <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 p-4 flex flex-col overflow-hidden">
          {/* Search and Variety Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4 pb-4 border-b-2 border-primary-100 dark:border-primary-800 shrink-0">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-medium bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
              />
            </div>
            <div className="relative">
              <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedVariety}
                onChange={(e) => setSelectedVariety(e.target.value)}
                className="pl-9 pr-8 py-2.5 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 appearance-none cursor-pointer min-w-[160px] font-medium"
              >
                <option value="">All Varieties</option>
                {varieties.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Products Grid - scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-3">
              {productsLoading && products.length === 0 ? (
                Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-200 dark:border-primary-700 shadow-sm p-3 text-center animate-pulse">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl mx-auto mb-2" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto mb-2" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto mb-1" />
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mx-auto mb-1" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-2/5 mx-auto mt-1" />
                  </div>
                ))
              ) : filteredProducts.map((product) => {
                const hasNoPrice = !product.price || product.price <= 0;
                return (
                <div 
                  key={product.id} 
                  onClick={() => addToCart(product)}
                  className={`bg-white dark:bg-gray-800 rounded-xl border-2 shadow-sm p-3 text-center transition-all ${
                    hasNoPrice
                      ? 'border-red-300 dark:border-red-700 opacity-60 cursor-not-allowed'
                      : 'border-primary-200 dark:border-primary-700 cursor-pointer hover:shadow-lg hover:border-primary-400 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 hover:scale-[1.02]'
                  }`}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-secondary-100 dark:to-gray-800 rounded-xl mx-auto mb-2 flex items-center justify-center border border-primary-200 dark:border-primary-700">
                    <Package size={20} className="text-primary-600 dark:text-primary-400" />
                  </div>
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-xs mb-1 line-clamp-2">{product.name}{product.weight_formatted ? ` (${product.weight_formatted})` : ''}</h4>
                  {hasNoPrice ? (
                    <p className="text-red-500 dark:text-red-400 font-bold text-xs">No price set</p>
                  ) : (
                    <p className="text-primary-600 dark:text-primary-400 font-bold text-sm">₱{product.price.toLocaleString()}</p>
                  )}
                  <p className={`text-[10px] mt-0.5 ${product.stock > 0 ? 'text-gray-400' : 'text-amber-500 font-medium'}`}>{product.stock > 0 ? `${product.stock} in stock` : 'No stock'}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-full border border-primary-200 dark:border-primary-700">
                    {product.variety}
                  </span>
                </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cart Section - fixed, fills height */}
        <div className="hidden lg:flex lg:flex-col w-72 xl:w-96 shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 overflow-hidden flex flex-col h-full">
            {/* Cart Header */}
            <div className="p-4 bg-gradient-to-r from-button-500 to-button-600 text-white border-b-2 border-button-600 shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <ShoppingCart size={18} />
                Current Order
                {cart.length > 0 && (
                  <span className="ml-auto bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                    {cart.length} {cart.length === 1 ? 'item' : 'items'}
                  </span>
                )}
              </h3>
            </div>

            <div className="flex-1 flex flex-col min-h-0 p-3">
              {/* Cart Items - scrollable */}
              <div className="flex-1 overflow-y-auto min-h-[120px] mb-4">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 flex flex-col items-center justify-center h-full">
                    <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">Cart is empty</p>
                    <p className="text-xs">Click on products to add</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 bg-primary-50 dark:bg-gray-700 rounded-lg border-2 border-primary-200 dark:border-primary-700">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 dark:text-gray-100 text-xs truncate">{item.name}{item.weight_formatted ? ` (${item.weight_formatted})` : ''}</p>
                          <p className="text-primary-600 dark:text-primary-400 text-xs font-medium">₱{item.price.toLocaleString()} × {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="xs" onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }}>
                            <Minus size={12} />
                          </Button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              e.stopPropagation();
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val > 0) {
                                setCart(cart.map(ci => ci.id === item.id ? { ...ci, quantity: val } : ci));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onWheel={(e) => e.target.blur()}
                            className="w-10 text-center text-xs font-bold border border-primary-200 dark:border-primary-700 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-400 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <Button variant="outline" size="xs" onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}>
                            <Plus size={12} />
                          </Button>
                          <Button variant="danger" size="xs" onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }} className="ml-1">
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order Type */}
              <div className="border-t-2 border-primary-200 dark:border-primary-700 pt-3 mb-4 shrink-0">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">Order Type</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setForDelivery(false); setDeliveryAddress(''); setDistanceKm(''); setSelectedCoords(null); setEstimatedDuration(null); setAddressSuggestions([]); }}
                    className="flex items-center justify-center gap-1.5 p-2 rounded-lg transition-all font-semibold text-xs"
                    style={!forDelivery
                      ? { backgroundColor: '#10b98115', border: '2px solid #10b981', color: '#10b981' }
                      : { border: '1px solid var(--color-primary-200)', color: 'var(--color-text-secondary)' }
                    }>
                    <Package size={14} />
                    Pick Up
                  </button>
                  <button onClick={() => {
                      setForDelivery(true);
                      if (!deliveryAddress && selectedCustomerId) {
                        const cust = (customersRaw || []).find(c => String(c.id) === selectedCustomerId);
                        if (cust?.address) { setDeliveryAddress(cust.address); autoCalcDistance(cust.address); }
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 p-2 rounded-lg transition-all font-semibold text-xs"
                    style={forDelivery
                      ? { backgroundColor: '#f9731615', border: '2px solid #f97316', color: '#f97316' }
                      : { border: '1px solid var(--color-primary-200)', color: 'var(--color-text-secondary)' }
                    }>
                    <Truck size={14} />
                    Delivery
                  </button>
                </div>

                {forDelivery && (deliveryAddress || distanceKm || calculatingDistance) && (
                  <div className="mt-2 space-y-1">
                    {deliveryAddress && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-start gap-1">
                        <MapPin size={10} className="mt-0.5 shrink-0 text-orange-400" />
                        <span className="line-clamp-2">{deliveryAddress}</span>
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      {distanceKm && (
                        <p className="text-[10px] text-orange-500 font-medium flex items-center gap-1">
                          <Navigation size={10} />
                          {distanceKm} km
                          {estimatedDuration && (
                            <span className="text-gray-400 ml-1">
                              (~{estimatedDuration >= 60 ? `${Math.floor(estimatedDuration / 60)}h ${estimatedDuration % 60}m` : `${estimatedDuration} min`})
                            </span>
                          )}
                        </p>
                      )}
                      {calculatingDistance && (
                        <p className="text-[10px] text-orange-500 flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" /> Calculating...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method - always visible */}
              <div className="border-t-2 border-primary-200 dark:border-primary-700 pt-4 mb-4 shrink-0">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">Payment Method</p>
                <div className="grid grid-cols-2 gap-2">
                  {posPaymentMethods.map(method => {
                    const Icon = method.icon;
                    const isSelected = paymentMethod === method.value;
                    return (
                      <button key={method.value} onClick={() => setPaymentMethod(method.value)}
                        className="flex items-center justify-center gap-2 p-2.5 rounded-lg transition-all font-semibold text-xs"
                        style={isSelected
                          ? { backgroundColor: `${method.color}15`, border: `2px solid ${method.color}`, color: method.color }
                          : { border: '1px solid var(--color-primary-200)', color: 'var(--color-text-secondary)' }
                        }>
                        <Icon size={16} />
                        {method.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Total Section - always visible */}
              <div className="border-t-2 border-primary-200 dark:border-primary-700 pt-4 shrink-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Subtotal</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">₱{subtotal.toLocaleString()}</span>
                </div>
                {forDelivery && deliveryFee > 0 && (
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-orange-500 font-medium flex items-center gap-1">
                      <Truck size={10} /> Shipping Fee
                    </span>
                    <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">₱{deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-primary-100 dark:border-primary-800">
                  <span className="font-bold text-gray-800 dark:text-gray-100">Total</span>
                  <span className="text-xl font-bold text-primary-600 dark:text-primary-400">₱{total.toLocaleString()}</span>
                </div>
                
                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button onClick={completeSale} className="w-full" icon={Receipt} disabled={cart.length === 0}>
                    Place Order
                  </Button>
                  <Button onClick={voidTransaction} className="w-full" variant="outline" icon={RotateCcw}>
                    Void Transaction
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Cart Floating Bar (below lg) */}
      <div className="lg:hidden">
        {cart.length > 0 && (
          <>
            {mobileCartOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setMobileCartOpen(false)} />}
            <div className="fixed bottom-20 md:bottom-0 left-0 right-0 z-50">
              {mobileCartOpen && (
                <div className="bg-white dark:bg-gray-800 max-h-[70vh] overflow-y-auto rounded-t-2xl shadow-2xl border-t-2 border-primary-200 dark:border-primary-700">
                  <div className="p-4">
                    {/* Cart Header */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <ShoppingCart size={16} className="text-primary-600 dark:text-primary-400" />
                        Current Order
                      </h3>
                      <span className="text-xs font-semibold bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-700">
                        {cart.length} {cart.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    {/* Cart Items */}
                    <div className="space-y-2 mb-4 max-h-[25vh] overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2.5 bg-primary-50 dark:bg-gray-700 rounded-lg border-2 border-primary-200 dark:border-primary-700">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 dark:text-gray-100 text-xs truncate">{item.name}{item.weight_formatted ? ` (${item.weight_formatted})` : ''}</p>
                            <p className="text-primary-600 dark:text-primary-400 text-xs font-medium">₱{item.price.toLocaleString()} × {item.quantity}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="xs" onClick={() => updateQuantity(item.id, -1)}>
                              <Minus size={12} />
                            </Button>
                            <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                            <Button variant="outline" size="xs" onClick={() => updateQuantity(item.id, 1)}>
                              <Plus size={12} />
                            </Button>
                            <Button variant="danger" size="xs" onClick={() => removeFromCart(item.id)} className="ml-1">
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order Type - Mobile */}
                    <div className="border-t-2 border-primary-200 dark:border-primary-700 pt-3 mb-3">
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">Order Type</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => { setForDelivery(false); setDeliveryAddress(''); setDistanceKm(''); setSelectedCoords(null); setEstimatedDuration(null); setAddressSuggestions([]); }}
                          className="flex items-center justify-center gap-1.5 p-2 rounded-lg transition-all font-semibold text-xs"
                          style={!forDelivery
                            ? { backgroundColor: '#10b98115', border: '2px solid #10b981', color: '#10b981' }
                            : { border: '1px solid var(--color-primary-200)', color: 'var(--color-text-secondary)' }
                          }>
                          <Package size={14} />
                          Pick Up
                        </button>
                        <button onClick={() => {
                            setForDelivery(true);
                            if (!deliveryAddress && selectedCustomerId) {
                              const cust = (customersRaw || []).find(c => String(c.id) === selectedCustomerId);
                              if (cust?.address) { setDeliveryAddress(cust.address); autoCalcDistance(cust.address); }
                            }
                          }}
                          className="flex items-center justify-center gap-1.5 p-2 rounded-lg transition-all font-semibold text-xs"
                          style={forDelivery
                            ? { backgroundColor: '#f9731615', border: '2px solid #f97316', color: '#f97316' }
                            : { border: '1px solid var(--color-primary-200)', color: 'var(--color-text-secondary)' }
                          }>
                          <Truck size={14} />
                          Delivery
                        </button>
                      </div>
                      {forDelivery && (deliveryAddress || distanceKm) && (
                        <div className="mt-1">
                          {deliveryAddress && <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate"><MapPin size={10} className="inline mr-0.5 text-orange-400" />{deliveryAddress}</p>}
                          {distanceKm && <p className="text-[10px] text-orange-500 font-medium"><Navigation size={10} className="inline mr-0.5" />{distanceKm} km</p>}
                        </div>
                      )}
                    </div>

                    {/* Payment Method */}
                    <div className="border-t-2 border-primary-200 dark:border-primary-700 pt-3 mb-3">
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">Payment Method</p>
                      <div className="grid grid-cols-2 gap-2">
                        {posPaymentMethods.map(method => {
                          const Icon = method.icon;
                          const isSelected = paymentMethod === method.value;
                          return (
                            <button key={method.value} onClick={() => setPaymentMethod(method.value)}
                              className="flex items-center justify-center gap-1.5 p-2 rounded-lg transition-all font-semibold text-xs"
                              style={isSelected
                                ? { backgroundColor: `${method.color}15`, border: `2px solid ${method.color}`, color: method.color }
                                : { border: '1px solid var(--color-primary-200)', color: 'var(--color-text-secondary)' }
                              }>
                              <Icon size={14} />
                              {method.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Total */}
                    <div className="border-t-2 border-primary-200 dark:border-primary-700 pt-3 mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Subtotal</span>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">₱{subtotal.toLocaleString()}</span>
                      </div>
                      {forDelivery && deliveryFee > 0 && (
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-orange-500 font-medium flex items-center gap-1"><Truck size={10} /> Shipping</span>
                          <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">₱{deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800 dark:text-gray-100">Total</span>
                        <span className="text-lg font-bold text-primary-600 dark:text-primary-400">₱{total.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      <Button onClick={() => { setMobileCartOpen(false); completeSale(); }} className="w-full" icon={Receipt} disabled={cart.length === 0}>
                        Place Order
                      </Button>
                      <Button onClick={() => { setMobileCartOpen(false); voidTransaction(); }} className="w-full" variant="outline" icon={RotateCcw}>
                        Void Transaction
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <button onClick={() => setMobileCartOpen(!mobileCartOpen)}
                className="w-full flex items-center justify-between px-5 py-3 text-white bg-button-500 hover:bg-button-600 transition-all rounded-t-xl shadow-lg">
                <span className="font-medium text-sm flex items-center gap-2">
                  <ShoppingCart size={16} />
                  {totalItems} item(s) × ₱{total.toLocaleString()}
                </span>
                <span className="flex items-center gap-1 text-sm font-medium">
                  {mobileCartOpen ? 'Close' : 'View Cart'} {mobileCartOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Pick Up Confirmation Modal */}
      {showWalkInConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowWalkInConfirm(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border-2 border-primary-200 dark:border-primary-700">
              <div className="p-5 bg-gradient-to-r from-amber-500 to-amber-600 text-white shrink-0">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <AlertCircle size={20} />
                  Pick Up Order
                </h3>
                <p className="text-amber-100 text-sm mt-1">Delivery is not enabled for this order</p>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">
                  This order will be processed as a <span className="font-semibold text-amber-600 dark:text-amber-400">pick up transaction</span>. The customer will pick up or receive the items at the store.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                  If this should be a delivery order, cancel and toggle "Delivery" first.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowWalkInConfirm(false)}
                    className="flex-1 py-2.5 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={proceedToCustomerModal}
                    className="flex-1 py-2.5 bg-button-500 hover:bg-button-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16} />
                    Yes, Pick Up
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowCustomerModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-primary-200 dark:border-primary-700 max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-button-500 to-button-600 text-white shrink-0">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <User size={20} />
                  Customer Information
                </h3>
                <p className="text-xs text-white/80 mt-0.5">Select an existing customer or add a new one</p>
              </div>

              <div className="p-4 overflow-y-auto flex-1 min-h-0">
                {/* Order Summary */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5 mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500 dark:text-gray-400">Items</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{totalItems} items</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-1.5 mt-1.5">
                    <span className="font-bold text-gray-800 dark:text-gray-100">Total</span>
                    <span className="text-xl font-bold text-primary-600 dark:text-primary-400">₱{total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Customer Combobox */}
                <CustomerCombobox
                  value={selectedCustomerId}
                  newName={newCustomerName}
                  newContact={newCustomerContact}
                  newEmail={newCustomerEmail}
                  newAddress={newCustomerAddress}
                  newLandmark={newCustomerLandmark}
                  onChange={handleCustomerSelect}
                  onInputChange={handleNewCustomerInput}
                  onContactChange={handleNewCustomerContact}
                  onEmailChange={handleNewCustomerEmail}
                  onAddressChange={handleNewCustomerAddress}
                  onLandmarkChange={handleNewCustomerLandmark}
                  customerOptions={customerOptions}
                  selectedEmail={selectedCustomerId ? (customerOptions.find(o => o.value === selectedCustomerId)?.email || '') : ''}
                  error={customerError}
                  emailError={emailError}
                />

                {/* Delivery Address × shown when For Delivery is toggled on */}
                {forDelivery && (
                  <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border-2 border-orange-200 dark:border-orange-700">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">
                      <Truck size={14} className="text-orange-500" />
                      Delivery Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin size={12} className="absolute left-2.5 top-3 text-gray-400" />
                      <textarea
                        ref={addressInputRef}
                        value={deliveryAddress}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDeliveryAddress(val);
                          setDistanceKm('');
                          setEstimatedDuration(null);
                          setSelectedCoords(null);
                          setCustomerError('');
                          // Trigger autocomplete
                          debouncedSearchAddress(val, (results) => {
                            setAddressSuggestions(results);
                            setShowSuggestions(results.length > 0);
                          }, warehouseCoords || {});
                          // Debounce auto-calc distance after typing stops
                          if (distanceCalcTimer.current) clearTimeout(distanceCalcTimer.current);
                          if (val && val.length >= 5) {
                            distanceCalcTimer.current = setTimeout(() => {
                              autoCalcDistance(val);
                            }, 1500);
                          }
                        }}
                        onFocus={() => { if (addressSuggestions.length > 0) setShowSuggestions(true); }}
                        placeholder="Enter delivery address..."
                        rows={2}
                        className="w-full pl-7 pr-3 py-2 text-xs border-2 border-orange-200 dark:border-orange-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none bg-white dark:bg-gray-800 dark:text-gray-100"
                      />
                      {/* Suggestions dropdown */}
                      {showSuggestions && addressSuggestions.length > 0 && (
                        <div ref={suggestionsRef} className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border-2 border-orange-200 dark:border-orange-700 rounded-lg shadow-lg max-h-36 overflow-y-auto">
                          {addressSuggestions.map((s, i) => (
                            <button
                              key={i}
                              onClick={async () => {
                                setDeliveryAddress(s.label);
                                setShowSuggestions(false);
                                setAddressSuggestions([]);
                                setSelectedCoords({ lat: s.lat, lng: s.lng });
                                // Cancel pending debounced calc
                                if (distanceCalcTimer.current) clearTimeout(distanceCalcTimer.current);
                                // Auto-calculate distance
                                setCalculatingDistance(true);
                                try {
                                  const wCoords = await getWarehouseCoords();
                                  if (wCoords) {
                                    const result = await calculateDistance(wCoords.lat, wCoords.lng, s.lat, s.lng);
                                    setDistanceKm(String(result.distanceKm));
                                    setEstimatedDuration(result.durationMin);
                                    setIsEstimate(result.isEstimate || false);
                                  }
                                } catch (err) {
                                  console.error('Distance calc failed:', err);
                                } finally {
                                  setCalculatingDistance(false);
                                }
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 dark:hover:bg-orange-900/20 border-b border-gray-100 last:border-0 transition-colors"
                            >
                              <span className="font-medium text-gray-800 dark:text-gray-100">{s.label}</span>
                              {s.locality && <span className="block text-[10px] text-gray-400">{s.locality}{s.region ? `, ${s.region}` : ''}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Distance info */}
                    {(deliveryAddress.trim() || distanceKm || calculatingDistance) && (
                      <div className="mt-2 space-y-1.5">
                        {calculatingDistance ? (
                          <p className="text-[10px] text-orange-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Calculating distance...</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              <Navigation size={10} className="text-orange-500 shrink-0" />
                              <input
                                type="number"
                                value={distanceKm}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || parseFloat(val) >= 0) setDistanceKm(val);
                                }}
                                onWheel={(e) => e.target.blur()}
                                min="0"
                                step="0.1"
                                placeholder="0"
                                className="w-16 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-700 border border-orange-300 dark:border-orange-600 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400">km</span>
                              {estimatedDuration && (
                                <span className="text-[10px] text-gray-400 font-normal ml-1">
                                  (~{estimatedDuration >= 60 ? `${Math.floor(estimatedDuration / 60)}h ${estimatedDuration % 60}m` : `${estimatedDuration} min`} drive)
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-gray-400 dark:text-gray-500 italic">{distanceKm ? 'Auto-calculated × adjust if inaccurate' : 'Enter distance in km from warehouse'}</p>
                            {deliveryFee > 0 && (() => {
                              const distance = parseFloat(distanceKm) || 0;
                              const baseKm = parseFloat(businessSettings.shipping_base_km) || 1;
                              const ratePerSack = parseFloat(businessSettings.shipping_rate_per_sack) || 0;
                              const ratePerKm = parseFloat(businessSettings.shipping_rate_per_km) || 0;
                              const trips = Math.ceil(distance / baseKm);
                              const sackFee = trips * ratePerSack * totalSacks;
                              const kmFee = ratePerKm * distance;
                              return (
                                <div className="bg-orange-100/60 dark:bg-orange-900/20 rounded-lg p-2 space-y-1">
                                  <p className="text-[10px] font-bold text-orange-700 dark:text-orange-300 uppercase tracking-wide">Shipping Fee Breakdown</p>
                                  <div className="text-[10px] text-gray-600 dark:text-gray-300 space-y-0.5">
                                    {ratePerSack > 0 && (
                                      <div className="flex justify-between">
                                        <span>Sack-based: ⌈{distance}/{baseKm}⌉ × ₱{ratePerSack} × {totalSacks} sacks</span>
                                        <span className="font-semibold text-gray-800 dark:text-gray-100">₱{sackFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    )}
                                    {ratePerKm > 0 && (
                                      <div className="flex justify-between">
                                        <span>Distance-based: ₱{ratePerKm}/km × {distance} km</span>
                                        <span className="font-semibold text-gray-800 dark:text-gray-100">₱{kmFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex justify-between border-t border-orange-300 dark:border-orange-700/50 pt-1">
                                    <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300">Total Shipping</span>
                                    <span className="text-xs font-bold text-orange-700 dark:text-orange-300">₱{deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 flex gap-3 shrink-0 border-t-2 border-primary-100 dark:border-primary-800">
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCustomer}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-button-500 hover:bg-button-600 transition-all"
                >
                  <Receipt size={14} /> Continue to Payment
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Payment Modal - Cash / GCash */}
      {showPaymentModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowPaymentModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full overflow-hidden border-2 border-primary-200 dark:border-primary-700 ${paymentMethod === 'gcash' && (businessSettings.gcash_qr || businessSettings.gcash_name || businessSettings.gcash_number) ? 'max-w-3xl' : 'max-w-md'}`}>
              {/* Header */}
              <div className={`p-5 text-white shrink-0 ${paymentMethod === 'cash' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : paymentMethod === 'gcash' ? 'bg-gradient-to-r from-blue-500 to-blue-600' : paymentMethod === 'pay_later' ? 'bg-gradient-to-r from-purple-500 to-purple-600' : 'bg-gradient-to-r from-amber-500 to-amber-600'}`}>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  {paymentMethod === 'cash' ? <DollarSign size={20} /> : paymentMethod === 'gcash' ? <Smartphone size={20} /> : paymentMethod === 'pay_later' ? <Clock size={20} /> : <Banknote size={20} />}
                  {paymentMethod === 'cash' ? 'Cash Payment' : paymentMethod === 'gcash' ? 'GCash Payment' : paymentMethod === 'pay_later' ? 'Pay Later' : 'Cash on Delivery'}
                </h3>
                <p className="text-sm text-white/80 mt-1">
                  {paymentMethod === 'cash' ? 'Enter amount tendered by customer' : paymentMethod === 'gcash' ? 'Enter GCash reference number' : paymentMethod === 'pay_later' ? 'Order will be placed with payment pending' : 'Order will be paid upon delivery'}
                </p>
              </div>

              <div className={`${paymentMethod === 'gcash' && (businessSettings.gcash_qr || businessSettings.gcash_name || businessSettings.gcash_number) ? 'flex' : ''}`}>
              {/* Left side: form content */}
              <div className="flex-1 min-w-0">
              <div className="p-5">
                {/* Order Summary */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500 dark:text-gray-400">Items</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{totalItems} items</span>
                  </div>
                  {forDelivery && deliveryFee > 0 && (() => {
                    const distance = parseFloat(distanceKm) || 0;
                    const baseKm = parseFloat(businessSettings.shipping_base_km) || 1;
                    const ratePerSack = parseFloat(businessSettings.shipping_rate_per_sack) || 0;
                    const ratePerKm = parseFloat(businessSettings.shipping_rate_per_km) || 0;
                    const trips = Math.ceil(distance / baseKm);
                    const sackFee = trips * ratePerSack * totalSacks;
                    const kmFee = ratePerKm * distance;
                    return (
                      <>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                          <span className="font-medium text-gray-800 dark:text-gray-100">₱{subtotal.toLocaleString()}</span>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-md p-2 mb-1">
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className="text-orange-500 flex items-center gap-1"><Truck size={12} /> Shipping</span>
                            <span className="font-medium text-orange-600 dark:text-orange-400">₱{deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 space-y-0.5 mt-1">
                            {ratePerSack > 0 && (
                              <div className="flex justify-between">
                                <span>Sack fee: ⌈{distance}/{baseKm}⌉ × ₱{ratePerSack} × {totalSacks} sacks</span>
                                <span className="text-gray-700 dark:text-gray-200">₱{sackFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {ratePerKm > 0 && (
                              <div className="flex justify-between">
                                <span>Distance fee: ₱{ratePerKm}/km × {distance} km</span>
                                <span className="text-gray-700 dark:text-gray-200">₱{kmFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            <p className="text-[9px] text-gray-400 mt-0.5">Distance: {distanceKm} km from warehouse</p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                    <span className="font-bold text-gray-800 dark:text-gray-100">Total Due</span>
                    <span className="text-xl font-bold text-primary-600 dark:text-primary-400">₱{total.toLocaleString()}</span>
                  </div>
                </div>

                {paymentMethod === 'cash' ? (
                  <>
                    {/* Cash Tendered Input */}
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">Cash Tendered</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₱</span>
                        <input
                          type="number"
                          value={cashTendered}
                          onChange={(e) => setCashTendered(e.target.value)}
                          onWheel={(e) => e.target.blur()}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-3 text-lg font-bold border-2 border-primary-200 dark:border-primary-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 dark:text-gray-100"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Quick Amount Buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                      {[total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000].filter((v, i, a) => a.indexOf(v) === i).map(amount => (
                        <button
                          key={amount}
                          onClick={() => setCashTendered(String(amount))}
                          className="py-2 rounded-lg text-xs font-semibold border-2 border-primary-200 dark:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-400 transition-all dark:text-gray-200"
                        >
                          ₱{amount.toLocaleString()}
                        </button>
                      ))}
                    </div>

                    {/* Change Display */}
                    {cashTendered && (
                      <div className={`rounded-lg p-3 text-center ${parseFloat(cashTendered) >= total ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700'}`}>
                        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: parseFloat(cashTendered) >= total ? '#16a34a' : '#dc2626' }}>
                          {parseFloat(cashTendered) >= total ? 'Change' : 'Insufficient'}
                        </p>
                        <p className={`text-2xl font-bold ${parseFloat(cashTendered) >= total ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          ₱{Math.abs((parseFloat(cashTendered) || 0) - total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                  </>
                ) : paymentMethod === 'gcash' ? (
                  <>
                    {/* GCash Reference */}
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">GCash Reference Number <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={gcashReference}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d\s]/g, '').slice(0, 15);
                          setGcashReference(val);
                          setGcashRefError('');
                          checkGcashReference(val);
                        }}
                        placeholder="Enter 13-digit reference number"
                        className={`w-full px-4 py-3 text-lg font-bold border-2 rounded-lg focus:outline-none focus:ring-2 tracking-wider bg-white dark:bg-gray-700 dark:text-gray-100 ${
                          gcashRefError
                            ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                            : gcashReference.replace(/\s/g, '').length > 0 && gcashReference.replace(/\s/g, '').length !== 13
                              ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                              : gcashReference.replace(/\s/g, '').length === 13 && !gcashRefError
                                ? 'border-green-400 focus:ring-green-500 focus:border-green-500'
                                : 'border-primary-200 dark:border-primary-700 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                        autoFocus
                      />
                      {gcashRefError && (
                        <p className="mt-1 text-xs text-red-500">{gcashRefError}</p>
                      )}
                      {!gcashRefError && gcashReference.replace(/\s/g, '').length > 0 && gcashReference.replace(/\s/g, '').length !== 13 && (
                        <p className="mt-1 text-xs text-red-500">Reference number must be exactly 13 digits (currently {gcashReference.replace(/\s/g, '').length}).</p>
                      )}
                    </div>

                    {/* Payment Proof Upload */}
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">
                        Payment Proof <span className="text-red-500">*</span>
                      </label>

                      {/* Camera View */}
                      {showCamera && (
                        <div className="relative mb-3 rounded-lg overflow-hidden border-2 border-blue-300 dark:border-blue-700">
                          <video ref={cameraVideoRef} autoPlay playsInline className="w-full h-48 object-cover bg-black" />
                          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-3">
                            <button onClick={capturePhoto} className="px-4 py-2 bg-blue-500 text-white text-xs font-bold rounded-full shadow-lg hover:bg-blue-600 flex items-center gap-1.5">
                              <Camera size={14} /> Capture
                            </button>
                            <button onClick={stopCamera} className="px-4 py-2 bg-gray-600 text-white text-xs font-bold rounded-full shadow-lg hover:bg-gray-700 flex items-center gap-1.5">
                              <X size={14} /> Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Proof Previews */}
                      {gcashProofPreviews.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {gcashProofPreviews.map((url, idx) => (
                            <div key={idx} className="relative group">
                              <img src={url} alt={`Proof ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg border-2 border-blue-200 dark:border-blue-700" />
                              <button
                                onClick={() => removeGcashProof(idx)}
                                className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload + Camera Buttons */}
                      {!showCamera && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => gcashProofInputRef.current?.click()}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-xs font-semibold transition-all ${
                              gcashProofFiles.length === 0
                                ? 'border-red-300 dark:border-red-600 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400'
                                : 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400'
                            }`}
                          >
                            <ImageIcon size={14} /> Upload Image
                          </button>
                          <button
                            type="button"
                            onClick={startCamera}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-xs font-semibold transition-all ${
                              gcashProofFiles.length === 0
                                ? 'border-red-300 dark:border-red-600 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400'
                                : 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400'
                            }`}
                          >
                            <Camera size={14} /> Open Camera
                          </button>
                          <input
                            ref={gcashProofInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleGcashProofUpload}
                            className="hidden"
                          />
                        </div>
                      )}
                      {gcashProofFiles.length === 0 && (
                        <p className="mt-1 text-xs text-red-500">Payment proof is required.</p>
                      )}
                    </div>

                    {/* GCash Info */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-3">
                      <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1 uppercase tracking-wide">Payment Verification</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">Enter the exact 13-digit GCash reference number and upload a screenshot or capture the payment confirmation as proof.</p>
                    </div>
                  </>
                ) : paymentMethod === 'pay_later' ? (
                  <>
                    {/* Pay Later Info */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-lg p-4 text-center">
                      <Clock size={32} className="mx-auto mb-2 text-purple-500" />
                      <p className="text-sm font-bold text-purple-700 dark:text-purple-300 mb-1">Pay Later</p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">The order will be placed with payment pending. Customer can pay at a later time.</p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* COD Info */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700 rounded-lg p-4 text-center">
                      <Banknote size={32} className="mx-auto mb-2 text-amber-500" />
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-1">Cash on Delivery</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">Payment will be collected upon delivery. The order will be placed as pending.</p>
                    </div>
                  </>
                )}
              </div>
              </div>{/* end left-side flex-1 */}

              {/* Right side: GCash QR Code & Info Panel */}
              {paymentMethod === 'gcash' && (businessSettings.gcash_qr || businessSettings.gcash_name || businessSettings.gcash_number) && (
                <div className="w-64 shrink-0 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-700 p-5 flex flex-col items-center justify-center gap-4">
                  <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide text-center">Send Payment Here</h4>
                  {businessSettings.gcash_qr && (
                    <div className="w-48 h-48 bg-white dark:bg-gray-800 rounded-xl border-2 border-blue-200 dark:border-blue-700 overflow-hidden shadow-lg">
                      <img src={businessSettings.gcash_qr} alt="GCash QR Code" className="w-full h-full object-contain p-2" />
                    </div>
                  )}
                  {businessSettings.gcash_name && (
                    <div className="text-center">
                      <p className="text-[10px] text-blue-500 dark:text-blue-400 uppercase tracking-wider font-semibold">Account Name</p>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{businessSettings.gcash_name}</p>
                    </div>
                  )}
                  {businessSettings.gcash_number && (
                    <div className="text-center">
                      <p className="text-[10px] text-blue-500 dark:text-blue-400 uppercase tracking-wider font-semibold">GCash Number</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tracking-wider">{businessSettings.gcash_number}</p>
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
                  onClick={() => { setShowPaymentModal(false); setShowCustomerModal(true); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-1"
                >
                  ← Back
                </button>
                <button
                  onClick={confirmPayment}
                  disabled={saving || (paymentMethod === 'cash' ? (!cashTendered || parseFloat(cashTendered) < total) : paymentMethod === 'gcash' ? (gcashReference.replace(/\s/g, '').length !== 13 || gcashProofFiles.length === 0 || !!gcashRefError) : false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                    paymentMethod === 'cash' ? 'bg-green-500 hover:bg-green-600' : paymentMethod === 'gcash' ? 'bg-blue-500 hover:bg-blue-600' : paymentMethod === 'pay_later' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  <Receipt size={14} /> {saving ? 'Placing...' : 'Place Order'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Void Transaction Modal */}
      {showVoidModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowVoidModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border-2 border-primary-200 dark:border-primary-700">
              {/* Modal Header */}
              <div className="p-5 bg-gradient-to-r from-red-500 to-red-600 text-white shrink-0">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <XCircle size={20} />
                  Void Transaction
                </h3>
                <p className="text-sm text-white/80 mt-1">Select a completed transaction to void and process refund</p>
              </div>

              <div className="p-5 flex-1 overflow-y-auto">
                {/* Search */}
                <div className="relative mb-4">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search transaction ID or time..."
                    value={voidSearch}
                    onChange={(e) => setVoidSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 font-medium bg-white dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>

                {/* Transactions List */}
                <div className="space-y-2 mb-4">
                  {filteredVoidTxns.length === 0 && (
                    <div className="py-6 flex flex-col items-center gap-2 text-gray-400 border-2 border-dashed border-primary-200 dark:border-primary-700 rounded-lg">
                      <XCircle size={24} className="opacity-40" />
                      <p className="text-sm font-medium">
                        {voidSearch ? `No transaction found for "${voidSearch}"` : 'No transactions today'}
                      </p>
                      <p className="text-xs text-center px-4">
                        {voidSearch ? 'Try a different order ID or time.' : 'Place an order first before voiding.'}
                      </p>
                    </div>
                  )}
                  {filteredVoidTxns.map(txn => {
                    const isVoided = txn.status === 'voided';
                    const isSelected = selectedVoidTxn?.id === txn.id;
                    return (
                      <div
                        key={txn.id}
                        onClick={() => !isVoided && setSelectedVoidTxn(isSelected ? null : txn)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          isVoided
                            ? 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-primary-200 dark:border-primary-700 hover:border-primary-400 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{txn.id}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Clock size={11} className="text-gray-400" />
                              <span className="text-xs text-gray-500 dark:text-gray-400">{txn.time}</span>
                              <span className="text-xs text-gray-400">×</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{txn.items} items</span>
                              <span className="text-xs text-gray-400">×</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{txn.payment}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary-600 dark:text-primary-400">₱{txn.total.toLocaleString()}</p>
                            {isVoided && (
                              <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">VOIDED</span>
                            )}
                          </div>
                        </div>
                        {/* Expanded items list when selected */}
                        {isSelected && txn.itemsList && txn.itemsList.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-700">
                            <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1.5">Ordered Items</p>
                            <div className="space-y-1">
                              {txn.itemsList.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <span className="text-gray-700 dark:text-gray-200 font-medium">{item.product_name || item.name}</span>
                                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                    <span>×{item.quantity}</span>
                                    <span className="font-semibold text-primary-600 dark:text-primary-400">₱{(item.unit_price || item.price || 0).toLocaleString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Void Reason */}
                {selectedVoidTxn && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700">
                    <p className="text-xs font-bold text-red-700 dark:text-red-300 mb-2 uppercase tracking-wide">Reason for Void</p>
                    <textarea
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder="Enter reason for voiding this transaction..."
                      className="w-full px-3 py-2 text-sm border-2 border-red-200 dark:border-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none bg-white dark:bg-gray-700 dark:text-gray-100"
                      rows={2}
                    />
                    <div className="flex items-center justify-between mt-2 text-xs text-red-600 dark:text-red-400">
                      <span>Refund amount:</span>
                      <span className="font-bold text-base">₱{selectedVoidTxn.total.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Password Confirmation - required for all roles */}
                {selectedVoidTxn && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700">
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
                      {isAdminOrAbove() ? 'Enter your password to authorize this void.' : 'Authorization from Admin or Super Admin is required to void transactions.'}
                    </p>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="p-4 flex gap-3 shrink-0 border-t-2 border-primary-100 dark:border-primary-800">
                <button
                  onClick={() => setShowVoidModal(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmVoid}
                  disabled={!selectedVoidTxn || !voidReason.trim() || !voidPassword.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <RotateCcw size={14} /> Confirm Void & Refund
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Post-Void Restock Items Modal */}
      {showVoidRestockModal && voidedTxnForRestock && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-primary-200 dark:border-primary-700">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
                  Restock Items — {voidedTxnForRestock.id}
                </h3>
                <button
                  onClick={() => { setShowVoidRestockModal(false); setVoidedTxnForRestock(null); setVoidRestockQtys({}); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
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
                              (voidedTxnForRestock.itemsList || []).filter(i => i.id).length > 0 &&
                              (voidedTxnForRestock.itemsList || []).filter(i => i.id).every(i => (voidRestockQtys[i.id] ?? 0) > 0)
                            }
                            onChange={(e) => {
                              const newQtys = { ...voidRestockQtys };
                              (voidedTxnForRestock.itemsList || []).filter(i => i.id).forEach(i => {
                                newQtys[i.id] = e.target.checked ? i.quantity : 0;
                              });
                              setVoidRestockQtys(newQtys);
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
                      {(voidedTxnForRestock.itemsList || []).map((item, idx) => {
                        const qty = voidRestockQtys[item.id] ?? 0;
                        return (
                          <tr key={item.id ?? idx} className="dark:bg-gray-700/50">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={qty > 0}
                                onChange={(e) => {
                                  setVoidRestockQtys(prev => ({
                                    ...prev,
                                    [item.id]: e.target.checked ? item.quantity : 0,
                                  }));
                                }}
                                className="rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.variety_color || '#6B7280' }} />
                                <span className="text-gray-800 dark:text-gray-100 text-xs font-medium">
                                  {item.product_name || item.name}{item.weight_formatted ? ` (${item.weight_formatted})` : ''}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-300 text-xs">{item.quantity}</td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={qty}
                                onChange={(e) => {
                                  const val = Math.max(0, Math.min(item.quantity, parseInt(e.target.value) || 0));
                                  setVoidRestockQtys(prev => ({ ...prev, [item.id]: val }));
                                }}
                                className="w-16 text-center px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-5 pb-3">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Reason / Notes <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={voidRestockNotes}
                    onChange={(e) => setVoidRestockNotes(e.target.value)}
                    placeholder="e.g. Items in good condition, bag torn..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => { setShowVoidRestockModal(false); setVoidedTxnForRestock(null); setVoidRestockQtys({}); setVoidRestockNotes(''); }}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold border border-primary-300 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700/50"
                >
                  Skip
                </button>
                <button
                  onClick={handleConfirmVoidRestock}
                  disabled={saving || Object.values(voidRestockQtys).filter(q => q > 0).length === 0}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Package size={14} /> {saving ? 'Restocking...' : `Restock ${Object.values(voidRestockQtys).filter(q => q > 0).length} Item(s)`}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Sale Complete Modal */}
      {showSaleCompleteModal && lastSale && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowSaleCompleteModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border-2 border-primary-200 dark:border-primary-700 animate-in fade-in zoom-in">
              {/* Success Header */}
              <div className="p-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold">Order Placed!</h3>
                <p className="text-sm text-white/80 mt-1">{lastSale.transactionId}</p>
              </div>

              {/* Receipt Details */}
              <div className="p-5">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Time</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{lastSale.time}</span>
                  </div>
                  {lastSale.customerName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Customer</span>
                      <div className="text-right">
                        <span className="font-medium text-gray-800 dark:text-gray-100">{lastSale.customerName}</span>
                        {lastSale.customerEmail && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">{lastSale.customerEmail}</p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Items</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{lastSale.totalItems} items</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Payment</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{lastSale.paymentMethod}</span>
                  </div>
                  {lastSale.paymentMethod === 'CASH' && lastSale.cashTendered && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Cash Tendered</span>
                        <span className="font-medium text-gray-800 dark:text-gray-100">₱{lastSale.cashTendered.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Change</span>
                        <span className="font-bold text-green-600 dark:text-green-400">₱{lastSale.change.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}
                  {lastSale.paymentMethod === 'GCASH' && lastSale.gcashReference && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">GCash Ref</span>
                      <span className="font-medium text-gray-800 dark:text-gray-100 tracking-wide">{lastSale.gcashReference}</span>
                    </div>
                  )}
                  <div className="border-t-2 border-primary-100 dark:border-primary-800 pt-2 mt-2">
                    {lastSale.forDelivery && lastSale.deliveryFee > 0 && (
                      <>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                          <span className="font-medium text-gray-800 dark:text-gray-100">₱{lastSale.subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-orange-500 flex items-center gap-1"><Truck size={12} /> Shipping</span>
                          <span className="font-medium text-orange-600 dark:text-orange-400">₱{lastSale.deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="font-bold text-gray-800 dark:text-gray-100">Total</span>
                      <span className="text-xl font-bold text-primary-600 dark:text-primary-400">₱{lastSale.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Items Ordered</p>
                  {lastSale.items.map(item => (
                    <div key={item.id} className="flex justify-between text-xs py-0.5">
                      <span className="text-gray-600 dark:text-gray-300">{item.name}{item.weight_formatted ? ` (${item.weight_formatted})` : ''} ×{item.quantity}</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">₱{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowSaleCompleteModal(false)}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-button-500 hover:bg-button-600 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PointOfSale;
