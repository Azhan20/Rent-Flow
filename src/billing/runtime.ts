/** Backend-only billing evaluation and usage operations. Intentionally not
 * imported by server.ts until the additive billing migrations are reviewed
 * and applied. Every principal must come from Firebase Admin verifyIdToken. */
import { and, count, countDistinct, eq, inArray } from 'drizzle-orm';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { NodePgDatabase, NodePgTransaction } from 'drizzle-orm/node-postgres';
import type { DecodedIdToken } from 'firebase-admin/auth';
import * as schema from '../db/schema';
import {
  accountSubscriptions,
  billingAccountEntitlementOverrides,
  billingAccountOrganizations,
  billingAccounts,
  billingUsageCounters,
  billingUsageEvents,
  equipment,
  memberships,
  organizations,
  billingTrialHistory,
  users,
} from '../db/schema';
import { BILLING_PLAN_IDENTIFIERS, isBillingOwner } from './entitlements';
import { resolveEnterpriseOverride } from './enterprise-overrides';
import {
  FEATURE_CATALOG,
  PLAN_CATALOG,
  canConsumeQuota,
  getUtcUsageMonth,
  evaluateSubscriptionAccess,
  isCatalogVersionSupported,
  type FeatureId,
  type PlanIdentifier,
} from './plan-catalog';

export type BillingRuntimeDatabase = NodePgDatabase<typeof schema>;
export type BillingRuntimeTransaction = NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;
type Executor = BillingRuntimeDatabase | BillingRuntimeTransaction;
export type VerifiedBillingPrincipal = Pick<DecodedIdToken, 'uid'>;

export class EntitlementError extends Error {
  constructor(readonly code: 'AUTH_REQUIRED' | 'MEMBERSHIP_REQUIRED' | 'BILLING_ACCOUNT_UNAVAILABLE' | 'SUBSCRIPTION_UNAVAILABLE' | 'CATALOG_UNAVAILABLE' | 'FEATURE_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'ENTERPRISE_OVERRIDE_REQUIRED' | 'BILLING_OWNER_REQUIRED' | 'USAGE_IDEMPOTENCY_CONFLICT', message: string) {
    super(message);
    this.name = 'EntitlementError';
  }
}

const WRITE_ROLES = ['ORG_OWNER', 'ORG_ADMIN', 'MANAGER', 'OPERATIONS'] as const;
type PlanSnapshot = {
  catalogVersion: string;
  planIdentifier: string;
  billingInterval: string;
  priceAmountCents: number | null;
  limits: Record<string, number | null>;
  capabilities: Record<string, boolean>;
};

function asPlanSnapshot(value: unknown): PlanSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const snapshot = value as Partial<PlanSnapshot>;
  if (typeof snapshot.catalogVersion !== 'string' || typeof snapshot.planIdentifier !== 'string'
    || typeof snapshot.billingInterval !== 'string' || !snapshot.limits || !snapshot.capabilities) return null;
  return snapshot as PlanSnapshot;
}

async function resolveMembership(executor: Executor, principal: VerifiedBillingPrincipal, organizationId: string, write = false) {
  if (!principal?.uid) throw new EntitlementError('AUTH_REQUIRED', 'A verified Firebase user is required.');
  const [user] = await executor.select().from(users)
    .where(and(eq(users.firebaseUid, principal.uid), eq(users.status, 'ACTIVE'))).limit(1);
  if (!user) throw new EntitlementError('AUTH_REQUIRED', 'The authenticated account is unavailable.');
  const [membership] = await executor.select().from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.organizationId, organizationId), eq(memberships.status, 'ACTIVE'))).limit(1);
  if (!membership || (write && !(WRITE_ROLES as readonly string[]).includes(membership.role))) {
    throw new EntitlementError('MEMBERSHIP_REQUIRED', 'An active organization membership with the required permission is required.');
  }
  const [organization] = await executor.select().from(organizations)
    .where(and(eq(organizations.id, organizationId), eq(organizations.status, 'ACTIVE'))).limit(1);
  if (!organization) throw new EntitlementError('MEMBERSHIP_REQUIRED', 'The organization is not active.');
  const [link] = await executor.select().from(billingAccountOrganizations)
    .where(eq(billingAccountOrganizations.organizationId, organizationId)).limit(1);
  if (!link) throw new EntitlementError('BILLING_ACCOUNT_UNAVAILABLE', 'The organization has no linked billing account.');
  const [account] = await executor.select().from(billingAccounts)
    .where(eq(billingAccounts.id, link.billingAccountId)).limit(1);
  if (!account) throw new EntitlementError('BILLING_ACCOUNT_UNAVAILABLE', 'The billing account is unavailable.');
  return { user, membership, link, account };
}

