import { Filter, Calendar, ChevronDown } from 'lucide-react';
import { useState } from 'react';

const DateFilter = ({ onChange, showCustom = true }) => {
  const [period, setPeriod] = useState('daily');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customDates, setCustomDates] = useState({ start: '', end: '' });

  const periods = [
    { value: 'daily', label: 'Daily' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  const handlePeriodChange = (value) => {
    setPeriod(value);
    setShowCustomDates(false);
    onChange?.({ type: value });
  };

  const handleCustomDateChange = (field, value) => {
    const newDates = { ...customDates, [field]: value };
    setCustomDates(newDates);
    if (newDates.start && newDates.end) {
      onChange?.({ type: 'custom', ...newDates });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period Buttons */}
      <div className="inline-flex rounded-lg border-2 border-primary-200 dark:border-primary-700 p-1 bg-primary-50 dark:bg-primary-900/20">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePeriodChange(p.value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all
              ${period === p.value && !showCustomDates
                ? 'bg-button-500 text-white shadow-sm' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 dark:text-gray-100 hover:bg-white dark:bg-gray-700'
              }
            `}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom Date Toggle */}
      {showCustom && (
        <>
          <button
            onClick={() => setShowCustomDates(!showCustomDates)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all
              ${showCustomDates 
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
                : 'border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20'
              }
            `}
          >
            <Calendar size={16} />
            Custom Date
          </button>

          {/* Custom Date Inputs */}
          {showCustomDates && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customDates.start}
                onChange={(e) => handleCustomDateChange('start', e.target.value)}
                className="px-3 py-2 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customDates.end}
                onChange={(e) => handleCustomDateChange('end', e.target.value)}
                className="px-3 py-2 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DateFilter;