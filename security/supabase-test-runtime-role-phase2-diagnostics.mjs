export const PHASE2_EXECUTION_STAGES = Object.freeze([
  'ENV_LOADING',
  'TARGET_VALIDATION',
  'TLS_VALIDATION',
  'POOL_CREATION',
  'DATABASE_CONNECTION',
  'TRANSACTION_BEGIN',
  'READ_ONLY_MEMBERSHIP_INSPECTION',
  'CATALOG_CAPTURE',
  'PREFLIGHT_VALIDATION',
  'SNAPSHOT_CREATION',
  'SNAPSHOT_READBACK',
  'SQL_MODIFICATION',
  'POST_CHANGE_VERIFICATION',
  'COMMIT',
]);

export const CATALOG_QUERY_LABELS = Object.freeze([
  'catalog_identity',
  'catalog_roles',
  'catalog_role_memberships',
  'catalog_tables',
  'catalog_columns',
  'catalog_constraints',
  'catalog_indexes',
  'catalog_functions',
  'catalog_triggers',
  'catalog_sequences',
  'catalog_default_privileges',
  'catalog_public_schema_acl',
  'catalog_database_acl',
  'catalog_runtime_role_ownership',
  'catalog_runtime_role_acl_entries',
  'catalog_protected_acl',
  'catalog_phase1_table_acl_violations',
  'catalog_phase1_trigger_function_acl_violations',
  'catalog_phase1_default_privilege_violations',
  'catalog_required_runtime_functions',
  'runtime_privilege_columns',
  'runtime_login_connection_permissions',
  'runtime_privilege_sequences',
  'runtime_privilege_direct_functions',
  'runtime_privilege_builtin_functions',
]);

const PREFLIGHT_SHARED = Object.freeze({
  IDENTITY: 'DATABASE_IDENTITY_OR_TLS_MISMATCH',
  TABLES: 'TABLE_OWNERSHIP_OR_RLS_BASELINE_MISMATCH',
  STRUCTURE: 'STRUCTURAL_BASELINE_MISMATCH',
  PHASE1: 'PHASE1_REVOCATION_MISMATCH',
  BUILTINS: 'REQUIRED_BUILTIN_PUBLIC_EXECUTE_NOT_AVAILABLE',
  ROLE_ATTRIBUTES: 'EXISTING_ROLE_ATTRIBUTES_UNEXPECTED',
  ROLE_MEMBERSHIP: 'EXISTING_ROLE_MEMBERSHIP_FOUND',
  ROLE_OWNERSHIP: 'EXISTING_ROLE_OWNERSHIP_FOUND',
  ROLE_ACL: 'EXISTING_ROLE_ACL_UNEXPECTED',
  ROLE_PRIVILEGES: 'RUNTIME_TABLE_OR_COLUMN_PRIVILEGE_MISMATCH',
  ROLE_DATABASE_SCHEMA: 'RUNTIME_DATABASE_SCHEMA_PERMISSION_MISMATCH',
  ROLE_SEQUENCE: 'UNEXPECTED_RUNTIME_SEQUENCE_PRIVILEGE',
  ROLE_FUNCTION: 'UNEXPECTED_RUNTIME_FUNCTION_GRANT',
  ROLE_BUILTINS: 'RUNTIME_BUILTIN_FUNCTION_NOT_EXECUTABLE',
  ROLE_COLUMNS: 'RUNTIME_COLUMN_CATALOG_EMPTY',
  SQL_ALLOWLIST: 'PREPARED_SQL_NOT_ALLOWLISTED',
  SQL_GRANT: 'PROHIBITED_GRANT_IN_SQL',
  SQL_EQUIPMENT: 'UNEXPECTED_EQUIPMENT_UPDATE_GRANT',
});

