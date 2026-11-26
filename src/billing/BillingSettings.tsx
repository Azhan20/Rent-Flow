import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, RefreshCw } from 'lucide-react';
import { loadBillingAccount, loadBillingPlans, type BillingAccountContract, type BillingPlansContract } from './api-client';

const panel = 'min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-sm';
const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';

function formatPrice(cents: number | null, currency: string, interval: 'monthly' | 'yearly') {
  if (cents === null) return 'Custom pricing';
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  return `${amount} / ${interval === 'monthly' ? 'month' : 'year'}`;
}

function formatStatus(status: string) {
  return status.toLowerCase().replaceAll('_', ' ');
}

export function BillingSettings({ authenticatedFetch }: { authenticatedFetch: (path: string, init?: RequestInit) => Promise<Response> }) {
  const [plans, setPlans] = useState<BillingPlansContract | null>(null);
  const [account, setAccount] = useState<BillingAccountContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const [planResult, accountResult] = await Promise.allSettled([
      loadBillingPlans(authenticatedFetch),
      loadBillingAccount(authenticatedFetch),
    ]);
    if (planResult.status === 'fulfilled') setPlans(planResult.value);
    else setError(planResult.reason instanceof Error ? planResult.reason.message : 'Plan information could not be loaded.');
    if (accountResult.status === 'fulfilled') setAccount(accountResult.value);
    else setError(accountResult.reason instanceof Error ? accountResult.reason.message : 'Billing information could not be loaded.');
    setLoading(false);
  }, [authenticatedFetch]);

  useEffect(() => { void refresh(); }, [refresh]);

  const current = account?.currentSubscription;
  return (
    <div className="space-y-5">
      {error && <div role="alert" className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900"><p className="min-w-0 flex-1">{error}</p><button type="button" onClick={() => void refresh()} className={secondaryButton} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Retry</button></div>}

      <section className={panel} aria-labelledby="billing-account-heading">
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><CreditCard className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><h2 id="billing-account-heading" className="text-base font-bold text-slate-900">Account subscription</h2><p className="mt-1 text-sm text-slate-500">One account-level subscription applies across your linked organizations.</p></div></div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className={secondaryButton} aria-label="Refresh billing information"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
        </div>
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
          {loading && !account ? <p role="status" className="py-3 text-sm text-slate-500">Loading account billing status…</p> : current ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current plan</p><p className="mt-1 font-semibold text-slate-900">{current.planIdentifier} · {current.billingInterval.toLowerCase()}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p><p className="mt-1 font-semibold capitalize text-slate-900">{formatStatus(current.status)}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Organizations</p><p className="mt-1 font-semibold text-slate-900">{account?.organizations.linkedCount ?? 0}{current.organizationLimit === null ? '' : ` / ${current.organizationLimit}`}</p></div>
            {current.trialEndsAt && <p className="text-sm text-slate-600 sm:col-span-3">Trial ends {new Date(current.trialEndsAt).toLocaleDateString()}.</p>}
          </div> : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4"><p className="text-sm font-semibold text-slate-800">No current subscription</p><p className="mt-1 text-sm leading-5 text-slate-600">A 14-day trial requires a verified payment method. Secure checkout is not available yet, so this page will not start a trial or represent a payment as complete.</p></div>}
        </div>
      </section>

      <section className={panel} aria-labelledby="billing-plans-heading">
        <div className="px-4 py-4 sm:px-5"><h2 id="billing-plans-heading" className="text-base font-bold text-slate-900">Plans</h2><p className="mt-1 text-sm text-slate-500">Catalog {plans?.catalogVersion ?? '—'} · {plans?.trialDays ?? 14}-day trial with verified payment method</p></div>
        {plans ? <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
          {plans.plans.map((plan) => <article key={plan.id} className="min-w-0 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-bold text-slate-900">{plan.name}</h3>{plan.availability === 'CUSTOM' && <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">Custom</span>}</div>
            <p className="mt-3 text-sm font-semibold text-slate-800">{formatPrice(plan.prices.monthlyCents, plans.currency, 'monthly')}</p>
            <p className="mt-1 text-sm text-slate-600">{formatPrice(plan.prices.yearlyCents, plans.currency, 'yearly')}</p>
            <p className="mt-3 text-xs leading-5 text-slate-500">{plan.limits.organizations === null ? 'Negotiated organization limit' : `Up to ${plan.limits.organizations} organization${plan.limits.organizations === 1 ? '' : 's'}`}</p>
          </article>)}
        </div> : <div className="border-t border-slate-100 px-4 py-5 text-sm text-slate-500">Plan catalog is unavailable.</div>}
      </section>

      {account?.subscriptionHistory && account.subscriptionHistory.length > 1 && <section className={panel} aria-labelledby="billing-history-heading"><div className="px-4 py-4 sm:px-5"><h2 id="billing-history-heading" className="text-base font-bold text-slate-900">Subscription history</h2><div className="mt-3 space-y-2">{account.subscriptionHistory.filter((item) => !item.isCurrent).map((item, index) => <p key={`${item.planIdentifier}-${item.trialStartedAt ?? item.currentPeriodStartsAt ?? index}`} className="text-sm text-slate-600">{item.planIdentifier} · {item.billingInterval.toLowerCase()} · <span className="capitalize">{formatStatus(item.status)}</span></p>)}</div></div></section>}

      {!!account?.subscriptionEvents.length && <section className={panel} aria-labelledby="billing-events-heading"><div className="px-4 py-4 sm:px-5"><h2 id="billing-events-heading" className="text-base font-bold text-slate-900">Recent subscription events</h2><ol className="mt-3 divide-y divide-slate-100">{account.subscriptionEvents.map((event, index) => <li key={`${event.eventType}-${event.occurredAt}-${index}`} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold text-slate-800">{event.eventType.replaceAll('_', ' ').toLowerCase()}</span><span className="text-slate-600">{event.previousStatus ? `${formatStatus(event.previousStatus)} → ` : ''}{formatStatus(event.status)} · {new Date(event.occurredAt).toLocaleString()}</span></li>)}</ol></div></section>}
    </div>
  );
}
