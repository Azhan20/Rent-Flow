import React, { useCallback, useEffect, useState } from 'react';
import { Building2, CheckCircle2, LoaderCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAuthenticatedApi, readApiError } from '../lib/api';
import { WorkspaceOperations } from './WorkspaceOperations';
import { usePageMetadata } from '../lib/pageMetadata';

type Organization = { id: string; name: string; slug: string; currency: string; timezone: string; role: string };

const field = 'mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';
const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

export const WorkspaceSetup: React.FC<{ selectedPlan?: string; billingCycle?: 'monthly' | 'yearly' }> = ({ selectedPlan, billingCycle = 'monthly' }) => {
  usePageMetadata('Workspace setup | RentFlow', false);
  const { user, signOutUser } = useAuth();
  const authenticatedFetch = useAuthenticatedApi();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createOrganizationOpen, setCreateOrganizationOpen] = useState(false);

  const refresh = useCallback(async (preferredOrganizationId?: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/me');
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      const nextOrganizations = Array.isArray(data.organizations) ? data.organizations as Organization[] : [];
      setOrganizations(nextOrganizations);
      setSelectedOrganizationId((current) => {
        if (preferredOrganizationId && nextOrganizations.some((org) => org.id === preferredOrganizationId)) return preferredOrganizationId;
        return nextOrganizations.some((org) => org.id === current) ? current : nextOrganizations[0]?.id || '';
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Workspace information could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!createOrganizationOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCreateOrganizationOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createOrganizationOpen]);

  const createOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await authenticatedFetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, currency, timezone }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const result = await response.json();
      const newOrganizationId = typeof result.organization?.id === 'string' ? result.organization.id : undefined;
      setName('');
      setCreateOrganizationOpen(false);
      setNotice('Organization created successfully.');
      await refresh(newOrganizationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Organization setup could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const renderOrganizationForm = (modal = false) => (
    <form onSubmit={(event) => void createOrganization(event)} className="space-y-5">
      <label className="block text-sm font-semibold text-slate-700">Business name<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={field} autoComplete="organization" /></label>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block min-w-0 text-sm font-semibold text-slate-700">Currency<input required pattern="[A-Z]{3}" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className={field} autoComplete="off" aria-describedby="currency-help" /><span id="currency-help" className="mt-1.5 block text-xs font-normal text-slate-500">Three-letter currency code, such as USD.</span></label>
        <label className="block min-w-0 text-sm font-semibold text-slate-700">IANA timezone<input required maxLength={80} value={timezone} onChange={(event) => setTimezone(event.target.value)} className={field} autoComplete="off" /><span className="mt-1.5 block text-xs font-normal text-slate-500">Used for this organization’s rental dates.</span></label>
      </div>
      {error && <p role="alert" className="break-words rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {notice && !modal && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</p>}
      <div className={`flex flex-col-reverse gap-3 sm:flex-row sm:items-center ${modal ? 'sm:justify-end' : ''}`}>
        {modal && <button type="button" onClick={() => setCreateOrganizationOpen(false)} className={secondaryButton}>Cancel</button>}
        <button disabled={busy} className={`${primaryButton} ${modal ? 'w-full sm:w-auto' : 'w-full'}`}><Building2 className="h-4 w-4" />{busy ? 'Creating workspace…' : 'Create organization'}</button>
      </div>
    </form>
  );

  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId);

  if (organizations.length > 0 && selectedOrganization) {
    return <>
      <WorkspaceOperations
        organization={selectedOrganization}
        organizations={organizations}
        accountLabel={user?.displayName || user?.email || 'Account'}
        onSelectOrganization={setSelectedOrganizationId}
        onCreateOrganization={() => { setError(''); setCreateOrganizationOpen(true); }}
        onSignOut={() => void signOutUser()}
      />
      {createOrganizationOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOrganizationOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="create-organization-title" className="my-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Workspace setup</p><h2 id="create-organization-title" className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Create an organization</h2><p className="mt-2 text-sm leading-6 text-slate-600">Set the business name and regional defaults for a new workspace.</p></div><button type="button" onClick={() => setCreateOrganizationOpen(false)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close organization form"><X className="h-5 w-5" /></button></div>
          {renderOrganizationForm(true)}
        </section>
      </div>}
    </>;
  }

  return (
    <main className="flex min-h-screen min-w-0 items-center justify-center overflow-x-clip bg-slate-100 px-3 py-6 sm:px-6 sm:py-10">
      <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5" aria-labelledby="workspace-setup-title">
        <div className="border-b border-slate-200 bg-gradient-to-br from-white to-blue-50/70 p-5 sm:p-8">
          <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"><Building2 className="h-6 w-6" /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">RentFlow account</p><h1 id="workspace-setup-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Set up your workspace</h1><p className="mt-2 break-words text-sm leading-6 text-slate-600">Create a rental business workspace for {user?.email || 'your account'}.</p></div><button type="button" onClick={() => void signOutUser()} className={`${secondaryButton} hidden shrink-0 sm:inline-flex`}>Sign out</button></div>
          {selectedPlan && <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-sm leading-5 text-blue-900">Selected plan: <strong>{selectedPlan}</strong> ({billingCycle}). Payment processing is not configured, so this selection does not start a trial or activate a subscription.</p>}
        </div>
        <div className="p-5 sm:p-8">
          {loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-3 text-sm text-slate-600"><LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />Loading account and workspace…</div> : <>
            {error && <p role="alert" className="mb-5 break-words rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
            <div className="mb-5"><h2 className="text-base font-bold text-slate-900">Create your first organization</h2><p className="mt-1 text-sm leading-5 text-slate-500">This creates the organization and owner membership linked to your verified account.</p></div>
            {renderOrganizationForm()}
          </>}
          <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4"><h2 className="text-sm font-semibold text-slate-800">What’s available now</h2><p className="mt-1.5 text-sm leading-5 text-slate-600">Equipment, customer records, and rental requests are connected to PostgreSQL. Payment collection, inspections, maintenance, invitations, and analytics are not connected yet.</p></div>
          <button type="button" onClick={() => void signOutUser()} className="mt-5 min-h-11 text-sm font-semibold text-slate-600 hover:text-slate-900 sm:hidden">Sign out</button>
        </div>
      </section>
    </main>
  );
};
