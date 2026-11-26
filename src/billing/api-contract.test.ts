import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PLAN_CATALOG } from './plan-catalog';
import { loadBillingAccount, loadBillingPlans } from './api-client';

const serverSource = readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('./service.ts', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('./BillingSettings.tsx', import.meta.url), 'utf8');

test('billing API client uses authenticated read contracts for plans and account summary', async () => {
  const calls: string[] = [];
  const fakeFetch = async (path: string) => {
    calls.push(path);
    if (path.endsWith('/plans')) return new Response(JSON.stringify({ catalogVersion: 'v1', currency: 'USD', trialDays: 14, trialRequiresVerifiedPaymentMethod: true, plans: [] }), { status: 200 });
    return new Response(JSON.stringify({ account: null, currentSubscription: null, subscriptionHistory: [], organizations: { linkedCount: 0, limit: null }, checkoutAvailable: false }), { status: 200 });
  };
  const plans = await loadBillingPlans(fakeFetch);
  const account = await loadBillingAccount(fakeFetch);
  assert.equal(plans.trialRequiresVerifiedPaymentMethod, true);
  assert.equal(account.checkoutAvailable, false);
  assert.deepEqual(calls, ['/api/billing/plans', '/api/billing/account']);
});

test('server billing summary endpoints preserve Firebase verified-email gates and expose no provider secrets', () => {
  assert.match(serverSource, /app\.get\('\/api\/billing\/plans'/);
  assert.match(serverSource, /app\.get\('\/api\/billing\/account',\s*requireAuth,\s*requireVerifiedEmail,\s*requireActiveUser/);
  assert.match(serverSource, /app\.post\('\/api\/billing\/account',\s*requireAuth,\s*requireVerifiedEmail,\s*requireActiveUser/);
  const overviewRoute = serverSource.slice(serverSource.indexOf("app.get('/api/billing/account'"), serverSource.indexOf("app.post('/api/billing/account'"));
  assert.doesNotMatch(overviewRoute, /providerCustomerId|providerSubscriptionId|SUPABASE|DATABASE_URL/);
  assert.match(overviewRoute, /checkoutAvailable: false/);
  assert.doesNotMatch(serverSource, /app\.post\('\/api\/billing\/(?:checkout|trial)/);
});

test('trial creation requires trusted verification and does not activate through a public request contract', () => {
  assert.match(serviceSource, /assertVerifiedPaymentMethodForTrial\(input\.paymentMethodVerifiedAt, startedAt\)/);
  assert.match(serviceSource, /status: 'TRIALING',[\s\S]*paymentMethodVerifiedAt/);
  assert.equal(PLAN_CATALOG.STARTER.prices.monthlyCents, 2500);
  assert.equal(PLAN_CATALOG.STARTER.prices.yearlyCents, 25000);
  assert.match(settingsSource, /Secure checkout is not available yet/);
  assert.doesNotMatch(settingsSource, /startAccountTrial|createCheckout|payment succeeded/i);
});

test('organization link enforcement stays owner-scoped, serialized, and driven by the account plan limit', () => {
  const helper = serviceSource.slice(serviceSource.indexOf('export async function linkOrganizationWithinLimit'), serviceSource.indexOf('export async function linkOwnedOrganizationWithinCatalogLimit'));
  assert.match(helper, /lockOwnedBillingAccount\(tx, verifiedToken, accountId\)/);
  assert.match(helper, /eq\(memberships\.role, 'ORG_OWNER'\)/);
  assert.match(helper, /evaluateOrganizationCapacity\(tx, account\.id, entitlements, now\)/);
  assert.match(helper, /ORGANIZATION_LIMIT_REACHED/);
  assert.match(serviceSource, /export async function linkOwnedOrganizationWithinCatalogLimit/);
  assert.match(serviceSource, /const entitlements: PlanEntitlements = \{ \[planIdentifier\]: \{ organizationLimit \} \}/);
  const organizationCreateRoute = serverSource.slice(serverSource.indexOf("app.post('/api/organizations',"), serverSource.indexOf('const aiGate'));
  assert.match(organizationCreateRoute, /requireAuth,\s*requireVerifiedEmail/);
  assert.match(organizationCreateRoute, /linkOwnedOrganizationWithinCatalogLimit\(tx, token, created\.id\)/);
  assert.match(organizationCreateRoute, /ORGANIZATION_LIMIT_REACHED/);
  assert.match(organizationCreateRoute, /BILLING_SUBSCRIPTION_REQUIRED/);
  assert.match(readFileSync(new URL('../components/WorkspaceSetup.tsx', import.meta.url), 'utf8'), /View billing and plans/);
});
