import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertSnapshotComplete,
  buildPostChangeRoleDesignDiagnostic,
  captureProtectedAcl,
  captureRoleAclEntries,
  compareProtectedAcl,
  compareStructuralState,
  createSnapshot,
  dispatchPhase2Command,
  expectedRuntimeAclEntries,
  inspectRuntimeMembershipsReadOnly,
  parseAndValidateSql,
  RUNTIME_MEMBERSHIP_INSPECTION_SQL,
  SUPABASE_PLATFORM_ROLE_MEMBERSHIPS,
  verifyCatalogBaseline,
} from './supabase-test-runtime-role-phase2.mjs';
import {
  createPhase2DiagnosticState,
  formatPhase2FailureDiagnostic,
  rollbackPhase2Transaction,
} from './supabase-test-runtime-role-phase2-diagnostics.mjs';

const require = createRequire(import.meta.url);
const { prepareValue } = require('pg/lib/utils');

const approvedTarget = {
  host: 'aws-1-ap-northeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.dgasadodjzpjofkvjkbw',
  database: 'postgres',
  ssl: {
    ca: 'local test CA fixture',
    rejectUnauthorized: true,
    servername: 'aws-1-ap-northeast-1.pooler.supabase.com',
  },
};

function approvedCatalog() {
  return {
    identity: {
      database: 'postgres',
      current_role: 'postgres',
      session_role: 'postgres',
      server_version_num: '170000',
    },
    tables: Array.from({ length: 21 }, (_, index) => ({
      owner: 'postgres',
      rls_enabled: false,
      force_rls: false,
      relname: `rf_table_${index}`,
    })),
    constraints: Array.from({ length: 117 }, () => ({})),
    indexes: Array.from({ length: 60 }, () => ({})),
    functions: [{}],
    triggers: [{
      table_name: 'rf_billing_account_entitlement_overrides',
      tgname: 'rf_billing_entitlement_override_period_guard',
      definition: 'CREATE TRIGGER rf_billing_entitlement_override_period_guard BEFORE INSERT OR UPDATE ON rf_billing_account_entitlement_overrides FOR EACH ROW EXECUTE FUNCTION rf_guard_billing_entitlement_override_period()',
      tgenabled: 'O',
    }],
    phase1Verification: [],
    requiredRuntimeFunctions: [
      { signature: 'pg_advisory_xact_lock(bigint)', public_execute: true },
      { signature: 'hashtextextended(text,bigint)', public_execute: true },
      { signature: 'gen_random_uuid()', public_execute: true },
    ],
  };
}

function runBaseline(catalog = approvedCatalog(), target = approvedTarget) {
  const diagnostics = createPhase2DiagnosticState();
  diagnostics.currentStage = 'PREFLIGHT_VALIDATION';
  try {
    verifyCatalogBaseline(catalog, target, diagnostics);
    return { diagnostics, error: null };
  } catch (error) {
    return { diagnostics, error };
  }
}

test('approved Supabase test database identity, target, and TLS baseline pass', () => {
  const { diagnostics, error } = runBaseline();

  assert.equal(error, null);
  assert.equal(diagnostics.failedCheckId, null);
  assert.equal(diagnostics.activePreflightCheckId, null);
});

test('role membership options are not accepted on PostgreSQL versions before 16', () => {
  const catalog = approvedCatalog();
  catalog.identity.server_version_num = '150000';
  const { diagnostics, error } = runBaseline(catalog);

  assert.equal(error?.safeCode, 'ROLE_MEMBERSHIP_OPTIONS_UNSUPPORTED');
  assert.equal(diagnostics.failedCheckId, 'ROLE_MEMBERSHIP_OPTIONS_SUPPORTED');
  assert.equal(diagnostics.failedCheckActual, false);
});

test('one trigger object handling INSERT and UPDATE passes the exact object count baseline', () => {
  const catalog = approvedCatalog();
  assert.equal(catalog.triggers.length, 1);
  assert.match(catalog.triggers[0].definition, /BEFORE INSERT OR UPDATE/);

  const { diagnostics, error } = runBaseline(catalog);
  assert.equal(error, null);
  assert.equal(diagnostics.failedCheckId, null);
});

test('missing and unexpected additional trigger objects fail structural verification', () => {
  for (const triggerCount of [0, 2]) {
    const catalog = approvedCatalog();
    catalog.triggers = Array.from({ length: triggerCount }, (_, index) => ({
      ...catalog.triggers[0],
      tgname: index === 0 ? catalog.triggers[0].tgname : 'unexpected_second_trigger',
    }));

    const { diagnostics, error } = runBaseline(catalog);
    assert.equal(error?.safeCode, 'STRUCTURAL_BASELINE_MISMATCH');
    assert.equal(diagnostics.failedCheckId, 'TRIGGER_INVENTORY_COUNT');
    assert.equal(diagnostics.failedCheckActual, triggerCount);
  }
});

