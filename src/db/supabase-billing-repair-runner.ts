import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { PoolClient } from 'pg';

export const BILLING_REPAIR_MIGRATION_TAG = '0005_reconcile_billing_schema_drift';
export const BILLING_REPAIR_MIGRATION_TIME = 1795464746000;
export const BILLING_REPAIR_MIGRATION_SHA256 = 'e9792f0bd9c459d4a329bd3e89a15d5fc518fff7db39dfd027f258108aaa1475';
export const AUDITED_LOCAL_MIGRATION_SHA256 = [
  '1b5cd2c2856f17cf9644ee896308b08f7272018b802f074118c70ee453b53683',
  'b0a79112976a6ba8f3dbc3811b4e67d212f5a3de35a464214fbc4a806f22301f',
  '217f8ed05fcafc7bf6d05169ff8e8f92080123671b04f5476bd957ab0e272429',
  '21c373e5c661c5ac136b34f79cf413291614a86c144101d64a3d8ab82c2368c9',
  BILLING_REPAIR_MIGRATION_SHA256,
] as const;
export const EXPECTED_JOURNAL_PREFIX = [
  { idx: 0, when: 1794528000000, tag: '0001_rentflow_foundation' },
  { idx: 1, when: 1794907539474, tag: '0002_account_level_billing' },
  { idx: 2, when: 1794907539475, tag: '0003_saas_entitlements_usage' },
  { idx: 3, when: 1794907539476, tag: '0004_reconcile_applied_foundation_constraints' },
] as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type AuditedJournalHashes = { migration0002: string; migration0003: string };
export type DatabaseIdentity = { database_name: string; current_user: string; session_user: string };
export type JournalRow = { hash: string; created_at: string | number | bigint };
export type LocalJournalEntry = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };
export type MigrationPreconditions = {
  subscription_table_ok: boolean;
  status_constraint_ok: boolean;
  status_related_constraint_count: number;
  payment_verification_column_absent: boolean;
  trial_verification_constraint_absent: boolean;
  event_table_absent: boolean;
  event_function_absent: boolean;
};

export function assertMigrationPreconditions(preconditions: MigrationPreconditions | undefined): void {
  if (!preconditions || !preconditions.subscription_table_ok || !preconditions.status_constraint_ok
    || Number(preconditions.status_related_constraint_count) !== 1
    || !preconditions.payment_verification_column_absent
    || !preconditions.trial_verification_constraint_absent
    || !preconditions.event_table_absent || !preconditions.event_function_absent) {
    throw new Error('TEST schema does not match the audited pre-migration state for migration 0005.');
  }
}

export function parseAllowlistFileArgument(args: readonly string[]): string {
  if (args.length !== 2 || args[0] !== '--allowlist-file' || !args[1] || !isAbsolute(args[1])) {
    throw new Error('Provide exactly one absolute --allowlist-file path outside the repository.');
  }
  return args[1];
}

export function resolveExternalAllowlistPath(filePath: string, projectRoot: string): string {
  if (!isAbsolute(filePath)) {
    throw new Error('The journal allowlist path must be absolute.');
  }
  const resolvedPath = resolve(filePath);
  const relativePath = relative(resolve(projectRoot), resolvedPath);
  const outsideRepository = relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
  if (!relativePath || !outsideRepository) {
    throw new Error('The journal allowlist must be stored outside the repository.');
  }
  return resolvedPath;
}

