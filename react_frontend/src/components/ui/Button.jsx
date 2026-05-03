import { forwardRef } from 'react';

const Button = forwardRef(({ 
  children, 
  variant = 'default', 
  size = 'md', 
  className = '',
  icon: Icon,
  iconPosition = 'left',
  loading, // prevent forwarding to DOM; use disabled instead
  ...props 
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg';
  
  const variants = {
    default: 'bg-button-500 text-white hover:bg-button-600 focus:ring-button-500 shadow-sm hover:shadow-md',
    secondary: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-gray-500',
    outline: 'border-2 border-primary-300 dark:border-primary-700 bg-transparent text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-gray-700 focus:ring-primary-500',
    ghost: 'bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-gray-500',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 shadow-sm hover:shadow-md',
    success: 'bg-button-500 text-white hover:bg-button-600 focus:ring-button-500 shadow-sm hover:shadow-md',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 shadow-sm hover:shadow-md',
    info: 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500 shadow-sm hover:shadow-md',
  };

  const sizes = {
    xs: 'px-2.5 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && iconPosition === 'left' && <Icon size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} className={children ? 'mr-1.5' : ''} />}
      {children}
      {Icon && iconPosition === 'right' && <Icon size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} className={children ? 'ml-1.5' : ''} />}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