export const PREFLIGHT_CHECK_DEFINITIONS = Object.freeze({
  ROLE_MEMBERSHIP_OPTIONS_SUPPORTED: { errorCode: 'ROLE_MEMBERSHIP_OPTIONS_UNSUPPORTED', expected: 'PostgreSQL 16 or newer supports explicit role membership INHERIT and SET options' },
  DATABASE_NAME: { errorCode: PREFLIGHT_SHARED.IDENTITY, expected: 'expected database identity' },
  DATABASE_CURRENT_ROLE: { errorCode: PREFLIGHT_SHARED.IDENTITY, expected: 'current role matches approved test administrator' },
  DATABASE_SESSION_ROLE: { errorCode: PREFLIGHT_SHARED.IDENTITY, expected: 'session role matches approved test administrator' },
  TARGET_DATABASE: { errorCode: PREFLIGHT_SHARED.IDENTITY, expected: 'target database is the approved test database' },
  TARGET_ADMIN_LOGIN: { errorCode: PREFLIGHT_SHARED.IDENTITY, expected: 'target login matches approved test administrator' },
  TARGET_POOLER: { errorCode: PREFLIGHT_SHARED.IDENTITY, expected: 'target is the approved test pooler' },
  TARGET_PORT: { errorCode: PREFLIGHT_SHARED.IDENTITY, expected: 'target port is approved session port' },
  TLS_CERTIFICATE_VALIDATION: { errorCode: PREFLIGHT_SHARED.IDENTITY, expected: 'certificate validation is enabled' },
  TLS_HOSTNAME_VERIFICATION: { errorCode: PREFLIGHT_SHARED.IDENTITY, expected: 'TLS hostname verification matches target' },
  TLS_CA_PRESENT: { errorCode: PREFLIGHT_SHARED.IDENTITY, expected: 'validated CA certificate is present' },
  TABLE_INVENTORY_COUNT: { errorCode: PREFLIGHT_SHARED.TABLES, expected: 'target table count matches reviewed baseline' },
  TABLE_OWNERSHIP: { errorCode: PREFLIGHT_SHARED.TABLES, expected: 'all target tables have expected owner' },
  TABLE_RLS_DISABLED: { errorCode: PREFLIGHT_SHARED.TABLES, expected: 'RLS is disabled on all target tables' },
  TABLE_FORCE_RLS_DISABLED: { errorCode: PREFLIGHT_SHARED.TABLES, expected: 'FORCE RLS is disabled on all target tables' },
  CONSTRAINT_INVENTORY_COUNT: { errorCode: PREFLIGHT_SHARED.STRUCTURE, expected: 'constraint count matches reviewed baseline' },
  INDEX_INVENTORY_COUNT: { errorCode: PREFLIGHT_SHARED.STRUCTURE, expected: 'index count matches reviewed baseline' },
  FUNCTION_INVENTORY_COUNT: { errorCode: PREFLIGHT_SHARED.STRUCTURE, expected: 'application function count matches reviewed baseline' },
  TRIGGER_INVENTORY_COUNT: { errorCode: PREFLIGHT_SHARED.STRUCTURE, expected: 'trigger count matches reviewed baseline' },
  PHASE1_TABLE_ACL_REVOKED: { errorCode: PREFLIGHT_SHARED.PHASE1, expected: 'no Phase 1 table ACL violations' },
  PHASE1_COLUMN_ACL_REVOKED: { errorCode: PREFLIGHT_SHARED.PHASE1, expected: 'no Phase 1 column ACL violations' },
  PHASE1_TRIGGER_FUNCTION_ACL_REVOKED: { errorCode: PREFLIGHT_SHARED.PHASE1, expected: 'no Phase 1 trigger-function EXECUTE violations' },
  PHASE1_DEFAULT_PRIVILEGES_REVOKED: { errorCode: PREFLIGHT_SHARED.PHASE1, expected: 'no Phase 1 default-privilege violations' },
  ADVISORY_XACT_LOCK_RESOLVED: { errorCode: PREFLIGHT_SHARED.BUILTINS, expected: 'pg_advisory_xact_lock(bigint) resolves in pg_catalog' },
  ADVISORY_XACT_LOCK_PUBLIC_EXECUTE: { errorCode: PREFLIGHT_SHARED.BUILTINS, expected: 'pg_advisory_xact_lock(bigint) is executable by PUBLIC' },
  HASH_TEXT_EXTENDED_RESOLVED: { errorCode: PREFLIGHT_SHARED.BUILTINS, expected: 'hashtextextended(text,bigint) resolves in pg_catalog' },
  HASH_TEXT_EXTENDED_PUBLIC_EXECUTE: { errorCode: PREFLIGHT_SHARED.BUILTINS, expected: 'hashtextextended(text,bigint) is executable by PUBLIC' },
  GEN_RANDOM_UUID_RESOLVED: { errorCode: PREFLIGHT_SHARED.BUILTINS, expected: 'gen_random_uuid() resolves in pg_catalog' },
  GEN_RANDOM_UUID_PUBLIC_EXECUTE: { errorCode: PREFLIGHT_SHARED.BUILTINS, expected: 'gen_random_uuid() is executable by PUBLIC' },
  EXISTING_ROLE_PAIR_COMPLETE: { errorCode: PREFLIGHT_SHARED.ROLE_ATTRIBUTES, expected: 'both runtime roles are absent or both are present' },
  EXISTING_ROLE_ATTRIBUTES_EXACT: { errorCode: PREFLIGHT_SHARED.ROLE_ATTRIBUTES, expected: 'privilege role is NOLOGIN, INHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, and NOBYPASSRLS' },
  EXISTING_LOGIN_ROLE_ATTRIBUTES_EXACT: { errorCode: PREFLIGHT_SHARED.ROLE_ATTRIBUTES, expected: 'login role has LOGIN, INHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, and NOBYPASSRLS' },
  EXISTING_ROLE_PROPERTIES_EXACT: { errorCode: PREFLIGHT_SHARED.ROLE_ATTRIBUTES, expected: 'both runtime roles have no role settings or expiration and default connection limits' },
  EXISTING_ROLE_MEMBERSHIP_EXACT: { errorCode: PREFLIGHT_SHARED.ROLE_MEMBERSHIP, expected: 'only runtime login inherits runtime privilege with SET and ADMIN disabled' },
  EXISTING_ROLE_NO_OWNERSHIP: { errorCode: PREFLIGHT_SHARED.ROLE_OWNERSHIP, expected: 'neither runtime role owns database objects' },
  EXISTING_ROLE_ACL_EXACT: { errorCode: PREFLIGHT_SHARED.ROLE_ACL, expected: 'privilege role ACL is empty or exactly matches reviewed grants and login has no direct ACLs' },
  EXISTING_ROLE_TABLE_SELECT: { errorCode: PREFLIGHT_SHARED.ROLE_PRIVILEGES, expected: 'table SELECT privileges exactly match reviewed grants' },
  EXISTING_ROLE_TABLE_NO_OTHER_PRIVILEGES: { errorCode: PREFLIGHT_SHARED.ROLE_PRIVILEGES, expected: 'no unexpected table-level privileges' },
  EXISTING_ROLE_COLUMN_SELECT: { errorCode: PREFLIGHT_SHARED.ROLE_PRIVILEGES, expected: 'column SELECT privileges exactly match reviewed grants' },
  EXISTING_ROLE_COLUMN_INSERT: { errorCode: PREFLIGHT_SHARED.ROLE_PRIVILEGES, expected: 'column INSERT privileges exactly match reviewed grants' },
  EXISTING_ROLE_COLUMN_UPDATE: { errorCode: PREFLIGHT_SHARED.ROLE_PRIVILEGES, expected: 'column UPDATE privileges exactly match reviewed grants' },
  EXISTING_LOGIN_DATABASE_CONNECT: { errorCode: PREFLIGHT_SHARED.ROLE_DATABASE_SCHEMA, expected: 'rentflow_runtime_login has effective CONNECT on the target database' },
  EXISTING_LOGIN_PUBLIC_SCHEMA_USAGE: { errorCode: PREFLIGHT_SHARED.ROLE_DATABASE_SCHEMA, expected: 'rentflow_runtime_login has effective USAGE on the public schema' },
  EXISTING_LOGIN_PUBLIC_SCHEMA_NO_CREATE: { errorCode: PREFLIGHT_SHARED.ROLE_DATABASE_SCHEMA, expected: 'rentflow_runtime_login has no effective CREATE privilege on the public schema' },
  LOGIN_DATABASE_SCHEMA_CHECK_DEFERRED: { errorCode: PREFLIGHT_SHARED.ROLE_DATABASE_SCHEMA, expected: 'effective login permissions are checked after the absent role pair is created and before application readiness' },
  EXISTING_ROLE_NO_SEQUENCE_PRIVILEGES: { errorCode: PREFLIGHT_SHARED.ROLE_SEQUENCE, expected: 'no sequence SELECT, USAGE, or UPDATE privileges' },
  EXISTING_ROLE_NO_DIRECT_FUNCTION_PRIVILEGES: { errorCode: PREFLIGHT_SHARED.ROLE_FUNCTION, expected: 'no direct function privileges' },
  EXISTING_ROLE_ADVISORY_XACT_LOCK_EXECUTE: { errorCode: PREFLIGHT_SHARED.ROLE_BUILTINS, expected: 'pg_advisory_xact_lock(bigint) is executable by role' },
  EXISTING_ROLE_HASH_TEXT_EXTENDED_EXECUTE: { errorCode: PREFLIGHT_SHARED.ROLE_BUILTINS, expected: 'hashtextextended(text,bigint) is executable by role' },
  EXISTING_ROLE_GEN_RANDOM_UUID_EXECUTE: { errorCode: PREFLIGHT_SHARED.ROLE_BUILTINS, expected: 'gen_random_uuid() is executable by role' },
  EXISTING_ROLE_COLUMN_CATALOG_NONEMPTY: { errorCode: PREFLIGHT_SHARED.ROLE_COLUMNS, expected: 'target column catalog is nonempty' },
  PREPARED_SQL_ALLOWLIST_MATCH: { errorCode: PREFLIGHT_SHARED.SQL_ALLOWLIST, expected: 'prepared statements exactly match reviewed allowlist' },
  PREPARED_SQL_NO_PROHIBITED_GRANTS: { errorCode: PREFLIGHT_SHARED.SQL_GRANT, expected: 'prepared SQL contains no prohibited grant type' },
  PREPARED_SQL_NO_UNEXPECTED_EQUIPMENT_UPDATE: { errorCode: PREFLIGHT_SHARED.SQL_EQUIPMENT, expected: 'prepared SQL contains no equipment active UPDATE grant' },
  SNAPSHOT_VERSION_SUPPORTED: { errorCode: 'SNAPSHOT_VERSION_UNSUPPORTED', expected: 'snapshot uses the current version 4 schema' },
  SNAPSHOT_REQUIRED_SECTIONS: { errorCode: 'SNAPSHOT_SECTION_MISSING', expected: 'required snapshot sections and target metadata are complete' },
  SNAPSHOT_INVENTORY_COUNTS: { errorCode: 'SNAPSHOT_INVENTORY_MISMATCH', expected: 'snapshot inventory counts match reviewed baseline' },
  SNAPSHOT_ARRAY_COUNTS: { errorCode: 'SNAPSHOT_ARRAY_COUNT_MISMATCH', expected: 'required snapshot array counts match reviewed baseline' },
  SNAPSHOT_PREPARED_SQL_MATCH: { errorCode: 'SNAPSHOT_SQL_MISMATCH', expected: 'snapshot prepared SQL matches the current approved statements in exact order' },
  SNAPSHOT_ROLE_STATE_AND_ROLLBACK_MATCH: { errorCode: 'SNAPSHOT_ROLLBACK_MISMATCH', expected: 'role pre-state and rollback statements exactly match the current operation and initial ACL state' },
  SNAPSHOT_SECTION_COMPLETENESS: { errorCode: 'SNAPSHOT_SECTION_INCOMPLETE', expected: 'snapshot supporting sections and counts are complete' },
  SNAPSHOT_NO_CREDENTIAL_FIELDS: { errorCode: 'SNAPSHOT_CONTAINS_CREDENTIAL_FIELD', expected: 'role snapshot contains no credential fields' },
  SNAPSHOT_NO_SECRET_FIELDS: { errorCode: 'SNAPSHOT_CONTAINS_SECRET_FIELD', expected: 'snapshot contains no secret-named fields' },
  SNAPSHOT_ROLLBACK_NO_GRANTS: { errorCode: 'SNAPSHOT_ROLLBACK_INVALID', expected: 'ordered rollback statements contain no GRANT statement' },
  PREFLIGHT_UNEXPECTED_EXCEPTION: { errorCode: 'PREFLIGHT_UNEXPECTED_EXCEPTION', expected: 'preflight completes without a programming exception' },
});

