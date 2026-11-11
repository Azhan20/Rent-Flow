import React, { useState } from 'react';
import {
  TrendingUp,
  Truck,
  Layers,
  Clock,
  AlertTriangle,
  DollarSign,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Wrench,
  Sparkles,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';

interface DashboardViewProps {
  onOpenNewBooking: () => void;
  onOpenAiCopilot: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewBooking,
  onOpenAiCopilot,
}) => {
  const { currentOrg, equipmentList, bookings, invoices, maintenanceOrders, setActiveView } = useRentFlow();
  const [dateFilter, setDateFilter] = useState<'30d' | '90d' | 'ytd'>('30d');

  // Compute stats across fleet
  let totalSerializedUnits = 0;
  let availableUnits = 0;
  let rentedUnits = 0;
  let reservedUnits = 0;
  let maintenanceUnits = 0;
  let totalFleetValue = 0;

  equipmentList.forEach((eq) => {
    totalFleetValue += eq.replacementValue * eq.totalStock;
    if (eq.isSerialized && eq.assetUnits) {
      totalSerializedUnits += eq.assetUnits.length;
      eq.assetUnits.forEach((u) => {
        if (u.status === 'AVAILABLE') availableUnits++;
        else if (u.status === 'CHECKED_OUT') rentedUnits++;
        else if (u.status === 'RESERVED') reservedUnits++;
        else if (u.status === 'MAINTENANCE') maintenanceUnits++;
      });
    } else {
      // Bulk item
      totalSerializedUnits += eq.totalStock;
      availableUnits += eq.totalStock;
    }
  });

  const utilizationRate = totalSerializedUnits > 0
    ? Math.round(((rentedUnits + reservedUnits) / totalSerializedUnits) * 100)
    : 0;

  // Financial metrics
  const totalRevenue = invoices.reduce((acc, inv) => acc + (inv.subtotal + inv.taxAmount + inv.deliveryFee), 0);
  const totalCollected = invoices.reduce((acc, inv) => acc + inv.amountPaid, 0);
  const outstandingBalance = Math.max(0, invoices.reduce((acc, inv) => acc + inv.totalDue - inv.amountPaid, 0));
  const depositsInEscrow = bookings.reduce((acc, b) => {
    if (b.status === 'CHECKED_OUT' || b.status === 'CONFIRMED') {
      return acc + (b.depositAmount || 0);
    }
    return acc;
  }, 0);

  const activeRentals = bookings.filter((b) => b.status === 'CHECKED_OUT');
  const upcomingPickups = bookings.filter((b) => b.status === 'CONFIRMED');
  const pendingRequests = bookings.filter((b) => b.status === 'REQUEST' || b.status === 'QUOTE');

  return (
    <div className="space-y-6">
      {/* Top Welcome & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {currentOrg.name} — Operations Command
          </h1>
          <p className="text-xs text-slate-500">
            Real-time fleet tracking, booking dispatch, and financial ledger for {currentOrg.locations.length} regional depots.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium text-slate-600 shadow-2xs">
            <button
              type="button"
              onClick={() => setDateFilter('30d')}
              className={`rounded-md px-2.5 py-1 ${dateFilter === '30d' ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-50'}`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('90d')}
              className={`rounded-md px-2.5 py-1 ${dateFilter === '90d' ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-50'}`}
            >
              Last Quarter
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('ytd')}
              className={`rounded-md px-2.5 py-1 ${dateFilter === 'ytd' ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-50'}`}
            >
              Year to Date
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenNewBooking}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Booking</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Fleet Utilization</span>
            <div className="rounded-md bg-blue-50 p-1.5 text-blue-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">{utilizationRate}%</span>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center">
              <ArrowUpRight className="h-3 w-3" /> +4.2%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${utilizationRate}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            {rentedUnits + reservedUnits} of {totalSerializedUnits} assets deployed/reserved
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active On Hire</span>
            <div className="rounded-md bg-amber-50 p-1.5 text-amber-600">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">{activeRentals.length}</span>
            <span className="text-[11px] text-slate-500">Contracts active</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            {upcomingPickups.length} confirmed pickups pending dispatch
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Invoiced Revenue</span>
            <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600">+$2,840</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            ${totalCollected.toLocaleString()} collected • ${outstandingBalance.toLocaleString()} due
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Escrow Deposits Held</span>
            <div className="rounded-md bg-purple-50 p-1.5 text-purple-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              ${depositsInEscrow.toLocaleString()}
            </span>
            <span className="text-[11px] text-purple-700 font-medium">Refundable</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Tracked as liability, reconciled upon return
          </p>
        </div>
      </div>

      {/* AI Intelligence Banner */}
      <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50/70 via-indigo-50/50 to-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-purple-600 p-2 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-purple-950">
              RentFlow Dispatch AI Insight
            </h3>
            <p className="text-xs text-purple-800/80 mt-0.5">
              High weekend demand projected for Earthmoving & Aerial Lifts. Suggest reviewing weekly rate optimization or querying live regional market rates with Google Search Grounding.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAiCopilot}
          className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 shadow-2xs shrink-0 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-purple-600" />
          <span>Ask Operations Copilot</span>
        </button>
      </div>

      {/* Two Column Grid: Fleet Distribution & Dispatch Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Upcoming Bookings & Dispatch */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Live Booking & Dispatch Schedule</h2>
              <p className="text-xs text-slate-500">Pickups, returns, and active customer contracts</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('bookings')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View All ({bookings.length}) <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {bookings.slice(0, 5).map((booking) => {
              const statusStyles: Record<string, string> = {
                CHECKED_OUT: 'bg-amber-50 text-amber-700 border-amber-200',
                CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
                REQUEST: 'bg-purple-50 text-purple-700 border-purple-200',
                RETURNED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                CLOSED: 'bg-slate-50 text-slate-600 border-slate-200',
              };

              return (
                <div key={booking.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {booking.bookingNumber}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                          statusStyles[booking.status] || 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        {booking.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 truncate mt-0.5">
                      {booking.customerName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {booking.items.map((i) => i.equipmentName).join(', ')}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-slate-900">
                      ${booking.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center justify-end gap-1 mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {booking.startDate} → {booking.endDate}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 col: Fleet Status & Depot Health */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900">Fleet Status Breakdown</h2>
            <p className="text-xs text-slate-500 mt-0.5">Real-time asset readiness</p>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Available for Hire
                  </span>
                  <span className="font-bold">{availableUnits}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(availableUnits / Math.max(1, totalSerializedUnits)) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500"></span> Checked Out (On Hire)
                  </span>
                  <span className="font-bold">{rentedUnits}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${(rentedUnits / Math.max(1, totalSerializedUnits)) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span> Reserved
                  </span>
                  <span className="font-bold">{reservedUnits}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(reservedUnits / Math.max(1, totalSerializedUnits)) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span> In Maintenance / Service
                  </span>
                  <span className="font-bold">{maintenanceUnits}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full"
                    style={{ width: `${(maintenanceUnits / Math.max(1, totalSerializedUnits)) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs border border-slate-200">
              <div className="flex items-center justify-between text-slate-600">
                <span>Total Insured Asset Value:</span>
                <span className="font-bold text-slate-900">${totalFleetValue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Quick Yard Telematics */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900">Regional Yard Hubs</h2>
            <div className="mt-3 space-y-2.5">
              {currentOrg.locations.map((loc) => (
                <div key={loc.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{loc.name}</p>
                    <p className="text-[11px] text-slate-400">{loc.code} • {loc.phone}</p>
                  </div>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
