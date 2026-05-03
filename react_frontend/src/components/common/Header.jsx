import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, User, LogOut, Settings, ChevronDown } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { ConfirmModal } from '../ui';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';
import { DEFAULT_LOGO } from '../../api/config';
import { useAuth } from '../../context/AuthContext';

const Header = ({ onMenuClick }) => {
  const { settings } = useBusinessSettings();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    navigate('/?login=true');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
    <header 
      className="sticky top-0 border-b-2 border-primary-300 dark:border-primary-700 px-4 py-3 flex items-center justify-between shadow-sm lg:hidden z-50"
      style={{ backgroundColor: 'var(--color-bg-sidebar)' }}
    >
      {/* Left: Hamburger (tablet only) + Logo */}
      <div className="flex items-center gap-3">
        {/* Hamburger button - only show on tablet (md to lg) */}
        <button
          onClick={onMenuClick}
          className="hidden md:block p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/20 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={24} className="text-gray-700 dark:text-gray-200" />
        </button>
        
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-button-500 to-button-600 rounded-lg flex items-center justify-center shadow-md overflow-hidden">
            <img src={settings.business_logo || DEFAULT_LOGO} alt={settings.business_name || 'Logo'} className="w-7 h-7 object-contain" onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_LOGO; }} />
            <span style={{display:'none'}} className="text-white font-bold text-sm items-center justify-center">{(settings.business_name || 'K').substring(0, 1)}</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-800 dark:text-gray-100 text-base leading-tight">{settings.business_name || 'KJP Ricemill'}</h1>
            <p className="text-xs text-primary-500 dark:text-primary-400 font-medium">{settings.business_tagline || 'Management System'}</p>
          </div>
        </div>
      </div>

      {/* Right: Notification Bell + Account Icon with Dropdown */}
      <div className="flex items-center gap-1">
        <NotificationBell />
        <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsAccountOpen(!isAccountOpen)}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/20 transition-colors"
        >
          <div className="w-9 h-9 bg-gradient-to-br from-button-500 to-button-600 rounded-full flex items-center justify-center shadow-md">
            <User size={18} className="text-white" />
          </div>
          <ChevronDown 
            size={16} 
            className={`text-gray-500 dark:text-gray-400 transition-transform hidden sm:block ${isAccountOpen ? 'rotate-180' : ''}`} 
          />
        </button>

        {/* Dropdown Menu */}
        {isAccountOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-xl z-50 overflow-hidden animate-fadeIn">
            {/* User Info */}
            <div className="p-4 border-b border-primary-100 dark:border-primary-700 bg-gradient-to-r from-primary-50 to-white dark:from-gray-700 dark:to-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-button-500 to-button-600 rounded-full flex items-center justify-center shadow-md">
                  <User size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">{user?.name || 'Admin'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || ''}</p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
                <Settings size={18} className="text-gray-500 dark:text-gray-400" />
                Account Settings
              </button>
              <button
                onClick={() => { setIsAccountOpen(false); setIsLogoutModalOpen(true); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-button-500 hover:bg-button-600 text-white text-sm font-medium rounded-lg transition-colors mt-1"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </header>

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

export default Header;