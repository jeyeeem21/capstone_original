import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, Eye, EyeOff, Loader2, Check, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import Button from './Button';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api';

// Chunk preloaders — start downloading page JS before navigation
const chunkPreloaders = {
  admin: () => import('../../pages/admin/Dashboard'),
  super_admin: () => import('../../pages/admin/Dashboard'),
  customer: () => import('../../pages/customer/Dashboard'),
  driver: () => import('../../pages/driver/Deliveries'),
  secretary: () => import('../../pages/shared/PointOfSale'),
};

const LoginModal = ({ isOpen, onClose, onSwitchToRegister, onSwitchToForgotPassword = () => {} }) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({ email: false, password: false });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const formRef = useRef(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({ email: '', password: '' });
      setTouched({ email: false, password: false });
      setError('');
      setSubmitted(false);
      setShakeKey(0);
    }
  }, [isOpen]);

  // Keyboard shortcuts for login form
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      const form = formRef.current;
      if (!form) return;

      // Ctrl+S or Ctrl+Enter → submit form
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'Enter')) {
        e.preventDefault();
        if (!isLoading) form.requestSubmit();
        return;
      }

      // Ctrl+Shift+Backspace → clear all fields
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Backspace') {
        e.preventDefault();
        setFormData({ email: '', password: '' });
        setTouched({ email: false, password: false });
        setError('');
        setSubmitted(false);
        const firstInput = form.querySelector('input:not([type="hidden"]):not([disabled])');
        if (firstInput) firstInput.focus();
        return;
      }

      // Ctrl+Backspace → clear focused input field
      if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace' && !e.shiftKey) {
        const active = document.activeElement;
        if (active && active.tagName === 'INPUT' && active.closest('.fixed, [role="dialog"]')) {
          e.preventDefault();
          const fieldName = active.name;
          if (fieldName) {
            setFormData(prev => ({ ...prev, [fieldName]: '' }));
            setError('');
          }
        }
        return;
      }

      // Enter on input → move to next field if current has data, submit on last
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const active = document.activeElement;
        if (active && active.tagName === 'INPUT' && active.type !== 'submit' && active.type !== 'button') {
          e.preventDefault();
          const inputs = Array.from(form.querySelectorAll(
            'input:not([type="hidden"]):not([disabled])'
          )).filter(el => el.offsetParent !== null);
          const idx = inputs.indexOf(active);
          if (idx < 0) return;

          // Don't advance if required field is empty
          if (!active.value?.trim()) {
            active.classList.add('animate-shake');
            setTimeout(() => active.classList.remove('animate-shake'), 500);
            return;
          }

          if (idx < inputs.length - 1) {
            inputs[idx + 1].focus();
          } else {
            // Last field → submit
            form.requestSubmit();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, isLoading]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Validation helpers
  const getFieldStatus = (field) => {
    const value = formData[field]?.trim();
    const isTouched = touched[field];
    const isSubmittedEmpty = submitted && !value;
    
    if (isSubmittedEmpty || (isTouched && !value)) {
      return 'error';
    }
    if (value) {
      return 'success';
    }
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

    // Check if any required field is empty
    const hasEmptyFields = !formData.email?.trim() || !formData.password?.trim();
    
    if (hasEmptyFields) {
      setShakeKey(prev => prev + 1);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Start preloading ALL common chunks in parallel with the login API call
      // so the JS bundle is already downloading while we wait for auth
      Object.values(chunkPreloaders).forEach(loader => loader().catch(() => {}));

      const response = await login(formData.email, formData.password);

      // Prefetch key API data into cache in background (don't await)
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

      // Close modal and clean up
      onClose();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Safety: force-clear body scroll lock before navigating
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';

      // Force-remove any orphaned modal backdrop portals from document.body
      document.body.querySelectorAll(':scope > div.fixed.inset-0').forEach(el => {
        const cls = el.className || '';
        if (cls.includes('bg-black') || cls.includes('backdrop')) {
          el.remove();
        }
      });

      if (response?.user?.role === 'staff') {
        if (response?.user?.position === 'Driver') {
          navigate('/driver/dashboard');
        } else {
          navigate('/secretary/pos');
        }
      } else if (response?.user?.role === 'customer') {
        navigate('/customer/dashboard');
      } else if (response?.user?.role === 'super_admin') {
        navigate('/superadmin/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    } catch (err) {
      // Check if this is an email verification error
      if (err.response?.data?.requires_verification) {
        // Close modal and redirect to verification page
        onClose();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Clear body scroll lock
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        navigate(`/staff/verify?email=${encodeURIComponent(formData.email)}`);
        return;
      }
      
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ email: '', password: '' });
    setTouched({ email: false, password: false });
    setError('');
    setSubmitted(false);
    onClose();
  };

  // Input styling based on status (matching FormInput from admin)
  const getInputClassName = (field, hasLeftIcon = false, hasRightIcon = false) => {
    const status = getFieldStatus(field);
    const shouldShake = submitted && !formData[field]?.trim();
    
    const baseClasses = `w-full py-3 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4`;
    const paddingClasses = `${hasLeftIcon ? 'pl-10' : 'px-4'} ${hasRightIcon ? 'pr-12' : 'pr-10'}`;
    
    const statusClasses = {
      error: 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20',
      success: 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20',
      default: 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20'
    };

    return `${baseClasses} ${paddingClasses} ${statusClasses[status]} ${shouldShake ? 'animate-shake' : ''}`;
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="Login to KJP Ricemill"
      size="sm"
    >
      <form ref={formRef} onSubmit={handleSubmit} className={`space-y-4 ${shakeKey > 0 ? 'animate-shake' : ''}`} key={shakeKey} noValidate>
        {/* Logo/Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-button-500 to-button-600 rounded-xl flex items-center justify-center shadow-lg shadow-button-500/25">
            <LogIn size={28} className="text-white" />
          </div>
        </div>

        {/* Welcome Text */}
        <div className="text-center mb-4">
          <p className="text-gray-600 dark:text-gray-300">Welcome back! Please login to your account.</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Email Field */}
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
            />
            {/* Status Icon */}
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

        {/* Password Field */}
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
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-300 transition-colors z-10"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            {/* Status Icon */}
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

        {/* Forgot Password */}
        <div className="flex items-center justify-end text-sm">
          <button
            type="button"
            onClick={() => {
              setError('');
              setSubmitted(false);
              setTouched({ email: false, password: false });
              onSwitchToForgotPassword(formData.email?.trim() || '');
            }}
            className="text-button-600 hover:text-button-700 dark:text-button-300 font-medium"
          >
            Forgot Password?
          </button>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full py-3"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            <>
              <LogIn size={18} className="mr-2" />
              Login
            </>
          )}
        </Button>

        {/* Register Link */}
        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-semibold text-button-600 dark:text-button-400 hover:underline"
          >
            Register here
          </button>
        </p>
      </form>
    </Modal>
  );
};

export default LoginModal;