test('migration definition remains one BEFORE INSERT OR UPDATE trigger on the override table', () => {
  const migration = readFileSync(resolve(process.cwd(), 'drizzle/0003_saas_entitlements_usage.sql'), 'utf8');
  const triggerDefinitions = migration.match(/CREATE\s+TRIGGER\b/gi) ?? [];

  assert.equal(triggerDefinitions.length, 1);
  assert.match(migration, /CREATE\s+FUNCTION\s+rf_guard_billing_entitlement_override_period\(\)/i);
  assert.match(migration, /CREATE\s+TRIGGER\s+rf_billing_entitlement_override_period_guard\s+BEFORE\s+INSERT\s+OR\s+UPDATE\s+ON\s+rf_billing_account_entitlement_overrides\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+rf_guard_billing_entitlement_override_period\(\)/i);
});

test('snapshot construction receives the validated target and records its validated identity', () => {
  const baseline = approvedCatalog();
  const catalog = {
    ...baseline,
    identity: { ...baseline.identity, server_version_num: '170000' },
    roles: [],
    memberships: [],
    role: null,
    loginRole: null,
    roleMemberships: [],
    roleOwnership: [],
    roleAclEntries: [],
    columns: [],
    sequences: [],
    defaultPrivileges: [],
    publicSchemaAcl: [],
    databaseAcl: [],
    protectedAcl: [],
  };

  const snapshot = createSnapshot(catalog, [], approvedTarget);

  assert.equal(snapshot.snapshotVersion, 4);
  assert.equal(snapshot.loginRoleStateBefore, null);
  assert.equal(snapshot.target.host, approvedTarget.host);
  assert.equal(snapshot.target.port, approvedTarget.port);
  assert.equal(snapshot.target.adminLogin, approvedTarget.user);
  assert.equal(snapshot.target.strictTls, true);
  assert.equal(snapshot.target.hostnameVerification, true);
});

