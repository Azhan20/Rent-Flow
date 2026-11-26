import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  evaluateRuntimeConnectionPermissionState,
  expectedRuntimeAclEntries,
  inspectRuntimeRoleDesign,
  SUPABASE_PLATFORM_ROLE_MEMBERSHIPS,
} from '../../security/supabase-test-runtime-role-phase2.mjs';

const root = process.cwd();
const sql = readFileSync(resolve(root, 'security/supabase-test-runtime-role-phase2.sql'), 'utf8').replace(/\r\n/g, '\n');
const grants = sql.replace(/--[^\r\n]*/g, '').split(';').map((part) => part.trim()).filter(Boolean);
const runner = readFileSync(resolve(root, 'security/supabase-test-runtime-role-phase2.mjs'), 'utf8');
const diagnostics = readFileSync(resolve(root, 'security/supabase-test-runtime-role-phase2-diagnostics.mjs'), 'utf8');

test('prepared runtime SQL creates a no-login privilege role and restricted login role', () => {
  assert.match(sql, /CREATE ROLE rentflow_runtime\s+NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/i);
  assert.match(sql, /CREATE ROLE rentflow_runtime_login\s+LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/i);
  assert.match(sql, /GRANT rentflow_runtime TO rentflow_runtime_login\s+WITH INHERIT TRUE, SET FALSE, ADMIN FALSE/i);
  assert.equal(grants.some((statement) => /\bALTER ROLE\b/i.test(statement)), false);
});

function roleFixture(overrides = {}) {
  const role = {
    rolcanlogin: false, rolinherit: true, rolsuper: false, rolcreatedb: false,
    rolcreaterole: false, rolreplication: false, rolbypassrls: false,
    has_role_config: false, rolconnlimit: -1, rolvaliduntil: null,
  };
  const loginRole = { ...role, rolcanlogin: true };
  const applicationMembership = {
    granted_role: 'rentflow_runtime', member_role: 'rentflow_runtime_login',
    grantor_role: 'postgres',
    admin_option: false, inherit_option: true, set_option: false,
  };
  const columns = [
    'firebase_uid', 'id', 'email', 'display_name', 'status', 'name', 'slug', 'currency', 'timezone',
    'organization_id', 'user_id', 'role', 'sku', 'description', 'category_id', 'daily_rate',
    'weekly_rate', 'monthly_rate', 'deposit_amount', 'total_units', 'specifications', 'company_name',
    'phone', 'billing_address', 'notes', 'customer_id', 'booking_number', 'start_at', 'end_at',
    'subtotal', 'tax_amount', 'delivery_fee', 'booking_id', 'equipment_id', 'quantity', 'rate_applied',
    'actor_user_id', 'action', 'subject_type', 'subject_id', 'request_id', 'metadata', 'updated_at',
  ].map((attname) => ({ relname: 'fixture_table', attname }));
  return {
    role, loginRole, roleMemberships: [...SUPABASE_PLATFORM_ROLE_MEMBERSHIPS, applicationMembership], roleOwnership: [],
    roleAclEntries: expectedRuntimeAclEntries(columns), columns,
    ...overrides,
  };
}

test('role design accepts only the reviewed two-role flags and exact membership options', () => {
  const design = inspectRuntimeRoleDesign(roleFixture());
  assert.equal(design.pairComplete, true);
  assert.equal(design.roleFlagsMatch, true);
  assert.equal(design.loginFlagsMatch, true);
  assert.equal(design.membershipMatches, true);
  assert.equal(design.ownershipClear, true);
  assert.equal(design.aclMatches, true);
});

test('effective database CONNECT and public schema USAGE allow only the expected state', () => {
  assert.deepEqual(evaluateRuntimeConnectionPermissionState({
    can_connect: true,
    public_schema_usage: true,
    public_schema_create: false,
  }), {
    databaseConnect: true,
    publicSchemaUsage: true,
    publicSchemaCreateDenied: true,
  });
});

test('effective database/schema permission evaluator rejects missing and unexpected privileges', () => {
  for (const row of [
    { can_connect: false, public_schema_usage: true, public_schema_create: false },
    { can_connect: true, public_schema_usage: false, public_schema_create: false },
    { can_connect: true, public_schema_usage: true, public_schema_create: true },
    {},
    null,
  ]) {
    assert(Object.values(evaluateRuntimeConnectionPermissionState(row)).some((allowed) => !allowed));
  }
});

