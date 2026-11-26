import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Plus,
  Sparkles,
  Globe,
  LayoutDashboard,
  Check,
  ChevronDown,
  Menu,
  LogOut,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  mobileMenuOpen: boolean;
  onOpenMenu: () => void;
  onOpenNewBooking: () => void;
  onOpenAiCopilot: () => void;
  onOpenAuth?: (mode?: 'LOGIN' | 'PROFILE') => void;
}

export const Header: React.FC<HeaderProps> = ({ mobileMenuOpen, onOpenMenu, onOpenNewBooking, onOpenAiCopilot, onOpenAuth }) => {
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
  const orgSwitcherRef = useRef<HTMLDivElement>(null);
  const orgSwitcherButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mobileMenuOpen) setShowOrgDropdown(false);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!showOrgDropdown) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!orgSwitcherRef.current?.contains(event.target as Node)) {
        setShowOrgDropdown(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowOrgDropdown(false);
        orgSwitcherButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showOrgDropdown]);

  return (
    <header className="sticky top-0 z-30 flex min-h-16 w-full flex-col gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-xs sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:py-0">
      {/* Left: Organization Selector & Plan */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:hidden"
          aria-label="Open mobile navigation menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-drawer"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative" ref={orgSwitcherRef}>
          <button
            ref={orgSwitcherButtonRef}
            type="button"
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="flex min-h-11 max-w-[calc(100vw-5rem)] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:max-w-none sm:px-3"
            aria-label="Switch organization"
            aria-expanded={showOrgDropdown}
            aria-controls="organization-switcher-options"
          >
            <Building2 className="h-4 w-4 text-blue-600" />
            <span className="max-w-[140px] truncate sm:max-w-[160px]">{currentOrg.name}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </button>

          {showOrgDropdown && (
            <div id="organization-switcher-options" className="absolute left-0 z-50 mt-1 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
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
                  className={`flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
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

        <span className="hidden shrink-0 items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 sm:inline-flex">
          {currentOrg.planTier}
        </span>
      </div>

      {/* Right Controls: AI Copilot, booking, view toggle and session */}
      <div className="flex w-full min-w-0 items-center justify-end gap-1.5 sm:gap-2 md:gap-3 lg:w-auto">
        {/* AI Copilot & Market Intelligence Button */}
        <button
          type="button"
          onClick={onOpenAiCopilot}
          className="relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 sm:px-3"
          aria-label="Open RentFlow AI Copilot"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
          </span>
          <Sparkles className="h-3.5 w-3.5 text-purple-600" />
          <span className="hidden min-[1440px]:inline">AI Copilot & Market Intel</span>
          <span className="min-[1440px]:hidden">AI</span>
        </button>

        {/* Primary Action: New Booking */}
        {currentRole !== 'CUSTOMER' && (
          <button
            type="button"
            onClick={onOpenNewBooking}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:px-3"
            aria-label="Create new booking"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden min-[1440px]:inline">New Booking</span>
          </button>
        )}

        {/* View Marketing Website / App toggle */}
        <button
          type="button"
          onClick={() => setActiveView(activeView === 'website' ? 'dashboard' : 'website')}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          title="Toggle SaaS Marketing Website"
          aria-label={activeView === 'website' ? 'Return to dashboard' : 'Open marketing website'}
        >
          {activeView === 'website' ? (
            <>
              <LayoutDashboard className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden min-[1440px]:inline">Back to App</span>
            </>
          ) : (
            <>
              <Globe className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden min-[1440px]:inline">Marketing Site</span>
            </>
          )}
        </button>

        {/* User Account / Profile Button */}
        <button
          type="button"
          onClick={() => onOpenAuth?.(user ? 'PROFILE' : 'LOGIN')}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          title={user ? `Signed in as ${user.email}` : 'Sign in to RentFlow'}
          aria-label={user ? `Open profile for ${user.displayName || user.email || 'current account'}` : 'Sign in to RentFlow'}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">
            {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
          </div>
          <span className="hidden min-[1440px]:inline max-w-[100px] truncate text-slate-700 font-semibold">
            {user ? (user.displayName || user.email?.split('@')[0]) : 'Sign In'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          aria-label={`Sign out ${user?.email || 'current account'}`}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden min-[1440px]:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
};
