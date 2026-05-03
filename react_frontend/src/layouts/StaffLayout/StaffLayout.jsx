import { useState } from 'react';
import { DEFAULT_LOGO } from '../../api/config';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Monitor, 
  User,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { Footer } from '../../components/common';
import { Avatar } from '../../components/ui';
import { ConfirmModal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/secretary/dashboard' },
  { icon: Monitor, label: 'Point of Sale', to: '/secretary/pos' },
  { icon: User, label: 'My Profile', to: '/secretary/profile' },
];

const StaffLayout = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { settings } = useBusinessSettings();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const staffName = user?.first_name && user?.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user?.name || 'Secretary';

  const handleLogout = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    navigate('/?login=true');
  };

  return (
    <div 
      className="min-h-screen min-h-[100dvh] transition-colors duration-300 flex flex-col"
      style={{ backgroundColor: 'var(--color-bg-body)' }}
    >
      {/* Header Navigation */}
      <header 
        className="sticky top-0 z-50 border-b-2 border-primary-300 dark:border-primary-700 shadow-sm"
        style={{ backgroundColor: 'var(--color-bg-sidebar)', color: 'var(--color-text-sidebar)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          {/* Logo & Business Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-button-500 to-button-600 rounded-lg flex items-center justify-center overflow-hidden shadow-md">
              <img 
                src={settings.business_logo || DEFAULT_LOGO} 
                alt={settings.business_name || 'Logo'} 
                className="w-7 h-7 object-contain" 
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} 
              />
              <span style={{display:'none'}} className="text-white font-bold text-sm items-center justify-center">
                {(settings.business_name || 'K').substring(0, 1)}
              </span>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-800 dark:text-gray-100 leading-tight">
                {settings.business_name || 'KJP Ricemill'}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Secretary Portal</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-gradient-to-r from-button-500 to-button-400 text-white shadow-md shadow-button-500/25'
                    : 'hover:bg-button-50 dark:hover:bg-button-500/40 hover:text-button-700 dark:hover:text-button-300'
                  }
                `}
                style={({ isActive }) => !isActive ? { color: 'var(--color-text-sidebar)' } : undefined}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Desktop User & Logout */}
          <div className="hidden md:flex items-center gap-3 relative">
            <button 
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
            >
              <Avatar name={staffName} size="sm" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
                {staffName}
              </span>
            </button>

            {/* User Dropdown */}
            {isUserDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsUserDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-primary-200 dark:border-primary-700 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-600">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{staffName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Secretary</p>
                  </div>
                  <button 
                    onClick={() => { setIsUserDropdownOpen(false); setIsLogoutModalOpen(true); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            {isMobileMenuOpen ? (
              <X size={24} className="text-gray-600 dark:text-gray-300" />
            ) : (
              <Menu size={24} className="text-gray-600 dark:text-gray-300" />
            )}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-primary-200 dark:border-primary-700 px-4 py-3 space-y-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-gradient-to-r from-button-500 to-button-400 text-white shadow-md shadow-button-500/25'
                    : 'hover:bg-button-50 dark:hover:bg-button-500/40 hover:text-button-700 dark:hover:text-button-300'
                  }
                `}
                style={({ isActive }) => !isActive ? { color: 'var(--color-text-sidebar)' } : undefined}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            ))}
            
            {/* Mobile User Info & Logout */}
            <div className="pt-2 mt-2 border-t border-primary-200 dark:border-primary-700">
              <div className="flex items-center gap-3 px-4 py-2">
                <Avatar name={staffName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">{staffName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Secretary</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsMobileMenuOpen(false); setIsLogoutModalOpen(true); }}
                className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <div className="p-4 md:p-6 lg:p-8 flex-1">
          <div 
            className="rounded-2xl shadow-xl border-2 border-primary-300 dark:border-primary-700 p-4 md:p-6 lg:p-8 min-h-[calc(100vh-12rem)] min-h-[calc(100dvh-12rem)] transition-colors duration-300 overflow-x-auto"
            style={{ 
              backgroundColor: 'var(--color-bg-content)', 
              color: 'var(--color-text-content)',
              fontSize: 'var(--font-size-base)'
            }}
          >
            <Outlet />
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-4 pb-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8">
          <Footer />
        </div>
      </main>

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
    </div>
  );
};

export default StaffLayout;