function currentPreparedStatements() {
  return readFileSync(resolve(process.cwd(), 'security/supabase-test-runtime-role-phase2.sql'), 'utf8')
    .replace(/--[^\r\n]*/g, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

test('approved SQL parser rejects statement order drift before snapshot creation', () => {
  const sql = readFileSync(resolve(process.cwd(), 'security/supabase-test-runtime-role-phase2.sql'), 'utf8');
  const diagnostics = createPhase2DiagnosticState();
  diagnostics.currentStage = 'PREFLIGHT_VALIDATION';
  const reorderedSql = currentPreparedStatements().reverse().join(';\n') + ';';

  assert.deepEqual(parseAndValidateSql(sql, diagnostics), currentPreparedStatements());
  assert.equal(diagnostics.failedCheckId, null);

  const reorderedDiagnostics = createPhase2DiagnosticState();
  reorderedDiagnostics.currentStage = 'PREFLIGHT_VALIDATION';
  assert.throws(() => parseAndValidateSql(reorderedSql, reorderedDiagnostics), (error) => error?.safeCode === 'PREPARED_SQL_NOT_ALLOWLISTED');
  assert.equal(reorderedDiagnostics.failedCheckId, 'PREPARED_SQL_ALLOWLIST_MATCH');
});

function currentSnapshot(catalogOverrides = {}) {
  const catalog = {
    ...approvedCatalog(),
    roles: [],
    memberships: [],
    role: null,
    loginRole: null,
    roleMemberships: [],
    roleOwnership: [],
    roleAclEntries: [],
    columns: [],
    sequences: [],
    defaultPrivileges: [],
    publicSchemaAcl: [],
    databaseAcl: [],
    protectedAcl: [],
    ...catalogOverrides,
  };
  return createSnapshot(catalog, currentPreparedStatements(), approvedTarget);
}

function validateSnapshot(snapshot) {
  const diagnostics = createPhase2DiagnosticState();
  diagnostics.currentStage = 'SNAPSHOT_CREATION';
  try {
    assertSnapshotComplete(snapshot, approvedTarget, diagnostics);
    return { diagnostics, error: null };
  } catch (error) {
    return { diagnostics, error };
  }
}

function postChangeRoleCatalog() {
  const role = {
    rolcanlogin: false, rolinherit: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false,
    rolreplication: false, rolbypassrls: false, has_role_config: false, rolconnlimit: -1, rolvaliduntil: null,
  };
  const loginRole = { ...role, rolcanlogin: true };
  const applicationMembership = {
    granted_role: 'rentflow_runtime', member_role: 'rentflow_runtime_login', grantor_role: 'postgres',
    admin_option: false, inherit_option: true, set_option: false,
  };
  return {
    role,
    loginRole,
    roleMemberships: [...SUPABASE_PLATFORM_ROLE_MEMBERSHIPS.map((membership) => ({ ...membership })), applicationMembership],
    roleOwnership: [],
    roleAclEntries: [],
    columns: [],
  };
}

test('post-change role-design diagnostic reports no failed predicates for the approved catalog shape', () => {
  const diagnostic = buildPostChangeRoleDesignDiagnostic(postChangeRoleCatalog());

  assert.deepEqual(diagnostic.failedChecks, []);
  assert.deepEqual(diagnostic.observed.memberships, []);
  assert.equal(diagnostic.observed.ownershipCount, 0);
});

for (const [predicate, mutate] of [
  ['roleFlagsMatch', (catalog) => { catalog.role.rolsuper = true; }],
  ['loginRoleFlagsMatch', (catalog) => { catalog.loginRole.rolcanlogin = false; }],
  ['rolePropertiesMatch', (catalog) => { catalog.role.rolconnlimit = 12; }],
  ['membershipMatches', (catalog) => { catalog.roleMemberships[0].set_option = true; }],
  ['ownershipClear', (catalog) => { catalog.roleOwnership.push({ object_description: 'sensitive unrelated detail' }); }],
]) {
  test(`post-change role-design diagnostic identifies ${predicate}`, () => {
    const catalog = postChangeRoleCatalog();
    mutate(catalog);
    const diagnostic = buildPostChangeRoleDesignDiagnostic(catalog);

    assert.deepEqual(diagnostic.failedChecks, [predicate]);
  });
}

test('membership verification accepts only the exact Supabase platform pair and application grant', () => {
  const accepted = postChangeRoleCatalog();
  assert.deepEqual(buildPostChangeRoleDesignDiagnostic(accepted).failedChecks, []);

  const invalidCases = [
    (catalog) => { catalog.roleMemberships.pop(); },
    (catalog) => { catalog.roleMemberships[0].grantor_role = 'postgres'; },
    (catalog) => { catalog.roleMemberships[1].admin_option = false; },
    (catalog) => { catalog.roleMemberships[2].grantor_role = 'supabase_admin'; },
    (catalog) => { catalog.roleMemberships.push({
      granted_role: 'rentflow_runtime', member_role: 'some_other_role', grantor_role: 'postgres',
      admin_option: true, inherit_option: false, set_option: false,
    }); },
  ];
  for (const mutate of invalidCases) {
    const catalog = postChangeRoleCatalog();
    mutate(catalog);
    assert.deepEqual(buildPostChangeRoleDesignDiagnostic(catalog).failedChecks, ['membershipMatches']);
  }
});

test('snapshot preflight rejects arbitrary postgres memberships while preserving the exact platform baseline', () => {
  const role = {
    rolname: 'rentflow_runtime',
    rolcanlogin: false, rolinherit: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false,
    rolreplication: false, rolbypassrls: false, has_role_config: false, rolconnlimit: -1, rolvaliduntil: null,
  };
  const loginRole = { ...role, rolname: 'rentflow_runtime_login', rolcanlogin: true };
  const applicationMembership = {
    granted_role: 'rentflow_runtime', member_role: 'rentflow_runtime_login', grantor_role: 'postgres',
    admin_option: false, inherit_option: true, set_option: false,
  };
  const memberships = [...SUPABASE_PLATFORM_ROLE_MEMBERSHIPS, applicationMembership];
  const accepted = currentSnapshot({
    roles: [role, loginRole], memberships, role, loginRole, roleMemberships: memberships,
  });
  assert.equal(validateSnapshot(accepted).error, null);

  const arbitraryPostgresMembership = {
    granted_role: 'rentflow_runtime', member_role: 'postgres', grantor_role: 'postgres',
    admin_option: true, inherit_option: false, set_option: false,
  };
  const rejected = currentSnapshot({
    roles: [role, loginRole], memberships: [...memberships, arbitraryPostgresMembership], role, loginRole,
    roleMemberships: [...memberships, arbitraryPostgresMembership],
  });
  const result = validateSnapshot(rejected);
  assert.equal(result.error?.safeCode, 'SNAPSHOT_ROLLBACK_MISMATCH');
  assert.equal(result.diagnostics.failedCheckId, 'SNAPSHOT_ROLE_STATE_AND_ROLLBACK_MATCH');
});

test('post-change role-design failure output includes only allowlisted values and failedChecks', () => {
  const catalog = postChangeRoleCatalog();
  catalog.role.rolpassword = 'password-secret-sentinel';
  catalog.role.connection_string = 'postgres://user:secret@host/db';
  catalog.roleMemberships[0].credential = 'membership-secret-sentinel';
  catalog.roleOwnership.push({ object_description: 'unrelated-catalog-secret-sentinel' });
  const state = createPhase2DiagnosticState();
  state.currentStage = 'POST_CHANGE_VERIFICATION';
  state.postChangeRoleDesign = {
    ...buildPostChangeRoleDesignDiagnostic(catalog),
    unapprovedField: 'raw-catalog-secret-sentinel',
    failedChecks: ['ownershipClear', 'unknownPredicate', 'password-secret-sentinel'],
    observed: {
      ...buildPostChangeRoleDesignDiagnostic(catalog).observed,
      rawCatalog: 'postgres://raw-secret-sentinel',
    },
  };
  const output = formatPhase2FailureDiagnostic(state, { safeCode: 'RUNTIME_ROLE_DESIGN_INVALID_AFTER_SQL' });
  const diagnostic = JSON.parse(output);

  assert.equal(diagnostic.errorCode, 'RUNTIME_ROLE_DESIGN_INVALID_AFTER_SQL');
  assert.deepEqual(diagnostic.postChangeRoleDesign.failedChecks, ['ownershipClear']);
  assert.equal(diagnostic.postChangeRoleDesign.observed.ownershipCount, 1);
  for (const sensitive of [
    'password-secret-sentinel', 'postgres://user:secret@host/db', 'membership-secret-sentinel',
    'unrelated-catalog-secret-sentinel', 'raw-catalog-secret-sentinel', 'unknownPredicate',
  ]) {
    assert.equal(output.includes(sensitive), false);
  }
});

test('failed membership diagnostics capture exact rows before rollback and serialize only safe membership fields', async () => {
  const memberships = [
    { granted_role: 'rentflow_runtime', member_role: 'rentflow_runtime_login', grantor_role: 'postgres', admin_option: false, inherit_option: true, set_option: false },
    { granted_role: 'authenticated', member_role: 'rentflow_runtime', grantor_role: 'postgres', admin_option: true, inherit_option: false, set_option: false },
    { granted_role: 'service_role', member_role: 'rentflow_runtime_login', grantor_role: 'postgres', admin_option: true, inherit_option: false, set_option: false },
  ].map((membership) => ({ ...membership, credential: 'membership-secret-sentinel' }));
  const catalog = { ...postChangeRoleCatalog(), roleMemberships: memberships };
  const state = createPhase2DiagnosticState();
  state.currentStage = 'POST_CHANGE_VERIFICATION';
  const events = [];
  const client = {
    async query(sql) {
      assert.equal(sql, 'ROLLBACK');
      events.push('rollback');
      memberships.length = 0;
      return { rows: [] };
    },
  };

  // This mirrors the production failure branch: capture the in-transaction catalog rows,
  // assign the sanitized design diagnostic, then enter the catch path and roll back.
  const designDiagnostic = buildPostChangeRoleDesignDiagnostic(catalog);
  state.postChangeRoleDesign = designDiagnostic;
  events.push('diagnostic-captured');
  assert.deepEqual(designDiagnostic.failedChecks, ['membershipMatches']);
  assert.equal(await rollbackPhase2Transaction(client, state), true);

  const runnerSource = readFileSync(resolve(process.cwd(), 'security/supabase-test-runtime-role-phase2.mjs'), 'utf8');
  const capturedAt = runnerSource.indexOf('diagnostics.postChangeRoleDesign = roleDesignDiagnostic');
  const failureAt = runnerSource.indexOf("stop('RUNTIME_ROLE_DESIGN_INVALID_AFTER_SQL')", capturedAt);
  const rollbackAt = runnerSource.indexOf('rollbackPhase2Transaction(client, diagnostics)', failureAt);
  assert(capturedAt >= 0 && failureAt > capturedAt && rollbackAt > failureAt);
  assert.deepEqual(events, ['diagnostic-captured', 'rollback']);

  const output = formatPhase2FailureDiagnostic(state, { safeCode: 'RUNTIME_ROLE_DESIGN_INVALID_AFTER_SQL' });
  const diagnostic = JSON.parse(output);
  const rows = diagnostic.postChangeRoleDesign.observed.memberships;
  assert.equal(rows.length, 3);
  assert.deepEqual(rows, [
    { granted_role: 'rentflow_runtime', member_role: 'rentflow_runtime_login', grantor_role: 'postgres', admin_option: false, inherit_option: true, set_option: false },
    { granted_role: 'authenticated', member_role: 'rentflow_runtime', grantor_role: 'postgres', admin_option: true, inherit_option: false, set_option: false },
    { granted_role: 'service_role', member_role: 'rentflow_runtime_login', grantor_role: 'postgres', admin_option: true, inherit_option: false, set_option: false },
  ]);
  assert.equal(output.includes('membership-secret-sentinel'), false);
  assert.equal(memberships.length, 0);
});

test('runtime ACL query binds rolname = ANY($1) as an array, avoiding PostgreSQL 22P02', async () => {
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  };
  const diagnostics = createPhase2DiagnosticState();

  assert.deepEqual(await captureRoleAclEntries(client, diagnostics), []);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /rolname=ANY\(\$1\)/);
  assert.deepEqual(calls[0].values, [['rentflow_runtime']]);
  assert.equal(prepareValue(calls[0].values[0]), '{"rentflow_runtime"}');
  assert.equal(prepareValue('rentflow_runtime'), 'rentflow_runtime');
});

