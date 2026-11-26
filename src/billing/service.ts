import { and, count, desc, eq, isNotNull } from 'drizzle-orm';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { NodePgDatabase, NodePgTransaction } from 'drizzle-orm/node-postgres';
import type { DecodedIdToken } from 'firebase-admin/auth';
import * as schema from '../db/schema';
import {
  PLAN_CATALOG,
  PLAN_CATALOG_VERSION,
  buildTrialEntitlementSnapshot,
  isCatalogVersionSupported,
  type BillingInterval,
  type EnterpriseEntitlementOverrides,
  type PlanIdentifier,
} from './plan-catalog';
import {
  accountSubscriptionEvents,
  accountSubscriptions,
  billingAccountEntitlementOverrides,
  billingAccountOrganizations,
  billingAccounts,
  billingTrialHistory,
  memberships,
  subscriptions,
  users,
} from '../db/schema';
import {
  BILLING_PLAN_IDENTIFIERS,
  evaluateOrganizationLimit,
  evaluateTrialEligibility,
  isBillingOwner,
  planCurrentSubscriptionReplacement,
  type PlanEntitlements,
  type TrialEligibilityPolicy,
} from './entitlements';
import { resolveEnterpriseOverride } from './enterprise-overrides';

export type BillingDatabase = NodePgDatabase<typeof schema>;
export type BillingTransaction = NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;
type BillingExecutor = BillingDatabase | BillingTransaction;
export type BillingTokenPrincipal = Pick<DecodedIdToken, 'uid'>;

export class BillingServiceError extends Error {
  constructor(
    readonly code: 'BILLING_USER_UNAVAILABLE' | 'BILLING_ACCOUNT_NOT_FOUND' | 'BILLING_OWNER_REQUIRED' | 'ORGANIZATION_OWNERSHIP_REQUIRED' | 'ORGANIZATION_LIMIT_REACHED' | 'BILLING_SUBSCRIPTION_REQUIRED' | 'ORGANIZATION_ALREADY_LINKED' | 'CURRENT_SUBSCRIPTION_NOT_TERMINATED' | 'TRIAL_NOT_ELIGIBLE' | 'PLAN_ENTITLEMENTS_UNCONFIGURED',
    message: string,
  ) {
    super(message);
    this.name = 'BillingServiceError';
  }
}

async function findActiveUser(executor: BillingExecutor, verifiedToken: BillingTokenPrincipal) {
  const [user] = await executor.select().from(users).where(eq(users.firebaseUid, verifiedToken.uid)).limit(1);
  if (!user || user.status !== 'ACTIVE') {
    throw new BillingServiceError('BILLING_USER_UNAVAILABLE', 'The authenticated account is unavailable.');
  }
  return user;
}

async function findOwnedBillingAccount(executor: BillingExecutor, verifiedToken: BillingTokenPrincipal, accountId?: string) {
  const user = await findActiveUser(executor, verifiedToken);
  const whereClause = accountId
    ? and(eq(billingAccounts.ownerUserId, user.id), eq(billingAccounts.id, accountId))
    : eq(billingAccounts.ownerUserId, user.id);
  const [account] = await executor.select().from(billingAccounts).where(whereClause).limit(1);
  if (!account) throw new BillingServiceError('BILLING_ACCOUNT_NOT_FOUND', 'Billing account not found.');
  return { user, account };
}

/** Look up the billing account for the UID from a verified Firebase ID token. */
export async function getBillingAccount(executor: BillingExecutor, verifiedToken: BillingTokenPrincipal) {
  return (await findOwnedBillingAccount(executor, verifiedToken)).account;
}