test('runner checks effective login CONNECT and schema privileges without widening grants', () => {
  assert.match(runner, /has_database_privilege\(\$1,current_database\(\),'CONNECT'\)/);
  assert.match(runner, /has_schema_privilege\(\$1,'public','USAGE'\)/);
  assert.match(runner, /has_schema_privilege\(\$1,'public','CREATE'\)/);
  assert.match(runner, /\[RUNTIME_LOGIN_ROLE\], diagnostics\)/);
  assert.match(runner, /'LOGIN_DATABASE_SCHEMA_CHECK_DEFERRED'/);
  assert.match(runner, /'EXISTING_LOGIN_DATABASE_CONNECT'/);
  assert.match(runner, /'EXISTING_LOGIN_PUBLIC_SCHEMA_USAGE'/);
  assert.match(runner, /'EXISTING_LOGIN_PUBLIC_SCHEMA_NO_CREATE'/);
  assert.doesNotMatch(sql, /GRANT\s+(?:CONNECT|USAGE)\b/i);
});

test('role design rejects partial roles, incorrect options, and unexpected memberships', () => {
  const fixture = roleFixture();
  assert.equal(inspectRuntimeRoleDesign({ ...fixture, loginRole: null }).pairComplete, false);
  for (const optionMismatch of [
    { set_option: true },
    { inherit_option: false },
    { admin_option: true },
    { grantor_role: 'unexpected_grantor' },
  ]) {
    assert.equal(inspectRuntimeRoleDesign({
      ...fixture,
      roleMemberships: [{ ...fixture.roleMemberships[0], ...optionMismatch }],
    }).membershipMatches, false);
  }
  assert.equal(inspectRuntimeRoleDesign({
    ...fixture,
    roleMemberships: [...fixture.roleMemberships, { ...fixture.roleMemberships[0], member_role: 'unexpected_login' }],
  }).membershipMatches, false);
});

test('role design rejects owner, BYPASSRLS, and ACL privileges outside the exact grant set', () => {
  const fixture = roleFixture();
  assert.equal(inspectRuntimeRoleDesign({ ...fixture, role: { ...fixture.role, rolbypassrls: true } }).roleFlagsMatch, false);
  assert.equal(inspectRuntimeRoleDesign({ ...fixture, roleOwnership: [{ object_description: 'unexpected owner' }] }).ownershipClear, false);
  assert.equal(inspectRuntimeRoleDesign({
    ...fixture,
    roleAclEntries: [...fixture.roleAclEntries, {
      object_type: 'relation', object_name: 'public.rf_invoices', column_name: null,
      grantee: 'rentflow_runtime', privilege_type: 'SELECT', is_grantable: false, grantor: 'postgres',
    }],
  }).aclMatches, false);
});

test('prepared SELECT access is column-scoped where active queries permit it', () => {
  assert(grants.includes('GRANT SELECT (firebase_uid, id, email, display_name, status)\n  ON TABLE public.rf_users TO rentflow_runtime'));
  assert(grants.includes('GRANT SELECT (id, name, slug, currency, timezone, status)\n  ON TABLE public.rf_organizations TO rentflow_runtime'));
  assert(grants.includes('GRANT SELECT (organization_id, user_id, status, role)\n  ON TABLE public.rf_memberships TO rentflow_runtime'));
  for (const table of ['rf_equipment', 'rf_customers', 'rf_bookings', 'rf_booking_items']) {
    assert(grants.includes(`GRANT SELECT ON TABLE public.${table} TO rentflow_runtime`));
  }
});

test('prepared SQL has no equipment UPDATE or broad destructive/reference/trigger/function grants', () => {
  assert.doesNotMatch(sql, /GRANT\s+UPDATE\s*\(\s*active\s*\)\s+ON TABLE public\.rf_equipment/i);
  assert.deepEqual(grants.filter((statement) => /^GRANT\s+UPDATE\b/i.test(statement)), [
    'GRANT UPDATE (email, display_name, updated_at)\n  ON TABLE public.rf_users TO rentflow_runtime',
  ]);
  assert.equal(grants.some((statement) => /\bGRANT\s+(ALL|DELETE|TRUNCATE|REFERENCES|TRIGGER|EXECUTE)\b/i.test(statement)), false);
  assert.equal(grants.some((statement) => /\bGRANT\s+UPDATE\s+ON TABLE\b/i.test(statement)), false);
});

