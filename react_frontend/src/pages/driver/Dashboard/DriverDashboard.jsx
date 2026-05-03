import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck, Package, MapPin, Clock, CheckCircle, XCircle,
  ChevronRight, Calendar, Navigation
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { Skeleton } from '../../../components/ui';
import apiClient from '../../../api/apiClient';
import { ENDPOINTS } from '../../../api/config';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const statusConfig = {
  'Pending': { color: '#f59e0b', bg: '#fef3c7', icon: Clock },
  'In Transit': { color: '#3b82f6', bg: '#dbeafe', icon: Navigation, label: 'Shipped' },
  'Shipped': { color: '#3b82f6', bg: '#dbeafe', icon: Navigation },
  'Delivered': { color: '#22c55e', bg: '#dcfce7', icon: CheckCircle },
  'Failed': { color: '#ef4444', bg: '#fee2e2', icon: XCircle },
  'Failed/Returned': { color: '#ef4444', bg: '#fee2e2', icon: XCircle },
  'Cancelled': { color: '#6b7280', bg: '#f3f4f6', icon: XCircle },
};

const deliveryLabels = {
  daily: 'Daily Deliveries',
  monthly: 'Monthly Deliveries',
  yearly: 'Yearly Deliveries',
};

const deliveryDesc = {
  daily: 'Delivery activity for this month',
  monthly: 'All months of the current year',
  yearly: 'Annual delivery overview',
};

