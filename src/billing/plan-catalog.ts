/**
 * Versioned account-level SaaS catalog. Update the version for any change to
 * prices or entitlements; each subscription stores its version and snapshot.
 * Prices are USD cents. Enterprise values are intentionally negotiated.
 */
export const PLAN_CATALOG_VERSION = 'v1' as const;
export const BASE_CURRENCY = 'USD' as const;

export const PLAN_IDENTIFIERS = ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const;
export type PlanIdentifier = (typeof PLAN_IDENTIFIERS)[number];
export type BillingInterval = 'MONTHLY' | 'YEARLY';

export const FEATURE_IDS = [
  'workspace.organization',
  'workspace.equipment',
  'workspace.customers',
  'workspace.rental_requests',
  'limits.organizations',
  'limits.team_seats',
  'limits.equipment_records',
  'limits.rental_requests_monthly',
  'team.invitations',
  'billing.customer_invoices',
  'billing.customer_payments',
  'analytics.reports',
  'operations.maintenance',
  'operations.inspections_handover',
  'operations.dispatch',
  'storefront.public_rentals',
  'ai.copilot',
  'ai.credits_monthly',
  'storage.persistent_bytes',
  'integrations.external',
  'integrations.gps_telematics',
  'integrations.customer_api_credentials',
  'enterprise.customization',
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

export type FeatureReadiness = 'AVAILABLE' | 'PLANNED' | 'UNAVAILABLE';
export type EntitlementScope = 'BILLING_ACCOUNT' | 'ORGANIZATION';
export type FeatureDefinition = {
  id: FeatureId;
  label: string;
  readiness: FeatureReadiness;
  scope: EntitlementScope;
  kind: 'CAPABILITY' | 'LIMIT';
  unit?: 'organizations' | 'unique_users' | 'records' | 'requests_per_utc_month' | 'credits_per_utc_month' | 'bytes';
  evidence: string;
};

export const FEATURE_CATALOG: Readonly<Record<FeatureId, FeatureDefinition>> = {
  'workspace.organization': { id: 'workspace.organization', label: 'Authenticated organization workspace', readiness: 'AVAILABLE', scope: 'ORGANIZATION', kind: 'CAPABILITY', evidence: 'Active workspace APIs and memberships' },
  'workspace.equipment': { id: 'workspace.equipment', label: 'Equipment records', readiness: 'AVAILABLE', scope: 'BILLING_ACCOUNT', kind: 'CAPABILITY', evidence: 'Authenticated equipment CRUD API' },
  'workspace.customers': { id: 'workspace.customers', label: 'Customer records', readiness: 'AVAILABLE', scope: 'BILLING_ACCOUNT', kind: 'CAPABILITY', evidence: 'Authenticated customer CRUD API' },
  'workspace.rental_requests': { id: 'workspace.rental_requests', label: 'Rental requests and server-side availability checks', readiness: 'AVAILABLE', scope: 'BILLING_ACCOUNT', kind: 'CAPABILITY', evidence: 'Authenticated booking API with server-side rate and availability checks' },
  'limits.organizations': { id: 'limits.organizations', label: 'Organizations', readiness: 'PLANNED', scope: 'BILLING_ACCOUNT', kind: 'LIMIT', unit: 'organizations', evidence: 'Account-level cap is not integrated into the active organization creation route' },
  'limits.team_seats': { id: 'limits.team_seats', label: 'Unique team seats', readiness: 'PLANNED', scope: 'BILLING_ACCOUNT', kind: 'LIMIT', unit: 'unique_users', evidence: 'Memberships exist; invitations and seat enforcement are not connected' },
  'limits.equipment_records': { id: 'limits.equipment_records', label: 'Equipment record limit', readiness: 'PLANNED', scope: 'BILLING_ACCOUNT', kind: 'LIMIT', unit: 'records', evidence: 'Account-level cap is not integrated into the active equipment creation route' },
  'limits.rental_requests_monthly': { id: 'limits.rental_requests_monthly', label: 'Rental requests per UTC calendar month', readiness: 'PLANNED', scope: 'BILLING_ACCOUNT', kind: 'LIMIT', unit: 'requests_per_utc_month', evidence: 'Account-level metering is not integrated into the active booking creation route' },
  'team.invitations': { id: 'team.invitations', label: 'Team invitations', readiness: 'PLANNED', scope: 'BILLING_ACCOUNT', kind: 'CAPABILITY', evidence: 'Membership roles exist, but invitation workflow is not connected to the active workspace' },
  'billing.customer_invoices': { id: 'billing.customer_invoices', label: 'Persistent customer invoices', readiness: 'UNAVAILABLE', scope: 'ORGANIZATION', kind: 'CAPABILITY', evidence: 'Invoice UI/context is not connected to verified active workspace persistence' },
  'billing.customer_payments': { id: 'billing.customer_payments', label: 'Customer payment processing', readiness: 'UNAVAILABLE', scope: 'ORGANIZATION', kind: 'CAPABILITY', evidence: 'No verified customer payment processing flow; legacy records are distinct from RentFlow SaaS billing' },
  'analytics.reports': { id: 'analytics.reports', label: 'Reports and analytics', readiness: 'PLANNED', scope: 'BILLING_ACCOUNT', kind: 'CAPABILITY', evidence: 'Current reports use demo/context data and are not connected to active workspace APIs' },
  'operations.maintenance': { id: 'operations.maintenance', label: 'Maintenance', readiness: 'PLANNED', scope: 'ORGANIZATION', kind: 'CAPABILITY', evidence: 'No verified active workspace persistence/API flow' },
  'operations.inspections_handover': { id: 'operations.inspections_handover', label: 'Inspections and handover', readiness: 'PLANNED', scope: 'ORGANIZATION', kind: 'CAPABILITY', evidence: 'Existing UI is not connected to verified persistent backend flow' },
  'operations.dispatch': { id: 'operations.dispatch', label: 'Advanced dispatch', readiness: 'PLANNED', scope: 'ORGANIZATION', kind: 'CAPABILITY', evidence: 'Not verified as an active persisted module' },
  'storefront.public_rentals': { id: 'storefront.public_rentals', label: 'Public rental storefront', readiness: 'UNAVAILABLE', scope: 'ORGANIZATION', kind: 'CAPABILITY', evidence: 'Preview/demo only; no verified public rental backend' },
  'ai.copilot': { id: 'ai.copilot', label: 'AI Copilot', readiness: 'UNAVAILABLE', scope: 'BILLING_ACCOUNT', kind: 'CAPABILITY', evidence: 'Gemini endpoints exist but are not workspace metered or cost controlled' },
  'ai.credits_monthly': { id: 'ai.credits_monthly', label: 'AI credits per UTC calendar month', readiness: 'UNAVAILABLE', scope: 'BILLING_ACCOUNT', kind: 'LIMIT', unit: 'credits_per_utc_month', evidence: 'No reliable AI usage metering or cost controls' },
  'storage.persistent_bytes': { id: 'storage.persistent_bytes', label: 'Persistent storage quota', readiness: 'UNAVAILABLE', scope: 'BILLING_ACCOUNT', kind: 'LIMIT', unit: 'bytes', evidence: 'No verified persistent storage infrastructure' },
  'integrations.external': { id: 'integrations.external', label: 'External integrations', readiness: 'UNAVAILABLE', scope: 'BILLING_ACCOUNT', kind: 'CAPABILITY', evidence: 'No supported production integration surface verified' },
  'integrations.gps_telematics': { id: 'integrations.gps_telematics', label: 'GPS and telematics', readiness: 'UNAVAILABLE', scope: 'BILLING_ACCOUNT', kind: 'CAPABILITY', evidence: 'Map component contains mock positions/devices; no telematics backend' },
  'integrations.customer_api_credentials': { id: 'integrations.customer_api_credentials', label: 'Customer API credentials', readiness: 'UNAVAILABLE', scope: 'BILLING_ACCOUNT', kind: 'CAPABILITY', evidence: 'No API credential issuance or authorization system' },
  'enterprise.customization': { id: 'enterprise.customization', label: 'Enterprise customization', readiness: 'PLANNED', scope: 'BILLING_ACCOUNT', kind: 'CAPABILITY', evidence: 'Negotiated entitlement overrides are prepared; no customer-specific policy UI' },
};

export type PlanPrice = { monthlyCents: number | null; yearlyCents: number | null };
export type PlanLimits = {
  organizations: number | null;
  teamSeats: number | null;
  equipmentRecords: number | null;
  rentalRequestsPerUtcMonth: number | null;
};
export type PlanDefinition = {
  id: PlanIdentifier;
  displayName: string;
  prices: PlanPrice;
  /** Stable internal price keys; external provider identifiers are configured only after approval. */
  priceKeys: { monthly: string | null; yearly: string | null };
  limits: PlanLimits;
  capabilities: Readonly<Partial<Record<FeatureId, boolean>>>;
  availability: 'AVAILABLE' | 'CUSTOM';
};

const commonCapabilities = {
  'workspace.organization': true,
  'workspace.equipment': true,
  'workspace.customers': true,
  'workspace.rental_requests': true,
} as const;

export const PLAN_CATALOG: Readonly<Record<PlanIdentifier, PlanDefinition>> = {
  STARTER: { id: 'STARTER', displayName: 'Starter', prices: { monthlyCents: 2500, yearlyCents: 25000 }, priceKeys: { monthly: 'rentflow.v1.starter.monthly.usd', yearly: 'rentflow.v1.starter.yearly.usd' }, limits: { organizations: 1, teamSeats: 3, equipmentRecords: 50, rentalRequestsPerUtcMonth: 100 }, capabilities: commonCapabilities, availability: 'AVAILABLE' },
  PRO: { id: 'PRO', displayName: 'Pro', prices: { monthlyCents: 6900, yearlyCents: 69000 }, priceKeys: { monthly: 'rentflow.v1.pro.monthly.usd', yearly: 'rentflow.v1.pro.yearly.usd' }, limits: { organizations: 3, teamSeats: 10, equipmentRecords: 250, rentalRequestsPerUtcMonth: 500 }, capabilities: commonCapabilities, availability: 'AVAILABLE' },
  BUSINESS: { id: 'BUSINESS', displayName: 'Business', prices: { monthlyCents: 12900, yearlyCents: 129000 }, priceKeys: { monthly: 'rentflow.v1.business.monthly.usd', yearly: 'rentflow.v1.business.yearly.usd' }, limits: { organizations: 10, teamSeats: 30, equipmentRecords: 1000, rentalRequestsPerUtcMonth: 2500 }, capabilities: commonCapabilities, availability: 'AVAILABLE' },
  ENTERPRISE: { id: 'ENTERPRISE', displayName: 'Enterprise', prices: { monthlyCents: null, yearlyCents: null }, priceKeys: { monthly: null, yearly: null }, limits: { organizations: null, teamSeats: null, equipmentRecords: null, rentalRequestsPerUtcMonth: null }, capabilities: commonCapabilities, availability: 'CUSTOM' },
};

export type EnterpriseEntitlementOverrides = Partial<Record<keyof PlanLimits, number>>;

export function buildPlanEntitlementSnapshot(input: {
  plan: PlanIdentifier;
  interval: BillingInterval;
  enterpriseOverrides?: EnterpriseEntitlementOverrides;
}) {
  const definition = PLAN_CATALOG[input.plan];
  const priceAmountCents = input.interval === 'MONTHLY' ? definition.prices.monthlyCents : definition.prices.yearlyCents;
  const limits = Object.fromEntries(
    (Object.keys(definition.limits) as (keyof PlanLimits)[]).map((key) => [key, getPlanLimit(input.plan, key, input.enterpriseOverrides)]),
  ) as PlanLimits;
  if (priceAmountCents === null && input.plan !== 'ENTERPRISE') throw new Error('A configured price is required for this plan interval.');
  if (input.plan === 'ENTERPRISE' && Object.values(limits).some((value) => value === null)) {
    throw new Error('Enterprise requires explicit negotiated overrides for every numeric limit.');
  }
  return {
    catalogVersion: PLAN_CATALOG_VERSION,
    planIdentifier: input.plan,
    billingInterval: input.interval,
    priceAmountCents,
    limits,
    capabilities: definition.capabilities,
  } as const;
}

export function buildTrialEntitlementSnapshot(input: {
  plan: PlanIdentifier;
  interval: BillingInterval;
  startedAt: Date;
  enterpriseOverrides?: EnterpriseEntitlementOverrides;
}) {
  if (!Number.isFinite(input.startedAt.getTime())) throw new RangeError('Trial start must be a valid date.');
  const base = buildPlanEntitlementSnapshot(input);
  return {
    ...base,
    limits: { ...base.limits, organizations: 1 },
    trialStartedAt: input.startedAt.toISOString(),
    trialEndsAt: new Date(input.startedAt.getTime() + 336 * 60 * 60 * 1000).toISOString(),
  } as const;
}

export type AccountUsageSnapshot = {
  organizations: number;
  teamSeats: number;
  equipmentRecords: number;
  rentalRequestsPerUtcMonth: number;
};

export function evaluatePlanChangeImpact(limits: PlanLimits, usage: AccountUsageSnapshot) {
  const overLimit: (keyof AccountUsageSnapshot)[] = [];
  const pairs: [keyof AccountUsageSnapshot, number | null][] = [
    ['organizations', limits.organizations],
    ['teamSeats', limits.teamSeats],
    ['equipmentRecords', limits.equipmentRecords],
    ['rentalRequestsPerUtcMonth', limits.rentalRequestsPerUtcMonth],
  ];
  for (const [key, limit] of pairs) {
    const used = usage[key];
    if (!Number.isSafeInteger(used) || used < 0) throw new RangeError(`${key} usage must be a non-negative integer.`);
    if (limit === null || limit === undefined) continue;
    if (used > limit) overLimit.push(key);
  }
  return {
    overLimit,
    existingDataPreserved: true as const,
    requiresOwnerResolution: overLimit.length > 0,
    mayAddMore: pairs.every(([key, limit]) => limit === null || limit === undefined || usage[key] < limit),
  };
}

/** Return only configured, finite non-negative values; missing overrides fail closed. */
export function getPlanLimit(plan: PlanIdentifier, key: keyof PlanLimits, overrides: EnterpriseEntitlementOverrides = {}): number | null {
  const configured = PLAN_CATALOG[plan].limits[key];
  const value = plan === 'ENTERPRISE' ? overrides[key] : configured;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function calculateAnnualSavings(monthlyCents: number, yearlyCents: number) {
  if (!Number.isSafeInteger(monthlyCents) || monthlyCents <= 0 || !Number.isSafeInteger(yearlyCents) || yearlyCents < 0) {
    throw new RangeError('Monthly price must be positive integer cents and yearly price non-negative integer cents.');
  }
  const twelveMonthlyPayments = monthlyCents * 12;
  return {
    savedCents: twelveMonthlyPayments - yearlyCents,
    discountNumerator: twelveMonthlyPayments - yearlyCents,
    discountDenominator: twelveMonthlyPayments,
    annualMonthlyEquivalentCents: yearlyCents / 10,
  } as const;
}

export type UsagePeriod = { startsAt: Date; endsAt: Date };

/** Quota period is UTC calendar month, independent of monthly/yearly billing. */
export function getUtcUsageMonth(at: Date): UsagePeriod {
  if (!Number.isFinite(at.getTime())) throw new RangeError('Usage timestamp must be valid.');
  const startsAt = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const endsAt = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  return { startsAt, endsAt };
}

export function countUniqueSeatUsers(memberships: readonly { userId: string; status: string }[]): number {
  return new Set(memberships.filter((membership) => membership.status === 'ACTIVE').map((membership) => membership.userId)).size;
}

export function canConsumeQuota(input: { used: number; requested: number; limit: number }): boolean {
  return Number.isSafeInteger(input.used) && input.used >= 0
    && Number.isSafeInteger(input.requested) && input.requested > 0
    && Number.isSafeInteger(input.limit) && input.limit >= 0
    && input.used + input.requested <= input.limit;
}

export function evaluateSubscriptionAccess(input: {
  accountStatus: string;
  status: string;
  isCurrent: boolean;
  now: Date;
  periodStartsAt: Date | null;
  periodEndsAt: Date | null;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  trialConsumedAt: Date | null;
  trialHistoryVerified: boolean;
}): { allowed: boolean; reason: 'ALLOWED' | 'NONCURRENT' | 'ACCOUNT_INACTIVE' | 'ACCOUNT_SUBSCRIPTION_MISMATCH' | 'STATUS_INACTIVE' | 'PERIOD_UNVERIFIED' | 'PERIOD_EXPIRED' | 'TRIAL_UNVERIFIED' | 'TRIAL_EXPIRED' } {
  const deny = (reason: Exclude<ReturnType<typeof evaluateSubscriptionAccess>['reason'], 'ALLOWED'>) => ({ allowed: false, reason });
  if (!input.isCurrent) return deny('NONCURRENT');
  if (input.accountStatus !== input.status) return deny('ACCOUNT_SUBSCRIPTION_MISMATCH');
  if (!['ACTIVE', 'TRIALING'].includes(input.accountStatus)) return deny('ACCOUNT_INACTIVE');
  if (input.status === 'TRIALING') {
    if (!input.trialStartsAt || !input.trialEndsAt || !input.trialConsumedAt || !input.trialHistoryVerified
      || input.trialEndsAt.getTime() - input.trialStartsAt.getTime() !== 336 * 60 * 60 * 1000
      || input.trialConsumedAt.getTime() !== input.trialStartsAt.getTime()) return deny('TRIAL_UNVERIFIED');
    if (input.trialEndsAt <= input.now) return deny('TRIAL_EXPIRED');
    return { allowed: true, reason: 'ALLOWED' };
  }
  if (input.status !== 'ACTIVE') return deny('STATUS_INACTIVE');
  if (!input.periodStartsAt || !input.periodEndsAt) return deny('PERIOD_UNVERIFIED');
  if (input.periodEndsAt <= input.periodStartsAt) return deny('PERIOD_UNVERIFIED');
  if (input.now < input.periodStartsAt || input.now >= input.periodEndsAt) return deny('PERIOD_EXPIRED');
  return { allowed: true, reason: 'ALLOWED' };
}

export function isCatalogVersionSupported(version: string): boolean {
  return version === PLAN_CATALOG_VERSION;
}
