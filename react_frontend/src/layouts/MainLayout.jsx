import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/sidebar';
import { Footer, Header, BottomNav, NotificationBell } from '../components/common';

const MainLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div 
      className="min-h-screen min-h-[100dvh] transition-colors duration-300 flex flex-col"
      style={{ backgroundColor: 'var(--color-bg-body)' }}
    >
      {/* Mobile/Tablet Header */}
      <Header onMenuClick={() => setIsMobileSidebarOpen(true)} />

      {/* Sidebar */}
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className={`
        transition-all duration-300 flex-1 flex flex-col
        /* Mobile: no left margin, add bottom padding for BottomNav */
        ml-0 pb-20
        /* Tablet: no left margin */
        md:pb-0
        /* Desktop: add left margin based on sidebar state */
        lg:pb-0
        ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'}
      `}>
        <div className="p-4 md:p-6 lg:p-8 flex-1">
          <div 
            className="rounded-2xl shadow-xl border-2 border-primary-300 dark:border-primary-700 p-4 md:p-6 lg:p-8 min-h-[calc(100vh-10rem)] min-h-[calc(100dvh-10rem)] md:min-h-[calc(100vh-12rem)] md:min-h-[calc(100dvh-12rem)] lg:min-h-[calc(100vh-16rem)] lg:min-h-[calc(100dvh-16rem)] transition-colors duration-300 relative overflow-x-auto"
            style={{ 
              backgroundColor: 'var(--color-bg-content)', 
              color: 'var(--color-text-content)',
              fontSize: 'var(--font-size-base)'
            }}
          >
            {/* Desktop Notification Bell - top right inside content */}
            <div className="hidden lg:block absolute top-4 right-4 z-10">
              <NotificationBell />
            </div>
            <Outlet />
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-4 pb-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8">
          <Footer />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default MainLayout;
