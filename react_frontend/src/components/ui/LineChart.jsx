import { useState, useEffect, useCallback } from 'react';
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

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

// Custom Tooltip with % change from previous period
const CustomTooltip = ({ active, payload, label, data, lines, themeColors, yAxisUnit, isDark }) => {
  if (!active || !payload || !payload.length || !data) return null;

  // Find current index in data
  const currentIndex = data.findIndex(d => String(d.name) === String(label));

  return (
    <div className={`rounded-xl shadow-lg p-3 min-w-[180px] border ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white dark:bg-gray-700 border-primary-200 dark:border-primary-700'}`}>
      <p className={`text-sm font-semibold mb-2 pb-1.5 border-b ${isDark ? 'text-gray-100 border-gray-600' : 'text-gray-800 dark:text-gray-100 border-gray-100 dark:border-gray-700'}`}>{label}</p>
      {payload.map((entry, i) => {
        const currentValue = entry.value || 0;
        const prevValue = currentIndex > 0 ? (data[currentIndex - 1]?.[entry.dataKey] || 0) : null;
        
        let changePercent = null;
        let changeDirection = null;
        if (prevValue !== null && prevValue !== 0) {
          changePercent = ((currentValue - prevValue) / prevValue * 100).toFixed(1);
          changeDirection = changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'same';
        } else if (prevValue === 0 && currentValue > 0) {
          changePercent = '100.0';
          changeDirection = 'up';
        } else if (prevValue !== null && prevValue === 0 && currentValue === 0) {
          changePercent = '0.0';
          changeDirection = 'same';
        }

        return (
          <div key={entry.dataKey} className="flex flex-col gap-0.5 mb-1.5 last:mb-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>{entry.name}</span>
              </div>
              <span className={`text-sm font-bold ${isDark ? 'text-gray-100' : 'text-gray-800 dark:text-gray-100'}`}>
                {yAxisUnit === '₱' ? `₱${currentValue.toLocaleString()}` : `${currentValue.toLocaleString()}${yAxisUnit ? ` ${yAxisUnit}` : ''}`}
              </span>
            </div>
            {changePercent !== null && (
              <div className="flex items-center justify-end gap-1">
                {changeDirection === 'up' && (
                  <span className="text-[11px] font-medium text-green-600 dark:text-green-400 flex items-center gap-0.5">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2L8 6H2L5 2Z" fill="currentColor"/></svg>
                    +{changePercent}%
                  </span>
                )}
                {changeDirection === 'down' && (
                  <span className="text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center gap-0.5">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 8L2 4H8L5 8Z" fill="currentColor"/></svg>
                    {changePercent}%
                  </span>
                )}
                {changeDirection === 'same' && (
                  <span className="text-[11px] font-medium text-gray-400">0.0%</span>
                )}
                <span className={`text-[10px] ${isDark ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400'}`}>vs prev</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const LineChart = ({ 
  title, 
  subtitle,
  data, 
  lines = [],
  xAxisKey = 'name',
  height = 300,
  showLegend = true,
  tabs = null,
  activeTab = null,
  onTabChange = null,
  headerRight = null,
  summaryStats = null,
  areaChart = false,
  yAxisUnit = 'kg',
  onDotClick = null,
  activePoint = null,
}) => {
  // Get theme colors from CSS variables
  const [themeColors, setThemeColors] = useState(['#84cc16', '#eab308', '#22c55e', '#3b82f6', '#f97316']);
  const [hiddenLines, setHiddenLines] = useState([]);
  const isDark = useIsDarkMode();
  
  useEffect(() => {
    const updateColors = () => {
      const primary500 = getCSSVariable('--color-primary-500') || '#84cc16';
      const primary400 = getCSSVariable('--color-primary-400') || '#a3e635';
      const primary600 = getCSSVariable('--color-primary-600') || '#65a30d';
      const button500 = getCSSVariable('--color-button-500') || '#22c55e';
      const button400 = getCSSVariable('--color-button-400') || '#4ade80';
      setThemeColors([primary500, button500, primary400, primary600, button400]);
    };
    
    updateColors();
    // Listen for theme changes
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    
    return () => observer.disconnect();
  }, []);

  const ChartComponent = areaChart ? AreaChart : RechartsLineChart;

  // Y-axis formatter
  const formatYAxis = useCallback((value) => {
    if (yAxisUnit === '₱') return `₱${value.toLocaleString()}`;
    return yAxisUnit ? `${value} ${yAxisUnit}` : value.toLocaleString();
  }, [yAxisUnit]);

  return (
    <div className="bg-gradient-to-br from-primary-50 via-primary-100/30 to-primary-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 rounded-xl border-2 border-primary-400 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 outline-none [&_*]:outline-none p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        
        {/* Tabs */}
        {tabs && !headerRight && (
          <div className="flex bg-white dark:bg-gray-700 rounded-lg p-1 shadow-sm border border-primary-200 dark:border-primary-700">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onTabChange?.(tab.value)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  activeTab === tab.value
                    ? 'bg-button-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 dark:text-gray-100 dark:hover:text-button-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        {headerRight && headerRight}
      </div>

      {/* Legend - clickable to toggle visibility */}
      {showLegend && lines.length > 0 && (
        <div className="flex items-center justify-center gap-6 mb-4">
          {lines.map((line, index) => {
            const isHidden = hiddenLines.includes(line.dataKey);
            return (
              <button
                key={line.dataKey}
                onClick={() => setHiddenLines(prev => 
                  prev.includes(line.dataKey) 
                    ? prev.filter(k => k !== line.dataKey) 
                    : prev.length >= lines.length - 1 ? prev : [...prev, line.dataKey]
                )}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 cursor-pointer select-none ${isHidden ? 'opacity-40' : ''}`}
              >
                <div 
                  className="w-8 h-3 rounded"
                  style={{ backgroundColor: line.color || themeColors[index % themeColors.length], opacity: isHidden ? 0.3 : 1 }}
                />
                <span className={`text-sm ${isHidden ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-gray-300'}`}>{line.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          onClick={onDotClick ? (e) => {
            if (e && e.activeLabel) {
              onDotClick(activePoint === e.activeLabel ? null : e.activeLabel);
            }
          } : undefined}
          style={onDotClick ? { cursor: 'pointer' } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#475569' : '#e5e7eb'} />
          <XAxis 
            dataKey={xAxisKey} 
            tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#6b7280' }}
            axisLine={{ stroke: isDark ? '#64748b' : '#d1d5db' }}
            tickLine={{ stroke: isDark ? '#64748b' : '#d1d5db' }}
          />
          <YAxis 
            tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#6b7280' }}
            axisLine={{ stroke: isDark ? '#64748b' : '#d1d5db' }}
            tickLine={{ stroke: isDark ? '#64748b' : '#d1d5db' }}
            tickFormatter={formatYAxis}
          />
          <Tooltip 
            content={<CustomTooltip data={data} lines={lines.filter(l => !hiddenLines.includes(l.dataKey))} themeColors={themeColors} yAxisUnit={yAxisUnit} isDark={isDark} />}
          />
          {lines.map((line, index) => {
            if (hiddenLines.includes(line.dataKey)) return null;
            const color = line.color || themeColors[index % themeColors.length];
            const renderDot = activePoint ? (props) => {
              const { cx, cy, payload } = props;
              const isActive = payload[xAxisKey] === activePoint;
              return (
                <circle key={`dot-${props.index}`} cx={cx} cy={cy} r={isActive ? 6 : 3} fill={isActive ? color : color} stroke={isActive ? '#fff' : 'none'} strokeWidth={isActive ? 2 : 0} opacity={isActive ? 1 : 0.4} />
              );
            } : { fill: color, strokeWidth: 0, r: 3 };
            return areaChart ? (
              <Area
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={color}
                fill={color}
                fillOpacity={0.1}
                strokeWidth={2}
                strokeDasharray={line.dashed ? '5 5' : undefined}
                dot={renderDot}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
              />
            ) : (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={line.dashed ? '5 5' : undefined}
                dot={renderDot}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>

      {/* Summary Stats */}
      {summaryStats && (
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-primary-200 dark:border-primary-700">
          {summaryStats.map((stat, index) => (
            <div key={index} className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
              <p className={`text-lg font-bold ${stat.color || 'text-primary-600 dark:text-primary-400'}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LineChart;
