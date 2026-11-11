import React from 'react';
import {
  X,
  Printer,
  Download,
  Building2,
  CheckCircle2,
  Calendar,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { Invoice } from '../types';
import { useRentFlow } from '../context/RentFlowContext';

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onOpenRecordPayment: (invoice: Invoice) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  onClose,
  onOpenRecordPayment,
}) => {
  const { currentOrg, bookings } = useRentFlow();
  if (!invoice) return null;

  const linkedBooking = bookings.find((b) => b.id === invoice.bookingId);
  const balanceRemaining = Math.max(0, invoice.totalDue - invoice.amountPaid);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto print:p-0 print:shadow-none print:max-w-none">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
          <span className="font-mono text-xs font-bold text-blue-600">
            {invoice.invoiceNumber}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </button>

            {balanceRemaining > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRecordPayment(invoice);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Record Payment</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document Sheet */}
        <div className="border border-slate-200 rounded-xl p-6 bg-white space-y-6 shadow-2xs">
          {/* Invoice Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
                  RF
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  {currentOrg.name}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">{currentOrg.address}</p>
              <p className="text-xs text-slate-500">{currentOrg.phone} • {currentOrg.email}</p>
            </div>

            <div className="text-right">
              <span className="font-mono text-xl font-black text-slate-900 block">
                INVOICE
              </span>
              <span className="font-mono text-xs font-bold text-blue-600">
                #{invoice.invoiceNumber}
              </span>
              <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                <p>Issue Date: <strong className="text-slate-800">{invoice.issuedDate}</strong></p>
                <p>Payment Due: <strong className="text-slate-800">{invoice.dueDate}</strong></p>
                <p>Status: <span className="font-bold uppercase text-blue-700">{invoice.status}</span></p>
              </div>
            </div>
          </div>

          {/* Bill To & Rental Reference */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Billed To
              </span>
              <p className="font-bold text-slate-900">{invoice.customerName}</p>
              <p className="text-slate-600">{invoice.customerEmail}</p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Rental Contract Reference
              </span>
              <p className="font-semibold text-slate-800">
                Booking Reference: {invoice.bookingNumber || 'Direct Rental Contract'}
              </p>
              {linkedBooking && (
                <p className="text-slate-500 mt-0.5">
                  Hire Window: {linkedBooking.startDate} to {linkedBooking.endDate}
                </p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                <tr>
                  <th className="p-3">Description / Equipment Unit</th>
                  <th className="p-3 text-center">Duration</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {linkedBooking?.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-3">
                      <p className="font-semibold text-slate-900">{item.equipmentName}</p>
                      <span className="text-[11px] text-slate-400">Standard Tiered Rental Rate</span>
                    </td>
                    <td className="p-3 text-center">{item.totalDays} Days</td>
                    <td className="p-3 text-right font-medium">${item.lineSubtotal.toFixed(2)}</td>
                  </tr>
                )) || (
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Equipment Rental Services</td>
                    <td className="p-3 text-center">1 Rental Period</td>
                    <td className="p-3 text-right font-medium">${invoice.subtotal.toFixed(2)}</td>
                  </tr>
                )}
                {invoice.deliveryFee > 0 && (
                  <tr>
                    <td className="p-3 text-slate-700">Transport, Delivery & Pickup Flatbed Logistics</td>
                    <td className="p-3 text-center">Flat</td>
                    <td className="p-3 text-right font-medium">${invoice.deliveryFee.toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Subtotals & Payments Breakdown */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">${invoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span className="font-medium">${invoice.taxAmount.toFixed(2)}</span>
              </div>
              {invoice.depositHeld > 0 && (
                <div className="flex justify-between text-purple-700 border-t border-slate-200 pt-1">
                  <span>Refundable Escrow Deposit:</span>
                  <span className="font-bold">${invoice.depositHeld.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                <span>Total Invoice Due:</span>
                <span>${invoice.totalDue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Amount Paid:</span>
                <span>-${invoice.amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-blue-700 border-t border-slate-200 pt-1.5">
                <span>Balance Due:</span>
                <span>${balanceRemaining.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment History Record */}
          {invoice.payments.length > 0 && (
            <div className="rounded-lg bg-emerald-50/60 p-3 border border-emerald-100 text-xs">
              <h4 className="font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Recorded Payments ({invoice.payments.length})
              </h4>
              <div className="space-y-1">
                {invoice.payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-emerald-800">
                    <span>
                      {p.paymentMethod.replace('_', ' ')} • Ref: {p.referenceCode} • {p.date.split('T')[0]}
                    </span>
                    <span className="font-bold">${p.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Terms Footer */}
          <div className="border-t border-slate-200 pt-3 text-[10px] text-slate-400">
            <p>
              Payment Terms: Net 15 days from invoice issuance unless agreed otherwise. Deposits held in separate escrow trust account and refunded upon verified return inspection. Late returns subject to daily rate charge.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
