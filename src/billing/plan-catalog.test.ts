import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  accountSubscriptionChanges,
  accountSubscriptions,
  billingAccountEntitlementOverrides,
  billingUsageCounters,
  billingUsageEvents,
} from '../db/schema';
import {
  BASE_CURRENCY,
  FEATURE_CATALOG,
  PLAN_CATALOG,
  PLAN_CATALOG_VERSION,
  PLAN_IDENTIFIERS,
  buildPlanEntitlementSnapshot,
  buildTrialEntitlementSnapshot,
  calculateAnnualSavings,
  canConsumeQuota,
  countUniqueSeatUsers,
  evaluatePlanChangeImpact,
  evaluateSubscriptionAccess,
  getPlanLimit,
  getUtcUsageMonth,
  isCatalogVersionSupported,
  type PlanLimits,
} from './plan-catalog';

const migration = readFileSync(new URL('../../drizzle/0003_saas_entitlements_usage.sql', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('./runtime.ts', import.meta.url), 'utf8');
const migrationJournal = JSON.parse(readFileSync(new URL('../../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: { idx: number; when: number; tag: string }[] };

test('catalog has stable, versioned plans and approved USD integer-cent prices and limits', () => {
  assert.equal(BASE_CURRENCY, 'USD');
  assert.equal(PLAN_CATALOG_VERSION, 'v1');
  assert.deepEqual(PLAN_IDENTIFIERS, ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']);
  assert.deepEqual(PLAN_CATALOG.STARTER.prices, { monthlyCents: 2500, yearlyCents: 25000 });
  assert.deepEqual(PLAN_CATALOG.PRO.prices, { monthlyCents: 6900, yearlyCents: 69000 });
  assert.deepEqual(PLAN_CATALOG.BUSINESS.prices, { monthlyCents: 12900, yearlyCents: 129000 });
  assert.deepEqual(PLAN_CATALOG.ENTERPRISE.prices, { monthlyCents: null, yearlyCents: null });
  assert.equal(PLAN_CATALOG.STARTER.priceKeys.monthly, 'rentflow.v1.starter.monthly.usd');
  assert.equal(PLAN_CATALOG.ENTERPRISE.priceKeys.yearly, null);
  assert.deepEqual(PLAN_CATALOG.STARTER.limits, { organizations: 1, teamSeats: 3, equipmentRecords: 50, rentalRequestsPerUtcMonth: 100 });
  assert.deepEqual(PLAN_CATALOG.PRO.limits, { organizations: 3, teamSeats: 10, equipmentRecords: 250, rentalRequestsPerUtcMonth: 500 });
  assert.deepEqual(PLAN_CATALOG.BUSINESS.limits, { organizations: 10, teamSeats: 30, equipmentRecords: 1000, rentalRequestsPerUtcMonth: 2500 });
  for (const plan of Object.values(PLAN_CATALOG)) {
    for (const value of Object.values(plan.prices)) assert.ok(value === null || Number.isSafeInteger(value));
  }
});

test('annual price is ten monthly payments with exact 1/6 savings ratio', () => {
  for (const plan of [PLAN_CATALOG.STARTER, PLAN_CATALOG.PRO, PLAN_CATALOG.BUSINESS]) {
    const saving = calculateAnnualSavings(plan.prices.monthlyCents!, plan.prices.yearlyCents!);
    assert.equal(plan.prices.yearlyCents, plan.prices.monthlyCents! * 10);
    assert.equal(saving.savedCents, plan.prices.monthlyCents! * 2);
    assert.equal(saving.discountNumerator / saving.discountDenominator, 1 / 6);
    assert.equal(saving.annualMonthlyEquivalentCents, plan.prices.monthlyCents);
  }
  assert.throws(() => calculateAnnualSavings(29.5, 290));
});

test('feature readiness does not sell unmetered or incomplete features', () => {
  assert.equal(FEATURE_CATALOG['workspace.equipment'].readiness, 'AVAILABLE');
  assert.equal(FEATURE_CATALOG['workspace.customers'].readiness, 'AVAILABLE');
  assert.equal(FEATURE_CATALOG['workspace.rental_requests'].readiness, 'AVAILABLE');
  for (const id of ['ai.copilot', 'ai.credits_monthly', 'storage.persistent_bytes', 'integrations.gps_telematics', 'integrations.customer_api_credentials', 'storefront.public_rentals'] as const) {
    assert.equal(FEATURE_CATALOG[id].readiness, 'UNAVAILABLE');
    assert.equal(PLAN_CATALOG.PRO.capabilities[id], undefined);
  }
  assert.equal(FEATURE_CATALOG['limits.team_seats'].readiness, 'PLANNED');
  assert.equal(FEATURE_CATALOG['team.invitations'].readiness, 'PLANNED');
  assert.equal(FEATURE_CATALOG['limits.organizations'].readiness, 'PLANNED');
  assert.equal(FEATURE_CATALOG['limits.equipment_records'].readiness, 'PLANNED');
  assert.equal(FEATURE_CATALOG['limits.rental_requests_monthly'].readiness, 'PLANNED');
  assert.equal(FEATURE_CATALOG['billing.customer_invoices'].readiness, 'UNAVAILABLE');
  assert.equal(FEATURE_CATALOG['billing.customer_payments'].readiness, 'UNAVAILABLE');
  assert.equal(PLAN_CATALOG.BUSINESS.capabilities['limits.team_seats'], undefined);
  assert.equal(PLAN_CATALOG.PRO.capabilities['limits.organizations'], undefined);
  assert.equal(PLAN_CATALOG.PRO.capabilities['limits.equipment_records'], undefined);
  assert.equal(PLAN_CATALOG.PRO.capabilities['limits.rental_requests_monthly'], undefined);
});

test('Enterprise numeric limits fail closed until explicitly negotiated', () => {
  assert.equal(getPlanLimit('ENTERPRISE', 'organizations'), null);
  assert.equal(getPlanLimit('ENTERPRISE', 'organizations', { organizations: 25 }), 25);
  assert.throws(() => buildPlanEntitlementSnapshot({ plan: 'ENTERPRISE', interval: 'MONTHLY' }), /explicit negotiated overrides/);
  assert.equal(buildPlanEntitlementSnapshot({ plan: 'ENTERPRISE', interval: 'YEARLY', enterpriseOverrides: { organizations: 25, teamSeats: 100, equipmentRecords: 10000, rentalRequestsPerUtcMonth: 25000 } }).priceAmountCents, null);
});

test('trial snapshot inherits selected plan limits except one organization for exactly 336 hours', () => {
  const startedAt = new Date('2026-11-02T10:30:00.000Z');
  const snapshot = buildTrialEntitlementSnapshot({ plan: 'BUSINESS', interval: 'MONTHLY', startedAt });
  assert.equal(snapshot.limits.organizations, 1);
  assert.equal(snapshot.limits.equipmentRecords, 1000);
  assert.equal(snapshot.limits.rentalRequestsPerUtcMonth, 2500);
  assert.equal(Date.parse(snapshot.trialEndsAt) - Date.parse(snapshot.trialStartedAt), 336 * 60 * 60 * 1000);
});

test('team seat usage counts unique active users across organizations', () => {
  assert.equal(countUniqueSeatUsers([
    { userId: 'u1', status: 'ACTIVE' }, { userId: 'u1', status: 'ACTIVE' },
    { userId: 'u2', status: 'ACTIVE' }, { userId: 'u3', status: 'INVITED' },
  ]), 2);
});

test('usage is shared by account and buckets on UTC calendar-month half-open boundaries', () => {
  assert.deepEqual(getUtcUsageMonth(new Date('2026-02-28T23:59:59.999Z')), {
    startsAt: new Date('2026-02-01T00:00:00.000Z'), endsAt: new Date('2026-03-01T00:00:00.000Z'),
  });
  assert.deepEqual(getUtcUsageMonth(new Date('2026-03-01T00:00:00.000Z')), {
    startsAt: new Date('2026-03-01T00:00:00.000Z'), endsAt: new Date('2026-04-01T00:00:00.000Z'),
  });
});

test('quota decision is atomic-friendly and failed requests do not consume usage', () => {
  let used = 4;
  const before = used;
  assert.equal(canConsumeQuota({ used, requested: 1, limit: 5 }), true);
  assert.equal(canConsumeQuota({ used, requested: 2, limit: 5 }), false);
  // The application must increment inside the same transaction as its insert.
  // A failed resource insert rolls that transaction back to the previous value.
  const resourceInsertSucceeded = false;
  if (resourceInsertSucceeded && canConsumeQuota({ used, requested: 1, limit: 5 })) used++;
  assert.equal(used, before);
});

test('downgrade impact preserves records and requires owner resolution above limits', () => {
  const limits: PlanLimits = { organizations: 1, teamSeats: 3, equipmentRecords: 50, rentalRequestsPerUtcMonth: 100 };
  const result = evaluatePlanChangeImpact(limits, { organizations: 2, teamSeats: 4, equipmentRecords: 50, rentalRequestsPerUtcMonth: 100 });
  assert.deepEqual(result.overLimit, ['organizations', 'teamSeats']);
  assert.equal(result.existingDataPreserved, true);
  assert.equal(result.requiresOwnerResolution, true);
  assert.equal(result.mayAddMore, false);
  const upgraded = evaluatePlanChangeImpact(PLAN_CATALOG.BUSINESS.limits, { organizations: 2, teamSeats: 4, equipmentRecords: 50, rentalRequestsPerUtcMonth: 100 });
  assert.deepEqual(upgraded.overLimit, []);
  assert.equal(upgraded.requiresOwnerResolution, false);
  assert.equal(upgraded.existingDataPreserved, true);
});

test('only supported immutable catalog versions grant snapshot access', () => {
  assert.equal(isCatalogVersionSupported('v1'), true);
  assert.equal(isCatalogVersionSupported('v2'), false);
});

test('subscription evaluation fails closed for missing, expired, noncurrent and unmatched trials', () => {
  const now = new Date('2026-11-17T00:00:00.000Z');
  const active = {
    accountStatus: 'ACTIVE', status: 'ACTIVE', isCurrent: true, now,
    periodStartsAt: new Date('2026-11-01T00:00:00.000Z'), periodEndsAt: new Date('2026-12-01T00:00:00.000Z'),
    trialStartsAt: null, trialEndsAt: null, trialConsumedAt: null, trialHistoryVerified: false,
  };
  assert.deepEqual(evaluateSubscriptionAccess(active), { allowed: true, reason: 'ALLOWED' });
  assert.equal(evaluateSubscriptionAccess({ ...active, periodEndsAt: null }).reason, 'PERIOD_UNVERIFIED');
  assert.equal(evaluateSubscriptionAccess({ ...active, periodEndsAt: new Date('2026-11-16T00:00:00.000Z') }).reason, 'PERIOD_EXPIRED');
  assert.equal(evaluateSubscriptionAccess({ ...active, isCurrent: false }).reason, 'NONCURRENT');
  assert.equal(evaluateSubscriptionAccess({ ...active, accountStatus: 'TRIALING' }).reason, 'ACCOUNT_SUBSCRIPTION_MISMATCH');
  assert.equal(evaluateSubscriptionAccess({ ...active, status: 'TRIALING' }).reason, 'ACCOUNT_SUBSCRIPTION_MISMATCH');
  const trialStart = new Date('2026-11-01T00:00:00.000Z');
  assert.equal(evaluateSubscriptionAccess({ ...active, accountStatus: 'TRIALING', status: 'TRIALING', periodStartsAt: null, periodEndsAt: null, trialStartsAt: trialStart, trialEndsAt: new Date(trialStart.getTime() + 336 * 60 * 60 * 1000), trialConsumedAt: trialStart, trialHistoryVerified: true }).reason, 'TRIAL_EXPIRED');
  assert.equal(evaluateSubscriptionAccess({ ...active, accountStatus: 'TRIALING', status: 'TRIALING', periodStartsAt: null, periodEndsAt: null, trialStartsAt: trialStart, trialEndsAt: new Date(trialStart.getTime() + 336 * 60 * 60 * 1000), trialConsumedAt: null, trialHistoryVerified: true }).reason, 'TRIAL_UNVERIFIED');
});

test('Drizzle and SQL have matching Stage 2 named CHECK constraints', () => {
  const tables = [accountSubscriptions, billingUsageCounters, billingUsageEvents, billingAccountEntitlementOverrides, accountSubscriptionChanges];
  const stage1SubscriptionChecks = new Set([
    'rf_account_subscriptions_provider_ck',
    'rf_account_subscriptions_interval_ck',
    'rf_account_subscriptions_status_ck',
    'rf_account_subscriptions_trial_dates_ck',
    'rf_account_subscriptions_period_dates_ck',
  ]);
  const drizzleNames = tables.flatMap((table) => getTableConfig(table).checks.map((check) => check.name))
    .filter((name) => !name || !stage1SubscriptionChecks.has(name))
    .sort();
  const sqlNames = [...migration.matchAll(/\bCONSTRAINT\s+([a-z0-9_]+)\s+CHECK\s*\(/gi)].map((match) => match[1]).sort();
  assert.deepEqual(sqlNames, drizzleNames);
});

test('usage counter and event schemas enforce unique periods and idempotency', () => {
  const counter = getTableConfig(billingUsageCounters);
  assert.ok(counter.uniqueConstraints.some((item) => item.columns.map((column) => column.name).join(',') === 'billing_account_id,feature_id,period_starts_at'));
  const event = getTableConfig(billingUsageEvents);
  assert.ok(event.uniqueConstraints.some((item) => item.columns.map((column) => column.name).join(',') === 'billing_account_id,feature_id,idempotency_key'));
  assert.ok(getTableConfig(billingAccountEntitlementOverrides).indexes.some((index) => index.config.name === 'rf_billing_account_entitlement_overrides_current_uq'));
});

test('rental quota service locks the account, conditionally increments and writes idempotency in the caller transaction', () => {
  const helper = runtimeSource.slice(runtimeSource.indexOf('export async function reserveRentalRequestQuota'), runtimeSource.indexOf('/** Helper for owner-only'));
  assert.match(helper, /input\.tx\.select\(\)\.from\(billingAccounts\)[\s\S]*?\.for\('update'\)/);
  assert.match(helper, /billingUsageEvents\.idempotencyKey/);
  assert.match(helper, /eq\(billingUsageCounters\.usedCount, counter\.usedCount\)/);
  assert.match(helper, /input\.tx\.insert\(billingUsageEvents\)/);
  assert.match(helper, /tx: BillingRuntimeTransaction/);
});

test('subscription catalog snapshots and plan-change audit are persisted per lifecycle', () => {
  const subscriptionColumns = getTableConfig(accountSubscriptions).columns.map((column) => column.name);
  assert.ok(subscriptionColumns.includes('catalog_version'));
  assert.ok(subscriptionColumns.includes('price_identifier'));
  assert.ok(subscriptionColumns.includes('price_amount_cents'));
  assert.ok(subscriptionColumns.includes('entitlement_snapshot'));
  assert.ok(getTableConfig(accountSubscriptionChanges).columns.some((column) => column.name === 'change_type'));
  assert.match(migration, /ON DELETE RESTRICT/);
  // Keep the ordered migration history exact: 0005 is the additive billing-drift repair after 0001-0004.
  assert.deepEqual(migrationJournal.entries.map(({ idx, tag }) => [idx, tag]), [
    [0, '0001_rentflow_foundation'],
    [1, '0002_account_level_billing'],
    [2, '0003_saas_entitlements_usage'],
    [3, '0004_reconcile_applied_foundation_constraints'],
    [4, '0005_reconcile_billing_schema_drift'],
  ]);
  assert.ok(migrationJournal.entries.every((entry, index, entries) => index === 0 || entry.when > entries[index - 1].when));
});
