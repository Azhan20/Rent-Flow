import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { useAuthenticatedApi, readApiError } from '../lib/api';

type Equipment = { id: string; sku: string; name: string; dailyRate: string; weeklyRate: string; monthlyRate: string; depositAmount: string; totalUnits: number; active: boolean };
type Customer = { id: string; name: string; email: string; phone: string | null };
type Booking = { booking: { id: string; bookingNumber: string; startAt: string; endAt: string; status: string; subtotal: string; depositAmount: string }; item: { id: string } | null };
type Organization = { id: string; name: string; currency: string; timezone: string; role: string };
type Section = 'overview' | 'equipment' | 'customers' | 'bookings';

type WorkspaceOperationsProps = {
  organization: Organization;
  organizations: Organization[];
  accountLabel: string;
  onSelectOrganization: (organizationId: string) => void;
  onCreateOrganization: () => void;
  onSignOut: () => void;
};

const navigation: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'equipment', label: 'Equipment', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'bookings', label: 'Bookings', icon: CalendarDays },
];

const panel = 'min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-sm';
const field = 'mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';
const label = 'block min-w-0 text-sm font-medium text-slate-700';
const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';

function formatMoney(currency: string, value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} ${value}`;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : value;
}

function statusClasses(status: string) {
  if (status === 'CONFIRMED' || status === 'CHECKED_OUT') return 'bg-blue-50 text-blue-700 ring-blue-600/15';
  if (status === 'COMPLETED' || status === 'RETURNED') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/15';
  if (status === 'CANCELLED' || status === 'REJECTED') return 'bg-slate-100 text-slate-600 ring-slate-500/15';
  return 'bg-amber-50 text-amber-700 ring-amber-600/15';
}

export const WorkspaceOperations: React.FC<WorkspaceOperationsProps> = ({
  organization,
  organizations,
  accountLabel,
  onSelectOrganization,
  onCreateOrganization,
  onSignOut,
}) => {
  const authenticatedFetch = useAuthenticatedApi();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [equipmentForm, setEquipmentForm] = useState({ sku: '', name: '', dailyRate: '', weeklyRate: '', monthlyRate: '', depositAmount: '0', totalUnits: '1' });
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '' });
  const [bookingForm, setBookingForm] = useState({ customerId: '', equipmentId: '', quantity: '1', startAt: '', endAt: '' });

  const orgPath = `/api/organizations/${organization.id}`;
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const responses = await Promise.all([
        authenticatedFetch(`${orgPath}/equipment`),
        authenticatedFetch(`${orgPath}/customers`),
        authenticatedFetch(`${orgPath}/bookings`),
      ]);
      for (const response of responses) if (!response.ok) throw new Error(await readApiError(response));
      const [equipmentData, customerData, bookingData] = await Promise.all(responses.map((response) => response.json()));
      setEquipment(equipmentData.equipment || []);
      setCustomers(customerData.customers || []);
      setBookings(bookingData.bookings || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Workspace records could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, orgPath]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  const chooseSection = (section: Section) => {
    setActiveSection(section);
    setMobileNavOpen(false);
  };

  const submit = async (event: React.FormEvent, path: string, body: unknown, onSuccess: () => void) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await authenticatedFetch(`${orgPath}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      onSuccess();
      setNotice('Changes saved successfully.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The change could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const visibleBookings = [...new Map(bookings.map((row) => [row.booking.id, row.booking])).values()];
  const currentNav = navigation.find((item) => item.id === activeSection) || navigation[0];
  const pageDescriptions: Record<Section, string> = {
    overview: 'A live snapshot of equipment, customers, and rental requests in this workspace.',
    equipment: 'Manage rentable equipment and the rates used to price rental requests.',
    customers: 'Keep customer contact details ready for new rental requests.',
    bookings: 'Review rental requests with rates and availability checked by the server.',
  };

  const renderNavigation = (mobile = false) => (
    <nav className="space-y-1" aria-label="Workspace sections">
      <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Workspace</p>
      {navigation.map((item) => {
        const Icon = item.icon;
        const active = activeSection === item.id;
        const count = item.id === 'equipment' ? equipment.length : item.id === 'customers' ? customers.length : item.id === 'bookings' ? visibleBookings.length : null;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => chooseSection(item.id)}
            className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition ${active ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
          >
            <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {count !== null && <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${active ? 'bg-white/15 text-white' : 'bg-slate-800 text-slate-300'}`}>{count}</span>}
          </button>
        );
      })}
      <div className="mt-7 border-t border-slate-800 pt-5">
        <button type="button" onClick={onCreateOrganization} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white">
          <Building2 className="h-[18px] w-[18px] text-slate-400" />
          <span>Create organization</span>
        </button>
      </div>
      {mobile && <div className="mt-4 border-t border-slate-800 pt-4"><button type="button" onClick={onSignOut} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"><LogOut className="h-[18px] w-[18px]" />Sign out</button></div>}
    </nav>
  );

  const EquipmentRows = () => equipment.length === 0 ? (
    <EmptyState icon={Package} title="No equipment yet" detail="Add your first item to make it available for rental requests." />
  ) : (
    <>
      <div className="space-y-3 lg:hidden">
        {equipment.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="break-words text-sm font-semibold text-slate-900">{item.name}</h3><p className="mt-1 break-all text-xs text-slate-500">SKU {item.sku}</p></div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.active ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <p className="text-slate-500">Units <span className="float-right font-semibold text-slate-900">{item.totalUnits}</span></p>
              <p className="text-slate-500">Daily rate <span className="float-right font-semibold text-slate-900">{formatMoney(organization.currency, item.dailyRate)}</span></p>
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto lg:block" role="region" aria-label="Equipment list" tabIndex={0}>
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Equipment</th><th className="px-4 py-3 font-semibold">SKU</th><th className="px-4 py-3 font-semibold">Units</th><th className="px-4 py-3 font-semibold">Daily rate</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{equipment.map((item) => <tr key={item.id} className="hover:bg-slate-50/80"><td className="max-w-[280px] break-words px-4 py-3.5 font-semibold text-slate-900">{item.name}</td><td className="max-w-[180px] break-all px-4 py-3.5 text-slate-600">{item.sku}</td><td className="px-4 py-3.5 tabular-nums text-slate-700">{item.totalUnits}</td><td className="px-4 py-3.5 tabular-nums text-slate-700">{formatMoney(organization.currency, item.dailyRate)}</td><td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.active ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody>
        </table>
      </div>
    </>
  );

  const CustomerRows = () => customers.length === 0 ? (
    <EmptyState icon={Users} title="No customers yet" detail="Add a customer to include them on rental requests." />
  ) : (
    <>
      <div className="space-y-3 lg:hidden">
        {customers.map((customer) => <article key={customer.id} className="rounded-xl border border-slate-200 p-4"><h3 className="break-words text-sm font-semibold text-slate-900">{customer.name}</h3><a className="mt-1 block min-h-11 break-all py-2 text-sm text-blue-700 underline-offset-2 hover:underline" href={`mailto:${customer.email}`}>{customer.email}</a>{customer.phone && <p className="break-all text-sm text-slate-500">{customer.phone}</p>}</article>)}
      </div>
      <div className="hidden overflow-x-auto lg:block" role="region" aria-label="Customer list" tabIndex={0}>
        <table className="w-full min-w-[560px] text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Email</th><th className="px-4 py-3 font-semibold">Phone</th></tr></thead><tbody className="divide-y divide-slate-100">{customers.map((customer) => <tr key={customer.id} className="hover:bg-slate-50/80"><td className="max-w-[260px] break-words px-4 py-3.5 font-semibold text-slate-900">{customer.name}</td><td className="max-w-[320px] break-all px-4 py-3.5 text-blue-700">{customer.email}</td><td className="max-w-[200px] break-all px-4 py-3.5 text-slate-600">{customer.phone || '—'}</td></tr>)}</tbody></table>
      </div>
    </>
  );

  const BookingRows = () => visibleBookings.length === 0 ? (
    <EmptyState icon={CalendarDays} title="No rental requests yet" detail="Create a request below. The server will validate the rates and available quantity." />
  ) : (
    <>
      <div className="space-y-3 lg:hidden">
        {visibleBookings.map((booking) => <article key={booking.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="break-all text-sm font-semibold text-slate-900">{booking.bookingNumber}</h3><StatusBadge status={booking.status} /></div><p className="mt-3 text-xs text-slate-500">{formatDate(booking.startAt)} <span aria-hidden="true">→</span> {formatDate(booking.endAt)}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm"><span className="text-slate-600">Rental <strong className="text-slate-900">{formatMoney(organization.currency, booking.subtotal)}</strong></span><span className="text-slate-600">Deposit <strong className="text-slate-900">{formatMoney(organization.currency, booking.depositAmount)}</strong></span></div></article>)}
      </div>
      <div className="hidden overflow-x-auto lg:block" role="region" aria-label="Rental requests" tabIndex={0}>
        <table className="w-full min-w-[680px] text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Request</th><th className="px-4 py-3 font-semibold">Pickup</th><th className="px-4 py-3 font-semibold">Return</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Rental</th><th className="px-4 py-3 font-semibold">Deposit</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleBookings.map((booking) => <tr key={booking.id} className="hover:bg-slate-50/80"><td className="max-w-[150px] break-all px-4 py-3.5 font-semibold text-slate-900">{booking.bookingNumber}</td><td className="min-w-[145px] px-4 py-3.5 text-slate-600">{formatDate(booking.startAt)}</td><td className="min-w-[145px] px-4 py-3.5 text-slate-600">{formatDate(booking.endAt)}</td><td className="px-4 py-3.5"><StatusBadge status={booking.status} /></td><td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-slate-700">{formatMoney(organization.currency, booking.subtotal)}</td><td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-slate-700">{formatMoney(organization.currency, booking.depositAmount)}</td></tr>)}</tbody></table>
      </div>
    </>
  );

  const EquipmentForm = () => (
    <form onSubmit={(event) => void submit(event, 'equipment', { ...equipmentForm, dailyRate: Number(equipmentForm.dailyRate), weeklyRate: Number(equipmentForm.weeklyRate), monthlyRate: Number(equipmentForm.monthlyRate), depositAmount: Number(equipmentForm.depositAmount), totalUnits: Number(equipmentForm.totalUnits) }, () => setEquipmentForm({ sku: '', name: '', dailyRate: '', weeklyRate: '', monthlyRate: '', depositAmount: '0', totalUnits: '1' }))} className="grid min-w-0 grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
      <label className={label}>SKU<input required maxLength={80} value={equipmentForm.sku} onChange={(e) => setEquipmentForm({ ...equipmentForm, sku: e.target.value })} className={field} autoComplete="off" /></label>
      <label className={label}>Equipment name<input required maxLength={160} value={equipmentForm.name} onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })} className={field} autoComplete="off" /></label>
      <label className={label}>Daily rate<input required type="number" min="0" step="0.01" value={equipmentForm.dailyRate} onChange={(e) => setEquipmentForm({ ...equipmentForm, dailyRate: e.target.value })} className={field} /></label>
      <label className={label}>Weekly rate<input required type="number" min="0" step="0.01" value={equipmentForm.weeklyRate} onChange={(e) => setEquipmentForm({ ...equipmentForm, weeklyRate: e.target.value })} className={field} /></label>
      <label className={label}>Monthly rate<input required type="number" min="0" step="0.01" value={equipmentForm.monthlyRate} onChange={(e) => setEquipmentForm({ ...equipmentForm, monthlyRate: e.target.value })} className={field} /></label>
      <label className={label}>Deposit<input required type="number" min="0" step="0.01" value={equipmentForm.depositAmount} onChange={(e) => setEquipmentForm({ ...equipmentForm, depositAmount: e.target.value })} className={field} /></label>
      <label className={label}>Available units<input required type="number" min="1" step="1" value={equipmentForm.totalUnits} onChange={(e) => setEquipmentForm({ ...equipmentForm, totalUnits: e.target.value })} className={field} /></label>
      <div className="flex items-end sm:col-span-2 xl:col-span-2"><button disabled={saving} className={`${primaryButton} w-full sm:w-auto`}>{saving && <Spinner />}Add equipment</button></div>
    </form>
  );

  const CustomerForm = () => (
    <form onSubmit={(event) => void submit(event, 'customers', customerForm, () => setCustomerForm({ name: '', email: '', phone: '' }))} className="grid min-w-0 grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
      <label className={label}>Customer name<input required maxLength={160} value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} className={field} autoComplete="name" /></label>
      <label className={label}>Email address<input required type="email" maxLength={254} value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} className={field} autoComplete="email" /></label>
      <label className={label}>Phone number<input maxLength={80} value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} className={field} autoComplete="tel" /></label>
      <div className="flex items-end sm:col-span-2 xl:col-span-3"><button disabled={saving} className={`${primaryButton} w-full sm:w-auto`}>{saving && <Spinner />}Add customer</button></div>
    </form>
  );

  const BookingForm = () => (
    <form onSubmit={(event) => {
      event.preventDefault();
      const start = new Date(bookingForm.startAt);
      const end = new Date(bookingForm.endAt);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
        setError('Return time must be after pickup time.');
        setNotice('');
        return;
      }
      void submit(event, 'bookings', { customerId: bookingForm.customerId, startAt: start.toISOString(), endAt: end.toISOString(), items: [{ equipmentId: bookingForm.equipmentId, quantity: Number(bookingForm.quantity) }] }, () => setBookingForm({ ...bookingForm, customerId: '', equipmentId: '', quantity: '1' }));
    }} className="grid min-w-0 grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-5">
      <label className={label}>Customer<select required value={bookingForm.customerId} onChange={(e) => setBookingForm({ ...bookingForm, customerId: e.target.value })} className={field}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
      <label className={label}>Equipment<select required value={bookingForm.equipmentId} onChange={(e) => setBookingForm({ ...bookingForm, equipmentId: e.target.value })} className={field}><option value="">Select equipment</option>{equipment.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.totalUnits} units)</option>)}</select></label>
      <label className={label}>Quantity<input required type="number" min="1" step="1" value={bookingForm.quantity} onChange={(e) => setBookingForm({ ...bookingForm, quantity: e.target.value })} className={field} /></label>
      <label className={label}>Pickup date and time<input required type="datetime-local" value={bookingForm.startAt} onChange={(e) => setBookingForm({ ...bookingForm, startAt: e.target.value })} className={field} /></label>
      <label className={label}>Return date and time<input required type="datetime-local" value={bookingForm.endAt} onChange={(e) => setBookingForm({ ...bookingForm, endAt: e.target.value })} className={field} /></label>
      <div className="flex flex-col items-start gap-3 sm:col-span-2 xl:col-span-5 sm:flex-row sm:items-center"><button disabled={saving || customers.length === 0 || equipment.length === 0} className={`${primaryButton} w-full sm:w-auto`}>{saving && <Spinner />}Create rental request</button><p className="text-xs leading-5 text-slate-500">Rates and available quantity are checked by the server. New requests remain pending review.</p></div>
    </form>
  );

  const sectionContent = () => {
    if (activeSection === 'overview') return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard icon={Package} label="Equipment" value={loading ? '—' : equipment.length} detail="Items in this workspace" tint="blue" onClick={() => chooseSection('equipment')} />
          <MetricCard icon={Users} label="Customers" value={loading ? '—' : customers.length} detail="Customer records" tint="violet" onClick={() => chooseSection('customers')} />
          <MetricCard icon={CalendarDays} label="Rental requests" value={loading ? '—' : visibleBookings.length} detail="Requests on record" tint="amber" onClick={() => chooseSection('bookings')} />
        </div>
        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5"><div><h2 className="text-base font-bold text-slate-900">Recent rental requests</h2><p className="mt-1 text-sm text-slate-500">Latest requests for this organization.</p></div><button type="button" onClick={() => chooseSection('bookings')} className={secondaryButton}>View bookings</button></div>
          {loading ? <LoadingState /> : <BookingRows />}
        </section>
      </div>
    );
    if (activeSection === 'equipment') return (
      <div className="space-y-5"><section className={panel}><SectionHeading title="Equipment list" detail={`${equipment.length} ${equipment.length === 1 ? 'item' : 'items'} in this organization`} />{loading ? <LoadingState /> : <EquipmentRows />}</section><section className={panel}><SectionHeading title="Add equipment" detail="Enter the item details and rental rates." /><EquipmentForm /></section></div>
    );
    if (activeSection === 'customers') return (
      <div className="space-y-5"><section className={panel}><SectionHeading title="Customer list" detail={`${customers.length} ${customers.length === 1 ? 'customer' : 'customers'} in this organization`} />{loading ? <LoadingState /> : <CustomerRows />}</section><section className={panel}><SectionHeading title="Add a customer" detail="Add contact information for a rental customer." /><CustomerForm /></section></div>
    );
    return (
      <div className="space-y-5"><section className={panel}><SectionHeading title="Rental requests" detail={`${visibleBookings.length} ${visibleBookings.length === 1 ? 'request' : 'requests'} in this organization`} />{loading ? <LoadingState /> : <BookingRows />}</section><section className={panel}><SectionHeading title="Create a rental request" detail="Choose a customer, equipment, and rental window." />{customers.length === 0 || equipment.filter((item) => item.active).length === 0 ? <div className="m-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 sm:m-5"><p className="font-semibold text-slate-800">Add a customer and active equipment first</p><p className="mt-1">Rental requests require both records. Nothing will be added automatically.</p><div className="mt-3 flex flex-wrap gap-2">{customers.length === 0 && <button type="button" className={secondaryButton} onClick={() => chooseSection('customers')}>Go to customers</button>}{equipment.filter((item) => item.active).length === 0 && <button type="button" className={secondaryButton} onClick={() => chooseSection('equipment')}>Go to equipment</button>}</div></div> : <BookingForm />}</section></div>
    );
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-800 bg-slate-950 text-slate-200 lg:flex">
        <BrandBlock />
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">{renderNavigation()}</div>
        <div className="border-t border-slate-800 p-4"><p className="truncate text-xs font-semibold text-white" title={organization.name}>{organization.name}</p><p className="mt-1 truncate text-xs text-slate-400">{organization.role.replaceAll('_', ' ').toLowerCase()}</p></div>
      </aside>

      {mobileNavOpen && <button type="button" className="fixed inset-0 z-40 cursor-default bg-slate-950/50 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
      <aside aria-label="Mobile workspace navigation" aria-hidden={!mobileNavOpen} inert={!mobileNavOpen} className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-2rem))] flex-col border-r border-slate-800 bg-slate-950 text-slate-200 shadow-2xl transition-transform duration-200 lg:hidden ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between"><BrandBlock /><button type="button" onClick={() => setMobileNavOpen(false)} className="mr-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800" aria-label="Close navigation menu"><X className="h-5 w-5" /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">{renderNavigation(true)}</div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex min-h-16 w-full max-w-[1760px] min-w-0 items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button type="button" onClick={() => setMobileNavOpen(true)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden" aria-label="Open navigation menu" aria-expanded={mobileNavOpen}><Menu className="h-5 w-5" /></button>
              <div className="min-w-0"><p className="hidden text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 sm:block">Rental management</p><h1 className="truncate text-base font-bold text-slate-900 sm:mt-0.5 sm:text-lg">{currentNav.label}</h1></div>
            </div>
            <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
              <div className="relative min-w-0">
                <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" />
                <select aria-label="Select organization" value={organization.id} onChange={(event) => onSelectOrganization(event.target.value)} className="min-h-11 w-full max-w-[min(11rem,38vw)] appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-8 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:max-w-[15rem] sm:text-sm">
                  {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
              <button type="button" onClick={() => void refresh()} disabled={loading} className={`${secondaryButton} hidden shrink-0 px-3 sm:inline-flex`} aria-label="Refresh workspace records"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /><span className="hidden md:inline">Refresh</span></button>
              <div className="hidden min-w-0 items-center gap-2.5 border-l border-slate-200 pl-3 md:flex"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold uppercase text-blue-700">{accountLabel.slice(0, 1) || 'U'}</span><span className="max-w-36 truncate text-sm font-medium text-slate-700" title={accountLabel}>{accountLabel}</span></div>
              <button type="button" onClick={onSignOut} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
        </header>

        <main className="mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-[1760px] min-w-0 px-3 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mb-6 flex min-w-0 flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-blue-700" title={organization.name}>{organization.name}</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{activeSection === 'overview' ? 'Rental operations' : currentNav.label}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{pageDescriptions[activeSection]}</p></div>
            <button type="button" onClick={() => void refresh()} disabled={loading} className={`${secondaryButton} self-start sm:self-auto sm:hidden`}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
          </div>
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden" role="tablist" aria-label="Workspace sections">
            {navigation.map((item) => <button key={item.id} type="button" role="tab" aria-selected={activeSection === item.id} onClick={() => chooseSection(item.id)} className={`min-h-11 shrink-0 rounded-xl px-3.5 text-sm font-semibold ${activeSection === item.id ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'}`}>{item.label}</button>)}
          </div>
          {error && <div role="alert" className="mb-5 flex min-w-0 items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-800"><span className="min-w-0 flex-1 break-words">{error}</span><button type="button" onClick={() => void refresh()} className="min-h-11 shrink-0 rounded-lg px-2 font-semibold text-rose-800 underline underline-offset-2">Retry</button></div>}
          {notice && <div role="status" className="mb-5 flex min-w-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" /><span className="min-w-0 break-words">{notice}</span></div>}
          {sectionContent()}
          <footer className="mt-8 flex flex-col gap-1 border-t border-slate-200 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Rental operations for {organization.name}</span><span>Rental rates and availability are validated by the server.</span></footer>
        </main>
      </div>
    </div>
  );
};

function BrandBlock() {
  return <div className="flex min-h-20 items-center gap-3 border-b border-slate-800 px-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-950/30"><Building2 className="h-5 w-5" /></span><div className="min-w-0"><p className="text-base font-bold tracking-tight text-white">RentFlow</p><p className="mt-0.5 truncate text-xs text-slate-400">Rental operations</p></div></div>;
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return <div className="px-4 py-4 sm:px-5"><h2 className="text-base font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{detail}</p></div>;
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof Package; title: string; detail: string }) {
  return <div className="m-4 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-7 text-center sm:m-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200"><Icon className="h-5 w-5" /></span><h3 className="mt-3 text-sm font-semibold text-slate-800">{title}</h3><p className="mt-1 max-w-md text-sm leading-5 text-slate-500">{detail}</p></div>;
}

function MetricCard({ icon: Icon, label: metricLabel, value, detail, tint, onClick }: { icon: typeof Package; label: string; value: number | string; detail: string; tint: 'blue' | 'violet' | 'amber'; onClick: () => void }) {
  const tones = { blue: 'bg-blue-50 text-blue-700', violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700' };
  return <button type="button" onClick={onClick} className="group min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:p-5"><div className="flex items-center justify-between gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tint]}`}><Icon className="h-5 w-5" /></span><span className="text-xs font-semibold text-slate-400 transition group-hover:text-blue-600">View <span aria-hidden="true">→</span></span></div><p className="mt-5 text-3xl font-bold tracking-tight tabular-nums text-slate-950">{value}</p><p className="mt-1 text-sm font-semibold text-slate-800">{metricLabel}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></button>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses(status)}`}>{status.replaceAll('_', ' ')}</span>;
}

function Spinner() {
  return <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />;
}

function LoadingState() {
  return <div role="status" className="flex min-h-40 items-center justify-center gap-3 px-4 py-8 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin text-blue-600" /><span>Loading workspace records…</span></div>;
}
