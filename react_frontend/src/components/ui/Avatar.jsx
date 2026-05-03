const Avatar = ({ 
  src, 
  alt = '', 
  size = 'md', 
  fallback,
  className = '' 
}) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${sizes[size]} rounded-full object-cover ${className}`}
      />
    );
  }

  // Fallback with initials - always use button color for consistency
  return (
    <div
      className={`${sizes[size]} bg-gradient-to-br from-button-500 to-button-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md ${className}`}
    >
      {getInitials(fallback)}
    </div>
  );
};

export default Avatar;
