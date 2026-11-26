import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CATALOG_QUERY_LABELS,
  PREFLIGHT_CHECK_DEFINITIONS,
  PHASE2_EXECUTION_STAGES,
  createPhase2DiagnosticState,
  formatPhase2FailureDiagnostic,
  getSafeSqlState,
  getClientSocketDestroyed,
  recordConnectionLifecycleEvent,
  recordRollbackFailure,
  recordClientConnectionFailure,
  rollbackPhase2Transaction,
  runLabeledCatalogQuery,
  runPreflightCheck,
} from './supabase-test-runtime-role-phase2-diagnostics.mjs';

const root = process.cwd();
const runner = readFileSync(resolve(root, 'security/supabase-test-runtime-role-phase2.mjs'), 'utf8');
const diagnosticsSource = readFileSync(resolve(root, 'security/supabase-test-runtime-role-phase2-diagnostics.mjs'), 'utf8');

test('diagnostic stage list matches the Phase 2 execution contract', () => {
  assert.deepEqual(PHASE2_EXECUTION_STAGES, [
    'ENV_LOADING', 'TARGET_VALIDATION', 'TLS_VALIDATION', 'POOL_CREATION',
    'DATABASE_CONNECTION', 'TRANSACTION_BEGIN', 'READ_ONLY_MEMBERSHIP_INSPECTION', 'CATALOG_CAPTURE', 'PREFLIGHT_VALIDATION',
    'SNAPSHOT_CREATION', 'SNAPSHOT_READBACK', 'SQL_MODIFICATION',
    'POST_CHANGE_VERIFICATION', 'COMMIT',
  ]);
  for (const stage of PHASE2_EXECUTION_STAGES) {
    if (stage === 'TARGET_VALIDATION' || stage === 'TLS_VALIDATION') continue;
    assert(runner.includes(`diagnostics.currentStage = '${stage}'`), `runner should set ${stage}`);
  }
  assert.match(runner, /message\.startsWith\('SUPABASE_TEST_CA_CERT'\)[\s\S]*?currentStage = 'TLS_VALIDATION'/);
});

test('environment and TLS failures produce safe diagnostics without opening a connection', () => {
  const environment = createPhase2DiagnosticState();
  environment.currentStage = 'ENV_LOADING';
  const environmentOutput = JSON.parse(formatPhase2FailureDiagnostic(environment, { safeCode: 'SUPABASE_TEST_CONFIG_FILE_READ_FAILED' }));
  assert.equal(environmentOutput.errorCode, 'SUPABASE_TEST_CONFIG_FILE_READ_FAILED');
  assert.equal(environmentOutput.databaseConnectionEstablished, false);

  const tls = createPhase2DiagnosticState();
  tls.currentStage = 'TLS_VALIDATION';
  const tlsOutput = JSON.parse(formatPhase2FailureDiagnostic(tls, new Error('certificate secret payload')));
  assert.equal(tlsOutput.errorCode, 'TLS_VALIDATION_FAILED');
  assert.equal(tlsOutput.sqlState, null);
  assert.equal(tlsOutput.databaseConnectionEstablished, false);
});

test('database connection and transaction begin failures retain the correct state flags', () => {
  const connection = createPhase2DiagnosticState();
  connection.currentStage = 'DATABASE_CONNECTION';
  const connectionOutput = JSON.parse(formatPhase2FailureDiagnostic(connection, Object.assign(new Error('hidden'), { code: 'EACCES' })));
  assert.equal(connectionOutput.errorCode, 'DATABASE_CONNECTION_FAILED');
  assert.equal(connectionOutput.databaseConnectionEstablished, false);
  assert.equal(connectionOutput.transactionOpened, false);

  const begin = createPhase2DiagnosticState();
  begin.currentStage = 'TRANSACTION_BEGIN';
  begin.databaseConnectionEstablished = true;
  const beginOutput = JSON.parse(formatPhase2FailureDiagnostic(begin, Object.assign(new Error('hidden'), { code: '08006' })));
  assert.equal(beginOutput.errorCode, 'TRANSACTION_BEGIN_FAILED');
  assert.equal(beginOutput.sqlState, '08006');
  assert.equal(beginOutput.databaseConnectionEstablished, true);
  assert.equal(beginOutput.transactionOpened, false);
});