const SAFE_ACTUAL_STATUSES = new Set([
  'MATCH', 'MISMATCH', 'ABSENT', 'PRESENT', 'NULL', 'SET', 'RESOLVED', 'UNRESOLVED',
  'EMPTY', 'NONEMPTY', 'AVAILABLE', 'UNAVAILABLE', 'COMPLETE', 'INCOMPLETE', 'CURRENT', 'UNSUPPORTED', 'UNEXPECTED_EXCEPTION',
]);
const EXPLICIT_VALIDATION_CHECKS = new Set([
  'TABLE_INVENTORY_COUNT', 'CONSTRAINT_INVENTORY_COUNT', 'INDEX_INVENTORY_COUNT',
  'FUNCTION_INVENTORY_COUNT', 'TRIGGER_INVENTORY_COUNT', 'ADVISORY_XACT_LOCK_RESOLVED',
  'HASH_TEXT_EXTENDED_RESOLVED', 'GEN_RANDOM_UUID_RESOLVED', 'PREPARED_SQL_ALLOWLIST_MATCH',
  'PREPARED_SQL_NO_PROHIBITED_GRANTS', 'PREPARED_SQL_NO_UNEXPECTED_EQUIPMENT_UPDATE',
  'SNAPSHOT_REQUIRED_SECTIONS', 'SNAPSHOT_INVENTORY_COUNTS', 'SNAPSHOT_ARRAY_COUNTS',
  'SNAPSHOT_SECTION_COMPLETENESS', 'SNAPSHOT_NO_CREDENTIAL_FIELDS', 'SNAPSHOT_NO_SECRET_FIELDS',
  'SNAPSHOT_ROLLBACK_NO_GRANTS',
]);

