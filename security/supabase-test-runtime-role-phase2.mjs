import dotenv from 'dotenv';
import { open, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  SUPABASE_TEST_PROJECT_REF_VALUE,
  validateSupabaseTestingDatabaseTarget,
} from '../src/db/supabase-testing-config-validation.ts';
import {
  runLabeledCatalogQuery,
  rollbackPhase2Transaction,
  recordClientConnectionFailure,
  recordConnectionLifecycleEvent,
  createPhase2DiagnosticState,
  formatPhase2FailureDiagnostic,
  runPreflightCheck,
} from './supabase-test-runtime-role-phase2-diagnostics.mjs';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SNAPSHOT_DIR = resolve(PROJECT_ROOT, 'security');
const EXPECTED_DATABASE = 'postgres';
const EXPECTED_ADMIN_ROLE = 'postgres.dgasadodjzpjofkvjkbw';
const EXPECTED_CURRENT_ROLE = 'postgres';
const EXPECTED_SESSION_ROLE = 'postgres';
const EXPECTED_TABLE_OWNER = 'postgres';
const EXPECTED_POOLER_HOST = 'aws-1-ap-northeast-1.pooler.supabase.com';
const EXPECTED_POOLER_PORT = 5432;
const RUNTIME_ROLE = 'rentflow_runtime';
const RUNTIME_LOGIN_ROLE = 'rentflow_runtime_login';
const INSPECT_RUNTIME_MEMBERSHIPS_MODE = 'inspect-runtime-memberships-only';
const EXPECTED_COUNTS = { tables: 21, constraints: 117, indexes: 60, functions: 1, triggers: 1 };
const ROLE_MEMBERSHIP_FIELDS = ['granted_role', 'member_role', 'grantor_role', 'admin_option', 'inherit_option', 'set_option'];
export const SUPABASE_PLATFORM_ROLE_MEMBERSHIPS = Object.freeze([
  Object.freeze({
    granted_role: RUNTIME_ROLE, member_role: EXPECTED_CURRENT_ROLE, grantor_role: 'supabase_admin',
    admin_option: true, inherit_option: false, set_option: false,
  }),
  Object.freeze({
    granted_role: RUNTIME_LOGIN_ROLE, member_role: EXPECTED_CURRENT_ROLE, grantor_role: 'supabase_admin',
    admin_option: true, inherit_option: false, set_option: false,
  }),
]);
const APPLICATION_ROLE_MEMBERSHIP = Object.freeze({
  granted_role: RUNTIME_ROLE, member_role: RUNTIME_LOGIN_ROLE, grantor_role: EXPECTED_CURRENT_ROLE,
  admin_option: false, inherit_option: true, set_option: false,
});

const TABLES = [
  'rf_users', 'rf_organizations', 'rf_memberships', 'rf_equipment_categories', 'rf_equipment',
  'rf_customers', 'rf_bookings', 'rf_booking_items', 'rf_invoices', 'rf_customer_payments',
  'rf_subscriptions', 'rf_billing_accounts', 'rf_billing_account_organizations',
  'rf_account_subscriptions', 'rf_billing_usage_counters', 'rf_billing_usage_events',
  'rf_billing_account_entitlement_overrides', 'rf_account_subscription_changes',
  'rf_billing_trial_history', 'rf_billing_webhook_events', 'rf_audit_logs',
];

const TABLE_SELECT = ['rf_equipment', 'rf_customers', 'rf_bookings', 'rf_booking_items'];
const COLUMN_SELECT = {
  rf_users: ['firebase_uid', 'id', 'email', 'display_name', 'status'],
  rf_organizations: ['id', 'name', 'slug', 'currency', 'timezone', 'status'],
  rf_memberships: ['organization_id', 'user_id', 'status', 'role'],
};
const INSERT_COLUMNS = {
  rf_users: ['firebase_uid', 'email', 'display_name'],
  rf_organizations: ['name', 'slug', 'currency', 'timezone'],
  rf_memberships: ['organization_id', 'user_id', 'role', 'status'],
  rf_equipment: ['organization_id', 'sku', 'name', 'description', 'category_id', 'daily_rate', 'weekly_rate', 'monthly_rate', 'deposit_amount', 'total_units', 'specifications'],
  rf_customers: ['organization_id', 'name', 'email', 'company_name', 'phone', 'billing_address', 'notes'],
  rf_bookings: ['organization_id', 'customer_id', 'booking_number', 'start_at', 'end_at', 'status', 'subtotal', 'tax_amount', 'delivery_fee', 'deposit_amount'],
  rf_booking_items: ['organization_id', 'booking_id', 'equipment_id', 'quantity', 'rate_applied'],
  rf_audit_logs: ['organization_id', 'actor_user_id', 'action', 'subject_type', 'subject_id', 'request_id', 'metadata'],
};
const UPDATE_COLUMNS = { rf_users: ['email', 'display_name', 'updated_at'] };

const ROLE_CREATE_SQL = `CREATE ROLE rentflow_runtime
  NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`;
const LOGIN_ROLE_CREATE_SQL = `CREATE ROLE rentflow_runtime_login
  LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`;
const ROLE_MEMBERSHIP_SQL = `GRANT rentflow_runtime TO rentflow_runtime_login
  WITH INHERIT TRUE, SET FALSE, ADMIN FALSE`;
const APPROVED_GRANTS = [
  ROLE_MEMBERSHIP_SQL,
  'GRANT SELECT (firebase_uid, id, email, display_name, status) ON TABLE public.rf_users TO rentflow_runtime',
  'GRANT INSERT (firebase_uid, email, display_name) ON TABLE public.rf_users TO rentflow_runtime',
  'GRANT UPDATE (email, display_name, updated_at) ON TABLE public.rf_users TO rentflow_runtime',
  'GRANT SELECT (id, name, slug, currency, timezone, status) ON TABLE public.rf_organizations TO rentflow_runtime',
  'GRANT INSERT (name, slug, currency, timezone) ON TABLE public.rf_organizations TO rentflow_runtime',
  'GRANT SELECT (organization_id, user_id, status, role) ON TABLE public.rf_memberships TO rentflow_runtime',
  'GRANT INSERT (organization_id, user_id, role, status) ON TABLE public.rf_memberships TO rentflow_runtime',
  'GRANT SELECT ON TABLE public.rf_equipment TO rentflow_runtime',
  'GRANT INSERT (organization_id, sku, name, description, category_id, daily_rate, weekly_rate, monthly_rate, deposit_amount, total_units, specifications) ON TABLE public.rf_equipment TO rentflow_runtime',
  'GRANT SELECT ON TABLE public.rf_customers TO rentflow_runtime',
  'GRANT INSERT (organization_id, name, email, company_name, phone, billing_address, notes) ON TABLE public.rf_customers TO rentflow_runtime',
  'GRANT SELECT ON TABLE public.rf_bookings TO rentflow_runtime',
  'GRANT INSERT (organization_id, customer_id, booking_number, start_at, end_at, status, subtotal, tax_amount, delivery_fee, deposit_amount) ON TABLE public.rf_bookings TO rentflow_runtime',
  'GRANT SELECT ON TABLE public.rf_booking_items TO rentflow_runtime',
  'GRANT INSERT (organization_id, booking_id, equipment_id, quantity, rate_applied) ON TABLE public.rf_booking_items TO rentflow_runtime',
  'GRANT INSERT (organization_id, actor_user_id, action, subject_type, subject_id, request_id, metadata) ON TABLE public.rf_audit_logs TO rentflow_runtime',
];

const EXPECTED_STATEMENTS_IN_ORDER = [ROLE_CREATE_SQL, LOGIN_ROLE_CREATE_SQL, ...APPROVED_GRANTS].map(normalizeSql);
const REQUIRED_ROLE_FLAGS = {
  rolcanlogin: false,
  rolinherit: true,
  rolsuper: false,
  rolcreatedb: false,
  rolcreaterole: false,
  rolreplication: false,
  rolbypassrls: false,
};
const REQUIRED_LOGIN_ROLE_FLAGS = { ...REQUIRED_ROLE_FLAGS, rolcanlogin: true };

function normalizeSql(statement) {
  return statement.replace(/\s+/g, ' ').trim().toUpperCase();
}

function stop(code) {
  const error = new Error('Phase 2 preflight stopped.');
  error.safeCode = code;
  throw error;
}

