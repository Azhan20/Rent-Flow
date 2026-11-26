import * as dotenv from 'dotenv';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { resolveProjectRootFromConfigUrl } from './drizzle-config-validation';
import { validateSupabaseTestingDatabaseTarget } from './supabase-testing-config-validation';
import {
  assertLocalJournal,
  executeSingleBillingRepair,
  parseAllowlistFileArgument,
  parseAuditedJournalHashAllowlist,
  resolveExternalAllowlistPath,
  sha256,
  type LocalJournalEntry,
} from './supabase-billing-repair-runner';

const projectRoot = resolveProjectRootFromConfigUrl(import.meta.url);
const migrationDirectory = resolve(projectRoot, 'drizzle');
const migrationNames = [
  '0001_rentflow_foundation',
  '0002_account_level_billing',
  '0003_saas_entitlements_usage',
  '0004_reconcile_applied_foundation_constraints',
  '0005_reconcile_billing_schema_drift',
] as const;

async function main(): Promise<void> {
  let pool: Pool | undefined;
  try {
    const allowlistArgument = parseAllowlistFileArgument(process.argv.slice(2));
    const resolvedAllowlist = resolveExternalAllowlistPath(allowlistArgument, projectRoot);
    const allowlistPath = realpathSync(resolvedAllowlist);
    resolveExternalAllowlistPath(allowlistPath, projectRoot);
    if (!statSync(allowlistPath).isFile()) {
      throw new Error('The external journal allowlist path must be a regular file.');
    }
    const auditedHashes = parseAuditedJournalHashAllowlist(readFileSync(allowlistPath, 'utf8'));
    dotenv.config({ path: resolve(projectRoot, '.env') });
    const target = validateSupabaseTestingDatabaseTarget({
      SUPABASE_TEST_DATABASE_URL: process.env.SUPABASE_TEST_DATABASE_URL,
      SUPABASE_TEST_CA_CERT: process.env.SUPABASE_TEST_CA_CERT,
    }, projectRoot);
    if (target.database !== 'postgres' || !target.user.startsWith('postgres.')
      || target.ssl.rejectUnauthorized !== true || target.ssl.servername !== target.host || !target.ssl.ca) {
      throw new Error('The validated Supabase TEST migration target or strict TLS settings are unexpected.');
    }

    const journal = JSON.parse(readFileSync(resolve(migrationDirectory, 'meta/_journal.json'), 'utf8')) as {
      entries: LocalJournalEntry[];
    };
    assertLocalJournal(journal.entries);

    const migrationSql = readFileSync(resolve(migrationDirectory, `${migrationNames[4]}.sql`), 'utf8');
    const localMigrationHashes = migrationNames.map((name) =>
      sha256(readFileSync(resolve(migrationDirectory, `${name}.sql`))));

    pool = new Pool({
      host: target.host,
      port: target.port,
      user: target.user,
      password: target.password,
      database: target.database,
      ssl: target.ssl,
      application_name: 'rentflow_test_migration_0005_only',
      max: 1,
      connectionTimeoutMillis: 10_000,
      query_timeout: 120_000,
      statement_timeout: 120_000,
    });

    const client = await pool.connect();
    try {
      await executeSingleBillingRepair(client, {
        migrationSql,
        localMigrationHashes,
        localJournal: journal.entries,
        auditedJournalHashes: auditedHashes,
      });
    } finally {
      client.release();
    }
    process.stdout.write('TEST billing schema repair 0005 completed and its journal record committed.\n');
  } catch {
    process.stderr.write('TEST billing schema repair 0005 stopped; no success is asserted. Review safe diagnostics before retrying.\n');
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}

await main();
