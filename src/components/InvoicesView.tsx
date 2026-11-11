import React, { useState } from 'react';
import {
  Receipt,
  Search,
  Filter,
  DollarSign,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { Invoice, InvoiceStatus } from '../types';
import { InvoiceDetailModal } from './InvoiceDetailModal';

export const InvoicesView: React.FC = () => {
  const { invoices, recordPayment, customers } = useRentFlow();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);

  // Record Payment Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'BANK_TRANSFER' | 'CASH' | 'TERMINAL'>('CREDIT_CARD');
  const [referenceCode, setReferenceCode] = useState('');

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.bookingNumber && inv.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = selectedStatus === 'all' || inv.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleOpenPayment = (inv: Invoice) => {
    const balance = Math.max(0, inv.totalDue - inv.amountPaid);
    setPaymentAmount(balance.toString());
    setReferenceCode(`PAY-${Date.now().toString().slice(-6)}`);
    setPaymentModalInvoice(inv);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;

    recordPayment(paymentModalInvoice.id, {
      amount: parseFloat(paymentAmount) || 0,
      paymentMethod,
      referenceCode: referenceCode || 'MANUAL-REF',
    });

    setPaymentModalInvoice(null);
  };

  const statusColors: Record<InvoiceStatus, { label: string; class: string }> = {
    DRAFT: { label: 'Draft', class: 'bg-slate-100 text-slate-700 border-slate-300' },
    SENT: { label: 'Awaiting Payment', class: 'bg-blue-50 text-blue-700 border-blue-200' },
    PARTIALLY_PAID: { label: 'Partially Paid', class: 'bg-amber-50 text-amber-700 border-amber-200' },
    PAID: { label: 'Paid in Full', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    OVERDUE: { label: 'Overdue', class: 'bg-red-50 text-red-700 border-red-200' },
    VOID: { label: 'Void', class: 'bg-slate-100 text-slate-500 border-slate-200' },
    REFUNDED: { label: 'Refunded', class: 'bg-purple-50 text-purple-700 border-purple-200' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Invoices & Payment Ledger
          </h1>
          <p className="text-xs text-slate-500">
            Sequential invoice generation, payment recording, and refundable escrow deposit tracking.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice #, customer name, or booking reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500"
        >
          <option value="all">All Invoice Statuses</option>
          <option value="SENT">Awaiting Payment</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid in Full</option>
          <option value="OVERDUE">Overdue</option>
        </select>
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Issue Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total Due</th>
                <th className="px-4 py-3 text-right">Balance Due</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => {
                const badge = statusColors[inv.status] || {
                  label: inv.status,
                  class: 'bg-slate-100 text-slate-700',
                };
                const balance = Math.max(0, inv.totalDue - inv.amountPaid);

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {inv.invoiceNumber}
                      {inv.bookingNumber && (
                        <span className="block text-[10px] text-slate-400 font-normal">
                          Ref: {inv.bookingNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{inv.customerName}</p>
                      <p className="text-[11px] text-slate-400">{inv.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{inv.issuedDate}</td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{inv.dueDate}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${badge.class}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      ${inv.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-black">
                      <span className={balance > 0 ? 'text-blue-700' : 'text-emerald-700'}>
                        ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {balance > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(inv)}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors"
                          >
                            <CreditCard className="h-3 w-3" />
                            <span>Pay</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(inv)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          View / Print
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredInvoices.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500">
            No invoices found.
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onOpenRecordPayment={(inv) => handleOpenPayment(inv)}
      />

      {/* Record Payment Modal */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="font-mono text-xs font-bold text-emerald-600">
                Record Payment Received
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Invoice #{paymentModalInvoice.invoiceNumber}
              </h3>
              <p className="text-xs text-slate-500">
                Customer: {paymentModalInvoice.customerName}
              </p>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Payment Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 font-mono font-bold text-slate-900 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-200 p-2 font-medium text-slate-800"
                >
                  <option value="CREDIT_CARD">Credit Card (Stripe / Processor)</option>
                  <option value="BANK_TRANSFER">Direct Bank Wire / ACH</option>
                  <option value="TERMINAL">Physical Yard Card Terminal</option>
                  <option value="CASH">Cash at Depot Counter</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Transaction / Reference Code *
                </label>
                <input
                  type="text"
                  required
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="e.g. TXN-VISA-99410 or Wire #881"
                  className="w-full rounded-lg border border-slate-200 p-2 font-mono text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