async function resolveActiveEntitlement(executor: Executor, principal: VerifiedBillingPrincipal, organizationId: string, now: Date) {
  const context = await resolveMembership(executor, principal, organizationId);
  if (!['ACTIVE', 'TRIALING'].includes(context.account.status)) {
    throw new EntitlementError('SUBSCRIPTION_UNAVAILABLE', 'The billing account does not have active access.');
  }
  const [subscription] = await executor.select().from(accountSubscriptions)
    .where(and(eq(accountSubscriptions.billingAccountId, context.account.id), eq(accountSubscriptions.isCurrent, true))).limit(1);
  if (!subscription || !subscription.isCurrent) throw new EntitlementError('SUBSCRIPTION_UNAVAILABLE', 'A current subscription is required.');
  const planId = subscription.planIdentifier as PlanIdentifier;
  if (!BILLING_PLAN_IDENTIFIERS.includes(planId) || !isCatalogVersionSupported(subscription.catalogVersion)) {
    throw new EntitlementError('CATALOG_UNAVAILABLE', 'The subscription catalog version is not supported.');
  }
  let trialHistoryVerified = false;
  if (subscription.status === 'TRIALING' && subscription.trialStartedAt && subscription.trialEndsAt) {
    const [trialRecord] = await executor.select({ id: billingTrialHistory.id }).from(billingTrialHistory).where(and(
      eq(billingTrialHistory.billingAccountId, context.account.id),
      eq(billingTrialHistory.trialStartedAt, subscription.trialStartedAt),
      eq(billingTrialHistory.trialEndsAt, subscription.trialEndsAt),
      eq(billingTrialHistory.trialStatus, 'STARTED'),
    )).limit(1);
    trialHistoryVerified = Boolean(trialRecord);
  }
  const access = evaluateSubscriptionAccess({
    accountStatus: context.account.status,
    status: subscription.status,
    isCurrent: subscription.isCurrent,
    now,
    periodStartsAt: subscription.currentPeriodStartsAt,
    periodEndsAt: subscription.currentPeriodEndsAt,
    trialStartsAt: subscription.trialStartedAt,
    trialEndsAt: subscription.trialEndsAt,
    trialConsumedAt: context.account.trialConsumedAt,
    trialHistoryVerified,
  });
  if (!access.allowed) throw new EntitlementError('SUBSCRIPTION_UNAVAILABLE', `Subscription access is not valid (${access.reason}).`);
  const snapshot = asPlanSnapshot(subscription.entitlementSnapshot);
  if (!snapshot || snapshot.catalogVersion !== subscription.catalogVersion || snapshot.planIdentifier !== planId
    || snapshot.billingInterval !== subscription.billingInterval) {
    throw new EntitlementError('CATALOG_UNAVAILABLE', 'The immutable entitlement snapshot is missing or inconsistent.');
  }
  return { ...context, subscription, planId, snapshot };
}