test('protected ACL query sends no bind parameters when its SQL has no placeholders', async () => {
  const calls = [];
  const client = {
    async query(...args) {
      calls.push(args);
      const sql = args[0];
      const placeholderCount = Math.max(0, ...[...sql.matchAll(/\$(\d+)/g)].map(([, number]) => Number(number)));
      const suppliedValues = args[1];
      const suppliedCount = Array.isArray(suppliedValues) ? suppliedValues.length : suppliedValues == null ? 0 : 1;
      if (suppliedCount !== placeholderCount) {
        throw Object.assign(new Error('bind parameter count does not match SQL placeholders'), { code: '08P01' });
      }
      return { rows: [] };
    },
  };
  const diagnostics = createPhase2DiagnosticState();

  assert.deepEqual(await captureProtectedAcl(client, diagnostics), []);
  assert.equal(calls[0].length, 1);
  assert.doesNotMatch(calls[0][0], /\$\d+/);

  const staleBindValues = [['rentflow_runtime', 'rentflow_runtime_login']];
  assert.equal(prepareValue(staleBindValues[0]), '{"rentflow_runtime","rentflow_runtime_login"}');
  await assert.rejects(client.query(calls[0][0], staleBindValues), (error) => error?.code === '08P01');
});

test('protected ACL comparison ignores query row order but reports exact ACL changes safely', () => {
  const baseline = [
    { object_type: 'relation', object_name: 'public.rf_bookings', column_name: null, grantee: 'postgres', privilege_type: 'SELECT', is_grantable: true, grantor: 'postgres' },
    { object_type: 'relation', object_name: 'public.rf_bookings', column_name: null, grantee: 'service_role', privilege_type: 'SELECT', is_grantable: false, grantor: 'postgres' },
  ];
  const sameAclDifferentOrder = [
    { object_type: 'relation', object_name: 'public.rf_bookings', column_name: null, grantee: 'rentflow_runtime', privilege_type: 'SELECT', is_grantable: false, grantor: 'postgres' },
    ...[...baseline].reverse(),
  ];

  assert.deepEqual(compareProtectedAcl(baseline, sameAclDifferentOrder), { matches: true, beforeOnly: [], afterOnly: [] });

  const changedAcl = sameAclDifferentOrder.map((row) => row.grantee === 'service_role'
    ? { ...row, grantor: 'supabase_admin', credential: 'acl-secret-sentinel' }
    : row);
  const comparison = compareProtectedAcl(baseline, changedAcl);
  assert.equal(comparison.matches, false);
  assert.equal(comparison.beforeOnly.length, 1);
  assert.equal(comparison.afterOnly.length, 1);
  assert.equal(Object.hasOwn(comparison.afterOnly[0], 'credential'), false);

  const state = createPhase2DiagnosticState();
  state.currentStage = 'POST_CHANGE_VERIFICATION';
  state.protectedAclDiff = comparison;
  const output = formatPhase2FailureDiagnostic(state, { safeCode: 'PROTECTED_ACL_CHANGED' });
  const diagnostic = JSON.parse(output);
  assert.equal(diagnostic.protectedAclDiff.beforeOnlyCount, 1);
  assert.equal(diagnostic.protectedAclDiff.afterOnlyCount, 1);
  assert.deepEqual(diagnostic.protectedAclDiff.beforeOnly[0], {
    object_type: 'relation', object_name: 'public.rf_bookings', column_name: null, grantee: 'service_role',
    privilege_type: 'SELECT', is_grantable: false, grantor: 'postgres',
  });
  assert.deepEqual(diagnostic.protectedAclDiff.afterOnly[0], {
    object_type: 'relation', object_name: 'public.rf_bookings', column_name: null, grantee: 'service_role',
    privilege_type: 'SELECT', is_grantable: false, grantor: 'supabase_admin',
  });
  assert.equal(output.includes('acl-secret-sentinel'), false);
});

