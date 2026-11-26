import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getTableName } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import {
  accountSubscriptions,
  accountSubscriptionEvents,
  accountSubscriptionChanges,
  billingAccountOrganizations,
  billingAccountEntitlementOverrides,
  billingAccounts,
  billingTrialHistory,
  billingUsageCounters,
  billingUsageEvents,
  billingWebhookEvents,
} from '../db/schema';
import {
  BILLING_PLAN_IDENTIFIERS,
  calculateTrialEnd,
  evaluateOrganizationLimit,
  evaluateTrialEligibility,
  isBillingOwner,
  planCurrentSubscriptionReplacement,
  type PlanEntitlements,
} from './entitlements';
import { normalizePaddleSubscriptionStatus } from './provider';
import { assertVerifiedPaymentMethodForTrial } from './service';

const billingMigration = readFileSync(new URL('../../drizzle/0002_account_level_billing.sql', import.meta.url), 'utf8');
const billingUsageMigration = readFileSync(new URL('../../drizzle/0003_saas_entitlements_usage.sql', import.meta.url), 'utf8');
const billingServiceSource = readFileSync(new URL('./service.ts', import.meta.url), 'utf8');

function hasUniqueConstraint(table: Parameters<typeof getTableConfig>[0], expectedColumns: string[]) {
  const config = getTableConfig(table);
  return config.uniqueConstraints.some((constraint) =>
    constraint.columns.map((column) => column.name).join(',') === expectedColumns.join(','),
  ) || (expectedColumns.length === 1 && config.columns.some((column) =>
    column.isUnique && column.name === expectedColumns[0],
  ));
}

function hasUniqueIndex(table: Parameters<typeof getTableConfig>[0], name: string) {
  return getTableConfig(table).indexes.some((index) => index.config.name === name && index.config.unique);
}

test('database schema enforces one billing account per owner', () => {
  assert.equal(hasUniqueConstraint(billingAccounts, ['owner_user_id']), true);
  const ownerFk = getTableConfig(billingAccounts).foreignKeys.find((foreignKey) => foreignKey.getName() === 'rf_billing_accounts_owner_user_id_rf_users_id_fk');
  assert.ok(ownerFk);
  assert.equal(getTableName(ownerFk.reference().foreignColumns[0]!.table), 'rf_users');
  assert.equal(ownerFk.onDelete, 'restrict');
});

test('one billing account can retain multiple subscription lifecycle rows', () => {
  const config = getTableConfig(accountSubscriptions);
  assert.equal(hasUniqueConstraint(accountSubscriptions, ['billing_account_id']), false);
  assert.equal(hasUniqueIndex(accountSubscriptions, 'rf_account_subscriptions_provider_customer_uq'), false);
  assert.equal(hasUniqueIndex(accountSubscriptions, 'rf_account_subscriptions_provider_subscription_uq'), true);
  assert.ok(config.columns.some((column) => column.name === 'provider_subscription_id'));
  assert.ok(config.columns.some((column) => column.name === 'current_period_starts_at'));
  assert.ok(config.columns.some((column) => column.name === 'cancelled_at'));
});

test('one current subscription per account is enforced by a partial unique index', () => {
  const config = getTableConfig(accountSubscriptions);
  const index = config.indexes.find((candidate) => candidate.config.name === 'rf_account_subscriptions_one_current_per_account_uq');
  assert.ok(index);
  assert.equal(index.config.unique, true);
  const indexedColumn = index.config.columns[0];
  assert.ok(indexedColumn && 'name' in indexedColumn);
  assert.equal(indexedColumn.name, 'billing_account_id');
  assert.ok(index.config.where);
  assert.match(new PgDialect().sqlToQuery(index.config.where).sql, /is_current"?\s*=\s*true/i);

  const sqlIndex = billingMigration.match(/CREATE UNIQUE INDEX rf_account_subscriptions_one_current_per_account_uq\s+ON rf_account_subscriptions\s*\(([^)]+)\)\s+WHERE\s+([^;]+);/i);
  assert.ok(sqlIndex);
  assert.equal(sqlIndex[1].trim(), 'billing_account_id');
  assert.match(sqlIndex[2], /is_current\s*=\s*true/i);
  assert.ok(config.columns.find((column) => column.name === 'is_current')?.hasDefault);
  assert.match(billingServiceSource, /lockOwnedBillingAccount\(tx, verifiedToken, accountId\)/);
  const lifecycleHelper = billingServiceSource.slice(billingServiceSource.indexOf('export async function createCurrentAccountSubscription'));
  assert.ok(lifecycleHelper.indexOf('lockOwnedBillingAccount(tx, verifiedToken, accountId)') < lifecycleHelper.indexOf('.insert(accountSubscriptions)'));
});

