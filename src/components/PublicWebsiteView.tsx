import React, { useState } from 'react';
import {
  HardHat,
  Truck,
  CalendarCheck,
  Store,
  Wrench,
  ArrowRight,
  Layers,
  Sparkles,
  Zap,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePageMetadata } from '../lib/pageMetadata';

interface PublicWebsiteViewProps {
  onOpenAuthModal?: (mode: 'LOGIN' | 'REGISTER' | 'PROFILE') => void;
  onOpenDashboard?: () => void;
}

export const PublicWebsiteView: React.FC<PublicWebsiteViewProps> = ({
  onOpenAuthModal,
  onOpenDashboard,
}) => {
  usePageMetadata('RentFlow | Equipment rental operations', true);
  const { user } = useAuth();
  const [activeIndustry, setActiveIndustry] = useState<string>('construction');

  const industries = [
    {
      id: 'construction',
      name: 'Heavy Civil & Plant Hire',
      icon: HardHat,
      headline: 'Construction and plant-hire equipment',
      desc: 'Create equipment listings, maintain customer records, and submit rental requests. Dispatch, inspections, maintenance, and telematics workflows are not available yet.',
    },
    {
      id: 'aerial',
      name: 'Boom & Scissor Lifts',
      icon: Truck,
      headline: 'Aerial lift equipment',
      desc: 'Create equipment listings, maintain customer records, and submit rental requests. Dispatch, inspections, maintenance, and telematics workflows are not available yet.',
    },
    {
      id: 'power',
      name: 'Power & Climate Generation',
      icon: Zap,
      headline: 'Power-generation equipment',
      desc: 'Create equipment listings, maintain customer records, and submit rental requests. Dispatch, inspections, maintenance, and telematics workflows are not available yet.',
    },
    {
      id: 'tools',
      name: 'Tools & General Plant',
      icon: Wrench,
      headline: 'Tools and general plant equipment',
      desc: 'Create equipment listings, maintain customer records, and submit rental requests. Dispatch, inspections, maintenance, and telematics workflows are not available yet.',
    },
  ];

  const currentInd = industries.find((i) => i.id === activeIndustry) || industries[0];

  const faqs = [
    {
      q: 'How does RentFlow prevent equipment double-booking?',
      a: 'Rental requests are checked on the server against equipment availability for the requested dates. Requests remain pending review; maintenance blocks and turnaround buffers are not part of this workflow.',
    },
    {
      q: 'How are security deposits managed in RentFlow?',
      a: 'Rental requests include an estimated deposit amount. Deposit collection, refunds, and return deductions are not connected to a payment workflow yet.',
    },
    {
      q: 'Can customers book directly through our own website?',
      a: 'No. The current workspace supports internal rental requests. A public storefront, custom domains, and customer quote intake are not available yet.',
    },
    {
      q: 'Is AI available in RentFlow?',
      a: 'Authenticated Gemini chat and market-research API endpoints require a server-side Gemini API key, but no AI workspace panel is currently available. They do not read organization records, and usage entitlements are not implemented.',
    },
  ];

  return (
    <div className="bg-white text-slate-900 min-h-screen">
      {/* SaaS Marketing Top Bar */}
      <div className="flex flex-col gap-2 border-b border-slate-800 bg-slate-950 px-4 py-2 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true"></span>
          <span className="truncate">Next-Gen Equipment Rental Software for Modern Plant & Tool Hire</span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end">
          <span className="hidden md:inline text-slate-400">Private beta · development in progress</span>
          {user ? (
            <button
              type="button"
              onClick={() => {
                if (onOpenAuthModal) onOpenAuthModal('PROFILE');
                else window.location.assign('/?auth=login');
              }}
              className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
              title="View account profile"
              aria-label="View account profile"
            >
              <div className="h-4 w-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="max-w-[110px] truncate text-[11px] font-medium">{user.displayName || user.email}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (onOpenAuthModal) onOpenAuthModal('LOGIN');
                else window.location.assign('/?auth=login');
              }}
              className="min-h-11 rounded-md px-2 py-1 font-medium text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              Sign In
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (onOpenDashboard) onOpenDashboard();
              else if (onOpenAuthModal) onOpenAuthModal('LOGIN');
              else window.location.assign('/?auth=login');
            }}
            className="inline-flex min-h-11 items-center gap-1 font-semibold text-xs text-white transition-colors hover:text-blue-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            <span>App Dashboard</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-950 px-4 py-14 text-white sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="mx-auto inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3.5 py-2 text-center text-xs font-semibold text-blue-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Multi-Tenant Equipment Rental Management SaaS</span>
          </div>

          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Manage equipment and rental requests with{' '}
            <span className="text-blue-300">
              organization-scoped controls
            </span>{' '}
            and a clear path to complete rental operations.
          </h1>

          <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-300 sm:text-lg sm:leading-7">
            From CAT mini excavators and boom lifts to towable generators and site safety gear.
            RentFlow currently supports authenticated organization setup, equipment and customer records, and server-checked rental requests. Other rental and billing workflows are not available.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => window.location.assign('/?auth=signup')}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 sm:w-auto"
            >
              <span>Create your workspace</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => window.location.assign('/?auth=login')}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-6 py-3.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 sm:w-auto"
            >
              <Store className="h-4 w-4 text-slate-400" />
              <span>Sign in to continue</span>
            </button>
          </div>
        </div>
      </section>

      {/* Feature Pillars Grid */}
      <section className="mx-auto max-w-6xl space-y-10 px-4 py-14 sm:space-y-12 sm:py-16">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Available Workflows
          </h2>
          <h3 className="text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Core organization and rental request management
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 sm:p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Authenticated workspaces</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Firebase email/password and Google sign-in protect verified accounts. Create an organization and establish its owner membership.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 sm:p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Layers className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Equipment and customer records</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Add and view organization-scoped equipment and customer records stored in PostgreSQL.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 sm:p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Rental requests</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              The server calculates rates and checks requested quantity against availability. A request is pending review, not a confirmed booking.
            </p>
          </div>
        </div>
      </section>

      {/* Industry Verticals Section */}
      <section className="border-y border-slate-200 bg-slate-50 px-4 py-14 sm:py-16">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Equipment types
            </h2>
            <h3 className="text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Manage equipment and rental requests
            </h3>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {industries.map((ind) => {
              const Icon = ind.icon;
              return (
                <button
                  key={ind.id}
                  type="button"
                  onClick={() => setActiveIndustry(ind.id)}
                  aria-pressed={activeIndustry === ind.id}
                  className={`flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${
                    activeIndustry === ind.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{ind.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-start justify-between gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-8 md:flex-row md:items-center">
            <div className="min-w-0 max-w-xl space-y-3">
              <h4 className="text-xl font-bold text-slate-900">{currentInd.headline}</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{currentInd.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => window.location.assign('/?auth=signup')}
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
            >
              <span>Create your workspace</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="mx-auto max-w-6xl space-y-10 px-4 py-14 sm:space-y-12 sm:py-20">
        <div className="text-center space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Plans and billing
          </h2>
          <h3 className="text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Subscription setup is not available
          </h3>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-600">
            No payment provider, trial, or subscription is configured. Creating an account and workspace does not activate a paid plan or start a trial.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-t border-slate-200 bg-slate-50 px-4 py-14 sm:py-16">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Frequently Asked Questions
            </h2>
            <h3 className="text-balance text-2xl font-bold text-slate-900 sm:text-3xl">
              Clear answers for rental business owners
            </h3>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
                <h4 className="font-bold text-slate-900 text-sm">{faq.q}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 px-4 py-10 text-xs text-slate-400 sm:py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
              <HardHat className="h-4 w-4" />
            </div>
            <span className="font-bold text-white text-sm">RentFlow</span>
            <span className="text-slate-500">• B2B Equipment Rental Management</span>
          </div>

          <p className="text-slate-500">
            © {new Date().getFullYear()} RentFlow Systems Inc. Multi-tenant architecture. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};
