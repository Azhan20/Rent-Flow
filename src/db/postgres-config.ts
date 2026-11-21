import { validateSupabaseTestRuntimeDatabaseTarget } from './supabase-testing-config-validation';

export type PostgresEnvironment = {
  NODE_ENV?: string;
  RENTFLOW_DATABASE_TARGET?: string;
  DATABASE_URL?: string;
  DATABASE_SSL?: string;
  SUPABASE_TEST_DATABASE_URL?: string;
  SUPABASE_TEST_RUNTIME_DATABASE_URL?: string;
  SUPABASE_TEST_CA_CERT?: string;
};

export type PostgresPoolOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: { rejectUnauthorized: true } | {
    ca: string;
    rejectUnauthorized: true;
    servername: string;
  } | undefined;
  max: 10;
  connectionTimeoutMillis: 15_000;
};

/** Selects the database role explicitly; the Supabase TEST path never falls back to another URL. */
export function createApplicationPoolOptions(env: PostgresEnvironment): PostgresPoolOptions {
  if (env.RENTFLOW_DATABASE_TARGET === 'supabase-test-runtime') {
    const target = validateSupabaseTestRuntimeDatabaseTarget({
      SUPABASE_TEST_RUNTIME_DATABASE_URL: env.SUPABASE_TEST_RUNTIME_DATABASE_URL,
      SUPABASE_TEST_CA_CERT: env.SUPABASE_TEST_CA_CERT,
    }, process.cwd());
    return {
      host: target.host,
      port: target.port,
      user: target.user,
      password: target.password,
      database: target.database,
      ssl: target.ssl,
      max: 10,
      connectionTimeoutMillis: 15_000,
    };
  }

  if (env.RENTFLOW_DATABASE_TARGET === 'legacy') {
    return createPostgresPoolOptions(env);
  }

  throw new Error('RENTFLOW_DATABASE_TARGET must explicitly select a supported database target.');
}

export function createPostgresPoolOptions(env: PostgresEnvironment): PostgresPoolOptions {
  const connectionUrl = env.DATABASE_URL;
  if (!connectionUrl) {
    throw new Error('DATABASE_URL must be configured before opening PostgreSQL.');
  }

  const sslEnabled = env.DATABASE_SSL === 'true';
  if (env.NODE_ENV === 'production' && !sslEnabled) {
    throw new Error('DATABASE_SSL must equal "true" in production.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol.');
  }

  let user: string;
  let password: string;
  let database: string;
  try {
    user = decodeURIComponent(parsedUrl.username);
    password = decodeURIComponent(parsedUrl.password);
    database = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
  } catch {
    throw new Error('DATABASE_URL contains invalid encoded connection details.');
  }

  if (!parsedUrl.hostname || !user || !password || !database || database.includes('/')) {
    throw new Error('DATABASE_URL must include a host, database, user, and password.');
  }

  const port = parsedUrl.port ? Number(parsedUrl.port) : 5432;
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('DATABASE_URL must specify a valid PostgreSQL port.');
  }

  return {
    host: parsedUrl.hostname,
    port,
    user,
    password,
    database,
    // Parse the URL into fields so query parameters cannot disable TLS verification.
    ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
    max: 10,
    connectionTimeoutMillis: 15_000,
  };
}
