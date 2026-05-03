import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingCart, Trash2, Plus, Minus, ArrowLeft, 
  CreditCard, ShoppingBag, Truck, Tag, AlertCircle, Check, CheckCircle
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useToast, Skeleton } from '../../../components/ui';
import { DEFAULT_LOGO } from '../../../api/config';

// Cart items — will connect to real state management
const initialCartItems = [];

const Cart = () => {
  const { theme } = useTheme();
  const toast = useToast();
  const [cartItems, setCartItems] = useState(initialCartItems);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutDetails, setCheckoutDetails] = useState(null);

  const handleSetQuantity = (id, value) => {
    const num = parseInt(value, 10);
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        if (isNaN(num) || num < 1) return { ...item, quantity: '' };
        return { ...item, quantity: Math.min(num, item.stocks) };
      }
      return item;
    }));
  };

  const handleQtyBlur = (id) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id && (!item.quantity || item.quantity < 1)) {
        return { ...item, quantity: 1 };
      }
      return item;
    }));
  };

  const handleUpdateQuantity = (id, delta) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        const current = typeof item.quantity === 'number' ? item.quantity : 1;
        const newQty = Math.max(1, Math.min(item.stocks, current + delta));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleRemove = (id) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cartItems.reduce((sum, item) => {
    const qty = typeof item.quantity === 'number' ? item.quantity : 0;
    return sum + (item.price * qty);
  }, 0);
  const discount = promoApplied ? Math.round(subtotal * 0.05) : 0;
  const deliveryFee = subtotal >= 2000 ? 0 : 100;
  const total = subtotal - discount + deliveryFee;

  const handleApplyPromo = () => {
    if (promoCode.toUpperCase() === 'KJP2026') {
      setPromoApplied(true);
    }
  };

  const handleCheckout = () => {
    setCheckingOut(true);
    setTimeout(() => {
      setCheckingOut(false);
      setCheckoutDetails({
        items: [...cartItems],
        itemCount: cartItems.length,
        subtotal,
        discount,
        deliveryFee,
        total,
        orderId: `ORD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`,
      });
      setShowCheckoutModal(true);
      setCartItems([]);
      setPromoApplied(false);
      setPromoCode('');
    }, 1500);
  };

  if (cartItems.length === 0) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-16 text-center">
        <ShoppingCart size={64} className="mx-auto mb-4" style={{ color: theme.text_secondary }} />
        <h2 className="text-xl font-bold mb-2" style={{ color: theme.text_primary }}>Your cart is empty</h2>
        <p className="text-sm mb-6" style={{ color: theme.text_secondary }}>Add some products to get started</p>
        <Link
          to="/customer/shop"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-all"
          style={{ backgroundColor: theme.button_primary }}
        >
          <ShoppingBag size={16} /> Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: theme.text_primary }}>Shopping Cart</h1>
          <p className="text-sm mt-1" style={{ color: theme.text_secondary }}>
            {cartItems.length} item(s) in your cart
          </p>
        </div>
        <Link
          to="/customer/shop"
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: theme.button_primary }}
        >
          <ArrowLeft size={14} /> Continue Shopping
        </Link>
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 flex gap-4" style={{ border: `1px solid ${theme.border_color}` }}>
                <Skeleton variant="image" className="w-20 h-20 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="title" width="w-40" />
                  <Skeleton variant="text" width="w-20" />
                  <Skeleton variant="text" width="w-24" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Skeleton variant="title" width="w-16" />
                  <Skeleton variant="button" width="w-24" />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5" style={{ border: `1px solid ${theme.border_color}` }}>
            <Skeleton variant="title" width="w-32" className="mb-4" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton variant="text" width="w-20" />
                  <Skeleton variant="text" width="w-16" />
                </div>
              ))}
            </div>
            <Skeleton variant="button" width="w-full" className="mt-4" />
          </div>
        </div>
      ) : (
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map(item => {
            const qty = typeof item.quantity === 'number' ? item.quantity : 0;
            return (
              <div 
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 flex gap-4"
                style={{ border: `1px solid ${theme.border_color}` }}
              >
                <img 
                  src={item.image || DEFAULT_LOGO} 
                  alt={item.name}
                  className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-sm" style={{ color: theme.text_primary }}>{item.name}</h3>
                      <p className="text-xs mt-0.5" style={{ color: theme.text_secondary }}>
                        {item.variety} · {item.unit}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 dark:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="flex items-end justify-between mt-3">
                    {/* Editable Quantity */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium" style={{ color: theme.text_secondary }}>Qty:</label>
                      <div className="flex items-center rounded-lg" style={{ border: `1px solid ${theme.border_color}` }}>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-l-lg transition-colors"
                          disabled={qty <= 1}
                        >
                          <Minus size={14} style={{ color: qty <= 1 ? '#d1d5db' : theme.text_primary }} />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleSetQuantity(item.id, e.target.value)}
                          onBlur={() => handleQtyBlur(item.id)}
                          className="w-16 text-center text-sm font-semibold border-x py-1.5 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          style={{ borderColor: theme.border_color, color: theme.text_primary, backgroundColor: 'transparent' }}
                          min={1}
                          max={item.stocks}
                        />
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-r-lg transition-colors"
                          disabled={qty >= item.stocks}
                        >
                          <Plus size={14} style={{ color: qty >= item.stocks ? '#d1d5db' : theme.text_primary }} />
                        </button>
                      </div>
                      <span className="text-xs" style={{ color: theme.text_secondary }}>
                        / {item.stocks} available
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: theme.text_secondary }}>₱{item.price.toLocaleString()} × {qty}</p>
                      <p className="text-base font-bold" style={{ color: theme.button_primary }}>
                        ₱{(item.price * qty).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sticky top-24" style={{ border: `1px solid ${theme.border_color}` }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: theme.text_primary }}>Order Summary</h2>
            
            {/* Promo Code */}
            <div className="mb-4">
              <label className="text-xs font-medium block mb-1.5" style={{ color: theme.text_secondary }}>Promo Code</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.text_secondary }} />
                  <input
                    type="text"
                    placeholder="Enter code..."
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    disabled={promoApplied}
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-lg focus:outline-none disabled:bg-gray-50 dark:bg-gray-700/50"
                    style={{ border: `2px solid ${promoApplied ? '#22c55e' : theme.border_color}`, color: theme.text_primary }}
                  />
                </div>
                <button
                  onClick={handleApplyPromo}
                  disabled={!promoCode || promoApplied}
                  className="px-3 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                  style={{ 
                    backgroundColor: promoApplied ? '#22c55e' : theme.button_primary,
                    color: '#fff'
                  }}
                >
                  {promoApplied ? <Check size={16} /> : 'Apply'}
                </button>
              </div>
              {promoApplied && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <Check size={12} /> 5% discount applied!
                </p>
              )}
              <p className="text-xs mt-1" style={{ color: theme.text_secondary }}>Try: KJP2026</p>
            </div>

            {/* Summary Lines */}
            <div className="space-y-2 py-4" style={{ borderTop: `1px solid ${theme.border_color}`, borderBottom: `1px solid ${theme.border_color}` }}>
              <div className="flex justify-between text-sm" style={{ color: theme.text_secondary }}>
                <span>Subtotal ({cartItems.reduce((s, i) => s + (typeof i.quantity === 'number' ? i.quantity : 0), 0)} items)</span>
                <span style={{ color: theme.text_primary }}>₱{subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span>Discount (5%)</span>
                  <span>-₱{discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm" style={{ color: theme.text_secondary }}>
                <span>Delivery Fee</span>
                <span style={{ color: deliveryFee === 0 ? '#22c55e' : theme.text_primary }}>
                  {deliveryFee === 0 ? 'Free' : `₱${deliveryFee}`}
                </span>
              </div>
              {deliveryFee > 0 && (
                <p className="text-xs flex items-center gap-1" style={{ color: theme.text_secondary }}>
                  <Truck size={12} /> Free delivery for orders ₱2,000+
                </p>
              )}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center py-4">
              <span className="text-base font-semibold" style={{ color: theme.text_primary }}>Total</span>
              <span className="text-xl font-bold" style={{ color: theme.button_primary }}>₱{total.toLocaleString()}</span>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-70"
              style={{ backgroundColor: theme.button_primary }}
            >
              {checkingOut ? (
                <>Processing...</>
              ) : (
                <><CreditCard size={16} /> Proceed to Checkout</>
              )}
            </button>

            {/* Security Note */}
            <p className="text-xs text-center mt-3 flex items-center justify-center gap-1" style={{ color: theme.text_secondary }}>
              <AlertCircle size={12} /> Secure checkout — your data is protected
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Checkout Success Modal */}
      {showCheckoutModal && checkoutDetails && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowCheckoutModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              style={{ border: `2px solid ${theme.border_color}` }}>
              {/* Success Header */}
              <div className="p-6 text-white text-center"
                style={{ background: `linear-gradient(135deg, ${theme.button_primary}, ${theme.border_color})` }}>
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold">Order Placed!</h3>
                <p className="text-sm text-white/80 mt-1">{checkoutDetails.orderId}</p>
              </div>

              {/* Order Details */}
              <div className="p-5">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: theme.text_secondary }}>Items</span>
                    <span className="font-medium" style={{ color: theme.text_primary }}>{checkoutDetails.itemCount} item(s)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: theme.text_secondary }}>Subtotal</span>
                    <span className="font-medium" style={{ color: theme.text_primary }}>₱{checkoutDetails.subtotal.toLocaleString()}</span>
                  </div>
                  {checkoutDetails.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span style={{ color: theme.text_secondary }}>Discount</span>
                      <span className="font-medium text-green-600 dark:text-green-400">-₱{checkoutDetails.discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span style={{ color: theme.text_secondary }}>Delivery</span>
                    <span className="font-medium" style={{ color: theme.text_primary }}>
                      {checkoutDetails.deliveryFee === 0 ? 'Free' : `₱${checkoutDetails.deliveryFee.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="pt-2 mt-2" style={{ borderTop: `2px solid ${theme.border_color}20` }}>
                    <div className="flex justify-between">
                      <span className="font-bold" style={{ color: theme.text_primary }}>Total</span>
                      <span className="text-xl font-bold" style={{ color: theme.button_primary }}>₱{checkoutDetails.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="rounded-lg p-3 mb-4 max-h-32 overflow-y-auto" style={{ backgroundColor: `${theme.border_color}08` }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: theme.text_secondary }}>Items Ordered</p>
                  {checkoutDetails.items.map(item => (
                    <div key={item.id} className="flex justify-between text-xs py-0.5">
                      <span style={{ color: theme.text_secondary }}>{item.name} ×{item.quantity}</span>
                      <span className="font-medium" style={{ color: theme.text_primary }}>₱{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/customer/orders"
                  className="block w-full py-2.5 rounded-lg text-sm font-semibold text-white text-center hover:opacity-90 transition-all mb-2"
                  style={{ backgroundColor: theme.button_primary }}
                >
                  View My Orders
                </Link>
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{ color: theme.text_secondary, border: `1px solid ${theme.border_color}30` }}
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Cart;