test('pool connection rejections report allowlisted network, DNS, and TLS metadata without raw errors', () => {
  const cases = [
    { code: 'EACCES', syscall: 'connect', category: 'NETWORK_ACCESS_DENIED' },
    { code: 'ECONNREFUSED', syscall: 'connect', category: 'CONNECTION_REFUSED' },
    { code: 'ETIMEDOUT', syscall: 'connect', category: 'CONNECTION_TIMEOUT' },
    { code: 'ENOTFOUND', syscall: 'getaddrinfo', category: 'DNS_RESOLUTION_FAILURE' },
    { code: 'EAI_AGAIN', syscall: 'getaddrinfo', category: 'DNS_RESOLUTION_FAILURE' },
    { code: 'ERR_TLS_CERT_ALTNAME_INVALID', category: 'TLS_VERIFICATION_FAILURE' },
    { code: 'CERT_HAS_EXPIRED', category: 'TLS_VERIFICATION_FAILURE' },
  ];

  for (const { code, syscall, category } of cases) {
    const state = createPhase2DiagnosticState();
    state.currentStage = 'DATABASE_CONNECTION';
    const rejection = Object.assign(new Error('postgres://hidden-user:hidden-password@hidden-host/db certificate payload'), {
      code,
      syscall,
      hostname: 'hidden-host',
      address: '192.0.2.10',
    });
    recordClientConnectionFailure(state, rejection);
    const output = formatPhase2FailureDiagnostic(state, rejection);
    const diagnostic = JSON.parse(output);

    assert.equal(diagnostic.errorCode, 'DATABASE_CONNECTION_FAILED');
    assert.equal(diagnostic.clientConnectionErrorCode, code);
    assert.equal(diagnostic.clientConnectionErrorCategory, category);
    assert.equal(diagnostic.clientConnectionErrorSyscall, syscall ?? null);
    assert.equal(diagnostic.clientConnectionErrorStage, 'DATABASE_CONNECTION');
    for (const secret of ['postgres://', 'hidden-user', 'hidden-password', 'hidden-host', '192.0.2.10', 'certificate payload']) {
      assert.equal(output.includes(secret), false);
    }
  }
});

test('authentication and database identity SQLSTATEs are categorized safely', () => {
  const authentication = createPhase2DiagnosticState();
  authentication.currentStage = 'DATABASE_CONNECTION';
  recordClientConnectionFailure(authentication, Object.assign(new Error('password rejected'), { code: '28P01' }));
  const authDiagnostic = JSON.parse(formatPhase2FailureDiagnostic(authentication, new Error('hidden')));
  assert.equal(authDiagnostic.clientConnectionErrorCode, '28P01');
  assert.equal(authDiagnostic.clientConnectionErrorCategory, 'DATABASE_AUTHENTICATION_ERROR');

  const identity = createPhase2DiagnosticState();
  identity.currentStage = 'DATABASE_CONNECTION';
  recordClientConnectionFailure(identity, Object.assign(new Error('database unavailable'), { code: '3D000' }));
  const identityDiagnostic = JSON.parse(formatPhase2FailureDiagnostic(identity, new Error('hidden')));
  assert.equal(identityDiagnostic.clientConnectionErrorCode, '3D000');
  assert.equal(identityDiagnostic.clientConnectionErrorCategory, 'DATABASE_IDENTITY_ERROR');
});

test('unrecognized syscall metadata is omitted from connection diagnostics', () => {
  const state = createPhase2DiagnosticState();
  state.currentStage = 'DATABASE_CONNECTION';
  recordClientConnectionFailure(state, Object.assign(new Error('sensitive transport detail'), {
    code: 'EACCES',
    syscall: 'private-operation-name',
  }));

  const output = formatPhase2FailureDiagnostic(state, new Error('hidden'));
  const diagnostic = JSON.parse(output);
  assert.equal(diagnostic.clientConnectionErrorCode, 'EACCES');
  assert.equal(diagnostic.clientConnectionErrorSyscall, null);
  assert.equal(output.includes('private-operation-name'), false);
  assert.equal(output.includes('sensitive transport detail'), false);
});