const SAFE_ERROR_TYPES = new Set([
  'Error', 'TypeError', 'RangeError', 'AggregateError', 'DatabaseError', 'TimeoutError', 'AbortError',
]);
const SAFE_ERROR_CODES = new Set([
  'EACCES', 'EPERM', 'ENETUNREACH', 'EHOSTUNREACH', 'ENETDOWN',
  'ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
  'ERR_SOCKET_CLOSED', 'ERR_STREAM_PREMATURE_CLOSE', 'ERR_PG_QUERY_CANCELLED', 'ERR_PG_QUERY_TIMEOUT',
  'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'ERR_SSL_WRONG_VERSION_NUMBER',
]);
const SAFE_SYSCALLS = new Set(['connect', 'getaddrinfo', 'read', 'write']);

const FALLBACK_CODES = Object.freeze({
  ENV_LOADING: 'ENVIRONMENT_LOADING_FAILED',
  TARGET_VALIDATION: 'TARGET_VALIDATION_FAILED',
  TLS_VALIDATION: 'TLS_VALIDATION_FAILED',
  POOL_CREATION: 'POOL_CREATION_FAILED',
  DATABASE_CONNECTION: 'DATABASE_CONNECTION_FAILED',
  TRANSACTION_BEGIN: 'TRANSACTION_BEGIN_FAILED',
  READ_ONLY_MEMBERSHIP_INSPECTION: 'READ_ONLY_MEMBERSHIP_INSPECTION_FAILED',
  CATALOG_CAPTURE: 'CATALOG_CAPTURE_FAILED',
  PREFLIGHT_VALIDATION: 'PREFLIGHT_VALIDATION_FAILED',
  SNAPSHOT_CREATION: 'SNAPSHOT_CREATION_FAILED',
  SNAPSHOT_READBACK: 'SNAPSHOT_READBACK_FAILED',
  SQL_MODIFICATION: 'SQL_MODIFICATION_FAILED',
  POST_CHANGE_VERIFICATION: 'POST_CHANGE_VERIFICATION_FAILED',
  COMMIT: 'COMMIT_FAILED',
});

const SAFE_INTERNAL_CODES = new Set([
  'PREPARED_SQL_NOT_ALLOWLISTED', 'PROHIBITED_GRANT_IN_SQL', 'UNEXPECTED_EQUIPMENT_UPDATE_GRANT',
  'ROLLBACK_FAILED',
  'SNAPSHOT_SECTION_MISSING', 'SNAPSHOT_INVENTORY_MISMATCH', 'SNAPSHOT_ARRAY_COUNT_MISMATCH',
  'SNAPSHOT_SECTION_INCOMPLETE', 'SNAPSHOT_CONTAINS_CREDENTIAL_FIELD', 'SNAPSHOT_CONTAINS_SECRET_FIELD',
  'SNAPSHOT_ROLLBACK_INVALID', 'SNAPSHOT_VERSION_UNSUPPORTED', 'SNAPSHOT_SQL_MISMATCH',
  'SNAPSHOT_ROLLBACK_MISMATCH', 'SNAPSHOT_WRITE_FAILED', 'SNAPSHOT_NAME_COLLISION',
  'EXISTING_ROLE_ATTRIBUTES_UNEXPECTED', 'EXISTING_ROLE_MEMBERSHIP_FOUND', 'EXISTING_ROLE_OWNERSHIP_FOUND',
  'EXISTING_ROLE_ACL_UNEXPECTED', 'PROTECTED_ACL_CHANGED', 'STRUCTURAL_OR_DEFAULT_PRIVILEGE_STATE_CHANGED',
  'RUNTIME_TABLE_OR_COLUMN_PRIVILEGE_MISMATCH', 'UNEXPECTED_RUNTIME_SEQUENCE_PRIVILEGE',
  'RUNTIME_DATABASE_SCHEMA_PERMISSION_MISMATCH',
  'UNEXPECTED_RUNTIME_FUNCTION_GRANT', 'RUNTIME_BUILTIN_FUNCTION_NOT_EXECUTABLE',
  'RUNTIME_COLUMN_CATALOG_EMPTY', 'DATABASE_IDENTITY_OR_TLS_MISMATCH',
  'TABLE_OWNERSHIP_OR_RLS_BASELINE_MISMATCH', 'STRUCTURAL_BASELINE_MISMATCH',
  'PHASE1_REVOCATION_MISMATCH', 'REQUIRED_BUILTIN_PUBLIC_EXECUTE_NOT_AVAILABLE',
  'SNAPSHOT_READBACK_MISMATCH', 'RUNTIME_ROLE_PAIR_MISSING_AFTER_SQL', 'RUNTIME_ROLE_DESIGN_INVALID_AFTER_SQL',
  'RUNTIME_ROLE_ACL_NOT_EXACT', 'ROLE_MEMBERSHIP_OPTIONS_UNSUPPORTED',
  'PHASE1_REVOCATION_CHANGED', 'SUPABASE_TEST_CONFIG_FILE_READ_FAILED',
  'CLIENT_RELEASE_FAILED', 'POOL_CLOSE_FAILED',
  'PREFLIGHT_UNEXPECTED_EXCEPTION',
]);

