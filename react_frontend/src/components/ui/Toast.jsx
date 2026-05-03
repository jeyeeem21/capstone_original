import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const Toast = ({ id, type, title, message, onClose }) => {
  // Using CSS variables for theme-based colors - border-500 is the main border color from database
  const types = {
    success: { 
      icon: CheckCircle, 
      bgClass: 'bg-primary-50 dark:bg-gray-800', 
      borderClass: 'border-l-4 border-primary-500',
      iconClass: 'text-primary-600 dark:text-primary-400',
      titleClass: 'text-primary-800 dark:text-primary-200',
    },
    error: { 
      icon: XCircle, 
      bgClass: 'bg-red-50 dark:bg-gray-800', 
      borderClass: 'border-l-4 border-red-500',
      iconClass: 'text-red-500 dark:text-red-400',
      titleClass: 'text-red-800 dark:text-red-200',
    },
    warning: { 
      icon: AlertTriangle, 
      bgClass: 'bg-yellow-50 dark:bg-gray-800', 
      borderClass: 'border-l-4 border-yellow-500',
      iconClass: 'text-yellow-500 dark:text-yellow-400',
      titleClass: 'text-yellow-800 dark:text-yellow-300',
    },
    info: { 
      icon: Info, 
      bgClass: 'bg-primary-50 dark:bg-gray-800', 
      borderClass: 'border-l-4 border-primary-500',
      iconClass: 'text-primary-600 dark:text-primary-400',
      titleClass: 'text-primary-800 dark:text-primary-200',
    },
  };

  const style = types[type] || types.info;
  const Icon = style.icon;

  return (
    <div 
      className={`${style.bgClass} ${style.borderClass} rounded-lg shadow-lg p-4 min-w-[320px] max-w-md animate-slideInRight`}
    >
      <div className="flex items-start gap-3">
        <Icon size={20} className={`${style.iconClass} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${style.titleClass}`}>{title}</h4>
          {message && <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{message}</p>}
        </div>
        <button
          onClick={() => onClose(id)}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'info', title, message, duration = 2000 }) => {
    const id = Date.now() + Math.random();
    
    setToasts((prev) => [...prev, { id, type, title, message }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Convenience methods
  const success = useCallback((title, message) => addToast({ type: 'success', title, message }), [addToast]);
  const error = useCallback((title, message) => addToast({ type: 'error', title, message }), [addToast]);
  const warning = useCallback((title, message) => addToast({ type: 'warning', title, message }), [addToast]);
  const info = useCallback((title, message) => addToast({ type: 'info', title, message }), [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
      {children}
      
      {/* Toast Container - pointer-events-none when empty to prevent blocking clicks */}
      <div className={`fixed top-4 right-4 z-[99999] flex flex-col gap-3${toasts.length === 0 ? ' pointer-events-none' : ''}`}>
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;