test('catalog, snapshot creation, and snapshot read-back failures report precise completion flags', () => {
  const catalog = createPhase2DiagnosticState();
  catalog.currentStage = 'CATALOG_CAPTURE';
  catalog.databaseConnectionEstablished = true;
  catalog.transactionOpened = true;
  const catalogOutput = JSON.parse(formatPhase2FailureDiagnostic(catalog, Object.assign(new Error('hidden'), { code: '42P01' })));
  assert.equal(catalogOutput.errorCode, 'CATALOG_CAPTURE_FAILED');
  assert.equal(catalogOutput.sqlState, '42P01');
  assert.equal(catalogOutput.failedQueryLabel, null);
  assert.equal(catalogOutput.snapshotCreated, false);

  const snapshotWrite = createPhase2DiagnosticState();
  snapshotWrite.currentStage = 'SNAPSHOT_CREATION';
  snapshotWrite.databaseConnectionEstablished = true;
  snapshotWrite.transactionOpened = true;
  const snapshotWriteOutput = JSON.parse(formatPhase2FailureDiagnostic(snapshotWrite, { safeCode: 'SNAPSHOT_WRITE_FAILED' }));
  assert.equal(snapshotWriteOutput.errorCode, 'SNAPSHOT_WRITE_FAILED');
  assert.equal(snapshotWriteOutput.snapshotCreated, false);

  const snapshotPartial = createPhase2DiagnosticState();
  snapshotPartial.currentStage = 'SNAPSHOT_CREATION';
  snapshotPartial.databaseConnectionEstablished = true;
  snapshotPartial.transactionOpened = true;
  snapshotPartial.snapshotCreated = true;
  const snapshotPartialOutput = JSON.parse(formatPhase2FailureDiagnostic(snapshotPartial, { safeCode: 'SNAPSHOT_WRITE_FAILED' }));
  assert.equal(snapshotPartialOutput.snapshotCreated, true);

  const snapshotRead = createPhase2DiagnosticState();
  snapshotRead.currentStage = 'SNAPSHOT_READBACK';
  snapshotRead.databaseConnectionEstablished = true;
  snapshotRead.transactionOpened = true;
  snapshotRead.snapshotCreated = true;
  const snapshotReadOutput = JSON.parse(formatPhase2FailureDiagnostic(snapshotRead, { safeCode: 'SNAPSHOT_READBACK_MISMATCH' }));
  assert.equal(snapshotReadOutput.errorCode, 'SNAPSHOT_READBACK_MISMATCH');
  assert.equal(snapshotReadOutput.snapshotCreated, true);
});

test('catalog queries use unique sanitized labels and report safe error type and code', async () => {
  assert.equal(new Set(CATALOG_QUERY_LABELS).size, CATALOG_QUERY_LABELS.length);
  assert(CATALOG_QUERY_LABELS.every((label) => /^[a-z][a-z0-9_]+$/.test(label)));
  for (const label of CATALOG_QUERY_LABELS) {
    assert(runner.includes(`'${label}'`), `runner should use catalog query label ${label}`);
  }

  const state = createPhase2DiagnosticState();
  const client = {
    async query() {
      throw Object.assign(new Error('postgres://user:secret@private-host/db sensitive detail'), {
        name: 'DatabaseError',
        code: '42P01',
      });
    },
  };
  await assert.rejects(runLabeledCatalogQuery(client, 'catalog_roles', 'SELECT secret', undefined, state));
  const output = formatPhase2FailureDiagnostic(state, { code: '42P01' });
  const diagnostic = JSON.parse(output);
  assert.equal(diagnostic.failedQueryLabel, 'catalog_roles');
  assert.equal(diagnostic.failedQueryErrorType, 'DatabaseError');
  assert.equal(diagnostic.failedQueryErrorCode, '42P01');
  assert.equal(diagnostic.sqlState, '42P01');
  for (const secret of ['postgres://', 'secret@', 'private-host', 'sensitive detail', 'SELECT secret']) {
    assert.equal(output.includes(secret), false);
  }
});

test('unknown catalog error codes are replaced with a safe category', async () => {
  const state = createPhase2DiagnosticState();
  const client = { async query() { throw Object.assign(new Error('hidden'), { name: 'private-error-type', code: 'private-code-value' }); } };
  await assert.rejects(runLabeledCatalogQuery(client, 'catalog_indexes', 'SELECT 1', undefined, state));
  const diagnostic = JSON.parse(formatPhase2FailureDiagnostic(state, new Error('hidden')));
  assert.equal(diagnostic.failedQueryLabel, 'catalog_indexes');
  assert.equal(diagnostic.failedQueryErrorType, 'Error');
  assert.equal(diagnostic.failedQueryErrorCode, 'UNKNOWN');
  assert.equal(diagnostic.failedQueryErrorCategory, 'UNKNOWN');
  assert.equal(JSON.stringify(diagnostic).includes('private-code-value'), false);
  assert.equal(JSON.stringify(diagnostic).includes('private-error-type'), false);
});

