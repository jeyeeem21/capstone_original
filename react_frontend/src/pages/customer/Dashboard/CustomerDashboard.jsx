import { useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package, ClipboardList, TrendingUp, ShoppingCart,
  ArrowRight, Clock, CheckCircle, Truck, XCircle,
  ChevronRight, Eye, Settings, RotateCcw
} from 'lucide-react';
import { LineChart, DonutChart, Skeleton } from '../../../components/ui';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useDataFetch } from '../../../hooks';

const PESO = '\u20B1';

const statusConfig = {
  'pending':    { label: 'Pending',    icon: Clock,       badgeClass: 'bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400', iconBgClass: 'bg-yellow-50 dark:bg-yellow-900/30', iconColorClass: 'text-yellow-600 dark:text-yellow-400' },
  'processing': { label: 'Processing', icon: Package,     badgeClass: 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400',         iconBgClass: 'bg-blue-50 dark:bg-blue-900/30',   iconColorClass: 'text-blue-600 dark:text-blue-400' },
  'shipped':    { label: 'Shipped',    icon: Truck,       badgeClass: 'bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400', iconBgClass: 'bg-purple-50 dark:bg-purple-900/30', iconColorClass: 'text-purple-600 dark:text-purple-400' },
  'delivered':  { label: 'Delivered',  icon: CheckCircle, badgeClass: 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400',   iconBgClass: 'bg-green-50 dark:bg-green-900/30',  iconColorClass: 'text-green-600 dark:text-green-400' },
  'cancelled':  { label: 'Cancelled',  icon: XCircle,     badgeClass: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400',           iconBgClass: 'bg-red-50 dark:bg-red-900/30',    iconColorClass: 'text-red-600 dark:text-red-400' },
  'voided':     { label: 'Voided',     icon: XCircle,     badgeClass: 'bg-gray-50 dark:bg-gray-500/15 text-gray-600 dark:text-gray-400',       iconBgClass: 'bg-gray-100 dark:bg-gray-700',     iconColorClass: 'text-gray-500 dark:text-gray-400' },
  'returned':   { label: 'Returned',   icon: RotateCcw,   badgeClass: 'bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400', iconBgClass: 'bg-orange-50 dark:bg-orange-900/30', iconColorClass: 'text-orange-600 dark:text-orange-400' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const getWeeksInMonth = (year, month) => {
  const weeks = [];
  const firstDay = new Date(year, month, 1);
  let start = new Date(firstDay);
  const dayOfWeek = start.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + diff);
  while (true) {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const label = `${MONTHS[start.getMonth()]} ${start.getDate()} - ${MONTHS[end.getMonth()]} ${end.getDate()}`;
    weeks.push({ start: new Date(start), end: new Date(end), label });
    start.setDate(start.getDate() + 7);
    if (start.getMonth() > month && start.getFullYear() === year) break;
    if (start.getFullYear() > year) break;
    if (weeks.length >= 6) break;
  }
  return weeks;
};

const CustomerDashboard = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [chartPeriod, setChartPeriod] = useState('monthly');
  const [activeChartPoint, setActiveChartPoint] = useState(null);
  const [chartMonth, setChartMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [chartYear, setChartYear] = useState(() => new Date().getFullYear());
  const [chartYearFrom, setChartYearFrom] = useState(() => new Date().getFullYear() - 4);
  const [chartYearTo, setChartYearTo] = useState(() => new Date().getFullYear());

  const customerName = user?.first_name || user?.name?.split(' ')[0] || 'there';

  const { data: ordersData, loading } = useDataFetch('/sales/my-orders');
  const orders = ordersData || [];

  const stats = useMemo(() => {
    const active = ['pending', 'processing', 'shipped'];
    const totalOrders = orders.length;
    const activeOrders = orders.filter(o => active.includes((o.status || '').toLowerCase())).length;
    const totalSpent = orders
      .filter(o => !['cancelled', 'voided'].includes((o.status || '').toLowerCase()))
      .reduce((sum, o) => sum + parseFloat(o.total_amount || o.total || 0), 0);
    return { totalOrders, activeOrders, totalSpent };
  }, [orders]);

  const chartData = useMemo(() => {
    if (chartPeriod === 'daily') {
      const [y, m] = chartMonth.split('-').map(Number);
      const daysInMonth = getDaysInMonth(y, m - 1);
      const dayGroups = {};
      orders.forEach(o => {
        if (!o.created_at) return;
        const date = new Date(o.created_at);
        if (date.getFullYear() === y && date.getMonth() === m - 1) {
          const day = date.getDate();
          if (!dayGroups[day]) dayGroups[day] = 0;
          dayGroups[day] += parseFloat(o.total_amount || o.total || 0);
        }
      });
      return Array.from({ length: daysInMonth }, (_, i) => ({
        name: String(i + 1),
        value: Math.round(dayGroups[i + 1] || 0),
      }));
    }
    if (chartPeriod === 'weekly') {
      const [y, m] = chartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      return weeks.map(week => {
        let value = 0;
        orders.forEach(o => {
          if (!o.created_at) return;
          const date = new Date(o.created_at);
          const endOfDay = new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59);
          if (date >= week.start && date <= endOfDay) {
            value += parseFloat(o.total_amount || o.total || 0);
          }
        });
        return { name: week.label, value: Math.round(value) };
      });
    }
    if (chartPeriod === 'monthly') {
      const monthGroups = {};
      orders.forEach(o => {
        if (!o.created_at) return;
        const date = new Date(o.created_at);
        if (date.getFullYear() === chartYear) {
          const month = date.getMonth();
          if (!monthGroups[month]) monthGroups[month] = 0;
          monthGroups[month] += parseFloat(o.total_amount || o.total || 0);
        }
      });
      return MONTHS.map((name, i) => ({ name, value: Math.round(monthGroups[i] || 0) }));
    }
    if (chartPeriod === 'bi-annually') {
      let s1 = 0, s2 = 0;
      orders.forEach(o => {
        if (!o.created_at) return;
        const date = new Date(o.created_at);
        if (date.getFullYear() === chartYear) {
          const v = parseFloat(o.total_amount || o.total || 0);
          if (date.getMonth() < 6) s1 += v; else s2 += v;
        }
      });
      return [
        { name: 'H1', fullName: `Jan - Jun ${chartYear}`, value: Math.round(s1) },
        { name: 'H2', fullName: `Jul - Dec ${chartYear}`, value: Math.round(s2) },
      ];
    }
    // annually
    const years = [];
    for (let y = chartYearFrom; y <= chartYearTo; y++) years.push(y);
    const yearGroups = {};
    orders.forEach(o => {
      if (!o.created_at) return;
      const year = new Date(o.created_at).getFullYear();
      if (year >= chartYearFrom && year <= chartYearTo) {
        if (!yearGroups[year]) yearGroups[year] = 0;
        yearGroups[year] += parseFloat(o.total_amount || o.total || 0);
      }
    });
    return years.map(y => ({ name: y.toString(), value: Math.round(yearGroups[y] || 0) }));
  }, [orders, chartPeriod, chartMonth, chartYear, chartYearFrom, chartYearTo]);

  const matchesActivePoint = useCallback((o) => {
    if (!activeChartPoint || !o.created_at) return true;
    const date = new Date(o.created_at);
    if (chartPeriod === 'daily') {
      const [y, m] = chartMonth.split('-').map(Number);
      return date.getFullYear() === y && date.getMonth() === m - 1 && String(date.getDate()) === activeChartPoint;
    }
    if (chartPeriod === 'weekly') {
      const [y, m] = chartMonth.split('-').map(Number);
      const weeks = getWeeksInMonth(y, m - 1);
      const week = weeks.find(w => w.label === activeChartPoint);
      if (!week) return false;
      return date >= week.start && date <= new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59);
    }
    if (chartPeriod === 'monthly') {
      return date.getFullYear() === chartYear && MONTHS[date.getMonth()] === activeChartPoint;
    }
    if (chartPeriod === 'bi-annually') {
      if (activeChartPoint === 'H1') return date.getFullYear() === chartYear && date.getMonth() < 6;
      if (activeChartPoint === 'H2') return date.getFullYear() === chartYear && date.getMonth() >= 6;
    }
    if (chartPeriod === 'annually') {
      return String(date.getFullYear()) === activeChartPoint;
    }
    return true;
  }, [activeChartPoint, chartPeriod, chartMonth, chartYear]);

  const filteredOrders = useMemo(() => {
    if (!activeChartPoint) return orders;
    return orders.filter(matchesActivePoint);
  }, [orders, activeChartPoint, matchesActivePoint]);

  const orderStatusData = useMemo(() => {
    const statusColors = {
      pending: '#eab308', processing: '#3b82f6', shipped: '#8b5cf6',
      delivered: '#22c55e', cancelled: '#ef4444', voided: '#6b7280', returned: '#f97316',
    };
    const source = activeChartPoint ? filteredOrders : orders;
    const counts = {};
    source.forEach(o => {
      const s = (o.status || 'pending').toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: statusConfig[key]?.label || key,
        value,
        color: statusColors[key] || '#9ca3af',
      }));
  }, [orders, filteredOrders, activeChartPoint]);

  const recentOrders = useMemo(() => filteredOrders.slice(0, 5), [filteredOrders]);

  const avgOrderValue = stats.totalOrders > 0 ? Math.round(stats.totalSpent / stats.totalOrders) : 0;

  const summaryCards = [
    { label: 'Total Orders', value: loading ? '\u2014' : String(stats.totalOrders), icon: ClipboardList },
    { label: 'Active Orders', value: loading ? '\u2014' : String(stats.activeOrders), icon: Truck },
    {
      label: 'Total Spent',
      value: loading ? '\u2014' : `${PESO}${stats.totalSpent.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
    },
  ];

  const inputClass = "px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Banner */}
      <div
        className="rounded-2xl p-6 sm:p-8 mb-8 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${theme.button_primary}, ${theme.button_primary}cc)` }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Welcome back, {customerName}!</h1>
          <p className="text-white/80 text-sm sm:text-base max-w-lg">
            Browse our premium rice products and place your order. We deliver quality rice right to your doorstep.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Link to="/customer/products" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors backdrop-blur-sm">
              <ShoppingCart size={16} /> Proceed to Product <ArrowRight size={16} />
            </Link>
            <Link to="/customer/orders" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors backdrop-blur-sm">
              <ClipboardList size={16} /> My Orders
            </Link>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gradient-to-br from-primary-50 via-primary-100/30 to-primary-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 rounded-xl p-4 sm:p-5 border-2 border-primary-400 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30">
              <Skeleton variant="circle" width="w-10" height="h-10" className="mb-3" />
              <Skeleton variant="title" width="w-20" className="mb-1" />
              <Skeleton variant="text" width="w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {summaryCards.map((card) => (
            <div key={card.label} className="bg-gradient-to-br from-primary-50 via-primary-100/30 to-primary-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 rounded-xl p-4 sm:p-5 transition-all hover:shadow-md border-2 border-primary-400 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-100/20 to-primary-50/20 dark:from-gray-700/20 dark:to-gray-600/20 pointer-events-none" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 bg-gradient-to-br from-button-400 to-button-600 rounded-xl shadow-md">
                    <card.icon size={20} className="text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-button-600 dark:text-button-400">{card.value}</p>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts - LineChart + DonutChart */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 bg-white dark:bg-gray-700 rounded-xl border border-primary-200 dark:border-primary-700 p-6 h-[340px] animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-500 rounded w-1/4 mb-6" />
            <div className="h-[240px] bg-gray-200 dark:bg-gray-500 rounded" />
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-xl border border-primary-200 dark:border-primary-700 p-4 h-[340px] animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mb-2" />
            <div className="h-[200px] bg-gray-200 dark:bg-gray-500 rounded-full mx-auto w-[200px] mt-4" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2">
            <LineChart
              title="My Spending Trends"
              subtitle={activeChartPoint ? `Filtered: ${activeChartPoint} \u2014 click dot again to clear` : 'Your purchase activity overview'}
              data={chartData}
              lines={[{ dataKey: 'value', name: `Amount (${PESO})` }]}
              height={280}
              yAxisUnit={PESO}
              headerRight={
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={chartPeriod}
                    onChange={(e) => { setChartPeriod(e.target.value); setActiveChartPoint(null); }}
                    className={`${inputClass} appearance-none cursor-pointer`}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="bi-annually">Bi-Annually</option>
                    <option value="annually">Annually</option>
                  </select>
                  {(chartPeriod === 'daily' || chartPeriod === 'weekly') && (
                    <input
                      type="month"
                      value={chartMonth}
                      onChange={(e) => { setChartMonth(e.target.value); setActiveChartPoint(null); }}
                      className={inputClass}
                    />
                  )}
                  {(chartPeriod === 'monthly' || chartPeriod === 'bi-annually') && (
                    <input
                      type="number"
                      value={chartYear}
                      onChange={(e) => { setChartYear(parseInt(e.target.value) || new Date().getFullYear()); setActiveChartPoint(null); }}
                      min="2000"
                      max={new Date().getFullYear()}
                      className={`${inputClass} w-24`}
                    />
                  )}
                  {chartPeriod === 'annually' && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={chartYearFrom}
                        onChange={(e) => { setChartYearFrom(parseInt(e.target.value) || 2000); setActiveChartPoint(null); }}
                        min="2000"
                        max={chartYearTo}
                        className={`${inputClass} w-20`}
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">to</span>
                      <input
                        type="number"
                        value={chartYearTo}
                        onChange={(e) => { setChartYearTo(parseInt(e.target.value) || new Date().getFullYear()); setActiveChartPoint(null); }}
                        min={chartYearFrom}
                        max={new Date().getFullYear()}
                        className={`${inputClass} w-20`}
                      />
                    </div>
                  )}
                </div>
              }
              onDotClick={setActiveChartPoint}
              activePoint={activeChartPoint}
              summaryStats={[
                { label: 'Total Orders', value: stats.totalOrders.toString(), color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Avg Order', value: `${PESO}${avgOrderValue.toLocaleString()}`, color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Total Spent', value: `${PESO}${stats.totalSpent.toLocaleString()}`, color: 'text-green-600 dark:text-green-400' },
              ]}
            />
          </div>
          <div>
            <DonutChart
              title="Order Status"
              subtitle={activeChartPoint ? `Filtered: ${activeChartPoint}` : "Breakdown of your orders"}
              data={orderStatusData.length > 0 ? orderStatusData : [{ name: 'No Orders', value: 1, color: '#e5e7eb', hideFromLegend: true }]}
              centerValue={`${activeChartPoint ? filteredOrders.length : orders.length}`}
              centerLabel="Orders"
              height={175}
              innerRadius={56}
              outerRadius={78}
              showLegend={true}
              horizontalLegend={true}
              valueUnit=""
            />
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { to: '/customer/products', label: 'Products', icon: ShoppingCart, desc: 'Browse & order rice' },
          { to: '/customer/orders', label: 'My Orders', icon: ClipboardList, desc: 'Track your orders' },
          { to: '/customer/profile', label: 'My Profile', icon: Eye, desc: 'View account info' },
          { to: '/customer/settings', label: 'Settings', icon: Settings, desc: 'Account preferences' },
        ].map(({ to, label, icon: Icon, desc }) => (
          <Link
            key={label}
            to={to}
            className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all group border-2 border-primary-300 dark:border-primary-700"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform bg-button-500/10 dark:bg-button-400/15">
              <Icon size={20} className="text-button-600 dark:text-button-400" />
            </div>
            <p className="text-sm font-semibold text-center" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
            <p className="text-[11px] text-center text-gray-500 dark:text-gray-400">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-primary-300 dark:border-primary-700">
          <div className="flex items-center justify-between mb-4">
            <Skeleton variant="title" width="w-32" />
            <Skeleton variant="text" width="w-16" />
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton variant="text" width="w-32" />
                <Skeleton variant="text" width="w-20" />
                <Skeleton variant="text" width="w-12" />
                <Skeleton variant="text" width="w-20" className="ml-auto" />
                <Skeleton variant="button" width="w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700">
          <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-primary-200 dark:border-primary-700">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Recent Orders</h2>
              {activeChartPoint && (
                <p className="text-[11px] mt-0.5 text-gray-500 dark:text-gray-400">
                  Filtered by: <span className="font-medium text-button-600 dark:text-button-400">{activeChartPoint}</span>
                  <button className="ml-2 underline text-gray-500 dark:text-gray-400" onClick={() => setActiveChartPoint(null)}>clear</button>
                </p>
              )}
            </div>
            <Link to="/customer/orders" className="text-xs font-medium flex items-center gap-1 hover:underline text-button-600 dark:text-button-400">
              View All <ChevronRight size={12} />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <ClipboardList size={40} className="mb-3 opacity-30" />
              <p className="text-sm">{activeChartPoint ? 'No orders in this period' : 'No orders yet'}</p>
              {!activeChartPoint && (
                <Link to="/customer/products" className="mt-3 text-sm font-medium hover:underline text-button-600 dark:text-button-400">
                  Start Shopping
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-primary-100 dark:bg-primary-900/20 border-b-2 border-primary-300 dark:border-primary-700">
                      <th className="text-left text-xs font-medium px-5 py-2.5 text-gray-500 dark:text-gray-400">Order ID</th>
                      <th className="text-left text-xs font-medium px-3 py-2.5 text-gray-500 dark:text-gray-400">Date</th>
                      <th className="text-right text-xs font-medium px-3 py-2.5 text-gray-500 dark:text-gray-400">Total</th>
                      <th className="text-center text-xs font-medium px-3 py-2.5 text-gray-500 dark:text-gray-400">Status</th>
                      <th className="text-center text-xs font-medium px-5 py-2.5 text-gray-500 dark:text-gray-400"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order, idx) => {
                      const statusKey = (order.status || 'pending').toLowerCase();
                      const config = statusConfig[statusKey] || statusConfig['pending'];
                      return (
                        <tr
                          key={order.id}
                          className={`table-row-hover transition-colors cursor-pointer border-b border-primary-200 dark:border-primary-700`}
                          onClick={() => navigate('/customer/orders')}
                        >
                          <td className="px-5 py-2.5">
                            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{order.transaction_id}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(order.created_at || order.date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                              {PESO}{parseFloat(order.total_amount || order.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full inline-block ${config.badgeClass}`}>
                              {config.label}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-center">
                            <Eye size={14} className="inline-block text-gray-500 dark:text-gray-400" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
                {recentOrders.map((order) => {
                  const statusKey = (order.status || 'pending').toLowerCase();
                  const config = statusConfig[statusKey] || statusConfig['pending'];
                  const StatusIcon = config.icon;
                  return (
                    <div
                      key={order.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      onClick={() => navigate('/customer/orders')}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.iconBgClass}`}>
                        <StatusIcon size={14} className={config.iconColorClass} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{order.transaction_id}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {new Date(order.created_at || order.date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{PESO}{parseFloat(order.total_amount || order.total || 0).toLocaleString()}</p>
                        <span className={`text-[10px] font-medium ${config.iconColorClass}`}>{config.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;