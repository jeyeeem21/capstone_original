import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  ChevronLeft,
  LogOut,
  X,
  ClipboardList,
  Sun,
  Shield,
  FileBarChart,
} from 'lucide-react';
import { Avatar, useToast } from '../ui';
import { ConfirmModal } from '../ui/Modal';
import SidebarMenuItem from './SidebarMenuItem';
import SidebarSubMenuItem from './SidebarSubMenuItem';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';
import { DEFAULT_LOGO } from '../../api/config';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ isCollapsed, onToggleCollapse, isMobileOpen, onMobileClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useBusinessSettings();
  const { user, logout, isSuperAdmin, basePath } = useAuth();
  const toast = useToast();
  const [openMenus, setOpenMenus] = useState({
    products: false,
    partners: false,
  });
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [showSmtpWarning, setShowSmtpWarning] = useState(false);

  // Check SMTP configuration - show warning if SMTP password is empty/not configured
  useEffect(() => {
    // Check both the explicit flag AND the presence of a masked password as fallback
    const isConfigured = settings?.smtp_configured === true
      || (settings?.smtp_password && settings.smtp_password !== '' && settings.smtp_password !== null);
    
    // Show warning if NOT configured (empty smtp_password)
    setShowSmtpWarning(!isConfigured);
  }, [settings]); // Re-check when settings change

  // Auto-expand menus based on current route
  useEffect(() => {
    if (location.pathname.includes('/products')) {
      setOpenMenus(prev => ({ ...prev, products: true }));
    }
    if (location.pathname.includes('/partners')) {
      setOpenMenus(prev => ({ ...prev, partners: true }));
    }
  }, [location.pathname]);

  // Close mobile sidebar when route changes
  useEffect(() => {
    if (onMobileClose) {
      onMobileClose();
    }
  }, [location.pathname]);

  const toggleMenu = (menu) => {
    setOpenMenus(prev => ({
      ...prev,
      [menu]: !prev[menu]
    }));
  };

  const handleLogout = async () => {
    // Check if SMTP is configured before allowing logout
    const isSmtpConfigured = settings?.smtp_configured === true
      || (settings?.smtp_password && settings.smtp_password !== '' && settings.smtp_password !== null);
    if (!isSmtpConfigured) {
      toast.error('SMTP Configuration Required', 'Please configure your Gmail App Password in Settings before logging out. This is required for email notifications.');
      setIsLogoutModalOpen(false);
      return;
    }
    
    setIsLogoutModalOpen(false);
    await logout();
    navigate('/?login=true');
  };

  const displayName = user?.first_name && user?.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user?.name || 'User';
  
  const displayEmail = user?.email || '';
  
  const roleLabel = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    staff: 'Secretary',
  }[user?.role] || 'User';

  return (
    <>
      {/* Backdrop for mobile/tablet */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      
      <aside 
        className={`
          fixed left-0 top-0 h-screen h-[100dvh] border-r-2 border-primary-300 dark:border-primary-700 
          flex flex-col transition-all duration-300 z-50
          shadow-[4px_0_20px_-3px_rgba(0,0,0,0.2)]
          w-72
          ${isCollapsed ? 'lg:w-20' : 'lg:w-72'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
        style={{ backgroundColor: 'var(--color-bg-sidebar)', color: 'var(--color-text-sidebar)' }}
      >
      {/* Header / Logo */}
      <div className="p-4 border-b-2 border-primary-200 dark:border-primary-700">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 bg-gradient-to-br from-button-500 to-button-600 rounded-xl flex items-center justify-center shadow-lg shadow-button-500/25 overflow-hidden flex-shrink-0"
          >
            <img 
              src={settings.business_logo && !settings.business_logo.startsWith('blob:') ? settings.business_logo : DEFAULT_LOGO} 
              alt={settings.business_name || 'Business Logo'} 
              className="w-8 h-8 object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <span className="hidden text-white font-bold text-lg">{settings.business_name?.substring(0, 3) || 'KJP'}</span>
          </div>
          {/* Mobile/Tablet: Close button */}
          <div className="flex-1 min-w-0 lg:hidden">
            <h1 className="font-bold text-lg leading-tight" style={{ color: 'var(--color-text-sidebar)' }}>{settings.business_name || 'KJP Ricemill'}</h1>
            <p className="text-xs text-primary-500 dark:text-primary-400 font-medium">{settings.business_tagline || 'Inventory & Sales'}</p>
          </div>
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors bg-primary-50 dark:bg-primary-900/20 flex-shrink-0 lg:hidden"
            title="Close sidebar"
          >
            <X size={18} className="text-primary-500 dark:text-primary-400" />
          </button>
          {/* Desktop: Show ">" button beside logo when collapsed */}
          {isCollapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors bg-primary-50 dark:bg-primary-900/20 flex-shrink-0 hidden lg:block"
              title="Expand sidebar"
            >
              <ChevronLeft size={18} className="text-primary-500 dark:text-primary-400 rotate-180" />
            </button>
          )}
          {/* Desktop: Show title and "<" button at edge when expanded */}
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0 hidden lg:block">
                <h1 className="font-bold text-lg leading-tight" style={{ color: 'var(--color-text-sidebar)' }}>{settings.business_name || 'KJP Ricemill'}</h1>
                <p className="text-xs text-primary-500 dark:text-primary-400 font-medium">{settings.business_tagline || 'Inventory & Sales'}</p>
              </div>
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors bg-primary-50 dark:bg-primary-900/20 flex-shrink-0 hidden lg:block"
                title="Collapse sidebar"
              >
                <ChevronLeft size={18} className="text-primary-500 dark:text-primary-400" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto scrollbar-hide">
        <div className="space-y-1">
          {/* Dashboard */}
          <SidebarMenuItem
            icon={LayoutDashboard}
            label="Dashboard"
            to={`${basePath}/dashboard`}
            isCollapsed={isCollapsed}
          />

          {/* Procurement */}
          <SidebarMenuItem
            icon={ShoppingCart}
            label="Procurement"
            to={`${basePath}/procurement`}
            isCollapsed={isCollapsed}
          />

          {/* Drying Process */}
          <SidebarMenuItem
            icon={Sun}
            label="Drying"
            to={`${basePath}/drying`}
            isCollapsed={isCollapsed}
          />

          {/* Processing */}
          <SidebarMenuItem
            icon={Settings2}
            label="Processing"
            to={`${basePath}/processing`}
            isCollapsed={isCollapsed}
          />

          {/* Products with Submenu */}
          <SidebarMenuItem
            icon={Package}
            label="Products"
            to={`${basePath}/products`}
            basePath={`${basePath}/products`}
            hasSubmenu
            isOpen={openMenus.products}
            onClick={() => toggleMenu('products')}
            isCollapsed={isCollapsed}
          >
            <SidebarSubMenuItem
              icon={Tag}
              label="Varieties"
              to={`${basePath}/products/varieties`}
            />
            <SidebarSubMenuItem
              icon={Warehouse}
              label="Inventory"
              to={`${basePath}/products/inventory`}
            />
          </SidebarMenuItem>

          {/* Point of Sale */}
          <SidebarMenuItem
            icon={Monitor}
            label="Point of Sale"
            to={`${basePath}/pos`}
            isCollapsed={isCollapsed}
          />

          {/* Orders */}
          <SidebarMenuItem
            icon={ClipboardList}
            label="Orders"
            to={`${basePath}/orders`}
            isCollapsed={isCollapsed}
          />

          {/* Partners with Submenu */}
          <SidebarMenuItem
            icon={Users}
            label="Partners"
            to={`${basePath}/partners`}
            basePath={`${basePath}/partners`}
            hasSubmenu
            isOpen={openMenus.partners}
            onClick={() => toggleMenu('partners')}
            isCollapsed={isCollapsed}
          >
            <SidebarSubMenuItem
              icon={Truck}
              label="Supplier"
              to={`${basePath}/partners/supplier`}
            />
            <SidebarSubMenuItem
              icon={UserCheck}
              label="Customer"
              to={`${basePath}/partners/customer`}
            />
          </SidebarMenuItem>

          {/* Staff Management */}
          <SidebarMenuItem
            icon={UserCog}
            label="Staff Management"
            to={`${basePath}/staff-management`}
            isCollapsed={isCollapsed}
          />

          {/* Sales */}
          <SidebarMenuItem
            icon={TrendingUp}
            label="Sales"
            to={`${basePath}/sales`}
            isCollapsed={isCollapsed}
          />

          {/* Reports */}
          <SidebarMenuItem
            icon={FileBarChart}
            label="Reports"
            to={`${basePath}/reports`}
            isCollapsed={isCollapsed}
          />

          {/* Settings */}
          <SidebarMenuItem
            icon={Settings}
            label="Settings"
            to={`${basePath}/settings`}
            isCollapsed={isCollapsed}
            badge={showSmtpWarning ? 'warning' : null}
          />
        </div>
      </nav>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-primary-100 dark:border-primary-700">
        <div className="relative group">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} p-2 rounded-xl bg-gradient-to-r from-secondary-100 to-secondary-50 dark:from-gray-700 dark:to-gray-600 cursor-pointer`}>
            <Avatar fallback={displayName} size="md" />
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{roleLabel}</p>
                </div>
                <button 
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-button-500 hover:bg-button-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </>
            )}
          </div>
          {/* Tooltip when collapsed */}
          {isCollapsed && (
            <div className="absolute left-full bottom-0 ml-3 hidden group-hover:block z-50">
              <div className="bg-white dark:bg-gray-800 border-2 border-primary-300 dark:border-primary-700 rounded-xl shadow-xl p-3 min-w-[180px]">
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-primary-100 dark:border-primary-700">
                  <Avatar fallback={displayName} size="md" />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{roleLabel}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-button-500 hover:bg-button-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
              {/* Arrow */}
              <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-white dark:bg-gray-800 border-l-2 border-b-2 border-primary-300 dark:border-primary-700 rotate-45"></div>
            </div>
          )}
        </div>
      </div>
    </aside>

    {/* Logout Confirmation Modal */}
    <ConfirmModal
      isOpen={isLogoutModalOpen}
      onClose={() => setIsLogoutModalOpen(false)}
      onConfirm={handleLogout}
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

export default Sidebar;