test('audit logs remain insert-only and billing, payment, webhook, and override tables are absent from grants', () => {
  assert.deepEqual(grants.filter((statement) => /rf_audit_logs/i.test(statement)), [
    'GRANT INSERT (organization_id, actor_user_id, action, subject_type, subject_id, request_id, metadata)\n  ON TABLE public.rf_audit_logs TO rentflow_runtime',
  ]);
  assert.equal(grants.some((statement) => /rf_(billing|invoices|customer_payments|subscriptions)/i.test(statement)), false);
});

test('organization creation returns only the fields granted to the runtime role', () => {
  const server = readFileSync(resolve(root, 'server.ts'), 'utf8');
  assert.match(server, /insert\(organizations\)[\s\S]*?\.returning\(\{\s*id: organizations\.id,\s*name: organizations\.name,\s*slug: organizations\.slug,\s*currency: organizations\.currency,\s*timezone: organizations\.timezone/s);
});

test('runner requires dedicated test settings, exact TLS target, and never reads DATABASE_URL', () => {
  assert.match(runner, /process\.env\.SUPABASE_TEST_DATABASE_URL/);
  assert.match(runner, /process\.env\.SUPABASE_TEST_CA_CERT/);
  assert.doesNotMatch(runner, /process\.env\.DATABASE_URL/);
  assert.match(runner, /validateSupabaseTestingDatabaseTarget\(dedicatedConfig, PROJECT_ROOT\)/);
  assert.match(runner, /'TLS_CERTIFICATE_VALIDATION',[\s\S]*?target\?\.ssl\?\.rejectUnauthorized === true/);
  assert.match(runner, /'TLS_HOSTNAME_VERIFICATION',[\s\S]*?target\?\.ssl\?\.servername === target\?\.host/);
});

test('Supabase TEST migrations retain the privileged migration connection independently of runtime config', () => {
  const migrationConfig = readFileSync(resolve(root, 'src/db/supabase-testing.drizzle.config.ts'), 'utf8');
  const migrationRunner = readFileSync(resolve(root, 'src/db/run-supabase-testing-migration.ts'), 'utf8');
  assert.match(migrationConfig, /process\.env\.SUPABASE_TEST_DATABASE_URL/);
  assert.match(migrationConfig, /process\.env\.SUPABASE_TEST_CA_CERT/);
  assert.doesNotMatch(migrationConfig, /SUPABASE_TEST_RUNTIME_DATABASE_URL/);
  assert.match(migrationRunner, /process\.env\.SUPABASE_TEST_DATABASE_URL/);
  assert.doesNotMatch(migrationRunner, /SUPABASE_TEST_RUNTIME_DATABASE_URL/);
});

test('runner validates exact grants, runtime attributes, memberships, snapshots, Phase 1, and built-in functions', () => {
  assert.match(runner, /'PREPARED_SQL_ALLOWLIST_MATCH'/);
  assert.match(diagnostics, /SQL_ALLOWLIST: 'PREPARED_SQL_NOT_ALLOWLISTED'/);
  assert.match(runner, /REQUIRED_ROLE_FLAGS/);
  assert.match(runner, /'EXISTING_ROLE_MEMBERSHIP_EXACT'/);
  assert.match(runner, /INHERIT TRUE, SET FALSE, ADMIN FALSE/);
  assert.match(runner, /EXISTING_LOGIN_ROLE_ATTRIBUTES_EXACT/);
  assert.match(runner, /RUNTIME_ROLE_DESIGN_INVALID_AFTER_SQL/);
  assert.match(diagnostics, /ROLE_MEMBERSHIP: 'EXISTING_ROLE_MEMBERSHIP_FOUND'/);
  assert.match(runner, /SNAPSHOT_READBACK_MISMATCH/);
  assert.match(runner, /'PHASE1_TABLE_ACL_REVOKED'/);
  assert.match(diagnostics, /PHASE1: 'PHASE1_REVOCATION_MISMATCH'/);
  assert.match(runner, /pg_advisory_xact_lock\(bigint\)/);
  assert.match(runner, /hashtextextended\(text,bigint\)/);
  assert.match(runner, /gen_random_uuid\(\)/);
  assert.match(runner, /builtins\.rowCount === 3/);
  assert.match(runner, /rollbackPhase2Transaction\(client, diagnostics\)/);
  assert.match(runner, /client\.release\(discardClient \? true : undefined\)/);
  assert.doesNotMatch(runner, /query_timeout:/);
  assert.match(runner, /statement_timeout:\s*20_000/);
  assert.match(runner, /open\(path, 'wx'\)/);
});