/** Owner-scoped, read-only billing overview. It never creates an account or starts a trial. */
export async function getBillingOverview(executor: BillingExecutor, verifiedToken: BillingTokenPrincipal) {
  const user = await findActiveUser(executor, verifiedToken);
  const [account] = await executor.select().from(billingAccounts)
    .where(eq(billingAccounts.ownerUserId, user.id)).limit(1);
  if (!account) return { account: null, currentSubscription: null, subscriptionHistory: [], subscriptionEvents: [], linkedOrganizationCount: 0 };
  const history = await executor.select().from(accountSubscriptions)
    .where(eq(accountSubscriptions.billingAccountId, account.id))
    .orderBy(accountSubscriptions.createdAt);
  const [currentSubscription] = history.filter((subscription) => subscription.isCurrent);
  const [organizationCount] = await executor.select({ value: count() }).from(billingAccountOrganizations)
    .where(eq(billingAccountOrganizations.billingAccountId, account.id));
  const subscriptionEvents = await executor.select({
    eventType: accountSubscriptionEvents.eventType,
    occurredAt: accountSubscriptionEvents.occurredAt,
    previousStatus: accountSubscriptionEvents.previousStatus,
    status: accountSubscriptionEvents.status,
    previousPeriodStartsAt: accountSubscriptionEvents.previousPeriodStartsAt,
    previousPeriodEndsAt: accountSubscriptionEvents.previousPeriodEndsAt,
    periodStartsAt: accountSubscriptionEvents.periodStartsAt,
    periodEndsAt: accountSubscriptionEvents.periodEndsAt,
  }).from(accountSubscriptionEvents)
    .innerJoin(accountSubscriptions, eq(accountSubscriptionEvents.accountSubscriptionId, accountSubscriptions.id))
    .where(eq(accountSubscriptions.billingAccountId, account.id))
    .orderBy(desc(accountSubscriptionEvents.occurredAt))
    .limit(50);
  return {
    account,
    currentSubscription: currentSubscription ?? null,
    subscriptionHistory: history,
    subscriptionEvents,
    linkedOrganizationCount: organizationCount?.value ?? 0,
  };
}

/** Create one account for an existing active RentFlow user; never starts a trial or subscription. */
export async function createBillingAccount(db: BillingDatabase, verifiedToken: BillingTokenPrincipal) {
  return db.transaction(async (tx) => {
    const user = await findActiveUser(tx, verifiedToken);
    await tx.insert(billingAccounts).values({ ownerUserId: user.id }).onConflictDoNothing({ target: billingAccounts.ownerUserId });
    const [account] = await tx.select().from(billingAccounts).where(eq(billingAccounts.ownerUserId, user.id)).limit(1);
    if (!account) throw new BillingServiceError('BILLING_ACCOUNT_NOT_FOUND', 'Billing account could not be created.');
    return account;
  });
}

/** Resolve an organization link only for its billing owner. Organization team members are not billing owners. */
export async function getOrganizationBillingAccount(
  executor: BillingExecutor,
  verifiedToken: BillingTokenPrincipal,
  organizationId: string,
) {
  const user = await findActiveUser(executor, verifiedToken);
  const [link] = await executor.select({ account: billingAccounts })
    .from(billingAccountOrganizations)
    .innerJoin(billingAccounts, eq(billingAccountOrganizations.billingAccountId, billingAccounts.id))
    .where(eq(billingAccountOrganizations.organizationId, organizationId))
    .limit(1);
  if (!link) throw new BillingServiceError('BILLING_ACCOUNT_NOT_FOUND', 'Organization billing account not found.');
  if (!isBillingOwner(user.id, link.account.ownerUserId)) {
    throw new BillingServiceError('BILLING_OWNER_REQUIRED', 'Only the billing account owner can access billing details.');
  }
  return link.account;
}

export async function getAccountSubscription(
  executor: BillingExecutor,
  verifiedToken: BillingTokenPrincipal,
  accountId: string,
) {
  const { account } = await findOwnedBillingAccount(executor, verifiedToken, accountId);
  const [subscription] = await executor.select().from(accountSubscriptions)
    .where(and(eq(accountSubscriptions.billingAccountId, account.id), eq(accountSubscriptions.isCurrent, true))).limit(1);
  return subscription ?? null;
}

export async function getAccountSubscriptionHistory(
  executor: BillingExecutor,
  verifiedToken: BillingTokenPrincipal,
  accountId: string,
) {
  const { account } = await findOwnedBillingAccount(executor, verifiedToken, accountId);
  return executor.select().from(accountSubscriptions)
    .where(eq(accountSubscriptions.billingAccountId, account.id))
    .orderBy(accountSubscriptions.createdAt);
}

export async function getAccountTrialHistory(
  executor: BillingExecutor,
  verifiedToken: BillingTokenPrincipal,
  accountId: string,
) {
  const { account } = await findOwnedBillingAccount(executor, verifiedToken, accountId);
  return executor.select().from(billingTrialHistory)
    .where(eq(billingTrialHistory.billingAccountId, account.id))
    .orderBy(billingTrialHistory.evaluatedAt);
}

