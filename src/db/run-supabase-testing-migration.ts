import { spawn } from 'node:child_process';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import {
  collectDatabaseSecrets,
  redactMigrationOutput,
} from './migration-output-redaction';
import {
  SUPABASE_TEST_PROJECT_REF_VALUE,
  validateSupabaseTestingDatabaseTarget,
} from './supabase-testing-config-validation';
import { resolveProjectRootFromConfigUrl } from './drizzle-config-validation';

const expectedConfigArgument = '--config=src/db/supabase-testing.drizzle.config.ts';
const projectRoot = resolveProjectRootFromConfigUrl(import.meta.url);
const configured = process.argv.length === 3 && process.argv[2] === expectedConfigArgument;

if (!configured) {
  console.error('The Supabase testing migration runner requires its fixed Drizzle configuration.');
  process.exitCode = 1;
} else {
  dotenv.config({ path: resolve(projectRoot, '.env') });

  try {
    const target = validateSupabaseTestingDatabaseTarget(
      {
        SUPABASE_TEST_DATABASE_URL: process.env.SUPABASE_TEST_DATABASE_URL,
        SUPABASE_TEST_CA_CERT: process.env.SUPABASE_TEST_CA_CERT,
      },
      projectRoot,
    );
    const connectionUrl = process.env.SUPABASE_TEST_DATABASE_URL ?? '';
    const secrets = collectDatabaseSecrets(connectionUrl, target);
    await assertSupabaseTestingDatabaseIsEmpty(target);

    const drizzleKitCli = resolve(projectRoot, 'node_modules', 'drizzle-kit', 'bin.cjs');
    const configPath = resolve(projectRoot, 'src', 'db', 'supabase-testing.drizzle.config.ts');
    const child = spawn(process.execPath, [drizzleKitCli, 'migrate', `--config=${configPath}`], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let spawnError = '';

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', (error: Error) => {
      spawnError = error.message;
    });
    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      process.stdout.write(redactMigrationOutput(stdout, secrets));
      process.stderr.write(redactMigrationOutput(`${stderr}${spawnError}`, secrets));

      if (code === null) {
        if (signal) process.stderr.write(`Drizzle Kit stopped after signal ${signal}.\n`);
        process.exitCode = 1;
        return;
      }
      process.exitCode = code >= 0 ? code : 1;
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Supabase testing migration configuration is invalid.';
    process.stderr.write(`${redactMigrationOutput(`${message}\n`, secretsFromEnvironment())}`);
    process.exitCode = 1;
  }
}

async function assertSupabaseTestingDatabaseIsEmpty(
  target: ReturnType<typeof validateSupabaseTestingDatabaseTarget>,
): Promise<void> {
  const pool = new Pool({
    host: target.host,
    port: target.port,
    user: target.user,
    password: target.password,
    database: target.database,
    ssl: target.ssl,
    max: 1,
    connectionTimeoutMillis: 10_000,
    query_timeout: 10_000,
    statement_timeout: 10_000,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const identity = await client.query(
        'SELECT current_database() AS database_name, current_user AS connected_role',
      );
      if (
        identity.rows[0]?.database_name !== 'postgres' ||
        !['postgres', target.user].includes(identity.rows[0]?.connected_role)
      ) {
        throw new Error('Connected database identity did not match the verified Supabase testing project.');
      }

      const appObjects = await client.query(`
        SELECT n.nspname AS schema_name, c.relname AS object_name
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p', 'f')
          AND n.nspname NOT IN (
            'pg_catalog', 'information_schema', 'auth', 'storage', 'extensions',
            'graphql', 'graphql_public', 'realtime', 'supabase_functions',
            'supabase_migrations', 'vault', 'cron', 'net', 'pgbouncer',
            '_realtime', 'pgsodium', 'pgsodium_masks'
          )
          AND left(n.nspname, 3) <> 'pg_'
          AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_depend d
            WHERE d.classid = 'pg_catalog.pg_class'::regclass
              AND d.objid = c.oid AND d.deptype = 'e'
          )
      `);
      const customSchemas = await client.query(`
        SELECT nspname
        FROM pg_catalog.pg_namespace
        WHERE nspname NOT IN (
          'pg_catalog', 'information_schema', 'public', 'auth', 'storage',
          'extensions', 'graphql', 'graphql_public', 'realtime',
          'supabase_functions', 'supabase_migrations', 'vault', 'cron', 'net',
          'pgbouncer', '_realtime', 'pgsodium', 'pgsodium_masks'
        )
          AND left(nspname, 3) <> 'pg_'
      `);

      if (appObjects.rowCount !== 0 || customSchemas.rowCount !== 0) {
        throw new Error('Supabase testing database is not empty; refusing to run migrations.');
      }
      await client.query('ROLLBACK');
      process.stdout.write(
        `Verified empty RentFlow application schema on Supabase project ${SUPABASE_TEST_PROJECT_REF_VALUE}; starting journaled migrations.\n`,
      );
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The read-only transaction may already be closed.
      }
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

function secretsFromEnvironment(): string[] {
  const connectionUrl = process.env.SUPABASE_TEST_DATABASE_URL ?? '';
  const secrets = [connectionUrl];
  try {
    const target = validateSupabaseTestingDatabaseTarget(
      {
        SUPABASE_TEST_DATABASE_URL: connectionUrl,
        SUPABASE_TEST_CA_CERT: process.env.SUPABASE_TEST_CA_CERT,
      },
      projectRoot,
    );
    secrets.push(...collectDatabaseSecrets(connectionUrl, target));
  } catch {
    // Keep configuration failures generic and never echo the URL.
  }
  return secrets;
}
