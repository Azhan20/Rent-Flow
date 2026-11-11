import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
  CreditCard,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { Customer } from '../types';

export const CustomersView: React.FC = () => {
  const { customers, addCustomer, bookings } = useRentFlow();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // New Customer State
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('20000');
  const [notes, setNotes] = useState('');

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.companyName && c.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  );

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    addCustomer({
      name,
      companyName: companyName || undefined,
      email,
      phone: phone || '(512) 555-0100',
      billingAddress: billingAddress || 'Austin, TX',
      creditLimit: parseFloat(creditLimit) || 10000,
      notes: notes || 'New account verified.',
      isApproved: true,
    });

    setShowAddModal(false);
    setName('');
    setCompanyName('');
    setEmail('');
    setPhone('');
    setBillingAddress('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Customer CRM Directory
          </h1>
          <p className="text-xs text-slate-500">
            Contractor accounts, billing addresses, approved credit limits, and rental history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Customer</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer by name, company, email or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500"
          />
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((cust) => {
          const customerBookings = bookings.filter((b) => b.customerId === cust.id);

          return (
            <div
              key={cust.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{cust.name}</h3>
                    {cust.companyName && (
                      <p className="text-xs font-semibold text-blue-600">{cust.companyName}</p>
                    )}
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    Net 30 Approved
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{cust.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{cust.phone}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {cust.billingAddress}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Credit Limit</span>
                    <span className="font-bold text-slate-800">${cust.creditLimit.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Total Rentals</span>
                    <span className="font-bold text-slate-800">{customerBookings.length} bookings</span>
                  </div>
                </div>

                {cust.notes && (
                  <p className="text-[11px] italic text-slate-400 line-clamp-1">
                    "{cust.notes}"
                  </p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3 mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(cust)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  View Account History →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Customer Account Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedCustomer.name}</h3>
                <p className="text-blue-600 font-semibold">{selectedCustomer.companyName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-1">
              <p>Email: <strong>{selectedCustomer.email}</strong></p>
              <p>Phone: <strong>{selectedCustomer.phone}</strong></p>
              <p>Billing Address: <strong>{selectedCustomer.billingAddress}</strong></p>
              <p>Credit Approved: <strong>${selectedCustomer.creditLimit.toLocaleString()}</strong></p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-2">Rental History & Bookings</h4>
              <div className="space-y-1.5">
                {bookings
                  .filter((b) => b.customerId === selectedCustomer.id)
                  .map((b) => (
                    <div key={b.id} className="flex justify-between rounded-lg border border-slate-200 p-2">
                      <div>
                        <span className="font-mono font-bold text-slate-800">{b.bookingNumber}</span>
                        <p className="text-[11px] text-slate-500">{b.startDate} to {b.endDate}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">${b.totalAmount.toFixed(2)}</span>
                        <p className="text-[10px] text-blue-600 font-semibold">{b.status}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Add Customer Account</h3>
              <p className="text-xs text-slate-500">Create contractor or individual hire record.</p>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Contact Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Miller"
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Miller Civil Works LLC"
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@millercivil.com"
                    className="w-full rounded-lg border border-slate-200 p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(512) 555-0199"
                    className="w-full rounded-lg border border-slate-200 p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Billing Address</label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Street, City, State, ZIP"
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Credit Limit ($)</label>
                <input
                  type="number"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
