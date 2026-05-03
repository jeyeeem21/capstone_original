const StatusBadge = ({ status, variant }) => {
  const variants = {
    success: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:bg-green-500/15 dark:text-green-400',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400',
    danger: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:bg-red-500/15 dark:text-red-400',
    info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
    default: 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 dark:bg-gray-700 dark:text-gray-300',
  };

  // Auto-detect variant based on status if not provided
  const getVariant = () => {
    if (variant) return variants[variant] || variants.default;
    
    const statusLower = status?.toLowerCase() || '';
    if (['active', 'completed', 'dried', 'in stock', 'paid', 'approved', 'delivered'].includes(statusLower)) {
      return variants.success;
    }
    if (['pending', 'low stock', 'drying', 'warning', 'postponed', 'return requested', 'picking up', 'picked up'].includes(statusLower)) {
      return variants.warning;
    }
    if (['inactive', 'cancelled', 'voided', 'out of stock', 'rejected', 'failed', 'returned', 'blocked'].includes(statusLower)) {
      return variants.danger;
    }
    if (['info', 'new', 'draft', 'shipped', 'processing'].includes(statusLower)) {
      return variants.info;
    }
    return variants.default;
  };

  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getVariant()}`}>
      {status}
    </span>
  );
};

export default StatusBadge;