const SAFE_POST_CHANGE_ROLE_DESIGN_CHECKS = new Set([
  'roleFlagsMatch', 'loginRoleFlagsMatch', 'rolePropertiesMatch', 'membershipMatches', 'ownershipClear',
]);
const SAFE_ROLE_FLAG_FIELDS = [
  'rolcanlogin', 'rolinherit', 'rolsuper', 'rolcreatedb', 'rolcreaterole', 'rolreplication', 'rolbypassrls',
];

function safeBoolean(value) {
  return typeof value === 'boolean' ? value : null;
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function safeRoleName(value) {
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 63 && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}

function sanitizePostChangeRoleDesign(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const observed = value.observed && typeof value.observed === 'object' && !Array.isArray(value.observed)
    ? value.observed
    : {};
  const flags = (source) => Object.fromEntries(SAFE_ROLE_FLAG_FIELDS.map((key) => [key, safeBoolean(source?.[key])]));
  const properties = (source) => ({
    hasRoleConfig: safeBoolean(source?.hasRoleConfig),
    connectionLimit: Number.isSafeInteger(source?.connectionLimit) ? source.connectionLimit : null,
    hasExpiration: safeBoolean(source?.hasExpiration),
  });
  const memberships = Array.isArray(observed.memberships)
    ? observed.memberships.map((membership) => ({
      granted_role: safeRoleName(membership?.granted_role),
      member_role: safeRoleName(membership?.member_role),
      grantor_role: safeRoleName(membership?.grantor_role),
      admin_option: safeBoolean(membership?.admin_option),
      inherit_option: safeBoolean(membership?.inherit_option),
      set_option: safeBoolean(membership?.set_option),
    }))
    : [];
  return {
    failedChecks: Array.isArray(value.failedChecks)
      ? [...new Set(value.failedChecks.filter((check) => SAFE_POST_CHANGE_ROLE_DESIGN_CHECKS.has(check)))]
      : [],
    observed: {
      roleFlags: flags(observed.roleFlags),
      loginRoleFlags: flags(observed.loginRoleFlags),
      roleProperties: properties(observed.roleProperties),
      loginRoleProperties: properties(observed.loginRoleProperties),
      membershipCount: safeCount(observed.membershipCount),
      memberships,
      ownershipCount: safeCount(observed.ownershipCount),
    },
  };
}

function safeAclObjectName(value) {
  return typeof value === 'string' && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}

function sanitizeProtectedAclDiff(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const sanitizeRows = (rows) => (Array.isArray(rows) ? rows : []).slice(0, 10).map((row) => ({
    object_type: ['relation', 'column', 'function', 'schema', 'default', 'database'].includes(row?.object_type)
      ? row.object_type
      : null,
    object_name: safeAclObjectName(row?.object_name),
    column_name: row?.column_name === null ? null : safeAclObjectName(row?.column_name),
    grantee: safeRoleName(row?.grantee),
    privilege_type: typeof row?.privilege_type === 'string' && /^[A-Z_]{1,20}$/.test(row.privilege_type)
      ? row.privilege_type
      : null,
    is_grantable: safeBoolean(row?.is_grantable),
    grantor: safeRoleName(row?.grantor),
  }));
  return {
    beforeOnlyCount: safeCount(Array.isArray(value.beforeOnly) ? value.beforeOnly.length : null),
    afterOnlyCount: safeCount(Array.isArray(value.afterOnly) ? value.afterOnly.length : null),
    beforeOnly: sanitizeRows(value.beforeOnly),
    afterOnly: sanitizeRows(value.afterOnly),
  };
}

const SAFE_STRUCTURAL_SECTION_FIELDS = Object.freeze({
  tables: { identity: ['relname'], fields: ['relkind', 'owner', 'rls_enabled', 'force_rls', 'rowPresence'] },
  columns: { identity: ['table_name', 'column_name'], fields: ['data_type', 'not_null', 'default_expression', 'identity_kind', 'generated_kind', 'rowPresence'] },
  constraints: { identity: ['table_name', 'conname'], fields: ['contype', 'definition', 'convalidated', 'rowPresence'] },
  indexes: { identity: ['schemaname', 'tablename', 'indexname'], fields: ['indexdef', 'rowPresence'] },
  functions: { identity: ['signature'], fields: ['proname', 'owner', 'acl', 'security_definer', 'definition_digest', 'public_execute', 'rowPresence'] },
  triggers: { identity: ['table_name', 'tgname'], fields: ['definition', 'tgenabled', 'rowPresence'] },
  sequences: { identity: ['relname'], fields: ['owner', 'acl', 'rowPresence'] },
  defaultPrivileges: { identity: ['creator_role', 'schema_name', 'object_code'], fields: ['acl', 'rowPresence'] },
  publicSchemaAcl: { identity: ['nspname'], fields: ['owner', 'acl', 'rowPresence'] },
  databaseAcl: { identity: ['datname'], fields: ['owner', 'acl', 'rowPresence'] },
});

function safeAclText(value) {
  return typeof value === 'string' && value.length <= 1024 && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}

function sanitizeStructuralStateDiff(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const safeSections = Array.isArray(value.changedSections)
    ? [...new Set(value.changedSections.filter((section) => Object.hasOwn(SAFE_STRUCTURAL_SECTION_FIELDS, section)))]
    : [];
  const entries = Array.isArray(value.entries) ? value.entries.slice(0, 20).flatMap((entry) => {
    const section = SAFE_STRUCTURAL_SECTION_FIELDS[entry?.section] ? entry.section : null;
    if (!section) return [];
    const definition = SAFE_STRUCTURAL_SECTION_FIELDS[section];
    const object = Object.fromEntries(definition.identity.map((field) => [
      field,
      field === 'creator_role' || field === 'owner'
        ? safeRoleName(entry?.object?.[field])
        : safeAclObjectName(entry?.object?.[field]),
    ]));
    const changedFields = Array.isArray(entry?.changedFields)
      ? [...new Set(entry.changedFields.filter((field) => definition.fields.includes(field)))]
      : [];
    return [{
      section,
      object,
      changedFields,
      ...(section === 'defaultPrivileges' ? {
        beforeAcl: safeAclText(entry?.beforeAcl),
        afterAcl: safeAclText(entry?.afterAcl),
      } : {}),
    }];
  }) : [];
  return { changedSections: safeSections, entryCount: safeCount(Array.isArray(value.entries) ? value.entries.length : null), entries };
}

export function createPhase2DiagnosticState() {
  return {
    currentStage: 'ENV_LOADING',
    databaseConnectionEstablished: false,
    transactionOpened: false,
    snapshotCreated: false,
    sqlModificationAttempted: false,
    transactionCommitted: false,
    rollbackAttempted: false,
    rollbackSucceeded: false,
    rollbackFailure: null,
    failedQueryLabel: null,
    failedQueryErrorType: null,
    failedQueryErrorCode: null,
    failedQueryErrorCategory: null,
    failedQueryErrorSource: null,
    failedQueryStartedAt: null,
    failedQueryEndedAt: null,
    failedQueryDurationMs: null,
    failedQuerySocketDestroyed: null,
    lastQuery: null,
    connectionLifecycleEvents: [],
    activePreflightCheckId: null,
    failedCheckId: null,
    failedCheckExpected: null,
    failedCheckActual: null,
    postChangeRoleDesign: null,
    protectedAclDiff: null,
    structuralStateDiff: null,
    failureKind: null,
    clientConnectionFailure: null,
    transactionOutcome: 'NOT_OPENED',
    clientReleased: false,
    clientDiscarded: false,
    poolClosed: false,
  };
}

export function runPreflightCheck(state, checkId, evaluate) {
  const definition = Object.hasOwn(PREFLIGHT_CHECK_DEFINITIONS, checkId)
    ? PREFLIGHT_CHECK_DEFINITIONS[checkId]
    : null;
  if (!definition) {
    state.failedCheckId = 'PREFLIGHT_UNEXPECTED_EXCEPTION';
    state.failedCheckExpected = 'preflight check uses a registered identifier';
    state.failedCheckActual = 'UNAVAILABLE';
    state.failureKind = 'UNEXPECTED_PROGRAMMING_EXCEPTION';
    throw Object.assign(new Error('Unexpected preflight exception.'), { safeCode: 'PREFLIGHT_UNEXPECTED_EXCEPTION' });
  }

  state.activePreflightCheckId = checkId;
  let result;
  try {
    result = evaluate();
    if (!result || typeof result.passed !== 'boolean') throw new Error('Invalid preflight check result.');
  } catch {
    state.failedCheckId = checkId;
    state.failedCheckExpected = definition.expected;
    state.failedCheckActual = 'UNEXPECTED_EXCEPTION';
    state.failureKind = 'UNEXPECTED_PROGRAMMING_EXCEPTION';
    state.activePreflightCheckId = null;
    throw Object.assign(new Error('Unexpected preflight exception.'), { safeCode: 'PREFLIGHT_UNEXPECTED_EXCEPTION' });
  }

  state.activePreflightCheckId = null;
  if (result.passed) return true;
  state.failedCheckId = checkId;
  state.failedCheckExpected = definition.expected;
  state.failedCheckActual = sanitizePreflightActual(result.actual);
  state.failureKind = EXPLICIT_VALIDATION_CHECKS.has(checkId)
    ? 'EXPLICIT_VALIDATION_REJECTION'
    : 'EXPLICIT_SECURITY_REJECTION';
  throw Object.assign(new Error('Preflight security validation failed.'), { safeCode: definition.errorCode });
}

function sanitizePreflightActual(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && SAFE_ACTUAL_STATUSES.has(value)) return value;
  return 'UNAVAILABLE';
}

