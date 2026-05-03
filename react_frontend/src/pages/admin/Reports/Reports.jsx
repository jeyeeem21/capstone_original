import { useState, useCallback, useRef, useEffect } from 'react';
import {
  FileText, TrendingUp, ShoppingCart, Sun, Settings2,
  Package, Printer, RefreshCw,
  CheckCircle, XCircle, DollarSign, Percent,
  Loader2, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '../../../components/common';
import { StatsCard, SkeletonTable, useToast } from '../../../components/ui';
import { useBusinessSettings } from '../../../context/BusinessSettingsContext';
import { useReportsData } from '../../../hooks/useReportsData';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmt     = (n, d = 2) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d });
const peso    = (n) => `\u20B1${fmt(n)}`;
const fmtDate = (d) => d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';
const pctClass = (v) => v >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';

// Use local date methods so PH timezone (UTC+8) is respected instead of UTC
const localDate    = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today        = () => localDate();
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return localDate(d); };

const PAY_LABELS = { cash: 'Cash', gcash: 'GCash', cod: 'COD', pay_later: 'Pay Later' };

// ─────────────────────────────────────────────────────────────────────────────
// Print helper
// ─────────────────────────────────────────────────────────────────────────────

const printReport = (title, htmlContent, bizName = 'KJP Ricemill') => {
  const win = window.open('', '_blank', 'width=940,height=700');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
    <title>${title} \u2014 ${bizName}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#1a1a1a;padding:24px}
      h1{font-size:19px;font-weight:700;margin-bottom:3px}
      h2{font-size:13px;font-weight:700;margin:18px 0 7px;border-bottom:1px solid #ccc;padding-bottom:3px}
      .meta{font-size:10px;color:#777;margin-bottom:16px}
      .stmt{width:100%;margin-bottom:20px;border-collapse:collapse}
      .stmt td{padding:4px 8px;font-size:12px}
      .stmt .label{width:65%;color:#333}
      .stmt .value{width:35%;text-align:right}
      .stmt .section{font-weight:700;background:#f3f4f6;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#555}
      .stmt .subtotal td{border-top:1px solid #ddd;font-weight:600}
      .stmt .total td{border-top:2px solid #333;border-bottom:2px solid #333;font-weight:700;font-size:13px}
      .stmt .profit{color:#16a34a}.stmt .loss{color:#dc2626}
      .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
      .stat{border:1px solid #ddd;border-radius:6px;padding:8px 12px}
      .stat .lbl{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.4px}
      .stat .val{font-size:17px;font-weight:700}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px}
      th{background:#f3f4f6;padding:5px 7px;text-align:left;border:1px solid #ddd;font-weight:600}
      td{padding:4px 7px;border:1px solid #e5e7eb}
      tr:nth-child(even) td{background:#fafafa}
      .footer{margin-top:22px;font-size:10px;color:#999;border-top:1px solid #ddd;padding-top:7px}
      @media print{body{padding:8px}}
    </style></head><body>
    <h1>${bizName}</h1>
    <h2 style="font-size:15px;border:none;padding:0;margin-bottom:3px;">${title}</h2>
    <p class="meta">Generated: ${new Date().toLocaleString('en-PH')}</p>
    ${htmlContent}
    <div class="footer">System-generated. For internal use only.</div>
    </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const SectionCard = ({ icon: Icon, title, children, onPrint, loading }) => (
  <div className="rounded-xl border-2 border-primary-200 dark:border-primary-700 p-5 mb-6"
    style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-button-500 rounded-lg"><Icon size={16} className="text-white" /></div>
        <h2 className="font-semibold text-base" style={{ color: 'var(--color-text-content)' }}>{title}</h2>
      </div>
      {onPrint && (
        <button onClick={onPrint} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-button-500 hover:bg-button-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} Print
        </button>
      )}
    </div>
    {children}
  </div>
);

const EmptyState = ({ message = 'No data for this period.' }) => (
  <div className="py-10 flex flex-col items-center gap-2 text-gray-400">
    <AlertCircle size={28} />
    <p className="text-sm">{message}</p>
  </div>
);

// --- Per-tab skeleton loading --------------------------------------------------
const skBase = 'animate-pulse rounded bg-gray-200 dark:bg-gray-700';
const SkBox = ({ w = 'w-full', h = 'h-4', className = '' }) => (
  <div className={`${skBase} ${w} ${h} ${className}`} />
);

const SkReportStats = ({ count = 3 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="p-4 rounded-xl border-2 border-primary-100 dark:border-primary-700"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <div className="flex items-center justify-between mb-3">
          <SkBox w="w-20" h="h-3" />
          <div className={`${skBase} w-9 h-9 rounded-lg`} />
        </div>
        <SkBox w="w-16" h="h-6" className="mb-1" />
        <SkBox w="w-24" h="h-3" />
      </div>
    ))}
  </div>
);

const ReportSkeleton = ({ tab }) => {
  switch (tab) {
    case 'pl':
      return (
        <div className="space-y-5">
          <div className="border-2 border-primary-100 dark:border-primary-700 rounded-xl p-4">
            <SkBox w="w-32" h="h-3" className="mb-1" />
            <SkBox w="w-52" h="h-2.5" className="mb-5" />
            {['w-2/3','w-1/2','w-full','w-2/3','w-1/2','w-full','w-2/3','w-full'].map((w, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <SkBox w={w} h="h-3" />
                <SkBox w="w-20" h="h-3" className="ml-4 flex-shrink-0" />
              </div>
            ))}
          </div>
          <SkBox w="w-48" h="h-3" />
          <SkeletonTable rows={3} columns={7} />
          <SkBox w="w-44" h="h-3" />
          <SkeletonTable rows={3} columns={6} />
          <SkBox w="w-36" h="h-3" />
          <SkeletonTable rows={3} columns={6} />
        </div>
      );
    case 'sales':
      return (
        <div className="space-y-4">
          <SkReportStats count={3} />
          <SkBox w="w-40" h="h-3" />
          <SkeletonTable rows={4} columns={3} />
          <SkBox w="w-48" h="h-3" />
          <SkeletonTable rows={5} columns={3} />
        </div>
      );
    case 'procurement':
      return (
        <div className="space-y-4">
          <SkReportStats count={3} />
          <SkBox w="w-32" h="h-3" />
          <SkeletonTable rows={4} columns={3} />
          <SkBox w="w-28" h="h-3" />
          <SkeletonTable rows={5} columns={6} />
        </div>
      );
    case 'drying':
      return (
        <div className="space-y-4">
          <SkReportStats count={3} />
          <SkeletonTable rows={5} columns={8} />
        </div>
      );
    case 'processing':
      return (
        <div className="space-y-4">
          <SkReportStats count={6} />
          <SkeletonTable rows={5} columns={7} />
        </div>
      );
    case 'inventory':
      return (
        <div className="space-y-4">
          <SkReportStats count={3} />
          <SkeletonTable rows={5} columns={6} />
        </div>
      );
    default:
      return (
        <div className="space-y-4">
          <SkReportStats count={3} />
          <SkeletonTable rows={5} columns={5} />
        </div>
      );
  }
};

const DataTable = ({ headers, rows, emptyMessage }) => {
  if (!rows || rows.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-primary-200 dark:border-primary-700">
            {headers.map((h, i) => (
              <th key={i} className={`py-2 px-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide ${h.right ? 'text-right' : 'text-left'}`}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-primary-100 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20">
              {row.map((cell, ci) => (
                <td key={ci} className={`py-2 px-3 ${headers[ci]?.right ? 'text-right' : ''}`}
                  style={{ color: 'var(--color-text-content)' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// P&L Income Statement (accounting format)
// ─────────────────────────────────────────────────────────────────────────────

const PLRow = ({ label, value, bold, indent, highlight, separator }) => {
  if (separator) return (
    <tr><td colSpan={2} className="py-0.5"><div className="border-t border-gray-300 dark:border-gray-600 mx-2" /></td></tr>
  );
  return (
    <tr className={highlight ? 'bg-primary-50 dark:bg-primary-900/20' : ''}>
      <td className={`py-1.5 px-3 text-sm ${indent ? 'pl-8' : ''} ${bold ? 'font-semibold' : ''}`}
        style={{ color: 'var(--color-text-content)' }}>{label}</td>
      <td className={`py-1.5 px-3 text-right text-sm ${bold ? 'font-bold' : ''}`}
        style={{ color: 'var(--color-text-content)' }}>{value}</td>
    </tr>
  );
};

const ProfitLossStatement = ({ data }) => {
  const isP = data.gross_profit >= 0;
  return (
    <div className="rounded-xl border-2 border-primary-200 dark:border-primary-700 overflow-hidden mb-5">
      <div className="bg-primary-100 dark:bg-primary-900/30 px-3 py-2 border-b border-primary-200 dark:border-primary-700">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Income Statement</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Period: {fmtDate(data.period?.from)} → {fmtDate(data.period?.to)}</p>
      </div>
      <table className="w-full">
        <tbody>
          <PLRow label="REVENUE" bold />
          <PLRow label="Gross Sales" value={peso(data.gross_sales)} indent />
          {data.discounts > 0 && <PLRow label="Less: Discounts" value={`(${peso(data.discounts)})`} indent />}
          {data.delivery_fees > 0 && <PLRow label="Add: Delivery Fees" value={peso(data.delivery_fees)} indent />}
          <PLRow separator />
          <PLRow label="Net Sales Revenue" value={peso(data.revenue)} bold highlight />
          <tr><td colSpan={2} className="py-1" /></tr>
          <PLRow label="OPERATING COSTS" bold />
          <PLRow label="Raw Material Purchases (Procurement)" value={peso(data.procurement_cost)} indent />
          <PLRow label="Drying Operations" value={peso(data.drying_cost)} indent />
          <PLRow separator />
          <PLRow label="Total Operating Costs" value={peso(data.total_expenses)} bold highlight />
          <tr><td colSpan={2} className="py-1" /></tr>
          <tr className={isP ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}>
            <td className="py-3 px-3 text-sm font-bold border-t-2 border-gray-400 dark:border-gray-500"
              style={{ color: isP ? '#16a34a' : '#dc2626' }}>
              {isP ? 'GROSS PROFIT' : 'GROSS LOSS'}
            </td>
            <td className={`py-3 px-3 text-right text-sm font-bold border-t-2 border-gray-400 dark:border-gray-500 ${isP ? 'text-green-600' : 'text-red-500'}`}>
              {isP ? peso(data.gross_profit) : `(${peso(Math.abs(data.gross_profit))})`}
            </td>
          </tr>
          <tr>
            <td className="py-1.5 px-3 text-sm text-gray-500 dark:text-gray-400 border-b-2 border-gray-400 dark:border-gray-500">Profit Margin</td>
            <td className={`py-1.5 px-3 text-right text-sm border-b-2 border-gray-400 dark:border-gray-500 font-semibold ${pctClass(data.gross_profit)}`}>
              {data.profit_margin}%
            </td>
          </tr>
        </tbody>
      </table>
      <div className={`px-4 py-2.5 flex items-center gap-2 ${isP ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
        {isP ? <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
              : <XCircle size={15} className="text-red-500 flex-shrink-0" />}
        <span className={`text-xs font-medium ${isP ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
          {isP
            ? `Profitable \u2014 earned ${peso(data.gross_profit)} above operating costs across ${data.order_count} order${data.order_count !== 1 ? 's' : ''}.`
            : `Loss \u2014 operating costs exceeded revenue by ${peso(Math.abs(data.gross_profit))} across ${data.order_count} order${data.order_count !== 1 ? 's' : ''}.`}
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Date range picker
// ─────────────────────────────────────────────────────────────────────────────

// Re-computed each call so the dates are always fresh (important for long-lived sessions)
const getPresets = () => [
  { label: 'This Month', from: firstOfMonth(), to: today() },
  {
    label: 'Last Month',
    // first day of last month (local)
    from: (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-1); return localDate(d); })(),
    // last day of last month (local) — setDate(0) rolls back to the last day of the previous month
    to:   (() => { const d = new Date(); d.setDate(0); return localDate(d); })(),
  },
  { label: 'This Year', from: `${new Date().getFullYear()}-01-01`, to: today() },
];

const DateBar = ({ dateFrom, dateTo, onChange, onRefresh, loading, activePreset, onPreset }) => {
  const presets = getPresets();
  return (
  <div className="flex flex-wrap items-end gap-3 mb-6 p-4 rounded-xl border-2 border-primary-200 dark:border-primary-700"
    style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">From</label>
      <input type="date" value={dateFrom} max={dateTo || today()}
        onChange={(e) => onChange('from', e.target.value)}
        className="px-3 py-2 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-button-500"
        style={{ color: 'var(--color-text-content)' }} />
    </div>
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">To</label>
      <input type="date" value={dateTo} min={dateFrom} max={today()}
        onChange={(e) => onChange('to', e.target.value)}
        className="px-3 py-2 text-sm border-2 border-primary-200 dark:border-primary-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-button-500"
        style={{ color: 'var(--color-text-content)' }} />
    </div>
    <div className="flex gap-2 flex-wrap">
      {presets.map((p) => (
        <button key={p.label}
          onClick={() => onPreset(p)}
          className={`px-3 py-2 text-xs font-medium border-2 rounded-lg transition-colors ${
            activePreset === p.label
              ? 'bg-button-500 border-button-500 text-white'
              : 'border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/30'
          }`}
          style={activePreset !== p.label ? { color: 'var(--color-text-content)' } : {}}>
          {p.label}
        </button>
      ))}
    </div>
    <button onClick={onRefresh} disabled={loading}
      className="flex items-center gap-2 px-3 py-2 border-2 border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ml-auto"
      style={{ color: 'var(--color-text-content)' }}
      title="Refresh data">
      {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
      {loading ? 'Loading\u2026' : 'Refresh'}
    </button>
  </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tabs definition
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'pl',          label: 'P&L Statement',    icon: DollarSign  },
  { key: 'sales',       label: 'Sales Summary',    icon: TrendingUp  },
  { key: 'procurement', label: 'Procurement Cost', icon: ShoppingCart },
  { key: 'drying',      label: 'Drying Cost',      icon: Sun         },
  { key: 'processing',  label: 'Processing Yield', icon: Settings2   },
  { key: 'inventory',   label: 'Inventory Value',  icon: Package     },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Reports Page
// ─────────────────────────────────────────────────────────────────────────────

const Reports = () => {
  const toast = useToast();
  const { settings: bizSettings } = useBusinessSettings();

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo,   setDateTo]   = useState(today);
  const [activePreset, setActivePreset] = useState('This Month');
  const [activeTab, setActiveTab] = useState('pl');

  // Use the persistent reports data hook
  const {
    plData,
    salesData,
    procData,
    dryData,
    procYieldData,
    invData,
    isRefreshing,
    hasInitialData,
    fetchReports,
  } = useReportsData();

  const bizName = bizSettings?.business_name || 'KJP Ricemill';

  // Keep dates fresh inside the stable callback
  const datesRef = useRef({ dateFrom, dateTo });
  datesRef.current = { dateFrom, dateTo };

  // Initial load - fetch data (will show cached data instantly if available)
  useEffect(() => {
    fetchReports(firstOfMonth(), today());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Background reload on date change (no loading state)
  const isFirstDateChange = useRef(true);
  useEffect(() => {
    if (isFirstDateChange.current) { isFirstDateChange.current = false; return; }
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    const t = setTimeout(() => fetchReports(dateFrom, dateTo, false), 800);
    return () => clearTimeout(t);
  }, [dateFrom, dateTo, fetchReports]);

  // Manual date input — clears preset highlight
  const handleDateChange = useCallback((field, val) => {
    if (field === 'from') setDateFrom(val);
    else setDateTo(val);
    setActivePreset(null);
  }, []);

  // Preset button — sets all three states atomically so handleDateChange never fires
  const handlePreset = useCallback((preset) => {
    const p = getPresets().find(x => x.label === preset.label);
    if (!p) return;
    setActivePreset(p.label);
    setDateFrom(p.from);
    setDateTo(p.to);
  }, []);

  const handleRefresh = useCallback(() => fetchReports(datesRef.current.dateFrom, datesRef.current.dateTo, true), [fetchReports]);

  // ── Print functions ──────────────────────────────────────────────────────

  const printPL = useCallback(() => {
    if (!plData) return;
    const p = plData;
    const isP = p.gross_profit >= 0;
    const stmtRows = `
      <tr><td class="section" colspan="2">Revenue</td></tr>
      <tr><td class="label" style="padding-left:24px">Gross Sales</td><td class="value">${peso(p.gross_sales)}</td></tr>
      ${p.discounts > 0 ? `<tr><td class="label" style="padding-left:24px">Less: Discounts</td><td class="value">(${peso(p.discounts)})</td></tr>` : ''}
      ${p.delivery_fees > 0 ? `<tr><td class="label" style="padding-left:24px">Add: Delivery Fees</td><td class="value">${peso(p.delivery_fees)}</td></tr>` : ''}
      <tr class="subtotal"><td class="label"><b>Net Sales Revenue</b></td><td class="value"><b>${peso(p.revenue)}</b></td></tr>
      <tr><td colspan="2" style="padding:4px"></td></tr>
      <tr><td class="section" colspan="2">Operating Costs</td></tr>
      <tr><td class="label" style="padding-left:24px">Raw Material Purchases</td><td class="value">${peso(p.procurement_cost)}</td></tr>
      <tr><td class="label" style="padding-left:24px">Drying Operations</td><td class="value">${peso(p.drying_cost)}</td></tr>
      <tr class="subtotal"><td class="label"><b>Total Operating Costs</b></td><td class="value"><b>${peso(p.total_expenses)}</b></td></tr>
      <tr><td colspan="2" style="padding:4px"></td></tr>
      <tr class="total"><td class="label ${isP ? 'profit' : 'loss'}"><b>${isP ? 'GROSS PROFIT' : 'GROSS LOSS'}</b></td><td class="value ${isP ? 'profit' : 'loss'}"><b>${isP ? peso(p.gross_profit) : `(${peso(Math.abs(p.gross_profit))})`}</b></td></tr>
      <tr><td class="label">Profit Margin</td><td class="value ${isP ? 'profit' : 'loss'}">${p.profit_margin}%</td></tr>
    `;
    const salesRows = (p.sales_list || []).map(s =>
      `<tr><td>${fmtDate(s.date)}</td><td>${s.transaction_id}</td><td>${s.customer}</td><td>${peso(s.gross_sales)}</td><td>(${peso(s.discount)})</td><td>${peso(s.total)}</td><td>${PAY_LABELS[s.payment_method] || s.payment_method}</td></tr>`
    ).join('');
    const procRows = (p.procurement_list || []).map(r =>
      `<tr><td>${fmtDate(r.date)}</td><td>${r.supplier}</td><td>${r.variety}</td><td>${fmt(r.quantity_kg)} kg</td><td>${peso(r.price_per_kg)}/kg</td><td>${peso(r.total_cost)}</td></tr>`
    ).join('');
    const dryRows = (p.drying_list || []).map(r =>
      `<tr><td>${fmtDate(r.date)}</td><td>${r.supplier}</td><td>${r.variety}</td><td>${r.sacks} sacks</td><td>${r.days}d</td><td>${peso(r.total_price)}</td></tr>`
    ).join('');
    const html = `
      <p class="meta">Period: ${fmtDate(p.period?.from)} to ${fmtDate(p.period?.to)} | Orders: ${p.order_count}</p>
      <table class="stmt"><tbody>${stmtRows}</tbody></table>
      <h2>Sales Transactions (${(p.sales_list || []).length})</h2>
      <table><thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Gross</th><th>Disc.</th><th>Total</th><th>Payment</th></tr></thead>
      <tbody>${salesRows || '<tr><td colspan="7" style="text-align:center;color:#999">None</td></tr>'}</tbody></table>
      <h2>Procurement Records (${(p.procurement_list || []).length})</h2>
      <table><thead><tr><th>Date</th><th>Supplier</th><th>Variety</th><th>Qty</th><th>Rate</th><th>Total Cost</th></tr></thead>
      <tbody>${procRows || '<tr><td colspan="6" style="text-align:center;color:#999">None</td></tr>'}</tbody></table>
      <h2>Drying Records (${(p.drying_list || []).length})</h2>
      <table><thead><tr><th>Date</th><th>Supplier</th><th>Variety</th><th>Sacks</th><th>Days</th><th>Cost</th></tr></thead>
      <tbody>${dryRows || '<tr><td colspan="6" style="text-align:center;color:#999">None</td></tr>'}</tbody></table>
    `;
    printReport('Profit & Loss Statement', html, bizName);
  }, [plData, bizName]);

  const printSales = useCallback(() => {
    if (!salesData) return;
    const topRows = (salesData.top_products || []).map((p, i) =>
      `<tr><td>${i+1}. ${p.product_name}</td><td>${fmt(p.total_qty, 0)}</td><td>${peso(p.total_revenue)}</td></tr>`).join('');
    const payRows = (salesData.by_payment || []).map(p =>
      `<tr><td>${PAY_LABELS[p.method] || p.method}</td><td>${p.count}</td><td>${peso(p.total)}</td></tr>`).join('');
    const html = `
      <p class="meta">Period: ${fmtDate(salesData.period?.from)} to ${fmtDate(salesData.period?.to)}</p>
      <div class="stats">
        <div class="stat"><div class="lbl">Orders</div><div class="val">${salesData.order_count}</div></div>
        <div class="stat"><div class="lbl">Revenue</div><div class="val">${peso(salesData.revenue)}</div></div>
        <div class="stat"><div class="lbl">Discounts</div><div class="val">${peso(salesData.total_discounts)}</div></div>
      </div>
      <h2>By Payment Method</h2>
      <table><thead><tr><th>Method</th><th>Orders</th><th>Total</th></tr></thead><tbody>${payRows}</tbody></table>
      <h2>Top Products</h2>
      <table><thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead><tbody>${topRows}</tbody></table>`;
    printReport('Sales Summary', html, bizName);
  }, [salesData, bizName]);

  const printProc = useCallback(() => {
    if (!procData) return;
    const rows = (procData.records || []).map(r =>
      `<tr><td>${fmtDate(r.date)}</td><td>${r.supplier}</td><td>${r.variety}</td><td>${fmt(r.quantity_kg)} kg</td><td>${peso(r.price_per_kg)}/kg</td><td>${peso(r.total_cost)}</td></tr>`).join('');
    const html = `
      <p class="meta">Period: ${fmtDate(procData.period?.from)} to ${fmtDate(procData.period?.to)}</p>
      <div class="stats">
        <div class="stat"><div class="lbl">Total Cost</div><div class="val">${peso(procData.total_cost)}</div></div>
        <div class="stat"><div class="lbl">Total kg</div><div class="val">${fmt(procData.total_kg)} kg</div></div>
        <div class="stat"><div class="lbl">Records</div><div class="val">${procData.record_count}</div></div>
      </div>
      <h2>Procurement Records</h2>
      <table><thead><tr><th>Date</th><th>Supplier</th><th>Variety</th><th>Quantity</th><th>Rate</th><th>Total Cost</th></tr></thead><tbody>${rows}</tbody></table>`;
    printReport('Procurement Cost Report', html, bizName);
  }, [procData, bizName]);

  const printDrying = useCallback(() => {
    if (!dryData) return;
    const rows = (dryData.records || []).map(r =>
      `<tr><td>${fmtDate(r.date)}</td><td>${r.is_batch ? `Batch ${r.batch_number}` : 'Single'}</td><td>${r.supplier}</td><td>${r.variety}</td><td>${fmt(r.quantity_kg)} kg</td><td>${fmt(r.quantity_out)} kg</td><td>${r.days}d</td><td>${peso(r.total_price)}</td></tr>`).join('');
    const html = `
      <p class="meta">Period: ${fmtDate(dryData.period?.from)} to ${fmtDate(dryData.period?.to)}</p>
      <div class="stats">
        <div class="stat"><div class="lbl">Total Cost</div><div class="val">${peso(dryData.total_cost)}</div></div>
        <div class="stat"><div class="lbl">Input</div><div class="val">${fmt(dryData.total_kg_in)} kg</div></div>
        <div class="stat"><div class="lbl">Output</div><div class="val">${fmt(dryData.total_kg_out)} kg</div></div>
      </div>
      <h2>Drying Records</h2>
      <table><thead><tr><th>Date</th><th>Type</th><th>Supplier</th><th>Variety</th><th>Input</th><th>Output</th><th>Days</th><th>Cost</th></tr></thead><tbody>${rows}</tbody></table>`;
    printReport('Drying Cost Report', html, bizName);
  }, [dryData, bizName]);

  const printProcessing = useCallback(() => {
    if (!procYieldData) return;
    const rows = (procYieldData.records || []).map(r =>
      `<tr><td>${fmtDate(r.date)}</td><td>${r.variety}</td><td>${r.operator}</td><td>${fmt(r.input_kg)} kg</td><td>${fmt(r.output_kg)} kg</td><td>${fmt(r.husk_kg)} kg</td><td>${r.yield_percent}%</td></tr>`).join('');
    const html = `
      <p class="meta">Period: ${fmtDate(procYieldData.period?.from)} to ${fmtDate(procYieldData.period?.to)}</p>
      <div class="stats">
        <div class="stat"><div class="lbl">Input</div><div class="val">${fmt(procYieldData.total_input_kg)} kg</div></div>
        <div class="stat"><div class="lbl">Output</div><div class="val">${fmt(procYieldData.total_output_kg)} kg</div></div>
        <div class="stat"><div class="lbl">Avg Yield</div><div class="val">${procYieldData.avg_yield_percent}%</div></div>
      </div>
      <h2>Processing Records</h2>
      <table><thead><tr><th>Date</th><th>Variety</th><th>Operator</th><th>Input</th><th>Output</th><th>Husk</th><th>Yield %</th></tr></thead><tbody>${rows}</tbody></table>`;
    printReport('Processing Yield Report', html, bizName);
  }, [procYieldData, bizName]);

  const printInventory = useCallback(() => {
    if (!invData) return;
    const rows = (invData.products || []).map(p =>
      `<tr><td>${p.is_low_stock ? '⚠ ' : ''}${p.product_name}</td><td>${p.variety}</td><td>${p.stocks} ${p.unit}</td><td>${peso(p.price)}</td><td>${peso(p.stock_value)}</td><td>${p.status}</td></tr>`).join('');
    const html = `
      <p class="meta">Snapshot: ${new Date(invData.generated_at).toLocaleString('en-PH')}</p>
      <div class="stats">
        <div class="stat"><div class="lbl">Total Value</div><div class="val">${peso(invData.total_value)}</div></div>
        <div class="stat"><div class="lbl">Total Units</div><div class="val">${invData.total_units}</div></div>
        <div class="stat"><div class="lbl">Low Stock</div><div class="val">${invData.low_stock_count}</div></div>
      </div>
      <h2>Product Inventory</h2>
      <table><thead><tr><th>Product</th><th>Variety</th><th>Stock</th><th>Unit Price</th><th>Value</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
    printReport('Inventory Valuation', html, bizName);
  }, [invData, bizName]);

  // ── Tab render functions ─────────────────────────────────────────────────

  const renderPL = () => {
    if (!hasInitialData && !plData) return <ReportSkeleton tab="pl" />;
    if (!plData) return <EmptyState message="No data available. Try adjusting the date range." />;
    return (
      <>
        <ProfitLossStatement data={plData} />

        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 mt-4">
          Sales Transactions ({(plData.sales_list || []).length})
        </h3>
        <DataTable
          headers={[
            { label: 'Date' }, { label: 'Invoice' }, { label: 'Customer' },
            { label: 'Gross Sales', right: true }, { label: 'Discount', right: true },
            { label: 'Total', right: true }, { label: 'Payment' },
          ]}
          rows={(plData.sales_list || []).map(s => [
            fmtDate(s.date), s.transaction_id, s.customer,
            peso(s.gross_sales), s.discount > 0 ? `(${peso(s.discount)})` : '\u2014',
            peso(s.total), PAY_LABELS[s.payment_method] || s.payment_method,
          ])}
          emptyMessage="No completed orders in this period."
        />

        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 mt-5">
          Procurement Records ({(plData.procurement_list || []).length})
        </h3>
        <DataTable
          headers={[
            { label: 'Date' }, { label: 'Supplier' }, { label: 'Variety' },
            { label: 'Qty', right: true }, { label: '\u20B1/kg', right: true }, { label: 'Total Cost', right: true },
          ]}
          rows={(plData.procurement_list || []).map(r => [
            fmtDate(r.date), r.supplier, r.variety,
            `${fmt(r.quantity_kg)} kg`, peso(r.price_per_kg), peso(r.total_cost),
          ])}
          emptyMessage="No procurement records in this period."
        />

        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 mt-5">
          Drying Records ({(plData.drying_list || []).length})
        </h3>
        <DataTable
          headers={[
            { label: 'Date' }, { label: 'Supplier' }, { label: 'Variety' },
            { label: 'Sacks', right: true }, { label: 'Days', right: true }, { label: 'Cost', right: true },
          ]}
          rows={(plData.drying_list || []).map(r => [
            fmtDate(r.date), r.supplier, r.variety, r.sacks, r.days, peso(r.total_price),
          ])}
          emptyMessage="No drying records in this period."
        />
      </>
    );
  };

  const renderSales = () => {
    if (!hasInitialData && !salesData) return <ReportSkeleton tab="sales" />;
    if (!salesData) return <EmptyState message="No data available. Try adjusting the date range." />;
    return (
      <>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatsCard label="Total Orders" value={salesData.order_count} icon={FileText} />
          <StatsCard label="Revenue" value={peso(salesData.revenue)} icon={TrendingUp} />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">By Payment Method</h3>
        <DataTable
          headers={[{ label: 'Method' }, { label: 'Orders', right: true }, { label: 'Total', right: true }]}
          rows={(salesData.by_payment || []).map(p => [PAY_LABELS[p.method] || p.method, p.count, peso(p.total)])}
          emptyMessage="No payment data." />
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mt-4 mb-2">Top Products by Revenue</h3>
        <DataTable
          headers={[{ label: 'Product' }, { label: 'Qty Sold', right: true }, { label: 'Revenue', right: true }]}
          rows={(salesData.top_products || []).map((p, i) => [`${i+1}. ${p.product_name}`, `${fmt(p.total_qty, 0)} units`, peso(p.total_revenue)])}
          emptyMessage="No product sales data." />
      </>
    );
  };

  const renderProcurement = () => {
    if (!hasInitialData && !procData) return <ReportSkeleton tab="procurement" />;
    if (!procData) return <EmptyState message="No data available. Try adjusting the date range." />;
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <StatsCard label="Total Cost" value={peso(procData.total_cost)} icon={ShoppingCart} />
          <StatsCard label="Total Purchased" value={`${fmt(procData.total_kg)} kg`} icon={Package} iconBgColor="bg-yellow-500" />
          <StatsCard label="Records" value={procData.record_count} icon={FileText} iconBgColor="bg-blue-500" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">By Supplier</h3>
        <DataTable
          headers={[{ label: 'Supplier' }, { label: 'Total kg', right: true }, { label: 'Total Cost', right: true }]}
          rows={(procData.by_supplier || []).map(s => [s.supplier, `${fmt(s.total_kg)} kg`, peso(s.total_cost)])}
          emptyMessage="No supplier data." />
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mt-4 mb-2">All Records</h3>
        <DataTable
          headers={[
            { label: 'Date' }, { label: 'Supplier' }, { label: 'Variety' },
            { label: 'Qty', right: true }, { label: '\u20B1/kg', right: true }, { label: 'Total', right: true },
          ]}
          rows={(procData.records || []).map(r => [
            fmtDate(r.date), r.supplier, r.variety,
            `${fmt(r.quantity_kg)} kg`, peso(r.price_per_kg), peso(r.total_cost),
          ])}
          emptyMessage="No procurement records." />
      </>
    );
  };

  const renderDrying = () => {
    if (!hasInitialData && !dryData) return <ReportSkeleton tab="drying" />;
    if (!dryData) return <EmptyState message="No data available. Try adjusting the date range." />;
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <StatsCard label="Total Drying Cost" value={peso(dryData.total_cost)} icon={Sun} iconBgColor="bg-amber-500" />
          <StatsCard label="Input (Wet)" value={`${fmt(dryData.total_kg_in)} kg`} icon={Package} iconBgColor="bg-blue-500" />
          <StatsCard label="Output (Dried)" value={`${fmt(dryData.total_kg_out)} kg`} icon={Package} iconBgColor="bg-green-500" />
        </div>
        <DataTable
          headers={[
            { label: 'Date' }, { label: 'Type' }, { label: 'Supplier' }, { label: 'Variety' },
            { label: 'Input', right: true }, { label: 'Output', right: true },
            { label: 'Days', right: true }, { label: 'Cost', right: true },
          ]}
          rows={(dryData.records || []).map(r => [
            fmtDate(r.date),
            r.is_batch ? `Batch ${r.batch_number}` : 'Single',
            r.supplier, r.variety,
            `${fmt(r.quantity_kg)} kg`, `${fmt(r.quantity_out)} kg`,
            r.days, peso(r.total_price),
          ])}
          emptyMessage="No drying records." />
      </>
    );
  };

  const renderProcessing = () => {
    if (!hasInitialData && !procYieldData) return <ReportSkeleton tab="processing" />;
    if (!procYieldData) return <EmptyState message="No data available. Try adjusting the date range." />;
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <StatsCard label="Total Input" value={`${fmt(procYieldData.total_input_kg)} kg`} icon={Settings2} />
          <StatsCard label="Total Output" value={`${fmt(procYieldData.total_output_kg)} kg`} icon={Package} iconBgColor="bg-green-500" />
          <StatsCard label="Avg Yield" value={`${procYieldData.avg_yield_percent}%`} icon={Percent} iconBgColor="bg-blue-500" />
          <StatsCard label="Husk / Waste" value={`${fmt(procYieldData.total_husk_kg)} kg`} icon={Package} iconBgColor="bg-gray-500" />
          <StatsCard label="Avg Waste %" value={`${procYieldData.avg_waste_percent}%`} icon={Percent} iconBgColor="bg-orange-500" />
          <StatsCard label="Batches" value={procYieldData.record_count} icon={FileText} iconBgColor="bg-purple-500" />
        </div>
        <DataTable
          headers={[
            { label: 'Date' }, { label: 'Variety' }, { label: 'Operator' },
            { label: 'Input', right: true }, { label: 'Output', right: true },
            { label: 'Husk', right: true }, { label: 'Yield %', right: true },
          ]}
          rows={(procYieldData.records || []).map(r => [
            fmtDate(r.date), r.variety, r.operator,
            `${fmt(r.input_kg)} kg`, `${fmt(r.output_kg)} kg`,
            `${fmt(r.husk_kg)} kg`, `${r.yield_percent}%`,
          ])}
          emptyMessage="No processing records." />
      </>
    );
  };

  const renderInventory = () => {
    if (!hasInitialData && !invData) return <ReportSkeleton tab="inventory" />;
    if (!invData) return <EmptyState message="No data available." />;
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <StatsCard label="Total Stock Value" value={peso(invData.total_value)} icon={DollarSign} />
          <StatsCard label="Total Units on Hand" value={invData.total_units} icon={Package} iconBgColor="bg-blue-500" />
          <StatsCard label="Low Stock Items" value={invData.low_stock_count} icon={AlertCircle}
            iconBgColor={invData.low_stock_count > 0 ? 'bg-red-500' : 'bg-green-500'} />
        </div>
        {invData.low_stock_count > 0 && (
          <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-700 dark:text-red-300">
              {invData.low_stock_count} product{invData.low_stock_count > 1 ? 's are' : ' is'} at or below stock floor \u2014 consider restocking.
            </span>
          </div>
        )}
        <DataTable
          headers={[
            { label: 'Product' }, { label: 'Variety' },
            { label: 'Stock', right: true }, { label: 'Unit Price', right: true },
            { label: 'Stock Value', right: true }, { label: 'Status' },
          ]}
          rows={(invData.products || []).map(p => [
            p.is_low_stock ? `\u26A0 ${p.product_name}` : p.product_name,
            p.variety, `${p.stocks} ${p.unit}`, peso(p.price), peso(p.stock_value), p.status,
          ])}
          emptyMessage="No products found." />
      </>
    );
  };

  const TAB_META = {
    pl:          { icon: DollarSign,   title: 'Profit & Loss Statement', render: renderPL,          print: printPL },
    sales:       { icon: TrendingUp,   title: 'Sales Summary',           render: renderSales,       print: printSales },
    procurement: { icon: ShoppingCart, title: 'Procurement Cost',        render: renderProcurement, print: printProc },
    drying:      { icon: Sun,          title: 'Drying Cost',             render: renderDrying,      print: printDrying },
    processing:  { icon: Settings2,    title: 'Processing Yield',        render: renderProcessing,  print: printProcessing },
    inventory:   { icon: Package,      title: 'Inventory Valuation',     render: renderInventory,   print: printInventory },
  };

  const active = TAB_META[activeTab];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Financial and operational reports \u2014 auto-loads for the current month. Change dates to refresh automatically."
        icon={FileText}
      />

      <DateBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onChange={handleDateChange}
        onRefresh={handleRefresh}
        loading={isRefreshing}
        activePreset={activePreset}
        onPreset={handlePreset}
      />

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border-2 transition-all
              ${activeTab === key
                ? 'bg-button-500 border-button-500 text-white'
                : 'border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/30'}`}
            style={activeTab !== key ? { color: 'var(--color-text-content)' } : {}}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Active report */}
      <SectionCard icon={active.icon} title={active.title} onPrint={active.print} loading={false}>
        {active.render()}
      </SectionCard>
    </div>
  );
};

export default Reports;