test('client query timeouts are classified without exposing the raw error message', async () => {
  const state = createPhase2DiagnosticState();
  const timeout = new Error('Query read timeout for postgresql://user:password@private-host/database');
  const client = { async query() { throw timeout; } };
  await assert.rejects(runLabeledCatalogQuery(client, 'catalog_columns', 'SELECT sensitive_text', undefined, state));
  const output = formatPhase2FailureDiagnostic(state, timeout);
  const diagnostic = JSON.parse(output);
  assert.equal(diagnostic.failedQueryLabel, 'catalog_columns');
  assert.equal(diagnostic.failedQueryErrorType, 'Error');
  assert.equal(diagnostic.failedQueryErrorCode, 'UNKNOWN');
  assert.equal(diagnostic.failedQueryErrorCategory, 'QUERY_READ_TIMEOUT');
  assert.equal(diagnostic.sqlState, null);
  for (const secret of ['postgresql://', 'password', 'private-host', 'sensitive_text', 'Query read timeout']) {
    assert.equal(output.includes(secret), false);
  }
});

test('catalog compatibility and permission SQLSTATEs receive bounded categories', async () => {
  for (const [code, category] of [['42703', 'CATALOG_OBJECT_MISSING'], ['42501', 'INSUFFICIENT_PRIVILEGE']]) {
    const state = createPhase2DiagnosticState();
    const failure = Object.assign(new Error('sensitive server detail'), { code });
    const client = { async query() { throw failure; } };
    await assert.rejects(runLabeledCatalogQuery(client, 'catalog_columns', 'SELECT private', undefined, state));
    const diagnostic = JSON.parse(formatPhase2FailureDiagnostic(state, failure));
    assert.equal(diagnostic.failedQueryErrorCode, code);
    assert.equal(diagnostic.failedQueryErrorCategory, category);
    assert.equal(JSON.stringify(diagnostic).includes('sensitive server detail'), false);
  }
});

test('catalog query timing and socket state are recorded without SQL, parameters, or raw errors', async () => {
  const state = createPhase2DiagnosticState();
  const client = { connection: { stream: { destroyed: false } }, async query() { return { rows: [] }; } };
  const result = await runLabeledCatalogQuery(client, 'catalog_columns', 'SELECT private_value', ['secret-value'], state);
  assert.deepEqual(result.rows, []);
  assert.equal(state.lastQuery.label, 'catalog_columns');
  assert.equal(state.lastQuery.outcome, 'SUCCEEDED');
  assert.equal(state.lastQuery.socketDestroyedAtStart, false);
  assert.equal(state.lastQuery.socketDestroyedAtEnd, false);
  assert(Number.isFinite(state.lastQuery.durationMs));
  assert.equal(new Date(state.lastQuery.startedAt).toISOString(), state.lastQuery.startedAt);
  assert.equal(new Date(state.lastQuery.endedAt).toISOString(), state.lastQuery.endedAt);
  const output = formatPhase2FailureDiagnostic(state, new Error('hidden'));
  for (const secret of ['SELECT private_value', 'secret-value']) assert.equal(output.includes(secret), false);
});

test('transport reset is identified separately from PostgreSQL errors and records destroyed socket', async () => {
  const state = createPhase2DiagnosticState();
  const client = {
    connection: { stream: { destroyed: false } },
    async query() {
      this.connection.stream.destroyed = true;
      throw Object.assign(new Error('socket reset at postgres://user:secret@private-host/db'), { code: 'ECONNRESET' });
    },
  };
  await assert.rejects(runLabeledCatalogQuery(client, 'catalog_columns', 'SELECT private_value', ['secret-value'], state));
  const diagnostic = JSON.parse(formatPhase2FailureDiagnostic(state, new Error('hidden')));
  assert.equal(diagnostic.failedQueryErrorSource, 'TRANSPORT');
  assert.equal(diagnostic.failedQueryErrorCode, 'ECONNRESET');
  assert.equal(diagnostic.failedQueryErrorCategory, 'CONNECTION_RESET');
  assert.equal(diagnostic.failedQuerySocketDestroyed, true);
  assert.equal(diagnostic.failedQueryLabel, 'catalog_columns');
  assert.equal(diagnostic.lastQuery.outcome, 'FAILED');
  assert(Number.isFinite(diagnostic.failedQueryDurationMs));
  for (const secret of ['postgres://', 'secret@', 'private-host', 'SELECT private_value', 'secret-value']) {
    assert.equal(JSON.stringify(diagnostic).includes(secret), false);
  }
});

test('connection lifecycle telemetry contains only allowlisted events and socket booleans', () => {
  const state = createPhase2DiagnosticState();
  const client = { connection: { stream: { destroyed: true } } };
  recordConnectionLifecycleEvent(state, 'client_error', client);
  recordConnectionLifecycleEvent(state, 'untrusted-event', client);
  assert.deepEqual(state.connectionLifecycleEvents.map(({ event, socketDestroyed }) => ({ event, socketDestroyed })), [
    { event: 'client_error', socketDestroyed: true },
  ]);
  assert.equal(new Date(state.connectionLifecycleEvents[0].at).toISOString(), state.connectionLifecycleEvents[0].at);
  assert.equal(getClientSocketDestroyed({ connection: { stream: {} } }), null);
});