export function parseAndValidateSql(sqlText, diagnostics) {
  const statements = sqlText
    .replace(/--[^\r\n]*/g, '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const normalized = statements.map(normalizeSql);
  runPreflightCheck(diagnostics, 'PREPARED_SQL_ALLOWLIST_MATCH', () => ({
    passed: JSON.stringify(normalized) === JSON.stringify(EXPECTED_STATEMENTS_IN_ORDER),
    actual: JSON.stringify(normalized) === JSON.stringify(EXPECTED_STATEMENTS_IN_ORDER) ? 'MATCH' : 'MISMATCH',
  }));
  runPreflightCheck(diagnostics, 'PREPARED_SQL_NO_PROHIBITED_GRANTS', () => {
    const count = (sqlText.match(/\bGRANT\s+(?:ALL|DELETE|TRUNCATE|REFERENCES|TRIGGER|EXECUTE)\b/gi) ?? []).length;
    return { passed: count === 0, actual: count };
  });
  runPreflightCheck(diagnostics, 'PREPARED_SQL_NO_UNEXPECTED_EQUIPMENT_UPDATE', () => {
    const count = (sqlText.match(/\bGRANT\s+UPDATE\s*\(\s*ACTIVE\s*\)\s+ON\s+TABLE\s+PUBLIC\.RF_EQUIPMENT\b/gi) ?? []).length;
    return { passed: count === 0, actual: count };
  });
  return statements;
}

function expectedRollbackSql(rolePairExisted, grantsAlreadyPresent) {
  if (grantsAlreadyPresent) return [];
  const rollback = [];
  for (const statement of APPROVED_GRANTS.filter((item) => item !== ROLE_MEMBERSHIP_SQL)) {
    rollback.push(statement.replace(/^GRANT\s+/i, 'REVOKE ').replace(/\s+TO\s+rentflow_runtime$/i, ' FROM rentflow_runtime'));
  }
  if (!rolePairExisted) {
    rollback.push('REVOKE rentflow_runtime FROM rentflow_runtime_login');
    rollback.push('DROP ROLE rentflow_runtime_login');
    rollback.push('DROP ROLE rentflow_runtime');
  }
  return rollback;
}

export function assertSnapshotComplete(snapshot, expectedTarget, diagnostics) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    runPreflightCheck(diagnostics, 'SNAPSHOT_REQUIRED_SECTIONS', () => ({ passed: false, actual: 'INCOMPLETE' }));
  }
  const arrays = [
    'roles', 'memberships', 'roleOwnership', 'roleAclEntries', 'tables', 'columns', 'constraints',
    'indexes', 'functions', 'triggers', 'sequences', 'defaultPrivileges', 'publicSchemaAcl',
    'databaseAcl', 'protectedAcl', 'phase1Verification', 'requiredRuntimeFunctions', 'preparedSqlStatements',
  ];
  runPreflightCheck(diagnostics, 'SNAPSHOT_VERSION_SUPPORTED', () => ({
    passed: snapshot.snapshotVersion === 4,
    actual: snapshot.snapshotVersion === 4 ? 'CURRENT' : 'UNSUPPORTED',
  }));
  runPreflightCheck(diagnostics, 'SNAPSHOT_REQUIRED_SECTIONS', () => {
    const targetMismatchCount = [
      snapshot.target?.projectRef === SUPABASE_TEST_PROJECT_REF_VALUE,
      snapshot.target?.database === EXPECTED_DATABASE,
      snapshot.target?.host === expectedTarget.host,
      snapshot.target?.port === expectedTarget.port,
      snapshot.target?.strictTls === true,
      snapshot.target?.currentRole === EXPECTED_CURRENT_ROLE,
      snapshot.target?.sessionRole === EXPECTED_SESSION_ROLE,
      snapshot.target?.adminLogin === EXPECTED_ADMIN_ROLE,
      snapshot.target?.hostnameVerification === true,
      Boolean(snapshot.capturedAt),
    ].filter((passed) => !passed).length;
    const missingArrayCount = arrays.filter((name) => !Array.isArray(snapshot[name])).length;
    const mismatchCount = targetMismatchCount + missingArrayCount;
    return { passed: mismatchCount === 0, actual: mismatchCount };
  });
  runPreflightCheck(diagnostics, 'SNAPSHOT_INVENTORY_COUNTS', () => {
    const mismatchCount = Object.entries(EXPECTED_COUNTS)
      .filter(([name, count]) => snapshot.inventoryCounts?.[name] !== count).length;
    return { passed: mismatchCount === 0, actual: mismatchCount };
  });
  runPreflightCheck(diagnostics, 'SNAPSHOT_ARRAY_COUNTS', () => {
    const checks = [
      snapshot.tables?.length === EXPECTED_COUNTS.tables,
      snapshot.constraints?.length === EXPECTED_COUNTS.constraints,
      snapshot.indexes?.length === EXPECTED_COUNTS.indexes,
      snapshot.functions?.length === EXPECTED_COUNTS.functions,
      snapshot.triggers?.length === EXPECTED_COUNTS.triggers,
      snapshot.phase1Verification?.length === 0,
    ];
    const mismatchCount = checks.filter((passed) => !passed).length;
    return { passed: mismatchCount === 0, actual: mismatchCount };
  });
  runPreflightCheck(diagnostics, 'SNAPSHOT_PREPARED_SQL_MATCH', () => {
    const statements = snapshot.preparedSqlStatements;
    const passed = Array.isArray(statements) && statements.length === EXPECTED_STATEMENTS_IN_ORDER.length &&
      statements.every((statement, index) => typeof statement === 'string' &&
        normalizeSql(statement) === EXPECTED_STATEMENTS_IN_ORDER[index]);
    return { passed, actual: passed ? 'MATCH' : 'MISMATCH' };
  });
  runPreflightCheck(diagnostics, 'SNAPSHOT_ROLE_STATE_AND_ROLLBACK_MATCH', () => {
    const roleAclEntries = Array.isArray(snapshot.roleAclEntries) ? snapshot.roleAclEntries : null;
    const columns = Array.isArray(snapshot.columns) ? snapshot.columns : null;
    const catalogRoles = Array.isArray(snapshot.roles) ? snapshot.roles : null;
    const catalogMemberships = Array.isArray(snapshot.memberships) ? snapshot.memberships : null;
    const roleMembershipsBefore = Array.isArray(snapshot.roleMembershipsBefore) ? snapshot.roleMembershipsBefore : null;
    const design = inspectRuntimeRoleDesign({
      role: snapshot.roleStateBefore ?? null,
      loginRole: snapshot.loginRoleStateBefore ?? null,
      roleMemberships: snapshot.roleMembershipsBefore,
      roleOwnership: snapshot.roleOwnership,
      roleAclEntries: roleAclEntries ?? [],
      columns: columns ?? [],
    });
    const roleStateValid = (design.pairAbsent || design.pairComplete) && design.roleFlagsMatch && design.loginFlagsMatch &&
      design.rolePropertiesMatch && design.membershipMatches && design.ownershipClear && design.aclMatches;
    const runtimeRoleRows = catalogRoles?.filter((role) => role && (role.rolname === RUNTIME_ROLE || role.rolname === RUNTIME_LOGIN_ROLE));
    const runtimeMembershipRows = catalogMemberships?.filter((membership) => membership && (
      membership.granted_role === RUNTIME_ROLE || membership.member_role === RUNTIME_ROLE ||
      membership.granted_role === RUNTIME_LOGIN_ROLE || membership.member_role === RUNTIME_LOGIN_ROLE));
    const roleCatalogStateMatches = catalogRoles !== null && catalogMemberships !== null && roleMembershipsBefore !== null &&
      stableJson(runtimeRoleRows.find((role) => role.rolname === RUNTIME_ROLE) ?? null) === stableJson(snapshot.roleStateBefore ?? null) &&
      stableJson(runtimeRoleRows.find((role) => role.rolname === RUNTIME_LOGIN_ROLE) ?? null) === stableJson(snapshot.loginRoleStateBefore ?? null) &&
      stableJson([...runtimeMembershipRows].sort(compareAclEntries)) === stableJson([...roleMembershipsBefore].sort(compareAclEntries));
    const expectedGrantsAlreadyPresent = design.pairComplete && roleAclEntries !== null && columns !== null && stableJson(
      [...roleAclEntries].sort(compareAclEntries),
    ) === stableJson(expectedRuntimeAclEntries(columns));
    const rollback = snapshot.rollbackInformation;
    const expectedRollbackStatements = expectedRollbackSql(design.pairComplete, expectedGrantsAlreadyPresent);
    const expectedRollbackKeys = ['grantsAlreadyPresent', 'loginRoleExistedBefore', 'roleExistedBefore', 'rolePairExistedBefore', 'statements'].sort();
    const rollbackKeysMatch = rollback && stableJson(Object.keys(rollback).sort()) === stableJson(expectedRollbackKeys);
    const rollbackMatches = rollbackKeysMatch &&
      rollback.roleExistedBefore === Boolean(snapshot.roleStateBefore) &&
      rollback.loginRoleExistedBefore === Boolean(snapshot.loginRoleStateBefore) &&
      rollback.rolePairExistedBefore === design.pairComplete &&
      rollback.grantsAlreadyPresent === expectedGrantsAlreadyPresent &&
      stableJson(rollback.statements) === stableJson(expectedRollbackStatements);
    const passed = roleStateValid && roleCatalogStateMatches && rollbackMatches;
    return { passed, actual: passed ? 'MATCH' : 'MISMATCH' };
  });
  runPreflightCheck(diagnostics, 'SNAPSHOT_SECTION_COMPLETENESS', () => {
    const missingCount = [
      Array.isArray(snapshot.unresolvedFindings),
      Array.isArray(snapshot.roleMembershipsBefore),
      Object.hasOwn(snapshot, 'roleStateBefore'),
      Object.hasOwn(snapshot, 'loginRoleStateBefore'),
      Boolean(snapshot.rollbackInformation),
      Array.isArray(snapshot.rollbackInformation?.statements),
      Boolean(snapshot.inventoryCounts),
      snapshot.inventoryCounts?.columns === snapshot.columns?.length,
      snapshot.inventoryCounts?.sequences === snapshot.sequences?.length,
      snapshot.inventoryCounts?.defaultPrivileges === snapshot.defaultPrivileges?.length,
    ].filter((present) => !present).length;
    return { passed: missingCount === 0, actual: missingCount };
  });
  runPreflightCheck(diagnostics, 'SNAPSHOT_NO_CREDENTIAL_FIELDS', () => {
    const credentialFieldCount = snapshot.roles.filter((role) => role &&
      (Object.hasOwn(role, 'rolpassword') || Object.hasOwn(role, 'passwd'))).length;
    return { passed: credentialFieldCount === 0, actual: credentialFieldCount };
  });
  runPreflightCheck(diagnostics, 'SNAPSHOT_NO_SECRET_FIELDS', () => {
    const countSecretFields = (value) => {
      if (Array.isArray(value)) return value.reduce((count, item) => count + countSecretFields(item), 0);
      if (!value || typeof value !== 'object') return 0;
      return Object.entries(value).reduce((count, [key, item]) => count +
        (/password|secret|token|connectionstring|certificate|capem/i.test(key) ? 1 : 0) + countSecretFields(item), 0);
    };
    const count = countSecretFields(snapshot);
    return { passed: count === 0, actual: count };
  });
  runPreflightCheck(diagnostics, 'SNAPSHOT_ROLLBACK_NO_GRANTS', () => {
    const grantCount = Array.isArray(snapshot.rollbackInformation?.statements)
      ? snapshot.rollbackInformation.statements.filter((statement) => /\bGRANT\b/i.test(statement)).length
      : 1;
    return { passed: grantCount === 0, actual: grantCount };
  });
}

