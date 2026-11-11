import React, { useState } from 'react';
import {
  CalendarDays,
  Search,
  Filter,
  Plus,
  ArrowRight,
  ClipboardCheck,
  Receipt,
  Clock,
  ShieldCheck,
  Truck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { Booking, BookingStatus } from '../types';

interface BookingsViewProps {
  onOpenNewBooking: () => void;
  onOpenHandoverInspection: (bookingId: string, type: 'CHECKOUT' | 'RETURN') => void;
}

export const BookingsView: React.FC<BookingsViewProps> = ({
  onOpenNewBooking,
  onOpenHandoverInspection,
}) => {
  const { bookings, updateBookingStatus, setActiveView } = useRentFlow();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.items.some((i) => i.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = selectedStatus === 'all' || b.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const statusBadges: Record<BookingStatus, { label: string; class: string }> = {
    QUOTE: { label: 'Quote Estimate', class: 'bg-purple-50 text-purple-700 border-purple-200' },
    REQUEST: { label: 'Web Inquiry / Pending', class: 'bg-amber-50 text-amber-700 border-amber-200' },
    PENDING_APPROVAL: { label: 'Pending Approval', class: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    CONFIRMED: { label: 'Confirmed (Reserved)', class: 'bg-blue-50 text-blue-700 border-blue-200' },
    CHECKED_OUT: { label: 'Checked Out (On Site)', class: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    RETURNED: { label: 'Returned (Inspected)', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    CLOSED: { label: 'Closed & Reconciled', class: 'bg-slate-100 text-slate-700 border-slate-300' },
    CANCELLED: { label: 'Cancelled', class: 'bg-rose-50 text-rose-700 border-rose-200' },
    OVERDUE: { label: 'Overdue Return', class: 'bg-red-100 text-red-800 border-red-300' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bookings, Quotes & Dispatch
          </h1>
          <p className="text-xs text-slate-500">
            Lifecycle management: Quote → Reservation → Digital Handover → Return & Reconcile.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewBooking}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Reservation</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search bookings by number, customer, or equipment..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500"
          >
            <option value="all">All Statuses ({bookings.length})</option>
            <option value="CONFIRMED">Confirmed / Reserved</option>
            <option value="CHECKED_OUT">Checked Out (On Hire)</option>
            <option value="REQUEST">Inquiries / Quotes</option>
            <option value="RETURNED">Returned</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Booking #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Equipment Reserved</th>
                <th className="px-4 py-3">Rental Dates</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total (ex. Dep)</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.map((b) => {
                const badge = statusBadges[b.status] || {
                  label: b.status,
                  class: 'bg-slate-100 text-slate-700',
                };

                return (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {b.bookingNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{b.customerName}</p>
                      <p className="text-[11px] text-slate-400">{b.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      {b.items.map((item, idx) => (
                        <div key={idx} className="truncate font-medium text-slate-700">
                          {item.equipmentName}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <div>
                        {b.startDate} → {b.endDate}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {b.items[0]?.totalDays || 1} billable days
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${badge.class}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      ${b.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      <span className="block text-[10px] font-normal text-slate-400">
                        +${b.depositAmount} deposit
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {b.status === 'CONFIRMED' && (
                          <button
                            type="button"
                            onClick={() => onOpenHandoverInspection(b.id, 'CHECKOUT')}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors"
                            title="Perform digital handover & inspection"
                          >
                            <ClipboardCheck className="h-3 w-3" />
                            <span>Check-Out</span>
                          </button>
                        )}

                        {b.status === 'CHECKED_OUT' && (
                          <button
                            type="button"
                            onClick={() => onOpenHandoverInspection(b.id, 'RETURN')}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 transition-colors"
                            title="Process return condition inspection"
                          >
                            <ClipboardCheck className="h-3 w-3" />
                            <span>Return Check</span>
                          </button>
                        )}

                        {b.status === 'REQUEST' && (
                          <button
                            type="button"
                            onClick={() => updateBookingStatus(b.id, 'CONFIRMED')}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 transition-colors"
                          >
                            <span>Approve</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedBooking(b)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredBookings.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500">
            No bookings match your current search criteria.
          </div>
        )}
      </div>

      {/* Booking Details Drawer Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">
                  {selectedBooking.bookingNumber}
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Booking & Agreement Details
                </h3>
                <p className="text-xs text-slate-500">Customer: {selectedBooking.customerName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-400 block">Rental Interval</span>
                  <span className="font-bold text-slate-800">
                    {selectedBooking.startDate} to {selectedBooking.endDate}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Booking Status</span>
                  <span className="font-bold text-slate-800">{selectedBooking.status}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200/60">
                  <span className="text-[11px] text-slate-400 block">Job Site / Delivery Address</span>
                  <span className="font-medium text-slate-800">
                    {selectedBooking.deliveryAddress || 'Customer Depot Pickup'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2">Itemized Equipment</h4>
                <div className="space-y-1.5">
                  {selectedBooking.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{item.equipmentName}</p>
                        <p className="text-[11px] text-slate-500">
                          Qty: {item.quantity} • ${item.dailyRate}/day • {item.totalDays} billable days
                        </p>
                      </div>
                      <span className="font-bold text-slate-900">
                        ${item.lineSubtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deposit & Financials */}
              <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3 space-y-1">
                <div className="flex justify-between">
                  <span>Net Rental Revenue:</span>
                  <span className="font-bold text-slate-900">
                    ${selectedBooking.totalAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-purple-700">
                  <span>Refundable Deposit in Escrow:</span>
                  <span className="font-bold">${selectedBooking.depositAmount.toFixed(2)}</span>
                </div>
                {selectedBooking.depositRefunded !== undefined && (
                  <div className="flex justify-between text-emerald-700 font-bold border-t border-blue-200 pt-1">
                    <span>Deposit Refunded Post-Inspection:</span>
                    <span>${selectedBooking.depositRefunded.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Inspections History */}
              {selectedBooking.inspections && selectedBooking.inspections.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">Inspection & Handover Log</h4>
                  <div className="space-y-2">
                    {selectedBooking.inspections.map((insp) => (
                      <div
                        key={insp.id}
                        className="rounded-lg border border-slate-200 p-2.5 text-[11px] space-y-1"
                      >
                        <div className="flex justify-between font-bold">
                          <span>{insp.type === 'CHECKOUT' ? 'Digital Check-Out Handover' : 'Return Condition Check'}</span>
                          <span>{insp.timestamp.split('T')[0]}</span>
                        </div>
                        <p className="text-slate-600">
                          Inspector: {insp.performedBy} • Meter: {insp.meterReading} hrs
                        </p>
                        {insp.notes && <p className="italic text-slate-500">"{insp.notes}"</p>}
                        {insp.customerSignature && (
                          <p className="font-mono text-[10px] text-blue-700">
                            Signed: {insp.customerSignature}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
