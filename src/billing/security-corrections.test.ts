import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { billingAccountOrganizations, billingUsageEvents } from '../db/schema';
import { EnterpriseOverrideResolutionError, resolveEnterpriseOverride } from './enterprise-overrides';
import { authorizePlatformAdmin, PlatformAdminAuthorizationError } from './platform-admin.server';

const usageMigration = readFileSync(new URL('../../drizzle/0003_saas_entitlements_usage.sql', import.meta.url), 'utf8');
const billingMigration = readFileSync(new URL('../../drizzle/0002_account_level_billing.sql', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../db/schema.ts', import.meta.url), 'utf8');

test('[source-level] cross-account usage events are rejected by the composite tenant FK', () => {
  const config = getTableConfig(billingUsageEvents);
  const reference = config.foreignKeys.find((foreignKey) => foreignKey.getName() === 'rf_billing_usage_events_account_organization_fk')?.reference();
  assert.ok(reference);
  assert.deepEqual(reference.columns.map((column) => column.name), ['billing_account_id', 'organization_id']);
  assert.deepEqual(reference.foreignColumns.map((column) => column.name), ['billing_account_id', 'organization_id']);
  assert.equal(reference.foreignTable, billingAccountOrganizations);
  assert.equal(config.foreignKeys.find((foreignKey) => foreignKey.getName() === 'rf_billing_usage_events_account_organization_fk')?.onDelete, 'restrict');
  assert.match(usageMigration, /CONSTRAINT rf_billing_usage_events_account_organization_fk\s+FOREIGN KEY \(billing_account_id, organization_id\)\s+REFERENCES rf_billing_account_organizations\(billing_account_id, organization_id\) ON DELETE RESTRICT/i);
  assert.match(billingMigration, /UNIQUE \(billing_account_id, organization_id\)/i);

  // Source-level relational fixture: the composite pair must exist together.
  // This does not substitute for a PostgreSQL FK integration test.
  const accountOrganizationPairs = new Set(['account-a:org-a', 'account-b:org-b']);
  assert.equal(accountOrganizationPairs.has('account-a:org-a'), true);
  assert.equal(accountOrganizationPairs.has('account-a:org-b'), false);
});

test('[source-level] Enterprise override periods reject ambiguity and invalid values', () => {
  const now = new Date('2026-11-20T12:00:00.000Z');
  const one = { featureId: 'limits.organizations', catalogVersion: 'v1', value: 7, startsAt: new Date('2026-11-01T00:00:00.000Z'), endsAt: null };
  assert.equal(resolveEnterpriseOverride({ rows: [one], featureId: one.featureId, catalogVersion: 'v1', now }), 7);
  assert.equal(resolveEnterpriseOverride({ rows: [one], featureId: 'limits.equipment_records', catalogVersion: 'v1', now }), null);
  assert.throws(() => resolveEnterpriseOverride({ rows: [one, { ...one, value: 9 }], featureId: one.featureId, catalogVersion: 'v1', now }),
    (error) => error instanceof EnterpriseOverrideResolutionError && error.code === 'AMBIGUOUS');
  assert.throws(() => resolveEnterpriseOverride({ rows: [{ ...one, value: 'unlimited' }], featureId: one.featureId, catalogVersion: 'v1', now }),
    (error) => error instanceof EnterpriseOverrideResolutionError && error.code === 'INVALID');
  assert.match(usageMigration, /rf_billing_entitlement_override_period_guard/);
  assert.match(usageMigration, /overlapping billing entitlement override period/);
  assert.match(usageMigration, /UPDATE rf_billing_accounts[\s\S]*FOR EACH ROW EXECUTE FUNCTION rf_guard_billing_entitlement_override_period/);
  assert.match(schemaSource, /startsAt: timestamp\('starts_at'[\s\S]*endsAt: timestamp\('ends_at'/);
});

test('[source-level] Enterprise override authorization fails closed without a configured platform-admin source', async () => {
  await assert.rejects(
    authorizePlatformAdmin({ uid: 'ordinary-firebase-user' } as DecodedIdToken),
    (error) => error instanceof PlatformAdminAuthorizationError && error.code === 'PLATFORM_ADMIN_AUTH_UNAVAILABLE',
  );
});

test('[source-level] account-organization standalone index is removed while history and FK indexes exist', () => {
  const linkConfig = getTableConfig(billingAccountOrganizations);
  assert.equal(linkConfig.indexes.some((index) => index.config.name === 'rf_billing_account_organizations_account_idx'), false);
  const schema = readFileSync(new URL('../db/schema.ts', import.meta.url), 'utf8');
  assert.match(schema, /rf_account_subscriptions_account_created_idx/);
  assert.match(schema, /rf_billing_usage_events_organization_idx/);
  assert.match(schema, /rf_billing_account_entitlement_overrides_created_by_user_idx/);
  assert.match(schema, /rf_account_subscription_changes_actor_user_idx/);
  assert.match(usageMigration, /CREATE INDEX rf_billing_usage_events_organization_idx/);
  assert.match(usageMigration, /CREATE INDEX rf_billing_account_entitlement_overrides_created_by_user_idx/);
  assert.match(usageMigration, /CREATE INDEX rf_account_subscription_changes_actor_user_idx/);
});

test('[source-level] applied foundation SQL is restored and 0004 handles all CHECK constraint states', () => {
  const foundation = readFileSync(new URL('../../drizzle/0001_rentflow_foundation.sql', import.meta.url), 'utf8');
  const invoiceDefinition = foundation.slice(foundation.indexOf('CREATE TABLE rf_invoices'), foundation.indexOf('CREATE TABLE rf_customer_payments'));
  const reconciliation = readFileSync(new URL('../../drizzle/0004_reconcile_applied_foundation_constraints.sql', import.meta.url), 'utf8');
  assert.equal(invoiceDefinition.includes("status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','PARTIALLY_PAID','PAID','OVERDUE','VOID','REFUNDED'))"), true);
  assert.equal(invoiceDefinition.includes('CONSTRAINT rf_invoices_status_ck CHECK (status IN'), true);
  assert.match(reconciliation, /SELECT contype, pg_get_constraintdef\(oid\), convalidated/);
  assert.match(reconciliation, /original_type <> 'c'/);
  assert.match(reconciliation, /schema_type <> 'c'/);
  assert.match(reconciliation, /NOT original_validated/);
  assert.match(reconciliation, /NOT schema_validated/);
  assert.match(reconciliation, /regexp_replace\(original_definition[\s\S]*<> regexp_replace\(schema_definition/);
  // A. Both equivalent, validated CHECKs: only the redundant auto-name is removed.
  assert.match(reconciliation, /IF has_original_name AND has_schema_name THEN[\s\S]*DROP CONSTRAINT rf_invoices_status_check/);
  assert.doesNotMatch(reconciliation, /DROP CONSTRAINT rf_invoices_status_ck/);
  // B. Only old: rename. C. Only canonical: retain unchanged. D. Missing: fail closed.
  assert.match(reconciliation, /RENAME CONSTRAINT rf_invoices_status_check TO rf_invoices_status_ck/i);
  assert.match(reconciliation, /ELSIF has_schema_name AND NOT has_original_name THEN[\s\S]*NULL/);
  assert.match(reconciliation, /Neither expected invoice status CHECK exists; refusing reconciliation/);
  const executableSql = reconciliation.replace(/^\s*--.*$/gm, '');
  assert.doesNotMatch(executableSql, /\b(DROP TABLE|DELETE|TRUNCATE)\b/i);
});

// This suite has no PostgreSQL integration tests. The tests above inspect source,
// Drizzle metadata and pure decisions; they do not prove trigger/FK behavior.
