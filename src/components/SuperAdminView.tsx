import React, { useState } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Server,
  Activity,
  CheckCircle2,
  Lock,
  ArrowUpRight,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';

export const SuperAdminView: React.FC = () => {
  const { organizations, switchOrganization, currentOrg } = useRentFlow();
  const [activeTab, setActiveTab] = useState<'tenants' | 'audit' | 'subscriptions'>('tenants');

  // Platform Metrics
  const totalTenants = organizations.length;
  const platformMRR = 149 * 1 + 299 * 1; // Starter/Growth/Business tier pricing
  const totalEquipmentAcrossPlatform = 12;
  const platformBookings = 18;

  const auditEvents = [
    { id: 'aud-1', time: '10 mins ago', tenant: 'Apex Equipment Hire', event: 'RESERVATION_CONFIRMED', detail: 'Booking BK-2026-0044 created ($1,866.53)' },
    { id: 'aud-2', time: '1 hour ago', tenant: 'Apex Equipment Hire', event: 'DEPOSIT_ESCROW_SETTLED', detail: 'Deposit refunded $525.00 post-inspection' },
    { id: 'aud-3', time: '3 hours ago', tenant: 'Titan Plant & Machinery', event: 'TELEMATICS_ALERT', detail: 'Engine hour service interval reached (250h)' },
    { id: 'aud-4', time: '1 day ago', tenant: 'Apex Equipment Hire', event: 'SUBSCRIPTION_RENEWAL', detail: 'Growth Tier ($149/mo) processed successfully' },
    { id: 'aud-5', time: '2 days ago', tenant: 'Titan Plant & Machinery', event: 'DEPOT_ASSET_TRANSFERRED', detail: 'Unit EXC-003 relocated to Denver Hub' },
  ];

  const plans = [
    { name: 'Starter', price: '$79/mo', maxAssets: 'Up to 25 Units', users: '3 Staff', yards: '1 Depot', storefront: 'Basic' },
    { name: 'Growth', price: '$149/mo', maxAssets: 'Up to 100 Units', users: '10 Staff', yards: '3 Depots', storefront: 'Custom Domain + SSL' },
    { name: 'Business', price: '$299/mo', maxAssets: 'Up to 500 Units', users: 'Unlimited', yards: '10 Depots', storefront: 'Full Telematics & API' },
    { name: 'Enterprise', price: 'Custom', maxAssets: 'Unlimited Units', users: 'Dedicated DB', yards: 'Global', storefront: 'White-Label SSO' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-purple-100 text-purple-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-purple-200">
              Restricted Internal
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              RentFlow SaaS Super Admin
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-tenant orchestration, platform recurring revenue (MRR), subscription entitlements, and global security audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Multi-Tenant Isolation: Active
          </span>
        </div>
      </div>

      {/* Super Admin KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Platform MRR</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">${platformMRR}</p>
          <span className="text-[11px] font-semibold text-emerald-600 flex items-center mt-1">
            <ArrowUpRight className="h-3 w-3" /> +18.4% MoM
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Active Tenant Workspaces</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalTenants}</p>
          <p className="text-[11px] text-slate-400 mt-1">100% active trials</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Managed Equipment Fleet</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">37 Assets</p>
          <p className="text-[11px] text-slate-400 mt-1">Across 5 regional depots</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Total Rental Volume</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">$48,290</p>
          <p className="text-[11px] text-slate-400 mt-1">30-day processed contracts</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-xs font-bold text-slate-600 shadow-2xs w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('tenants')}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            activeTab === 'tenants' ? 'bg-purple-600 text-white' : 'hover:bg-slate-50'
          }`}
        >
          Tenant Directory ({organizations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('subscriptions')}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            activeTab === 'subscriptions' ? 'bg-purple-600 text-white' : 'hover:bg-slate-50'
          }`}
        >
          Plan Tiers & Limits
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            activeTab === 'audit' ? 'bg-purple-600 text-white' : 'hover:bg-slate-50'
          }`}
        >
          Platform Audit Log
        </button>
      </div>

      {/* Tenants Table */}
      {activeTab === 'tenants' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Tenant Organization</th>
                <th className="px-4 py-3">Slug / Subdomain</th>
                <th className="px-4 py-3">Plan Tier</th>
                <th className="px-4 py-3">Depots</th>
                <th className="px-4 py-3">Billing Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {organizations.map((org) => (
                <tr key={org.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{org.name}</p>
                    <p className="text-[11px] text-slate-400">{org.email}</p>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-slate-700">
                    {org.slug}.rentflow.app
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-purple-50 text-purple-700 px-2 py-0.5 text-[10px] font-bold border border-purple-200">
                      {org.planTier}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {org.locations.length} Locations
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                      <CheckCircle2 className="h-3 w-3" /> Paid & Current
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => switchOrganization(org.id)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        org.id === currentOrg.id
                          ? 'bg-slate-100 text-slate-400 cursor-default'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {org.id === currentOrg.id ? 'Current Active' : 'Impersonate / Inspect'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subscriptions Grid */}
      {activeTab === 'subscriptions' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {plans.map((p) => (
            <div key={p.name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 text-xs">
              <span className="font-bold text-slate-900 text-sm block">{p.name}</span>
              <p className="text-xl font-black text-blue-600">{p.price}</p>
              <div className="border-t border-slate-100 pt-3 space-y-1.5 text-slate-600">
                <p>Fleet Limit: <strong>{p.maxAssets}</strong></p>
                <p>Team Members: <strong>{p.users}</strong></p>
                <p>Locations: <strong>{p.yards}</strong></p>
                <p>Storefront: <strong>{p.storefront}</strong></p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Platform Audit Log */}
      {activeTab === 'audit' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-900">
            Immutable Audit Trail (Append-Only)
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {auditEvents.map((ev) => (
              <div key={ev.id} className="p-3.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      {ev.event}
                    </span>
                    <span className="font-semibold text-slate-800">{ev.tenant}</span>
                  </div>
                  <p className="text-slate-500 mt-1">{ev.detail}</p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{ev.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
