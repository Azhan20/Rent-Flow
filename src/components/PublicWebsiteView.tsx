import React, { useState } from 'react';
import {
  HardHat,
  Truck,
  CalendarCheck,
  ClipboardCheck,
  Receipt,
  Store,
  Wrench,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Layers,
  Sparkles,
  Zap,
  Clock,
  MapPin,
  Building2,
  DollarSign,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';

export const PublicWebsiteView: React.FC = () => {
  const { setActiveView } = useRentFlow();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [activeIndustry, setActiveIndustry] = useState<string>('construction');

  const industries = [
    {
      id: 'construction',
      name: 'Heavy Civil & Plant Hire',
      icon: HardHat,
      headline: 'Built for excavators, rollers, backhoes & telehandlers',
      desc: 'Track engine hours, prevent double-booking on major job sites, schedule 250h hydraulic services, and mandate digital return inspections.',
      stats: '68% faster field check-outs',
    },
    {
      id: 'aerial',
      name: 'Boom & Scissor Lifts',
      icon: Truck,
      headline: 'Safety certifications & OSHA rigging compliance',
      desc: 'Keep track of ANSI/OSHA annual inspections, platform capacity limits, and multi-week commercial tier contract billing.',
      stats: 'Zero lost transport turnaround',
    },
    {
      id: 'power',
      name: 'Power & Climate Generation',
      icon: Zap,
      headline: 'Towable WhisperWatt generators & light towers',
      desc: 'Manage fuel level surcharges, sound-attenuation ratings (dBA), weekend event surge pricing, and cable ramp bulk bundles.',
      stats: '99.8% on-time dispatch SLA',
    },
    {
      id: 'tools',
      name: 'Tools & General Plant',
      icon: Wrench,
      headline: 'Compactors, trenchers, concrete saws & pumps',
      desc: 'Rapid counter POS checkouts, consumable blade billing, barcode scanning, and instant driver license capture.',
      stats: '15-second customer pickup',
    },
  ];

  const currentInd = industries.find((i) => i.id === activeIndustry) || industries[0];

  const plans = [
    {
      name: 'Starter Depot',
      monthlyPrice: 79,
      yearlyPrice: 65,
      desc: 'Essential rental management for single-yard equipment shops.',
      features: [
        'Up to 25 Serialized & Bulk Assets',
        'Single Depot / Yard Location',
        'Online Booking Request Form',
        'Digital Handover Checklist',
        'PDF Invoices & Receipt Generator',
        'Standard Email Support',
      ],
      popular: false,
    },
    {
      name: 'Growth Fleet',
      monthlyPrice: 149,
      yearlyPrice: 119,
      desc: 'Full-featured operations platform for growing regional rental companies.',
      features: [
        'Up to 100 Assets & Telematics Units',
        'Up to 3 Regional Depot Yards',
        'Custom Branded Public Storefront',
        'Engine Hour Preventive Service Alerts',
        'Damage Photo & Deposit Escrow Engine',
        'RentFlow Copilot AI Dispatch Assistant',
        'Priority Technical Support',
      ],
      popular: true,
    },
    {
      name: 'Business Multi-Yard',
      monthlyPrice: 299,
      yearlyPrice: 239,
      desc: 'High-volume plant hire with multi-branch logistics and telematics.',
      features: [
        'Up to 500 Fleet Assets',
        'Up to 10 Regional Yards & Transfers',
        'Custom Domain + SSL Storefront',
        'Google Search Market Rate Grounding',
        'Net 30 Credit Limit CRM Tracking',
        'Full REST API & Webhook Access',
        'Dedicated Fleet Account Manager',
      ],
      popular: false,
    },
  ];

  const faqs = [
    {
      q: 'How does RentFlow prevent equipment double-booking?',
      a: 'Our availability engine verifies overlapping date intervals with customizable cleaning/turnaround buffers (e.g. 2 hours) and checks against scheduled maintenance work orders before any reservation is confirmed.',
    },
    {
      q: 'How are security deposits managed in RentFlow?',
      a: 'Deposits are strictly tracked as refundable liabilities, completely separated from rental operating revenue. When an asset is returned, any damage, cleaning, or refueling fees are itemized, and the net refund is calculated automatically.',
    },
    {
      q: 'Can customers book directly through our own website?',
      a: 'Yes! Every tenant gets a dedicated, branded storefront (e.g. yourcompany.rentflow.app or a custom domain) with live catalog browsing, rate calculations, and instant quote inquiries that feed directly into your booking queue.',
    },
    {
      q: 'Does RentFlow integrate with AI and live market intelligence?',
      a: 'Yes. RentFlow comes with an AI Fleet Copilot that can answer operational questions, draft lease clauses, and query live regional equipment rental benchmarks using Google Search Grounding.',
    },
  ];

  return (
    <div className="bg-white text-slate-900 min-h-screen">
      {/* SaaS Marketing Top Bar */}
      <div className="bg-slate-950 text-slate-300 text-xs py-2 px-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
          <span>Next-Gen Equipment Rental Software for Modern Plant & Tool Hire</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400">SOC-Ready Architecture</span>
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className="text-white font-semibold hover:text-blue-400 transition-colors"
          >
            Go to App Dashboard →
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Multi-Tenant Equipment Rental Management SaaS</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Manage your rental fleet with{' '}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
              zero overbooking
            </span>{' '}
            and instant digital handovers.
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300">
            From CAT mini excavators and boom lifts to towable generators and site safety gear.
            RentFlow handles reservations, meter telematics, return inspections, deposit escrow, and online customer storefronts.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition-all"
            >
              <span>Explore Live Workspace Demo</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setActiveView('storefront')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3.5 text-sm font-bold text-slate-200 hover:bg-slate-800 transition-all"
            >
              <Store className="h-4 w-4 text-slate-400" />
              <span>Preview Customer Storefront</span>
            </button>
          </div>
        </div>
      </section>

      {/* Feature Pillars Grid */}
      <section className="py-16 px-4 max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">
            End-to-End Rental Operations
          </h2>
          <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Everything your rental counter and yard needs
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-blue-200 transition-all space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Mathematical Availability Engine</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Interval overlap checks, turnaround cleaning buffers, and maintenance block detection ensure serial numbers and bulk stock never get double-booked.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-blue-200 transition-all space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Digital Check-out & Return Inspections</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tablet-ready 6-point condition checks, digital signature pads, hour meter tracking, damage fee reconciliation, and instant deposit escrow refunds.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-blue-200 transition-all space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Gemini AI Copilot & Market Search</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Integrated operations assistant powered by Gemini 3.8 Flash with Google Search Grounding for live regional equipment rental rate benchmarking.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-blue-200 transition-all space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Store className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">White-Label Online Storefront</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mobile-optimized catalog for each tenant with automated quote estimates, customer intake, and instant reservation synchronization.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-blue-200 transition-all space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Wrench className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Telematics & Preventive Service</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Automated service orders triggered when engine hours pass thresholds (250h, 500h, 1000h). Equipment is taken offline during scheduled shop hours.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-blue-200 transition-all space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Receipt className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Automated Invoices & Escrow Ledgers</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sequential organization numbering, multi-tier pricing (daily, weekly, monthly), delivery charges, tax calculation, and separated deposit liabilities.
            </p>
          </div>
        </div>
      </section>

      {/* Industry Verticals Section */}
      <section className="bg-slate-50 py-16 px-4 border-y border-slate-200">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Tailored by Equipment Class
            </h2>
            <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Designed for industrial equipment workflows
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
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                    activeIndustry === ind.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{ind.name}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <span className="rounded-md bg-blue-50 text-blue-700 px-2.5 py-1 text-xs font-bold">
                {currentInd.stats}
              </span>
              <h4 className="text-xl font-bold text-slate-900">{currentInd.headline}</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{currentInd.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('inventory')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors shrink-0"
            >
              <span>View Fleet Inventory</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Transparent Pricing
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Simple plans that scale with your fleet size
          </h3>

          <div className="flex items-center justify-center gap-3 pt-2">
            <span className={`text-xs font-bold ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>
              Monthly
            </span>
            <button
              type="button"
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-xs font-bold ${billingCycle === 'yearly' ? 'text-slate-900' : 'text-slate-400'}`}>
              Annual <span className="text-emerald-600 font-extrabold">(Save 20%)</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 flex flex-col justify-between transition-all ${
                  plan.popular
                    ? 'border-2 border-blue-600 bg-white shadow-xl shadow-blue-500/10'
                    : 'border border-slate-200 bg-white shadow-xs'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-lg">{plan.name}</h4>
                    {plan.popular && (
                      <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase">
                        Most Popular
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500">{plan.desc}</p>

                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900">${price}</span>
                    <span className="text-xs text-slate-500 font-medium">/month billed {billingCycle}</span>
                  </div>

                  <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs text-slate-700">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="button"
                    onClick={() => setActiveView('dashboard')}
                    className={`w-full rounded-xl py-2.5 text-xs font-bold transition-all ${
                      plan.popular
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20'
                        : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    Start 14-Day Free Trial
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-slate-50 py-16 px-4 border-t border-slate-200">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Frequently Asked Questions
            </h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Clear answers for rental business owners
            </h3>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">{faq.q}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 px-4 text-xs border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
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
