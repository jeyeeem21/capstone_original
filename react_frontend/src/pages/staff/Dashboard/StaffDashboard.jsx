import { useState, useEffect } from 'react';
import { LayoutDashboard, Package, AlertTriangle, Clock, ShoppingCart, TrendingUp, Bell, CheckCircle } from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { DataTable, StatusBadge, StatsCard, DonutChart } from '../../../components/ui';

// Helper to get CSS variable value
const getCSSVariable = (name) => {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

const StaffDashboard = () => {
  const [themeColors, setThemeColors] = useState({
    primary: '#22c55e',
    secondary: '#eab308',
    button: '#22c55e'
  });

  // Listen for theme changes
  useEffect(() => {
    const updateColors = () => {
      setThemeColors({
        primary: getCSSVariable('--color-primary-500') || '#22c55e',
        secondary: getCSSVariable('--color-button-secondary') || '#eab308',
        button: getCSSVariable('--color-button-500') || '#22c55e'
      });
    };
    
    updateColors();
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    
    return () => observer.disconnect();
  }, []);

  // Low stock items — will connect to real API
  const lowStockItems = [];

  // Recent activities — will connect to real API
  const recentActivities = [];

  // Today's stats — will connect to real API
  const todayStats = {
    totalSales: 0,
    totalRevenue: 0,
    itemsSold: 0,
    lowStockCount: 0,
  };

  // Stock status distribution
  const stockDistribution = [];

  const lowStockColumns = [
    { 
      header: 'Product', 
      accessor: 'product',
      cell: (row) => (
        <div>
          <p className="font-medium text-gray-800 dark:text-gray-100">{row.product}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.sku}</p>
        </div>
      )
    },
    { 
      header: 'Current Stock', 
      accessor: 'currentStock',
      cell: (row) => (
        <span className={`font-semibold ${row.status === 'Critical' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
          {row.currentStock} units
        </span>
      )
    },
    { 
      header: 'Min. Required', 
      accessor: 'minStock',
      cell: (row) => <span className="text-gray-600 dark:text-gray-300">{row.minStock} units</span>
    },
    { 
      header: 'Status', 
      accessor: 'status', 
      cell: (row) => (
        <StatusBadge 
          status={row.status} 
          customColors={{
            Critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
            Low: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
          }}
        />
      )
    },
  ];

  const getActivityIcon = (type) => {
    switch (type) {
      case 'sale': return <ShoppingCart size={16} className="text-green-500" />;
      case 'stock': return <Package size={16} className="text-blue-500" />;
      case 'order': return <CheckCircle size={16} className="text-purple-500" />;
      case 'alert': return <AlertTriangle size={16} className="text-red-500" />;
      default: return <Bell size={16} className="text-gray-500 dark:text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Secretary Dashboard" 
        description="Quick overview of today's activities and alerts"
        icon={LayoutDashboard}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          label="Today's Sales" 
          value={todayStats.totalSales} 
          unit="transactions" 
          icon={ShoppingCart}
          iconBgColor="bg-gradient-to-br from-button-400 to-button-600"
        />
        <StatsCard 
          label="Revenue Today" 
          value={`₱${todayStats.totalRevenue.toLocaleString()}`} 
          unit="" 
          icon={TrendingUp}
          iconBgColor="bg-gradient-to-br from-green-400 to-green-600"
        />
        <StatsCard 
          label="Items Sold" 
          value={todayStats.itemsSold} 
          unit="units" 
          icon={Package}
          iconBgColor="bg-gradient-to-br from-blue-400 to-blue-600"
        />
        <StatsCard 
          label="Critical Stock" 
          value={todayStats.lowStockCount} 
          unit="items" 
          icon={AlertTriangle}
          iconBgColor="bg-gradient-to-br from-red-400 to-red-600"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Alerts - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-200 dark:border-primary-700 shadow-sm">
            <div className="px-5 py-4 border-b border-primary-100 dark:border-primary-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">Low Stock Alerts</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Items requiring immediate attention</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm font-medium rounded-full">
                {lowStockItems.length} items
              </span>
            </div>
            <div className="p-4">
              <DataTable
                columns={lowStockColumns}
                data={lowStockItems}
                pageSize={5}
                searchable={false}
                selectable={false}
              />
            </div>
          </div>
        </div>

        {/* Stock Distribution Chart */}
        <div>
          <DonutChart
            title="Stock Status"
            subtitle="Inventory health overview"
            data={stockDistribution}
            centerValue={`${stockDistribution.reduce((sum, d) => sum + d.value, 0)}`}
            centerLabel="Total Products"
            height={200}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-200 dark:border-primary-700 shadow-sm">
        <div className="px-5 py-4 border-b border-primary-100 dark:border-primary-800 flex items-center gap-3">
          <div className="p-2 bg-button-100 dark:bg-button-900/30 rounded-lg">
            <Clock size={20} className="text-button-600 dark:text-button-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Recent Activity</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your latest actions and updates</p>
          </div>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {recentActivities.map((activity) => (
              <div 
                key={activity.id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 dark:text-gray-100">{activity.action}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{activity.description}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-br from-button-50 dark:from-gray-700 to-button-100 dark:to-gray-800 rounded-xl border-2 border-button-200 dark:border-button-700 p-6">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a 
            href="/secretary/pos" 
            className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-xl border border-button-200 dark:border-button-700 hover:border-button-400 hover:shadow-md transition-all"
          >
            <div className="p-3 bg-button-500 rounded-xl">
              <ShoppingCart size={24} className="text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Open POS</span>
          </a>
          <a 
            href="/secretary/profile" 
            className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-xl border border-button-200 dark:border-button-700 hover:border-button-400 hover:shadow-md transition-all"
          >
            <div className="p-3 bg-blue-500 rounded-xl">
              <LayoutDashboard size={24} className="text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">My Profile</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