test('every registered preflight check has a stable ID and is wired into the runner', () => {
  for (const [checkId, definition] of Object.entries(PREFLIGHT_CHECK_DEFINITIONS)) {
    assert.match(checkId, /^[A-Z][A-Z0-9_]+$/);
    assert.equal(typeof definition.errorCode, 'string');
    assert.equal(typeof definition.expected, 'string');
    if (checkId !== 'PREFLIGHT_UNEXPECTED_EXCEPTION') {
      assert(runner.includes(`'${checkId}'`), `runner should use ${checkId}`);
    }
  }
});

test('every explicit preflight rejection reports its stable ID, safe expectation, actual, and compatible code', () => {
  for (const [checkId, definition] of Object.entries(PREFLIGHT_CHECK_DEFINITIONS)) {
    if (checkId === 'PREFLIGHT_UNEXPECTED_EXCEPTION') continue;
    const state = createPhase2DiagnosticState();
    state.currentStage = 'PREFLIGHT_VALIDATION';
    let failure;
    try {
      runPreflightCheck(state, checkId, () => ({ passed: false, actual: 2 }));
    } catch (error) {
      failure = error;
    }
    assert(failure, `${checkId} should reject a failed condition`);
    const diagnostic = JSON.parse(formatPhase2FailureDiagnostic(state, failure));
    assert.equal(diagnostic.failedCheckId, checkId);
    assert.equal(diagnostic.errorCode, definition.errorCode);
    assert.equal(diagnostic.failedCheckExpected, definition.expected);
    assert.equal(diagnostic.failedCheckActual, 2);
    assert(['EXPLICIT_SECURITY_REJECTION', 'EXPLICIT_VALIDATION_REJECTION'].includes(diagnostic.failureKind));
    assert.equal(JSON.stringify(diagnostic).includes('postgres://'), false);
  }
});

test('unexpected preflight exceptions use a fixed code and never expose exception details', () => {
  const state = createPhase2DiagnosticState();
  state.currentStage = 'PREFLIGHT_VALIDATION';
  let failure;
  try {
    runPreflightCheck(state, 'DATABASE_NAME', () => {
      throw new Error('postgres://user:password@secret-host/private-db SQL parameter secret');
    });
  } catch (error) {
    failure = error;
  }
  const output = formatPhase2FailureDiagnostic(state, failure);
  const diagnostic = JSON.parse(output);
  assert.equal(diagnostic.errorCode, 'PREFLIGHT_UNEXPECTED_EXCEPTION');
  assert.equal(diagnostic.failedCheckId, 'DATABASE_NAME');
  assert.equal(diagnostic.failedCheckExpected, PREFLIGHT_CHECK_DEFINITIONS.DATABASE_NAME.expected);
  assert.equal(diagnostic.failedCheckActual, 'UNEXPECTED_EXCEPTION');
  assert.equal(diagnostic.failureKind, 'UNEXPECTED_PROGRAMMING_EXCEPTION');
  for (const sensitive of ['postgres://', 'password', 'secret-host', 'private-db', 'SQL parameter secret']) {
    assert.equal(output.includes(sensitive), false);
  }
});

test('successful preflight checks do not record a failure', () => {
  const state = createPhase2DiagnosticState();
  state.currentStage = 'PREFLIGHT_VALIDATION';
  assert.equal(runPreflightCheck(state, 'DATABASE_NAME', () => ({ passed: true, actual: true })), true);
  assert.equal(state.failedCheckId, null);
  assert.equal(state.failedCheckExpected, null);
  assert.equal(state.failedCheckActual, null);
  assert.equal(state.failureKind, null);
});

test('built-in preflight uses schema-qualified signatures, effective EXECUTE checks, and no owner requirement', () => {
  for (const signature of [
    'pg_catalog.pg_advisory_xact_lock(bigint)',
    'pg_catalog.hashtextextended(text,bigint)',
    'pg_catalog.gen_random_uuid()',
  ]) assert(runner.includes(`to_regprocedure('${signature}')`));
  assert.match(runner, /has_function_privilege\(\$1,p\.oid,'EXECUTE'\)/);
  assert.match(runner, /aclexplode\(coalesce\(p\.proacl,acldefault\('f',p\.proowner\)\)\)[\s\S]*?a\.grantee=0 AND a\.privilege_type='EXECUTE'/);
  assert.match(runner, /normalizeBuiltinSignature\(row\.signature\)/);
  assert.doesNotMatch(runner, /REQUIRED_BUILTIN_SIGNATURES[\s\S]*?\.owner\s*===/);
});

