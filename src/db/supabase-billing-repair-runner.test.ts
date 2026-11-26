import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateSupabaseTestingDatabaseTarget } from './supabase-testing-config-validation';
import {
  assertLocalJournal,
  assertMigrationPreconditions,
  assertPinnedMigration,
  parseAllowlistFileArgument,
  parseAuditedJournalHashAllowlist,
  assertPriorJournalState,
  assertTestDatabaseIdentity,
  executeSingleBillingRepair,
  EXPECTED_JOURNAL_PREFIX,
  resolveExternalAllowlistPath,
  sha256,
  type AuditedJournalHashes,
  type JournalRow,
  type LocalJournalEntry,
  type MigrationPreconditions,
} from './supabase-billing-repair-runner';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const journal = JSON.parse(readFileSync(resolve(root, 'drizzle/meta/_journal.json'), 'utf8')) as {
  entries: LocalJournalEntry[];
};
const migrationSql = readFileSync(resolve(root, 'drizzle/0005_reconcile_billing_schema_drift.sql'), 'utf8');
const migrationNames = [
  '0001_rentflow_foundation',
  '0002_account_level_billing',
  '0003_saas_entitlements_usage',
  '0004_reconcile_applied_foundation_constraints',
  '0005_reconcile_billing_schema_drift',
];
const localHashes = migrationNames.map((name) =>
  sha256(readFileSync(resolve(root, `drizzle/${name}.sql`))));
const auditedHashes: AuditedJournalHashes = {
  migration0002: 'a'.repeat(64),
  migration0003: 'b'.repeat(64),
};
const expectedRows: JournalRow[] = EXPECTED_JOURNAL_PREFIX.map((entry, index) => ({
  hash: [localHashes[0], auditedHashes.migration0002, auditedHashes.migration0003, localHashes[3]][index],
  created_at: entry.when,
}));
const expectedPreconditions: MigrationPreconditions = {
  subscription_table_ok: true,
  status_constraint_ok: true,
  status_related_constraint_count: 1,
  payment_verification_column_absent: true,
  trial_verification_constraint_absent: true,
  event_table_absent: true,
  event_function_absent: true,
};

test('allowlist parser accepts the exact structure and lowercase SHA-256 values only', () => {
  const valid = JSON.stringify({
    version: 1,
    migrationHashes: {
      '0002_account_level_billing': auditedHashes.migration0002,
      '0003_saas_entitlements_usage': auditedHashes.migration0003,
    },
  });
  assert.deepEqual(parseAuditedJournalHashAllowlist(valid), auditedHashes);
  assert.throws(() => parseAuditedJournalHashAllowlist('{broken json'), /valid JSON/);
  assert.throws(() => parseAuditedJournalHashAllowlist(JSON.stringify({ version: 1, migrationHashes: {} })), /exact 0002\/0003/);
  assert.throws(() => parseAuditedJournalHashAllowlist(JSON.stringify({
    version: 1,
    migrationHashes: {
      '0002_account_level_billing': auditedHashes.migration0002,
      '0003_saas_entitlements_usage': auditedHashes.migration0003,
      extra: 'f'.repeat(64),
    },
  })), /exact 0002\/0003/);
  assert.throws(() => parseAuditedJournalHashAllowlist(JSON.stringify({
    version: 1,
    migrationHashes: {
      '0002_account_level_billing': 'A'.repeat(64),
      '0003_saas_entitlements_usage': auditedHashes.migration0003,
    },
  })), /64 lowercase SHA-256/);
  assert.throws(() => parseAuditedJournalHashAllowlist(JSON.stringify({
    version: 1,
    migrationHashes: {
      '0002_account_level_billing': 'f'.repeat(63),
      '0003_saas_entitlements_usage': auditedHashes.migration0003,
    },
  })), /64 lowercase SHA-256/);
  assert.throws(() => parseAuditedJournalHashAllowlist(
    `{"version":1,"version":1,"migrationHashes":{"0002_account_level_billing":"${auditedHashes.migration0002}","0003_saas_entitlements_usage":"${auditedHashes.migration0003}"}}`,
  ), /duplicate object keys/);
  assert.throws(() => parseAuditedJournalHashAllowlist(
    `{"version":1,"migrationHashes":{"0002_account_level_billing":"${auditedHashes.migration0002}","0002_account_level_billing":"${auditedHashes.migration0002}","0003_saas_entitlements_usage":"${auditedHashes.migration0003}"}}`,
  ), /duplicate object keys/);
});

test('allowlist path is explicit, absolute, and outside the repository', () => {
  assert.equal(parseAllowlistFileArgument(['--allowlist-file', 'C:\\Users\\tester\\AppData\\Local\\RentFlow\\hashes.json']), 'C:\\Users\\tester\\AppData\\Local\\RentFlow\\hashes.json');
  assert.throws(() => parseAllowlistFileArgument([]), /absolute --allowlist-file/);
  assert.throws(() => parseAllowlistFileArgument(['--allowlist-file', 'relative\\hashes.json']), /absolute --allowlist-file/);
  assert.throws(() => parseAllowlistFileArgument(['--allowlist-file', 'C:\\x', '--other']), /absolute --allowlist-file/);
  assert.throws(() => resolveExternalAllowlistPath(resolve(root, 'hashes.json'), root), /outside the repository/);
  assert.equal(resolveExternalAllowlistPath('C:\\Users\\tester\\AppData\\Local\\RentFlow\\hashes.json', root), 'C:\\Users\\tester\\AppData\\Local\\RentFlow\\hashes.json');
});