/**
 * Trial eligibility based on Firebase Admin creation metadata plus trusted
 * RentFlow history. The caller supplies metadata obtained server-side; never
 * pass a request-body date or a client-side "new account" flag.
 */
export async function evaluateAndRecordTrialEligibility(
  db: BillingDatabase,
  verifiedToken: BillingTokenPrincipal,
  firebaseAccountCreatedAt: Date,
  policy: TrialEligibilityPolicy,
) {
  return db.transaction(async (tx) => {
    const ownedAccount = await findOwnedBillingAccount(tx, verifiedToken);
    const { user, account } = await lockOwnedBillingAccount(tx, verifiedToken, ownedAccount.account.id);
    const history = await tx.select({ trialStartedAt: billingTrialHistory.trialStartedAt })
      .from(billingTrialHistory)
      .where(and(eq(billingTrialHistory.billingAccountId, account.id), isNotNull(billingTrialHistory.trialStartedAt)));
    const [legacySubscription] = await tx.select({ subscriptionId: subscriptions.id })
      .from(memberships)
      .innerJoin(subscriptions, eq(subscriptions.organizationId, memberships.organizationId))
      .where(eq(memberships.userId, user.id))
      .limit(1);
    const decision = evaluateTrialEligibility({
      policy,
      firebaseAccountCreatedAt,
      rentflowUserCreatedAt: user.createdAt,
      trialConsumedAt: account.trialConsumedAt,
      trialHistory: history,
      hasLegacySubscription: Boolean(legacySubscription),
    });
    const checkedAt = new Date();
    await tx.update(billingAccounts).set({
      trialEligibility: decision.eligible ? 'ELIGIBLE' : 'INELIGIBLE',
      trialEligibilityCheckedAt: checkedAt,
      trialEligibilityPolicyVersion: decision.policyVersion,
      updatedAt: checkedAt,
    }).where(eq(billingAccounts.id, account.id));
    await tx.insert(billingTrialHistory).values({
      billingAccountId: account.id,
      eligibilityDecision: decision.eligible ? 'ELIGIBLE' : 'REJECTED',
      decisionReasonCode: decision.eligible ? null : decision.reasonCode,
      policyVersion: decision.policyVersion,
      trialStatus: 'NOT_STARTED',
    });
    return decision;
  });
}

/** Fail closed unless server-verified payment-method evidence predates trial start. */
export function assertVerifiedPaymentMethodForTrial(verifiedAt: Date | null | undefined, trialStartsAt: Date): Date {
  if (!verifiedAt || !Number.isFinite(verifiedAt.getTime())
    || !Number.isFinite(trialStartsAt.getTime()) || verifiedAt > trialStartsAt) {
    throw new BillingServiceError('TRIAL_NOT_ELIGIBLE', 'A verified payment method is required before a trial can start.');
  }
  return verifiedAt;
}

/**
 * Start the single account trial after a trusted backend eligibility check.
 * The caller must obtain firebaseAccountCreatedAt through Firebase Admin and
 * must not pass any client claim. No route invokes this until migration review.
 */
