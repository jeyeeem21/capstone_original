import { useState, useEffect } from 'react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

const BarChart = ({ 
  title, 
  subtitle,
  data, 
  bars = [],
  xAxisKey = 'name',
  height = 300,
  showLegend = true,
  layout = 'vertical' // 'vertical' or 'horizontal'
}) => {
  // Get theme colors from CSS variables
  const [themeColors, setThemeColors] = useState(['#84cc16', '#eab308', '#22c55e', '#3b82f6', '#f97316']);
  const [hiddenBars, setHiddenBars] = useState([]);
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
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-gradient-to-br from-primary-50 via-primary-100/30 to-primary-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 rounded-xl border-2 border-primary-400 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 outline-none [&_*]:outline-none p-4">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>

      {/* Clickable Legend */}
      {showLegend && bars.length > 1 && (
        <div className="flex items-center justify-center gap-6 mb-4">
          {bars.map((bar, index) => {
            const isHidden = hiddenBars.includes(bar.dataKey);
            const color = bar.color || themeColors[index % themeColors.length];
            return (
              <button
                key={bar.dataKey}
                onClick={() => setHiddenBars(prev =>
                  prev.includes(bar.dataKey)
                    ? prev.filter(k => k !== bar.dataKey)
                    : prev.length >= bars.length - 1 ? prev : [...prev, bar.dataKey]
                )}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 cursor-pointer select-none ${isHidden ? 'opacity-40' : ''}`}
              >
                <div className="w-8 h-3 rounded" style={{ backgroundColor: color, opacity: isHidden ? 0.3 : 1 }} />
                <span className={`text-sm ${isHidden ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-gray-300'}`}>{bar.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart 
          data={data} 
          layout={layout}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#475569' : '#e5e7eb'} />
          {layout === 'horizontal' ? (
            <>
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#6b7280' }} />
            </>
          ) : (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#6b7280' }} />
              <YAxis dataKey={xAxisKey} type="category" tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#6b7280' }} width={80} />
            </>
          )}
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDark ? '#1e293b' : 'white', 
              border: `1px solid ${isDark ? '#475569' : '#e5e7eb'}`,
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              color: isDark ? '#f1f5f9' : undefined
            }}
            itemStyle={{ color: isDark ? '#cbd5e1' : undefined }}
            labelStyle={{ color: isDark ? '#f1f5f9' : undefined }}
          />
          {bars.map((bar, index) => {
            if (hiddenBars.includes(bar.dataKey)) return null;
            return (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                name={bar.name}
                fill={bar.color || themeColors[index % themeColors.length]}
                radius={[4, 4, 4, 4]}
              />
            );
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChart;