test('unexpected exceptions outside an individual check receive a stable fallback diagnostic', () => {
  const state = createPhase2DiagnosticState();
  state.currentStage = 'PREFLIGHT_VALIDATION';
  const output = formatPhase2FailureDiagnostic(state, new Error('sensitive raw exception'));
  const diagnostic = JSON.parse(output);
  assert.equal(diagnostic.errorCode, 'PREFLIGHT_UNEXPECTED_EXCEPTION');
  assert.equal(diagnostic.failedCheckId, 'PREFLIGHT_UNEXPECTED_EXCEPTION');
  assert.equal(diagnostic.failedCheckActual, 'UNEXPECTED_EXCEPTION');
  assert.equal(diagnostic.failureKind, 'UNEXPECTED_PROGRAMMING_EXCEPTION');
  assert.equal(output.includes('sensitive raw exception'), false);
});

test('preflight actual values are restricted to safe booleans, counts, and statuses', () => {
  const state = createPhase2DiagnosticState();
  state.currentStage = 'PREFLIGHT_VALIDATION';
  let failure;
  try {
    runPreflightCheck(state, 'DATABASE_NAME', () => ({
      passed: false,
      actual: 'postgresql://user:password@secret-host/private-db',
    }));
  } catch (error) {
    failure = error;
  }
  const output = formatPhase2FailureDiagnostic(state, failure);
  const diagnostic = JSON.parse(output);
  assert.equal(diagnostic.failedCheckActual, 'UNAVAILABLE');
  for (const sensitive of ['postgresql://', 'password', 'secret-host', 'private-db']) {
    assert.equal(output.includes(sensitive), false);
  }
});

test('PostgreSQL statement cancellation leaves the client available for a confirmed rollback', async () => {
  const state = createPhase2DiagnosticState();
  state.transactionOpened = true;
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql === 'SELECT catalog metadata') {
        throw Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' });
      }
      return { command: sql };
    },
  };
  await assert.rejects(runLabeledCatalogQuery(client, 'catalog_columns', 'SELECT catalog metadata', undefined, state));
  assert.equal(state.failedQueryErrorCategory, 'QUERY_CANCELED');
  assert.equal(await rollbackPhase2Transaction(client, state), true);
  assert.deepEqual(calls, ['SELECT catalog metadata', 'ROLLBACK']);
  assert.equal(state.rollbackSucceeded, true);
  assert.equal(state.transactionOutcome, 'ROLLED_BACK');
});

test('failed rollback is recorded safely and attempted only once', async () => {
  const state = createPhase2DiagnosticState();
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      throw new Error('Client was closed at postgresql://user:secret@private-host/database');
    },
  };
  assert.equal(await rollbackPhase2Transaction(client, state), false);
  assert.equal(await rollbackPhase2Transaction(client, state), false);
  assert.deepEqual(calls, ['ROLLBACK']);
  const diagnostic = JSON.parse(formatPhase2FailureDiagnostic(state, new Error('hidden')));
  assert.equal(diagnostic.rollbackErrorCategory, 'CONNECTION_CLOSED');
  assert.equal(diagnostic.rollbackSucceeded, false);
  assert.equal(diagnostic.transactionOutcome, 'UNKNOWN');
  assert.equal(JSON.stringify(diagnostic).includes('secret'), false);
});

test('rollback failures report only sanitized type and allowlisted code', () => {
  const state = createPhase2DiagnosticState();
  state.currentStage = 'CATALOG_CAPTURE';
  state.rollbackAttempted = true;
  state.rollbackSucceeded = false;
  state.transactionOutcome = 'UNKNOWN';
  recordRollbackFailure(state, Object.assign(new Error('postgres://user:password@host/db token=secret'), {
    code: 'ECONNRESET',
  }));
  const output = formatPhase2FailureDiagnostic(state, new Error('hidden original error'));
  const diagnostic = JSON.parse(output);
  assert.equal(diagnostic.rollbackErrorType, 'Error');
  assert.equal(diagnostic.rollbackErrorCode, 'ECONNRESET');
  assert.equal(diagnostic.rollbackErrorCategory, 'CONNECTION_RESET');
  assert.equal(diagnostic.rollbackSqlState, null);
  assert.equal(diagnostic.rollbackSucceeded, false);
  assert.equal(diagnostic.transactionOutcome, 'UNKNOWN');
  for (const secret of ['postgres://', 'password', '@host', 'token=secret', 'hidden original error']) {
    assert.equal(output.includes(secret), false);
  }
  assert.match(runner, /rollbackPhase2Transaction\(client, diagnostics\)/);
  assert.match(runner, /client\.release\(discardClient \? true : undefined\)/);
});

