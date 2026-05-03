import {
  Package, Tag, Truck, UserCheck, ShoppingCart, Sun, Settings2, Car, MapPin,
  DollarSign, Scale, User, Calendar, Mail, Phone, Building2, Layers,
  Hash, FileText, Box, Boxes, Activity, CheckCircle, Percent, ArrowDown, Shield,
} from 'lucide-react';
import { StatusBadge } from '../../../components/ui';

// Module icon/color maps
const moduleIcons = {
  products: Package,
  varieties: Tag,
  suppliers: Truck,
  customers: UserCheck,
  procurements: ShoppingCart,
  drying_processes: Sun,
  processings: Settings2,
  drivers: Car,
  deliveries: MapPin,
  users: Shield,
};

const moduleColors = {
  products: { bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
  varieties: { bg: 'bg-indigo-500', light: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' },
  suppliers: { bg: 'bg-green-500', light: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
  customers: { bg: 'bg-cyan-500', light: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400' },
  procurements: { bg: 'bg-orange-500', light: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
  drying_processes: { bg: 'bg-yellow-500', light: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' },
  processings: { bg: 'bg-rose-500', light: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' },
  drivers: { bg: 'bg-teal-500', light: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400' },
  deliveries: { bg: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
  users: { bg: 'bg-violet-500', light: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' },
};

// Reusable detail item
const DetailItem = ({ icon: Icon, iconBg, label, value, children }) => (
  <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
    <div className={`p-2 ${iconBg} rounded-lg shrink-0`}>
      <Icon size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">{label}</p>
      {children || <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{value || '—'}</p>}
    </div>
  </div>
);

// Highlighted detail item (for cost/price)
const HighlightItem = ({ icon: Icon, label, value, color = 'text-button-600 dark:text-button-400' }) => (
  <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-button-50 to-primary-50 dark:from-gray-700 dark:to-gray-800 rounded-lg border-2 border-button-200 dark:border-button-700">
    <div className="p-2 bg-button-500 text-white rounded-lg shrink-0">
      <Icon size={18} />
    </div>
    <div className="flex-1">
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  </div>
);

// Header with ID and status
const RecordHeader = ({ module, id, name, status }) => {
  const Icon = moduleIcons[module] || Package;
  return (
    <div className="bg-gradient-to-r from-primary-50 to-button-50 dark:from-gray-700 dark:to-gray-800 p-3 rounded-lg border-2 border-primary-200 dark:border-primary-700">
      <div className="flex items-start gap-2">
        <div className="p-2 bg-button-500 text-white rounded-lg">
          <Icon size={20} />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{name || `#${String(id).padStart(4, '0')}`}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">Record ID: {id}</p>
        </div>
        {status && <StatusBadge status={status} />}
      </div>
    </div>
  );
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true });
};

// ═══════════════════════════════════════════════
// MODULE-SPECIFIC VIEWS
// ═══════════════════════════════════════════════

const ProcurementView = ({ data }) => (
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-3">
      <RecordHeader module="procurements" id={data.id} name={`Procurement #${String(data.id).padStart(4, '0')}`} status={data.status} />
      <DetailItem icon={Building2} iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" label="Supplier" value={data.supplier_name} />
      {data.batch_number && (
        <div className="flex items-center gap-2 p-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg">
          <Layers size={15} className="text-indigo-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Batch</p>
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{data.batch_number}</p>
          </div>
          {data.batch_status && (
            <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
              data.batch_status === 'Open' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
              data.batch_status === 'Closed' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
              'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>{data.batch_status}</span>
          )}
        </div>
      )}
      <DetailItem icon={Tag} iconBg="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" label="Variety" value={data.variety_name} />
      <HighlightItem icon={DollarSign} label="Total Cost" value={`₱${parseFloat(data.total_cost || 0).toLocaleString()}`} />
      <DetailItem icon={Calendar} iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" label="Date Created">
        <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{formatDate(data.created_at)}</p>
        {data.created_at && <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(data.created_at)}</p>}
      </DetailItem>
    </div>
    <div className="space-y-3">
      <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><Boxes size={16} /></div>
          <div className="flex-1">
            <p className="text-xs text-gray-600 dark:text-gray-400">Sacks/Bags</p>
            <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{parseInt(data.sacks || 0).toLocaleString()} sacks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg"><Scale size={16} /></div>
          <div className="flex-1">
            <p className="text-xs text-gray-600 dark:text-gray-400">Quantity</p>
            <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{parseFloat(data.quantity_kg || 0).toLocaleString()} kg</p>
          </div>
        </div>
      </div>
      <DetailItem icon={DollarSign} iconBg="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400" label="Price per KG" value={`₱${parseFloat(data.price_per_kg || 0).toLocaleString()}`} />
      {data.description && (
        <DetailItem icon={FileText} iconBg="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 dark:bg-gray-600 dark:text-gray-300" label="Remarks" value={data.description} />
      )}
    </div>
  </div>
);

const ProductView = ({ data }) => (
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-3">
      <RecordHeader module="products" id={data.product_id} name={data.product_name} status={data.status} />
      <DetailItem icon={Tag} iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" label="Variety" value={data.variety_name} />
      <HighlightItem icon={DollarSign} label="Price" value={data.price_formatted || `₱${parseFloat(data.price || 0).toLocaleString()}`} />
      <DetailItem icon={Calendar} iconBg="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" label="Created" value={formatDate(data.created_at)} />
    </div>
    <div className="space-y-3">
      <DetailItem icon={Box} iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" label="Stocks" value={`${parseInt(data.stocks || 0).toLocaleString()} ${data.unit || 'pcs'}`} />
      <DetailItem icon={Scale} iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" label="Weight" value={data.weight_formatted || (data.weight ? `${data.weight} kg` : '—')} />
      <DetailItem icon={ShoppingCart} iconBg="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" label="Stock Floor" value={`${parseInt(data.stock_floor || 0).toLocaleString()} ${data.unit || 'pcs'}`} />
      {(data.price && data.stocks) && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Total Value</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">₱{(parseFloat(data.price) * parseInt(data.stocks)).toLocaleString()}</p>
        </div>
      )}
    </div>
  </div>
);

const CustomerView = ({ data }) => (
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-3">
      <RecordHeader module="customers" id={data.id} name={data.name} status={data.status} />
      <DetailItem icon={User} iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" label="Contact Person" value={data.contact} />
      <DetailItem icon={Package} iconBg="bg-button-100 dark:bg-gray-600 text-button-600 dark:text-button-400" label="Total Orders" value={data.orders || 0} />
    </div>
    <div className="space-y-3">
      <DetailItem icon={Mail} iconBg="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" label="Email">
        {data.email ? (
          <a href={`mailto:${data.email}`} className="font-semibold text-button-600 dark:text-button-400 hover:underline text-sm">{data.email}</a>
        ) : (
          <p className="text-sm text-gray-400">—</p>
        )}
      </DetailItem>
      <DetailItem icon={Phone} iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" label="Phone">
        {data.phone ? (
          <a href={`tel:${data.phone}`} className="font-semibold text-button-600 dark:text-button-400 hover:underline text-sm">{data.phone}</a>
        ) : (
          <p className="text-sm text-gray-400">—</p>
        )}
      </DetailItem>
      <DetailItem icon={MapPin} iconBg="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" label="Address" value={data.address} />
    </div>
  </div>
);

const SupplierView = ({ data }) => (
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-3">
      <RecordHeader module="suppliers" id={data.id} name={data.name} status={data.status} />
      <DetailItem icon={User} iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" label="Contact Person" value={data.contact} />
      <DetailItem icon={Box} iconBg="bg-button-100 dark:bg-gray-600 text-button-600 dark:text-button-400" label="Products Supplied" value={data.products || 0} />
    </div>
    <div className="space-y-3">
      <DetailItem icon={Mail} iconBg="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" label="Email">
        {data.email ? (
          <a href={`mailto:${data.email}`} className="font-semibold text-button-600 dark:text-button-400 hover:underline text-sm">{data.email}</a>
        ) : (
          <p className="text-sm text-gray-400">—</p>
        )}
      </DetailItem>
      <DetailItem icon={Phone} iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" label="Phone">
        {data.phone ? (
          <a href={`tel:${data.phone}`} className="font-semibold text-button-600 dark:text-button-400 hover:underline text-sm">{data.phone}</a>
        ) : (
          <p className="text-sm text-gray-400">—</p>
        )}
      </DetailItem>
      <DetailItem icon={MapPin} iconBg="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" label="Address" value={data.address} />
    </div>
  </div>
);

const VarietyView = ({ data }) => (
  <div className="space-y-3">
    <div className="bg-gradient-to-r from-primary-50 to-button-50 dark:from-gray-700 dark:to-gray-800 p-4 rounded-lg border-2 border-primary-200 dark:border-primary-700">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: data.color || '#6b7280' }}>
          <Tag size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{data.name}</h3>
          {data.description && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{data.description}</p>}
        </div>
        {data.status && <StatusBadge status={data.status} />}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <DetailItem icon={Tag} iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" label="Color">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border border-primary-200 dark:border-primary-700" style={{ backgroundColor: data.color || '#ccc' }} />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{data.color || '—'}</span>
        </div>
      </DetailItem>
      <DetailItem icon={Package} iconBg="bg-button-100 dark:bg-gray-600 text-button-600 dark:text-button-400" label="Products Count" value={data.products_count || 0} />
    </div>
  </div>
);

const ProcessingView = ({ data }) => (
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-3">
      <RecordHeader module="processings" id={data.id} name={`Processing #${String(data.id).padStart(4, '0')}`} status={data.status} />
      <DetailItem icon={Calendar} iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" label="Processing Date" value={formatDate(data.processing_date)} />
      <DetailItem icon={Scale} iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" label="Input (kg)" value={`${parseFloat(data.input_kg || 0).toLocaleString()} kg`} />
      <DetailItem icon={User} iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" label="Operator" value={data.operator_name} />
    </div>
    <div className="space-y-3">
      {data.status === 'Completed' || data.output_kg ? (
        <>
          <DetailItem icon={CheckCircle} iconBg="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" label="Output (kg)" value={`${parseFloat(data.output_kg || 0).toLocaleString()} kg`} />
          <DetailItem icon={ArrowDown} iconBg="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" label="Stock Out" value={`${parseFloat(data.stock_out || 0).toLocaleString()} kg`} />
          <DetailItem icon={Package} iconBg="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" label="Husk (kg)" value={`${parseFloat(data.husk_kg || 0).toLocaleString()} kg`} />
          <DetailItem icon={Percent} iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" label="Yield %" value={`${parseFloat(data.yield_percent || 0).toFixed(1)}%`} />
          {data.completed_date && (
            <DetailItem icon={Calendar} iconBg="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" label="Completed Date" value={formatDate(data.completed_date)} />
          )}
        </>
      ) : (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
          <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Processing is still pending completion.</p>
        </div>
      )}
    </div>
  </div>
);

const DryingProcessView = ({ data }) => (
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-3">
      <RecordHeader module="drying_processes" id={data.id} name={`Drying Process #${String(data.id).padStart(4, '0')}`} status={data.status} />
      <DetailItem icon={Building2} iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" label="Supplier" value={data.supplier_name} />
      {data.batch_number && (
        <div className="flex items-center gap-2 p-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg">
          <Layers size={15} className="text-indigo-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Batch</p>
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{data.batch_number}</p>
          </div>
        </div>
      )}
      <DetailItem icon={Calendar} iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" label="Dried At" value={formatDate(data.dried_at)} />
    </div>
    <div className="space-y-3">
      <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><Boxes size={16} /></div>
          <div className="flex-1">
            <p className="text-xs text-gray-600 dark:text-gray-400">Sacks</p>
            <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{parseInt(data.sacks || 0).toLocaleString()} sacks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg"><Scale size={16} /></div>
          <div className="flex-1">
            <p className="text-xs text-gray-600 dark:text-gray-400">Quantity</p>
            <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{parseFloat(data.quantity_kg || 0).toLocaleString()} kg</p>
          </div>
        </div>
      </div>
      <DetailItem icon={Scale} iconBg="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" label="Quantity Out" value={`${parseFloat(data.quantity_out || 0).toLocaleString()} kg`} />
      <DetailItem icon={Calendar} iconBg="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" label="Days" value={`${data.days || 0} days`} />
      <HighlightItem icon={DollarSign} label="Total Price" value={`₱${parseFloat(data.total_price || 0).toLocaleString()}`} />
    </div>
  </div>
);

const DriverView = ({ data }) => (
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-3">
      <RecordHeader module="drivers" id={data.id} name={data.name} status={data.status} />
      <DetailItem icon={User} iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" label="Contact" value={data.contact} />
      <DetailItem icon={Phone} iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" label="Phone">
        {data.phone ? (
          <a href={`tel:${data.phone}`} className="font-semibold text-button-600 dark:text-button-400 hover:underline text-sm">{data.phone}</a>
        ) : (
          <p className="text-sm text-gray-400">—</p>
        )}
      </DetailItem>
      <DetailItem icon={Mail} iconBg="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" label="Email">
        {data.email ? (
          <a href={`mailto:${data.email}`} className="font-semibold text-button-600 dark:text-button-400 hover:underline text-sm">{data.email}</a>
        ) : (
          <p className="text-sm text-gray-400">—</p>
        )}
      </DetailItem>
    </div>
    <div className="space-y-3">
      <DetailItem icon={Hash} iconBg="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" label="License Number" value={data.license_number} />
      <DetailItem icon={Car} iconBg="bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400" label="Vehicle Type" value={data.vehicle_type} />
      <DetailItem icon={Hash} iconBg="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" label="Plate Number" value={data.plate_number} />
      <DetailItem icon={MapPin} iconBg="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" label="Address" value={data.address} />
      <DetailItem icon={Package} iconBg="bg-button-100 dark:bg-gray-600 text-button-600 dark:text-button-400" label="Total Deliveries" value={data.total_deliveries || 0} />
    </div>
  </div>
);

const DeliveryView = ({ data }) => (
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-3">
      <RecordHeader module="deliveries" id={data.id} name={data.delivery_number || `Delivery #${String(data.id).padStart(4, '0')}`} status={data.status} />
      <DetailItem icon={Car} iconBg="bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400" label="Driver" value={data.driver_name} />
      <DetailItem icon={UserCheck} iconBg="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400" label="Customer" value={data.customer_name} />
      <DetailItem icon={MapPin} iconBg="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" label="Destination" value={data.destination} />
    </div>
    <div className="space-y-3">
      <DetailItem icon={User} iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" label="Contact Person" value={data.contact_person} />
      <DetailItem icon={Phone} iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" label="Contact Phone" value={data.contact_phone} />
      <DetailItem icon={Calendar} iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" label="Delivery Date" value={formatDate(data.delivery_date)} />
      <DetailItem icon={Package} iconBg="bg-button-100 dark:bg-gray-600 text-button-600 dark:text-button-400" label="Items" value={`${data.items_count || 0} items`} />
      {data.notes && (
        <DetailItem icon={FileText} iconBg="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" label="Notes" value={data.notes} />
      )}
    </div>
  </div>
);

const UserView = ({ data }) => (
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-3">
      <RecordHeader module="users" id={data.id} name={data.name} status={data.status} />
      <DetailItem icon={Mail} iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" label="Email">
        {data.email ? (
          <a href={`mailto:${data.email}`} className="font-semibold text-button-600 dark:text-button-400 hover:underline text-sm">{data.email}</a>
        ) : (
          <p className="text-sm text-gray-400">—</p>
        )}
      </DetailItem>
      <DetailItem icon={Phone} iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" label="Phone">
        {data.phone ? (
          <a href={`tel:${data.phone}`} className="font-semibold text-button-600 dark:text-button-400 hover:underline text-sm">{data.phone}</a>
        ) : (
          <p className="text-sm text-gray-400">—</p>
        )}
      </DetailItem>
    </div>
    <div className="space-y-3">
      <DetailItem icon={Shield} iconBg="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400" label="Role" value={data.role_label || data.role} />
      <DetailItem icon={Building2} iconBg="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" label="Position" value={data.position} />
      {data.truck_plate_number && (
        <DetailItem icon={Car} iconBg="bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400" label="Truck Plate" value={data.truck_plate_number} />
      )}
      <DetailItem icon={Calendar} iconBg="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" label="Date Hired" value={formatDate(data.date_hired)} />
    </div>
  </div>
);

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════

const moduleViews = {
  procurements: ProcurementView,
  products: ProductView,
  customers: CustomerView,
  suppliers: SupplierView,
  varieties: VarietyView,
  processings: ProcessingView,
  drying_processes: DryingProcessView,
  drivers: DriverView,
  deliveries: DeliveryView,
  users: UserView,
};

const ArchiveDetailView = ({ item }) => {
  if (!item || !item.record_data) return null;

  const ViewComponent = moduleViews[item.module];
  const data = item.record_data;

  if (ViewComponent) {
    return (
      <div className="space-y-4">
        <ViewComponent data={data} />
        {/* Archive Info Footer */}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
              <Calendar size={14} className="text-red-500" />
              <div>
                <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">Archived Date</p>
                <p className="text-xs font-semibold text-red-700 dark:text-red-300">{item.deleted_at}</p>
              </div>
            </div>
            {item.archived_by && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                <User size={14} className="text-red-500" />
                <div>
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">Archived By</p>
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">{item.archived_by}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback: generic view for unknown modules
  return (
    <div className="space-y-3">
      <RecordHeader module={item.module} id={item._originalId} name={item.name} />
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(data).filter(([k]) => !['id', 'created_at', 'updated_at', 'deleted_at', 'is_deleted'].includes(k)).map(([key, value]) => (
          <div key={key} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium capitalize">{key.replace(/_/g, ' ')}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{value?.toString() || '—'}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
            <Calendar size={14} className="text-red-500" />
            <div>
              <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">Archived Date</p>
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">{item.deleted_at}</p>
            </div>
          </div>
          {item.archived_by && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
              <User size={14} className="text-red-500" />
              <div>
                <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">Archived By</p>
                <p className="text-xs font-semibold text-red-700 dark:text-red-300">{item.archived_by}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchiveDetailView;
