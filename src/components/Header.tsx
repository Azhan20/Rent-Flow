import React, { useState } from 'react';
import {
  Building2,
  UserCheck,
  Plus,
  Sparkles,
  RotateCcw,
  Globe,
  LayoutDashboard,
  Check,
  ChevronDown,
  Bell,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { UserRole } from '../types';

interface HeaderProps {
  onOpenNewBooking: () => void;
  onOpenAiCopilot: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewBooking, onOpenAiCopilot }) => {
  const {
    currentOrg,
    organizations,
    switchOrganization,
    currentRole,
    setCurrentRole,
    activeView,
    setActiveView,
    resetToDemoDefaults,
  } = useRentFlow();

  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const roles: { role: UserRole; label: string; badgeColor: string }[] = [
    { role: 'ORG_OWNER', label: 'Organization Owner', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { role: 'MANAGER', label: 'Rental Manager', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { role: 'STAFF', label: 'Yard & Counter Staff', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
    { role: 'SUPER_ADMIN', label: 'SaaS Super Admin', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
    { role: 'CUSTOMER', label: 'Customer View', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  ];

  const currentRoleInfo = roles.find((r) => r.role === currentRole) || roles[0];

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 shadow-xs">
      {/* Left: Organization Selector & Plan */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            aria-label="Switch organization"
          >
            <Building2 className="h-4 w-4 text-blue-600" />
            <span className="max-w-[160px] truncate">{currentOrg.name}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </button>

          {showOrgDropdown && (
            <div className="absolute left-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-50">
              <div className="px-2 py-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                Switch Tenant Workspace
              </div>
              {organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => {
                    switchOrganization(org.id);
                    setShowOrgDropdown(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                    org.id === currentOrg.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <p className="font-semibold">{org.name}</p>
                    <p className="text-[11px] text-slate-500">{org.locations.length} yards • {org.planTier} tier</p>
                  </div>
                  {org.id === currentOrg.id && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="hidden sm:inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
          {currentOrg.planTier}
        </span>
      </div>

      {/* Right Controls: Role switcher, AI Copilot, + Booking, Reset, Mode Toggle */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Role Switcher for easy testing of RBAC */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className={`hidden lg:flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${currentRoleInfo.badgeColor}`}
            title="Click to simulate other user roles"
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Role: {currentRoleInfo.label}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>

          {showRoleDropdown && (
            <div className="absolute right-0 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-50">
              <div className="px-2 py-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                Simulate Role (RBAC)
              </div>
              {roles.map((r) => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => {
                    setCurrentRole(r.role);
                    setShowRoleDropdown(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    currentRole === r.role ? 'bg-slate-100 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{r.label}</span>
                  {currentRole === r.role && <Check className="h-3.5 w-3.5 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI Copilot & Market Intelligence Button */}
        <button
          type="button"
          onClick={onOpenAiCopilot}
          className="relative inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:from-purple-100 hover:to-indigo-100 transition-all shadow-xs"
          aria-label="Open RentFlow AI Copilot"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
          </span>
          <Sparkles className="h-3.5 w-3.5 text-purple-600" />
          <span className="hidden sm:inline">AI Copilot & Market Intel</span>
          <span className="sm:hidden">AI</span>
        </button>

        {/* Primary Action: New Booking */}
        {currentRole !== 'CUSTOMER' && (
          <button
            type="button"
            onClick={onOpenNewBooking}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden md:inline">New Booking</span>
          </button>
        )}

        {/* View Marketing Website / App toggle */}
        <button
          type="button"
          onClick={() => setActiveView(activeView === 'website' ? 'dashboard' : 'website')}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          title="Toggle SaaS Marketing Website"
        >
          {activeView === 'website' ? (
            <>
              <LayoutDashboard className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden md:inline">Back to App</span>
            </>
          ) : (
            <>
              <Globe className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden md:inline">Marketing Site</span>
            </>
          )}
        </button>

        {/* Reset Demo Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowResetConfirm(!showResetConfirm)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Reset demo data"
            aria-label="Reset demo data"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {showResetConfirm && (
            <div className="absolute right-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50 text-xs">
              <p className="font-semibold text-slate-800">Reset Demo Data?</p>
              <p className="mt-1 text-slate-500">
                Restores original sample equipment, bookings, customers, and invoices.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetToDemoDefaults();
                    setShowResetConfirm(false);
                  }}
                  className="rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white hover:bg-red-700"
                >
                  Reset All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