test('checked-out client socket errors are handled and recorded without secrets', () => {
  const state = createPhase2DiagnosticState();
  const client = new EventEmitter();
  client.on('error', (error) => recordClientConnectionFailure(state, error));
  const error = Object.assign(new Error('socket reset at postgresql://user:password@private-host/db'), {
    code: 'ECONNRESET',
  });

  assert.doesNotThrow(() => client.emit('error', error));
  const output = formatPhase2FailureDiagnostic(state, new Error('hidden'));
  const diagnostic = JSON.parse(output);
  assert.equal(diagnostic.clientConnectionErrorType, 'Error');
  assert.equal(diagnostic.clientConnectionErrorCode, 'ECONNRESET');
  assert.equal(diagnostic.clientConnectionErrorCategory, 'CONNECTION_RESET');
  assert.equal(diagnostic.clientConnectionSqlState, null);
  for (const secret of ['postgresql://', 'password', 'private-host', 'socket reset']) {
    assert.equal(output.includes(secret), false);
  }
});

test('first checked-out client socket failure is preserved when later errors follow', () => {
  const state = createPhase2DiagnosticState();
  recordClientConnectionFailure(state, Object.assign(new Error('first'), { code: 'ECONNRESET' }));
  recordClientConnectionFailure(state, Object.assign(new Error('second'), { code: 'EPIPE' }));
  const diagnostic = JSON.parse(formatPhase2FailureDiagnostic(state, new Error('hidden')));
  assert.equal(diagnostic.clientConnectionErrorCode, 'ECONNRESET');
  assert.equal(diagnostic.clientConnectionErrorCategory, 'CONNECTION_RESET');
});

test('rollback timeout and closed-connection errors are categorized without raw details', () => {
  const state = createPhase2DiagnosticState();
  state.currentStage = 'CATALOG_CAPTURE';
  state.rollbackAttempted = true;
  state.rollbackSucceeded = false;
  state.transactionOutcome = 'UNKNOWN';
  recordRollbackFailure(state, new Error('Client was closed and is not queryable at postgresql://user:secret@host/db'));
  const output = formatPhase2FailureDiagnostic(state, new Error('hidden'));
  const diagnostic = JSON.parse(output);
  assert.equal(diagnostic.rollbackErrorType, 'Error');
  assert.equal(diagnostic.rollbackErrorCode, 'UNKNOWN');
  assert.equal(diagnostic.rollbackErrorCategory, 'CONNECTION_CLOSED');
  assert.equal(diagnostic.rollbackSqlState, null);
  for (const secret of ['postgresql://', 'secret', '@host', 'Client was closed']) assert.equal(output.includes(secret), false);
});

test('modification, post-verification, and commit failures preserve attempt and outcome state', () => {
  const modification = createPhase2DiagnosticState();
  modification.currentStage = 'SQL_MODIFICATION';
  modification.databaseConnectionEstablished = true;
  modification.transactionOpened = true;
  modification.snapshotCreated = true;
  modification.sqlModificationAttempted = true;
  const modificationOutput = JSON.parse(formatPhase2FailureDiagnostic(modification, Object.assign(new Error('hidden'), { code: '42501' })));
  assert.equal(modificationOutput.errorCode, 'SQL_MODIFICATION_FAILED');
  assert.equal(modificationOutput.sqlState, '42501');
  assert.equal(modificationOutput.sqlModificationAttempted, true);

  const postChange = createPhase2DiagnosticState();
  postChange.currentStage = 'POST_CHANGE_VERIFICATION';
  postChange.databaseConnectionEstablished = true;
  postChange.transactionOpened = true;
  postChange.snapshotCreated = true;
  postChange.sqlModificationAttempted = true;
  const postOutput = JSON.parse(formatPhase2FailureDiagnostic(postChange, { safeCode: 'RUNTIME_ROLE_ACL_NOT_EXACT' }));
  assert.equal(postOutput.errorCode, 'RUNTIME_ROLE_ACL_NOT_EXACT');
  assert.equal(postOutput.transactionCommitted, false);

  const commit = createPhase2DiagnosticState();
  commit.currentStage = 'COMMIT';
  commit.databaseConnectionEstablished = true;
  commit.transactionOpened = true;
  commit.snapshotCreated = true;
  commit.sqlModificationAttempted = true;
  commit.rollbackAttempted = true;
  commit.transactionOutcome = 'UNKNOWN';
  const commitOutput = JSON.parse(formatPhase2FailureDiagnostic(commit, { safeCode: 'COMMIT_FAILED' }));
  assert.equal(commitOutput.errorCode, 'COMMIT_FAILED');
  assert.equal(commitOutput.transactionCommitted, false);
  assert.equal(commitOutput.transactionOutcome, 'UNKNOWN');
});

