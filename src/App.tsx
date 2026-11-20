import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { PublicWebsiteView } from './components/PublicWebsiteView';
import { FleetMapView } from './components/FleetMapView';
import { ThreeEquipmentViewer } from './components/ThreeEquipmentViewer';
import { NewBookingModal } from './components/NewBookingModal';
import { AiCopilotDrawer } from './components/AiCopilotDrawer';
import { CsvImportModal } from './components/CsvImportModal';
import { AuthModal } from './components/AuthModal';
import { CheckoutModal } from './components/CheckoutModal';
import { Menu } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { WorkspaceSetup } from './components/WorkspaceSetup';

const MainLayout: React.FC = () => {
  const { activeView, setActiveView } = useRentFlow();
  const { user, pendingPlan, setPendingPlan } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newBookingModalOpen, setNewBookingModalOpen] = useState(false);
  const [preSelectedEqId, setPreSelectedEqId] = useState<string | undefined>();
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false);
  const [csvImportModalOpen, setCsvImportModalOpen] = useState(false);

  // Auth and subscription checkout states
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT' | 'PROFILE'>('LOGIN');
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutPlanName, setCheckoutPlanName] = useState('Growth Fleet');
  const [checkoutBillingCycle, setCheckoutBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

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
        <PublicWebsiteView
          onPlanSelected={(plan, cycle) => {
            setCheckoutPlanName(plan);
            setCheckoutBillingCycle(cycle);
          }}
          onOpenAuthModal={(mode) => {
            setAuthModalMode(mode);
            setAuthModalOpen(true);
          }}
          onOpenCheckoutModal={(plan, cycle) => {
            if (import.meta.env.DEV) {
              setCheckoutPlanName(plan);
              setCheckoutBillingCycle(cycle);
              setCheckoutModalOpen(true);
            } else {
              setPendingPlan(plan);
            }
          }}
          onOpenDashboard={() => setActiveView('dashboard')}
        />

        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authModalMode}
          onAuthSuccess={() => {
            if (pendingPlan && import.meta.env.DEV) {
              setCheckoutPlanName(pendingPlan);
              setCheckoutModalOpen(true);
            }
          }}
        />

        <CheckoutModal
          isOpen={checkoutModalOpen}
          onClose={() => setCheckoutModalOpen(false)}
          planName={checkoutPlanName}
          billingCycle={checkoutBillingCycle}
          onSubscriptionSuccess={() => {
            setPendingPlan(null);
            setActiveView('dashboard');
          }}
        />
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
            onOpenAuth={(mode) => {
              setAuthModalMode(mode || 'LOGIN');
              setAuthModalOpen(true);
            }}
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

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onAuthSuccess={() => {
          if (pendingPlan) {
            setCheckoutPlanName(pendingPlan);
            setCheckoutModalOpen(true);
          }
        }}
      />

      <CheckoutModal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        planName={checkoutPlanName}
        billingCycle={checkoutBillingCycle}
        onSubscriptionSuccess={() => {
          setPendingPlan(null);
          setActiveView('dashboard');
        }}
      />
    </div>
  );
};

function PublicMarketingExperience() {
  const { pendingPlan, setPendingPlan } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT' | 'PROFILE'>('LOGIN');
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutPlanName, setCheckoutPlanName] = useState('Growth Fleet');
  const [checkoutBillingCycle, setCheckoutBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <RentFlowProvider>
      <>
        <PublicWebsiteView
          onPlanSelected={(plan, cycle) => {
            setCheckoutPlanName(plan);
            setCheckoutBillingCycle(cycle);
          }}
          onOpenAuthModal={(mode) => {
            setAuthModalMode(mode);
            setAuthModalOpen(true);
          }}
          onOpenCheckoutModal={(plan, cycle) => {
            if (import.meta.env.DEV) {
              setCheckoutPlanName(plan);
              setCheckoutBillingCycle(cycle);
              setCheckoutModalOpen(true);
            } else {
              setPendingPlan(plan);
            }
          }}
          onOpenDashboard={() => window.location.assign('/?auth=login')}
        />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authModalMode}
          onAuthSuccess={() => {
            if (pendingPlan && import.meta.env.DEV) {
              setCheckoutPlanName(pendingPlan);
              setCheckoutModalOpen(true);
            }
          }}
        />
        <CheckoutModal
          isOpen={checkoutModalOpen}
          onClose={() => setCheckoutModalOpen(false)}
          planName={checkoutPlanName}
          billingCycle={checkoutBillingCycle}
          onSubscriptionSuccess={() => {
            setPendingPlan(null);
            setCheckoutModalOpen(false);
          }}
        />
      </>
    </RentFlowProvider>
  );
}

function AuthenticatedApplication() {
  const { user, loading, pendingPlan } = useAuth();
  const query = new URLSearchParams(window.location.search);
  const planIds: Record<string, string> = { 'starter-depot': 'Starter Depot', 'growth-fleet': 'Growth Fleet', 'business-multi-yard': 'Business Multi-Yard' };
  const selectedPlan = planIds[query.get('plan') || ''];
  const initialMode = query.get('auth') === 'signup' ? 'signup' : 'login';

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-white">Loading secure session…</div>;
  if (!user && !query.has('auth')) return <PublicMarketingExperience />;
  if (!user) return <AuthScreen selectedPlan={selectedPlan} initialMode={initialMode} />;
  if (pendingPlan && !import.meta.env.DEV) {
    if (!user.emailVerified) return <AuthScreen selectedPlan={pendingPlan} initialMode={initialMode} />;
    return <WorkspaceSetup selectedPlan={pendingPlan} billingCycle={query.get('cycle') === 'yearly' ? 'yearly' : 'monthly'} />;
  }
  if (pendingPlan && !query.has('auth')) return <PublicMarketingExperience />;
  if (!user.emailVerified) return <AuthScreen selectedPlan={selectedPlan} initialMode={initialMode} />;

  if (!import.meta.env.DEV) return <WorkspaceSetup selectedPlan={selectedPlan} billingCycle={query.get('cycle') === 'yearly' ? 'yearly' : 'monthly'} />;

  return <RentFlowProvider><MainLayout /></RentFlowProvider>;
}

export default function App() {
  return (
    <AuthProvider><AuthenticatedApplication /></AuthProvider>
  );
}
