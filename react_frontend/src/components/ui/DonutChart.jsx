import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// Helper to get CSS variable value
const getCSSVariable = (name) => {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

// Helper to detect dark mode
const useIsDarkMode = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
};

const DonutChart = ({ 
  title, 
  subtitle,
  data, 
  centerValue,
  centerLabel,
  height = 200,
  innerRadius = 60,
  outerRadius = 80,
  showLegend = true,
  compact = false,
  horizontalLegend = false,
  compactLegend = false,
  valueUnit = 'kg'
}) => {
  // Get theme colors from CSS variables
  const [themeColors, setThemeColors] = useState(['#22c55e', '#ef4444', '#f97316', '#3b82f6', '#8b5cf6', '#ec4899']);
  const isDark = useIsDarkMode();
  
  useEffect(() => {
    const updateColors = () => {
      const primary500 = getCSSVariable('--color-primary-500') || '#22c55e';
      const button500 = getCSSVariable('--color-button-500') || '#3b82f6';
      const primary400 = getCSSVariable('--color-primary-400') || '#4ade80';
      const button400 = getCSSVariable('--color-button-400') || '#60a5fa';
      setThemeColors([primary500, '#ef4444', '#f97316', button500, primary400, button400]);
    };
    
    updateColors();
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    
    return () => observer.disconnect();
  }, []);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Custom tooltip that hides placeholder/hidden items
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length || payload[0]?.payload?.hideFromLegend) return null;
    const entry = payload[0];
    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0';
    return (
      <div style={{
        backgroundColor: isDark ? '#1e293b' : 'white',
        border: `1px solid ${isDark ? '#475569' : '#e5e7eb'}`,
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        padding: '8px 12px',
        fontSize: '12px',
        color: isDark ? '#f1f5f9' : undefined,
      }}>
        <p style={{ color: isDark ? '#cbd5e1' : '#374151', margin: 0 }}>
          {entry.name}: {entry.value.toLocaleString()}{valueUnit ? ` ${valueUnit}` : ''} ({pct}%)
        </p>
      </div>
    );
  };

  // Detect compact mode based on height
  const isCompact = compact || height <= 120;

  return (
    <div className={`bg-gradient-to-br from-primary-50 via-primary-100/30 to-primary-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 rounded-xl border-2 border-primary-400 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 outline-none [&_*]:outline-none ${isCompact ? 'p-3' : 'p-4'}`}>
      {/* Header */}
      <div className={isCompact ? 'mb-1' : 'mb-2'}>
        <h3 className={`font-bold text-gray-800 dark:text-gray-100 ${isCompact ? 'text-sm' : 'text-lg'}`}>{title}</h3>
        {subtitle && !isCompact && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>

      {/* Horizontal Layout: Chart + Legend side by side */}
      {horizontalLegend && showLegend ? (
        <div className="flex items-center gap-4">
          {/* Chart */}
          <div className="relative flex-shrink-0" style={{ width: height, height: height }}>
            <ResponsiveContainer width="100%" height={height}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color || themeColors[index % themeColors.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip content={CustomTooltip} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Label */}
            {(centerValue !== undefined || centerLabel) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className={`font-bold text-gray-800 dark:text-gray-100 ${isCompact ? 'text-sm' : 'text-xl'}`}>{centerValue}</p>
                  {centerLabel && <p className={`text-gray-500 dark:text-gray-400 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>{centerLabel}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Legend beside chart */}
          <div className={`flex-1 ${compactLegend || data.length > 5 ? 'grid grid-cols-2 gap-x-3 gap-y-1' : 'space-y-1.5'}`}>
            {data.filter(item => !item.hideFromLegend).map((item, index) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div 
                  className={`rounded-full flex-shrink-0 ${compactLegend || data.length > 5 ? 'w-2.5 h-2.5' : 'w-3 h-3 mt-0.5'}`}
                  style={{ backgroundColor: item.color || themeColors[index % themeColors.length] }}
                />
                <div className="min-w-0">
                  <p className={`text-gray-600 dark:text-gray-300 truncate ${compactLegend || data.length > 5 ? 'text-[11px] leading-tight' : 'text-xs'}`} title={item.name}>{item.name}</p>
                  <p className={`font-semibold text-gray-800 dark:text-gray-100 ${compactLegend || data.length > 5 ? 'text-xs leading-tight' : 'text-sm'}`}>
                    {item.value.toLocaleString()}{valueUnit}
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-400 ml-0.5">
                      ({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="relative">
            <ResponsiveContainer width="100%" height={height}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color || themeColors[index % themeColors.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip content={CustomTooltip} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Label */}
            {(centerValue !== undefined || centerLabel) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className={`font-bold text-gray-800 dark:text-gray-100 ${isCompact ? 'text-sm' : 'text-xl'}`}>{centerValue}</p>
                  {centerLabel && <p className={`text-gray-500 dark:text-gray-400 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>{centerLabel}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Compact Legend - small color dots with names below chart */}
          {!showLegend && isCompact && data.length > 0 && (
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 mt-1">
              {data.slice(0, 5).map((item, index) => (
                <div key={item.name} className="flex items-center gap-1 group relative">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color || themeColors[index % themeColors.length] }}
                  />
                  <span 
                    className="text-[9px] text-gray-500 dark:text-gray-400 truncate max-w-[50px] cursor-help" 
                    title={`${item.name} - ${item.value.toLocaleString()}${valueUnit ? ` ${valueUnit}` : ''} (${total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)`}
                  >
                    {item.name.length > 8 ? item.name.substring(0, 8) + '...' : item.name}
                  </span>
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {item.name}: {item.value.toLocaleString()}{valueUnit ? ` ${valueUnit}` : ''} ({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Full Legend */}
          {showLegend && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {data.filter(item => !item.hideFromLegend).map((item, index) => (
                <div key={item.name} className="flex items-start gap-2">
                  <div 
                    className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0"
                    style={{ backgroundColor: item.color || themeColors[index % themeColors.length] }}
                  />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{item.name}</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {item.value.toLocaleString()}{valueUnit}
                      <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 ml-1">
                        ({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DonutChart;
