import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LogIn, User, Lock, Eye, EyeOff, Loader2, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';
import { DEFAULT_LOGO } from '../../api/config';
import { apiClient } from '../../api';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user, loading: authLoading } = useAuth();
  const { settings } = useBusinessSettings();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({ email: false, password: false });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === 'staff') {
        if (user.position === 'Driver') {
          navigate('/driver/dashboard', { replace: true });
        } else {
          navigate('/secretary/pos', { replace: true });
        }
      } else if (user.role === 'customer') {
        navigate('/customer/dashboard', { replace: true });
      } else if (user.role === 'super_admin') {
        navigate('/superadmin/dashboard', { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, authLoading, navigate, location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const getFieldStatus = (field) => {
    const value = formData[field]?.trim();
    const isTouched = touched[field];
    const isSubmittedEmpty = submitted && !value;
    
    if (isSubmittedEmpty || (isTouched && !value)) return 'error';
    if (value) return 'success';
    return 'default';
  };

  const getFieldError = (field) => {
    const value = formData[field]?.trim();
    const isTouched = touched[field];
    
    if ((submitted || isTouched) && !value) {
      return field === 'email' ? 'Email is required' : 'Password is required';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);

    const hasEmptyFields = !formData.email?.trim() || !formData.password?.trim();
    
    if (hasEmptyFields) {
      setShakeKey(prev => prev + 1);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Preload all common page chunks in parallel with the login API
      [
        () => import('../admin/Dashboard'),
        () => import('../customer/Dashboard'),
        () => import('../driver/Deliveries'),
        () => import('../shared/PointOfSale'),
      ].forEach(loader => loader().catch(() => {}));

      const response = await login(formData.email, formData.password);

      // Prefetch key API data into cache (don't await — fire and forget)
      const role = response?.user?.role;
      const position = response?.user?.position;
      if (role === 'admin' || role === 'super_admin') {
        apiClient.get('/dashboard/stats?period=monthly').catch(() => {});
        apiClient.get('/dashboard/recent-activity?limit=15').catch(() => {});
      } else if (role === 'customer') {
        apiClient.get('/customer/dashboard').catch(() => {});
      } else if (role === 'staff' && position === 'Driver') {
        apiClient.get('/driver/my-deliveries').catch(() => {});
      }

      // Redirect handled by useEffect above
    } catch (err) {
      const msg = err.message || '';
      if (
        msg.includes('401') ||
        msg.toLowerCase().includes('unauthenticated') ||
        msg.toLowerCase().includes('credentials') ||
        msg.toLowerCase().includes('invalid')
      ) {
        setError('Invalid email or password. Please try again.');
      } else if (msg) {
        setError(msg);
      } else {
        setError('Login failed. Please try again.');
      }
      setShakeKey(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const getInputClassName = (field, hasLeftIcon = false, hasRightIcon = false) => {
    const status = getFieldStatus(field);
    const shouldShake = submitted && !formData[field]?.trim();
    
    const baseClasses = `w-full py-3 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4`;
    const paddingClasses = `${hasLeftIcon ? 'pl-10' : 'px-4'} ${hasRightIcon ? 'pr-12' : 'pr-10'}`;
    
    const statusClasses = {
      error: 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20',
      success: 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20',
      default: 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
    };

    return `${baseClasses} ${paddingClasses} ${statusClasses[status]} ${shouldShake ? 'animate-shake' : ''}`;
  };

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 dark:from-gray-700 via-white to-secondary-50 dark:to-gray-700">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-button-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 dark:from-gray-700 via-white to-secondary-50 dark:to-gray-700 p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-72 h-72 bg-button-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border-2 border-primary-200 dark:border-primary-700 p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-button-500 to-button-600 rounded-2xl flex items-center justify-center shadow-lg shadow-button-500/25 overflow-hidden">
              <img 
                src={settings.business_logo && !settings.business_logo.startsWith('blob:') ? settings.business_logo : DEFAULT_LOGO} 
                alt={settings.business_name || 'KJP Ricemill'} 
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <span className="hidden text-white font-bold text-2xl">{settings.business_name?.substring(0, 3) || 'KJP'}</span>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{settings.business_name || 'KJP Ricemill'}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Sign in to your account</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className={shakeKey > 0 ? 'animate-shake' : ''} key={shakeKey} noValidate>
            {/* Email */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Email Address
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur('email')}
                  placeholder="admin@kjpricemill.com"
                  className={getInputClassName('email', true, false)}
                  autoComplete="email"
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {getFieldStatus('email') === 'error' && <AlertCircle size={18} className="text-red-500" />}
                  {getFieldStatus('email') === 'success' && <Check size={18} className="text-green-500" />}
                </div>
              </div>
              {getFieldError('email') && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {getFieldError('email')}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Password
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => handleBlur('password')}
                  placeholder="Enter your password"
                  className={getInputClassName('password', true, true)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-300 transition-colors z-10"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {getFieldStatus('password') === 'error' && <AlertCircle size={18} className="text-red-500" />}
                  {getFieldStatus('password') === 'success' && <Check size={18} className="text-green-500" />}
                </div>
              </div>
              {getFieldError('password') && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {getFieldError('password')}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-2 bg-gradient-to-r from-button-500 to-button-600 hover:from-button-600 hover:to-button-700 text-white font-semibold rounded-xl shadow-lg shadow-button-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Back to website */}
          <div className="mt-6 text-center">
            <Link 
              to="/" 
              className="block text-sm text-gray-500 dark:text-gray-400 hover:text-button-600 dark:hover:text-button-400 dark:text-button-400 transition-colors"
            >
              &larr; Back to website
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          &copy; {new Date().getFullYear()} {settings.business_name || 'KJP Ricemill'}. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