const DriverDashboard = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme.mode === 'dark';
  const [loading, setLoading] = useState(true);
  const [deliveryPeriod, setDeliveryPeriod] = useState('monthly');
  const [dashboardData, setDashboardData] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiClient.get(ENDPOINTS.DRIVER_PORTAL.DASHBOARD);
      if (res.success) {
        setDashboardData(prev => {
          if (JSON.stringify(prev) === JSON.stringify(res.data)) return prev;
          return res.data;
        });
      }
    } catch (err) {
      console.error('Failed to fetch driver dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Realtime polling — refresh every 5s when tab is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboard();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const stats = dashboardData?.stats || {};
  const driverName = dashboardData?.driver_name || user?.name || 'Driver';
  const todayDeliveries = dashboardData?.today_deliveries || [];
  const chartData = dashboardData?.chart || { daily: [], monthly: [], yearly: [] };
  const statusBreakdown = dashboardData?.status_breakdown || [];

  const currentDeliveryData = useMemo(() => {
    if (deliveryPeriod === 'daily') return chartData.daily;
    if (deliveryPeriod === 'monthly') return chartData.monthly;
    return chartData.yearly;
  }, [deliveryPeriod, chartData]);

  const totalOrders = statusBreakdown.reduce((s, d) => s + d.value, 0);

  const DeliveryTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const currentValue = payload[0].value || 0;
    const currentIndex = currentDeliveryData.findIndex(d => String(d.label) === String(label));
    const prevValue = currentIndex > 0 ? (currentDeliveryData[currentIndex - 1]?.deliveries || 0) : null;

    let changePercent = null;
    let changeDirection = null;
    if (prevValue !== null && prevValue !== 0) {
      changePercent = ((currentValue - prevValue) / prevValue * 100).toFixed(1);
      changeDirection = changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'same';
    } else if (prevValue === 0 && currentValue > 0) {
      changePercent = '100.0';
      changeDirection = 'up';
    } else if (prevValue !== null) {
      changePercent = '0.0';
      changeDirection = 'same';
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-gray-900/30 p-3 min-w-[180px] border-2 border-primary-300 dark:border-primary-700">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2 pb-1.5 border-b border-primary-100 dark:border-primary-700">{label}</p>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.button_primary }} />
              <span className="text-xs text-gray-500 dark:text-gray-400">Deliveries</span>
            </div>
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{currentValue}</span>
          </div>
          {changePercent !== null && (
            <div className="flex items-center justify-end gap-1">
              {changeDirection === 'up' && <span className="text-[11px] font-medium text-green-600 dark:text-green-400">+{changePercent}%</span>}
              {changeDirection === 'down' && <span className="text-[11px] font-medium text-red-600 dark:text-red-400">{changePercent}%</span>}
              {changeDirection === 'same' && <span className="text-[11px] font-medium text-gray-400">0.0%</span>}
              <span className="text-[10px] text-gray-400">vs prev</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const totalDelivered = (stats.delivered || 0) + (stats.orders_delivered || 0) + (stats.orders_completed || 0);
  const totalPending = (stats.pending || 0);

  const summaryCards = [
    { label: "Today's Deliveries", value: stats.today_deliveries || 0, icon: Truck },
    { label: 'Pending', value: totalPending, icon: Clock },
    { label: 'Total Completed', value: totalDelivered, icon: CheckCircle },
  ];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* Welcome Banner */}
      <div 
        className="rounded-xl p-5 sm:p-6 mb-6 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${theme.button_primary}, ${theme.button_primary}cc)` }}
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-20 w-24 h-24 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">
                Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {driverName.split(' ')[0]}!
              </h1>
              <p className="text-sm mt-1 text-white/80">
                You have {totalPending} pending {totalPending === 1 ? 'delivery' : 'deliveries'} today
              </p>
            </div>
            <Link
              to="/driver/deliveries"
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
            >
              <Truck size={16} /> View All Deliveries
            </Link>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 border-2 border-primary-300 dark:border-primary-700">
              <Skeleton variant="circle" width="w-10" height="h-10" className="mb-3" />
              <Skeleton variant="title" width="w-20" className="mb-1" />
              <Skeleton variant="text" width="w-24" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {summaryCards.map((card) => (
          <div 
            key={card.label} 
            className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 transition-all hover:shadow-md border-2 border-primary-300 dark:border-primary-700"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${theme.button_primary}15` }}>
                <card.icon size={20} style={{ color: theme.button_primary }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{card.value}</p>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
          </div>
        ))}
      </div>
      )}

      {/* Charts */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-primary-300 dark:border-primary-700">
            <Skeleton variant="title" width="w-32" className="mb-2" />
            <Skeleton variant="custom" className="h-[250px] w-full rounded-lg" />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-primary-300 dark:border-primary-700">
            <Skeleton variant="title" width="w-24" className="mb-2" />
            <Skeleton variant="circle" width="w-[160px]" height="h-[160px]" className="mx-auto" />
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-primary-300 dark:border-primary-700">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{deliveryLabels[deliveryPeriod]}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{deliveryDesc[deliveryPeriod]}</p>
            </div>
            <div className="flex rounded-lg p-1 shadow-sm bg-gray-50 dark:bg-gray-700 border-2 border-primary-300 dark:border-primary-700">
              {['daily', 'monthly', 'yearly'].map(period => (
                <button key={period} onClick={() => setDeliveryPeriod(period)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${deliveryPeriod !== period ? 'text-gray-500 dark:text-gray-400' : ''}`}
                  style={deliveryPeriod === period
                    ? { backgroundColor: theme.button_primary, color: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }
                    : {}
                  }>
                  {period}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={currentDeliveryData} barSize={deliveryPeriod === 'daily' ? 12 : deliveryPeriod === 'yearly' ? 48 : 32}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#4b5563' : '#e5e7eb'} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: isDark ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: isDark ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<DeliveryTooltip />} />
              <Bar dataKey="deliveries" fill={theme.button_primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-primary-300 dark:border-primary-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Delivery Status</h2>
          <p className="text-xs mb-4 text-gray-500 dark:text-gray-400">Breakdown of your deliveries</p>
          <div className="flex flex-col items-center">
            {statusBreakdown.length > 0 ? (
              <>
                <div className="relative">
                  <ResponsiveContainer width={200} height={180}>
                    <PieChart>
                      <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" stroke="none" paddingAngle={2}>
                        {statusBreakdown.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value}`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalOrders}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Total</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2 w-full">
                  {statusBreakdown.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-500 dark:text-gray-400">{d.name}</span>
                      <span className="text-xs font-semibold ml-auto text-gray-800 dark:text-gray-100">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Truck size={32} className="mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No delivery data yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Today's Deliveries */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-primary-300 dark:border-primary-700">
          <Skeleton variant="title" width="w-40" className="mb-4" />
          <div className="columns-1 md:columns-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 rounded-xl mb-3 break-inside-avoid border-2 border-primary-300 dark:border-primary-700">
                <Skeleton variant="text" width="w-36" className="mb-2" />
                <Skeleton variant="text" width="w-48" className="mb-1" />
                <Skeleton variant="text" width="w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-300 dark:border-primary-700">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-primary-200 dark:border-primary-700">
          <div className="flex items-center gap-2">
            <Calendar size={18} style={{ color: theme.button_primary }} />
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Today's Deliveries</h2>
          </div>
          <Link to="/driver/deliveries" className="text-xs font-medium flex items-center gap-1 hover:underline" style={{ color: theme.button_primary }}>
            View All <ChevronRight size={12} />
          </Link>
        </div>

        <div className="p-4 columns-1 md:columns-2 gap-3">
          {todayDeliveries.length === 0 ? (
            <div className="text-center py-12 col-span-2">
              <CheckCircle size={40} className="mx-auto mb-3" style={{ color: '#22c55e' }} />
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">All caught up!</h3>
              <p className="text-sm mt-1 text-gray-500 dark:text-gray-400">No deliveries scheduled for today.</p>
            </div>
          ) : todayDeliveries.map((delivery) => {
            const config = statusConfig[delivery.status] || statusConfig['Pending'];
            const displayStatus = config.label || delivery.status;
            const StatusIcon = config.icon;
            return (
              <div key={delivery.id} className="p-4 rounded-xl transition-all hover:shadow-sm mb-3 break-inside-avoid border-2 border-primary-300 dark:border-primary-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: config.bg }}>
                      <StatusIcon size={14} style={{ color: config.color }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{delivery.delivery_number}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{delivery.time}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: config.bg, color: config.color }}>{displayStatus}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MapPin size={12} className="text-gray-400 dark:text-gray-500" />
                  <p className="text-xs text-gray-800 dark:text-gray-100">{delivery.destination}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{delivery.items_count} {delivery.items_count === 1 ? 'item' : 'items'} · {delivery.customer}</p>
                  <p className="text-sm font-bold" style={{ color: theme.button_primary }}>₱{Number(delivery.total).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
};

export default DriverDashboard;
