import * as dotenv from 'dotenv';
import { isAbsolute, resolve } from 'node:path';
import { validateSupabaseTestingDatabaseTarget } from '../../src/db/supabase-testing-config-validation';
import { resolveProjectRootFromConfigUrl } from '../../src/db/drizzle-config-validation';

const projectRoot = resolveProjectRootFromConfigUrl(import.meta.url);
const requestedCaPath = process.env.RENTFLOW_TEST_BACKUP_CA_PATH;

try {
  dotenv.config({ path: resolve(projectRoot, '.env'), override: true, quiet: true });
  const configuredCaPath = process.env.SUPABASE_TEST_CA_CERT;
  if (!requestedCaPath || !configuredCaPath || !isAbsolute(requestedCaPath) || !isAbsolute(configuredCaPath)
    || resolve(requestedCaPath).toLowerCase() !== resolve(configuredCaPath).toLowerCase()) {
    throw new Error('The supplied CA path does not match the validated local TEST CA setting.');
  }
  const target = validateSupabaseTestingDatabaseTarget({
    SUPABASE_TEST_DATABASE_URL: process.env.SUPABASE_TEST_DATABASE_URL,
    SUPABASE_TEST_CA_CERT: configuredCaPath,
  }, projectRoot);

  // Emit only non-secret identity metadata. Never serialize credentials, certificate content, or local paths.
  process.stdout.write(`${JSON.stringify({
    host: target.host,
    port: target.port,
    database: target.database,
    user: target.user,
    sslmode: 'verify-full',
    rejectUnauthorized: target.ssl.rejectUnauthorized,
    servername: target.ssl.servername,
  })}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : '';

  const safeMessages = new Set([
    'The supplied CA path does not match the validated local TEST CA setting.',
    'SUPABASE_TEST_DATABASE_URL is required for the Supabase testing target.',
    'SUPABASE_TEST_DATABASE_URL must be a valid PostgreSQL URL.',
    'SUPABASE_TEST_DATABASE_URL must use the PostgreSQL protocol.',
    'SUPABASE_TEST_DATABASE_URL must use the exact approved Supabase testing pooler.',
    'SUPABASE_TEST_DATABASE_URL must use the approved Supabase session pooler port.',
    'SUPABASE_TEST_DATABASE_URL must select the postgres testing database.',
    'SUPABASE_TEST_DATABASE_URL contains invalid encoded credentials.',
    'SUPABASE_TEST_DATABASE_URL must use the TEST project migration login.',
    'SUPABASE_TEST_CA_CERT must be an absolute path to the Supabase project CA certificate.',
    'SUPABASE_TEST_CA_CERT could not be loaded as an X.509 certificate.',
    'SUPABASE_TEST_CA_CERT must be a currently valid CA certificate.',
  ]);

  process.stderr.write(
    `${safeMessages.has(message) ? message : 'Unexpected validation error; details withheld.'} No connection was attempted.\n`,
  );
  process.exitCode = 1;
}