async function captureCatalog(client, diagnostics) {
  const identity = (await runLabeledCatalogQuery(client, 'catalog_identity', `SELECT current_database() AS database, current_user AS current_role,
    session_user AS session_role, current_setting('server_version_num') AS server_version_num`, undefined, diagnostics)).rows[0];
  const version = Number(identity.server_version_num);
  const membershipOptions = version >= 160000
    ? 'm.inherit_option, m.set_option'
    : 'NULL::boolean AS inherit_option, NULL::boolean AS set_option';
  const roles = await runLabeledCatalogQuery(client, 'catalog_roles', `SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
    rolcanlogin, rolreplication, rolbypassrls, rolconnlimit, rolvaliduntil,
    (rolconfig IS NOT NULL) AS has_role_config
    FROM pg_catalog.pg_roles ORDER BY rolname`, undefined, diagnostics);
  const memberships = await runLabeledCatalogQuery(client, 'catalog_role_memberships', `SELECT granted.rolname AS granted_role, member.rolname AS member_role,
    grantor.rolname AS grantor_role, m.admin_option, ${membershipOptions}
    FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid
    JOIN pg_catalog.pg_roles member ON member.oid=m.member
    JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor ORDER BY 1,2,3`, undefined, diagnostics);
  const tables = await runLabeledCatalogQuery(client, 'catalog_tables', `SELECT c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner,
    c.relacl::text AS acl, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1) ORDER BY c.relname`, [TABLES], diagnostics);
  const columns = await runLabeledCatalogQuery(client, 'catalog_columns', `SELECT c.relname AS table_name, a.attname AS column_name,
    format_type(a.atttypid,a.atttypmod) AS data_type, a.attnotnull AS not_null,
    pg_get_expr(d.adbin,d.adrelid) AS default_expression, a.attidentity AS identity_kind, a.attgenerated AS generated_kind,
    a.attacl::text AS acl
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relname=ANY($1) ORDER BY c.relname,a.attnum`, [TABLES], diagnostics);
  const constraints = await runLabeledCatalogQuery(client, 'catalog_constraints', `SELECT c.relname AS table_name, con.conname, con.contype,
    pg_get_constraintdef(con.oid,true) AS definition, con.convalidated
    FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND left(c.relname,3)='rf_' ORDER BY c.relname,con.conname`, undefined, diagnostics);
  const indexes = await runLabeledCatalogQuery(client, 'catalog_indexes', `SELECT schemaname,tablename,indexname,indexdef FROM pg_catalog.pg_indexes
    WHERE schemaname='public' AND left(tablename,3)='rf_' ORDER BY tablename,indexname`, undefined, diagnostics);
  const functions = await runLabeledCatalogQuery(client, 'catalog_functions', `SELECT p.oid::regprocedure::text AS signature,p.proname,
    pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl,p.prosecdef AS security_definer,
    md5(pg_get_functiondef(p.oid)) AS definition_digest,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND left(p.proname,3)='rf_' ORDER BY 1`, undefined, diagnostics);
  const triggers = await runLabeledCatalogQuery(client, 'catalog_triggers', `SELECT c.relname AS table_name,t.tgname,pg_get_triggerdef(t.oid,true) AS definition,
    t.tgenabled FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname=ANY($1) ORDER BY c.relname,t.tgname`, [TABLES], diagnostics);
  const sequences = await runLabeledCatalogQuery(client, 'catalog_sequences', `SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='S' ORDER BY c.relname`, undefined, diagnostics);
  const defaultPrivileges = await runLabeledCatalogQuery(client, 'catalog_default_privileges', `SELECT pg_get_userbyid(d.defaclrole) AS creator_role,
    CASE WHEN d.defaclnamespace=0 THEN NULL ELSE n.nspname END AS schema_name,
    d.defaclobjtype AS object_code,d.defaclacl::text AS acl
    FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
    ORDER BY 1,2,3`, undefined, diagnostics);
  const publicSchemaAcl = await runLabeledCatalogQuery(client, 'catalog_public_schema_acl', `SELECT n.nspname,pg_get_userbyid(n.nspowner) AS owner,n.nspacl::text AS acl
    FROM pg_catalog.pg_namespace n WHERE n.nspname='public'`, undefined, diagnostics);
  const databaseAcl = await runLabeledCatalogQuery(client, 'catalog_database_acl', `SELECT datname,pg_get_userbyid(datdba) AS owner,datacl::text AS acl
    FROM pg_catalog.pg_database WHERE datname=current_database()`, undefined, diagnostics);
  const roleOwnership = await runLabeledCatalogQuery(client, 'catalog_runtime_role_ownership', `SELECT d.classid::regclass::text AS catalog_class,d.objid,d.objsubid,
    d.deptype,pg_catalog.pg_describe_object(d.classid,d.objid,d.objsubid) AS object_description
    FROM pg_catalog.pg_shdepend d JOIN pg_catalog.pg_roles r ON r.oid=d.refobjid
    WHERE d.refclassid='pg_catalog.pg_authid'::regclass AND r.rolname=ANY($1) AND d.deptype='o'
    ORDER BY 1,2,3`, [[RUNTIME_ROLE, RUNTIME_LOGIN_ROLE]], diagnostics);
  const roleAclEntries = await captureRoleAclEntries(client, diagnostics);
  const protectedAcl = await captureProtectedAcl(client, diagnostics);
  const phase1Verification = await verifyPhase1Revocations(client, diagnostics);
  const requiredRuntimeFunctions = await runLabeledCatalogQuery(client, 'catalog_required_runtime_functions', `SELECT p.oid::regprocedure::text AS signature,
    p.proacl::text AS acl,EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
    FROM pg_catalog.pg_proc p WHERE p.oid IN (
      to_regprocedure('pg_catalog.pg_advisory_xact_lock(bigint)'),
      to_regprocedure('pg_catalog.hashtextextended(text,bigint)'),
       to_regprocedure('pg_catalog.gen_random_uuid()')) ORDER BY 1`, undefined, diagnostics);
  const roleRow = roles.rows.find((row) => row.rolname === RUNTIME_ROLE) ?? null;
  const loginRoleRow = roles.rows.find((row) => row.rolname === RUNTIME_LOGIN_ROLE) ?? null;
  const runtimeRoleNames = new Set([RUNTIME_ROLE, RUNTIME_LOGIN_ROLE]);
  const roleMemberships = memberships.rows.filter((row) => runtimeRoleNames.has(row.granted_role) || runtimeRoleNames.has(row.member_role));

  return {
    identity, roles: roles.rows, memberships: memberships.rows, role: roleRow, loginRole: loginRoleRow,
    roleMemberships, roleOwnership: roleOwnership.rows, roleAclEntries,
    tables: tables.rows, columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows,
    functions: functions.rows, triggers: triggers.rows, sequences: sequences.rows,
    defaultPrivileges: defaultPrivileges.rows, publicSchemaAcl: publicSchemaAcl.rows,
    databaseAcl: databaseAcl.rows, protectedAcl, phase1Verification,
    requiredRuntimeFunctions: requiredRuntimeFunctions.rows,
  };
}

export async function captureRoleAclEntries(client, diagnostics) {
  return (await runLabeledCatalogQuery(client, 'catalog_runtime_role_acl_entries', `WITH target AS (SELECT oid FROM pg_catalog.pg_roles WHERE rolname=ANY($1))
    SELECT 'relation'::text AS object_type,format('%I.%I',n.nspname,c.relname) AS object_name,
      NULL::text AS column_name,CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END AS grantee,
      x.privilege_type,x.is_grantable, x.grantor::regrole::text AS grantor
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault((CASE WHEN c.relkind='S' THEN 'S' ELSE 'r' END)::pg_catalog."char",c.relowner))) x
      WHERE x.grantee IN (SELECT oid FROM target)
    UNION ALL
    SELECT 'column',format('%I.%I',n.nspname,c.relname),a.attname,x.grantee::regrole::text,
      x.privilege_type,x.is_grantable,x.grantor::regrole::text
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      CROSS JOIN LATERAL aclexplode(a.attacl) x
      WHERE x.grantee IN (SELECT oid FROM target)
    UNION ALL
    SELECT 'function',p.oid::regprocedure::text,NULL::text,
      CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END,
      x.privilege_type,x.is_grantable,x.grantor::regrole::text
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
      WHERE x.grantee IN (SELECT oid FROM target)
    UNION ALL
    SELECT 'schema',n.nspname,NULL::text,x.grantee::regrole::text,x.privilege_type,x.is_grantable,x.grantor::regrole::text
      FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x
      WHERE x.grantee IN (SELECT oid FROM target)
    UNION ALL
    SELECT 'default',coalesce(n.nspname,'*'),d.defaclobjtype::text,
      CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END,
      x.privilege_type,x.is_grantable,x.grantor::regrole::text
      FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
      CROSS JOIN LATERAL aclexplode(d.defaclacl) x
      WHERE x.grantee IN (SELECT oid FROM target)
    UNION ALL
    SELECT 'database',d.datname,NULL::text,
      CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END,
      x.privilege_type,x.is_grantable,x.grantor::regrole::text
      FROM pg_catalog.pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) x
      WHERE d.datname=current_database() AND x.grantee IN (SELECT oid FROM target)
    ORDER BY 1,2,3,5`, [[RUNTIME_ROLE]], diagnostics)).rows;
}