test('structural comparison permits only separately verified column ACL changes and reports default ACL differences safely', () => {
  const before = {
    tables: [],
    columns: [{
      table_name: 'rf_users', column_name: 'email', data_type: 'text', not_null: false,
      default_expression: null, identity_kind: '', generated_kind: '', acl: null,
    }],
    constraints: [], indexes: [], functions: [], triggers: [], sequences: [],
    defaultPrivileges: [], publicSchemaAcl: [], databaseAcl: [],
  };
  const afterApprovedGrants = {
    ...before,
    columns: [{ ...before.columns[0], acl: '{rentflow_runtime=r/postgres}' }],
  };
  assert.deepEqual(compareStructuralState(before, afterApprovedGrants), {
    matches: true, changedSections: [], entries: [],
  });

  const unexpectedColumnChange = {
    ...afterApprovedGrants,
    columns: [{ ...afterApprovedGrants.columns[0], data_type: 'uuid' }],
  };
  const columnComparison = compareStructuralState(before, unexpectedColumnChange);
  assert.equal(columnComparison.matches, false);
  assert.deepEqual(columnComparison.changedSections, ['columns']);
  assert.deepEqual(columnComparison.entries[0].changedFields, ['data_type']);

  const beforeAcl = '{postgres=arwdDxt/postgres}';
  const afterAcl = '{postgres=arwdDxt/postgres,unexpected_role=r/postgres}';
  const beforeWithDefault = { ...before, defaultPrivileges: [{ creator_role: 'postgres', schema_name: 'public', object_code: 'r', acl: beforeAcl }] };
  const afterWithDefault = { ...afterApprovedGrants, defaultPrivileges: [{ creator_role: 'postgres', schema_name: 'public', object_code: 'r', acl: afterAcl }] };
  const comparison = compareStructuralState(beforeWithDefault, afterWithDefault);
  assert.equal(comparison.matches, false);
  assert.deepEqual(comparison.changedSections, ['defaultPrivileges']);

  const state = createPhase2DiagnosticState();
  state.currentStage = 'POST_CHANGE_VERIFICATION';
  state.structuralStateDiff = comparison;
  state.structuralStateDiff.entries[0].credential = 'structural-secret-sentinel';
  const output = formatPhase2FailureDiagnostic(state, { safeCode: 'STRUCTURAL_OR_DEFAULT_PRIVILEGE_STATE_CHANGED' });
  const diagnostic = JSON.parse(output);
  assert.deepEqual(diagnostic.structuralStateDiff.changedSections, ['defaultPrivileges']);
  assert.deepEqual(diagnostic.structuralStateDiff.entries[0], {
    section: 'defaultPrivileges',
    object: { creator_role: 'postgres', schema_name: 'public', object_code: 'r' },
    changedFields: ['acl'],
    beforeAcl,
    afterAcl,
  });
  assert.equal(output.includes('structural-secret-sentinel'), false);
});