test('validates the precise local journal sequence and pinned migration 0005 contents', () => {
  assert.doesNotThrow(() => assertLocalJournal(journal.entries));
  assert.throws(() => assertLocalJournal(journal.entries.slice(0, 4)), /not the reviewed 0001–0005 sequence/);
  assert.equal(assertPinnedMigration(migrationSql), localHashes[4]);
  assert.throws(() => assertPinnedMigration(`${migrationSql}\n-- altered`), /reviewed execution pin/);
});

test('accepts only the known four-entry database journal and exact audited hash drift', () => {
  assert.doesNotThrow(() => assertPriorJournalState(expectedRows, localHashes, auditedHashes));
  assert.throws(() => assertPriorJournalState(
    [...expectedRows, { hash: 'c'.repeat(64), created_at: 1795464746000 }],
    localHashes,
    auditedHashes,
  ), /not exactly the audited 0001–0004 state/);
  assert.throws(() => assertPriorJournalState(
    expectedRows.map((row, index) => index === 1 ? { ...row, hash: 'c'.repeat(64) } : row),
    localHashes,
    auditedHashes,
  ), /differs from the audited 0001–0004 hashes/);
  assert.throws(() => assertPriorJournalState(expectedRows, localHashes, {
    migration0002: localHashes[1],
    migration0003: auditedHashes.migration0003,
  }), /previously observed drifted revisions/);
});

test('requires the complete audited 0005 schema precondition state before sending migration SQL', () => {
  assert.doesNotThrow(() => assertMigrationPreconditions(expectedPreconditions));
  for (const key of [
    'subscription_table_ok',
    'status_constraint_ok',
    'payment_verification_column_absent',
    'trial_verification_constraint_absent',
    'event_table_absent',
    'event_function_absent',
  ] as const) {
    assert.throws(() => assertMigrationPreconditions({ ...expectedPreconditions, [key]: false }));
  }
  assert.throws(() => assertMigrationPreconditions({ ...expectedPreconditions, status_related_constraint_count: 2 }));
});

test('requires PostgreSQL database and both role identities to match the dedicated TEST connection', () => {
  assert.doesNotThrow(() => assertTestDatabaseIdentity({
    database_name: 'postgres', current_user: 'postgres', session_user: 'postgres',
  }));
  assert.throws(() => assertTestDatabaseIdentity({
    database_name: 'production', current_user: 'postgres', session_user: 'postgres',
  }), /not the approved Supabase TEST migration principal/);
  assert.throws(() => assertTestDatabaseIdentity({
    database_name: 'postgres', current_user: 'unexpected', session_user: 'postgres',
  }), /not the approved Supabase TEST migration principal/);
  assert.throws(() => assertTestDatabaseIdentity({
    database_name: 'postgres', current_user: 'rentflow_runtime_login', session_user: 'rentflow_runtime_login',
  }), /not the approved Supabase TEST migration principal/);
  assert.throws(() => validateSupabaseTestingDatabaseTarget({
    SUPABASE_TEST_DATABASE_URL: 'postgresql://user:placeholder@production.example.com:5432/postgres',
  }, root), /exact approved Supabase testing pooler/);
  const entryPoint = readFileSync(resolve(root, 'src/db/run-supabase-testing-billing-repair.ts'), 'utf8');
  assert.match(entryPoint, /validateSupabaseTestingDatabaseTarget/);
  assert.doesNotMatch(entryPoint, /drizzle-kit|spawn\(|journal-000[23]-sha256/i);
  assert.match(entryPoint, /parseAllowlistFileArgument/);
});

test('rolls back the entire transaction when migration SQL fails', async () => {
  const statements: string[] = [];
  let reachedMigration = false;
  const fakeClient = {
    async query(sql: string) {
      statements.push(sql);
      if (sql === 'SELECT current_database() AS database_name, current_user, session_user') {
        return { rows: [{ database_name: 'postgres', current_user: 'postgres', session_user: 'postgres' }] };
      }
      if (sql.startsWith('SELECT hash, created_at FROM drizzle.__drizzle_migrations')) {
        return { rows: expectedRows };
      }
      if (sql.includes('status_related_constraint_count')) return { rows: [expectedPreconditions] };
      if (sql === migrationSql) {
        reachedMigration = true;
        throw new Error('simulated SQL failure');
      }
      return { rows: [] };
    },
  };

  await assert.rejects(() => executeSingleBillingRepair(fakeClient as never, {
    migrationSql,
    localMigrationHashes: localHashes,
    localJournal: journal.entries,
    auditedJournalHashes: auditedHashes,
  }), /simulated SQL failure/);
  assert.equal(reachedMigration, true);
  assert.equal(statements.at(-1), 'ROLLBACK');
  assert.equal(statements.includes('COMMIT'), false);
});

test('rolls back and never sends migration SQL when database identity is unexpected', async () => {
  const statements: string[] = [];
  const fakeClient = {
    async query(sql: string) {
      statements.push(sql);
      if (sql === 'SELECT current_database() AS database_name, current_user, session_user') {
        return { rows: [{ database_name: 'production', current_user: 'postgres', session_user: 'postgres' }] };
      }
      return { rows: [] };
    },
  };
  await assert.rejects(() => executeSingleBillingRepair(fakeClient as never, {
    migrationSql,
    localMigrationHashes: localHashes,
    localJournal: journal.entries,
    auditedJournalHashes: auditedHashes,
  }), /not the approved Supabase TEST/);
  assert.equal(statements.includes(migrationSql), false);
  assert.equal(statements.at(-1), 'ROLLBACK');
});
