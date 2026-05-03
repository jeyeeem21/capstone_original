import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard, DollarSign, ShoppingCart, Users, Package,
  TrendingUp, AlertTriangle, RefreshCw, Activity,
  Truck, Settings2, Droplets, ArrowRight, Clock,
  ShoppingBag, Layers, X, Filter
} from 'lucide-react';
import { PageHeader } from '../../../components/common';
import {
  StatsCard, LineChart, DonutChart, BarChart, DataTable, StatusBadge,
  Skeleton, SkeletonStats, SkeletonTable
} from '../../../components/ui';
import { dashboardApi } from '../../../api';
import { useAuth } from '../../../context/AuthContext';

// Helper to get CSS variable value
const getCSSVariable = (name) => {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

const Dashboard = () => {
  const { basePath } = useAuth();
  const [period, setPeriod] = useState('monthly');
  const [activeChartPoint, setActiveChartPoint] = useState(null);
  const [chartMonth, setChartMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [chartYear, setChartYear] = useState(() => new Date().getFullYear());
  const [chartYearFrom, setChartYearFrom] = useState(() => new Date().getFullYear() - 4);
  const [chartYearTo, setChartYearTo] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
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

  // Build chart params from state
  const chartParams = useMemo(() => {
    const params = {};
    if (period === 'daily' || period === 'weekly') params.month = chartMonth;
    if (period === 'monthly' || period === 'bi-annually') params.year = chartYear;
    if (period === 'annually') { params.yearFrom = chartYearFrom; params.yearTo = chartYearTo; }
    if (activeChartPoint) params.point = activeChartPoint;
    return params;
  }, [period, chartMonth, chartYear, chartYearFrom, chartYearTo, activeChartPoint]);

  // Fetch dashboard data
  const fetchData = useCallback(async (selectedPeriod, selectedChartParams = {}) => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        dashboardApi.getStats(selectedPeriod, selectedChartParams),
        dashboardApi.getRecentActivity(15),
      ]);
      setStats(statsRes?.data || statsRes);
      setActivity(activityRes?.data || activityRes || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!stats) setLoading(true); // Only show skeletons on first load
    fetchData(period, chartParams);
  }, [period, chartParams, fetchData]);

  // Refresh when tab becomes visible again (instead of constant polling)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData(period, chartParams);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [period, chartParams, fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await dashboardApi.refresh();
    } catch (_) { /* ignore */ }
    fetchData(period, chartParams);
  };

  // Derived data
  const overview = stats?.overview || {};
  const revenueChart = stats?.revenue || [];
  const processingData = stats?.processing || {};
  const processingChart = processingData?.chart || [];
  const procurement = stats?.procurement || {};
  const inventory = stats?.inventory || {};
  const topProducts = stats?.top_products || [];
  const recentSales = stats?.recent_sales || [];
  const lowStock = stats?.low_stock || [];
  const paymentBreakdown = stats?.payment_breakdown || [];
  const statusBreakdown = stats?.status_breakdown || [];
  const pipeline = stats?.pipeline || {};
  const pointLabel = stats?.point_label || activeChartPoint;

  // Clear all chart filters
  const clearChartFilter = () => {
    setActiveChartPoint(null);
    setPeriod('monthly');
    const d = new Date();
    setChartMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    setChartYear(d.getFullYear());
    setChartYearFrom(d.getFullYear() - 4);
    setChartYearTo(d.getFullYear());
  };

  // Format currency
  const fmt = (val) => `₱${Number(val || 0).toLocaleString()}`;

  // Pipeline items for the flow bar
  const pipelineItems = useMemo(() => [
    { label: 'Procurement', count: pipeline.procurement_pending || 0, icon: ShoppingCart, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', path: `${basePath}/procurement` },
    { label: 'Drying', count: pipeline.drying_active || 0, icon: Droplets, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', path: `${basePath}/drying` },
    { label: 'Processing', count: pipeline.processing_active || 0, icon: Settings2, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', path: `${basePath}/processing` },
    { label: 'Orders', count: pipeline.orders_pending || 0, icon: ShoppingBag, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', path: `${basePath}/orders` },
    { label: 'Shipped', count: pipeline.shipped || 0, icon: Truck, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', path: `${basePath}/orders` },
  ], [pipeline, basePath]);

  // Top products bar chart data
  const topProductsBarData = useMemo(() =>
    topProducts.map(p => ({
      name: p.product_name?.length > 12 ? p.product_name.slice(0, 12) + '…' : p.product_name,
      revenue: p.total_revenue,
      quantity: p.total_qty,
    })),
    [topProducts]
  );

  // Inventory health donut
  const inventoryDonut = useMemo(() => [
    { name: 'Healthy', value: inventory.healthy || 0, color: '#22c55e' },
    { name: 'Low Stock', value: inventory.low_stock || 0, color: '#f59e0b' },
    { name: 'Out of Stock', value: inventory.out_of_stock || 0, color: '#ef4444' },
  ], [inventory]);

  // Recent sales columns
  const recentSalesColumns = [
    { header: 'Transaction', accessor: 'transaction_id' },
    { header: 'Customer', accessor: 'customer' },
    { header: 'Amount', accessor: 'total', cell: (row) => fmt(row.total) },
    { header: 'Payment', accessor: 'payment_method' },
    { header: 'Date', accessor: 'date' },
    { header: 'Status', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
  ];

  // Low stock columns
  const lowStockColumns = [
    {
      header: 'Product', accessor: 'product_name', cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: row.variety_color }} />
          <span>{row.product_name}</span>
        </div>
      )
    },
    { header: 'Variety', accessor: 'variety' },
    { header: 'Stock', accessor: 'stocks', cell: (row) => (
      <span className={`font-bold ${row.stocks <= 0 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
        {row.stocks}
      </span>
    )},
    { header: 'Floor', accessor: 'stock_floor' },
    { header: 'Status', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
  ];

  // Activity icon map
  const getActivityIcon = (action) => {
    switch (action) {
      case 'CREATE': return <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 dark:bg-green-500/20 flex items-center justify-center"><TrendingUp size={13} className="text-green-600 dark:text-green-400" /></div>;
      case 'UPDATE': return <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 dark:bg-blue-500/20 flex items-center justify-center"><Activity size={13} className="text-blue-600 dark:text-blue-400" /></div>;
      case 'DELETE': return <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 dark:bg-red-500/20 flex items-center justify-center"><AlertTriangle size={13} className="text-red-600 dark:text-red-400" /></div>;
      case 'ARCHIVE': return <div className="w-7 h-7 rounded-full bg-yellow-100 dark:bg-yellow-900/30 dark:bg-yellow-500/20 flex items-center justify-center"><AlertTriangle size={13} className="text-yellow-600 dark:text-yellow-400" /></div>;
      case 'RESTORE': return <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 dark:bg-emerald-500/20 flex items-center justify-center"><TrendingUp size={13} className="text-emerald-600 dark:text-emerald-400" /></div>;
      case 'SOFT_DELETE': case 'SOFT_DELETE_ALL': return <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 dark:bg-orange-500/20 flex items-center justify-center"><AlertTriangle size={13} className="text-orange-600 dark:text-orange-400" /></div>;
      case 'RETURN': return <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/30 dark:bg-teal-500/20 flex items-center justify-center"><Activity size={13} className="text-teal-600 dark:text-teal-400" /></div>;
      default: return <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Clock size={13} className="text-gray-600 dark:text-gray-400" /></div>;
    }
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your business performance"
        icon={LayoutDashboard}
      />

      {/* Refresh Button */}
      <div className="flex justify-end mb-4 -mt-2">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-button-600 dark:hover:text-button-400 dark:text-button-400 bg-white dark:bg-gray-700 border border-primary-200 dark:border-primary-700 rounded-lg hover:border-button-300 dark:border-button-700 transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ==================== FILTER INDICATOR (sticky) ==================== */}
      {activeChartPoint && (
        <div className="sticky top-0 z-30 mb-4">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl shadow-sm">
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                Filtered: <span className="text-blue-900 dark:text-blue-100">{pointLabel}</span>
              </span>
              <span className="text-xs text-blue-500 dark:text-blue-400">
                — Cards, tables & charts below reflect this selection
              </span>
            </div>
            <button
              onClick={clearChartFilter}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <X size={14} />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ==================== STATS CARDS ==================== */}
      {loading ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            label="Revenue"
            value={fmt(overview.total_revenue)}
            unit={overview.period_label || 'all time'}
            icon={DollarSign}
            iconBgColor="bg-gradient-to-br from-button-400 to-button-600"
            trend={overview.revenue_trend}
            trendLabel={overview.trend_label || 'vs prev period'}
          />
          <StatsCard
            label="Orders"
            value={overview.total_orders || 0}
            unit={overview.period_label || 'completed'}
            icon={ShoppingBag}
            iconBgColor="bg-gradient-to-br from-green-400 to-green-600"
            trend={overview.orders_trend}
            trendLabel={overview.trend_label || 'vs prev period'}
          />
          <StatsCard
            label="Customers"
            value={overview.total_customers || 0}
            unit={`+${overview.new_customers || 0} in ${overview.period_label || 'period'}`}
            icon={Users}
            iconBgColor="bg-gradient-to-br from-blue-400 to-blue-600"
            trend={overview.customers_trend}
            trendLabel={overview.trend_label || 'vs prev period'}
          />
          <StatsCard
            label="Products"
            value={overview.active_products || 0}
            unit={`${overview.total_stock?.toLocaleString() || 0} units in stock`}
            icon={Package}
            iconBgColor="bg-gradient-to-br from-purple-400 to-purple-600"
          />
        </div>
      )}

      {/* ==================== PIPELINE FLOW ==================== */}
      {loading ? (
        <div className="mb-6 p-4 bg-white dark:bg-gray-700 rounded-xl border border-primary-100 dark:border-primary-700">
          <Skeleton variant="title" width="w-40" className="mb-4" />
          <div className="flex items-center gap-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} variant="custom" className="h-16 flex-1 rounded-lg" />)}
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30">
          <h3 className="text-sm font-bold text-content mb-3 flex items-center gap-2">
            <Layers size={15} className="text-button-500" />
            Active Pipeline
          </h3>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {pipelineItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center flex-1 min-w-0">
                  <a href={item.path} className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${item.bg} hover:shadow-sm transition-all group`}>
                    <Icon size={16} className={item.color} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-secondary truncate">{item.label}</p>
                      <p className={`text-lg font-bold ${item.color} leading-tight`}>{item.count}</p>
                    </div>
                  </a>
                  {idx < pipelineItems.length - 1 && (
                    <ArrowRight size={14} className="text-gray-300 mx-1 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== REVENUE & PAYMENT CHARTS ==================== */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 p-4 bg-white dark:bg-gray-700 rounded-xl border border-primary-100 dark:border-primary-700">
            <Skeleton variant="title" width="w-32" className="mb-4" />
            <Skeleton variant="custom" className="h-[280px] w-full rounded-lg" />
          </div>
          <div className="p-4 bg-white dark:bg-gray-700 rounded-xl border border-primary-100 dark:border-primary-700">
            <Skeleton variant="title" width="w-24" className="mb-4" />
            <div className="flex items-center justify-center py-4">
              <Skeleton variant="circle" width="w-[180px]" height="h-[180px]" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2">
            <LineChart
              title="Revenue Trends"
              subtitle={(() => {
                const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                let scope = '';
                if (period === 'daily' || period === 'weekly') { const [y,m] = chartMonth.split('-').map(Number); scope = `${months[m-1]} ${y}`; }
                else if (period === 'monthly' || period === 'bi-annually') scope = String(chartYear);
                else if (period === 'annually') scope = `${chartYearFrom}–${chartYearTo}`;
                const mode = period.charAt(0).toUpperCase() + period.slice(1);
                if (activeChartPoint) return `${activeChartPoint} · ${scope}`;
                return `${mode} · ${scope}`;
              })()}
              data={revenueChart}
              lines={[
                { dataKey: 'revenue', name: 'Revenue (₱)' },
                { dataKey: 'orders', name: 'Orders', color: themeColors.secondary, dashed: true },
              ]}
              height={280}
              yAxisUnit="₱"
              headerRight={
                <div className="flex items-center gap-2 flex-wrap">
                  {(activeChartPoint || period !== 'monthly' || chartYear !== new Date().getFullYear()) && (
                    <button
                      onClick={clearChartFilter}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      title="Clear chart filter"
                    >
                      <X size={14} />
                      Clear Filter
                    </button>
                  )}
                  <select
                    value={period}
                    onChange={(e) => { setPeriod(e.target.value); setActiveChartPoint(null); }}
                    className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="bi-annually">Bi-Annually</option>
                    <option value="annually">Annually</option>
                  </select>
                  {period === 'daily' && (
                    <input type="month" value={chartMonth} onChange={(e) => { setChartMonth(e.target.value); setActiveChartPoint(null); }}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  )}
                  {period === 'weekly' && (
                    <input type="month" value={chartMonth} onChange={(e) => { setChartMonth(e.target.value); setActiveChartPoint(null); }}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  )}
                  {period === 'monthly' && (
                    <input type="number" value={chartYear} onChange={(e) => { setChartYear(parseInt(e.target.value) || new Date().getFullYear()); setActiveChartPoint(null); }}
                      min="2000" max={new Date().getFullYear()}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-24" />
                  )}
                  {period === 'bi-annually' && (
                    <input type="number" value={chartYear} onChange={(e) => { setChartYear(parseInt(e.target.value) || new Date().getFullYear()); setActiveChartPoint(null); }}
                      min="2000" max={new Date().getFullYear()}
                      className="px-3 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-24" />
                  )}
                  {period === 'annually' && (
                    <div className="flex items-center gap-1">
                      <input type="number" value={chartYearFrom} onChange={(e) => { const v = parseInt(e.target.value) || 2000; setChartYearFrom(v); setActiveChartPoint(null); }}
                        min="2000" max={chartYearTo}
                        className="px-2 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-20" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">to</span>
                      <input type="number" value={chartYearTo} onChange={(e) => { const v = parseInt(e.target.value) || new Date().getFullYear(); setChartYearTo(v); setActiveChartPoint(null); }}
                        min={chartYearFrom} max={new Date().getFullYear()}
                        className="px-2 py-1.5 text-sm font-medium border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-20" />
                    </div>
                  )}
                </div>
              }
              onDotClick={(point) => setActiveChartPoint(prev => prev === point ? null : point)}
              activePoint={activeChartPoint}
              summaryStats={[
                { label: activeChartPoint ? 'Filtered Revenue' : 'Period Revenue', value: fmt(overview.total_revenue), color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Avg Order', value: fmt(overview.avg_order_value), color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Items Sold', value: (overview.total_items_sold || 0).toLocaleString(), color: 'text-green-600 dark:text-green-400' },
              ]}
            />
          </div>
          <div className="space-y-4">
            <DonutChart
              title="Payment Methods"
              subtitle={activeChartPoint ? `Filtered: ${pointLabel}` : 'Breakdown by type'}
              data={paymentBreakdown}
              centerValue={paymentBreakdown.reduce((s, p) => s + p.value, 0)}
              centerLabel="Orders"
              height={160}
              innerRadius={50}
              outerRadius={72}
              valueUnit=""
              horizontalLegend={true}
              compactLegend={true}
            />
            <DonutChart
              title="Order Status"
              subtitle={activeChartPoint ? `Filtered: ${pointLabel}` : 'All order outcomes'}
              data={statusBreakdown}
              centerValue={statusBreakdown.reduce((s, p) => s + p.value, 0)}
              centerLabel="Total"
              height={140}
              innerRadius={45}
              outerRadius={62}
              valueUnit=""
              horizontalLegend={true}
              compactLegend={true}
            />
          </div>
        </div>
      )}

      {/* ==================== PROCESSING & INVENTORY ==================== */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 p-4 bg-white dark:bg-gray-700 rounded-xl border border-primary-100 dark:border-primary-700">
            <Skeleton variant="title" width="w-32" className="mb-4" />
            <Skeleton variant="custom" className="h-[260px] w-full rounded-lg" />
          </div>
          <div className="p-4 bg-white dark:bg-gray-700 rounded-xl border border-primary-100 dark:border-primary-700">
            <Skeleton variant="title" width="w-24" className="mb-4" />
            <div className="flex items-center justify-center py-4">
              <Skeleton variant="circle" width="w-[160px]" height="h-[160px]" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2">
            <LineChart
              title="Processing Trends"
              subtitle="Milling input vs output performance"
              data={processingChart}
              lines={[
                { dataKey: 'input', name: 'Input (kg)', color: themeColors.secondary, dashed: true },
                { dataKey: 'output', name: 'Output (kg)', color: themeColors.button },
              ]}
              height={260}
              yAxisUnit="kg"
              summaryStats={[
                { label: 'Total Input', value: `${(processingData.total_input || 0).toLocaleString()} kg`, color: 'text-yellow-600 dark:text-yellow-400' },
                { label: 'Total Output', value: `${(processingData.total_output || 0).toLocaleString()} kg`, color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Avg Yield', value: `${processingData.avg_yield || 0}%`, color: 'text-green-600 dark:text-green-400' },
              ]}
            />
          </div>
          <div className="space-y-4">
            <DonutChart
              title="Inventory Health"
              subtitle="Stock level distribution"
              data={inventoryDonut}
              centerValue={inventory.total_products || 0}
              centerLabel="Products"
              height={160}
              innerRadius={50}
              outerRadius={72}
              valueUnit=""
              horizontalLegend={true}
              compactLegend={true}
            />
            {/* Procurement summary card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 p-4">
              <h3 className="text-sm font-bold text-content mb-3 flex items-center gap-2">
                <ShoppingCart size={15} className="text-button-500" />
                Procurement
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-secondary">Total Sacks</span>
                  <span className="text-sm font-bold text-content">{(procurement.total_sacks || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-secondary">Total Quantity</span>
                  <span className="text-sm font-bold text-content">{(procurement.total_kg || 0).toLocaleString()} kg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-secondary">Total Cost</span>
                  <span className="text-sm font-bold text-content">{fmt(procurement.total_cost)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-secondary">Active Suppliers</span>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">{procurement.active_suppliers || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-secondary">Pending</span>
                  <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{procurement.pending || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TOP PRODUCTS BAR CHART ==================== */}
      {!loading && topProducts.length > 0 && (
        <div className="mb-6">
          <BarChart
            title="Top Selling Products"
            subtitle={activeChartPoint ? `Filtered: ${pointLabel}` : 'Best performers by revenue'}
            data={topProductsBarData}
            bars={[
              { dataKey: 'revenue', name: 'Revenue (₱)', color: themeColors.button },
              { dataKey: 'quantity', name: 'Qty Sold', color: themeColors.secondary },
            ]}
            height={280}
          />
        </div>
      )}

      {/* ==================== RECENT SALES (full width, first) ==================== */}
      {loading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : (
        <div className="mb-6">
          <DataTable
            title="Recent Sales"
            subtitle={activeChartPoint ? `Filtered: ${pointLabel}` : 'Latest transactions'}
            columns={recentSalesColumns}
            data={recentSales}
            searchable={false}
            pagination={activeChartPoint ? true : false}
            defaultItemsPerPage={activeChartPoint ? 10 : 8}
          />
        </div>
      )}

      {/* ==================== RECENT ACTIVITY + LOW STOCK (side by side) ==================== */}
      {loading ? (
        <SkeletonTable rows={5} columns={4} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Recent Activity */}
          {activity.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 p-4">
              <h3 className="text-sm font-bold text-content mb-4 flex items-center gap-2">
                <Activity size={15} className="text-button-500" />
                Recent Activity
              </h3>
              <div className="space-y-0 max-h-[340px] overflow-y-auto pr-1">
                {activity.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    {getActivityIcon(item.action)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-content truncate">{item.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-secondary">{item.user}</span>
                        <span className="text-[10px] text-gray-300">•</span>
                        <span className="text-[10px] text-secondary">{item.module}</span>
                        <span className="text-[10px] text-gray-300">•</span>
                        <span className="text-[10px] text-secondary">{item.time}</span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.action === 'CREATE' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                      item.action === 'UPDATE' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                      item.action === 'DELETE' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                      item.action === 'ARCHIVE' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                      item.action === 'RESTORE' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                      (item.action === 'SOFT_DELETE' || item.action === 'SOFT_DELETE_ALL') ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' :
                      item.action === 'RETURN' ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {item.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low Stock Alerts */}
          <div>
            {lowStock.length > 0 ? (
              <DataTable
                title="Low Stock Alerts"
                subtitle="Products needing restocking"
                columns={lowStockColumns}
                data={lowStock}
                searchable={false}
                pagination={false}
                defaultItemsPerPage={5}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 p-6">
                <h3 className="text-sm font-bold text-content mb-2 flex items-center gap-2">
                  <AlertTriangle size={15} className="text-button-500" />
                  Low Stock Alerts
                </h3>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 dark:bg-green-500/20 flex items-center justify-center mb-3">
                    <Package size={20} className="text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm font-medium text-content">All products are well-stocked!</p>
                  <p className="text-xs text-secondary mt-1">No products below their stock floor</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