test('read-only membership diagnostic executes one SELECT and projects only the six requested fields', async () => {
  const calls = [];
  let released = false;
  const client = {
    on() { return this; },
    async query(...args) {
      calls.push(args);
      if (args[0] === RUNTIME_MEMBERSHIP_INSPECTION_SQL) {
        return { rows: [{
          granted_role: 'rentflow_runtime', member_role: 'rentflow_runtime_login', grantor_role: 'postgres',
          admin_option: false, inherit_option: true, set_option: false, unrelated_secret: 'must-not-be-returned',
        }] };
      }
      return { rows: [] };
    },
    release() { released = true; },
  };
  const diagnostics = createPhase2DiagnosticState();
  const pool = { async connect() { return client; } };

  const rows = await inspectRuntimeMembershipsReadOnly(pool, diagnostics);

  assert.deepEqual(calls.map(([query]) => query), ['BEGIN READ ONLY', RUNTIME_MEMBERSHIP_INSPECTION_SQL, 'COMMIT']);
  const selectCalls = calls.filter(([query]) => /^\s*SELECT\b/i.test(query));
  assert.equal(selectCalls.length, 1);
  assert.match(selectCalls[0][0], /pg_catalog\.pg_auth_members/);
  assert.equal(
    selectCalls[0][0].match(/SELECT([\s\S]*?)FROM/i)?.[1].replace(/\s+/g, ' ').trim(),
    'granted.rolname AS granted_role, member.rolname AS member_role, grantor.rolname AS grantor_role, m.admin_option, m.inherit_option, m.set_option',
  );
  assert.match(selectCalls[0][0], /JOIN pg_catalog\.pg_roles AS granted/);
  assert.match(selectCalls[0][0], /JOIN pg_catalog\.pg_roles AS member/);
  assert.match(selectCalls[0][0], /JOIN pg_catalog\.pg_roles AS grantor/);
  assert.match(selectCalls[0][0], /granted\.rolname=ANY\(\$1::pg_catalog\.name\[\]\) OR member\.rolname=ANY\(\$1::pg_catalog\.name\[\]\)/);
  assert.deepEqual(selectCalls[0][1], [['rentflow_runtime', 'rentflow_runtime_login']]);
  assert.deepEqual(Object.keys(rows[0]), [
    'granted_role', 'member_role', 'grantor_role', 'admin_option', 'inherit_option', 'set_option',
  ]);
  assert.equal(JSON.stringify(rows).includes('must-not-be-returned'), false);
  assert.equal(released, true);
  assert.equal(diagnostics.sqlModificationAttempted, false);
  assert.equal(diagnostics.transactionCommitted, true);
});

