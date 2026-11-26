export const BILLING_PLAN_IDENTIFIERS = ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const;
export type BillingPlanIdentifier = (typeof BILLING_PLAN_IDENTIFIERS)[number];

export type PlanEntitlement = {
  /** Omit until the plan's organization allowance has been approved. */
  organizationLimit?: number;
};

export type PlanEntitlements = Partial<Record<BillingPlanIdentifier, PlanEntitlement>>;

export function isBillingOwner(authenticatedUserId: string, billingOwnerUserId: string): boolean {
  return authenticatedUserId === billingOwnerUserId;
}

export type SubscriptionForLimit = {
  planIdentifier: string;
  status: string;
  isCurrent: boolean;
  trialEndsAt: Date | null;
};

export function isTerminatedSubscriptionStatus(status: string): boolean {
  return status === 'CANCELLED' || status === 'EXPIRED';
}

export function planCurrentSubscriptionReplacement(current: {
  id: string;
  status: string;
  isCurrent: boolean;
} | null): { allowed: true; previousSubscriptionId: string | null } | { allowed: false } {
  if (!current) return { allowed: true, previousSubscriptionId: null };
  if (!current.isCurrent || !isTerminatedSubscriptionStatus(current.status)) return { allowed: false };
  return { allowed: true, previousSubscriptionId: current.id };
}

export type OrganizationLimitDecision = {
  allowed: boolean;
  currentOrganizationCount: number;
  organizationLimit: number | null;
  reason: 'ALLOWED' | 'TRIAL_ORGANIZATION_LIMIT' | 'PLAN_ORGANIZATION_LIMIT' | 'PLAN_ENTITLEMENTS_UNCONFIGURED' | 'NO_ACTIVE_SUBSCRIPTION' | 'TRIAL_EXPIRED';
};

export function evaluateOrganizationLimit(input: {
  subscription: SubscriptionForLimit | null;
  currentOrganizationCount: number;
  entitlements: PlanEntitlements;
  now?: Date;
}): OrganizationLimitDecision {
  const { subscription, currentOrganizationCount, entitlements } = input;
  const now = input.now ?? new Date();

  if (!Number.isSafeInteger(currentOrganizationCount) || currentOrganizationCount < 0) {
    throw new RangeError('Organization count must be a non-negative safe integer.');
  }

  if (!subscription || !subscription.isCurrent) {
    return { allowed: false, currentOrganizationCount, organizationLimit: null, reason: 'NO_ACTIVE_SUBSCRIPTION' };
  }

  if (subscription.status === 'TRIALING') {
    if (!subscription.trialEndsAt || subscription.trialEndsAt.getTime() <= now.getTime()) {
      return { allowed: false, currentOrganizationCount, organizationLimit: 1, reason: 'TRIAL_EXPIRED' };
    }
    const allowed = currentOrganizationCount < 1;
    return {
      allowed,
      currentOrganizationCount,
      organizationLimit: 1,
      reason: allowed ? 'ALLOWED' : 'TRIAL_ORGANIZATION_LIMIT',
    };
  }

  if (subscription.status !== 'ACTIVE') {
    return { allowed: false, currentOrganizationCount, organizationLimit: null, reason: 'NO_ACTIVE_SUBSCRIPTION' };
  }

  if (!BILLING_PLAN_IDENTIFIERS.includes(subscription.planIdentifier as BillingPlanIdentifier)) {
    return { allowed: false, currentOrganizationCount, organizationLimit: null, reason: 'PLAN_ENTITLEMENTS_UNCONFIGURED' };
  }

  const limit = entitlements[subscription.planIdentifier as BillingPlanIdentifier]?.organizationLimit;
  if (limit === undefined || !Number.isSafeInteger(limit) || limit < 1) {
    return { allowed: false, currentOrganizationCount, organizationLimit: null, reason: 'PLAN_ENTITLEMENTS_UNCONFIGURED' };
  }

  const allowed = currentOrganizationCount < limit;
  return {
    allowed,
    currentOrganizationCount,
    organizationLimit: limit,
    reason: allowed ? 'ALLOWED' : 'PLAN_ORGANIZATION_LIMIT',
  };
}

export const TRIAL_DURATION_HOURS = 14 * 24;

export function calculateTrialEnd(startedAt: Date): Date {
  if (!Number.isFinite(startedAt.getTime())) throw new RangeError('Trial start must be a valid date.');
  return new Date(startedAt.getTime() + TRIAL_DURATION_HOURS * 60 * 60 * 1000);
}

export type TrialEligibilityPolicy = {
  enabled: boolean;
  version: string;
  newAccountsCreatedAtOrAfter: Date;
};

export type TrialHistoryEntry = {
  trialStartedAt: Date | null;
};

export type TrialEligibilityDecision = {
  eligible: boolean;
  reasonCode: 'ELIGIBLE' | 'ROLLOUT_DISABLED' | 'ACCOUNT_HISTORY_UNAVAILABLE' | 'ACCOUNT_PREDATES_ROLLOUT' | 'TRIAL_ALREADY_USED' | 'LEGACY_SUBSCRIPTION_EXISTS';
  policyVersion: string;
};

/**
 * Evaluate only with account dates and history fetched by trusted backend code.
 * The caller must source firebaseAccountCreatedAt from Firebase Admin metadata,
 * never from request data. Rejected checks do not consume the one trial.
 */
export function evaluateTrialEligibility(input: {
  policy: TrialEligibilityPolicy;
  firebaseAccountCreatedAt: Date;
  rentflowUserCreatedAt: Date;
  trialConsumedAt: Date | null;
  trialHistory: readonly TrialHistoryEntry[];
  hasLegacySubscription: boolean;
}): TrialEligibilityDecision {
  const { policy } = input;
  const decision = (eligible: boolean, reasonCode: TrialEligibilityDecision['reasonCode']) => ({
    eligible,
    reasonCode,
    policyVersion: policy.version,
  });

  if (!policy.enabled) return decision(false, 'ROLLOUT_DISABLED');
  if (!policy.version.trim() || !Number.isFinite(policy.newAccountsCreatedAtOrAfter.getTime())
    || !Number.isFinite(input.firebaseAccountCreatedAt.getTime()) || !Number.isFinite(input.rentflowUserCreatedAt.getTime())) {
    return decision(false, 'ACCOUNT_HISTORY_UNAVAILABLE');
  }
  if (input.firebaseAccountCreatedAt.getTime() < policy.newAccountsCreatedAtOrAfter.getTime()
    || input.rentflowUserCreatedAt.getTime() < policy.newAccountsCreatedAtOrAfter.getTime()) {
    return decision(false, 'ACCOUNT_PREDATES_ROLLOUT');
  }
  if (input.trialConsumedAt || input.trialHistory.some((entry) => entry.trialStartedAt !== null)) {
    return decision(false, 'TRIAL_ALREADY_USED');
  }
  if (input.hasLegacySubscription) return decision(false, 'LEGACY_SUBSCRIPTION_EXISTS');
  return decision(true, 'ELIGIBLE');
}