export function parseAuditedJournalHashAllowlist(jsonText: string): AuditedJournalHashes {
  assertNoDuplicateJsonKeys(jsonText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('The journal allowlist must be valid JSON with the reviewed structure.');
  }
  if (!isRecord(parsed) || !hasExactKeys(parsed, ['version', 'migrationHashes']) || parsed.version !== 1
    || !isRecord(parsed.migrationHashes)
    || !hasExactKeys(parsed.migrationHashes, ['0002_account_level_billing', '0003_saas_entitlements_usage'])) {
    throw new Error('The journal allowlist must contain only version and the exact 0002/0003 migration hash entries.');
  }
  const migration0002 = parsed.migrationHashes['0002_account_level_billing'];
  const migration0003 = parsed.migrationHashes['0003_saas_entitlements_usage'];
  if (typeof migration0002 !== 'string' || typeof migration0003 !== 'string'
    || !SHA256_PATTERN.test(migration0002) || !SHA256_PATTERN.test(migration0003)) {
    throw new Error('The journal allowlist hashes must be exactly 64 lowercase SHA-256 hexadecimal characters.');
  }
  return { migration0002, migration0003 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function assertNoDuplicateJsonKeys(text: string): void {
  let cursor = 0;
  const whitespace = () => { while (/\s/.test(text[cursor] ?? '')) cursor += 1; };
  const parseStringToken = (): string => {
    const start = cursor;
    if (text[cursor] !== '"') throw new Error('invalid JSON');
    cursor += 1;
    while (cursor < text.length) {
      if (text[cursor] === '\\') cursor += 2;
      else if (text[cursor++] === '"') {
        return JSON.parse(text.slice(start, cursor)) as string;
      }
    }
    throw new Error('invalid JSON');
  };
  const parseValue = (): void => {
    whitespace();
    if (text[cursor] === '"') { parseStringToken(); return; }
    if (text[cursor] === '{') {
      cursor += 1;
      whitespace();
      if (text[cursor] === '}') { cursor += 1; return; }
      const keys = new Set<string>();
      while (cursor < text.length) {
        whitespace();
        const key = parseStringToken();
        if (keys.has(key)) throw new Error('duplicate JSON key');
        keys.add(key);
        whitespace();
        if (text[cursor++] !== ':') throw new Error('invalid JSON');
        parseValue();
        whitespace();
        const separator = text[cursor++];
        if (separator === '}') return;
        if (separator !== ',') throw new Error('invalid JSON');
      }
      throw new Error('invalid JSON');
    }
    if (text[cursor] === '[') {
      cursor += 1;
      whitespace();
      if (text[cursor] === ']') { cursor += 1; return; }
      while (cursor < text.length) {
        parseValue();
        whitespace();
        const separator = text[cursor++];
        if (separator === ']') return;
        if (separator !== ',') throw new Error('invalid JSON');
      }
      throw new Error('invalid JSON');
    }
    const start = cursor;
    while (cursor < text.length && !/[\s,}\]]/.test(text[cursor])) cursor += 1;
    if (start === cursor) throw new Error('invalid JSON');
    JSON.parse(text.slice(start, cursor));
  };

  try {
    whitespace();
    parseValue();
    whitespace();
    if (cursor !== text.length) throw new Error('invalid JSON');
  } catch {
    throw new Error('The journal allowlist must be valid JSON without duplicate object keys.');
  }
}

export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function assertPinnedMigration(sql: string): string {
  const hash = sha256(sql);
  if (hash !== BILLING_REPAIR_MIGRATION_SHA256) {
    throw new Error('Migration 0005 content does not match the reviewed execution pin.');
  }
  return hash;
}

export function assertLocalJournal(entries: readonly LocalJournalEntry[]): void {
  if (entries.length !== 5 || entries.some((entry, idx) => {
    const expected = [...EXPECTED_JOURNAL_PREFIX, {
      idx: 4,
      version: '7',
      when: BILLING_REPAIR_MIGRATION_TIME,
      tag: BILLING_REPAIR_MIGRATION_TAG,
    }][idx];
    return !expected || entry.idx !== expected.idx || entry.version !== '7' || entry.when !== expected.when
      || entry.tag !== expected.tag || entry.breakpoints !== true;
  })) {
    throw new Error('Local migration journal is not the reviewed 0001–0005 sequence.');
  }
}

export function assertTestDatabaseIdentity(identity: DatabaseIdentity | undefined): void {
  if (identity?.database_name !== 'postgres' || identity.current_user !== 'postgres'
    || identity.session_user !== 'postgres') {
    throw new Error('Connected database identity is not the approved Supabase TEST migration principal.');
  }
}

export function assertPriorJournalState(
  rows: readonly JournalRow[],
  localHashes: readonly string[],
  auditedHashes: AuditedJournalHashes,
): void {
  if (localHashes.length !== 5 || localHashes.some((hash) => !SHA256_PATTERN.test(hash))) {
    throw new Error('Local migration hash set is incomplete or invalid.');
  }
  if (localHashes.some((hash, index) => hash !== AUDITED_LOCAL_MIGRATION_SHA256[index])) {
    throw new Error('Local migration files differ from the audited 0001–0005 source hashes.');
  }
  if (!SHA256_PATTERN.test(auditedHashes.migration0002)
    || !SHA256_PATTERN.test(auditedHashes.migration0003)
    || auditedHashes.migration0002 === localHashes[1]
    || auditedHashes.migration0003 === localHashes[2]) {
    throw new Error('Audited 0002/0003 hashes must match the previously observed drifted revisions.');
  }
  if (rows.length !== EXPECTED_JOURNAL_PREFIX.length) {
    throw new Error('Database migration journal is not exactly the audited 0001–0004 state.');
  }
  const expectedHashes = [localHashes[0], auditedHashes.migration0002, auditedHashes.migration0003, localHashes[3]];
  rows.forEach((row, index) => {
    const expected = EXPECTED_JOURNAL_PREFIX[index];
    if (Number(row.created_at) !== expected.when || row.hash !== expectedHashes[index]) {
      throw new Error('Database migration journal differs from the audited 0001–0004 hashes or ordering.');
    }
  });
}