export async function startAccountTrial(input: {
  db: BillingDatabase;
  verifiedToken: BillingTokenPrincipal;
  firebaseAccountCreatedAt: Date;
  policy: TrialEligibilityPolicy;
  plan: PlanIdentifier;
  interval: BillingInterval;
  /** Timestamp supplied only from trusted provider verification, never the request body. */
  paymentMethodVerifiedAt: Date;
  now?: Date;
}) {
  const startedAt = input.now ?? new Date();
  const paymentMethodVerifiedAt = assertVerifiedPaymentMethodForTrial(input.paymentMethodVerifiedAt, startedAt);
  return input.db.transaction(async (tx) => {
    const owned = await findOwnedBillingAccount(tx, input.verifiedToken);
    const { account } = await lockOwnedBillingAccount(tx, input.verifiedToken, owned.account.id);
    const history = await tx.select({ trialStartedAt: billingTrialHistory.trialStartedAt })
      .from(billingTrialHistory).where(eq(billingTrialHistory.billingAccountId, account.id));
    const [previousAccountSubscription] = await tx.select({ id: accountSubscriptions.id })
      .from(accountSubscriptions).where(eq(accountSubscriptions.billingAccountId, account.id)).limit(1);
    const [legacySubscription] = await tx.select({ subscriptionId: subscriptions.id })
      .from(memberships)
      .innerJoin(subscriptions, eq(subscriptions.organizationId, memberships.organizationId))
      .where(eq(memberships.userId, owned.user.id))
      .limit(1);
    const decision = evaluateTrialEligibility({
      policy: input.policy,
      firebaseAccountCreatedAt: input.firebaseAccountCreatedAt,
      rentflowUserCreatedAt: owned.user.createdAt,
      trialConsumedAt: account.trialConsumedAt,
      trialHistory: history,
      hasLegacySubscription: Boolean(legacySubscription || previousAccountSubscription),
    });
    if (!decision.eligible || account.trialEligibility !== 'ELIGIBLE'
      || account.trialEligibilityPolicyVersion !== decision.policyVersion || account.status !== 'SETUP') {
      throw new BillingServiceError('TRIAL_NOT_ELIGIBLE', 'The billing account is not eligible for a trial under the current trusted policy.');
    }
    if (!BILLING_PLAN_IDENTIFIERS.includes(input.plan)) {
      throw new BillingServiceError('PLAN_ENTITLEMENTS_UNCONFIGURED', 'The selected catalog plan is not supported.');
    }
    const [existingCurrent] = await tx.select({ id: accountSubscriptions.id }).from(accountSubscriptions)
      .where(and(eq(accountSubscriptions.billingAccountId, account.id), eq(accountSubscriptions.isCurrent, true))).limit(1);
    if (existingCurrent) {
      throw new BillingServiceError('CURRENT_SUBSCRIPTION_NOT_TERMINATED', 'A trial cannot replace an existing current subscription.');
    }

    const endsAt = new Date(startedAt.getTime() + 336 * 60 * 60 * 1000);
    const plan = PLAN_CATALOG[input.plan];
    const amountCents = input.interval === 'MONTHLY' ? plan.prices.monthlyCents : plan.prices.yearlyCents;
    const priceIdentifier = input.interval === 'MONTHLY' ? plan.priceKeys.monthly : plan.priceKeys.yearly;
    let enterpriseOverrides: EnterpriseEntitlementOverrides | undefined;
    if (input.plan === 'ENTERPRISE') {
      const overrideRows = await tx.select().from(billingAccountEntitlementOverrides)
        .where(eq(billingAccountEntitlementOverrides.billingAccountId, account.id));
      const names = {
        organizations: 'limits.organizations',
        teamSeats: 'limits.team_seats',
        equipmentRecords: 'limits.equipment_records',
        rentalRequestsPerUtcMonth: 'limits.rental_requests_monthly',
      } as const;
      const resolved = {} as EnterpriseEntitlementOverrides;
      for (const [key, featureId] of Object.entries(names) as [keyof EnterpriseEntitlementOverrides, string][]) {
        let value: number | null;
        try {
          value = resolveEnterpriseOverride({ rows: overrideRows, featureId, catalogVersion: PLAN_CATALOG_VERSION, now: startedAt });
        } catch {
          throw new BillingServiceError('PLAN_ENTITLEMENTS_UNCONFIGURED', 'Enterprise trial entitlement history is ambiguous or invalid.');
        }
        if (value === null) {
          throw new BillingServiceError('PLAN_ENTITLEMENTS_UNCONFIGURED', 'Enterprise trial requires explicit account-level entitlement overrides.');
        }
        resolved[key] = value;
      }
      enterpriseOverrides = resolved;
    }
    const snapshot = buildTrialEntitlementSnapshot({
      plan: input.plan,
      interval: input.interval,
      startedAt,
      enterpriseOverrides,
    });
    const [subscription] = await tx.insert(accountSubscriptions).values({
      billingAccountId: account.id,
      isCurrent: true,
      planIdentifier: input.plan,
      catalogVersion: PLAN_CATALOG_VERSION,
      priceIdentifier,
      priceAmountCents: amountCents,
      entitlementSnapshot: snapshot,
      billingInterval: input.interval,
      status: 'TRIALING',
      paymentMethodVerifiedAt,
      trialStartedAt: startedAt,
      trialEndsAt: endsAt,
    }).returning();
    await recordAccountSubscriptionLifecycleEvent(tx, {
      accountSubscriptionId: subscription.id,
      eventType: 'TRIAL_STARTED',
      occurredAt: startedAt,
      status: 'TRIALING',
    });
    await tx.insert(billingTrialHistory).values({
      billingAccountId: account.id,
      eligibilityDecision: 'ELIGIBLE',
      policyVersion: decision.policyVersion,
      trialStartedAt: startedAt,
      trialEndsAt: endsAt,
      trialStatus: 'STARTED',
    });
    await tx.update(billingAccounts).set({
      status: 'TRIALING',
      trialConsumedAt: startedAt,
      trialEligibilityCheckedAt: startedAt,
      trialEligibilityPolicyVersion: decision.policyVersion,
      updatedAt: startedAt,
    }).where(eq(billingAccounts.id, account.id));
    return subscription;
  });
}

