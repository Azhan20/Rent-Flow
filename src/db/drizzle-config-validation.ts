import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPROVED_TESTING_DATABASE_HOSTS = new Set([
  'ep-floral-dawn-be6dbzbp-pooler.c-9.us-east-2.aws.neon.tech',
]);
const TESTING_DATABASE_NAME = 'neondb';

export function resolveProjectRootFromConfigUrl(configUrl: string): string {
  return resolve(dirname(fileURLToPath(configUrl)), '../..');
}

export type TestingDatabaseTarget = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: typeof TESTING_DATABASE_NAME;
  ssl: 'verify-full';
};

export function validateTestingDatabaseTarget(env: {
  DATABASE_URL?: string;
  DATABASE_SSL?: string;
}): TestingDatabaseTarget {
  const connectionUrl = env.DATABASE_URL;
  if (!connectionUrl) {
    throw new Error('DATABASE_URL is required for the testing migration target.');
  }

  if (env.DATABASE_SSL !== 'true') {
    throw new Error('DATABASE_SSL must equal "true" for the testing migration target.');
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

  if (!APPROVED_TESTING_DATABASE_HOSTS.has(parsedUrl.hostname)) {
    throw new Error('DATABASE_URL must use the approved testing database hostname.');
  }

  if (parsedUrl.pathname !== `/${TESTING_DATABASE_NAME}`) {
    throw new Error('DATABASE_URL must select the neondb testing database.');
  }

  let user: string;
  let password: string;
  try {
    user = decodeURIComponent(parsedUrl.username);
    password = decodeURIComponent(parsedUrl.password);
  } catch {
    throw new Error('DATABASE_URL contains invalid encoded credentials.');
  }

  if (!user || !password) {
    throw new Error('DATABASE_URL must include a database user and password.');
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
    database: TESTING_DATABASE_NAME,
    ssl: 'verify-full',
  };
}
