import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { adminPageImports, customerPageImports, staffPageImports, driverPageImports } from '../../App';

// Build a route-segment → import() map for hover-prefetching
const allImports = { ...adminPageImports, ...customerPageImports, ...staffPageImports, ...driverPageImports };
const prefetchCache = new Set();
const prefetchRoute = (to) => {
  if (!to || prefetchCache.has(to)) return;
  // Extract the last meaningful segment: /superadmin/drying → "drying"
  const seg = to.replace(/\/$/, '').split('/').pop();
  if (seg && allImports[seg]) {
    prefetchCache.add(to);
    allImports[seg]();
  }
};

const SidebarMenuItem = ({ 
  icon: Icon, 
  label, 
  to, 
  hasSubmenu = false, 
  isOpen = false, 
  onClick,
  children,
  basePath,
  isCollapsed = false,
  badge = null
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Check if this item is active (exact match or starts with basePath for submenu parents)
  const isChildActive = basePath ? location.pathname.startsWith(basePath) && location.pathname !== basePath : false;
  const isParentActive = basePath ? location.pathname === basePath : false;

  if (hasSubmenu) {
    const isActive = isParentActive || isChildActive;
    
    const handleClick = () => {
      // Navigate to the parent page
      if (to) {
        navigate(to);
      }
      // Toggle submenu only if not collapsed
      if (onClick && !isCollapsed) {
        onClick();
      }
    };

    return (
      <div className="mb-0.5" onMouseEnter={() => prefetchRoute(to)} onTouchStart={() => prefetchRoute(to)}>
        <button
          onClick={handleClick}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-4 py-3 rounded-lg text-left transition-all duration-200 group
            ${isActive
              ? 'bg-gradient-to-r from-button-500 to-button-400 text-white shadow-lg shadow-button-500/25'
              : 'hover:bg-button-50 dark:hover:bg-button-500/40 hover:text-button-700 dark:text-button-300 dark:hover:text-button-300'
            }`}
          title={isCollapsed ? label : ''}
          style={!isActive ? { color: 'var(--color-text-sidebar)' } : undefined}
        >
          <div className={`flex items-center ${isCollapsed ? '' : 'gap-3'}`}>
            <Icon size={22} className={isActive ? 'text-white' : 'group-hover:text-button-600 dark:hover:text-button-400 dark:text-button-400 dark:group-hover:text-button-300'} style={!isActive ? { color: 'var(--color-text-sidebar)' } : undefined} />
            {!isCollapsed && <span className="font-medium" style={{ fontSize: 'var(--font-size-sidebar)' }}>{label}</span>}
          </div>
          {!isCollapsed && (
            isOpen ? (
              <ChevronDown size={16} className={`transition-transform duration-200 ${isActive ? 'text-white' : ''}`} style={!isActive ? { color: 'var(--color-text-sidebar)', opacity: 0.6 } : undefined} />
            ) : (
              <ChevronRight size={16} className={`transition-transform duration-200 ${isActive ? 'text-white' : ''}`} style={!isActive ? { color: 'var(--color-text-sidebar)', opacity: 0.6 } : undefined} />
            )
          )}
        </button>
        
        {/* Submenu - hide when collapsed */}
        {!isCollapsed && (
          <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-40 mt-1' : 'max-h-0'}`}>
            <div className="pl-4 space-y-1">
              {children}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      title={isCollapsed ? label : ''}
      onMouseEnter={() => prefetchRoute(to)}
      onTouchStart={() => prefetchRoute(to)}
      className={({ isActive }) => `
        flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-all duration-200 mb-0.5 group relative
        ${isActive
          ? 'bg-gradient-to-r from-button-500 to-button-400 text-white shadow-lg shadow-button-500/25'
          : 'hover:bg-button-50 dark:hover:bg-button-500/40 hover:text-button-700 dark:text-button-300 dark:hover:text-button-300'
        }
      `}
      style={({ isActive }) => !isActive ? { color: 'var(--color-text-sidebar)' } : undefined}
    >
      {({ isActive }) => (
        <>
          <Icon size={22} className={isActive ? 'text-white' : 'group-hover:text-button-600 dark:hover:text-button-400 dark:text-button-400 dark:group-hover:text-button-300'} style={!isActive ? { color: 'var(--color-text-sidebar)' } : undefined} />
          {!isCollapsed && <span className="font-medium" style={{ fontSize: 'var(--font-size-sidebar)' }}>{label}</span>}
          {badge === 'warning' && (
            <AlertTriangle 
              size={16} 
              className={`${isCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'} text-orange-500 dark:text-orange-400 animate-pulse`}
            />
          )}
        </>
      )}
    </NavLink>
  );
};

export default SidebarMenuItem;