function getSnapshotLimit(snapshot: PlanSnapshot, feature: FeatureId): number | null {
  const limitKey: Partial<Record<FeatureId, string>> = {
    'limits.organizations': 'organizations',
    'limits.team_seats': 'teamSeats',
    'limits.equipment_records': 'equipmentRecords',
    'limits.rental_requests_monthly': 'rentalRequestsPerUtcMonth',
  };
  const key = limitKey[feature];
  if (!key) return null;
  const value = snapshot.limits[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

async function getEnterpriseLimitOverride(executor: Executor, accountId: string, feature: FeatureId, catalogVersion: string, now: Date) {
  const rows = await executor.select().from(billingAccountEntitlementOverrides)
    .where(and(eq(billingAccountEntitlementOverrides.billingAccountId, accountId), eq(billingAccountEntitlementOverrides.featureId, feature)));
  try {
    return resolveEnterpriseOverride({ rows, featureId: feature, catalogVersion, now });
  } catch {
    throw new EntitlementError('ENTERPRISE_OVERRIDE_REQUIRED', 'Enterprise override history is ambiguous or invalid.');
  }
}

export async function evaluateAccountFeature(input: {
  executor: Executor;
  principal: VerifiedBillingPrincipal;
  organizationId: string;
  featureId: FeatureId;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const definition = FEATURE_CATALOG[input.featureId];
  if (!definition || definition.readiness !== 'AVAILABLE') {
    throw new EntitlementError('FEATURE_UNAVAILABLE', 'This capability is not available for account entitlements.');
  }
  const state = await resolveActiveEntitlement(input.executor, input.principal, input.organizationId, now);
  if (state.subscription.status === 'TRIALING' && input.featureId === 'limits.organizations') {
    return { allowed: true, featureId: input.featureId, limit: 1, scope: definition.scope, catalogVersion: state.snapshot.catalogVersion };
  }
  const plan = PLAN_CATALOG[state.planId];
  if (!plan.capabilities[input.featureId]) {
    throw new EntitlementError('FEATURE_UNAVAILABLE', 'The current plan does not include this capability.');
  }
  let limit = getSnapshotLimit(state.snapshot, input.featureId);
  if (state.planId === 'ENTERPRISE' && definition.kind === 'LIMIT') {
    limit = await getEnterpriseLimitOverride(input.executor, state.account.id, input.featureId, state.snapshot.catalogVersion, now);
    if (limit === null) throw new EntitlementError('ENTERPRISE_OVERRIDE_REQUIRED', 'A current negotiated entitlement is required.');
  }
  return { allowed: true, featureId: input.featureId, limit, scope: definition.scope, catalogVersion: state.snapshot.catalogVersion };
}

export async function getAccountUsage(input: {
  executor: Executor;
  principal: VerifiedBillingPrincipal;
  organizationId: string;
  now?: Date;
}) {
  const state = await resolveActiveEntitlement(input.executor, input.principal, input.organizationId, input.now ?? new Date());
  const orgRows = await input.executor.select({ organizationId: billingAccountOrganizations.organizationId })
    .from(billingAccountOrganizations).where(eq(billingAccountOrganizations.billingAccountId, state.account.id));
  const organizationIds = orgRows.map((row) => row.organizationId);
  if (organizationIds.length === 0) throw new EntitlementError('BILLING_ACCOUNT_UNAVAILABLE', 'No organizations are linked to this account.');
  const [equipmentCount] = await input.executor.select({ value: count() }).from(equipment).where(inArray(equipment.organizationId, organizationIds));
  const [seatCount] = await input.executor.select({ value: countDistinct(memberships.userId) })
    .from(memberships).where(and(inArray(memberships.organizationId, organizationIds), eq(memberships.status, 'ACTIVE')));
  const month = getUtcUsageMonth(input.now ?? new Date());
  const [requestCount] = await input.executor.select({ value: billingUsageCounters.usedCount }).from(billingUsageCounters)
    .where(and(eq(billingUsageCounters.billingAccountId, state.account.id), eq(billingUsageCounters.featureId, 'limits.rental_requests_monthly'), eq(billingUsageCounters.periodStartsAt, month.startsAt))).limit(1);
  return {
    billingAccountId: state.account.id,
    equipmentRecords: equipmentCount?.value ?? 0,
    uniqueActiveTeamSeats: seatCount?.value ?? 0,
    rentalRequestsThisUtcMonth: requestCount?.value ?? 0,
    usagePeriod: month,
  };
}

/**
 * Atomically reserve one persisted rental request quota unit. Call inside the
 * same DB transaction as booking insert; a later booking failure rolls back
 * both counter and ledger event. All account reservations lock the account
 * row, serialize concurrent writes, and use an idempotency key generated by
 * trusted backend request handling.
 */
export async function reserveRentalRequestQuota(input: {
  tx: BillingRuntimeTransaction;
  principal: VerifiedBillingPrincipal;
  organizationId: string;
  idempotencyKey: string;
  sourceRecordId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!input.idempotencyKey.trim() || !input.sourceRecordId.trim()) {
    throw new EntitlementError('USAGE_IDEMPOTENCY_CONFLICT', 'A trusted idempotency key and rental request ID are required.');
  }
  const context = await resolveMembership(input.tx, input.principal, input.organizationId, true);
  const [lockedAccount] = await input.tx.select().from(billingAccounts)
    .where(eq(billingAccounts.id, context.account.id)).for('update').limit(1);
  if (!lockedAccount) throw new EntitlementError('BILLING_ACCOUNT_UNAVAILABLE', 'The billing account is unavailable.');
  const state = await resolveActiveEntitlement(input.tx, input.principal, input.organizationId, now);
  if (state.subscription.status === 'TRIALING' && state.subscription.trialEndsAt && state.subscription.trialEndsAt <= now) {
    throw new EntitlementError('SUBSCRIPTION_UNAVAILABLE', 'The trial has expired.');
  }
  const plan = PLAN_CATALOG[state.planId];
  if (!plan.capabilities['workspace.rental_requests']) throw new EntitlementError('FEATURE_UNAVAILABLE', 'Rental requests are not included.');
  let limit = getSnapshotLimit(state.snapshot, 'limits.rental_requests_monthly');
  if (state.planId === 'ENTERPRISE') {
    limit = await getEnterpriseLimitOverride(input.tx, state.account.id, 'limits.rental_requests_monthly', state.snapshot.catalogVersion, now);
    if (limit === null) throw new EntitlementError('ENTERPRISE_OVERRIDE_REQUIRED', 'A current negotiated rental request quota is required.');
  }
  if (limit === null) throw new EntitlementError('CATALOG_UNAVAILABLE', 'The monthly rental request quota is not configured.');

  const [priorEvent] = await input.tx.select().from(billingUsageEvents).where(and(
    eq(billingUsageEvents.billingAccountId, state.account.id),
    eq(billingUsageEvents.featureId, 'limits.rental_requests_monthly'),
    eq(billingUsageEvents.idempotencyKey, input.idempotencyKey),
  )).limit(1);
  if (priorEvent) {
    if (priorEvent.organizationId !== input.organizationId
      || priorEvent.sourceRecordId !== input.sourceRecordId) {
      throw new EntitlementError('USAGE_IDEMPOTENCY_CONFLICT', 'The idempotency key was already used for a different rental request.');
    }
    return { consumed: false, idempotentReplay: true, usedCount: null, limit, period: getUtcUsageMonth(now) };
  }

  const period = getUtcUsageMonth(now);
  await input.tx.insert(billingUsageCounters).values({
    billingAccountId: state.account.id,
    featureId: 'limits.rental_requests_monthly',
    periodStartsAt: period.startsAt,
    periodEndsAt: period.endsAt,
    usedCount: 0,
  }).onConflictDoNothing({ target: [billingUsageCounters.billingAccountId, billingUsageCounters.featureId, billingUsageCounters.periodStartsAt] });
  const [counter] = await input.tx.select().from(billingUsageCounters).where(and(
    eq(billingUsageCounters.billingAccountId, state.account.id),
    eq(billingUsageCounters.featureId, 'limits.rental_requests_monthly'),
    eq(billingUsageCounters.periodStartsAt, period.startsAt),
  )).for('update').limit(1);
  if (!counter || !canConsumeQuota({ used: counter.usedCount, requested: 1, limit })) {
    throw new EntitlementError('QUOTA_EXCEEDED', 'The account has reached its rental request quota for this UTC calendar month.');
  }
  const [updated] = await input.tx.update(billingUsageCounters).set({ usedCount: counter.usedCount + 1, updatedAt: now })
    .where(and(eq(billingUsageCounters.id, counter.id), eq(billingUsageCounters.usedCount, counter.usedCount))).returning();
  if (!updated) throw new EntitlementError('QUOTA_EXCEEDED', 'The rental request quota changed concurrently; retry the operation.');
  await input.tx.insert(billingUsageEvents).values({
    billingAccountId: state.account.id,
    organizationId: input.organizationId,
    featureId: 'limits.rental_requests_monthly',
    eventType: 'RENTAL_REQUEST_CREATED',
    idempotencyKey: input.idempotencyKey,
    periodStartsAt: period.startsAt,
    periodEndsAt: period.endsAt,
    sourceRecordId: input.sourceRecordId,
    quantity: 1,
  });
  return { consumed: true, idempotentReplay: false, usedCount: updated.usedCount, limit, period };
}

/** Helper for owner-only configuration operations, not for organization members. */
export async function assertBillingOwner(input: { executor: Executor; principal: VerifiedBillingPrincipal; billingAccountId: string }) {
  const [user] = await input.executor.select().from(users)
    .where(and(eq(users.firebaseUid, input.principal.uid), eq(users.status, 'ACTIVE'))).limit(1);
  const [account] = await input.executor.select().from(billingAccounts).where(eq(billingAccounts.id, input.billingAccountId)).limit(1);
  if (!user || !account || !isBillingOwner(user.id, account.ownerUserId)) {
    throw new EntitlementError('BILLING_OWNER_REQUIRED', 'Only the authenticated billing owner may manage this account.');
  }
  return account;
}

/**
 * Check equipment capacity while holding the billing-account row lock. The
 * caller must insert its equipment row in this same transaction, so concurrent
 * writers cannot observe stale capacity and exceed the account-level limit.
 */
export async function assertEquipmentCapacity(input: {
  tx: BillingRuntimeTransaction;
  principal: VerifiedBillingPrincipal;
  organizationId: string;
  requested?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const context = await resolveMembership(input.tx, input.principal, input.organizationId, true);
  const [lockedAccount] = await input.tx.select().from(billingAccounts)
    .where(eq(billingAccounts.id, context.account.id)).for('update').limit(1);
  if (!lockedAccount) throw new EntitlementError('BILLING_ACCOUNT_UNAVAILABLE', 'The billing account is unavailable.');
  const state = await resolveActiveEntitlement(input.tx, input.principal, input.organizationId, now);
  if (!PLAN_CATALOG[state.planId].capabilities['workspace.equipment']) {
    throw new EntitlementError('FEATURE_UNAVAILABLE', 'Equipment records are not included.');
  }
  let limit = getSnapshotLimit(state.snapshot, 'limits.equipment_records');
  if (state.planId === 'ENTERPRISE') {
    limit = await getEnterpriseLimitOverride(input.tx, state.account.id, 'limits.equipment_records', state.snapshot.catalogVersion, now);
    if (limit === null) throw new EntitlementError('ENTERPRISE_OVERRIDE_REQUIRED', 'A current negotiated equipment limit is required.');
  }
  if (limit === null) throw new EntitlementError('CATALOG_UNAVAILABLE', 'The equipment limit is not configured.');
  const orgRows = await input.tx.select({ organizationId: billingAccountOrganizations.organizationId })
    .from(billingAccountOrganizations).where(eq(billingAccountOrganizations.billingAccountId, state.account.id));
  const organizationIds = orgRows.map((row) => row.organizationId);
  const [equipmentCount] = await input.tx.select({ value: count() }).from(equipment)
    .where(inArray(equipment.organizationId, organizationIds));
  const used = equipmentCount?.value ?? 0;
  const requested = input.requested ?? 1;
  if (!canConsumeQuota({ used, requested, limit })) {
    throw new EntitlementError('QUOTA_EXCEEDED', 'The account has reached its equipment record limit.');
  }
  return { billingAccountId: state.account.id, used, requested, limit };
}

/** Append-only equipment metering event; invoke after equipment insert in the same transaction. */
export async function recordEquipmentCreationUsage(input: {
  tx: BillingRuntimeTransaction;
  principal: VerifiedBillingPrincipal;
  organizationId: string;
  equipmentId: string;
}) {
  const context = await resolveMembership(input.tx, input.principal, input.organizationId, true);
  const [event] = await input.tx.insert(billingUsageEvents).values({
    billingAccountId: context.account.id,
    organizationId: input.organizationId,
    featureId: 'limits.equipment_records',
    eventType: 'EQUIPMENT_CREATED',
    idempotencyKey: `equipment:${input.equipmentId}`,
    sourceRecordId: input.equipmentId,
    quantity: 1,
  }).onConflictDoNothing({ target: [billingUsageEvents.billingAccountId, billingUsageEvents.featureId, billingUsageEvents.idempotencyKey] }).returning();
  return { recorded: Boolean(event) };
}
