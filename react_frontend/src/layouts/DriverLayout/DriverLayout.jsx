import { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, X, Phone, Mail, 
  ChevronDown, LogOut, Home, 
  Truck, ClipboardList, User, Settings, LayoutDashboard, MapPin
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { DEFAULT_LOGO } from '../../api/config';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../components/common/NotificationBell';
import { Footer } from '../../components/common';
import { ConfirmModal } from '../../components/ui';

// Mobile Bottom Navigation
const DriverBottomNav = () => {
  const location = useLocation();
  const { theme } = useTheme();

  const navItems = [
    { to: '/driver', label: 'Home', icon: LayoutDashboard, exact: true },
    { to: '/driver/deliveries', label: 'Deliveries', icon: Truck },
    { to: '/driver/profile', label: 'Profile', icon: User },
    { to: '/driver/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t-2 border-primary-300 dark:border-primary-700"
      style={{ backgroundColor: 'var(--color-bg-content)' }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = item.exact 
            ? location.pathname === item.to || location.pathname === '/driver/dashboard'
            : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={`flex flex-col items-center justify-center min-w-[64px] px-3 py-1.5 rounded-xl transition-all duration-200 relative ${
                isActive 
                  ? 'bg-gradient-to-t from-button-500 to-button-400 text-white shadow-lg shadow-button-500/25' 
                  : 'text-gray-500 dark:text-gray-400 active:bg-primary-100 dark:active:bg-primary-900/30'
              }`}
            >
              <item.icon size={20} />
              <span className="text-[10px] mt-0.5 font-medium">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

// Driver Header/Navbar
const DriverHeader = ({ driver, onLogout }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { settings } = useBusinessSettings();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest('.profile-dropdown')) setIsProfileOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const navLinks = [
    { to: '/driver', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/driver/deliveries', label: 'My Deliveries', icon: Truck },
    { to: '/driver/profile', label: 'Profile', icon: User },
    { to: '/driver/settings', label: 'Settings', icon: Settings },
  ];

  const businessName = settings?.business_name || 'KJP Ricemill';

  return (
    <>
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'shadow-lg border-b-2 border-primary-300 dark:border-primary-700' : 'shadow-sm border-b-2 border-primary-300 dark:border-primary-700'
      }`}
      style={{ backgroundColor: 'var(--color-bg-content)' }}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Hamburger (tablet) + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="hidden md:block lg:hidden p-2 rounded-lg transition-colors"
              style={{ ':hover': { opacity: 0.8 } }}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} className="text-gray-800 dark:text-gray-100" /> : <Menu size={24} className="text-gray-800 dark:text-gray-100" />}
            </button>

            <Link to="/driver" className="flex items-center gap-3 group">
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
                  Driver Portal
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation (lg+) */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = link.exact 
                ? location.pathname === link.to || location.pathname === '/driver/dashboard'
                : location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
                    ${isActive 
                      ? 'bg-gradient-to-r from-button-500 to-button-400 text-white shadow-md shadow-button-500/25' 
                      : 'text-gray-700 dark:text-gray-200 hover:bg-button-500/10 dark:hover:bg-button-500/30 hover:text-button-600 dark:hover:text-button-300'
                    }
                  `}
                >
                  <link.icon size={16} />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side - Notifications + Profile */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="relative profile-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setIsProfileOpen(!isProfileOpen); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                  style={{ backgroundColor: theme.button_primary }}
                >
                  {driver.name.charAt(0)}
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-800 dark:text-gray-100">
                  {driver.name.split(' ')[0]}
                </span>
                <ChevronDown size={14} className={`hidden sm:block transition-transform text-gray-400 dark:text-gray-500 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-xl border border-primary-300 dark:border-primary-700 py-2 z-50" style={{ backgroundColor: 'var(--color-bg-content)' }}>
                  <div className="px-4 py-3 border-b border-primary-300 dark:border-primary-700">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{driver.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{driver.email}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Truck size={11} className="text-gray-400 dark:text-gray-500" />
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{driver.vehicle_type} · {driver.plate_number}</p>
                    </div>
                  </div>
                  <Link
                    to="/driver/deliveries"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-gray-800 dark:text-gray-100"
                  >
                    <ClipboardList size={16} />
                    My Deliveries
                  </Link>
                  <div className="border-t border-primary-300 dark:border-primary-700 my-1" />
                  <button
                    onClick={() => { setIsProfileOpen(false); setIsLogoutModalOpen(true); }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
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
        <div className="border-t-2 border-primary-300 dark:border-primary-700 shadow-lg" style={{ backgroundColor: 'var(--color-bg-content)' }}>
          <nav className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const isActive = link.exact 
                ? location.pathname === link.to || location.pathname === '/driver/dashboard'
                : location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200
                    ${isActive 
                      ? 'bg-gradient-to-r from-button-500 to-button-400 text-white shadow-md shadow-button-500/25' 
                      : 'text-gray-700 dark:text-gray-200 hover:bg-button-500/10 dark:hover:bg-button-500/30 hover:text-button-600 dark:hover:text-button-300'
                    }
                  `}
                >
                  <link.icon size={18} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>

    <ConfirmModal
      isOpen={isLogoutModalOpen}
      onClose={() => setIsLogoutModalOpen(false)}
      onConfirm={() => { setIsLogoutModalOpen(false); if (onLogout) onLogout(); navigate('/'); }}
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

// Main Driver Layout
const DriverLayout = () => {
  const { user, logout } = useAuth();
  
  const driver = {
    id: user?.id || 0,
    name: user?.name || 'Driver',
    email: user?.email || '',
    phone: user?.phone || '',
    vehicle_type: '',
    plate_number: user?.truck_plate_number || '',
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-body)' }}>
      <DriverHeader driver={driver} onLogout={logout} />
      <main className="flex-1 pt-16 pb-20 md:pb-0">
        <Outlet />
      </main>
      <div className="hidden md:block px-4 pb-4">
        <Footer />
      </div>
      <DriverBottomNav />
    </div>
  );
};

export default DriverLayout;
