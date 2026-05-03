// Admin pages (from admin folder)
export { 
  Dashboard, 
  Procurement, 
  DryingProcess,
  Processing, 
  Products, 
  Varieties, 
  Inventory,
  Sales, 
  AdminOrders,
  Partners, 
  Supplier, 
  Customer,
  StaffManagement, 
  AuditTrail, 
  Archives,
  Settings 
} from './admin';

// Shared pages (from shared folder)
export { PointOfSale } from './shared';

// Staff pages (from staff folder)
export { StaffDashboard, StaffProfile } from './staff';

// Customer pages (from customer folder)
export { CustomerDashboard, Product, Orders, Cart, Profile, CustomerSettings } from './customer';

// Driver pages (from driver folder)
export { DriverDashboard, Deliveries, DriverProfile, DriverSettings } from './driver';

// Re-export organized by role
export * as AdminPages from './admin';
export * as StaffPages from './staff';
export * as SharedPages from './shared';
export * as CustomerPages from './customer';
export * as DriverPages from './driver';
