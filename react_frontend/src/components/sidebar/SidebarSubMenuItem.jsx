import { NavLink, useLocation } from 'react-router-dom';
import { adminPageImports } from '../../App';

const prefetchCache = new Set();
const prefetchRoute = (to) => {
  if (!to || prefetchCache.has(to)) return;
  const seg = to.replace(/\/$/, '').split('/').pop();
  if (seg && adminPageImports[seg]) {
    prefetchCache.add(to);
    adminPageImports[seg]();
  }
};

const SidebarSubMenuItem = ({ icon: Icon, label, to }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <NavLink
      to={to}
      onMouseEnter={() => prefetchRoute(to)}
      onTouchStart={() => prefetchRoute(to)}
      className={`
        flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group
        ${isActive
          ? 'bg-button-500/30 dark:bg-button-500/40 text-button-600 dark:text-button-400 dark:text-white font-medium'
          : 'hover:bg-button-500/20 dark:hover:bg-button-500/30 hover:text-button-600 dark:text-button-400 dark:hover:text-button-300'
        }
      `}
      style={!isActive ? { color: 'var(--color-text-sidebar)', opacity: 0.85 } : undefined}
    >
      {Icon && <Icon size={18} className={isActive ? 'text-button-500 dark:text-button-300' : 'group-hover:text-button-500 dark:group-hover:text-button-300'} style={!isActive ? { color: 'var(--color-text-sidebar)', opacity: 0.7 } : undefined} />}
      <span style={{ fontSize: 'var(--font-size-sidebar)' }}>{label}</span>
    </NavLink>
  );
};

export default SidebarSubMenuItem;
