import React, { useState, useEffect } from 'react';
import { RentFlowProvider, useRentFlow } from './context/RentFlowContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { BookingsView } from './components/BookingsView';
import { HandoverInspectionView } from './components/HandoverInspectionView';
import { InvoicesView } from './components/InvoicesView';
import { CustomersView } from './components/CustomersView';
import { CalendarDispatchView } from './components/CalendarDispatchView';
import { MaintenanceView } from './components/MaintenanceView';
import { ReportsView } from './components/ReportsView';
import { StorefrontPreview } from './components/StorefrontPreview';
import { SuperAdminView } from './components/SuperAdminView';
import { PublicWebsiteView } from './components/PublicWebsiteView';
import { FleetMapView } from './components/FleetMapView';
import { ThreeEquipmentViewer } from './components/ThreeEquipmentViewer';
import { NewBookingModal } from './components/NewBookingModal';
import { AiCopilotDrawer } from './components/AiCopilotDrawer';
import { CsvImportModal } from './components/CsvImportModal';
import { Menu } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeView, setActiveView } = useRentFlow();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newBookingModalOpen, setNewBookingModalOpen] = useState(false);
  const [preSelectedEqId, setPreSelectedEqId] = useState<string | undefined>();
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false);
  const [csvImportModalOpen, setCsvImportModalOpen] = useState(false);
  const [inspectionTarget, setInspectionTarget] = useState<{
    bookingId?: string;
    type?: 'CHECKOUT' | 'RETURN';
  }>({});

  // Check URL query parameters (e.g. ?view=inventory or ?autostart=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam) {
      setActiveView(viewParam);
    }
  }, [setActiveView]);

  const handleOpenNewBookingWithItem = (equipmentId: string) => {
    setPreSelectedEqId(equipmentId);
    setNewBookingModalOpen(true);
  };

  const handleOpenInspection = (bookingId: string, type: 'CHECKOUT' | 'RETURN') => {
    setInspectionTarget({ bookingId, type });
    setActiveView('inspections');
  };

  // If in website marketing view, full-width presentation with option to return
  if (activeView === 'website') {
    return (
      <div className="min-h-screen bg-white">
        <PublicWebsiteView />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans antialiased text-slate-800">
      {/* Deep Navy Sidebar */}
      <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="relative">
          {/* Mobile hamburger trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="absolute left-3 top-4 z-40 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open mobile navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Header
            onOpenNewBooking={() => {
              setPreSelectedEqId(undefined);
              setNewBookingModalOpen(true);
            }}
            onOpenAiCopilot={() => setAiCopilotOpen(true)}
          />
        </div>

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {activeView === 'dashboard' && (
              <DashboardView
                onOpenNewBooking={() => {
                  setPreSelectedEqId(undefined);
                  setNewBookingModalOpen(true);
                }}
                onOpenAiCopilot={() => setAiCopilotOpen(true)}
              />
            )}

            {activeView === 'fleet_map' && <FleetMapView />}

            {activeView === 'machinery_3d' && (
              <div className="space-y-4">
                <ThreeEquipmentViewer />
              </div>
            )}

            {activeView === 'inventory' && (
              <InventoryView
                onOpenNewBookingWithItem={handleOpenNewBookingWithItem}
                onOpenAiCopilot={() => setAiCopilotOpen(true)}
                onOpenCsvImport={() => setCsvImportModalOpen(true)}
              />
            )}

            {activeView === 'bookings' && (
              <BookingsView
                onOpenNewBooking={() => {
                  setPreSelectedEqId(undefined);
                  setNewBookingModalOpen(true);
                }}
                onOpenHandoverInspection={handleOpenInspection}
              />
            )}

            {activeView === 'inspections' && (
              <HandoverInspectionView
                initialBookingId={inspectionTarget.bookingId}
                initialType={inspectionTarget.type}
              />
            )}

            {activeView === 'invoices' && <InvoicesView />}

            {activeView === 'customers' && <CustomersView />}

            {activeView === 'calendar' && <CalendarDispatchView />}

            {activeView === 'maintenance' && <MaintenanceView />}

            {activeView === 'reports' && <ReportsView />}

            {activeView === 'storefront' && <StorefrontPreview />}

            {activeView === 'superadmin' && <SuperAdminView />}
          </div>
        </main>
      </div>

      {/* Global Modals & Drawers */}
      <NewBookingModal
        isOpen={newBookingModalOpen}
        onClose={() => setNewBookingModalOpen(false)}
        preSelectedEquipmentId={preSelectedEqId}
      />

      <AiCopilotDrawer
        isOpen={aiCopilotOpen}
        onClose={() => setAiCopilotOpen(false)}
      />

      <CsvImportModal
        isOpen={csvImportModalOpen}
        onClose={() => setCsvImportModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <RentFlowProvider>
      <MainLayout />
    </RentFlowProvider>
  );
}