test('a cancelled subscription remains historical when a replacement is planned', () => {
  const cancelled = { id: 'cancelled-lifecycle', status: 'CANCELLED', isCurrent: true };
  const replacement = planCurrentSubscriptionReplacement(cancelled);
  assert.deepEqual(replacement, { allowed: true, previousSubscriptionId: 'cancelled-lifecycle' });
  assert.deepEqual(planCurrentSubscriptionReplacement({ id: 'active-lifecycle', status: 'ACTIVE', isCurrent: true }), { allowed: false });
  assert.deepEqual(planCurrentSubscriptionReplacement(null), { allowed: true, previousSubscriptionId: null });
  const history = [
    { ...cancelled, isCurrent: false, providerSubscriptionId: 'provider-old', currentPeriodStartsAt: new Date('2026-01-01T00:00:00.000Z') },
    { id: 'replacement-lifecycle', status: 'PENDING', isCurrent: true, providerSubscriptionId: null, currentPeriodStartsAt: null },
  ];
  assert.equal(history.length, 2);
  assert.equal(history[0].providerSubscriptionId, 'provider-old');
  assert.equal(history.filter((subscription) => subscription.isCurrent).length, 1);
});

test('subscription lifecycle snapshots retain prior state and provider events append-only', () => {
  const config = getTableConfig(accountSubscriptionEvents);
  const columns = config.columns.map((column) => column.name);
  for (const column of ['provider_event_id', 'previous_status', 'status', 'previous_period_starts_at', 'previous_period_ends_at', 'period_starts_at', 'period_ends_at']) {
    assert.ok(columns.includes(column), `missing lifecycle snapshot column ${column}`);
  }
  const providerEventIndex = config.indexes.find((index) => index.config.name === 'rf_account_subscription_events_provider_event_uq');
  assert.ok(providerEventIndex?.config.unique);
  assert.ok(providerEventIndex?.config.where);
  assert.match(billingMigration, /CREATE TRIGGER rf_account_subscription_events_append_only\s+BEFORE UPDATE OR DELETE ON rf_account_subscription_events/i);
  assert.match(billingMigration, /CREATE FUNCTION rf_reject_account_subscription_event_mutation/);
  assert.match(billingServiceSource, /tx\.insert\(accountSubscriptionEvents\)\.values\(input\)/);
  assert.doesNotMatch(billingServiceSource.slice(billingServiceSource.indexOf('export async function recordAccountSubscriptionLifecycleEvent'), billingServiceSource.indexOf('export async function createCurrentAccountSubscription')), /update\(accountSubscriptionEvents\)|delete\(accountSubscriptionEvents\)/);
  const trialStart = billingServiceSource.slice(billingServiceSource.indexOf('export async function startAccountTrial'), billingServiceSource.indexOf('async function lockOwnedBillingAccount'));
  const subscriptionCreate = billingServiceSource.slice(billingServiceSource.indexOf('export async function createCurrentAccountSubscription'), billingServiceSource.indexOf('async function evaluateOrganizationCapacity'));
  assert.match(trialStart, /recordAccountSubscriptionLifecycleEvent\(tx,[\s\S]*?eventType: 'TRIAL_STARTED'/);
  assert.match(subscriptionCreate, /recordAccountSubscriptionLifecycleEvent\(tx,[\s\S]*?eventType: 'SUBSCRIPTION_CREATED'/);
});

test('Paddle lifecycle states normalize consistently into the account subscription vocabulary', () => {
  assert.deepEqual(
    (['active', 'trialing', 'past_due', 'paused', 'canceled'] as const).map(normalizePaddleSubscriptionStatus),
    ['ACTIVE', 'TRIALING', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'],
  );
  const subscriptionStatusCheck = getTableConfig(accountSubscriptions).checks.find((item) => item.name === 'rf_account_subscriptions_status_ck');
  assert.ok(subscriptionStatusCheck);
  assert.match(new PgDialect().sqlToQuery(subscriptionStatusCheck.value).sql, /'SUSPENDED'/);
  assert.match(billingMigration, /rf_account_subscriptions_status_ck CHECK \(status IN \([^)]*'SUSPENDED'/i);
});

test('a 14-day trial requires payment-method verification from a trusted earlier timestamp', () => {
  const startsAt = new Date('2026-11-01T12:00:00.000Z');
  const verifiedAt = new Date('2026-11-01T11:59:00.000Z');
  assert.equal(assertVerifiedPaymentMethodForTrial(verifiedAt, startsAt), verifiedAt);
  assert.throws(() => assertVerifiedPaymentMethodForTrial(null, startsAt), /verified payment method is required/i);
  assert.throws(() => assertVerifiedPaymentMethodForTrial(new Date('2026-11-01T12:01:00.000Z'), startsAt), /verified payment method is required/i);
  const check = getTableConfig(accountSubscriptions).checks.find((item) => item.name === 'rf_account_subscriptions_trial_payment_method_ck');
  assert.ok(check);
  assert.match(new PgDialect().sqlToQuery(check.value).sql, /TRIALING.*payment_method_verified_at.*IS NOT NULL/i);
  assert.match(billingUsageMigration, /rf_account_subscriptions_trial_payment_method_ck[\s\S]*status <> 'TRIALING' OR payment_method_verified_at IS NOT NULL/i);
});

test('Starter catalog matches the agreed monthly and yearly price points', async () => {
  const { PLAN_CATALOG } = await import('./plan-catalog');
  assert.equal(PLAN_CATALOG.STARTER.prices.monthlyCents, 2500);
  assert.equal(PLAN_CATALOG.STARTER.prices.yearlyCents, 25000);
});

test('one account may link multiple organizations, but an organization has one account', () => {
  const config = getTableConfig(billingAccountOrganizations);
  assert.equal(hasUniqueConstraint(billingAccountOrganizations, ['organization_id']), true);
  assert.equal(hasUniqueConstraint(billingAccountOrganizations, ['billing_account_id', 'organization_id']), true);
  assert.equal(config.uniqueConstraints.some((constraint) => constraint.columns.map((column) => column.name).join(',') === 'billing_account_id'), false);
  assert.equal(config.indexes.some((index) => index.config.name === 'rf_billing_account_organizations_account_idx'), false);
});

test('trial history permits rejection history but only one started trial per account', () => {
  assert.equal(hasUniqueIndex(billingTrialHistory, 'rf_billing_trial_history_single_consumed_trial_uq'), true);
  const checkNames = getTableConfig(billingTrialHistory).checks.map((check) => check.name);
  assert.ok(checkNames.includes('rf_billing_trial_history_trial_dates_ck'));
  assert.ok(checkNames.includes('rf_billing_trial_history_rejection_reason_ck'));
});

test('trial eligibility rejects old accounts and any account that already used a trial', () => {
  const rolloutDate = new Date('2026-01-01T00:00:00.000Z');
  const policy = { enabled: true, version: 'rollout-1', newAccountsCreatedAtOrAfter: rolloutDate };
  const base = {
    policy,
    firebaseAccountCreatedAt: new Date('2026-02-01T00:00:00.000Z'),
    rentflowUserCreatedAt: new Date('2026-02-01T00:00:00.000Z'),
    trialConsumedAt: null,
    trialHistory: [],
    hasLegacySubscription: false,
  };

  assert.deepEqual(evaluateTrialEligibility(base), {
    eligible: true,
    reasonCode: 'ELIGIBLE',
    policyVersion: 'rollout-1',
  });
  assert.equal(evaluateTrialEligibility({ ...base, firebaseAccountCreatedAt: new Date('2025-12-31T23:59:59.999Z') }).reasonCode, 'ACCOUNT_PREDATES_ROLLOUT');
  assert.equal(evaluateTrialEligibility({ ...base, rentflowUserCreatedAt: new Date('2025-12-31T23:59:59.999Z') }).reasonCode, 'ACCOUNT_PREDATES_ROLLOUT');
  assert.equal(evaluateTrialEligibility({ ...base, trialHistory: [{ trialStartedAt: new Date('2026-02-01T00:00:00.000Z') }] }).reasonCode, 'TRIAL_ALREADY_USED');
  assert.equal(evaluateTrialEligibility({ ...base, trialConsumedAt: new Date('2026-02-01T00:00:00.000Z') }).reasonCode, 'TRIAL_ALREADY_USED');
  assert.equal(evaluateTrialEligibility({ ...base, hasLegacySubscription: true }).reasonCode, 'LEGACY_SUBSCRIPTION_EXISTS');
  assert.equal(evaluateTrialEligibility({ ...base, policy: { ...policy, enabled: false } }).reasonCode, 'ROLLOUT_DISABLED');
});

test('[source-level] legacy subscription rejection checks all retained memberships, not only ORG_OWNER', () => {
  for (const functionName of ['evaluateAndRecordTrialEligibility', 'startAccountTrial']) {
    const functionStart = billingServiceSource.indexOf(`export async function ${functionName}`);
    const nextFunction = billingServiceSource.indexOf('\nexport async function ', functionStart + 1);
    const body = billingServiceSource.slice(functionStart, nextFunction < 0 ? undefined : nextFunction);
    assert.match(body, /innerJoin\(subscriptions, eq\(subscriptions\.organizationId, memberships\.organizationId\)\)\s*\.where\(eq\(memberships\.userId, (?:user|owned\.user)\.id\)\)/);
    assert.doesNotMatch(body, /eq\(memberships\.role, 'ORG_OWNER'\)/);
    assert.match(body, /rentflowUserCreatedAt: (?:user|owned\.user)\.createdAt/);
  }
});

test('trial duration is exactly 14 days (336 hours)', () => {
  const startedAt = new Date('2026-03-07T12:00:00.000Z');
  assert.equal(calculateTrialEnd(startedAt).getTime() - startedAt.getTime(), 336 * 60 * 60 * 1000);
});

test('trial subscription is limited to one organization', () => {
  const decision = evaluateOrganizationLimit({
    subscription: { planIdentifier: 'STARTER', status: 'TRIALING', isCurrent: true, trialEndsAt: new Date('2026-02-15T00:00:00.000Z') },
    currentOrganizationCount: 0,
    entitlements: {},
    now: new Date('2026-02-01T00:00:00.000Z'),
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.organizationLimit, 1);
  assert.equal(evaluateOrganizationLimit({
    subscription: { planIdentifier: 'STARTER', status: 'TRIALING', isCurrent: true, trialEndsAt: new Date('2026-02-15T00:00:00.000Z') },
    currentOrganizationCount: 1,
    entitlements: {},
    now: new Date('2026-02-01T00:00:00.000Z'),
  }).reason, 'TRIAL_ORGANIZATION_LIMIT');
});

test('paid plan limits are evaluated only from injected entitlements', () => {
  assert.deepEqual(BILLING_PLAN_IDENTIFIERS, ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']);
  const entitlements: PlanEntitlements = { PRO: { organizationLimit: 3 } };
  const subscription = { planIdentifier: 'PRO', status: 'ACTIVE', isCurrent: true, trialEndsAt: null };
  assert.equal(evaluateOrganizationLimit({ subscription, currentOrganizationCount: 2, entitlements }).allowed, true);
  assert.equal(evaluateOrganizationLimit({ subscription, currentOrganizationCount: 3, entitlements }).reason, 'PLAN_ORGANIZATION_LIMIT');
  assert.equal(evaluateOrganizationLimit({ subscription, currentOrganizationCount: 0, entitlements: {} }).reason, 'PLAN_ENTITLEMENTS_UNCONFIGURED');
  assert.equal(evaluateOrganizationLimit({ subscription: { ...subscription, isCurrent: false }, currentOrganizationCount: 0, entitlements }).reason, 'NO_ACTIVE_SUBSCRIPTION');
  assert.equal(evaluateOrganizationLimit({ ...{ subscription: { ...subscription, status: 'PENDING' }, currentOrganizationCount: 0, entitlements } }).reason, 'NO_ACTIVE_SUBSCRIPTION');
});

test('billing details require exact authenticated billing-owner identity', () => {
  assert.equal(isBillingOwner('user-owner', 'user-owner'), true);
  assert.equal(isBillingOwner('organization-member', 'user-owner'), false);
});

test('webhook event storage rejects duplicate provider event IDs', () => {
  assert.equal(hasUniqueConstraint(billingWebhookEvents, ['payment_provider', 'provider_event_id']), true);
});

test('Drizzle and migration define exactly the same named billing CHECK constraints', () => {
  const billingTables = [billingAccounts, billingAccountOrganizations, accountSubscriptions, accountSubscriptionEvents, billingTrialHistory, billingWebhookEvents,
    billingUsageCounters, billingUsageEvents, billingAccountEntitlementOverrides, accountSubscriptionChanges];
  const drizzleNames = billingTables.flatMap((table) => getTableConfig(table).checks.map((check) => check.name)).sort();
  const sqlNames = [...`${billingMigration}\n${billingUsageMigration}`.matchAll(/\bCONSTRAINT\s+([a-z0-9_]+)\s+CHECK\s*\(/gi)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(sqlNames, drizzleNames);
});

test('Drizzle and SQL migrations use matching names for every billing FK, unique/check constraint, and index', () => {
  const billingTables = [billingAccounts, billingAccountOrganizations, accountSubscriptions, accountSubscriptionEvents, billingTrialHistory, billingWebhookEvents,
    billingUsageCounters, billingUsageEvents, billingAccountEntitlementOverrides, accountSubscriptionChanges];
  const drizzleNames = billingTables.flatMap((table) => {
    const config = getTableConfig(table);
    return [
      ...config.foreignKeys.map((foreignKey) => foreignKey.getName()),
      ...config.uniqueConstraints.map((constraint) => constraint.name),
      ...config.columns.filter((column) => column.isUnique).map((column) => column.uniqueName),
      ...config.checks.map((constraint) => constraint.name),
      ...config.indexes.map((index) => index.config.name),
    ];
  }).sort();
  const sqlNames = [...`${billingMigration}\n${billingUsageMigration}`.matchAll(/\bCONSTRAINT\s+([a-z0-9_]+)|\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+([a-z0-9_]+)/gi)]
    .map((match) => match[1] ?? match[2])
    .sort();
  assert.deepEqual(sqlNames, drizzleNames);
});
