import { useState, useEffect, useMemo } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, X, Phone, Mail, MapPin, Facebook, Instagram, Twitter, 
  ChevronUp, ShoppingCart, Package, User, LogOut, Home, 
  ClipboardList, Bell, ChevronDown, LayoutDashboard, Settings
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { DEFAULT_LOGO } from '../../api/config';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../components/common/NotificationBell';
import { Footer } from '../../components/common';
import { ConfirmModal } from '../../components/ui';

// Mobile Bottom Navigation (matches admin pattern)
const CustomerBottomNav = ({ cartCount }) => {
  const location = useLocation();
  const { theme } = useTheme();

  const navItems = [
    { to: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/customer/products', label: 'Products', icon: Package },
    { to: '/customer/orders', label: 'Orders', icon: ClipboardList },
    { to: '/customer/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-primary-200 dark:border-primary-700"
      style={{ backgroundColor: 'var(--color-bg-sidebar)' }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className="flex flex-col items-center justify-center min-w-[64px] px-3 py-1.5 rounded-xl transition-all duration-200 relative"
              style={isActive ? { 
                backgroundColor: theme.button_primary, 
                color: '#fff',
                boxShadow: `0 4px 12px ${theme.button_primary}40`
              } : { 
                color: theme.text_secondary 
              }}
            >
              <div className="relative">
                <item.icon size={20} />
                {item.badge > 0 && (
                  <span 
                    className="absolute -top-1.5 -right-2 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                    style={{ backgroundColor: isActive ? '#fff' : theme.button_primary, color: isActive ? theme.button_primary : '#fff' }}
                  >
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

// Customer Header/Navbar
const CustomerHeader = ({ customer, cartCount, handleLogout }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { settings } = useBusinessSettings();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);
  }, [location.pathname]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest('.profile-dropdown')) setIsProfileOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const navLinks = [
    { to: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/customer/products', label: 'Products', icon: Package },
    { to: '/customer/orders', label: 'My Orders', icon: ClipboardList },
    { to: '/customer/settings', label: 'Settings', icon: Settings },
  ];

  const businessName = settings?.business_name || 'KJP Ricemill';

  return (
    <>
    <header 
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 shadow-sm border-b-2 border-primary-300 dark:border-primary-700"
      style={{ backgroundColor: 'var(--color-bg-sidebar)', color: 'var(--color-text-sidebar)' }}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side: Hamburger (tablet only) + Logo */}
          <div className="flex items-center gap-3">
            {/* Hamburger - only on tablet (md to lg), matching admin */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="hidden md:block lg:hidden p-2 rounded-lg hover:bg-button-50 dark:hover:bg-button-500/40 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} style={{ color: 'var(--color-text-sidebar)' }} /> : <Menu size={24} style={{ color: 'var(--color-text-sidebar)' }} />}
            </button>

            {/* Logo */}
            <Link to="/customer" className="flex items-center gap-3 group">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${theme.button_primary}, ${theme.button_primary}dd)` }}
              >
                <img 
                  src={settings.business_logo || DEFAULT_LOGO} 
                  alt={businessName} 
                  className="w-8 h-8 object-contain"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
                <span style={{display:'none'}} className="text-white font-bold text-lg items-center justify-center">{(businessName || 'K').substring(0, 1)}</span>
              </div>
              <div>
                <h1 className="font-bold text-sm sm:text-lg leading-tight text-gray-800 dark:text-gray-100">
                  {businessName}
                </h1>
                <p className="text-[10px] sm:text-xs font-medium hidden sm:block text-gray-500 dark:text-gray-400">
                  Customer Portal
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation (lg+) */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 relative
                  ${isActive 
                    ? 'bg-gradient-to-r from-button-500 to-button-400 text-white shadow-md shadow-button-500/25' 
                    : 'text-gray-700 dark:text-gray-200 hover:bg-button-500/10 dark:hover:bg-button-500/30 hover:text-button-600 dark:hover:text-button-300'
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <link.icon size={16} />
                    {link.label}
                    {isActive && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right side - Notifications + Profile */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            {/* Profile Dropdown */}
            <div className="relative profile-dropdown">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsProfileOpen(!isProfileOpen);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold bg-gradient-to-br from-button-500 to-button-600"
                >
                  {customer.name.charAt(0)}
                </div>
                <span className="hidden sm:block text-sm font-medium" style={{ color: 'var(--color-text-sidebar)' }}>
                  {customer.name.split(' ')[0]}
                </span>
                <ChevronDown size={14} className={`hidden sm:block transition-transform text-gray-500 dark:text-gray-400 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-xl border border-primary-300 dark:border-primary-700 py-2 z-50" style={{ backgroundColor: 'var(--color-bg-sidebar)' }}>
                  <div className="px-4 py-3 border-b border-primary-200 dark:border-primary-700">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-sidebar)' }}>{customer.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{customer.email}</p>
                  </div>
                  <Link
                    to="/customer/orders"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-button-50 dark:hover:bg-button-500/40 transition-colors"
                    style={{ color: 'var(--color-text-sidebar)' }}
                  >
                    <ClipboardList size={16} />
                    Order History
                  </Link>
                  <div className="border-t my-1 border-primary-200 dark:border-primary-700" />
                  <button
                    onClick={() => { setIsProfileOpen(false); setIsLogoutModalOpen(true); }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tablet Menu Overlay (md to lg) */}
      <div className={`hidden md:block lg:hidden transition-all duration-300 overflow-hidden ${
        isMobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="border-t border-primary-200 dark:border-primary-700 shadow-lg" style={{ backgroundColor: 'var(--color-bg-sidebar)' }}>
          <nav className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200
                  ${isActive ? 'bg-gradient-to-r from-button-500 to-button-400 text-white shadow-md' : 'text-gray-700 dark:text-gray-200 hover:bg-button-500/10 dark:hover:bg-button-500/30 hover:text-button-600 dark:hover:text-button-300'}
                `}
              >
                <link.icon size={18} />
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>

    <ConfirmModal
      isOpen={isLogoutModalOpen}
      onClose={() => setIsLogoutModalOpen(false)}
      onConfirm={async () => { setIsLogoutModalOpen(false); await handleLogout(); }}
      title="Confirm Logout"
      message="Are you sure you want to logout? You will need to login again to access the system."
      confirmText="Logout"
      cancelText="Cancel"
      variant="danger"
      icon={LogOut}
    />
    </>
  );
};

// Main Customer Layout
const CustomerLayout = () => {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [cartCount] = useState(0);

  const customer = {
    id: user?.id || 0,
    name: user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.name || 'Customer',
    email: user?.email || '',
  };

  const handleLogout = async () => {
    await logout();
    navigate('/?login=true');
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col" style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-content)' }}>
      <CustomerHeader customer={customer} cartCount={cartCount} handleLogout={handleLogout} />
      <main className="flex-1 pt-16 pb-20 md:pb-0">
        <Outlet />
      </main>
      <div className="hidden md:block px-4 pb-4">
        <Footer />
      </div>
      <CustomerBottomNav cartCount={cartCount} />
    </div>
  );
};

export default CustomerLayout;
