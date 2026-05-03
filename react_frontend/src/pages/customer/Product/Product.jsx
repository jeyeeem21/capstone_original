import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Search, Plus, Minus, Package,
  ShoppingCart, X, ChevronUp, ChevronDown, Grid, List,
  Trash2, Smartphone, Receipt, CheckCircle, Clock,
  Truck, MapPin, Loader2, Navigation, Camera, ImageIcon
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useBusinessSettings } from '../../../context/BusinessSettingsContext';
import { DEFAULT_LOGO } from '../../../api/config';
import { apiClient } from '../../../api';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { Skeleton, useToast } from '../../../components/ui';
import { debouncedSearchAddress, calculateDistance, geocodeAddress } from '../../../api/openRouteService';

const PESO = '\u20B1';
const sortOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
];

const paymentMethods = [
  { value: 'gcash', label: 'GCash', icon: Smartphone, color: '#3b82f6' },
  { value: 'pay_later', label: 'Pay Later', icon: Clock, color: '#8b5cf6' },
];

const Shop = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { settings: bizSettings } = useBusinessSettings();
  const toast = useToast();
  const { data: rawProducts, loading } = useDataFetch('/products');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVariety, setSelectedVariety] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [currentOrder, setCurrentOrder] = useState([]);
  const [mobileOrderOpen, setMobileOrderOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('gcash');

  // Delivery states
  const [forDelivery, setForDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [estimatedDuration, setEstimatedDuration] = useState(null);
  const [warehouseCoords, setWarehouseCoords] = useState(null);
  const [addressError, setAddressError] = useState('');
  const suggestionsRef = useRef(null);
  const addressInputRef = useRef(null);
  const distanceCalcTimer = useRef(null);

  // Map API product fields to component shape
  const products = useMemo(() => (rawProducts || []).map(p => ({
    id: p.id,
    name: p.product_name,
    variety: p.variety_name,
    varietyColor: p.variety_color,
    price: p.price,
    unit: p.unit,
    image: p.image,
    stocks: p.stocks,
    inStock: p.is_in_stock,
  })), [rawProducts]);

  const varieties = useMemo(() => {
    const names = [...new Set(products.map(p => p.variety).filter(Boolean))].sort();
    return ['All', ...names];
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesVariety = selectedVariety === 'All' || p.variety === selectedVariety;
      return matchesSearch && matchesVariety;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'price-low': return a.price - b.price;
        case 'price-high': return b.price - a.price;
        default: return b.id - a.id;
      }
    });

    return result;
  }, [products, searchTerm, selectedVariety, sortBy]);

  // Current Order management (POS-style) — click card to add 1, increment if already in order
  const addToOrder = (product) => {
    if (!product.inStock) return;
    setCurrentOrder(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stocks) return prev;
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: existing.quantity + 1 }
            : item
        );
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, unit: product.unit, image: product.image, stocks: product.stocks, quantity: 1 }];
    });
  };

  const removeFromOrder = (id) => setCurrentOrder(prev => prev.filter(item => item.id !== id));

  const updateOrderItemQty = (id, val) => {
    if (val === '' || val === undefined) {
      setCurrentOrder(prev => prev.map(i => i.id === id ? { ...i, quantity: '' } : i));
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num)) {
      setCurrentOrder(prev => prev.map(i => i.id === id ? { ...i, quantity: '' } : i));
      return;
    }
    setCurrentOrder(prev => prev.map(i =>
      i.id === id ? { ...i, quantity: Math.min(Math.max(0, num), i.stocks) } : i
    ));
  };

  const handleOrderItemBlur = (id) => {
    const item = currentOrder.find(i => i.id === id);
    if (!item || item.quantity === '' || item.quantity === undefined || item.quantity < 1) {
      setCurrentOrder(prev => prev.map(i => i.id === id ? { ...i, quantity: 1 } : i));
    }
  };

  // Warehouse coords helper
  const getWarehouseCoords = useCallback(async () => {
    if (warehouseCoords) return warehouseCoords;
    if (!bizSettings?.warehouse_address) return null;
    const coords = await geocodeAddress(bizSettings.warehouse_address);
    if (coords) setWarehouseCoords(coords);
    return coords;
  }, [warehouseCoords, bizSettings?.warehouse_address]);

  // Auto-calculate distance from address
  const autoCalcDistance = useCallback(async (address) => {
    if (!address) return;
    setCalculatingDistance(true);
    setAddressError('');
    try {
      const wCoords = await getWarehouseCoords();
      if (!wCoords) { setCalculatingDistance(false); return; }
      const coords = await geocodeAddress(address);
      if (coords) {
        setSelectedCoords(coords);
        setAddressError('');
        const result = await calculateDistance(wCoords.lat, wCoords.lng, coords.lat, coords.lng);
        setDistanceKm(String(result.distanceKm));
        setEstimatedDuration(result.durationMin);
      } else {
        setSelectedCoords(null);
        setDistanceKm('');
        setEstimatedDuration(null);
        setAddressError('Address not found in the Philippines. Please enter a valid PH address.');
      }
    } catch (err) {
      console.error('Distance calc failed:', err);
    } finally {
      setCalculatingDistance(false);
    }
  }, [getWarehouseCoords]);

  // Handle address input with autocomplete
  const handleAddressInput = useCallback((value) => {
    setDeliveryAddress(value);
    setSelectedCoords(null);
    setDistanceKm('');
    setEstimatedDuration(null);
    setAddressError('');
    debouncedSearchAddress(value, (results) => {
      setAddressSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, warehouseCoords || {});
    if (distanceCalcTimer.current) clearTimeout(distanceCalcTimer.current);
    if (value && value.length >= 5) {
      distanceCalcTimer.current = setTimeout(() => autoCalcDistance(value), 1500);
    }
  }, [warehouseCoords, autoCalcDistance]);

  // Handle selecting an address suggestion
  const handleSelectAddress = useCallback(async (suggestion) => {
    setDeliveryAddress(suggestion.label);
    setSelectedCoords({ lat: suggestion.lat, lng: suggestion.lng });
    setAddressError('');
    setShowSuggestions(false);
    setAddressSuggestions([]);
    if (distanceCalcTimer.current) clearTimeout(distanceCalcTimer.current);
    setCalculatingDistance(true);
    try {
      const wCoords = await getWarehouseCoords();
      if (wCoords) {
        const result = await calculateDistance(wCoords.lat, wCoords.lng, suggestion.lat, suggestion.lng);
        setDistanceKm(String(result.distanceKm));
        setEstimatedDuration(result.durationMin);
      }
    } catch (err) {
      console.error('Distance calc failed:', err);
    } finally {
      setCalculatingDistance(false);
    }
  }, [getWarehouseCoords]);

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

  // Delivery fee calculation
  const totalItems = currentOrder.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
  const deliveryFee = useMemo(() => {
    if (!forDelivery || !distanceKm) return 0;
    const distance = parseFloat(distanceKm) || 0;
    const baseKm = parseFloat(bizSettings?.shipping_base_km) || 1;
    const ratePerSack = parseFloat(bizSettings?.shipping_rate_per_sack) || 0;
    const ratePerKm = parseFloat(bizSettings?.shipping_rate_per_km) || 0;
    const sackBasedFee = Math.ceil(distance / baseKm) * ratePerSack * totalItems;
    const kmBasedFee = ratePerKm * distance;
    return sackBasedFee + kmBasedFee;
  }, [forDelivery, distanceKm, totalItems, bizSettings?.shipping_base_km, bizSettings?.shipping_rate_per_sack, bizSettings?.shipping_rate_per_km]);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [gcashReference, setGcashReference] = useState('');
  const [gcashRefError, setGcashRefError] = useState('');
  const gcashRefCheckTimeout = useRef(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentProofFiles, setPaymentProofFiles] = useState([]);
  const [paymentProofPreviews, setPaymentProofPreviews] = useState([]);
  const [paymentProofError, setPaymentProofError] = useState('');
  const [payShowCamera, setPayShowCamera] = useState(false);
  const proofFileRef = useRef(null);
  const payVideoRef = useRef(null);
  const payStreamRef = useRef(null);

  const clearOrder = () => setCurrentOrder([]);

  const handleProofFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPaymentProofFiles(prev => [...prev, ...files]);
    setPaymentProofPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removeProofFile = (idx) => {
    setPaymentProofFiles(prev => prev.filter((_, i) => i !== idx));
    setPaymentProofPreviews(prev => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const stopPaymentCamera = useCallback(() => {
    if (payStreamRef.current) {
      payStreamRef.current.getTracks().forEach(t => t.stop());
      payStreamRef.current = null;
    }
    setPayShowCamera(false);
  }, []);

  const startPaymentCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      payStreamRef.current = stream;
      setPayShowCamera(true);
      setTimeout(() => { if (payVideoRef.current) payVideoRef.current.srcObject = stream; }, 100);
    } catch {
      toast.error('Camera Error', 'Could not access camera.');
    }
  }, [toast]);

  const capturePaymentPhoto = useCallback(() => {
    if (!payVideoRef.current) return;
    const video = payVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `pay_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPaymentProofFiles(prev => [...prev, file]);
      setPaymentProofPreviews(prev => [...prev, URL.createObjectURL(blob)]);
      stopPaymentCamera();
    }, 'image/jpeg', 0.85);
  }, [stopPaymentCamera]);
  const orderSubtotal = currentOrder.reduce((sum, item) => sum + item.price * (parseInt(item.quantity) || 0), 0);
  const orderTotal = orderSubtotal + deliveryFee;

  const handlePlaceOrder = () => {
    if (currentOrder.length === 0) return;
    if (forDelivery && !deliveryAddress.trim()) {
      toast.error('Please enter a delivery address.');
      return;
    }
    if (forDelivery && !selectedCoords) {
      toast.error('Address not found', 'Please select a valid Philippine address from the suggestions or enter a recognizable address.');
      setAddressError('Address not found in the Philippines. Please enter a valid PH address.');
      return;
    }
    setGcashReference('');
    setGcashRefError('');
    setPaymentProofFiles([]);
    setPaymentProofPreviews([]);
    setPaymentProofError('');
    setPayShowCamera(false);
    setShowPaymentModal(true);
  };

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
      } catch { /* silent */ }
    }, 500);
  }, []);

  const confirmPayment = async () => {
    if (paymentMethod === 'gcash') {
      if (!gcashReference.trim() || gcashReference.replace(/\s/g, '').length !== 13 || gcashRefError) return;
      if (paymentProofFiles.length === 0) {
        setPaymentProofError('Payment proof is required.');
        return;
      }
    }
    setPaymentProofError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      currentOrder.forEach((item, idx) => {
        formData.append(`items[${idx}][product_id]`, item.id);
        formData.append(`items[${idx}][quantity]`, parseInt(item.quantity) || 1);
        formData.append(`items[${idx}][unit_price]`, item.price);
      });
      formData.append('payment_method', paymentMethod);
      formData.append('amount_tendered', paymentMethod === 'pay_later' ? 0 : orderTotal);
      if (paymentMethod === 'gcash') {
        formData.append('reference_number', gcashReference);
        paymentProofFiles.forEach(file => formData.append('payment_proof[]', file));
      }
      if (forDelivery) {
        formData.append('delivery_fee', deliveryFee);
        if (distanceKm) formData.append('distance_km', parseFloat(distanceKm));
        formData.append('delivery_address', deliveryAddress);
      }

      const response = await apiClient.post('/sales/order', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const method = paymentMethods.find(m => m.value === paymentMethod);
      setLastOrder({
        items: [...currentOrder],
        total: orderTotal,
        itemCount: currentOrder.length,
        paymentMethod: method?.label || 'N/A',
        saleId: response.data?.sale_id,
        orderId: response.data?.transaction_id ?? `ORD-${Date.now()}`,
        gcashReference: paymentMethod === 'gcash' ? gcashReference : null,
        isPayLater: paymentMethod === 'pay_later',
        isDelivery: forDelivery,
        deliveryAddress: forDelivery ? deliveryAddress : null,
        deliveryFee: forDelivery ? deliveryFee : 0,
      });
      stopPaymentCamera();
      setShowPaymentModal(false);
      setShowOrderModal(true);
      clearOrder();
      setMobileOrderOpen(false);
      setForDelivery(false);
      setDeliveryAddress('');
      setDistanceKm('');
      setSelectedCoords(null);
      setEstimatedDuration(null);
      setPaymentProofFiles([]);
      setPaymentProofPreviews([]);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to place order. Please try again.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Render a product card inline — click to add (like admin POS)
  const renderProductCard = (product) => {
    return (
      <div key={product.id}
        onClick={() => addToOrder(product)}
        className={`bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-sm overflow-hidden transition-all ${
          product.inStock
            ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]'
            : 'opacity-60 cursor-not-allowed'
        }`}>
        <div className="relative">
          <img src={product.image || bizSettings?.business_logo || DEFAULT_LOGO} alt={product.name} className="w-full h-32 object-cover" />
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-medium rounded-full text-white"
            style={{ backgroundColor: product.varietyColor }}>{product.variety}</span>
        </div>
        <div className="p-2.5 text-center">
          <h4 className="font-semibold text-xs mb-1 line-clamp-1" style={{ color: 'var(--color-text-primary)' }}>{product.name}</h4>
          <p className="font-bold text-sm" style={{ color: 'var(--color-button-500)' }}>{PESO}{product.price.toLocaleString()}
            <span className="text-[10px] font-normal ml-0.5" style={{ color: 'var(--color-text-secondary)' }}>/ {product.unit}</span>
          </p>
        </div>
      </div>
    );
  };

  // Render product list item inline — click to add (like admin POS)
  const renderProductListItem = (product) => {
    return (
      <div key={product.id}
        onClick={() => addToOrder(product)}
        className={`bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-sm p-3 flex gap-3 transition-all ${
          product.inStock ? 'cursor-pointer hover:shadow-lg hover:scale-[1.01]' : 'opacity-60 cursor-not-allowed'
        }`}>
        <img src={product.image || bizSettings?.business_logo || DEFAULT_LOGO} alt={product.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{product.name}</h3>
                <span className="px-1.5 py-0.5 text-[9px] font-medium rounded-full text-white flex-shrink-0" style={{ backgroundColor: product.varietyColor }}>{product.variety}</span>
              </div>
              {!product.inStock && (
                <p className="text-[10px] mt-0.5 text-amber-500 font-medium">Out of Stock</p>
              )}
            </div>
            <span className="text-base font-bold flex-shrink-0" style={{ color: 'var(--color-button-500)' }}>{PESO}{product.price.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  // Order Panel (POS-style matching admin design)
  const renderOrderPanel = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden flex flex-col h-full border-2 border-primary-400 dark:border-primary-700">
      {/* Gradient Header - matching admin POS */}
      <div className="p-4 text-white shrink-0" style={{ background: `linear-gradient(to right, ${theme.button_primary}, ${theme.button_primary}dd)` }}>
        <h3 className="font-bold text-base flex items-center gap-2">
          <ShoppingCart size={18} />
          Current Order
          {currentOrder.length > 0 && (
            <span className="ml-auto bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
              {currentOrder.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0)} items
            </span>
          )}
        </h3>
      </div>

      <div className="flex-1 flex flex-col min-h-0 p-3">
        {/* Cart Items - scrollable */}
        <div className="flex-1 overflow-y-auto min-h-[120px] mb-4">
          {currentOrder.length === 0 ? (
            <div className="text-center py-8 flex flex-col items-center justify-center h-full">
              <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--color-text-secondary)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Cart is empty</p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Add products to start your order</p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentOrder.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-button-500/5">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs truncate" style={{ color: 'var(--color-text-primary)' }}>{item.name}</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-button-500)' }}>₱{item.price.toLocaleString()} × {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateOrderItemQty(item.id, Math.max(1, (parseInt(item.quantity) || 1) - 1))}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700">
                      <Minus size={12} style={{ color: 'var(--color-text-primary)' }} />
                    </button>
                    <span className="w-6 text-center text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>{item.quantity}</span>
                    <button onClick={() => updateOrderItemQty(item.id, Math.min((parseInt(item.quantity) || 1) + 1, item.stocks))}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700">
                      <Plus size={12} style={{ color: 'var(--color-text-primary)' }} />
                    </button>
                    <button onClick={() => removeFromOrder(item.id)}
                      className="p-1 rounded ml-1 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-700">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Type: Pickup / Delivery */}
        <div className="mb-4 shrink-0 border-t-2 border-gray-200 dark:border-gray-700 pt-3">
          <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>Order Type</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={() => { setForDelivery(false); setDeliveryAddress(''); setDistanceKm(''); setSelectedCoords(null); setEstimatedDuration(null); setAddressSuggestions([]); setAddressError(''); }}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-lg transition-all font-semibold text-xs ${forDelivery ? 'border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400' : ''}`}
              style={!forDelivery
                ? { backgroundColor: '#10b98115', border: '2px solid #10b981', color: '#10b981' }
                : undefined
              }>
              <Package size={14} />
              Pick Up
            </button>
            <button onClick={() => { setForDelivery(true); if (!deliveryAddress && user?.address) { setDeliveryAddress(user.address); autoCalcDistance(user.address); } }}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-lg transition-all font-semibold text-xs ${!forDelivery ? 'border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400' : ''}`}
              style={forDelivery
                ? { backgroundColor: '#f9731615', border: '2px solid #f97316', color: '#f97316' }
                : undefined
              }>
              <Truck size={14} />
              Delivery
            </button>
          </div>
          {forDelivery && (
            <div className="mt-3 space-y-2">
              {/* Address Input */}
              <div className="relative">
                <MapPin size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-orange-400" />
                <input
                  ref={addressInputRef}
                  type="text"
                  placeholder="Enter delivery address..."
                  value={deliveryAddress}
                  onChange={(e) => handleAddressInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 border-2 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 dark:text-gray-100"
                  style={{ color: 'var(--color-text-primary)' }}
                />
                {/* Address Suggestions Dropdown */}
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div ref={suggestionsRef} className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700">
                    {addressSuggestions.map((s, i) => (
                      <button key={i} onClick={() => handleSelectAddress(s)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                        style={{ color: 'var(--color-text-primary)', borderBottom: i < addressSuggestions.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <MapPin size={10} className="inline mr-1 text-orange-400" />
                        <span className="line-clamp-1">{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Address Error */}
              {addressError && !calculatingDistance && (
                <p className="text-[10px] text-red-500 font-medium mt-1">{addressError}</p>
              )}

              {/* Distance & Duration Info */}
              {(distanceKm || calculatingDistance) && (
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
              )}
            </div>
          )}
        </div>

        {/* Payment Method - always visible */}
        <div className="mb-4 shrink-0 border-t-2 border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>Payment Method</p>
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map(method => {
              const Icon = method.icon;
              const isSelected = paymentMethod === method.value;
              return (
                <button key={method.value} onClick={() => setPaymentMethod(method.value)}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg transition-all font-semibold text-xs ${!isSelected ? 'border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400' : ''}`}
                  style={isSelected
                    ? { backgroundColor: `${method.color}15`, border: `2px solid ${method.color}`, color: method.color }
                    : undefined
                  }>
                  <Icon size={16} />
                  {method.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Total Section - always visible */}
        <div className="shrink-0 border-t-2 border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>₱{orderSubtotal.toLocaleString()}</span>
          </div>
          {forDelivery && deliveryFee > 0 && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-orange-500 font-medium flex items-center gap-1">
                <Truck size={10} /> Shipping Fee
              </span>
              <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">₱{deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-gray-200 dark:border-gray-700">
            <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>Total</span>
            <span className="text-xl font-bold" style={{ color: 'var(--color-button-500)' }}>₱{orderTotal.toLocaleString()}</span>
          </div>

          {/* Proceed to Payment only (no void transaction for customer) */}
          <button onClick={handlePlaceOrder}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-button-500)' }}
            disabled={currentOrder.length === 0 || calculatingDistance}>
            <Receipt size={16} /> Proceed to Payment
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* Top bar: Header + Filters (fixed, no scroll) */}
      <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Products</h1>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Browse our selection of premium quality rice products</p>
          </div>
          <p className="text-xs hidden sm:block" style={{ color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>{filteredProducts.length}</strong> product(s)
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border-2 border-primary-300 dark:border-primary-700">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
              <input type="text" placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg focus:outline-none transition-all border-2 border-primary-300 dark:border-primary-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 bg-white dark:bg-gray-700 dark:text-gray-100"
                style={{ color: 'var(--color-text-primary)' }}
                />
            </div>
            <div className="flex items-center gap-2">
              <select value={selectedVariety} onChange={(e) => setSelectedVariety(e.target.value)}
                className="px-2.5 py-2 text-sm rounded-lg focus:outline-none appearance-none bg-white dark:bg-gray-700 dark:text-gray-100 pr-7 cursor-pointer border-2 border-primary-300 dark:border-primary-700"
                style={{ color: 'var(--color-text-primary)' }}>
                {varieties.map(v => <option key={v} value={v}>{v === 'All' ? 'All Varieties' : v}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="px-2.5 py-2 text-sm rounded-lg focus:outline-none appearance-none bg-white dark:bg-gray-700 dark:text-gray-100 pr-7 cursor-pointer border-2 border-primary-300 dark:border-primary-700"
                style={{ color: 'var(--color-text-primary)' }}>
                {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <div className="flex rounded-lg overflow-hidden border-2 border-primary-300 dark:border-primary-700">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-button-500 text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  <Grid size={14} />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-button-500 text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main: Products (scrollable) + Order Panel (fixed) */}
      <div className="flex-1 flex gap-4 px-4 sm:px-6 lg:px-8 pb-1 min-h-0">
        {/* Products - scrollable */}
        <div className="flex-1 min-w-0 overflow-y-auto pr-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <Skeleton variant="image" className="h-40 w-full rounded-none" />
                  <div className="p-3 space-y-2">
                    <Skeleton variant="title" width="w-3/4" />
                    <Skeleton variant="text" width="w-1/2" />
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, j) => <Skeleton key={j} variant="circle" width="w-3" height="h-3" />)}
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <Skeleton variant="title" width="w-16" />
                      <Skeleton variant="button" width="w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <Package size={48} className="mx-auto mb-4" style={{ color: 'var(--color-text-secondary)' }} />
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>No products found</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Try adjusting your search or filters</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map(product => renderProductCard(product))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredProducts.map(product => renderProductListItem(product))}
            </div>
          )}
        </div>

        {/* Order Panel (desktop/tablet) - fixed, fills height */}
        <div className="hidden md:flex md:flex-col w-80 xl:w-96 shrink-0">
          {renderOrderPanel()}
        </div>
      </div>

      {/* Mobile Order Floating Bar (below md) */}
      <div className="md:hidden">
        {currentOrder.length > 0 && (
          <>
            {mobileOrderOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOrderOpen(false)} />}
            <div className="fixed bottom-16 left-0 right-0 z-50">
              {mobileOrderOpen && (
                <div className="bg-white dark:bg-gray-800 max-h-[65vh] overflow-y-auto rounded-t-2xl shadow-2xl">
                  {renderOrderPanel()}
                </div>
              )}
              <button onClick={() => setMobileOrderOpen(!mobileOrderOpen)}
                className="w-full flex items-center justify-between px-5 py-3 text-white"
                style={{ backgroundColor: 'var(--color-button-500)' }}>
                <span className="font-medium text-sm">{currentOrder.length} item(s) · ₱{orderTotal.toLocaleString()}</span>
                <span className="flex items-center gap-1 text-sm font-medium">
                  {mobileOrderOpen ? 'Close' : 'View Order'} {mobileOrderOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => { stopPaymentCamera(); setShowPaymentModal(false); }} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full overflow-hidden border-2 border-primary-200 dark:border-primary-700 ${paymentMethod === 'gcash' && (bizSettings.gcash_qr || bizSettings.gcash_name || bizSettings.gcash_number) ? 'max-w-3xl' : 'max-w-md'}`}>
              {/* Header */}
              <div className={`p-5 text-white shrink-0 ${paymentMethod === 'gcash' ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-purple-500 to-purple-600'}`}>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  {paymentMethod === 'gcash' ? <Smartphone size={20} /> : <Clock size={20} />}
                  {paymentMethod === 'gcash' ? 'GCash Payment' : 'Pay Later'}
                </h3>
                <p className="text-sm text-white/80 mt-1">
                  {paymentMethod === 'gcash' ? 'Enter GCash reference number' : 'Order will be placed with payment pending'}
                </p>
              </div>

              <div className={`${paymentMethod === 'gcash' && (bizSettings.gcash_qr || bizSettings.gcash_name || bizSettings.gcash_number) ? 'flex' : ''}`}>
              {/* Left side: form content */}
              <div className="flex-1 min-w-0">
              <div className="p-5 space-y-4">
                {/* Order Summary */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500 dark:text-gray-400">Items</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{currentOrder.length} items</span>
                  </div>
                  {forDelivery && deliveryFee > 0 && (
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-orange-500 flex items-center gap-1"><Truck size={12} /> Shipping Fee</span>
                      <span className="font-medium text-orange-600">₱{deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                    <span className="font-bold text-gray-800 dark:text-gray-100">Total Due</span>
                    <span className="text-xl font-bold text-primary-600 dark:text-primary-400">₱{orderTotal.toLocaleString()}</span>
                  </div>
                </div>

                {paymentMethod === 'gcash' ? (
                  <>
                    {/* GCash Reference */}
                    <div>
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

                    {/* Payment Proof */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">
                        Payment Proof <span className="text-red-500">*</span>
                      </label>

                      {payShowCamera && (
                        <div className="relative mb-3 rounded-lg overflow-hidden border-2 border-blue-300 dark:border-blue-700">
                          <video ref={payVideoRef} autoPlay playsInline className="w-full h-48 object-cover bg-black" />
                          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-3">
                            <button onClick={capturePaymentPhoto} className="px-4 py-2 bg-blue-500 text-white text-xs font-bold rounded-full shadow-lg hover:bg-blue-600 flex items-center gap-1.5">
                              <Camera size={14} /> Capture
                            </button>
                            <button onClick={stopPaymentCamera} className="px-4 py-2 bg-gray-600 text-white text-xs font-bold rounded-full shadow-lg hover:bg-gray-700 flex items-center gap-1.5">
                              <X size={14} /> Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {paymentProofPreviews.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {paymentProofPreviews.map((src, i) => (
                            <div key={i} className="relative group">
                              <img src={src} alt={`Proof ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border-2 border-blue-200 dark:border-blue-700" />
                              <button onClick={() => removeProofFile(i)} className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {!payShowCamera && (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => proofFileRef.current?.click()} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-xs font-semibold transition-all ${
                            paymentProofFiles.length === 0
                              ? 'border-red-300 dark:border-red-600 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400'
                              : 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400'
                          }`}>
                            <ImageIcon size={14} /> Upload Image
                          </button>
                          <button type="button" onClick={startPaymentCamera} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-xs font-semibold transition-all ${
                            paymentProofFiles.length === 0
                              ? 'border-red-300 dark:border-red-600 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400'
                              : 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400'
                          }`}>
                            <Camera size={14} /> Open Camera
                          </button>
                          <input ref={proofFileRef} type="file" accept="image/*" multiple onChange={handleProofFileChange} className="hidden" />
                        </div>
                      )}
                      {paymentProofFiles.length === 0 && (
                        <p className="mt-1 text-xs text-red-500">Payment proof is required.</p>
                      )}
                    </div>

                    {/* GCash Info */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-3">
                      <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1 uppercase tracking-wide">Payment Verification</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">Enter the exact 13-digit GCash reference number and upload a screenshot or capture the payment confirmation as proof.</p>
                    </div>
                  </>
                ) : (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-lg p-4 text-center">
                    <Clock size={32} className="mx-auto mb-2 text-purple-500" />
                    <p className="text-sm font-bold text-purple-700 dark:text-purple-300 mb-1">Pay Later</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">The order will be placed with payment pending. You can pay via GCash when you're ready, or visit the store for cash payment.</p>
                  </div>
                )}
              </div>
              </div>{/* end left-side flex-1 */}

              {/* Right side: GCash QR Code & Info Panel */}
              {paymentMethod === 'gcash' && (bizSettings.gcash_qr || bizSettings.gcash_name || bizSettings.gcash_number) && (
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
                  onClick={() => { stopPaymentCamera(); setShowPaymentModal(false); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-1"
                >
                  ← Cancel
                </button>
                <button
                  onClick={confirmPayment}
                  disabled={submitting || (paymentMethod === 'gcash' ? (!gcashReference.trim() || gcashReference.replace(/\s/g, '').length !== 13 || !!gcashRefError || paymentProofFiles.length === 0) : false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all ${paymentMethod === 'gcash' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-purple-500 hover:bg-purple-600'}`}
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
                  {submitting ? 'Processing...' : 'Place Order'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Order Placed Success Modal */}
      {showOrderModal && lastOrder && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowOrderModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border-2 border-primary-300 dark:border-primary-700">
              {/* Success Header */}
              <div className="p-6 text-white text-center"
                style={{ background: `linear-gradient(135deg, var(--color-button-500), var(--color-primary-500))` }}>
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold">Order Placed!</h3>
                <p className="text-sm text-white/80 mt-1">{lastOrder.orderId}</p>
              </div>

              {/* Order Details */}
              <div className="p-5">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Items</span>
                    <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{lastOrder.itemCount} item(s)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Payment</span>
                    <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{lastOrder.paymentMethod}</span>
                  </div>
                  {lastOrder.gcashReference && (
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--color-text-secondary)' }}>GCash Ref</span>
                      <span className="font-medium tracking-wide" style={{ color: 'var(--color-text-primary)' }}>{lastOrder.gcashReference}</span>
                    </div>
                  )}
                  {lastOrder.isDelivery && (
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Type</span>
                      <span className="font-medium text-orange-500 flex items-center gap-1"><Truck size={12} /> Delivery</span>
                    </div>
                  )}
                  {lastOrder.isDelivery && lastOrder.deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Shipping Fee</span>
                      <span className="font-medium text-orange-600">₱{lastOrder.deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t-2 border-primary-200/20 dark:border-primary-700/20">
                    <div className="flex justify-between">
                      <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>Total</span>
                      <span className="text-xl font-bold" style={{ color: 'var(--color-button-500)' }}>₱{lastOrder.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="rounded-lg p-3 mb-4 max-h-32 overflow-y-auto bg-primary-50/50 dark:bg-primary-900/10">
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Items Ordered</p>
                  {lastOrder.items.map(item => (
                    <div key={item.id} className="flex justify-between text-xs py-0.5">
                      <span style={{ color: 'var(--color-text-secondary)' }}>{item.name} ×{item.quantity}</span>
                      <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>₱{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setShowOrderModal(false);
                  }}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-all"
                  style={{ backgroundColor: 'var(--color-button-500)' }}
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

export default Shop;
