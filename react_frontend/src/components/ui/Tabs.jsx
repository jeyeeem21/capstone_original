import { useState } from 'react';

const Tabs = ({ tabs, defaultTab = 0, onChange }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabChange = (index) => {
    setActiveTab(index);
    onChange?.(index);
  };

  return (
    <div>
      {/* Tab Headers */}
      <div className="flex border-b-2 border-primary-200 dark:border-primary-700 mb-6">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => handleTabChange(index)}
            className={`px-6 py-3 text-sm font-semibold transition-all relative
              ${activeTab === index 
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 -mb-[2px] bg-primary-50 dark:bg-primary-900/20' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }
            `}
          >
            <div className="flex items-center gap-2">
              {tab.icon && <tab.icon size={16} />}
              {tab.label}
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {tabs[activeTab]?.content}
      </div>
    </div>
  );
};

export default Tabs;