/**
 * Reusable Skeleton Loading Component
 * Use this component for loading states throughout the application
 */

const Skeleton = ({ 
  variant = 'text', 
  width, 
  height, 
  className = '',
  count = 1,
  circle = false,
  rounded = 'lg',
}) => {
  const baseStyles = 'animate-skeleton-pulse bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 dark:from-gray-600 dark:via-gray-500 dark:to-gray-600 bg-[length:200%_100%]';
  
  const roundedStyles = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    full: 'rounded-full',
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'text':
        return `h-4 ${width || 'w-full'}`;
      case 'title':
        return `h-6 ${width || 'w-3/4'}`;
      case 'avatar':
        return 'w-12 h-12 rounded-full';
      case 'button':
        return `h-10 ${width || 'w-24'} rounded-lg`;
      case 'card':
        return `${height || 'h-32'} ${width || 'w-full'} rounded-xl`;
      case 'image':
        return `${height || 'h-48'} ${width || 'w-full'} rounded-xl`;
      case 'input':
        return `h-12 ${width || 'w-full'} rounded-xl`;
      case 'circle':
        return `${width || 'w-12'} ${height || 'h-12'} rounded-full`;
      case 'custom':
        return '';
      default:
        return `h-4 ${width || 'w-full'}`;
    }
  };

  const skeletonClass = `${baseStyles} ${circle ? 'rounded-full' : roundedStyles[rounded]} ${getVariantStyles()} ${className}`;

  if (count > 1) {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className={skeletonClass} style={{ width, height }} />
        ))}
      </div>
    );
  }

  return <div className={skeletonClass} style={{ width, height }} />;
};

// Pre-built skeleton layouts for common use cases
export const SkeletonCard = ({ className = '' }) => (
  <div className={`p-4 bg-white dark:bg-gray-800 rounded-xl border border-primary-100 dark:border-primary-700 ${className}`}>
    <div className="flex items-center gap-4 mb-4">
      <Skeleton variant="avatar" />
      <div className="flex-1">
        <Skeleton variant="title" width="w-1/2" className="mb-2" />
        <Skeleton variant="text" width="w-3/4" />
      </div>
    </div>
    <Skeleton variant="text" count={3} />
  </div>
);

export const SkeletonTable = ({ rows = 5, columns = 4, className = '' }) => (
  <div className={`overflow-hidden rounded-xl border border-primary-100 dark:border-primary-700 ${className}`}>
    {/* Header */}
    <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex gap-4">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} variant="text" width="w-24" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="px-4 py-4 flex gap-4 border-t border-gray-100 dark:border-gray-700">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} variant="text" width={colIndex === 0 ? 'w-32' : 'w-20'} />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonForm = ({ fields = 4, className = '' }) => (
  <div className={`space-y-4 ${className}`}>
    {Array.from({ length: fields }).map((_, index) => (
      <div key={index}>
        <Skeleton variant="text" width="w-24" className="mb-2" />
        <Skeleton variant="input" />
      </div>
    ))}
    <div className="pt-4">
      <Skeleton variant="button" width="w-32" />
    </div>
  </div>
);

export const SkeletonStats = ({ count = 4, className = '' }) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-primary-100 dark:border-primary-700">
        <div className="flex items-center justify-between mb-3">
          <Skeleton variant="text" width="w-20" />
          <Skeleton variant="circle" width="w-10" height="h-10" />
        </div>
        <Skeleton variant="title" width="w-16" className="mb-2" />
        <Skeleton variant="text" width="w-24" />
      </div>
    ))}
  </div>
);

export const SkeletonList = ({ items = 5, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-primary-100 dark:border-primary-700">
        <Skeleton variant="avatar" />
        <div className="flex-1">
          <Skeleton variant="text" width="w-1/3" className="mb-1" />
          <Skeleton variant="text" width="w-2/3" />
        </div>
        <Skeleton variant="button" width="w-16" />
      </div>
    ))}
  </div>
);

export const SkeletonSettings = ({ className = '' }) => (
  <div className={`space-y-6 ${className}`}>
    {/* Logo section */}
    <div className="flex items-center gap-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
      <Skeleton variant="custom" className="w-24 h-24 rounded-2xl" />
      <div className="flex-1">
        <Skeleton variant="text" width="w-32" className="mb-2" />
        <Skeleton variant="text" width="w-48" className="mb-3" />
        <Skeleton variant="button" width="w-28" />
      </div>
    </div>
    {/* Form fields */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Skeleton variant="text" width="w-24" className="mb-2" />
        <Skeleton variant="input" />
      </div>
      <div>
        <Skeleton variant="text" width="w-24" className="mb-2" />
        <Skeleton variant="input" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Skeleton variant="text" width="w-24" className="mb-2" />
        <Skeleton variant="input" />
      </div>
      <div>
        <Skeleton variant="text" width="w-24" className="mb-2" />
        <Skeleton variant="input" />
      </div>
    </div>
    <div>
      <Skeleton variant="text" width="w-32" className="mb-2" />
      <Skeleton variant="custom" className="h-20 w-full rounded-xl" />
    </div>
    {/* Business hours section */}
    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
      <Skeleton variant="text" width="w-32" className="mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Skeleton variant="text" width="w-24" className="mb-2" />
          <Skeleton variant="input" />
        </div>
        <div>
          <Skeleton variant="text" width="w-24" className="mb-2" />
          <Skeleton variant="input" />
        </div>
      </div>
    </div>
    {/* Save button */}
    <div className="flex justify-end pt-4 border-t">
      <Skeleton variant="button" width="w-32" />
    </div>
  </div>
);

export const SkeletonDashboard = ({ className = '' }) => (
  <div className={`space-y-6 ${className}`}>
    <SkeletonStats count={4} />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="p-4 bg-white dark:bg-gray-700 rounded-xl border border-primary-100 dark:border-primary-700">
        <Skeleton variant="title" width="w-32" className="mb-4" />
        <Skeleton variant="custom" className="h-64 w-full rounded-lg" />
      </div>
      <div className="p-4 bg-white dark:bg-gray-700 rounded-xl border border-primary-100 dark:border-primary-700">
        <Skeleton variant="title" width="w-32" className="mb-4" />
        <Skeleton variant="custom" className="h-64 w-full rounded-lg" />
      </div>
    </div>
  </div>
);

export default Skeleton;
