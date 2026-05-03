import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, RefreshCw, AlertTriangle, Package, ArrowUp, ArrowDown, Activity, Brain, Target, Clock } from 'lucide-react';
import { LineChart, DonutChart, StatsCard, SkeletonStats } from '../../../components/ui';
import { salesApi } from '../../../api/salesApi';
import { useToast } from '../../../components/ui';

const PredictiveAnalytics = () => {
  const toast = useToast();
  const [period, setPeriod] = useState('daily');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPredictions = async (selectedPeriod, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await salesApi.getPredictions(selectedPeriod);
      if (response.success) {
        setData(prev => {
          if (JSON.stringify(prev) === JSON.stringify(response.data)) return prev;
          return response.data;
        });
      }
    } catch (error) {
      if (!silent) toast.error('Prediction Error', 'Failed to load predictive analysis data.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions(period);
  }, [period]);

  // Realtime polling — refresh every 5s when tab is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchPredictions(period, true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [period]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await salesApi.refreshPredictions();
      await fetchPredictions(period);
      toast.success('Refreshed', 'Predictions regenerated with latest data.');
    } catch {
      toast.error('Refresh Failed', 'Could not refresh predictions.');
    } finally {
      setRefreshing(false);
    }
  };

  // Combined chart data: historical + forecast (for the main line chart)
  const combinedChartData = useMemo(() => {
    if (!data) return [];

    const historical = (data.historical || []).map(d => ({
      name: d.name,
      revenue: d.revenue,
      forecast: null,
    }));

    // Bridge: last historical point connects to first forecast
    const forecast = (data.forecast || []).map(d => ({
      name: d.name,
      revenue: null,
      forecast: d.revenue,
    }));

    // Add bridge point on last historical
    if (historical.length > 0 && forecast.length > 0) {
      historical[historical.length - 1].forecast = historical[historical.length - 1].revenue;
    }

    return [...historical, ...forecast];
  }, [data]);

  // Demand trend combined data
  const demandChartData = useMemo(() => {
    if (!data?.demand_trends) return [];

    const actual = (data.demand_trends.actual || []).map(d => ({
      name: d.name,
      actual: d.value,
      predicted: null,
    }));

    const forecast = (data.demand_trends.forecast || []).map(d => ({
      name: d.name,
      actual: null,
      predicted: d.value,
    }));

    // Bridge point
    if (actual.length > 0 && forecast.length > 0) {
      actual[actual.length - 1].predicted = actual[actual.length - 1].actual;
    }

    return [...actual, ...forecast];
  }, [data]);

  // Stock status breakdown for donut
  const stockStatusData = useMemo(() => {
    if (!data?.top_products) return [];
    const statusCounts = { critical: 0, low: 0, moderate: 0, healthy: 0 };
    data.top_products.forEach(p => {
      if (statusCounts[p.stock_status] !== undefined) statusCounts[p.stock_status]++;
    });
    return [
      { name: 'Critical', value: statusCounts.critical, color: '#ef4444' },
      { name: 'Low', value: statusCounts.low, color: '#f97316' },
      { name: 'Moderate', value: statusCounts.moderate, color: '#eab308' },
      { name: 'Healthy', value: statusCounts.healthy, color: '#22c55e' },
    ].filter(d => d.value > 0);
  }, [data]);

  const summary = data?.summary || {};

  const TrendIcon = summary.revenue_trend === 'growing' ? TrendingUp : summary.revenue_trend === 'declining' ? TrendingDown : Minus;
  const trendColor = summary.revenue_trend === 'growing' ? 'text-green-600 dark:text-green-400' : summary.revenue_trend === 'declining' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400';
  const trendBg = summary.revenue_trend === 'growing' ? 'bg-green-50 border-green-200 dark:border-green-700' : summary.revenue_trend === 'declining' ? 'bg-red-50 border-red-200 dark:border-red-700' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600';

  const confidenceColor = {
    high: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
    medium: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
    low: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
  }[summary.confidence] || 'text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600';

  const periodLabel = { daily: 'Day', monthly: 'Month', yearly: 'Year' }[period] || 'Period';

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonStats count={4} />
        <div className="h-80 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Brain size={48} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No prediction data available</p>
        <p className="text-xs">Need at least 3 completed transactions to generate predictions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with period selector and refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Brain size={20} className="text-primary-600 dark:text-primary-400" />
            Predictive Sales Analysis
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Forecast based on {summary.data_points || 0} historical data points
            {data.generated_at && <span> · Generated {new Date(data.generated_at).toLocaleString()}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 border-2 border-primary-200 dark:border-primary-700 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label={`Next ${periodLabel} Forecast`}
          value={`₱${(summary.predicted_revenue || 0).toLocaleString()}`}
          unit="predicted revenue"
          icon={Target}
          iconBgColor="bg-gradient-to-br from-purple-400 to-purple-600"
        />
        <StatsCard
          label="Revenue Trend"
          value={`${summary.trend_percentage > 0 ? '+' : ''}${summary.trend_percentage || 0}%`}
          unit={summary.revenue_trend || 'stable'}
          icon={TrendIcon}
          iconBgColor={summary.revenue_trend === 'growing' ? 'bg-gradient-to-br from-green-400 to-green-600' : summary.revenue_trend === 'declining' ? 'bg-gradient-to-br from-red-400 to-red-600' : 'bg-gradient-to-br from-gray-400 to-gray-600'}
        />
        <StatsCard
          label="Predicted Orders"
          value={summary.predicted_orders || 0}
          unit={`next ${periodLabel.toLowerCase()}`}
          icon={Activity}
          iconBgColor="bg-gradient-to-br from-blue-400 to-blue-600"
        />
        <StatsCard
          label="Growth Rate"
          value={`${summary.growth_rate > 0 ? '+' : ''}${summary.growth_rate || 0}%`}
          unit="period-over-period"
          icon={BarChart3}
          iconBgColor="bg-gradient-to-br from-indigo-400 to-indigo-600"
        />
      </div>

      {/* Confidence + Trend badges */}
      <div className="flex flex-wrap gap-3">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${confidenceColor}`}>
          <Target size={12} />
          {(summary.confidence || 'low').toUpperCase()} Confidence
          <span className="text-[10px] font-normal opacity-70">({summary.data_points} data pts)</span>
        </div>
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${trendBg} ${trendColor}`}>
          <TrendIcon size={12} />
          {(summary.revenue_trend || 'stable').charAt(0).toUpperCase() + (summary.revenue_trend || 'stable').slice(1)} Trend
        </div>
      </div>

      {/* Main Forecast Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <LineChart
            title="Revenue Forecast"
            subtitle="Historical data with predicted future revenue"
            data={combinedChartData}
            lines={[
              { dataKey: 'revenue', name: 'Actual Revenue (₱)', color: 'var(--color-button-500)' },
              { dataKey: 'forecast', name: 'Forecast (₱)', color: '#a855f7', dashed: true },
            ]}
            height={300}
            yAxisUnit="₱"
            tabs={[
              { label: 'Daily', value: 'daily' },
              { label: 'Monthly', value: 'monthly' },
              { label: 'Yearly', value: 'yearly' },
            ]}
            activeTab={period}
            onTabChange={setPeriod}
            summaryStats={[
              { label: 'Avg Historical', value: `₱${(summary.avg_historical_revenue || 0).toLocaleString()}`, color: 'text-primary-600 dark:text-primary-400' },
              { label: `Next ${periodLabel}`, value: `₱${(summary.predicted_revenue || 0).toLocaleString()}`, color: 'text-purple-600 dark:text-purple-400' },
              { label: 'Trend', value: `${summary.trend_percentage > 0 ? '+' : ''}${summary.trend_percentage || 0}%`, color: trendColor },
            ]}
          />
        </div>

        <div className="space-y-4">
          {/* Stock Status Donut */}
          {stockStatusData.length > 0 && (
            <DonutChart
              title="Stock Health"
              subtitle="Based on sales velocity"
              data={stockStatusData}
              centerValue={data.top_products?.length || 0}
              centerLabel="Products"
              height={175}
              innerRadius={56}
              outerRadius={78}
              horizontalLegend={true}
              compactLegend={true}
            />
          )}

          {/* Demand Trend Mini Chart */}
          <LineChart
            title="30-Day Demand + 14-Day Forecast"
            subtitle="Daily revenue trend"
            data={demandChartData}
            lines={[
              { dataKey: 'actual', name: 'Actual (₱)', color: '#22c55e' },
              { dataKey: 'predicted', name: 'Predicted (₱)', color: '#a855f7', dashed: true },
            ]}
            height={175}
            yAxisUnit="₱"
            showLegend={false}
          />
        </div>
      </div>

      {/* Top Products — Predicted Demand Table */}
      {data.top_products && data.top_products.length > 0 && (
        <div className="bg-white dark:bg-gray-700 rounded-xl border-2 border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 overflow-hidden">
          <div className="p-4 border-b-2 border-primary-100 dark:border-primary-800">
            <h4 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 text-sm">
              <Package size={16} className="text-primary-600 dark:text-primary-400" />
              Product Demand Predictions
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Based on historical sales velocity and current stock levels</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Product</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Total Sold</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Avg Daily</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Est. Weekly</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Est. Monthly</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Current Stock</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Days to Stockout</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.top_products.map((product, idx) => {
                  const statusConfig = {
                    critical: { label: 'Critical', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: AlertTriangle },
                    low: { label: 'Low', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', icon: ArrowDown },
                    moderate: { label: 'Moderate', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', icon: Clock },
                    healthy: { label: 'Healthy', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: ArrowUp },
                    no_sales: { label: 'No Sales', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400', icon: Minus },
                  }[product.stock_status] || { label: 'Unknown', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400', icon: Minus };

                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr key={product.product_id} className="hover:bg-primary-50/30 dark:hover:bg-primary-900/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: product.variety_color }}
                          />
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-100 text-xs">{product.product_name}</p>
                            <p className="text-[10px] text-gray-400">{product.variety_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-200">
                        {product.total_sold.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-200">
                        {product.avg_daily_sales}
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-semibold text-purple-600 dark:text-purple-400">
                        {product.predicted_weekly_demand}
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-semibold text-purple-600 dark:text-purple-400">
                        {product.predicted_monthly_demand}
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-200">
                        {product.current_stock.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {product.days_until_stockout !== null ? (
                          <span className={`text-xs font-bold ${product.days_until_stockout <= 7 ? 'text-red-600 dark:text-red-400' : product.days_until_stockout <= 14 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-200'}`}>
                            {product.days_until_stockout} days
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                          <StatusIcon size={10} />
                          {statusConfig.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictiveAnalytics;
