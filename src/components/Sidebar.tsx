import React from 'react';
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
  ShieldAlert,
  Globe,
  HardHat,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const { activeView, setActiveView, bookings, invoices, maintenanceOrders, currentRole } = useRentFlow();

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

  if (currentRole === 'SUPER_ADMIN' || currentRole === 'ORG_OWNER') {
    navItems.push({ id: 'superadmin', label: 'Super Admin Console', icon: ShieldAlert });
  }

  const handleSelect = (id: string) => {
    setActiveView(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-950 text-slate-300 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-800/80 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <HardHat className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-white">RentFlow</span>
              <span className="rounded bg-blue-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Equipment Rental SaaS</p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
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
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
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
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              activeView === 'website'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Globe className="h-4 w-4 text-slate-400" />
            <span>Public SaaS Website</span>
          </button>
        </div>

        {/* Bottom Depot Live Status */}
        <div className="border-t border-slate-800/80 p-3.5">
          <div className="rounded-lg bg-slate-900/90 p-2.5 text-xs border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300">Dispatch Telematics</span>
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ONLINE
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">All 3 regional depots synced. GPS & meter readings streaming.</p>
          </div>
        </div>
      </aside>
    </>
  );
};