async function lockOwnedBillingAccount(tx: BillingTransaction, verifiedToken: BillingTokenPrincipal, accountId: string) {
  const user = await findActiveUser(tx, verifiedToken);
  const [account] = await tx.select().from(billingAccounts)
    .where(and(eq(billingAccounts.id, accountId), eq(billingAccounts.ownerUserId, user.id)))
    .for('update')
    .limit(1);
  if (!account) throw new BillingServiceError('BILLING_OWNER_REQUIRED', 'Only the billing account owner can manage this account.');
  return { user, account };
}

export type NewAccountSubscription = Omit<
  typeof accountSubscriptions.$inferInsert,
  'id' | 'billingAccountId' | 'isCurrent' | 'createdAt' | 'updatedAt' | 'status'
> & { status: 'PENDING' };

/**
 * Append a normalized lifecycle snapshot in the same transaction as the
 * corresponding current-state update. Only approved scalar state is stored;
 * provider webhook payloads and request data must never be passed here.
 */
export async function recordAccountSubscriptionLifecycleEvent(
  tx: BillingTransaction,
  input: Omit<typeof accountSubscriptionEvents.$inferInsert, 'id' | 'createdAt'>,
) {
  const [event] = await tx.insert(accountSubscriptionEvents).values(input).returning();
  return event;
}

/**
 * Start a new lifecycle without deleting the previous one. Call inside the
 * transaction that performs the provider-state transition. The billing-account
 * lock serializes attempts; the partial unique index is the final DB guard.
 */
export async function createCurrentAccountSubscription(
  tx: BillingTransaction,
  verifiedToken: BillingTokenPrincipal,
  accountId: string,
  input: NewAccountSubscription,
) {
  const { account } = await lockOwnedBillingAccount(tx, verifiedToken, accountId);
  const [current] = await tx.select().from(accountSubscriptions)
    .where(and(eq(accountSubscriptions.billingAccountId, account.id), eq(accountSubscriptions.isCurrent, true)))
    .for('update')
    .limit(1);

  const replacement = planCurrentSubscriptionReplacement(current ?? null);
  if (!replacement.allowed) {
    throw new BillingServiceError(
      'CURRENT_SUBSCRIPTION_NOT_TERMINATED',
      'The current subscription must be cancelled or expired before a replacement can be created.',
    );
  }

  const now = new Date();
  if (replacement.previousSubscriptionId) {
    await tx.update(accountSubscriptions)
      .set({ isCurrent: false, updatedAt: now })
      .where(eq(accountSubscriptions.id, replacement.previousSubscriptionId));
  }

  const [subscription] = await tx.insert(accountSubscriptions)
    .values({ ...input, billingAccountId: account.id, isCurrent: true })
    .returning();
  await recordAccountSubscriptionLifecycleEvent(tx, {
    accountSubscriptionId: subscription.id,
    eventType: 'SUBSCRIPTION_CREATED',
    occurredAt: now,
    status: subscription.status,
    periodStartsAt: subscription.currentPeriodStartsAt,
    periodEndsAt: subscription.currentPeriodEndsAt,
  });
  return subscription;
}

async function evaluateOrganizationCapacity(
  tx: BillingTransaction,
  accountId: string,
  entitlements: PlanEntitlements,
  now: Date,
) {
  const [subscription] = await tx.select().from(accountSubscriptions)
    .where(and(eq(accountSubscriptions.billingAccountId, accountId), eq(accountSubscriptions.isCurrent, true))).limit(1);
  const [organizationCount] = await tx.select({ value: count() }).from(billingAccountOrganizations)
    .where(eq(billingAccountOrganizations.billingAccountId, accountId));
  return evaluateOrganizationLimit({
    subscription: subscription ?? null,
    currentOrganizationCount: organizationCount?.value ?? 0,
    entitlements,
    now,
  });
}