export async function captureProtectedAcl(client, diagnostics) {
  return (await runLabeledCatalogQuery(client, 'catalog_protected_acl', `
    SELECT 'relation'::text AS object_type,format('%I.%I',n.nspname,c.relname) AS object_name,
      NULL::text AS column_name,CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END AS grantee,
      x.privilege_type,x.is_grantable,x.grantor::regrole::text AS grantor
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault((CASE WHEN c.relkind='S' THEN 'S' ELSE 'r' END)::pg_catalog."char",c.relowner))) x
      WHERE n.nspname='public' AND (left(c.relname,3)='rf_' OR c.relkind='S')
    UNION ALL
    SELECT 'column',format('%I.%I',n.nspname,c.relname),a.attname,
      CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END,
      x.privilege_type,x.is_grantable,x.grantor::regrole::text
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      CROSS JOIN LATERAL aclexplode(a.attacl) x
      WHERE n.nspname='public' AND left(c.relname,3)='rf_'
    UNION ALL
    SELECT 'function',p.oid::regprocedure::text,NULL::text,
      CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END,
      x.privilege_type,x.is_grantable,x.grantor::regrole::text
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
      WHERE n.nspname='public' AND left(p.proname,3)='rf_'
    UNION ALL
    SELECT 'schema',n.nspname,NULL::text,
      CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END,
      x.privilege_type,x.is_grantable,x.grantor::regrole::text
      FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x
      WHERE n.nspname='public'
    UNION ALL
    SELECT 'default',coalesce(n.nspname,'*'),d.defaclobjtype::text,
      CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END,
      x.privilege_type,x.is_grantable,x.grantor::regrole::text
      FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
      CROSS JOIN LATERAL aclexplode(d.defaclacl) x
    UNION ALL
    SELECT 'database',d.datname,NULL::text,
      CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END,
      x.privilege_type,x.is_grantable,x.grantor::regrole::text
      FROM pg_catalog.pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) x
      WHERE d.datname=current_database()
    ORDER BY 1,2,3,5
  `, undefined, diagnostics)).rows;
}

async function verifyPhase1Revocations(client, diagnostics) {
  const tableViolations = await runLabeledCatalogQuery(client, 'catalog_phase1_table_acl_violations', `WITH principals AS (
      SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated')
    ), relation_grants AS (
      SELECT 'table'::text AS object_kind,c.relname AS object_name,x.grantee,x.privilege_type
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
      WHERE n.nspname='public' AND c.relname=ANY($1)
      UNION ALL
      SELECT 'column'::text,c.relname||'.'||a.attname,x.grantee,x.privilege_type
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      CROSS JOIN LATERAL aclexplode(a.attacl) x
      WHERE n.nspname='public' AND c.relname=ANY($1)
    ) SELECT object_kind,object_name,grantee::regrole::text AS grantee,privilege_type FROM relation_grants
      WHERE grantee IN (SELECT oid FROM principals) ORDER BY 1,2,3`, [TABLES], diagnostics);
  const triggerFunctionViolations = await runLabeledCatalogQuery(client, 'catalog_phase1_trigger_function_acl_violations', `SELECT x.grantee::regrole::text AS grantee,x.privilege_type
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
    WHERE n.nspname='public' AND p.proname='rf_guard_billing_entitlement_override_period'
      AND pg_get_function_identity_arguments(p.oid)='' AND x.privilege_type='EXECUTE'
      AND x.grantee IN (SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated'))`, undefined, diagnostics);
  const defaultPrivilegeViolations = await runLabeledCatalogQuery(client, 'catalog_phase1_default_privilege_violations', `SELECT pg_get_userbyid(d.defaclrole) AS creator_role,
      CASE WHEN d.defaclnamespace=0 THEN NULL ELSE n.nspname END AS schema_name,
      d.defaclobjtype AS object_code,x.grantee::regrole::text AS grantee,x.privilege_type
    FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) x
    WHERE pg_get_userbyid(d.defaclrole)='postgres' AND d.defaclobjtype IN ('r','S','f')
      AND (d.defaclnamespace=0 OR n.nspname='public')
      AND x.grantee IN (SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated'))
      ORDER BY 1,2,3,4,5`, undefined, diagnostics);
  return [
    ...tableViolations.rows,
    ...triggerFunctionViolations.rows.map((row) => ({ kind: 'trigger-function', ...row })),
    ...defaultPrivilegeViolations.rows.map((row) => ({ kind: 'default-privilege', ...row })),
  ];
}

