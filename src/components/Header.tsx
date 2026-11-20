import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Sparkles,
  Globe,
  LayoutDashboard,
  Check,
  ChevronDown,
  Bell,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onOpenNewBooking: () => void;
  onOpenAiCopilot: () => void;
  onOpenAuth?: (mode?: 'LOGIN' | 'PROFILE') => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewBooking, onOpenAiCopilot, onOpenAuth }) => {
  const { user, signOutUser } = useAuth();
  const {
    currentOrg,
    organizations,
    switchOrganization,
    currentRole,
    activeView,
    setActiveView,
  } = useRentFlow();

  const [showOrgDropdown, setShowOrgDropdown] = useState(false);

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
        {import.meta.env.DEV && (
          <span className="hidden md:inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
            DEVELOPMENT DEMO DATA
          </span>
        )}
      </div>

      {/* Right Controls: AI Copilot, booking, view toggle and session */}
      <div className="flex items-center gap-2 md:gap-3">
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

        {/* User Account / Profile Button */}
        <button
          type="button"
          onClick={() => onOpenAuth?.(user ? 'PROFILE' : 'LOGIN')}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          title={user ? `Signed in as ${user.email}` : 'Sign in to RentFlow'}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">
            {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
          </div>
          <span className="hidden sm:inline max-w-[100px] truncate text-slate-700 font-semibold">
            {user ? (user.displayName || user.email?.split('@')[0]) : 'Sign In'}
          </span>
        </button>
        <button type="button" onClick={() => void signOutUser()} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50" aria-label={`Sign out ${user?.email || 'current account'}`}>Sign out</button>
      </div>
    </header>
  );
};
