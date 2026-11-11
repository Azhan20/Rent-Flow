import React, { useState, useMemo } from 'react';
import {
  Store,
  ExternalLink,
  Search,
  Filter,
  Truck,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Settings,
  X,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { EquipmentModel } from '../types';
import { calculateRentalCost } from '../utils/pricing';

export const StorefrontPreview: React.FC = () => {
  const { currentOrg, equipmentList, categories, createBooking, updateStorefront } = useRentFlow();

  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [quoteItem, setQuoteItem] = useState<EquipmentModel | null>(null);
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);

  // Quote Request Form State
  const [custName, setCustName] = useState('');
  const [custCompany, setCustCompany] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [quoteSubmittedRef, setQuoteSubmittedRef] = useState<string | null>(null);

  // Config State
  const [cfgHeading, setCfgHeading] = useState(currentOrg.storefront.heroHeading);
  const [cfgTagline, setCfgTagline] = useState(currentOrg.storefront.heroTagline);
  const [cfgPhone, setCfgPhone] = useState(currentOrg.storefront.contactPhone);
  const [cfgEmail, setCfgEmail] = useState(currentOrg.storefront.contactEmail);

  const filteredItems = equipmentList.filter((item) => {
    const matchesCat = selectedCat === 'all' || item.categoryId === selectedCat;
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const estimatedCost = useMemo(() => {
    if (!quoteItem) return null;
    return calculateRentalCost({
      startDate,
      endDate,
      rateCard: {
        dailyRate: quoteItem.dailyRate,
        weeklyRate: quoteItem.weeklyRate,
        monthlyRate: quoteItem.monthlyRate,
        securityDeposit: quoteItem.securityDeposit,
      },
      quantity: 1,
      taxRatePercent: currentOrg.taxRatePercent,
      deliveryFee: 100,
      pickupFee: 100,
    });
  }, [quoteItem, startDate, endDate, currentOrg]);

  const handleSubmitQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteItem || !custName || !custEmail || !termsAccepted || !estimatedCost) return;

    const created = createBooking({
      customerId: `cust-guest-${Date.now()}`,
      customerName: custCompany ? `${custName} (${custCompany})` : custName,
      customerEmail: custEmail,
      customerPhone: custPhone || '(512) 555-0199',
      locationId: currentOrg.locations[0]?.id || 'loc-1',
      startDate,
      endDate,
      status: 'REQUEST',
      items: [
        {
          id: `bi-${Date.now()}`,
          equipmentModelId: quoteItem.id,
          equipmentName: quoteItem.name,
          quantity: 1,
          dailyRate: quoteItem.dailyRate,
          totalDays: estimatedCost.durationDays,
          lineSubtotal: estimatedCost.subtotal,
          securityDeposit: estimatedCost.securityDeposit,
        },
      ],
      subtotal: estimatedCost.subtotal,
      discountPercent: 0,
      discountAmount: 0,
      taxRatePercent: currentOrg.taxRatePercent,
      taxAmount: estimatedCost.taxAmount,
      deliveryFee: estimatedCost.deliveryFee,
      pickupFee: estimatedCost.pickupFee,
      depositAmount: estimatedCost.securityDeposit,
      totalAmount: estimatedCost.totalRentalRevenue,
      totalDueNow: estimatedCost.totalDueNow,
      deliveryAddress: jobAddress || 'Site Delivery',
      customerNotes: `Online Storefront Quote Request. Contact: ${custPhone}`,
      internalNotes: `Received from public storefront on https://${currentOrg.storefront.subdomain}.rentflow.app`,
    });

    setQuoteSubmittedRef(created.bookingNumber);
  };

  const handleSaveStorefrontConfig = () => {
    updateStorefront({
      heroHeading: cfgHeading,
      heroTagline: cfgTagline,
      contactPhone: cfgPhone,
      contactEmail: cfgEmail,
    });
    setShowConfigDrawer(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Storefront Subdomain preview bar */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="rounded-md bg-blue-600 p-1.5 text-white">
            <Store className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
              Live Public Customer Storefront
            </span>
            <div className="flex items-center gap-1 text-xs font-mono font-bold text-slate-800">
              <span>https://{currentOrg.storefront.subdomain}.rentflow.app</span>
              <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[9px] font-sans">
                LIVE SSL
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfigDrawer(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Settings className="h-3.5 w-3.5 text-slate-500" />
            <span>Customize Storefront</span>
          </button>
        </div>
      </div>

      {/* Rendered Customer-Facing Storefront Container */}
      <div className="rounded-2xl border border-slate-300 bg-white shadow-md overflow-hidden">
        {/* Storefront Header */}
        <header className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm shadow-xs">
              {currentOrg.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm">{currentOrg.storefront.storeName}</span>
              <p className="text-[11px] text-slate-400">Serving Central Regional Job Sites</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-blue-600" />
              {currentOrg.storefront.contactPhone}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-blue-600" />
              {currentOrg.locations[0]?.address || 'Central Depot'}
            </span>
          </div>
        </header>

        {/* Hero Banner */}
        <div className="bg-slate-900 text-white px-6 py-12 text-center space-y-3 relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-2 relative z-10">
            <span className="rounded-full bg-blue-500/20 text-blue-300 px-3 py-1 text-xs font-semibold border border-blue-500/30">
              Commercial & Residential Equipment Hire
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {currentOrg.storefront.heroHeading}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {currentOrg.storefront.heroTagline}
            </p>
          </div>
        </div>

        {/* Category Pill Filters & Search */}
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCat('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedCat === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Equipment ({equipmentList.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCat(c.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedCat === c.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search catalog..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500"
              />
            </div>
          </div>

          {/* Catalog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 w-full bg-slate-100">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=800&q=80';
                      }}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-2.5 right-2.5">
                      <span className="rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-bold text-slate-900 shadow-xs">
                        From ${item.dailyRate}/day
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>

                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-50 p-2 text-center text-xs border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Daily</span>
                        <span className="font-bold text-slate-900">${item.dailyRate}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Weekly</span>
                        <span className="font-bold text-slate-900">${item.weeklyRate}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Monthly</span>
                        <span className="font-bold text-slate-900">${item.monthlyRate}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                  <button
                    type="button"
                    onClick={() => {
                      setQuoteItem(item);
                      setQuoteSubmittedRef(null);
                    }}
                    className="w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
                  >
                    Request Quote / Book Online
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Online Quote Request Modal */}
      {quoteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-xs">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">
                  Instant Rental Quote Inquiry
                </span>
                <h3 className="text-lg font-bold text-slate-900">{quoteItem.name}</h3>
                <p className="text-xs text-slate-500">
                  Calculated based on {currentOrg.name} rate card and delivery options.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuoteItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {quoteSubmittedRef ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-3">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <h4 className="text-base font-bold text-emerald-950">
                  Quote Request Received!
                </h4>
                <p className="text-xs text-emerald-800">
                  Your reservation reference is{' '}
                  <strong className="font-mono font-bold text-emerald-900">
                    {quoteSubmittedRef}
                  </strong>
                  . Our dispatch team has received your request and will contact you within 30 minutes to confirm logistics.
                </p>
                <button
                  type="button"
                  onClick={() => setQuoteItem(null)}
                  className="rounded-lg bg-emerald-700 px-5 py-2 font-bold text-white hover:bg-emerald-800"
                >
                  Return to Storefront
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitQuote} className="space-y-4">
                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Required Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-2 font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Estimated Return Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-2 font-semibold text-slate-900"
                    />
                  </div>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Your Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Michael Ross"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Company / Contractor</label>
                    <input
                      type="text"
                      placeholder="e.g. Ross Civil Engineering"
                      value={custCompany}
                      onChange={(e) => setCustCompany(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-2 text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="michael@rosscivil.com"
                      value={custEmail}
                      onChange={(e) => setCustEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Phone Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="(512) 555-0182"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-2 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Jobsite Delivery Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1200 Congress Ave, Austin, TX"
                    value={jobAddress}
                    onChange={(e) => setJobAddress(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-slate-900"
                  />
                </div>

                {/* Estimate Cost Card */}
                {estimatedCost && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-1">
                    <div className="flex justify-between">
                      <span>Rental Period:</span>
                      <span className="font-bold">{estimatedCost.durationDays} Days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Equipment Subtotal:</span>
                      <span className="font-bold">${estimatedCost.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Logistics Transport:</span>
                      <span className="font-bold">$200.00</span>
                    </div>
                    <div className="flex justify-between text-purple-700">
                      <span>Refundable Security Deposit:</span>
                      <span className="font-bold">${estimatedCost.securityDeposit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-slate-950 border-t border-blue-200 pt-1">
                      <span>Total Estimated Due:</span>
                      <span className="text-blue-700 font-extrabold">
                        ${estimatedCost.totalDueNow.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-600">
                    I agree to the standard equipment rental terms and condition checklist.
                  </span>
                </label>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setQuoteItem(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!termsAccepted}
                    className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Submit Booking Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Storefront Customizer Drawer */}
      {showConfigDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Customize Storefront Branding</h3>
                <p className="text-slate-500">Configure public customer portal headings and contact info.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigDrawer(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Hero Heading</label>
                <input
                  type="text"
                  value={cfgHeading}
                  onChange={(e) => setCfgHeading(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Hero Tagline</label>
                <textarea
                  rows={2}
                  value={cfgTagline}
                  onChange={(e) => setCfgTagline(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={cfgPhone}
                    onChange={(e) => setCfgPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={cfgEmail}
                    onChange={(e) => setCfgEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfigDrawer(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStorefrontConfig}
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
              >
                Save Branding
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