async function captureSnapshotFile(snapshot, diagnostics) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = resolve(SNAPSHOT_DIR, `supabase-test-runtime-role-phase2-${stamp}-${randomUUID()}.json`);
    try {
      const handle = await open(path, 'wx');
      diagnostics.snapshotCreated = true;
      try {
        await handle.writeFile(`${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      return path;
    } catch (error) {
      if ((error && typeof error === 'object' && error.code === 'EEXIST') && attempt < 4) continue;
      stop('SNAPSHOT_WRITE_FAILED');
    }
  }
  stop('SNAPSHOT_NAME_COLLISION');
}

function stableJson(value) {
  return JSON.stringify(value, (_key, item) => item instanceof Date ? item.toISOString() : item);
}

function isExactRoleMembership(actual, expected) {
  return Boolean(actual && typeof actual === 'object' && !Array.isArray(actual) &&
    Object.keys(actual).length === ROLE_MEMBERSHIP_FIELDS.length &&
    ROLE_MEMBERSHIP_FIELDS.every((field) => actual[field] === expected[field]));
}

export function evaluateRuntimeConnectionPermissionState(row) {
  return {
    databaseConnect: row?.can_connect === true,
    publicSchemaUsage: row?.public_schema_usage === true,
    publicSchemaCreateDenied: row?.public_schema_create === false,
  };
}

async function verifyRuntimeConnectionPermissions(client, diagnostics) {
  const result = await runLabeledCatalogQuery(client, 'runtime_login_connection_permissions', `SELECT
    has_database_privilege($1,current_database(),'CONNECT') AS can_connect,
    has_schema_privilege($1,'public','USAGE') AS public_schema_usage,
    has_schema_privilege($1,'public','CREATE') AS public_schema_create`, [RUNTIME_LOGIN_ROLE], diagnostics);
  const state = evaluateRuntimeConnectionPermissionState(result.rows[0]);
  for (const [checkId, passed] of [
    ['EXISTING_LOGIN_DATABASE_CONNECT', state.databaseConnect],
    ['EXISTING_LOGIN_PUBLIC_SCHEMA_USAGE', state.publicSchemaUsage],
    ['EXISTING_LOGIN_PUBLIC_SCHEMA_NO_CREATE', state.publicSchemaCreateDenied],
  ]) {
    runPreflightCheck(diagnostics, checkId, () => ({ passed, actual: passed ? 'ALLOWED_AS_EXPECTED' : 'DENIED_OR_UNEXPECTED' }));
  }
}

export function inspectRuntimeRoleDesign(catalog) {
  const role = catalog.role ?? null;
  const loginRole = catalog.loginRole ?? null;
  const pairAbsent = !role && !loginRole;
  const pairComplete = Boolean(role && loginRole);
  const roleMemberships = catalog.roleMemberships ?? [];
  const roleOwnership = catalog.roleOwnership ?? [];
  const roleAclEntries = catalog.roleAclEntries ?? [];
  const platformMembershipCount = roleMemberships.filter((membership) =>
    SUPABASE_PLATFORM_ROLE_MEMBERSHIPS.some((expected) => isExactRoleMembership(membership, expected))).length;
  const applicationMembershipCount = roleMemberships.filter((membership) =>
    isExactRoleMembership(membership, APPLICATION_ROLE_MEMBERSHIP)).length;
  const unexpectedMembershipCount = roleMemberships.length - platformMembershipCount - applicationMembershipCount;
  const membershipMatches = pairAbsent
    ? roleMemberships.length === 0
    : pairComplete && platformMembershipCount === SUPABASE_PLATFORM_ROLE_MEMBERSHIPS.length &&
      applicationMembershipCount === 1 && unexpectedMembershipCount === 0;
  const expectedAcl = expectedRuntimeAclEntries(catalog.columns ?? []);
  const aclMatches = pairAbsent
    ? roleAclEntries.length === 0
    : pairComplete && (roleAclEntries.length === 0 || stableJson([...roleAclEntries].sort(compareAclEntries)) === stableJson(expectedAcl));
  const roleFlagsMatch = !role || Object.entries(REQUIRED_ROLE_FLAGS).every(([key, value]) => role[key] === value);
  const loginFlagsMatch = !loginRole || Object.entries(REQUIRED_LOGIN_ROLE_FLAGS).every(([key, value]) => loginRole[key] === value);
  const rolePropertiesMatch = [role, loginRole].every((item) => !item || (
    item.has_role_config === false && item.rolconnlimit === -1 && item.rolvaliduntil === null
  ));
  return {
    pairAbsent,
    pairComplete,
    roleFlagsMatch,
    loginFlagsMatch,
    rolePropertiesMatch,
    membershipMatches,
    platformMembershipCount,
    applicationMembershipCount,
    unexpectedMembershipCount,
    ownershipClear: roleOwnership.length === 0,
    aclMatches,
    roleMembershipCount: roleMemberships.length,
    ownershipCount: roleOwnership.length,
    aclCount: roleAclEntries.length,
    hasRole: Boolean(role),
    hasLoginRole: Boolean(loginRole),
  };
}

const POST_CHANGE_ROLE_DESIGN_PREDICATES = [
  'roleFlagsMatch', 'loginRoleFlagsMatch', 'rolePropertiesMatch', 'membershipMatches', 'ownershipClear',
];

export function buildPostChangeRoleDesignDiagnostic(catalog, design = inspectRuntimeRoleDesign(catalog)) {
  const role = catalog.role ?? null;
  const loginRole = catalog.loginRole ?? null;
  const memberships = Array.isArray(catalog.roleMemberships) ? catalog.roleMemberships : [];
  const predicateResults = {
    roleFlagsMatch: design.roleFlagsMatch,
    loginRoleFlagsMatch: design.loginFlagsMatch,
    rolePropertiesMatch: design.rolePropertiesMatch,
    membershipMatches: design.membershipMatches,
    ownershipClear: design.ownershipClear,
  };
  const roleFlags = (row) => Object.fromEntries(Object.keys(REQUIRED_ROLE_FLAGS).map((key) => [
    key,
    typeof row?.[key] === 'boolean' ? row[key] : null,
  ]));
  return {
    failedChecks: POST_CHANGE_ROLE_DESIGN_PREDICATES.filter((predicate) => !predicateResults[predicate]),
    observed: {
      roleFlags: roleFlags(role),
      loginRoleFlags: roleFlags(loginRole),
      roleProperties: {
        hasRoleConfig: typeof role?.has_role_config === 'boolean' ? role.has_role_config : null,
        connectionLimit: Number.isInteger(role?.rolconnlimit) ? role.rolconnlimit : null,
        hasExpiration: role ? role.rolvaliduntil !== null && role.rolvaliduntil !== undefined : null,
      },
      loginRoleProperties: {
        hasRoleConfig: typeof loginRole?.has_role_config === 'boolean' ? loginRole.has_role_config : null,
        connectionLimit: Number.isInteger(loginRole?.rolconnlimit) ? loginRole.rolconnlimit : null,
        hasExpiration: loginRole ? loginRole.rolvaliduntil !== null && loginRole.rolvaliduntil !== undefined : null,
      },
      membershipCount: memberships.length,
      memberships: predicateResults.membershipMatches ? [] : memberships.map((membership) => ({
        granted_role: membership?.granted_role,
        member_role: membership?.member_role,
        grantor_role: membership?.grantor_role,
        admin_option: membership?.admin_option,
        inherit_option: membership?.inherit_option,
        set_option: membership?.set_option,
      })),
      ownershipCount: Number.isInteger(design.ownershipCount) && design.ownershipCount >= 0 ? design.ownershipCount : null,
    },
  };
}

function assertRuntimeRoleIsSafe(catalog, beforeRoleAclEntries, diagnostics) {
  const design = inspectRuntimeRoleDesign({ ...catalog, roleAclEntries: beforeRoleAclEntries });
  runPreflightCheck(diagnostics, 'EXISTING_ROLE_PAIR_COMPLETE', () => ({
    passed: design.pairAbsent || design.pairComplete,
    actual: design.pairAbsent ? 'ABSENT' : design.pairComplete ? 'COMPLETE' : 'INCOMPLETE',
  }));
  for (const [checkId, passed, actual] of [
    ['EXISTING_ROLE_ATTRIBUTES_EXACT', design.roleFlagsMatch, design.hasRole ? (design.roleFlagsMatch ? 'MATCH' : 'MISMATCH') : 'ABSENT'],
    ['EXISTING_LOGIN_ROLE_ATTRIBUTES_EXACT', design.loginFlagsMatch, design.hasLoginRole ? (design.loginFlagsMatch ? 'MATCH' : 'MISMATCH') : 'ABSENT'],
    ['EXISTING_ROLE_PROPERTIES_EXACT', design.rolePropertiesMatch, design.pairAbsent || design.rolePropertiesMatch ? 'MATCH' : 'MISMATCH'],
    ['EXISTING_ROLE_MEMBERSHIP_EXACT', design.membershipMatches, design.roleMembershipCount],
    ['EXISTING_ROLE_NO_OWNERSHIP', design.ownershipClear, design.ownershipCount],
    ['EXISTING_ROLE_ACL_EXACT', design.aclMatches, design.aclCount === 0 ? 'EMPTY' : design.aclMatches ? 'MATCH' : 'MISMATCH'],
  ]) {
    runPreflightCheck(diagnostics, checkId, () => ({ passed, actual }));
  }
  return design.pairComplete;
}

export function expectedRuntimeAclEntries(columns = []) {
  const result = [];
  const add = (kind, table, column, privilege) => result.push({
    object_type: kind,
    object_name: `public.${table}`,
    column_name: column,
    grantee: RUNTIME_ROLE,
    privilege_type: privilege,
    is_grantable: false,
    grantor: EXPECTED_CURRENT_ROLE,
  });
  for (const table of TABLE_SELECT) add('relation', table, null, 'SELECT');
  for (const [table, names] of Object.entries(COLUMN_SELECT)) for (const name of names) add('column', table, name, 'SELECT');
  for (const [table, names] of Object.entries(INSERT_COLUMNS)) for (const name of names) add('column', table, name, 'INSERT');
  for (const [table, names] of Object.entries(UPDATE_COLUMNS)) for (const name of names) add('column', table, name, 'UPDATE');
  return result.sort(compareAclEntries);
}

function compareAclEntries(left, right) {
  return stableJson(left).localeCompare(stableJson(right));
}

const REQUIRED_BUILTIN_SIGNATURES = [
  { signature: 'pg_advisory_xact_lock(bigint)', resolveCheck: 'ADVISORY_XACT_LOCK_RESOLVED', executeCheck: 'ADVISORY_XACT_LOCK_PUBLIC_EXECUTE', roleExecuteCheck: 'EXISTING_ROLE_ADVISORY_XACT_LOCK_EXECUTE' },
  { signature: 'hashtextextended(text,bigint)', resolveCheck: 'HASH_TEXT_EXTENDED_RESOLVED', executeCheck: 'HASH_TEXT_EXTENDED_PUBLIC_EXECUTE', roleExecuteCheck: 'EXISTING_ROLE_HASH_TEXT_EXTENDED_EXECUTE' },
  { signature: 'gen_random_uuid()', resolveCheck: 'GEN_RANDOM_UUID_RESOLVED', executeCheck: 'GEN_RANDOM_UUID_PUBLIC_EXECUTE', roleExecuteCheck: 'EXISTING_ROLE_GEN_RANDOM_UUID_EXECUTE' },
];

function normalizeBuiltinSignature(signature) {
  return typeof signature === 'string'
    ? signature.replace(/^pg_catalog\./, '').replace(/\s*,\s*/g, ',')
    : null;
}

function rowsForBuiltin(rows, signature) {
  return rows.filter((row) => normalizeBuiltinSignature(row.signature) === signature);
}

const PROTECTED_ACL_FIELDS = [
  'object_type', 'object_name', 'column_name', 'grantee', 'privilege_type', 'is_grantable', 'grantor',
];

export function compareProtectedAcl(before, after) {
  const comparableRows = (rows) => rows
    .filter((row) => row.grantee !== RUNTIME_ROLE && row.grantor !== RUNTIME_ROLE)
    .map((row) => Object.fromEntries(PROTECTED_ACL_FIELDS.map((field) => [field, row[field] ?? null])))
    .sort((left, right) => {
      const leftKey = stableJson(left);
      const rightKey = stableJson(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
  const beforeRows = comparableRows(before);
  const afterRows = comparableRows(after);
  const beforeCounts = new Map();
  const afterCounts = new Map();
  for (const row of beforeRows) {
    const key = stableJson(row);
    beforeCounts.set(key, (beforeCounts.get(key) ?? 0) + 1);
  }
  for (const row of afterRows) {
    const key = stableJson(row);
    afterCounts.set(key, (afterCounts.get(key) ?? 0) + 1);
  }
  const differences = (rows, ownCounts, otherCounts) => rows.filter((row) => {
    const key = stableJson(row);
    const count = ownCounts.get(key) ?? 0;
    if (count <= 0) return false;
    ownCounts.set(key, count - 1);
    return count > (otherCounts.get(key) ?? 0);
  });
  const beforeOnly = differences(beforeRows, new Map(beforeCounts), afterCounts);
  const afterOnly = differences(afterRows, new Map(afterCounts), beforeCounts);
  return { matches: beforeOnly.length === 0 && afterOnly.length === 0, beforeOnly, afterOnly };
}

function assertProtectedAclUnchanged(before, after, diagnostics) {
  const comparison = compareProtectedAcl(before, after);
  if (comparison.matches) return;
  diagnostics.protectedAclDiff = comparison;
  stop('PROTECTED_ACL_CHANGED');
}

const STRUCTURAL_SECTIONS = {
  tables: { identity: ['relname'], fields: ['relname', 'relkind', 'owner', 'rls_enabled', 'force_rls'] },
  columns: { identity: ['table_name', 'column_name'], fields: ['table_name', 'column_name', 'data_type', 'not_null', 'default_expression', 'identity_kind', 'generated_kind'] },
  constraints: { identity: ['table_name', 'conname'], fields: ['table_name', 'conname', 'contype', 'definition', 'convalidated'] },
  indexes: { identity: ['schemaname', 'tablename', 'indexname'], fields: ['schemaname', 'tablename', 'indexname', 'indexdef'] },
  functions: { identity: ['signature'], fields: ['signature', 'proname', 'owner', 'acl', 'security_definer', 'definition_digest', 'public_execute'] },
  triggers: { identity: ['table_name', 'tgname'], fields: ['table_name', 'tgname', 'definition', 'tgenabled'] },
  sequences: { identity: ['relname'], fields: ['relname', 'owner', 'acl'] },
  defaultPrivileges: { identity: ['creator_role', 'schema_name', 'object_code'], fields: ['creator_role', 'schema_name', 'object_code', 'acl'] },
  publicSchemaAcl: { identity: ['nspname'], fields: ['nspname', 'owner', 'acl'] },
  databaseAcl: { identity: ['datname'], fields: ['datname', 'owner', 'acl'] },
};

export function compareStructuralState(before, after) {
  const tableShape = (rows) => rows.map(({ relname, relkind, owner, rls_enabled, force_rls }) => ({ relname, relkind, owner, rls_enabled, force_rls }));
  const structural = (catalog) => ({
    tables: tableShape(catalog.tables), columns: catalog.columns.map(({ acl: _acl, ...column }) => column), constraints: catalog.constraints,
    indexes: catalog.indexes, functions: catalog.functions, triggers: catalog.triggers,
    sequences: catalog.sequences, defaultPrivileges: catalog.defaultPrivileges,
    publicSchemaAcl: catalog.publicSchemaAcl, databaseAcl: catalog.databaseAcl,
  });
  const beforeState = structural(before);
  const afterState = structural(after);
  const changedSections = Object.keys(STRUCTURAL_SECTIONS).filter((section) =>
    stableJson(beforeState[section]) !== stableJson(afterState[section]));
  const entries = [];
  for (const section of changedSections) {
    const definition = STRUCTURAL_SECTIONS[section];
    const indexRows = (rows) => new Map(rows.map((row) => [
      stableJson(definition.identity.map((field) => row[field] ?? null)), row,
    ]));
    const beforeRows = indexRows(beforeState[section]);
    const afterRows = indexRows(afterState[section]);
    const identifiers = new Set([...beforeRows.keys(), ...afterRows.keys()]);
    for (const identifier of identifiers) {
      const beforeRow = beforeRows.get(identifier) ?? null;
      const afterRow = afterRows.get(identifier) ?? null;
      if (stableJson(beforeRow) === stableJson(afterRow)) continue;
      const changedFields = beforeRow && afterRow
        ? definition.fields.filter((field) => stableJson(beforeRow[field] ?? null) !== stableJson(afterRow[field] ?? null))
        : ['rowPresence'];
      entries.push({
        section,
        object: Object.fromEntries(definition.identity.map((field) => [field, (afterRow ?? beforeRow)?.[field] ?? null])),
        changedFields,
        ...(section === 'defaultPrivileges' ? { beforeAcl: beforeRow?.acl ?? null, afterAcl: afterRow?.acl ?? null } : {}),
      });
    }
  }
  return { matches: changedSections.length === 0, changedSections, entries };
}

function assertStructureUnchanged(before, after, diagnostics) {
  const comparison = compareStructuralState(before, after);
  if (comparison.matches) return;
  diagnostics.structuralStateDiff = comparison;
  stop('STRUCTURAL_OR_DEFAULT_PRIVILEGE_STATE_CHANGED');
}

async function verifyRuntimePrivileges(client, columns, expectedState = 'grants', diagnostics) {
  const columnState = await runLabeledCatalogQuery(client, 'runtime_privilege_columns', `SELECT c.relname,a.attname,
    has_table_privilege($1,c.oid,'SELECT') AS table_select,
    has_table_privilege($1,c.oid,'INSERT') AS table_insert,
    has_table_privilege($1,c.oid,'UPDATE') AS table_update,
    has_table_privilege($1,c.oid,'DELETE') AS table_delete,
    has_table_privilege($1,c.oid,'TRUNCATE') AS table_truncate,
    has_table_privilege($1,c.oid,'REFERENCES') AS table_references,
    has_table_privilege($1,c.oid,'TRIGGER') AS table_trigger,
    has_column_privilege($1,c.oid,a.attnum,'SELECT') AS column_select,
    has_column_privilege($1,c.oid,a.attnum,'INSERT') AS column_insert,
    has_column_privilege($1,c.oid,a.attnum,'UPDATE') AS column_update
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE n.nspname='public' AND c.relname=ANY($2) ORDER BY c.relname,a.attnum`, [RUNTIME_ROLE, TABLES], diagnostics);
  const wideSelect = new Set(TABLE_SELECT);
  let tableSelectMismatchCount = 0;
  let otherTablePrivilegeCount = 0;
  let columnSelectMismatchCount = 0;
  let columnInsertMismatchCount = 0;
  let columnUpdateMismatchCount = 0;
  for (const row of columnState.rows) {
    const shouldHaveGrants = expectedState === 'grants';
    const expectedTableSelect = shouldHaveGrants && wideSelect.has(row.relname);
    const expectedColumnSelect = shouldHaveGrants && (expectedTableSelect || (COLUMN_SELECT[row.relname] ?? []).includes(row.attname));
    const expectedInsert = shouldHaveGrants && (INSERT_COLUMNS[row.relname] ?? []).includes(row.attname);
    const expectedUpdate = shouldHaveGrants && (UPDATE_COLUMNS[row.relname] ?? []).includes(row.attname);
    if (row.table_select !== expectedTableSelect) tableSelectMismatchCount++;
    if (row.table_insert || row.table_update || row.table_delete || row.table_truncate || row.table_references || row.table_trigger) otherTablePrivilegeCount++;
    if (row.column_select !== expectedColumnSelect) columnSelectMismatchCount++;
    if (row.column_insert !== expectedInsert) columnInsertMismatchCount++;
    if (row.column_update !== expectedUpdate) columnUpdateMismatchCount++;
  }
  for (const [checkId, mismatchCount] of [
    ['EXISTING_ROLE_TABLE_SELECT', tableSelectMismatchCount],
    ['EXISTING_ROLE_TABLE_NO_OTHER_PRIVILEGES', otherTablePrivilegeCount],
    ['EXISTING_ROLE_COLUMN_SELECT', columnSelectMismatchCount],
    ['EXISTING_ROLE_COLUMN_INSERT', columnInsertMismatchCount],
    ['EXISTING_ROLE_COLUMN_UPDATE', columnUpdateMismatchCount],
  ]) {
    runPreflightCheck(diagnostics, checkId, () => ({ passed: mismatchCount === 0, actual: mismatchCount }));
  }
  const sequences = await runLabeledCatalogQuery(client, 'runtime_privilege_sequences', `SELECT c.relname,
    has_sequence_privilege($1,c.oid,'SELECT') AS can_select,
    has_sequence_privilege($1,c.oid,'USAGE') AS can_use,
    has_sequence_privilege($1,c.oid,'UPDATE') AS can_update
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='S' ORDER BY c.relname`, [RUNTIME_ROLE], diagnostics);
  const unexpectedSequencePrivilegeCount = sequences.rows.filter((row) => row.can_select || row.can_use || row.can_update).length;
  runPreflightCheck(diagnostics, 'EXISTING_ROLE_NO_SEQUENCE_PRIVILEGES', () => ({
    passed: unexpectedSequencePrivilegeCount === 0,
    actual: unexpectedSequencePrivilegeCount,
  }));
  const directFunctions = await runLabeledCatalogQuery(client, 'runtime_privilege_direct_functions', `SELECT p.oid::regprocedure::text AS signature,x.privilege_type
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
    WHERE n.nspname='public' AND x.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=$1)`, [RUNTIME_ROLE], diagnostics);
  runPreflightCheck(diagnostics, 'EXISTING_ROLE_NO_DIRECT_FUNCTION_PRIVILEGES', () => ({
    passed: directFunctions.rowCount === 0,
    actual: directFunctions.rowCount,
  }));
  const builtins = await runLabeledCatalogQuery(client, 'runtime_privilege_builtin_functions', `SELECT p.oid::regprocedure::text AS signature,
    has_function_privilege($1,p.oid,'EXECUTE') AS can_execute
    FROM pg_catalog.pg_proc p WHERE p.oid IN (
       to_regprocedure('pg_catalog.pg_advisory_xact_lock(bigint)'),
       to_regprocedure('pg_catalog.hashtextextended(text,bigint)'),
       to_regprocedure('pg_catalog.gen_random_uuid()')) ORDER BY 1`, [RUNTIME_ROLE], diagnostics);
  for (const builtin of REQUIRED_BUILTIN_SIGNATURES) {
    const matchingRows = rowsForBuiltin(builtins.rows, builtin.signature);
    runPreflightCheck(diagnostics, builtin.roleExecuteCheck, () => ({
      passed: builtins.rowCount === 3 && matchingRows.length === 1 && matchingRows[0].can_execute === true,
      actual: matchingRows.length === 1 ? matchingRows[0].can_execute : 'UNRESOLVED',
    }));
  }
  runPreflightCheck(diagnostics, 'EXISTING_ROLE_COLUMN_CATALOG_NONEMPTY', () => ({
    passed: columns.length > 0,
    actual: columns.length,
  }));
}

export function verifyCatalogBaseline(catalog, target, diagnostics) {
  const { identity } = catalog;
  const checks = [
    ['ROLE_MEMBERSHIP_OPTIONS_SUPPORTED', () => Number(identity.server_version_num) >= 160000],
    ['DATABASE_NAME', () => identity.database === EXPECTED_DATABASE],
    ['DATABASE_CURRENT_ROLE', () => identity.current_role === EXPECTED_CURRENT_ROLE],
    ['DATABASE_SESSION_ROLE', () => identity.session_role === EXPECTED_SESSION_ROLE],
    ['TARGET_DATABASE', () => target?.database === EXPECTED_DATABASE],
    ['TARGET_ADMIN_LOGIN', () => target?.user === EXPECTED_ADMIN_ROLE],
    ['TARGET_POOLER', () => target?.host === EXPECTED_POOLER_HOST],
    ['TARGET_PORT', () => target?.port === EXPECTED_POOLER_PORT],
    ['TLS_CERTIFICATE_VALIDATION', () => target?.ssl?.rejectUnauthorized === true],
    ['TLS_HOSTNAME_VERIFICATION', () => target?.ssl?.servername === target?.host],
    ['TLS_CA_PRESENT', () => Boolean(target?.ssl?.ca)],
  ];
  for (const [checkId, predicate] of checks) {
    runPreflightCheck(diagnostics, checkId, () => {
      const passed = predicate();
      return { passed, actual: passed };
    });
  }
  runPreflightCheck(diagnostics, 'TABLE_INVENTORY_COUNT', () => ({
    passed: catalog.tables.length === EXPECTED_COUNTS.tables,
    actual: catalog.tables.length,
  }));
  runPreflightCheck(diagnostics, 'TABLE_OWNERSHIP', () => {
    const mismatchCount = catalog.tables.filter((row) => row.owner !== EXPECTED_TABLE_OWNER).length;
    return { passed: mismatchCount === 0, actual: mismatchCount };
  });
  runPreflightCheck(diagnostics, 'TABLE_RLS_DISABLED', () => {
    const enabledCount = catalog.tables.filter((row) => row.rls_enabled !== false).length;
    return { passed: enabledCount === 0, actual: enabledCount };
  });
  runPreflightCheck(diagnostics, 'TABLE_FORCE_RLS_DISABLED', () => {
    const enabledCount = catalog.tables.filter((row) => row.force_rls !== false).length;
    return { passed: enabledCount === 0, actual: enabledCount };
  });
  for (const [checkId, rows, expected] of [
    ['CONSTRAINT_INVENTORY_COUNT', catalog.constraints, EXPECTED_COUNTS.constraints],
    ['INDEX_INVENTORY_COUNT', catalog.indexes, EXPECTED_COUNTS.indexes],
    ['FUNCTION_INVENTORY_COUNT', catalog.functions, EXPECTED_COUNTS.functions],
    ['TRIGGER_INVENTORY_COUNT', catalog.triggers, EXPECTED_COUNTS.triggers],
  ]) {
    runPreflightCheck(diagnostics, checkId, () => ({ passed: rows.length === expected, actual: rows.length }));
  }
  for (const [checkId, kind] of [
    ['PHASE1_TABLE_ACL_REVOKED', 'table'],
    ['PHASE1_COLUMN_ACL_REVOKED', 'column'],
    ['PHASE1_TRIGGER_FUNCTION_ACL_REVOKED', 'trigger-function'],
    ['PHASE1_DEFAULT_PRIVILEGES_REVOKED', 'default-privilege'],
  ]) {
    runPreflightCheck(diagnostics, checkId, () => {
      const violationCount = catalog.phase1Verification.filter((row) => row.kind === kind || row.object_kind === kind).length;
      return { passed: violationCount === 0, actual: violationCount };
    });
  }
  for (const builtin of REQUIRED_BUILTIN_SIGNATURES) {
    const matchingRows = rowsForBuiltin(catalog.requiredRuntimeFunctions, builtin.signature);
    runPreflightCheck(diagnostics, builtin.resolveCheck, () => ({
      passed: matchingRows.length === 1,
      actual: matchingRows.length === 1 ? 'RESOLVED' : 'UNRESOLVED',
    }));
    runPreflightCheck(diagnostics, builtin.executeCheck, () => ({
      passed: matchingRows.length === 1 && matchingRows[0].public_execute === true,
      actual: matchingRows.length === 1 ? matchingRows[0].public_execute : 'UNRESOLVED',
    }));
  }
}

export function createSnapshot(catalog, snapshotSql, target) {
  const rolePairExisted = Boolean(catalog.role && catalog.loginRole);
  const grantsAlreadyPresent = rolePairExisted && stableJson(
    [...catalog.roleAclEntries].sort(compareAclEntries),
  ) === stableJson(expectedRuntimeAclEntries(catalog.columns));
  return {
    snapshotVersion: 4,
    capturedAt: new Date().toISOString(),
    purpose: 'Secret-free Phase 2 pre-change catalog, ACL, and rollback snapshot',
    target: {
      projectRef: SUPABASE_TEST_PROJECT_REF_VALUE,
      database: catalog.identity.database,
      currentRole: catalog.identity.current_role,
      sessionRole: catalog.identity.session_role,
      adminLogin: EXPECTED_ADMIN_ROLE,
      host: target.host,
      port: target.port,
      strictTls: target.ssl.rejectUnauthorized,
      hostnameVerification: target.ssl.servername === target.host,
    },
    serverVersionNum: catalog.identity.server_version_num,
    roles: catalog.roles,
    memberships: catalog.memberships,
    roleStateBefore: catalog.role,
    loginRoleStateBefore: catalog.loginRole,
    roleMembershipsBefore: catalog.roleMemberships,
    roleOwnership: catalog.roleOwnership,
    roleAclEntries: catalog.roleAclEntries,
    tables: catalog.tables,
    columns: catalog.columns,
    constraints: catalog.constraints,
    indexes: catalog.indexes,
    functions: catalog.functions,
    triggers: catalog.triggers,
    sequences: catalog.sequences,
    defaultPrivileges: catalog.defaultPrivileges,
    publicSchemaAcl: catalog.publicSchemaAcl,
    databaseAcl: catalog.databaseAcl,
    protectedAcl: catalog.protectedAcl,
    phase1Verification: catalog.phase1Verification,
    requiredRuntimeFunctions: catalog.requiredRuntimeFunctions,
    unresolvedFindings: catalog.functions.some((fn) => fn.proname === 'rf_guard_billing_entitlement_override_period' && fn.public_execute)
      ? ['PUBLIC EXECUTE remains on rf_guard_billing_entitlement_override_period(); not changed in Phase 2.'] : [],
    inventoryCounts: {
      tables: catalog.tables.length, columns: catalog.columns.length, constraints: catalog.constraints.length,
      indexes: catalog.indexes.length, functions: catalog.functions.length, triggers: catalog.triggers.length,
      sequences: catalog.sequences.length, defaultPrivileges: catalog.defaultPrivileges.length,
    },
    preparedSqlStatements: snapshotSql,
    rollbackInformation: {
      roleExistedBefore: Boolean(catalog.role),
      loginRoleExistedBefore: Boolean(catalog.loginRole),
      rolePairExistedBefore: rolePairExisted,
      grantsAlreadyPresent,
      statements: expectedRollbackSql(rolePairExisted, grantsAlreadyPresent),
    },
  };
}

async function runPhase2(pool, diagnostics, target) {
  let client;
  let transactionIsOpen = false;
  let discardClient = false;
  let failure;
  let snapshotPath;
  try {
    diagnostics.currentStage = 'DATABASE_CONNECTION';
    client = await pool.connect();
    recordConnectionLifecycleEvent(diagnostics, 'client_checked_out', client);
    client.on('error', (error) => {
      recordClientConnectionFailure(diagnostics, error);
      recordConnectionLifecycleEvent(diagnostics, 'client_error', client);
      discardClient = true;
      diagnostics.clientDiscarded = true;
    });
    client.on('end', () => recordConnectionLifecycleEvent(diagnostics, 'client_end', client));
    diagnostics.databaseConnectionEstablished = true;

    diagnostics.currentStage = 'TRANSACTION_BEGIN';
    await client.query('BEGIN');
    diagnostics.transactionOpened = true;
    transactionIsOpen = true;
    diagnostics.transactionOutcome = 'OPEN';

    diagnostics.currentStage = 'CATALOG_CAPTURE';
    const before = await captureCatalog(client, diagnostics);

    diagnostics.currentStage = 'PREFLIGHT_VALIDATION';
    verifyCatalogBaseline(before, target, diagnostics);
    const roleExisted = assertRuntimeRoleIsSafe(before, before.roleAclEntries, diagnostics);
    const grantsAlreadyPresent = roleExisted && before.roleAclEntries.length > 0;
    if (roleExisted) {
      await verifyRuntimeConnectionPermissions(client, diagnostics);
      const expectedAcl = expectedRuntimeAclEntries(before.columns);
      const hasExpectedExistingAcl = stableJson([...before.roleAclEntries].sort(compareAclEntries)) === stableJson(expectedAcl);
      await verifyRuntimePrivileges(client, before.columns, hasExpectedExistingAcl ? 'grants' : 'none', diagnostics);
    } else {
      runPreflightCheck(diagnostics, 'LOGIN_DATABASE_SCHEMA_CHECK_DEFERRED', () => ({ passed: true, actual: 'ABSENT_UNTIL_ROLE_CREATION' }));
    }

    diagnostics.currentStage = 'SNAPSHOT_CREATION';
    const sqlText = await readFile(resolve(PROJECT_ROOT, 'security/supabase-test-runtime-role-phase2.sql'), 'utf8');
    const statements = parseAndValidateSql(sqlText, diagnostics);
    const snapshot = createSnapshot(before, statements, target);
    assertSnapshotComplete(snapshot, target, diagnostics);
    snapshotPath = await captureSnapshotFile(snapshot, diagnostics);

    diagnostics.currentStage = 'SNAPSHOT_READBACK';
    const readBack = JSON.parse(await readFile(snapshotPath, 'utf8'));
    assertSnapshotComplete(readBack, target, diagnostics);
    if (stableJson(snapshot) !== stableJson(readBack)) stop('SNAPSHOT_READBACK_MISMATCH');

    if (process.argv.includes('--snapshot-only')) {
      if (!await rollbackPhase2Transaction(client, diagnostics)) {
        discardClient = true;
        diagnostics.clientDiscarded = true;
        throw Object.assign(new Error('Phase 2 rollback was not confirmed.'), { safeCode: 'ROLLBACK_FAILED' });
      }
      transactionIsOpen = false;
      return snapshotPath;
    }

    const sqlToApply = grantsAlreadyPresent ? '' : roleExisted
      ? statements.filter((statement) => /^GRANT\s/i.test(statement)).join(';\n')
      : sqlText;
    if (sqlToApply) {
      diagnostics.currentStage = 'SQL_MODIFICATION';
      diagnostics.sqlModificationAttempted = true;
      await client.query(sqlToApply);
    }

    diagnostics.currentStage = 'POST_CHANGE_VERIFICATION';
    const after = await captureCatalog(client, diagnostics);
    if (!after.role || !after.loginRole) stop('RUNTIME_ROLE_PAIR_MISSING_AFTER_SQL');
    const postRoleDesign = inspectRuntimeRoleDesign(after);
    const roleDesignDiagnostic = buildPostChangeRoleDesignDiagnostic(after, postRoleDesign);
    if (!postRoleDesign.pairComplete || roleDesignDiagnostic.failedChecks.length > 0) {
      diagnostics.postChangeRoleDesign = roleDesignDiagnostic;
      stop('RUNTIME_ROLE_DESIGN_INVALID_AFTER_SQL');
    }
    const expectedAcl = expectedRuntimeAclEntries(after.columns);
    if (stableJson([...after.roleAclEntries].sort(compareAclEntries)) !== stableJson(expectedAcl)) stop('RUNTIME_ROLE_ACL_NOT_EXACT');
    await verifyRuntimeConnectionPermissions(client, diagnostics);
    await verifyRuntimePrivileges(client, after.columns, 'grants', diagnostics);
    verifyCatalogBaseline(after, target, diagnostics);
    assertProtectedAclUnchanged(before.protectedAcl, after.protectedAcl, diagnostics);
    assertStructureUnchanged(before, after, diagnostics);
    if (after.phase1Verification.length) stop('PHASE1_REVOCATION_CHANGED');

    diagnostics.currentStage = 'COMMIT';
    await client.query('COMMIT');
    transactionIsOpen = false;
    diagnostics.transactionCommitted = true;
    diagnostics.transactionOutcome = 'COMMITTED';
  } catch (error) {
    if (!client && diagnostics.currentStage === 'DATABASE_CONNECTION') {
      recordClientConnectionFailure(diagnostics, error);
    }
    failure = error;
    if (transactionIsOpen && !diagnostics.rollbackAttempted) {
      const rollbackSucceeded = await rollbackPhase2Transaction(client, diagnostics);
      if (rollbackSucceeded) {
        transactionIsOpen = false;
        if (diagnostics.currentStage === 'COMMIT') {
          // A failed COMMIT response leaves the server outcome ambiguous.
          diagnostics.rollbackSucceeded = false;
          diagnostics.transactionOutcome = 'UNKNOWN';
        }
      } else {
        discardClient = true;
        diagnostics.clientDiscarded = true;
      }
    }
  } finally {
    if (client) {
      try {
        client.release(discardClient ? true : undefined);
        diagnostics.clientReleased = true;
        recordConnectionLifecycleEvent(diagnostics, 'client_released', client);
      } catch {
        if (!failure) failure = Object.assign(new Error(), { safeCode: 'CLIENT_RELEASE_FAILED' });
      }
    }
  }
  if (failure) throw failure;
  return snapshotPath;
}

export const RUNTIME_MEMBERSHIP_INSPECTION_SQL = `SELECT granted.rolname AS granted_role, member.rolname AS member_role,
  grantor.rolname AS grantor_role, m.admin_option, m.inherit_option, m.set_option
  FROM pg_catalog.pg_auth_members AS m
  JOIN pg_catalog.pg_roles AS granted ON granted.oid=m.roleid
  JOIN pg_catalog.pg_roles AS member ON member.oid=m.member
  JOIN pg_catalog.pg_roles AS grantor ON grantor.oid=m.grantor
  WHERE granted.rolname=ANY($1::pg_catalog.name[]) OR member.rolname=ANY($1::pg_catalog.name[])
  ORDER BY granted.rolname,member.rolname,grantor.rolname`;

export async function inspectRuntimeMembershipsReadOnly(pool, diagnostics) {
  let client;
  let transactionIsOpen = false;
  let discardClient = false;
  let failure;
  let rows = [];
  try {
    diagnostics.currentStage = 'DATABASE_CONNECTION';
    client = await pool.connect();
    recordConnectionLifecycleEvent(diagnostics, 'client_checked_out', client);
    client.on('error', (error) => {
      recordClientConnectionFailure(diagnostics, error);
      recordConnectionLifecycleEvent(diagnostics, 'client_error', client);
      discardClient = true;
      diagnostics.clientDiscarded = true;
    });
    client.on('end', () => recordConnectionLifecycleEvent(diagnostics, 'client_end', client));
    diagnostics.databaseConnectionEstablished = true;

    diagnostics.currentStage = 'TRANSACTION_BEGIN';
    await client.query('BEGIN READ ONLY');
    diagnostics.transactionOpened = true;
    transactionIsOpen = true;
    diagnostics.transactionOutcome = 'OPEN';

    diagnostics.currentStage = 'READ_ONLY_MEMBERSHIP_INSPECTION';
    const result = await client.query(RUNTIME_MEMBERSHIP_INSPECTION_SQL, [[RUNTIME_ROLE, RUNTIME_LOGIN_ROLE]]);
    rows = result.rows.map((row) => ({
      granted_role: row.granted_role,
      member_role: row.member_role,
      grantor_role: row.grantor_role,
      admin_option: row.admin_option,
      inherit_option: row.inherit_option,
      set_option: row.set_option,
    }));

    await client.query('COMMIT');
    transactionIsOpen = false;
    diagnostics.transactionCommitted = true;
    diagnostics.transactionOutcome = 'COMMITTED';
  } catch (error) {
    if (!client && diagnostics.currentStage === 'DATABASE_CONNECTION') recordClientConnectionFailure(diagnostics, error);
    failure = error;
    if (transactionIsOpen && !diagnostics.rollbackAttempted) {
      if (await rollbackPhase2Transaction(client, diagnostics)) {
        transactionIsOpen = false;
      } else {
        discardClient = true;
        diagnostics.clientDiscarded = true;
      }
    }
  } finally {
    if (client) {
      try {
        client.release(discardClient ? true : undefined);
        diagnostics.clientReleased = true;
        recordConnectionLifecycleEvent(diagnostics, 'client_released', client);
      } catch {
        if (!failure) failure = Object.assign(new Error(), { safeCode: 'CLIENT_RELEASE_FAILED' });
      }
    }
  }
  if (failure) throw failure;
  return rows;
}

export async function dispatchPhase2Command(mode, handlers) {
  if (mode === INSPECT_RUNTIME_MEMBERSHIPS_MODE) {
    return { mode, membershipRows: await handlers.inspectRuntimeMembershipsOnly() };
  }
  return { mode: 'phase2', snapshotPath: await handlers.runPhase2() };
}

async function runPhase2Cli() {
  const diagnostics = createPhase2DiagnosticState();
  let pool;
  let target;
  let failure;
  let snapshotPath;
  let membershipRows;
  let commandMode = 'phase2';
  let snapshotOnly = false;
  try {
    diagnostics.currentStage = 'ENV_LOADING';
    const dedicatedConfig = {
      SUPABASE_TEST_DATABASE_URL: process.env.SUPABASE_TEST_DATABASE_URL,
      SUPABASE_TEST_CA_CERT: process.env.SUPABASE_TEST_CA_CERT,
    };
    try {
      const envText = await readFile(resolve(PROJECT_ROOT, '.env'), 'utf8');
      const parsed = dotenv.parse(envText);
      dedicatedConfig.SUPABASE_TEST_DATABASE_URL ??= parsed.SUPABASE_TEST_DATABASE_URL;
      dedicatedConfig.SUPABASE_TEST_CA_CERT ??= parsed.SUPABASE_TEST_CA_CERT;
    } catch (error) {
      if (error?.code !== 'ENOENT') stop('SUPABASE_TEST_CONFIG_FILE_READ_FAILED');
    }

    diagnostics.currentStage = 'TARGET_VALIDATION';
    try {
      // Deliberately load only dedicated Supabase test settings; never inspect DATABASE_URL.
      target = validateSupabaseTestingDatabaseTarget(dedicatedConfig, PROJECT_ROOT);
    } catch (error) {
      const message = error && typeof error === 'object' && typeof error.message === 'string' ? error.message : '';
      if (message.startsWith('SUPABASE_TEST_CA_CERT')) diagnostics.currentStage = 'TLS_VALIDATION';
      throw error;
    }
    // The target validator validates the CA and strict TLS options before returning.
    diagnostics.currentStage = 'TLS_VALIDATION';

    diagnostics.currentStage = 'POOL_CREATION';
    pool = new Pool({
      host: target.host,
      port: target.port,
      user: target.user,
      password: target.password,
      database: target.database,
      ssl: target.ssl,
      max: 1,
      connectionTimeoutMillis: 15_000,
      // Let PostgreSQL cancel timed-out statements and return SQLSTATE 57014;
      // a client-side query timeout can reject early while the server query runs.
      statement_timeout: 20_000,
    });

    commandMode = process.argv.includes('--inspect-runtime-memberships-only')
      ? INSPECT_RUNTIME_MEMBERSHIPS_MODE
      : 'phase2';
    snapshotOnly = commandMode === 'phase2' && process.argv.includes('--snapshot-only');
    const result = await dispatchPhase2Command(commandMode, {
      inspectRuntimeMembershipsOnly: () => inspectRuntimeMembershipsReadOnly(pool, diagnostics),
      runPhase2: () => runPhase2(pool, diagnostics, target),
    });
    snapshotPath = result.snapshotPath;
    membershipRows = result.membershipRows;
  } catch (error) {
    failure = error;
  } finally {
    if (pool) {
      try {
        await pool.end();
        diagnostics.poolClosed = true;
        recordConnectionLifecycleEvent(diagnostics, 'pool_closed');
      } catch {
        if (!failure) failure = Object.assign(new Error(), { safeCode: 'POOL_CLOSE_FAILED' });
      }
    }
  }

  if (failure) {
    process.stderr.write(`${formatPhase2FailureDiagnostic(diagnostics, failure)}\n`);
    process.exitCode = 1;
    return;
  }
  if (commandMode === INSPECT_RUNTIME_MEMBERSHIPS_MODE) {
    process.stdout.write(`${JSON.stringify(membershipRows, null, 2)}\n`);
    return;
  }
  if (snapshotOnly) {
    process.stdout.write(`Verified secret-free snapshot: ${snapshotPath}\n`);
  } else {
    process.stdout.write(`Phase 2 transaction verified and committed on the isolated Supabase test target. Snapshot: ${snapshotPath}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runPhase2Cli();
}
