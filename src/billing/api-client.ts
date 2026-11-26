import { readApiError } from '../lib/api';

export type BillingPlanContract = {
  id: string;
  name: string;
  availability: 'AVAILABLE' | 'CUSTOM';
  prices: { monthlyCents: number | null; yearlyCents: number | null };
  limits: { organizations: number | null; teamSeats: number | null; equipmentRecords: number | null; rentalRequestsPerUtcMonth: number | null };
};

export type BillingPlansContract = {
  catalogVersion: string;
  currency: string;
  trialDays: 14;
  trialRequiresVerifiedPaymentMethod: true;
  plans: BillingPlanContract[];
};

export type BillingSubscriptionContract = {
  planIdentifier: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  status: 'PENDING' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'SUSPENDED' | 'EXPIRED';
  isCurrent: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStartsAt: string | null;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancellationRequestedAt: string | null;
  cancelledAt: string | null;
  organizationLimit: number | null;
};

export type BillingAccountContract = {
  account: {
    status: string;
    trialEligibility: string;
    trialEligibilityCheckedAt: string | null;
    trialConsumedAt: string | null;
  } | null;
  currentSubscription: BillingSubscriptionContract | null;
  subscriptionHistory: BillingSubscriptionContract[];
  subscriptionEvents: {
    eventType: string;
    occurredAt: string;
    previousStatus: BillingSubscriptionContract['status'] | null;
    status: BillingSubscriptionContract['status'];
    previousPeriodStartsAt: string | null;
    previousPeriodEndsAt: string | null;
    periodStartsAt: string | null;
    periodEndsAt: string | null;
  }[];
  organizations: { linkedCount: number; limit: number | null };
  checkoutAvailable: false;
};

type AuthenticatedFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function loadBillingPlans(authenticatedFetch: AuthenticatedFetch): Promise<BillingPlansContract> {
  const response = await authenticatedFetch('/api/billing/plans');
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<BillingPlansContract>;
}

export async function loadBillingAccount(authenticatedFetch: AuthenticatedFetch): Promise<BillingAccountContract> {
  const response = await authenticatedFetch('/api/billing/account');
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<BillingAccountContract>;
}
