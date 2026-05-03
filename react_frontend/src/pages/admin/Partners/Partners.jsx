import { useMemo } from 'react';
import { Users, Truck, UserCheck, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/common';
import { Card, CardContent, DataTable, StatusBadge, ActionButtons, StatsCard, DonutChart, SkeletonStats, SkeletonTable } from '../../../components/ui';
import { useDataFetch } from '../../../hooks';
import { useAuth } from '../../../context/AuthContext';

const Partners = () => {
  const navigate = useNavigate();
  const { basePath } = useAuth();
  
  // Fetch real data from API
  const { 
    data: customers, 
    loading: customersLoading,
    isRefreshing: customersRefreshing 
  } = useDataFetch('/customers', {
    cacheKey: '/customers',
    initialData: [],
  });

  const { 
    data: suppliers, 
    loading: suppliersLoading,
    isRefreshing: suppliersRefreshing 
  } = useDataFetch('/suppliers', {
    cacheKey: '/suppliers',
    initialData: [],
  });

  const loading = customersLoading || suppliersLoading;
  const isRefreshing = customersRefreshing || suppliersRefreshing;

  // Combine and format data for display
  const allPartners = useMemo(() => {
    const formattedCustomers = customers.map(c => ({
      id: `customer-${c.id}`,
      originalId: c.id,
      name: c.name,
      type: 'Customer',
      contact: c.contact || c.name,
      phone: c.phone,
      status: c.status,
      route: `${basePath}/partners/customer`
    }));

    const formattedSuppliers = suppliers.map(s => ({
      id: `supplier-${s.id}`,
      originalId: s.id,
      name: s.name,
      type: 'Supplier',
      contact: s.contact,
      phone: s.phone,
      status: s.status,
      route: `${basePath}/partners/supplier`
    }));

    // Combine and sort by most recent (assuming higher IDs are more recent)
    return [...formattedCustomers, ...formattedSuppliers]
      .sort((a, b) => b.originalId - a.originalId)
      .slice(0, 10); // Show only 10 most recent
  }, [customers, suppliers]);

  // Calculate stats
  const totalSuppliers = suppliers.length;
  const totalCustomers = customers.length;
  const totalPartners = totalSuppliers + totalCustomers;
  const activeSuppliers = suppliers.filter(s => s.status === 'Active').length;
  const activeCustomers = customers.filter(c => c.status === 'Active').length;

  const partnerSections = [
    { icon: Truck, title: 'Suppliers', description: 'Manage supplier relationships', to: `${basePath}/partners/supplier`, count: totalSuppliers },
    { icon: UserCheck, title: 'Customers', description: 'Track customer information', to: `${basePath}/partners/customer`, count: totalCustomers },
  ];

  const partnerBreakdown = useMemo(() => [
    { name: 'Suppliers', value: totalSuppliers, color: '#f97316' },
    { name: 'Customers', value: totalCustomers, color: '#3b82f6' },
  ], [totalSuppliers, totalCustomers]);

  const handleView = (row) => {
    navigate(row.route);
  };

  const handleEdit = (row) => {
    navigate(row.route);
  };

  const columns = [
    { header: 'Name', accessor: 'name' },
    { header: 'Type', accessor: 'type', cell: (row) => (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
        row.type === 'Supplier' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
      }`}>{row.type}</span>
    )},
    { header: 'Contact', accessor: 'contact' },
    { header: 'Phone', accessor: 'phone' },
    { header: 'Status', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
    { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
      <ActionButtons onEdit={() => handleEdit(row)} />
    )},
  ];

  return (
    <div>
      <PageHeader 
        title="Partners" 
        description="Manage your business relationships with suppliers and customers"
        icon={Users}
        action={isRefreshing ? (
          <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">Syncing...</span>
        ) : null}
      />

      {/* Stats Cards */}
      {loading && allPartners.length === 0 ? (
        <SkeletonStats count={4} className="mb-4" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatsCard label="Total Partners" value={totalPartners} unit="partners" icon={Users} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <StatsCard label="Suppliers" value={activeSuppliers} unit="active" icon={Truck} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <StatsCard label="Customers" value={activeCustomers} unit="active" icon={UserCheck} iconBgColor="bg-gradient-to-br from-button-400 to-button-600" />
          <DonutChart
            title="Partner Mix"
            data={partnerBreakdown}
            centerValue={totalPartners.toString()}
            centerLabel="Total"
            height={100}
            innerRadius={30}
            outerRadius={42}
            showLegend={false}
          />
        </div>
      )}

      {/* Section Links */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {partnerSections.map((section) => (
          <Link key={section.to} to={section.to}>
            <Card className="hover:shadow-md hover:border-primary-200 dark:border-primary-700 transition-all cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
                      <section.icon size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:text-primary-400 transition-colors" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800 dark:text-gray-100 text-sm">{section.title}</h3>
                      <p className="text-xs text-gray-400">{section.count} partners</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Partners Table */}
      {loading && allPartners.length === 0 ? (
        <SkeletonTable rows={5} columns={6} />
      ) : (
        <DataTable 
          title="Recent Partners"
          subtitle="10 most recent partners from customers and suppliers"
          columns={columns} 
          data={allPartners} 
          searchPlaceholder="Search partners..." 
          filterField="type" 
          filterPlaceholder="All Types"
          onRowDoubleClick={handleView}
        />
      )}
    </div>
  );
};

export default Partners;