test('membership-only command dispatch cannot reach the Phase 2 runner or its modification branch', async () => {
  const calls = [];
  const result = await dispatchPhase2Command('inspect-runtime-memberships-only', {
    async inspectRuntimeMembershipsOnly() {
      calls.push('read-only-inspection');
      return [];
    },
    async runPhase2() {
      calls.push('phase2-runner');
      throw new Error('modification branch must not be called');
    },
  });

  assert.deepEqual(calls, ['read-only-inspection']);
  assert.deepEqual(result, { mode: 'inspect-runtime-memberships-only', membershipRows: [] });
  const runnerSource = readFileSync(resolve(process.cwd(), 'security/supabase-test-runtime-role-phase2.mjs'), 'utf8');
  assert.match(runnerSource, /process\.argv\.includes\('--inspect-runtime-memberships-only'\)/);
  assert.match(runnerSource, /dispatchPhase2Command\(commandMode,[\s\S]*?inspectRuntimeMembershipsOnly:[\s\S]*?runPhase2: \(\) => runPhase2\(/);
});

test('current snapshot format validates both role pre-states, exact SQL, and complete rollback order', () => {
  const snapshot = currentSnapshot();
  const { diagnostics, error } = validateSnapshot(snapshot);

  assert.equal(error, null);
  assert.equal(snapshot.snapshotVersion, 4);
  assert.equal(Object.hasOwn(snapshot, 'roleStateBefore'), true);
  assert.equal(Object.hasOwn(snapshot, 'loginRoleStateBefore'), true);
  assert.equal(snapshot.roleStateBefore, null);
  assert.equal(snapshot.loginRoleStateBefore, null);
  assert.equal(snapshot.rollbackInformation.statements.at(-3), 'REVOKE rentflow_runtime FROM rentflow_runtime_login');
  assert.equal(snapshot.rollbackInformation.statements.at(-2), 'DROP ROLE rentflow_runtime_login');
  assert.equal(snapshot.rollbackInformation.statements.at(-1), 'DROP ROLE rentflow_runtime');
  assert.equal(diagnostics.failedCheckId, null);
});

test('version 2 historical snapshot is rejected without rewriting it', () => {
  const oldPath = resolve(process.cwd(), 'security/supabase-test-runtime-role-phase2-2026-11-19T16-17-48-733Z-29a841fa-5c07-41b2-bcfd-30a208158f70.json');
  const oldSnapshot = JSON.parse(readFileSync(oldPath, 'utf8'));
  const { diagnostics, error } = validateSnapshot(oldSnapshot);

  assert.equal(oldSnapshot.snapshotVersion, 2);
  assert.equal(Object.hasOwn(oldSnapshot, 'loginRoleStateBefore'), false);
  assert.equal(oldSnapshot.preparedSqlStatements.length, 17);
  assert.equal(Object.hasOwn(oldSnapshot.rollbackInformation, 'revokeSql'), true);
  assert.equal(Object.hasOwn(oldSnapshot.rollbackInformation, 'statements'), false);
  assert.equal(error?.safeCode, 'SNAPSHOT_VERSION_UNSUPPORTED');
  assert.equal(diagnostics.failedCheckId, 'SNAPSHOT_VERSION_SUPPORTED');
});

test('missing login role pre-state fails snapshot completeness safely', () => {
  const snapshot = currentSnapshot();
  delete snapshot.loginRoleStateBefore;
  const { diagnostics, error } = validateSnapshot(snapshot);

  assert.equal(error?.safeCode, 'SNAPSHOT_SECTION_INCOMPLETE');
  assert.equal(diagnostics.failedCheckId, 'SNAPSHOT_SECTION_COMPLETENESS');
});

test('snapshot rejects prepared SQL content or statement order drift', () => {
  for (const mutate of [
    (snapshot) => { snapshot.preparedSqlStatements[0] = 'CREATE ROLE unexpected'; },
    (snapshot) => { [snapshot.preparedSqlStatements[0], snapshot.preparedSqlStatements[1]] = [snapshot.preparedSqlStatements[1], snapshot.preparedSqlStatements[0]]; },
  ]) {
    const snapshot = currentSnapshot();
    mutate(snapshot);
    const { diagnostics, error } = validateSnapshot(snapshot);
    assert.equal(error?.safeCode, 'SNAPSHOT_SQL_MISMATCH');
    assert.equal(diagnostics.failedCheckId, 'SNAPSHOT_PREPARED_SQL_MATCH');
  }
});

test('snapshot rejects partial runtime role pairs and rollback metadata mismatches', () => {
  const role = {
    rolname: 'rentflow_runtime',
    rolcanlogin: false, rolinherit: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false,
    rolreplication: false, rolbypassrls: false, has_role_config: false, rolconnlimit: -1, rolvaliduntil: null,
  };
  const loginRole = { ...role, rolname: 'rentflow_runtime_login', rolcanlogin: true };
  for (const catalogOverrides of [
    { role, roles: [role] },
    { loginRole, roles: [loginRole] },
  ]) {
    const partial = currentSnapshot(catalogOverrides);
    const partialResult = validateSnapshot(partial);
    assert.equal(partialResult.error?.safeCode, 'SNAPSHOT_ROLLBACK_MISMATCH');
    assert.equal(partialResult.diagnostics.failedCheckId, 'SNAPSHOT_ROLE_STATE_AND_ROLLBACK_MATCH');
  }

  for (const mutate of [
    (rollback) => { rollback.statements[0] = 'REVOKE ALL ON SCHEMA public FROM rentflow_runtime'; },
    (rollback) => { rollback.roleExistedBefore = true; },
    (rollback) => { rollback.grantsAlreadyPresent = true; },
  ]) {
    const mismatch = currentSnapshot();
    mutate(mismatch.rollbackInformation);
    const mismatchResult = validateSnapshot(mismatch);
    assert.equal(mismatchResult.error?.safeCode, 'SNAPSHOT_ROLLBACK_MISMATCH');
    assert.equal(mismatchResult.diagnostics.failedCheckId, 'SNAPSHOT_ROLE_STATE_AND_ROLLBACK_MATCH');
  }
});

test('snapshot-only branch verifies transaction rollback and returns before SQL modification', () => {
  const source = readFileSync(resolve(process.cwd(), 'security/supabase-test-runtime-role-phase2.mjs'), 'utf8');
  const snapshotOnlyStart = source.indexOf("if (process.argv.includes('--snapshot-only')) {");
  const modificationStart = source.indexOf('const sqlToApply =', snapshotOnlyStart);
  const snapshotOnlyBlock = source.slice(snapshotOnlyStart, modificationStart);

  assert.notEqual(snapshotOnlyStart, -1);
  assert.ok(modificationStart > snapshotOnlyStart);
  assert.match(snapshotOnlyBlock, /await rollbackPhase2Transaction\(client, diagnostics\)/);
  assert.match(snapshotOnlyBlock, /if \(!await rollbackPhase2Transaction[\s\S]*?throw Object\.assign/);
  assert.match(snapshotOnlyBlock, /transactionIsOpen = false;\s*return snapshotPath;/);
});

test('rollback for pre-existing roles never drops roles or revokes pre-existing membership', () => {
  const role = {
    rolname: 'rentflow_runtime',
    rolcanlogin: false, rolinherit: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false,
    rolreplication: false, rolbypassrls: false, has_role_config: false, rolconnlimit: -1, rolvaliduntil: null,
  };
  const loginRole = { ...role, rolname: 'rentflow_runtime_login', rolcanlogin: true };
  const membership = {
    granted_role: 'rentflow_runtime', member_role: 'rentflow_runtime_login', grantor_role: 'postgres',
    admin_option: false, inherit_option: true, set_option: false,
  };
  const snapshot = currentSnapshot({
    roles: [role, loginRole],
    memberships: [...SUPABASE_PLATFORM_ROLE_MEMBERSHIPS, membership],
    role,
    loginRole,
    roleMemberships: [...SUPABASE_PLATFORM_ROLE_MEMBERSHIPS, membership],
  });
  const { diagnostics, error } = validateSnapshot(snapshot);

  assert.equal(error, null);
  assert.equal(snapshot.rollbackInformation.rolePairExistedBefore, true);
  assert.equal(snapshot.rollbackInformation.statements.some((statement) => /^DROP ROLE\b/i.test(statement)), false);
  assert.equal(snapshot.rollbackInformation.statements.some((statement) => /^REVOKE rentflow_runtime FROM rentflow_runtime_login$/i.test(statement)), false);
  assert.equal(snapshot.rollbackInformation.statements.some((statement) => /^REVOKE rentflow_runtime(?:_login)? FROM postgres$/i.test(statement)), false);
  assert.equal(diagnostics.failedCheckId, null);
});

test('already-present exact ACLs produce an empty rollback plan', () => {
  const role = {
    rolname: 'rentflow_runtime',
    rolcanlogin: false, rolinherit: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false,
    rolreplication: false, rolbypassrls: false, has_role_config: false, rolconnlimit: -1, rolvaliduntil: null,
  };
  const loginRole = { ...role, rolname: 'rentflow_runtime_login', rolcanlogin: true };
  const membership = {
    granted_role: 'rentflow_runtime', member_role: 'rentflow_runtime_login', grantor_role: 'postgres',
    admin_option: false, inherit_option: true, set_option: false,
  };
  const snapshot = currentSnapshot({
    roles: [role, loginRole],
    memberships: [...SUPABASE_PLATFORM_ROLE_MEMBERSHIPS, membership],
    role,
    loginRole,
    roleMemberships: [...SUPABASE_PLATFORM_ROLE_MEMBERSHIPS, membership],
    roleAclEntries: expectedRuntimeAclEntries([]),
  });
  const { diagnostics, error } = validateSnapshot(snapshot);

  assert.equal(error, null);
  assert.equal(snapshot.rollbackInformation.grantsAlreadyPresent, true);
  assert.deepEqual(snapshot.rollbackInformation.statements, []);
  assert.equal(diagnostics.failedCheckId, null);
});

test('wrong catalog database identity fails at DATABASE_NAME', () => {
  const catalog = approvedCatalog();
  catalog.identity.database = 'unexpected_database';
  const { diagnostics, error } = runBaseline(catalog);

  assert.equal(error?.safeCode, 'DATABASE_IDENTITY_OR_TLS_MISMATCH');
  assert.equal(diagnostics.failedCheckId, 'DATABASE_NAME');
  assert.equal(diagnostics.failedCheckActual, false);
});

test('wrong approved target database fails at TARGET_DATABASE', () => {
  const target = { ...approvedTarget, database: 'unexpected_database' };
  const { diagnostics, error } = runBaseline(approvedCatalog(), target);

  assert.equal(error?.safeCode, 'DATABASE_IDENTITY_OR_TLS_MISMATCH');
  assert.equal(diagnostics.failedCheckId, 'TARGET_DATABASE');
  assert.equal(diagnostics.failedCheckActual, false);
});

test('missing target fails safely without an accidental ReferenceError', () => {
  const { diagnostics, error } = runBaseline(approvedCatalog(), null);

  assert.equal(error?.name, 'Error');
  assert.notEqual(error?.name, 'ReferenceError');
  assert.equal(error?.safeCode, 'DATABASE_IDENTITY_OR_TLS_MISMATCH');
  assert.equal(diagnostics.failedCheckId, 'TARGET_DATABASE');
  assert.equal(diagnostics.failedCheckExpected, 'target database is the approved test database');
  assert.equal(diagnostics.failedCheckActual, false);
  assert.equal(diagnostics.failureKind, 'EXPLICIT_SECURITY_REJECTION');

  const report = JSON.parse(formatPhase2FailureDiagnostic(diagnostics, error));
  assert.equal(report.failedCheckId, 'TARGET_DATABASE');
  assert.equal(report.failedCheckActual, false);
});

test('administrator, pooler, port, strict TLS, hostname, and CA checks remain enforced', () => {
  const cases = [
    ['TARGET_ADMIN_LOGIN', { user: 'postgres.wrong-project-ref' }],
    ['TARGET_POOLER', { host: 'other.pooler.supabase.com' }],
    ['TARGET_PORT', { port: 6543 }],
    ['TLS_CERTIFICATE_VALIDATION', { ssl: { ...approvedTarget.ssl, rejectUnauthorized: false } }],
    ['TLS_HOSTNAME_VERIFICATION', { ssl: { ...approvedTarget.ssl, servername: 'other.pooler.supabase.com' } }],
    ['TLS_CA_PRESENT', { ssl: { ...approvedTarget.ssl, ca: '' } }],
  ];

  for (const [expectedCheck, override] of cases) {
    const target = { ...approvedTarget, ...override };
    const { diagnostics, error } = runBaseline(approvedCatalog(), target);
    assert.equal(error?.safeCode, 'DATABASE_IDENTITY_OR_TLS_MISMATCH', expectedCheck);
    assert.equal(diagnostics.failedCheckId, expectedCheck);
    assert.equal(diagnostics.failedCheckActual, false);
  }
});
