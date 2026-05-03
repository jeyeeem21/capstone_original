import { useRef, useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Settings2, 
  Package, 
  TrendingUp, 
  Monitor, 
  Users, 
  UserCog, 
  Settings,
  Tag,
  Warehouse,
  Truck,
  UserCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Sun,
  ClipboardList,
  FileBarChart,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { basePath, user } = useAuth();
  const { settings } = useBusinessSettings();
  const scrollRef = useRef(null);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [showSmtpWarning, setShowSmtpWarning] = useState(false);

  // Check SMTP configuration - show warning if SMTP password is empty/not configured
  useEffect(() => {
    // Check both the explicit flag AND the presence of a masked password as fallback
    const isConfigured = settings?.smtp_configured === true
      || (settings?.smtp_password && settings.smtp_password !== '' && settings.smtp_password !== null);
    
    // Show warning if NOT configured (empty smtp_password)
    setShowSmtpWarning(!isConfigured);
  }, [settings]); // Re-check when settings change

  // Auto-expand submenu when on Products or Partners page
  useEffect(() => {
    if (location.pathname.includes('/products')) {
      setExpandedMenu('products');
    } else if (location.pathname.includes('/partners')) {
      setExpandedMenu('partners');
    } else {
      setExpandedMenu(null);
    }
  }, [location.pathname]);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: `${basePath}/dashboard` },
    { icon: ShoppingCart, label: 'Procurement', to: `${basePath}/procurement` },
    { icon: Sun, label: 'Drying', to: `${basePath}/drying` },
    { icon: Settings2, label: 'Processing', to: `${basePath}/processing` },
    { 
      icon: Package, 
      label: 'Products', 
      to: `${basePath}/products`,
      hasSubmenu: true,
      submenuId: 'products',
      submenu: [
        { icon: Tag, label: 'Varieties', to: `${basePath}/products/varieties` },
        { icon: Warehouse, label: 'Inventory', to: `${basePath}/products/inventory` },
      ]
    },
    { icon: Monitor, label: 'POS', to: `${basePath}/pos` },
    { icon: ClipboardList, label: 'Orders', to: `${basePath}/orders` },
    { 
      icon: Users, 
      label: 'Partners', 
      to: `${basePath}/partners`,
      hasSubmenu: true,
      submenuId: 'partners',
      submenu: [
        { icon: Truck, label: 'Supplier', to: `${basePath}/partners/supplier` },
        { icon: UserCheck, label: 'Customer', to: `${basePath}/partners/customer` },
      ]
    },
    { icon: UserCog, label: 'Staff', to: `${basePath}/staff-management` },
    { icon: TrendingUp, label: 'Sales', to: `${basePath}/sales` },
    { icon: FileBarChart, label: 'Reports', to: `${basePath}/reports` },
    { icon: Settings, label: 'Settings', to: `${basePath}/settings`, badge: showSmtpWarning ? 'warning' : null },
  ];

  const handleMenuItemClick = (item) => {
    if (item.hasSubmenu) {
      const isAlreadyOnPage = location.pathname.includes(item.submenuId);
      if (isAlreadyOnPage) {
        // Toggle submenu if already on that page
        setExpandedMenu(prev => prev === item.submenuId ? null : item.submenuId);
      } else {
        // Navigate to the page, useEffect will expand the submenu
        navigate(item.to);
      }
    }
  };

  const toggleSubmenu = () => {
    setExpandedMenu(null);
  };

  return (
    <>
      {/* Expanded Submenu Overlay */}
      {expandedMenu && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleSubmenu}
        />
      )}

      {/* Submenu Panel */}
      {expandedMenu && (
        <div 
          className="fixed bottom-[66px] left-0 right-0 z-50 md:hidden animate-slide-up"
          style={{ backgroundColor: 'var(--color-bg-sidebar)' }}
        >
          <div className="border-t-2 border-primary-300 dark:border-primary-700 py-2 px-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {navItems.find(item => item.submenuId === expandedMenu)?.label}
              </h3>
              <button 
                onClick={toggleSubmenu}
                className="p-1 rounded-lg hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-700"
              >
                <ChevronDown size={18} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {navItems
                .find(item => item.submenuId === expandedMenu)
                ?.submenu.map((subItem) => {
                  const isActive = location.pathname === subItem.to;
                  return (
                    <NavLink
                      key={subItem.to}
                      to={subItem.to}
                      onClick={toggleSubmenu}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200
                        ${isActive 
                          ? 'bg-gradient-to-r from-button-500 to-button-400 text-white shadow-md' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 active:bg-gray-200 dark:bg-gray-600 dark:active:bg-gray-700'
                        }`}
                    >
                      <subItem.icon size={18} />
                      <span className="text-sm font-medium">{subItem.label}</span>
                    </NavLink>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      <nav 
        className="fixed bottom-0 left-0 right-0 border-t-2 border-primary-300 dark:border-primary-700 z-50 md:hidden safe-area-bottom"
        style={{ backgroundColor: 'var(--color-bg-sidebar)' }}
      >
        {/* Scrollable nav items - naturally scrollable with touch */}
        <div 
          ref={scrollRef}
          className="flex items-center overflow-x-scroll scrollbar-hide px-2 py-2 gap-1"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth',
            touchAction: 'pan-x'
          }}
        >
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            
            // For items with submenus, make them expandable
            if (item.hasSubmenu) {
              return (
                <button
                  key={item.to}
                  onClick={() => handleMenuItemClick(item)}
                  className={`flex flex-col items-center justify-center min-w-[64px] px-3 py-2 rounded-xl transition-all duration-200 flex-shrink-0 relative
                    ${isActive 
                      ? 'bg-gradient-to-t from-button-500 to-button-400 text-white shadow-lg shadow-button-500/25' 
                      : 'text-gray-500 dark:text-gray-400 active:bg-primary-100 dark:bg-primary-900/30 dark:active:bg-gray-700'
                    }`}
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <div className="relative">
                    <item.icon size={22} className={isActive ? 'text-white' : ''} />
                    {isActive && (
                      <ChevronUp 
                        size={12} 
                        className={`absolute -top-1 -right-2 text-white ${expandedMenu === item.submenuId ? 'rotate-180' : ''} transition-transform`}
                      />
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-white' : ''}`}>
                    {item.label}
                  </span>
                </button>
              );
            }

            // Regular nav items
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center min-w-[64px] px-3 py-2 rounded-xl transition-all duration-200 flex-shrink-0 relative
                  ${isActive 
                    ? 'bg-gradient-to-t from-button-500 to-button-400 text-white shadow-lg shadow-button-500/25' 
                    : 'text-gray-500 dark:text-gray-400 active:bg-primary-100 dark:bg-primary-900/30 dark:active:bg-gray-700'
                  }`}
                style={{ scrollSnapAlign: 'start' }}
              >
                <item.icon size={22} className={isActive ? 'text-white' : ''} />
                <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-white' : ''}`}>
                  {item.label}
                </span>
                {item.badge === 'warning' && (
                  <AlertTriangle 
                    size={12} 
                    className="absolute top-1 right-1 text-orange-500 dark:text-orange-400 animate-pulse"
                  />
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default BottomNav;