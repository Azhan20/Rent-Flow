import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  CalendarCheck,
  ClipboardCheck,
  Receipt,
  Users,
  MapPin,
  Wrench,
  BarChart3,
  Store,
  Globe,
  HardHat,
  X,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const { activeView, setActiveView, bookings, invoices, maintenanceOrders } = useRentFlow();
  const [isDesktop, setIsDesktop] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const updateViewport = () => setIsDesktop(desktopQuery.matches);
    updateViewport();
    desktopQuery.addEventListener('change', updateViewport);
    return () => desktopQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    if (isDesktop && mobileOpen) setMobileOpen(false);
  }, [isDesktop, mobileOpen, setMobileOpen]);

  useEffect(() => {
    if (!mobileOpen || isDesktop) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawerRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawerRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (previousFocusRef.current?.isConnected && previousFocusRef.current.getClientRects().length > 0) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
    };
  }, [isDesktop, mobileOpen, setMobileOpen]);

  const activeBookingsCount = bookings.filter((b) => b.status === 'CHECKED_OUT' || b.status === 'CONFIRMED').length;
  const overdueInvoicesCount = invoices.filter((i) => i.status === 'OVERDUE' || (i.status === 'SENT' && new Date(i.dueDate) < new Date())).length;
  const urgentMaintenanceCount = maintenanceOrders.filter((m) => m.status === 'IN_PROGRESS' || m.priority === 'HIGH').length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'fleet_map', label: 'Fleet GPS Map', icon: MapPin },
    { id: 'machinery_3d', label: '3D Machinery Studio', icon: HardHat },
    { id: 'inventory', label: 'Fleet & Inventory', icon: Layers },
    { id: 'bookings', label: 'Bookings & Quotes', icon: CalendarCheck, badge: activeBookingsCount },
    { id: 'inspections', label: 'Handover & Returns', icon: ClipboardCheck },
    { id: 'invoices', label: 'Invoices & Payments', icon: Receipt, badge: overdueInvoicesCount, badgeAlert: overdueInvoicesCount > 0 },
    { id: 'customers', label: 'Customer CRM', icon: Users },
    { id: 'calendar', label: 'Dispatch & Yards', icon: CalendarCheck },
    { id: 'maintenance', label: 'Maintenance & Service', icon: Wrench, badge: urgentMaintenanceCount },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'storefront', label: 'Public Storefront', icon: Store },
  ];

  const handleSelect = (id: string) => {
    setActiveView(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 cursor-pointer overscroll-none bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        ref={drawerRef}
        id="mobile-nav-drawer"
        aria-label="Main navigation"
        role={!isDesktop && mobileOpen ? 'dialog' : undefined}
        aria-modal={!isDesktop && mobileOpen ? true : undefined}
        aria-hidden={!isDesktop && !mobileOpen}
        inert={!isDesktop && !mobileOpen}
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[calc(100vw-1rem)] flex-col overscroll-contain border-r border-slate-800 bg-slate-950 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-slate-300 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-800/80 px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <HardHat className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-white">RentFlow</span>
            </div>
            <p className="text-[11px] text-slate-400">Equipment Rental SaaS</p>
          </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setMobileOpen(false)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-900 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 lg:hidden"
            aria-label="Close mobile navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4" aria-label="Rental operations">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Rental Operations
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      item.badgeAlert
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-4 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Public Presence
          </div>

          <button
            type="button"
            onClick={() => handleSelect('website')}
            className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
              activeView === 'website'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Globe className="h-4 w-4 text-slate-400" />
            <span>Public SaaS Website</span>
          </button>
        </nav>

      </aside>
    </>
  );
};