test('failure output preserves only valid SQLSTATEs and never includes raw errors or secrets', () => {
  assert.equal(getSafeSqlState({ code: '23505' }), '23505');
  assert.equal(getSafeSqlState({ code: 'ERR_TLS_CERT_ALTNAME_INVALID' }), null);
  assert.equal(getSafeSqlState({ code: 'bad' }), null);

  const state = createPhase2DiagnosticState();
  state.currentStage = 'DATABASE_CONNECTION';
  const error = Object.assign(new Error('postgres://user:password@host/db token=abc CERTIFICATE_DATA'), { code: 'EACCES' });
  const output = formatPhase2FailureDiagnostic(state, error);
  for (const secret of ['postgres://', 'password', '@host', 'token=abc', 'CERTIFICATE_DATA', 'EACCES']) {
    assert.equal(output.includes(secret), false);
  }
  assert.doesNotMatch(output, /stack|message|hostname|username|parameters/i);
});

test('runner sets attempt flags immediately before changes and preserves cleanup failures', () => {
  assert.match(runner, /diagnostics\.sqlModificationAttempted = true;\s*await client\.query\(sqlToApply\)/);
  assert.match(runner, /const handle = await open\(path, 'wx'\);\s*diagnostics\.snapshotCreated = true/);
  assert.match(runner, /if \(transactionIsOpen && !diagnostics\.rollbackAttempted\)[\s\S]*?rollbackPhase2Transaction\(client, diagnostics\)/);
  assert.match(runner, /client\.release\(discardClient \? true : undefined\);\s*diagnostics\.clientReleased = true/);
  assert.match(runner, /await pool\.end\(\);\s*diagnostics\.poolClosed = true/);
  assert.match(runner, /if \(!failure\) failure = Object\.assign/);
  assert.match(runner, /transactionCommitted = true;\s*diagnostics\.transactionOutcome = 'COMMITTED'/);
  assert.match(runner, /formatPhase2FailureDiagnostic\(diagnostics, failure\)/);
  assert.match(diagnosticsSource, /transactionCommitted,[\s\S]*?rollbackAttempted/);
  assert.match(runner, /statement_timeout:\s*20_000/);
  assert.doesNotMatch(runner, /query_timeout:/);
  assert.match(runner, /diagnostics\.clientDiscarded = true/);
  assert.match(runner, /client\.on\('error',[\s\S]*?recordClientConnectionFailure\(diagnostics, error\)[\s\S]*?discardClient = true/);
  assert.match(runner, /client = await pool\.connect\(\);[\s\S]*?catch \(error\) \{\s*if \(!client && diagnostics\.currentStage === 'DATABASE_CONNECTION'\) \{\s*recordClientConnectionFailure\(diagnostics, error\);/);
  assert.match(diagnosticsSource, /clientConnectionErrorSyscall:[\s\S]*?clientConnectionErrorStage:/);
});

test('snapshot-only flow rolls back and returns before any SQL modification or commit path', () => {
  const snapshotOnlyBranch = runner.match(/if \(process\.argv\.includes\('--snapshot-only'\)\) \{([\s\S]*?)\n    \}/)?.[1];
  assert(snapshotOnlyBranch, 'snapshot-only branch should be present');
  assert.match(snapshotOnlyBranch, /rollbackPhase2Transaction\(client, diagnostics\)/);
  assert.match(snapshotOnlyBranch, /transactionIsOpen = false;\s*return snapshotPath;/);
  assert.doesNotMatch(snapshotOnlyBranch, /\b(?:CREATE|ALTER|DROP|GRANT|REVOKE)\b|client\.query\('COMMIT'\)/i);
  assert(runner.indexOf("if (process.argv.includes('--snapshot-only'))") < runner.indexOf('const sqlToApply'));
  assert.match(runner, /diagnostics\.sqlModificationAttempted = true;\s*await client\.query\(sqlToApply\)/);
  assert.match(runner, /await client\.query\('COMMIT'\)/);
});

test('runner module loads without invoking its database CLI entrypoint', async () => {
  await import('./supabase-test-runtime-role-phase2.mjs');
});