async function assertValidSubscriptionForOrganizationLink(
  tx: BillingTransaction,
  account: typeof billingAccounts.$inferSelect,
  subscription: typeof accountSubscriptions.$inferSelect | undefined,
  now: Date,
) {
  if (!subscription || !subscription.isCurrent) {
    throw new BillingServiceError('BILLING_SUBSCRIPTION_REQUIRED', 'A current subscription is required.');
  }
  if (account.status !== subscription.status || !['ACTIVE', 'TRIALING'].includes(subscription.status)) {
    throw new BillingServiceError('BILLING_SUBSCRIPTION_REQUIRED', 'Billing account and subscription status do not match.');
  }
  if (subscription.status === 'ACTIVE') {
    if (!subscription.currentPeriodStartsAt || !subscription.currentPeriodEndsAt
      || now < subscription.currentPeriodStartsAt || now >= subscription.currentPeriodEndsAt) {
      throw new BillingServiceError('BILLING_SUBSCRIPTION_REQUIRED', 'The current paid billing period cannot be verified.');
    }
    return;
  }
  if (!subscription.trialStartedAt || !subscription.trialEndsAt || !account.trialConsumedAt
    || account.trialConsumedAt.getTime() !== subscription.trialStartedAt.getTime()
    || subscription.trialEndsAt.getTime() - subscription.trialStartedAt.getTime() !== 336 * 60 * 60 * 1000
    || subscription.trialEndsAt <= now) {
    throw new BillingServiceError('BILLING_SUBSCRIPTION_REQUIRED', 'The account trial cannot be verified or has expired.');
  }
  const [trialHistory] = await tx.select({ id: billingTrialHistory.id }).from(billingTrialHistory).where(and(
    eq(billingTrialHistory.billingAccountId, account.id),
    eq(billingTrialHistory.trialStartedAt, subscription.trialStartedAt),
    eq(billingTrialHistory.trialEndsAt, subscription.trialEndsAt),
    eq(billingTrialHistory.trialStatus, 'STARTED'),
  )).limit(1);
  if (!trialHistory) throw new BillingServiceError('BILLING_SUBSCRIPTION_REQUIRED', 'The trial history cannot be verified.');
}

/**
 * Call inside the same transaction that creates the organization. The owner
 * row lock serializes concurrent organization links for this billing account;
 * the unique organization FK constraint prevents linking it to another account.
 */
export async function linkOrganizationWithinLimit(
  tx: BillingTransaction,
  verifiedToken: BillingTokenPrincipal,
  accountId: string,
  organizationId: string,
  entitlements: PlanEntitlements,
  now = new Date(),
) {
  const { user, account } = await lockOwnedBillingAccount(tx, verifiedToken, accountId);
  const [currentSubscription] = await tx.select().from(accountSubscriptions)
    .where(and(eq(accountSubscriptions.billingAccountId, account.id), eq(accountSubscriptions.isCurrent, true))).limit(1);
  await assertValidSubscriptionForOrganizationLink(tx, account, currentSubscription, now);
  const [ownerMembership] = await tx.select({ id: memberships.id }).from(memberships)
    .where(and(
      eq(memberships.organizationId, organizationId),
      eq(memberships.userId, user.id),
      eq(memberships.role, 'ORG_OWNER'),
      eq(memberships.status, 'ACTIVE'),
    )).limit(1);
  if (!ownerMembership) {
    throw new BillingServiceError('ORGANIZATION_OWNERSHIP_REQUIRED', 'The billing owner must own the organization being linked.');
  }

  const [existingLink] = await tx.select().from(billingAccountOrganizations)
    .where(eq(billingAccountOrganizations.organizationId, organizationId)).limit(1);
  if (existingLink) {
    if (existingLink.billingAccountId === account.id) {
      throw new BillingServiceError('ORGANIZATION_ALREADY_LINKED', 'Organization is already linked to this billing account.');
    }
    throw new BillingServiceError('ORGANIZATION_ALREADY_LINKED', 'Organization is already linked to another billing account.');
  }

  const decision = await evaluateOrganizationCapacity(tx, account.id, entitlements, now);
  if (!decision.allowed) {
    throw new BillingServiceError(
      decision.reason === 'NO_ACTIVE_SUBSCRIPTION' ? 'BILLING_SUBSCRIPTION_REQUIRED' : 'ORGANIZATION_LIMIT_REACHED',
      'The billing account cannot add another organization under its current access.',
    );
  }

  const [link] = await tx.insert(billingAccountOrganizations)
    .values({ billingAccountId: account.id, organizationId }).returning();
  return link;
}