export async function executeSingleBillingRepair(
  client: Pick<PoolClient, 'query'>,
  options: {
    migrationSql: string;
    localMigrationHashes: readonly string[];
    localJournal: readonly LocalJournalEntry[];
    auditedJournalHashes: AuditedJournalHashes;
  },
): Promise<void> {
  assertLocalJournal(options.localJournal);
  const migrationHash = assertPinnedMigration(options.migrationSql);
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_catalog.pg_advisory_xact_lock(1381192788, 5)');
    const identityResult = await client.query<DatabaseIdentity>(
      'SELECT current_database() AS database_name, current_user, session_user',
    );
    assertTestDatabaseIdentity(identityResult.rows[0]);

    const priorJournalResult = await client.query<JournalRow>(
      'SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at, id',
    );
    assertPriorJournalState(priorJournalResult.rows, options.localMigrationHashes, options.auditedJournalHashes);

    const preconditions = await client.query<MigrationPreconditions>(`
      SELECT
        to_regclass('public.rf_account_subscriptions') IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM pg_catalog.pg_class c
            WHERE c.oid = to_regclass('public.rf_account_subscriptions') AND c.relkind IN ('r','p')
          )
          AND EXISTS (
            SELECT 1 FROM pg_catalog.pg_attribute a
            WHERE a.attrelid = to_regclass('public.rf_account_subscriptions') AND a.attname = 'id'
              AND a.atttypid = 'uuid'::regtype AND a.attnotnull AND a.attnum > 0 AND NOT a.attisdropped
          )
          AND EXISTS (
            SELECT 1 FROM pg_catalog.pg_attribute a
            WHERE a.attrelid = to_regclass('public.rf_account_subscriptions') AND a.attname = 'status'
              AND a.atttypid = 'text'::regtype AND a.attnotnull AND a.attnum > 0 AND NOT a.attisdropped
          ) AS subscription_table_ok,
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_constraint con
          WHERE con.conrelid = to_regclass('public.rf_account_subscriptions')
            AND con.conname = 'rf_account_subscriptions_status_ck' AND con.contype = 'c' AND con.convalidated
            AND lower(regexp_replace(pg_catalog.pg_get_constraintdef(con.oid, true), '[[:space:]]+', '', 'g'))
              = 'check(status=any(array[''pending''::text,''trialing''::text,''active''::text,''past_due''::text,''cancelled''::text,''expired''::text]))'
        ) AS status_constraint_ok,
        (SELECT count(*)::integer FROM pg_catalog.pg_constraint con
         WHERE con.conrelid = to_regclass('public.rf_account_subscriptions') AND con.contype = 'c'
           AND position('status' IN lower(pg_catalog.pg_get_constraintdef(con.oid, true))) > 0) AS status_related_constraint_count,
        NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = to_regclass('public.rf_account_subscriptions') AND a.attname = 'payment_method_verified_at'
            AND a.attnum > 0 AND NOT a.attisdropped
        ) AS payment_verification_column_absent,
        NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_constraint con
          WHERE con.conrelid = to_regclass('public.rf_account_subscriptions')
            AND con.conname = 'rf_account_subscriptions_trial_payment_method_ck'
        ) AS trial_verification_constraint_absent,
        to_regclass('public.rf_account_subscription_events') IS NULL AS event_table_absent,
        NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'rf_reject_account_subscription_event_mutation'
            AND p.pronargs = 0
        ) AS event_function_absent
    `);
    assertMigrationPreconditions(preconditions.rows[0]);

    // The pinned SQL includes 0005's full preflight, repair, and postflight blocks.
    // Send it as one simple-protocol query so dollar-quoted blocks remain intact.
    await client.query(options.migrationSql);
    await client.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      [migrationHash, BILLING_REPAIR_MIGRATION_TIME],
    );

    const committedJournal = await client.query<JournalRow>(
      'SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at, id',
    );
    if (committedJournal.rows.length !== 5
      || Number(committedJournal.rows[4]?.created_at) !== BILLING_REPAIR_MIGRATION_TIME
      || committedJournal.rows[4]?.hash !== migrationHash) {
      throw new Error('Post-migration journal verification failed.');
    }
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original failure; PostgreSQL rolls back an open transaction when the connection closes.
    }
    throw error;
  }
}