export function getSafeErrorDetails(error) {
  const chain = getErrorChain(error);
  const candidateType = chain.map((item) => item?.name).find((name) => SAFE_ERROR_TYPES.has(name));
  const errorType = candidateType ?? 'Error';
  const sqlState = chain.map(getSafeSqlState).find(Boolean) ?? null;
  const candidateCode = chain.map((item) => item?.code).find((code) => typeof code === 'string' && SAFE_ERROR_CODES.has(code));
  const errorCode = sqlState ?? candidateCode ?? 'UNKNOWN';
  const errorCategory = classifySafeErrorCategory(chain, sqlState, candidateCode);
  const syscall = chain.map((item) => item?.syscall).find((value) => typeof value === 'string' && SAFE_SYSCALLS.has(value)) ?? null;
  return { errorType, errorCode, errorCategory, sqlState, syscall };
}

function getErrorChain(error) {
  const result = [];
  const seen = new Set();
  let current = error;
  while (current && typeof current === 'object' && result.length < 4 && !seen.has(current)) {
    result.push(current);
    seen.add(current);
    current = current.cause;
  }
  return result;
}

function classifySafeErrorCategory(chain, sqlState, transportCode) {
  if (sqlState?.startsWith('28')) return 'DATABASE_AUTHENTICATION_ERROR';
  if (sqlState === '3D000') return 'DATABASE_IDENTITY_ERROR';
  if (sqlState?.startsWith('08')) return 'DATABASE_CONNECTION_ERROR';
  if (sqlState === '57014') return 'QUERY_CANCELED';
  if (sqlState === '42501') return 'INSUFFICIENT_PRIVILEGE';
  if (sqlState === '42703' || sqlState === '42P01') return 'CATALOG_OBJECT_MISSING';
  if (transportCode === 'EACCES' || transportCode === 'EPERM') return 'NETWORK_ACCESS_DENIED';
  if (transportCode === 'ENETUNREACH' || transportCode === 'EHOSTUNREACH' || transportCode === 'ENETDOWN') return 'NETWORK_UNREACHABLE';
  if (transportCode === 'ENOTFOUND' || transportCode === 'EAI_AGAIN') return 'DNS_RESOLUTION_FAILURE';
  if (transportCode === 'ECONNREFUSED') return 'CONNECTION_REFUSED';
  if (transportCode === 'ETIMEDOUT' || transportCode === 'ECONNABORTED') return 'CONNECTION_TIMEOUT';
  if (transportCode === 'ERR_TLS_CERT_ALTNAME_INVALID' || transportCode === 'CERT_HAS_EXPIRED' ||
    transportCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || transportCode === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    transportCode === 'SELF_SIGNED_CERT_IN_CHAIN' || transportCode === 'ERR_SSL_WRONG_VERSION_NUMBER') {
    return 'TLS_VERIFICATION_FAILURE';
  }
  if (transportCode === 'ERR_PG_QUERY_TIMEOUT') return 'QUERY_READ_TIMEOUT';
  if (transportCode === 'ERR_PG_QUERY_CANCELLED') return 'QUERY_CANCELED';
  if (transportCode === 'ECONNRESET') return 'CONNECTION_RESET';
  if (transportCode === 'EPIPE' || transportCode === 'ERR_SOCKET_CLOSED' || transportCode === 'ERR_STREAM_PREMATURE_CLOSE') {
    return 'CONNECTION_CLOSED';
  }
  if (chain.some((item) => typeof item?.code === 'string' && (item.code === 'ERR_TLS_CERT_ALTNAME_INVALID' || item.code === 'CERT_HAS_EXPIRED' || item.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'))) {
    return 'TLS_VERIFICATION_FAILURE';
  }
  for (const item of chain) {
    const message = typeof item?.message === 'string' ? item.message : '';
    if (/\bquery read timeout\b/i.test(message)) return 'QUERY_READ_TIMEOUT';
    if (/\btimeout exceeded when trying to connect\b/i.test(message)) return 'CONNECTION_ACQUISITION_TIMEOUT';
    if (/\bconnection terminated due to connection timeout\b|\btimeout expired\b/i.test(message)) return 'CONNECTION_TIMEOUT';
    if (/\bconnection reset\b|\bsocket hang up\b/i.test(message)) return 'CONNECTION_RESET';
    if (/\bconnection terminated unexpectedly\b|\bconnection is not queryable\b|\bclient was closed\b/i.test(message)) return 'CONNECTION_CLOSED';
    if (/\bcanceling statement due to statement timeout\b|\bquery canceled\b/i.test(message)) return 'QUERY_CANCELED';
    if (/\bpermission denied\b|\binsufficient privilege\b/i.test(message)) return 'INSUFFICIENT_PRIVILEGE';
    if (/\bcolumn .* does not exist\b|\brelation .* does not exist\b/i.test(message)) return 'CATALOG_OBJECT_MISSING';
    if (/\bprotocol error\b|\bunexpected .* message from backend\b/i.test(message)) return 'QUERY_PROTOCOL_ERROR';
  }
  return 'UNKNOWN';
}

export async function runLabeledCatalogQuery(client, label, query, values, state) {
  if (!CATALOG_QUERY_LABELS.includes(label)) throw new Error('Unknown catalog query label.');
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const queryRecord = {
    label,
    startedAt,
    endedAt: null,
    durationMs: null,
    socketDestroyedAtStart: getClientSocketDestroyed(client),
    socketDestroyedAtEnd: null,
    outcome: 'IN_PROGRESS',
  };
  state.lastQuery = queryRecord;
  try {
    const result = values === undefined ? await client.query(query) : await client.query(query, values);
    finishQueryRecord(queryRecord, start, 'SUCCEEDED', client);
    return result;
  } catch (error) {
    const details = getSafeErrorDetails(error);
    finishQueryRecord(queryRecord, start, 'FAILED', client);
    state.failedQueryLabel = label;
    state.failedQueryErrorType = details.errorType;
    state.failedQueryErrorCode = details.errorCode;
    state.failedQueryErrorCategory = details.errorCategory;
    state.failedQueryErrorSource = details.sqlState ? 'POSTGRESQL' : isTransportError(details.errorCode) ? 'TRANSPORT' : 'UNKNOWN';
    state.failedQueryStartedAt = queryRecord.startedAt;
    state.failedQueryEndedAt = queryRecord.endedAt;
    state.failedQueryDurationMs = queryRecord.durationMs;
    state.failedQuerySocketDestroyed = queryRecord.socketDestroyedAtEnd;
    throw error;
  }
}

function finishQueryRecord(record, start, outcome, client) {
  record.endedAt = new Date().toISOString();
  record.durationMs = Math.max(0, Math.round(performance.now() - start));
  record.socketDestroyedAtEnd = getClientSocketDestroyed(client);
  record.outcome = outcome;
}

function isTransportError(code) {
  return ['EACCES', 'EPERM', 'ENETUNREACH', 'EHOSTUNREACH', 'ENETDOWN',
    'ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
    'ERR_SOCKET_CLOSED', 'ERR_STREAM_PREMATURE_CLOSE', 'ERR_PG_QUERY_CANCELLED', 'ERR_PG_QUERY_TIMEOUT',
    'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'ERR_SSL_WRONG_VERSION_NUMBER'].includes(code);
}

export function getClientSocketDestroyed(client) {
  const stream = client?.connection?.stream;
  return typeof stream?.destroyed === 'boolean' ? stream.destroyed : null;
}

export function recordConnectionLifecycleEvent(state, event, client) {
  const allowedEvents = new Set(['client_checked_out', 'client_error', 'client_end', 'client_released', 'pool_closed']);
  if (!allowedEvents.has(event)) return;
  state.connectionLifecycleEvents.push({
    event,
    at: new Date().toISOString(),
    socketDestroyed: getClientSocketDestroyed(client),
  });
}

export function recordRollbackFailure(state, error) {
  const details = getSafeErrorDetails(error);
  state.rollbackFailure = details;
}

export function recordClientConnectionFailure(state, error) {
  // Keep the first socket failure: subsequent errors are often just consequences
  // of the connection already being unusable.
  if (state.clientConnectionFailure) return;
  state.clientConnectionFailure = {
    ...getSafeErrorDetails(error),
    stage: PHASE2_EXECUTION_STAGES.includes(state.currentStage) ? state.currentStage : 'UNKNOWN',
  };
}

export async function rollbackPhase2Transaction(client, state) {
  if (state.rollbackAttempted) return false;
  state.rollbackAttempted = true;
  try {
    await client.query('ROLLBACK');
    state.rollbackSucceeded = true;
    state.transactionOutcome = 'ROLLED_BACK';
    return true;
  } catch (error) {
    recordRollbackFailure(state, error);
    state.rollbackSucceeded = false;
    state.transactionOutcome = 'UNKNOWN';
    return false;
  }
}

export function getSafeSqlState(error) {
  const code = error && typeof error === 'object' ? error.code : undefined;
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : null;
}

export function formatPhase2FailureDiagnostic(state, error) {
  const sqlState = getSafeSqlState(error);
  const safeCode = error && typeof error === 'object' ? error.safeCode : undefined;
  const unexpectedPreflight = state.currentStage === 'PREFLIGHT_VALIDATION' && !state.failedCheckId;
  const errorCode = unexpectedPreflight
    ? 'PREFLIGHT_UNEXPECTED_EXCEPTION'
    : typeof safeCode === 'string' && SAFE_INTERNAL_CODES.has(safeCode)
    ? safeCode
    : FALLBACK_CODES[state.currentStage] ?? 'PHASE2_OPERATION_FAILED';
  const failedCheckId = state.failedCheckId ?? (unexpectedPreflight ? 'PREFLIGHT_UNEXPECTED_EXCEPTION' : null);
  return JSON.stringify({
    event: 'phase2_runner_failure',
    stage: PHASE2_EXECUTION_STAGES.includes(state.currentStage) ? state.currentStage : 'PREFLIGHT_VALIDATION',
    errorCode,
    failedCheckId,
    failedCheckExpected: state.failedCheckExpected ?? (unexpectedPreflight ? PREFLIGHT_CHECK_DEFINITIONS.PREFLIGHT_UNEXPECTED_EXCEPTION.expected : null),
    failedCheckActual: state.failedCheckActual ?? (unexpectedPreflight ? 'UNEXPECTED_EXCEPTION' : null),
    postChangeRoleDesign: sanitizePostChangeRoleDesign(state.postChangeRoleDesign),
    protectedAclDiff: sanitizeProtectedAclDiff(state.protectedAclDiff),
    structuralStateDiff: sanitizeStructuralStateDiff(state.structuralStateDiff),
    failureKind: state.failureKind ?? (unexpectedPreflight ? 'UNEXPECTED_PROGRAMMING_EXCEPTION' : null),
    sqlState,
    databaseConnectionEstablished: state.databaseConnectionEstablished,
    transactionOpened: state.transactionOpened,
    snapshotCreated: state.snapshotCreated,
    sqlModificationAttempted: state.sqlModificationAttempted,
    transactionCommitted: state.transactionCommitted,
    rollbackAttempted: state.rollbackAttempted,
    rollbackSucceeded: state.rollbackSucceeded,
    failedQueryLabel: state.failedQueryLabel,
    failedQueryErrorType: state.failedQueryErrorType,
    failedQueryErrorCode: state.failedQueryErrorCode,
    failedQueryErrorCategory: state.failedQueryErrorCategory,
    failedQueryErrorSource: state.failedQueryErrorSource,
    failedQueryStartedAt: state.failedQueryStartedAt,
    failedQueryEndedAt: state.failedQueryEndedAt,
    failedQueryDurationMs: state.failedQueryDurationMs,
    failedQuerySocketDestroyed: state.failedQuerySocketDestroyed,
    lastQuery: state.lastQuery,
    connectionLifecycleEvents: state.connectionLifecycleEvents,
    clientConnectionErrorType: state.clientConnectionFailure?.errorType ?? null,
    clientConnectionErrorCode: state.clientConnectionFailure?.errorCode ?? null,
    clientConnectionErrorCategory: state.clientConnectionFailure?.errorCategory ?? null,
    clientConnectionSqlState: state.clientConnectionFailure?.sqlState ?? null,
    clientConnectionErrorSyscall: state.clientConnectionFailure?.syscall ?? null,
    clientConnectionErrorStage: state.clientConnectionFailure?.stage ?? null,
    rollbackErrorType: state.rollbackFailure?.errorType ?? null,
    rollbackErrorCode: state.rollbackFailure?.errorCode ?? null,
    rollbackErrorCategory: state.rollbackFailure?.errorCategory ?? null,
    rollbackSqlState: state.rollbackFailure?.sqlState ?? null,
    transactionOutcome: state.transactionOutcome,
    clientReleased: state.clientReleased,
    clientDiscarded: state.clientDiscarded,
    poolClosed: state.poolClosed,
  });
}