/**
 * Catalog-backed organization linking without trusting an account ID from a
 * caller. Use after creating the org/membership in the same transaction, and
 * before commit. The account row lock and Stage 1 unique FK constraint prevent
 * concurrent over-limit links and cross-account linking.
 */
export async function linkOwnedOrganizationWithinCatalogLimit(
  tx: BillingTransaction,
  verifiedToken: BillingTokenPrincipal,
  organizationId: string,
  now = new Date(),
) {
  const user = await findActiveUser(tx, verifiedToken);
  const [account] = await tx.select().from(billingAccounts)
    .where(eq(billingAccounts.ownerUserId, user.id)).for('update').limit(1);
  if (!account) throw new BillingServiceError('BILLING_ACCOUNT_NOT_FOUND', 'Billing account not found.');
  if (account.status !== 'ACTIVE' && account.status !== 'TRIALING') {
    throw new BillingServiceError('BILLING_SUBSCRIPTION_REQUIRED', 'The billing account does not have active access.');
  }
  const [subscription] = await tx.select().from(accountSubscriptions)
    .where(and(eq(accountSubscriptions.billingAccountId, account.id), eq(accountSubscriptions.isCurrent, true))).limit(1);
  await assertValidSubscriptionForOrganizationLink(tx, account, subscription, now);
  const planIdentifier = subscription.planIdentifier as PlanIdentifier;
  if (!BILLING_PLAN_IDENTIFIERS.includes(planIdentifier) || !isCatalogVersionSupported(subscription.catalogVersion)) {
    throw new BillingServiceError('PLAN_ENTITLEMENTS_UNCONFIGURED', 'The subscription catalog version is not supported.');
  }
  const snapshot = subscription.entitlementSnapshot as { catalogVersion?: unknown; planIdentifier?: unknown; limits?: unknown };
  if (snapshot.catalogVersion !== subscription.catalogVersion || snapshot.planIdentifier !== planIdentifier
    || !snapshot.limits || typeof snapshot.limits !== 'object') {
    throw new BillingServiceError('PLAN_ENTITLEMENTS_UNCONFIGURED', 'The immutable entitlement snapshot is unavailable.');
  }
  const snapshotLimits = snapshot.limits as Record<string, unknown>;
  let organizationLimit = snapshotLimits.organizations;
  if (planIdentifier === 'ENTERPRISE') {
    const overrides = await tx.select().from(billingAccountEntitlementOverrides)
      .where(and(eq(billingAccountEntitlementOverrides.billingAccountId, account.id), eq(billingAccountEntitlementOverrides.featureId, 'limits.organizations')));
    try {
      organizationLimit = resolveEnterpriseOverride({ rows: overrides, featureId: 'limits.organizations', catalogVersion: subscription.catalogVersion, now });
    } catch {
      throw new BillingServiceError('PLAN_ENTITLEMENTS_UNCONFIGURED', 'Enterprise organization overrides are ambiguous or invalid.');
    }
  }
  if (typeof organizationLimit !== 'number' || !Number.isSafeInteger(organizationLimit) || organizationLimit < 1) {
    throw new BillingServiceError('PLAN_ENTITLEMENTS_UNCONFIGURED', 'The organization limit is not configured.');
  }
  const entitlements: PlanEntitlements = { [planIdentifier]: { organizationLimit } };
  return linkOrganizationWithinLimit(tx, verifiedToken, account.id, organizationId, entitlements, now);
}

/** Reserve a provider event once; the DB unique key rejects duplicate deliveries. */
export async function reserveWebhookEvent(
  executor: BillingExecutor,
  input: { paymentProvider: 'PADDLE'; providerEventId: string; eventType: string },
) {
  const [event] = await executor.insert(schema.billingWebhookEvents).values(input)
    .onConflictDoNothing({ target: [schema.billingWebhookEvents.paymentProvider, schema.billingWebhookEvents.providerEventId] })
    .returning();
  return event ?? null;
}
