const StatsCard = ({ 
  label, 
  value, 
  unit, 
  icon: Icon, 
  iconBgColor = 'bg-button-500',
  trend,
  trendLabel 
}) => {
  return (
    <div className="bg-gradient-to-br from-primary-50 via-primary-100/30 to-primary-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 rounded-xl border-2 border-primary-400 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 p-4 relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-100/20 to-primary-50/20 dark:from-gray-700/20 dark:to-gray-600/20 pointer-events-none" />
      
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-3xl font-bold text-button-600 dark:text-button-400">{value}</p>
          {unit && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{unit}</p>}
          {trend != null && trend !== '' && (
            <p className={`text-xs mt-1 font-medium ${trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend >= 0 ? '+' : ''}{trend}% {trendLabel}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-3 ${iconBgColor} rounded-xl shadow-md`}>
            <Icon size={24} className="text-white" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
