import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { isDark } = useTheme();

  const getDashboardPath = () => {
    if (!isAuthenticated || !user) return '/';
    const roleMap = {
      super_admin: '/superadmin/dashboard',
      admin: '/admin/dashboard',
      staff: '/secretary/dashboard',
      customer: '/customer/dashboard',
      driver: '/driver/dashboard',
    };
    return roleMap[user.role] || '/';
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-md w-full text-center">
        {/* 404 illustration */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-32 h-32 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-100)' }}>
              <Search size={56} style={{ color: 'var(--color-primary-400)' }} />
            </div>
            <div className="absolute -top-2 -right-2 w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: 'var(--color-button-500)' }}>
              <span className="text-white font-bold text-lg">?</span>
            </div>
          </div>
        </div>

        {/* Text */}
        <h1 className="text-6xl font-extrabold mb-2" style={{ color: 'var(--color-button-500)' }}>404</h1>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          Page Not Found
        </h2>
        <p className="mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <p className="text-sm mb-8 font-mono break-all" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>
          {location.pathname}
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(getDashboardPath())}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-white font-medium rounded-xl transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--color-button-500)' }}
          >
            <Home size={18} />
            {isAuthenticated ? 'Go to Dashboard' : 'Go Home'}
          </button>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-6 py-2.5 border-2 font-medium rounded-xl transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--color-primary-300)', color: 'var(--color-text-primary)' }}
          >
            <ArrowLeft size={18} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
